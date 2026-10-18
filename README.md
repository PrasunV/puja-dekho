# Puja Dekho

A Durga Puja pandal-hopping map for South Kolkata. 271 pujas, Blue and Green line stations, crowd-sourced queue times and road reports, anonymous ratings, and a shortest-walk tour planner. Built for 18 to 30 year olds who are visiting or new to the city and mostly on foot.

|              |                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Front end    | React 18, Vite 5, Motion, MapLibre GL 5 on free OpenFreeMap tiles                                             |
| Back end     | Node 22, Express 4, libSQL (Turso in production, a local file in development)                                 |
| Hosting      | Vercel (static site on the CDN, `api/index.js` as one function)                                               |
| Language     | JavaScript with JSDoc types, checked by `tsc`                                                                 |
| Type and map | Inter (self-hosted) with Noto Sans Bengali as the Bengali fallback                                            |
| Brand        | primary `#B31D24`, accent `#FC8105`, dark maroon `#4A0E14`. Layout patterns only; no third-party logo or font |

## Quick start

Needs Node 22 (`nvm use` reads `.nvmrc`). Run `npm install` once, in the folder that contains `package.json`.

**Everyday development** (two terminals):

```sh
npm start        # terminal 1: API and local database on http://localhost:3000
npm run dev      # terminal 2: the app with hot reload. Open http://localhost:5173
```

**Check the production build:**

```sh
npm run build    # builds the app into dist/
npm start        # serves API and built site together on http://localhost:3000
```

## Scripts

| Command             | What it does                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `npm run check`     | Everything CI runs except e2e: lint, format check, types, tests, build |
| `npm test`          | Unit and API tests (`node --test`, no browser)                         |
| `npm run e2e`       | Browser tests with Playwright against the built app                    |
| `npm run lint`      | ESLint (React, hooks, accessibility rules)                             |
| `npm run typecheck` | `tsc` over the JSDoc types                                             |
| `npm run format`    | Prettier                                                               |
| `npm run data`      | Rebuild `public/data/*.json` from `data-src/`                          |

`npm run e2e` needs a Chromium. Either `npx playwright install chromium` once, or point `PLAYWRIGHT_CHROMIUM_PATH` at one you already have. Run `npm run build` first.

## Where things live

```
server/        Express API (see docs/ARCHITECTURE.md)
  rules.js       every tunable number: weights, windows, caps
  config.js      environment parsing (the only place that reads env vars)
  services/      business rules: ratings, queues, road reports
  routes/        HTTP in, service call, JSON out
  http/          errors, security headers (CSP), rate limiter
  db/            libSQL client and schema
  lib/           pure helpers: geo, stats, nickname rules, cookies
api/index.js   Vercel entry point
src/           React app
  features/      one folder per screen: explore, puja, tour, metro, map, layout
  hooks/         state and effects with one job each
  context/       app context (memoised) and toasts (separate, so they do not re-render the app)
  lib/           pure logic: geo, metro schedule, tour ordering, storage, API client
  components/ui/ shared building blocks: icons, dots, error boundary
public/data/   generated puja and metro data
data-src/      source data and scripts/build-data.py
test/          unit and API tests      e2e/   Playwright specs
docs/          architecture, API, conventions, parked v2 code
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit, the rules behind ratings and queues, and why they are the way they are
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md): colour tokens, sizes, and the chip, button, input and filter-sheet specs
- [docs/API.md](docs/API.md): every endpoint, request, response and error code
- [CONTRIBUTING.md](CONTRIBUTING.md): code style, how to add a feature, how to change a rule
- [DEPLOY.md](DEPLOY.md): GitHub, Turso and Vercel, step by step

## Before launch

1. Follow DEPLOY.md and set `SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` on Vercel.
2. Verify metro hours in `public/data/metro.json` against the Metro Railway Kolkata notice. The phase calendar is in `scripts/build-data.py` (`METRO_PHASES`); Saptami's date (17 or 18 Oct) is unconfirmed in the sources.
3. Open the live site on a real phone, at a real location, and check the nearest pujas, the chips, the map and the cluster numbers (they depend on the tile provider's fonts).
4. Check that the name, domain and social handles are free for you. This has not been verified.

## Known gaps in v1

- The UI is English only. Bengali text renders (Noto Sans Bengali) but is not translated.
- Purple Line stations are not mapped. Metro times are per line, not per station, and come from a third-party site and a news report.
- The offline mode caches the app and puja data, not map tiles. Road closures come from user reports only.
- The map is light only; the rest of the app follows the system theme.
- Parked for v2 (code kept in `docs/v2-parked/`): Google sign-in, check-ins with photos, points and badges.
