# Puja Dekho: full handoff for the next build

Written 24 Oct 2026 by Claude from the whole build history. Owner: Prasun (LinkedIn: https://www.linkedin.com/in/prasun-mondal-b25320214/).
Live MVP: https://puja-dekho.vercel.app · Code: https://github.com/PrasunV/puja-dekho (Vercel deploys `main`).

## 0. How to use this file in a new chat

Paste or attach this file first, then attach the code zip. Then say what you want built. Suggested opening message:

> You are my senior product designer and engineer. Read PUJA-DEKHO-HANDOFF.md fully before doing anything. We are turning the Puja Dekho MVP into a platform for many festivals (next: Jagadhatri Puja, Chandannagar). Keep the current stack. Do not assume anything about product decisions: ask me questions first, and send an interactive preview for every change I suggest. Every UI piece must be responsive from small Android to large iPhone. End every build with the list of what is still left.

Working rules Prasun has stated (keep them):
1. On product work, do not assume; ask questions first.
2. For any change he suggests, send an interactive preview to check, not screenshots.
3. When a build is finished, end with the list of items still left to build.
4. Every UI component (sheets, cards, everything) must be responsive across mobile screens, Android to iOS. He will not repeat this.
5. He pushes code himself from his PC with git. Give him commit commands. Add the attribution lines the tool asks for.
6. He is time-sensitive and gets frustrated by slow replies. Say what you are doing in one line, then do it.

Things marked **PROPOSED** are ideas, not decisions. Things marked **UNVERIFIED** need checking before you rely on them.

---

## 1. The product in one paragraph

Puja Dekho is a free, mobile-first web map for Durga Puja pandal-hopping in Kolkata. It shows 664 pujas on one map with a draggable bottom sheet (list, filters, puja details, metro, directions). It was built by one person for the 2026 festival, planned for launch on 15 Oct 2026, and expanded in the last days with a Bhasan (immersion) special and a share flow.

## 2. Problem statement

Durga Puja in Kolkata has hundreds of pandals across the city. First-timers cannot tell where to go, in what order, or how to get there.

- **Who struggles:** people aged 18 to 30. Mostly visitors from outside Kolkata and new residents. About half of the requests to the app come from outside the city.
- **What goes wrong:** pandal lists are scattered across chats, reels and word of mouth. Nobody knows which pandals are close together, which roads are closed, how long the queue is, or which metro station is nearest.
- **Why it matters:** puja days are short and crowded. A bad route wastes an evening; a good one lets a visitor see more pandals and still get home.
- **Success metrics:** number of users, number of completed tours. (No analytics events exist yet, so neither is measured. See backlog.)

## 3. Approach and thought process

1. **Map first.** The map is the main screen. Everything else lives in a bottom sheet over it, like Google Maps, so people never leave the map.
2. **Borrow familiar patterns, keep our own brand.** Planning and browsing follow Airbnb (cards, pill chips, filters, a sheet that snaps). The map behaviour follows Google Maps (location button, follow mode). Brand is ours: red `#b31d24`, orange `#fc8105`, dark maroon, Plus Jakarta Sans.
3. **Cut sign-in.** Gmail sign-in, check-ins and points were planned and then parked for v2. The MVP asks for nothing. (An optional nickname existed for ratings and queue reports; those are hidden in the MVP.)
4. **Start small, widen on demand.** The first plan was South Kolkata only (a 3-day build). On 18 Oct 2026 it became the whole city, with combinable area chips: South, North, Central, East, Other.
5. **Design for the stranger.** Every label must make sense on first use without explanation. Filters live in one place. A filter that is on must be visible without opening a sheet.
6. **Serve outsiders explicitly.** Anyone more than 25 km from Kolkata is a "visitor" and gets a visitor card and a city view, not a distance list that means nothing.
7. **Park what is not essential.** Check-ins, points, ratings, queue levels, road reports, tours, elders and children features, police, hospital and SOS were moved out of the MVP so the core could ship on time. The code for several of them is kept (see section 12).
8. **Scope was cut, never the date.** The festival date is fixed. Time-boxed features switch themselves off by date (Bhasan, greetings).
9. **Test before every push.** Playwright end-to-end tests run on phone-sized screens, in light and dark, at 100% and 150% text.

### Iteration log

| Stage | What was built | What changed and why |
| --- | --- | --- |
| 1. Idea | Map visualiser for pandal-hopping, shortest-path tours for North and South Kolkata | Narrowed to a web app that could ship in about 3 days, South Kolkata first |
| 2. v1 scope | Queue levels, road closures, nearest metro, ratings, points | Check-ins, points, Gmail sign-in moved to v2 |
| 3. Look and feel | Airbnb-style cards and sheets, Google Maps-style map, brand colours, dark mode from the phone setting | Black replaced by dark maroon; filters moved into one bottom sheet; top bar kept to distance and Filters chips |
| 4. Naming | Pujo Hop, then Pooja Dekho, then Puja Dekho (18 Oct) | Renamed across the codebase, moved to a fresh GitHub repo |
| 5. Coverage | South only, then whole city (18 Oct) with combinable area chips | One link for everyone |
| 6. Social proof | "People viewed" counter (once per device per day, shared total in Turso) and a "people exploring now" chip | Real usage number and trust |
| 7. Visitors | Visitor mode beyond 25 km (decided 20 Oct), welcome card | Half of traffic is from outside Kolkata |
| 8. Greetings | Maha Ashtami animation, Shubho Bijoya picture, welcome card copy | Festival tone; on a date list so they end by themselves |
| 9. Bhasan special | Ghat card, "View live at" YouTube stream cards, ghat details sheet, map marker, header override, 3 chips on ghat card | Built in the last days for Dashami; ends 24 Oct 2026 23:59 IST |
| 10. Sharing | Press and hold or tap share icon on a video card, "Sharing…" sheet with "Post on WhatsApp" and "Copy link"; own link page with preview picture | Links lead to our app, not a TV channel; neutral copy |
| 11. Hidden count | Tagged share links (`?s=wa`) counted per source, read on a private page behind a secret key | Measures what sharing really brings, no UI change |
| 12. Replay | Until 24 Oct 23:59 IST, welcome card and the whole first-visit flow replay on every open for everyone | Bijoya wish for all visitors, returning ones included |
| 13. Polish | Favicon and app icons, OG preview image, ghat details one-line distance, stacked-button fix at small widths, welcome card flip bug fix | Each came from a real screenshot |

65+ tested preview versions were shipped during the build (the preview reached v68 on 24 Oct).

## 4. Users and context

- **Primary:** 18 to 30, Kolkata residents and visitors, on phones in crowded streets, often one-handed, often on weak networks, in bright sun or at night.
- **Secondary:** newcomers to Kolkata; people outside the city planning a trip.
- **Deferred to v2:** elders and children features.
- **Language:** English now, written in simple words. Bengali is planned (`Noto Sans Bengali Variable` is already loaded).
- **Device range:** 320 px wide small Androids up to 430 px iPhone Pro Max; tablets and desktop work (desktop gets a side panel instead of a bottom sheet).

## 5. UX decisions and why (keep these unless Prasun reverses them)

1. **Bottom sheet over a full-screen map.** Snap points: peek 12%, initial 35%, half 57%, full 93%. The list always opens at 35%; a person who turns out to be in Kolkata is lifted to half once on first fix.
2. **Filters in one sheet; two chips on the bar** (Distance, Filters with a count). Applied area and saved filters show underneath as removable chips.
3. **List holds all pujas, nearest first.** The radius sets the header count, the popular strip, the map zoom and the "Farther than X" divider. Choosing a metro station replaces the radius (pujas within 1 km of it, or 5 km if none).
4. **Zones combine with OR; sections combine with AND.**
5. **Crowd is "usually", never "live".** Worded "Usually X at this hour", never green/amber/red, because it is a typical pattern from placeholder data, not a live report.
6. **Visitors get a visitor view.** Beyond 25 km the dot is drawn but distances and the radius chip are off; the map stays on Kolkata; a one-time card explains.
7. **Location is asked in two steps.** An in-app explainer first (so "Not now" does not spend the browser's one-time prompt), then the browser prompt.
8. **No theme toggle.** Light and dark follow the phone. Dark twin tokens only inside `@media (prefers-color-scheme: dark)`.
9. **One main action per screen.** Red `--primary` is only the main map action. Dark maroon buttons for forms and sheets. Orange is a highlight, never a button fill.
10. **Every tappable thing is at least 44 to 48 px**, visibly or through its tap area. Map dots have a 14 px tap area.
11. **Plain English.** "Bijoya Bhasan happening…", "Visit ghats near you", "View live at", "Sharing…", "Post on [WhatsApp icon]". No jargon, no channel names in shared copy.
12. **Share links go to our own page** with a neutral title and our own picture, never the broadcaster's.
13. **Time-boxed features carry their own end date** in one data file and remove themselves (no redeploy to hide them).
14. **Public counter vs hidden counter.** The public "people viewed" number is untouched; share-source counts are private and never shown in the UI.

## 6. User flows

### 6.1 First visit (Kolkata, location not yet decided)
1. Open link → map loads with whole-city framing; greeting picture plays in the first sheet if it is a greeting day.
2. Welcome sheet (explainer): title, one line, **Allow** / **Not now**.
3. Allow → browser location prompt → fix arrives → map centres on person; list lifts to half once; header shows "N pujas near you".
4. Not now → city view, header shows "664 pujas in Kolkata"; list still works; the location button can ask again.
5. A one-time tooltip names the Report button after 60 s in the app.

### 6.2 Replay flow (until 24 Oct 2026 23:59 IST)
Every open, for everyone (new, returning, allowed, blocked): welcome card → location sheet → visitor card if far away → report tip. The card stays until the person answers it; it must not be swapped by a location fix. After the end date: normal first-visit-only behaviour and the regular welcome copy ("See pujas near you").

### 6.3 Returning visitor
Open → straight to map and list at 35% (greeting only on its days) → location resumes silently if already allowed.

### 6.4 Visitor (more than 25 km away)
Open → outside card ("N pujas in Kolkata") → city view, distances off, radius chip hidden → pick an area or a metro station in Filters.

### 6.5 Location denied
Open → no explainer → city view, header "664 pujas in Kolkata" → radius section in Filters explains how to allow, no button.

### 6.6 Browse and filter
List ← → map. Distance chip steps through 500 m, 1 km, 5 km, 10 km, 20 km. Filters sheet: radius, metro station, nearby area, "Less crowded" switch. Footer button reads "Show N pujas" live; "Clear all" disabled until something differs.

### 6.7 Puja detail
Tap a card or a map dot → detail sheet: name, area, "usually X at this hour", bento tiles (Metro, Heritage, Address with Copy and Open in Maps), footer: **Get directions** (2/3 width) and **Save** (1/3, still "Coming soon").

### 6.8 Metro
Metro button → lines and stations; pick a station → pujas within 1 km (5 km fallback with a note); nearest-station results also appear on a puja.

### 6.9 Bhasan special (ends 24 Oct 2026 23:59 IST)
Header "Bijoya Bhasan happening… / Visit ghats near you" (only when no filter or area is chosen) → Ghat card (name, area, status chip, "Bhasan started from 21st Oct" chip, "CM S.Adhikari visited" chip, distance) → tap → ghat details (area · distance, status, address tile, note, Get directions, Share) → "View live at" video cards (newest first; open YouTube in a new tab).

### 6.10 Share
Long-press (500 ms) or tap the share icon on a video card, or Share on ghat details → "Sharing…" sheet (big picture, title, personal line, **Post on [WhatsApp]**, **Copy link [icon]**) → link `/api/share?v=<videoId|ghat>&s=wa|cp` returns preview HTML then redirects into the app with `?s=` tag → one count per device per day per source.

## 7. Interaction guide

- **Sheet drag:** spring motion (`ios` style ships). Flick above 0.45 to 0.5 px per ms moves at least one state. Dragging past the ends stretches with resistance and springs back. A sideways swipe on a carousel scrolls the carousel and never moves the sheet; a vertical swipe that starts on a carousel scrolls the list. `?motionlab` shows a motion switcher for testing.
- **Location button (round, bottom right):** Idle (asks) → Asking (spinner) → On/moved away (grey, flies back) → Centred (blue icon, tap to follow) → Following (blue fill, tap to stop; dragging the map also stops it) → Denied (slashed, explains). Far visitors: the button still flies to them but "Near me works once you're in Kolkata" shows.
- **Map dots:** 14 px tap area; selected puja becomes a red pin; ghat has an orange-ring marker; clusters use maroon.
- **Chips:** 48 px (40 px compact on the bar). Selected = `aria-pressed`, 2 px maroon border, surface-2 fill, weight 600.
- **Buttons:** 48 px; `aria-busy` shows loading.
- **Long-press:** 500 ms; moving more than 10 px cancels; the following click is swallowed; context menu also opens the share sheet.
- **Share sheet:** portal, drag down to close, Escape closes, scrim closes.
- **Toasts:** neutral dark toast; Retry action for location failures only when the location card is out of view.
- **Greeting:** a still picture or Lottie in the first sheet; counted only when it really played; tap replays without counting; reduced motion shows the final frame.
- **Reduced motion:** the LIVE pulse and animations stop.
- **Keyboard and focus:** dialogs trap focus, start on the main action, Escape closes.

## 8. Content and voice

- Simple English a first-time visitor understands in one read. Short sentences. No channel or brand names in shared copy.
- Greeting copy is dated and has an end date; after it ends the regular copy returns.
- Crowd wording: "Usually Low / Moderate / High at this hour". Never show a status colour.
- Share copy is personal ("Watch Dashami immersion live with me"), neutral title, our own picture.
- Public docs and posts credit Prasun with the live link.

---

## 9. Design system and tokens

Source of truth: top of `src/styles.css` (tokens) and the Components block at the bottom. Rules: one definition per component; new colours become tokens first with a dark value; every tappable thing at least 44 px; dark twin only inside `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme='light'])`.

Note: `docs/DESIGN-SYSTEM.md` still says "Inter". The shipping font is **Plus Jakarta Sans Variable** with **Noto Sans Bengali Variable** as the Bengali fallback, then system fonts. Treat the CSS as the truth.

### 9.1 Colour tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | `#121212` | Page |
| `--surface` | `#ffffff` | `#1c1c1c` | Cards, sheets |
| `--surface-2` | `#f7f7f7` | `#262626` | Selected chip fill, pressed fills, tiles |
| `--ink` | `#2b1214` | `#f2f2f2` | Text |
| `--muted` | `#6a6a6a` | `#a8a8a8` | Secondary text |
| `--label` | `#6a6a6a` | `#a8a8a8` | Section labels |
| `--line` | `#dddddd` | `#333333` | Borders |
| `--primary` | `#b31d24` | `#e0434b` | The one main map action, logo |
| `--on-primary` | `#ffffff` | `#1a0507` | Text on primary |
| `--primary-hover` | `#961820` | `#f05e65` | |
| `--accent` | `#fc8105` | `#ff9a33` | Highlights (ratings, counts, ghat ring). Never a button fill |
| `--on-accent` | `#2a1500` | `#2a1500` | |
| `--accent-ink` | `#7a3a00` | `#ffb566` | Text on accent-soft |
| `--accent-soft` | `#fff1e0` | `#3a2410` | Soft orange fills (ghat icon, VIP chip) |
| `--maroon` | `#4a0e14` | `#f0d3d6` | Dark fills and borders: selected chip border, dark button, toasts, clusters |
| `--maroon-hover` | `#36090e` | `#ffe6e8` | |
| `--on-maroon` | `#ffffff` | `#3a0b10` | Text on maroon |
| `--me` | `#1a73e8` | `#669df6` | "You" dot |
| `--link` | `#1a5fd0` | `#8ab4f8` | Links |
| `--blue` | `#1f6feb` | `#5ba0ff` | Blue line, centred location |
| `--green` | `#12975a` | `#3fcb85` | Green line, ok |
| `--yellow` | `#b98700` | `#e0b02a` | Yellow line |
| `--orange` | `#e8590c` | `#ff8a4c` | Orange line |
| `--q0` `--q1` `--q2` `--q3` | `#8a8a8a` `#1fa463` `#e49b0f` `#d92d20` | `#9a9a9a` `#3fcb85` `#f5b531` `#ff6b62` | Queue levels (parked feature) |
| `--ok` | `#12975a` | `#3fcb85` | |
| `--warn-bg` / `--warn-ink` | `#fff4e5` / `#5c3300` | `#3a2a14` / `#ffe2b8` | Notices |
| `--tile` / `--tile-line` | `#f6f3f2` / `#e4e4e4` | `#272324` / `#3a3436` | Warm bento tiles |
| `--tile-head` / `--tile-body` | `#3a2e30` / `#5f5456` | `#f3eaec` / `#c4b8bb` | Tile text |
| `--toast-bg` / `--toast-ink` | `#2b2527` / `#ffffff` | `#ece6e7` / `#1c1517` | Toast |
| `--handle` | `#8f8f8f` | `#8a8a8a` | Sheet drag handle |
| `--shadow` | `0 6px 20px rgba(0,0,0,.16)` | `0 6px 20px rgba(0,0,0,.55)` | Floating |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.08)` | `0 1px 2px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.4)` | Cards |
| `--shadow-chip` | `0 1px 2px rgba(0,0,0,.08)` | `0 1px 2px rgba(0,0,0,.5)` | Chips |

Never use `#222` or black for a fill or border; use `--maroon`.

### 9.2 Size, shape, type

| Token | Value | Use |
| --- | --- | --- |
| `--h-control` | 48 px | Buttons, inputs, chips in sheets |
| `--h-compact` | 48 px in CSS (docs say 40 px; the bar chips use `.compact`) | **UNVERIFIED**: check before relying on it |
| `--hit` | 48 px in CSS (docs say 44 px) | Minimum tap target; treat 44 px as the floor |
| `--r-control` | 12 px | Buttons, inputs |
| `--radius` | 16 px | Cards, menus |
| `--r-sheet` | 24 px | Sheet top corners |
| Chip radius | 999 px | Pill |
| Spacing grid | 4, 8, 12, 16, 24, 32 | Padding and gaps (4/8 pt grid) |
| `--side` | 440 px | Desktop side panel width |
| Body | 15 px / 1.45, weight 400, `--font-body` | |
| Font stack | `'Plus Jakarta Sans Variable', 'Noto Sans Bengali Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | |

Responsive range tested: 320, 360, 390, 430 px phones and 768 px tablet, at 100% and 150% text (the `scaleText` and `problems` helpers in `e2e/responsive.spec.js`).

### 9.3 Components (all in `styles.css`, defined once)

Chip (`.chip`, `.chip.compact`, `.chip-n` count), Button (`.btn`, `.btn.dark`, `.btn.primary`, `.btn.small`, `.btn.text`, `.btn.block`), Icon button (`.icon-btn`), Input and select (48 px, maroon border on focus), Switch, Filters sheet, Filter bar, Bottom sheet, Peek line, Puja card (`.pcard`, `.dist-pill`), Popular strip, Bento tiles (`.tile`), Toast, Explainer/welcome sheet, Outside (visitor) card, Ghat card (`.ghat-card`, `.ghat-ic`, `.ghat-meta`, `.ghat-chip`, `.ghat-vip`), Video card (`.vid-card` with LIVE badge and pulse dot), Share sheet, Speed dial, Header/top bar (logo light and dark, name, version, credit link).

### 9.4 Chip patterns used on the ghat card (for consistency)
- Status chip: grey `.tag.ghat-chip`; "on now" variant is accent with a pulse dot.
- "Started from" chip: grey `.tag.ghat-chip` (same look as status).
- VIP chip: `.tag.ghat-vip`, same fill, text and border as the ghat icon (`--accent-soft`, `--accent-ink`, `--accent` border).
- The row wraps (`flex-wrap`, 4 px row gap, 8 px column gap); with three chips and a distance it wraps to two rows.

### 9.5 Accessibility baseline
Dialogs use `role="dialog"`, `aria-modal`, focus start on the main action, Escape closes; icon buttons have labels; selected chips use `aria-pressed`; reduced motion respected; 150% text must not clip or overflow (tested).

---

## 10. Architecture and data

### 10.1 Stack (keep)
React 18, Vite 5, MapLibre GL 5 (OpenFreeMap `positron` style, no key), `motion` for animation, `@lottiefiles/dotlottie-web` for greetings, Express server (one Vercel function, or `npm start` locally), libSQL/Turso for counters, Playwright e2e, Node test runner for server and lib tests, ESLint, Prettier, TypeScript type-check over JSDoc. Hosting: Vercel (deploys `main`). Node 22.

### 10.2 System shape
```
Browser (React) ──/data/*.json──▶ static files on the CDN (pujas.json, metro.json)
       │
       └────/api/*────▶ Express app ──▶ libSQL (Turso)
```
Puja and metro data are static, built ahead by `scripts/build-data.py` from `data-src/`. Only things that change while people use the app go through the API. If the API is down the app still opens.

### 10.3 Client structure
`src/App.jsx` composes hooks and provides one memoised `AppContext` (`useApp()`). Features: `explore` (list, filters, sort, popular strip, puja card), `map` (MapView, pins), `puja` (detail page, bento, near-puja), `metro`, `bhasan` (ghat card, ghat page, videos), `share` (sheet, long press, links), `greeting` (greetings, media), `layout` (bottom sheet, peek, header, explainer, outside card, overlays, toasts, motion lab), `tour` (parked UI). Hooks: `usePujaData`, `usePujaFilters`, `useLocation`, `useNav` (`{pujaId, stationId, metro, lines, ghat}`), `useStoredState` (localStorage, `pd_` prefix), `useVisitCount`, `useLiveCount`. `window.__pd` and `window.__pdMap` exist only when `window.__PD_E2E__` is set (tests).

The map is lazy-loaded (about 1 MB). Coordinates: data is `lat, lng`; MapLibre wants `[lng, lat]` (`toLngLat`); MapLibre zoom is one below Leaflet's (`toMapZoom`).

### 10.4 Puja data record (`public/data/pujas.json`, 664 records)
`{ id, n (name), a (alt names), la, lo, ad (address), e (founded), h (heritage), f (featured), ec (conflicting year), m ([[stationId, metres]]), fl (flags), ck (pin exact), ar (area), z (zone: south|north|central|east|other) }`. Metro file: `stations`, `timings`, `phases`, `dates`, `sources`, `note`.

### 10.5 Key constants (`src/config.js`)
Map centre `[22.5185, 88.35]`, zoom 13; `FAR_FROM_KOLKATA_M = 25000`; radius steps 500, 1000, 5000, 10000, 20000 m; `NEAR_STATION_M = 1000`; "You're near" needs 50 m accuracy, 100 m radius, 60 s dwell, clears at 150 m; `RECENTER_MIN_ZOOM = 16`; `AREA_RADIUS_M = 3500`; `PAGE_SIZE = 40`; `MAX_TOUR_STOPS = 15`; report hint after 60 s for 1.8 s. (`docs/DESIGN-SYSTEM.md` says 40 km for visitors: the code and filters doc use 25 km. Use 25.)

### 10.6 Server and API
Layers: config, rules (all tunable numbers), http (errors, security headers, rate limiter), routes (HTTP only), services (validation, abuse rules), db (libSQL), lib (geo, weighted median, nickname rules, cookie signing). Anonymous identity via an HMAC-signed HttpOnly `pid` cookie minted on first write. Endpoints: `GET /api/health`, `GET /api/state`, `POST /api/rate`, `POST /api/report/queue`, `POST /api/report/closure`, `POST /api/closure/:id/vote`, plus the live counters, `/api/share` (preview page), `/api/stats?key=` (private). Full details are in `docs/API.md` and `docs/ARCHITECTURE.md` (in the zip).

Rules worth keeping: ratings are Bayesian-weighted so one 5-star vote cannot top the list; queue reports weigh by distance and halve every 20 minutes; road reports expire after 3 hours; nickname block list is strict on purpose.

Security: CSP allows same-origin scripts and `https://tiles.openfreemap.org`; the same headers live in `server/http/security.js` and `vercel.json` (a test fails if they drift).

### 10.7 Counters
- **Public "people viewed":** once per device per day, total in Turso, starts from go-live. Do not change its logic.
- **Hidden share count:** table `shared_visits(day, source, total)`; cookie `ps` per device per day; `?s=` tag 1 to 20 chars `[a-z0-9_-]`; read at `/api/stats?key=STATS_KEY` (text/plain, 404 without the key, `X-Robots-Tag: noindex`). `STATS_KEY` is set in Vercel.

### 10.8 Time-boxed event module (the Bhasan pattern; reuse it)
All in `src/data/bhasan.js`: `BHASAN.expiresAt` (end, India time), `startedLabel`, `ghat {name, area, address, lat, lng, placeId, note, window}`, `videos[]` newest first with a `live` flag. Helpers: `bhasanActive`, `ghatStatus` (null window → "Bhasan today"; with a window → "Starts at", "Bhasan on now", "Ended for today"), `ghatDirectionsUrl` (Google Place ID, no forced travel mode), `videoId`, `shareCopy`, `onboardingReplay`. Greetings are rows in `src/features/greeting/greetings.js` with a `days` list. Both switch off by date with no redeploy. **PROPOSED:** generalise this into a per-festival "event module".

### 10.9 Testing, build, deploy
- Build `npx vite build`; tests `npx playwright test` (full suite about 14 minutes, 257 tests; e2e specs: bento, bhasan, dark, flows, greeting, location, map, replay, responsive, share, shared-visits, sheet); server and lib tests `npm test`; full gate `npm run check`.
- Tests that depend on dates use a fixed clock or a Date-offset init script. YouTube thumbnails are stubbed in tests.
- Push: `git add -A`, `git commit`, `git push`; Vercel deploys `main`. Env: `STATS_KEY`, Turso URL and token, `SECRET`, optional `VITE_REPORT_FORM_URL`, `VITE_ORS_KEY`.
- Cached by service worker: app shell and the two data files; bump `CACHE` in `public/sw.js` when the cached list changes.

---

## 11. Current status

**Live in the MVP:** map with bottom sheet; list with sort, distance chips, area chips, Filters sheet, Must-visit; puja detail with metro, heritage, address, Get directions; metro lines and nearest station; people-viewed counter and exploring-now chip; light and dark; greetings and welcome flow; visitor mode; top bar with logo, name, version and credit link; favicon, app icons, OG image; Bhasan special; share flow; hidden share count.

**Built but hidden for the MVP:** ratings, queue reports, road reports, tour planner, nickname, "Search this area", "You're near" card. Code kept in `src/features/tour`, `src/hooks/use{Live,Reports,Dwell}*`, `server/services`.

**Parked for v2 (not built or tested):** Google sign-in, check-ins with distance check, photos, points, badges, leaderboard (`docs/v2-parked`). Photos need file storage such as Vercel Blob (Vercel functions have no persistent disk).

**Placeholders to replace:** `VITE_REPORT_FORM_URL`; `src/data/popular.js` (Popular strip is the first 10 featured pujas); `src/data/crowd.js` (typical crowd by hour is a PRD placeholder pattern plus per-puja overrides).

## 12. Known issues and unverified items

- Ghat coordinates (22.564652, 88.33875) and Place ID `ChIJswI8CZ53AjoRtMSihiLpT6c` were not checked against the real Baje Kadomtala Ghat (BBD Bagh is about 1 km north). **UNVERIFIED.**
- Immersion time is unknown (`ghat.window` is `null`), so no time is shown.
- YouTube thumbnails on the live site were not seen in the sandbox (no internet there). **UNVERIFIED.**
- Real WhatsApp preview of the share link needs a real-device check after deploy.
- A faint patch remains where a watermark was removed from `public/og/share.jpg`.
- Docs drift: `docs/DESIGN-SYSTEM.md` says Inter and a 40 km visitor limit; the code uses Plus Jakarta Sans and 25 km. `--h-compact` and `--hit` are 48 px in CSS but 40 and 44 px in the docs.
- A few tests are timing-sensitive (a metro-station test and a greeting test each failed once in the full run and passed on rerun).
- Share-link and welcome copy mention "Shubho Bijoya" in `index.html` OG tags; they need a festival-neutral version after the festival.
- No analytics events exist; success metrics are not measured yet.

---

## 13. Platform plan: many festivals (PROPOSED, needs Prasun's decisions)

Goal: turn the single-festival app into a platform where a new festival (first target: **Jagadhatri Puja, Chandannagar**) is mostly a data and config change.

### 13.1 What is Durga-specific today (must be generalised)
Hard-coded strings ("Puja Dekho", Kolkata, Bijoya, Bhasan), the Kolkata map centre and 25 km visitor rule, Kolkata metro data and phases, area and zone lists (South/North/Central/East/Other), crowd-by-hour placeholder, Popular strip, Bhasan module, greetings, share copy and OG image, `pujas.json` single file, Turso counters without a festival key.

### 13.2 Proposed model
- **Festival config file** per festival: id, name, city, dates (start, end, key days), map centre and zoom, visitor radius, area/zone list, transport layer (metro or none), copy pack (welcome, header, share), brand overrides (accent, greetings), enabled modules.
- **Data per festival:** `public/data/<festival>/pujas.json` with the same record shape (add `festival` and optional `theme`, `lane` or `route` field if needed); optional `transport.json`.
- **Modules** switched on in config: list/map (core), filters, metro (only where transport data exists), event module (Bhasan pattern: a time-boxed card and videos), greetings, share, counters.
- **Routing:** one deployment, festival chosen by path or subdomain (for example `/jagadhatri` or `jagadhatri.<domain>`) **PROPOSED**; shared design system and components; festival theme as a small token override layer on top of the base tokens.
- **Counters and share links** keyed by festival id (add a `festival` column to counters and `shared_visits`).
- **Time-boxed content** continues to remove itself by date.
- Keep the stack. No sign-in until v2.

### 13.3 Jagadhatri Puja, Chandannagar (what is known)
- Prasun's friends asked for it; he visited Chandannagar pujas a lot in college.
- He is approaching the official Instagram page for the puja list and locations. Data is not in hand yet.
- Unknowns to ask him: festival dates for 2026, area structure (Chandannagar lanes/neighbourhoods rather than Kolkata zones), whether there is transport data (railway station, ferry), famous attractions (the lighting, procession, immersion), launch date, and whether to reuse the Puja Dekho name or brand.

### 13.4 Build order (suggested, to confirm)
1. Decide the platform shape and the first deliverable (Jagadhatri launch or the generic platform first).
2. Extract festival config and copy out of code; add festival id to data, counters and share links.
3. Parametrise area/zone chips, visitor rule, map centre, transport layer on/off.
4. Import the Jagadhatri puja list (needs the data) and test the whole flow.
5. Brand layer: festival tokens and greeting rows; neutral OG image and meta.
6. Analytics events (users, completed tours) so success can be measured.
7. Then v2 features that need accounts or storage.

## 14. Backlog (not built)

- Real Save for pujas (button shows "Coming soon").
- Puja cards and list redesign: more data, better visualisation (needs Prasun's preview link or direction).
- Metro first and last train times per station (needs an official notice).
- Large-text check on the remaining screens.
- Analytics events and Bengali copy.
- Wait times, nearby pandals, photo hero, metro lines per station.
- Share for puja cards (parked).
- Tour sheet reachability.
- Remove the first-visit location explainer if Prasun confirms.
- Possible swipeable single row for the video cards (unanswered).
- v2: Google sign-in, check-ins, points, elders and children features, police, hospital and SOS, photos.
- Fix doc drift (section 12).

## 15. Open decisions for the next chat to ask Prasun

1. Platform shape: one app with festival routes, or separate deployments per festival?
2. Name and brand for the platform versus each festival.
3. Which festival and date is the first launch, and what data exists today?
4. Which parked features return first (ratings, queue reports, tours, check-ins)?
5. Does he want accounts (Google sign-in) now, or stay anonymous?
6. Analytics tool and events (users, completed tours at minimum).
7. Bengali: full translation, or key screens first?
8. How should the Bhasan-style event module generalise (immersion, procession, lighting)?

## 16. Glossary

Pandal: a temporary puja structure. Puja: a community Durga Puja (one record in `pujas.json`). Dashami / Bijoya: the last day. Bhasan: immersion of the idol in the river. Ghat: river bank steps. Zone: South, North, Central, East, Other. Visitor: more than 25 km from Kolkata. Peek / initial / half / full: the four heights of the bottom sheet (12%, 35%, 57%, 93%). OG: the link-preview picture and text.
