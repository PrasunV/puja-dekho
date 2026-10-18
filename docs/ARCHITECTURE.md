# Architecture

## Shape of the system

```
Browser (React) ──/data/*.json──▶ static files on the CDN (puja list, metro data)
       │
       └────/api/*────▶ Express app ──▶ libSQL (Turso)
                         (one Vercel function, or `npm start` locally)
```

The puja and metro data are static files, built ahead of time. Only things that change while people use the app (ratings, queue reports, road reports) go through the API. If the API is down the app still opens and works as a read-only preview.

## Server

`createApp({ env, now, dbPath })` in `server/app.js` wires everything. It takes the environment and the clock as arguments, so tests build isolated copies with a fake clock and a throwaway database. Nothing in `server/` reads `process.env` except `server/index.js` and `config.js`.

| Layer        | Folder      | Job                                                                                            |
| ------------ | ----------- | ---------------------------------------------------------------------------------------------- |
| Config       | `config.js` | Parse env vars, fail fast on a missing `SECRET` in production or a missing Turso URL on Vercel |
| Rules        | `rules.js`  | All tunable numbers in one frozen object                                                       |
| HTTP         | `http/`     | Error type and handler, security headers, write rate limiter                                   |
| Routes       | `routes/`   | Translate HTTP to a service call. No business logic                                            |
| Services     | `services/` | Validation, abuse rules, writes. Throw `HttpError` for expected failures                       |
| Data access  | `db/`       | libSQL client (`query(sql).get/all/run`) and idempotent schema migration                       |
| Pure helpers | `lib/`      | Geo, weighted median, nickname rules, cookie signing, puja index                               |

### Anonymous identity

There is no sign-in. The first write mints a random device id and sends it back in an HMAC-signed, HttpOnly cookie (`pid`). A forged or edited cookie fails the signature and is replaced. Clearing site data gives a new device, so abuse is limited by weighting and caps rather than by blocking.

### Ratings

- One rating per puja per device. Re-rating edits it.
- A device can rate 40 new pujas per IST day. One network can mint 60 new devices per hour.
- Each rating weighs 0.4. The 4th and later rating for one puja from one network weighs 0.1.
- The shown score is Bayesian: `(3 × mean + Σ weighted stars) / (3 + Σ weights)`, where `mean` is the global weighted mean once there are 20 weights' worth of ratings, otherwise 3.8. One 5-star vote cannot top the list.
- The raw average and the count are returned too.

### Queue reports

- Level 0 to 3 plus an optional wait in minutes. A report from within 500 m of the pin counts 1.0; one from farther away or with no location counts 0.3.
- Weight halves every 20 minutes. Reports older than 60 minutes are ignored. The shown level is the weighted median.
- One report per device per puja per 10 minutes. 60 reports per device per day.
- Confidence is `low` while the combined weight is under 1.

### Road reports

- A report is a point in greater Kolkata and a kind (closed, one-way, barricade, diverted).
- A same-kind report within 40 m of an active one is stored as a "still there" vote instead of a duplicate pin.
- Reports expire after 3 hours. Two or more "cleared" votes that outnumber "still there" hide a report early. The reporter counts as one "still there".

### Nicknames

Optional, 2 to 20 letters, numbers, spaces, dots, dashes or underscores (Bengali letters and vowel signs included). Stored with every rating and queue report. Shown publicly only on the queue line ("Level · nickname or A visitor · time"). The block list (`server/lib/nickname.js`) is deliberately strict: short words are matched as whole words, long words anywhere, with look-alike characters and repeats normalised. The trade-off is that a few real names that are also short slurs are refused. To loosen it, remove the word from `BLOCKED_WORDS`.

### Security headers

`server/http/security.js` is the single source for the headers. Vercel serves static files without going through Express, so the same headers are written into `vercel.json`, and `test/server/csp.test.js` fails if the two drift apart. The CSP allows only same-origin scripts and `https://tiles.openfreemap.org` for map tiles. If you change the tile provider, update `connect-src` in `security.js`, then copy the value into `vercel.json` (the test tells you if you forget).

### What lives in memory, and what does not

The per-IP write limiter and the 10-second aggregate cache are per server instance. On Vercel each instance has its own. Cooldowns and daily caps are database queries, so they hold across instances.

## Client

State is split by how often it changes and who needs it.

| Concern                        | Where                                                      |
| ------------------------------ | ---------------------------------------------------------- |
| Static data (pujas, stations)  | `usePujaData`, loaded once                                 |
| Live data and offline fallback | `useLiveState` (polls every 30 s while the tab is visible) |
| Search, distance, area, sort   | `usePujaFilters`                                           |
| Location and live watch        | `useLocation`                                              |
| "Is it crowded?" prompt        | `useDwellPrompt` + pure `lib/dwell.js`                     |
| Sending reports and ratings    | `useReports`                                               |
| Saved pujas, tour, nickname    | `useStoredState` (localStorage)                            |
| Toasts                         | `ToastContext`, separate from the app context              |

`App.jsx` composes these hooks and provides one memoised `AppContext`. Feature screens read from it with `useApp()`.

The map is lazy-loaded (`React.lazy`) because MapLibre is about 1 MB. `features/map/MapView.jsx` creates the map once and syncs it from props through small effects; event handlers read the freshest props from a ref. It exposes an imperative handle (`flyToPuja`, `fitTour`, ...) for camera moves. Two error boundaries keep a map failure from blanking the app, and a render error from leaving a white screen.

### Coordinates and zoom

Data uses `lat, lng`. MapLibre wants `[lng, lat]`; convert with `toLngLat` (`features/map/dom.js`). MapLibre's zoom is one below Leaflet's for the same view, and the numbers in this project were tuned in Leaflet terms, so use `toMapZoom` (`lib/geo.js`).

### Distances and walking time

Distances are straight-line (haversine). Walking time multiplies by 1.3 for real streets and divides by 75 m a minute. This is a rough guide, and the UI says so.

### Tour planning

`lib/tour.js` finds the exact shortest open path with Held-Karp dynamic programming. It is O(2ⁿ·n²), so a tour is capped at 15 stops (`MAX_TOUR_STOPS`). Google Maps links are built in overlapping chunks of 10 points.

### Metro schedule

Hours are per line, in `public/data/metro.json`. Which schedule applies on a date comes from the `phases` calendar in the same file (built from `METRO_PHASES` in `scripts/build-data.py`), not from code. Dates are compared in IST regardless of the viewer's time zone.

### Offline

`public/sw.js` caches the app shell and the two data files as they are used. API calls and map tiles are never cached. Bump `CACHE` in `sw.js` when the cached file list changes.

### Testing hooks

The e2e suite sets `window.__PD_E2E__` before load. Only then does the app expose `window.__pdMap` (the map) and `window.__pd` (open a puja, simulate time near a puja). In production these are never set.

## Data pipeline

`data-src/` (map export and timing sources) → `scripts/build-data.py` → `public/data/pujas.json` and `metro.json`. Puja records use short keys to keep the file small; `src/lib/types.js` documents each one.
