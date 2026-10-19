# Putting Puja Dekho online (GitHub, Turso, Vercel)

You need three free accounts: GitHub, Turso (the database) and Vercel (hosting).

## 1. Make the secret (one time)

The SECRET is a long random password. The server uses it to sign the cookie that tells it which phone is which. If someone knew it, they could fake phones and stuff the ratings. Never put it in the code or on GitHub.

Make one by running this in the VS Code terminal and copying the output:

    node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

## 2. Create the database on Turso

1. Sign up at turso.tech and create a database (pick a region near India, e.g. Mumbai if offered).
2. Copy two values from the database page: its URL (starts with `libsql://`) and an auth token.
   The server creates its own tables the first time it runs.

## 3. Push the code to GitHub

Unzip the project, open it in VS Code, then Source Control > Publish to GitHub. `.gitignore` already keeps `node_modules`, `dist`, `data` and `.env` files out.

## 4. Deploy on Vercel

1. Vercel > Add New > Project > import the GitHub repo. Vercel reads `vercel.json`, so leave the build settings alone.
2. Before pressing Deploy, open Environment Variables and add:
   - `SECRET` = the value from step 1
   - `TURSO_DATABASE_URL` = the `libsql://...` URL
   - `TURSO_AUTH_TOKEN` = the token
3. Deploy. Vercel sets `NODE_ENV=production` itself, you do not add it.
4. Open `https://<your-project>.vercel.app/api/health`. If it shows `{"ok":true,...}` the server and database work.

## Running it on your own computer

Local runs use a file database in `data/`, so you need no Turso account.

    npm install
    npm run build
    npm start        # http://localhost:3000
    npm run check    # lint, types, tests, build

`npm run dev` starts only the front end (no API), so use build + start when you want ratings and queue reports to work.

## Things to know

- Free Turso and Vercel plans have monthly limits. Fine for launch week; watch the dashboards if it goes viral.
- The per-network write limiter lives in memory, so on Vercel each server instance has its own. The per-phone cooldowns and daily caps live in the database and hold everywhere.
- Photos, Google sign-in, check-ins and points are parked in `docs/v2-parked/` for v2. Check-in photos would need file storage such as Vercel Blob.
- The nickname filter is strict on purpose: a few real names that are also short slurs (for example "Bal") are refused. See docs/ARCHITECTURE.md to loosen it.
- Security headers are set twice (Express and `vercel.json`) because Vercel serves static files directly. A test keeps them identical.
- Continuous integration: `.github/workflows/ci.yml` runs lint, format check, types, tests, build and the browser tests on every push and pull request.

## The "people viewed" / "exploring now" pill

The pill at the top-left of the sheet shows two numbers from two small endpoints. Both need only the database, not `SECRET`.

- **Viewed** (`/api/visits`, `api/visits.js`, `server/visits.js`): the running total of people who have opened the app since
  go-live. One count per device per day (India time).
- **Exploring now** (`/api/live`, `api/live.js`, `server/live.js`): how many phones have the app open right now.

The pill opens on "N people viewed", rolls over to "N people exploring now" after about three seconds, stays there for
three and a half seconds, then rolls back, and keeps alternating (rolling text, the pill eases to each new width, a
green dot shows while it says "exploring now"). "1 person exploring now" is allowed.

It only says "exploring now" while **another device has used the app in the last 2 hours**. On a quiet app, or at the
very first visit of the night, it stays on "N people viewed" and does not roll. The timings are `VIEWED_MS` and
`EXPLORING_MS` at the top of `src/features/layout/MapOverlays.jsx`; the 2 hours is `RECENT_MS` in `server/live.js`.

- Each open, visible tab checks in every 30 seconds with a random device id (kept in the phone's storage, not tied to a
  person). Anyone seen in the last 90 seconds counts. A hidden tab stops checking in and drops off.
- Check-ins older than 3 hours are deleted as it goes, so the table stays small (one short row per device). Each active phone makes about two
  small writes a minute, which is fine for the free Turso plan at festival scale. Watch the Turso dashboard if it goes viral.
- Crawlers and link previews are read but never counted. The count can still be inflated by someone scripting fake ids.
- If a counter is down, the pill uses the other one. If both are down it hides.
- With reduced motion switched on, the text swaps without rolling.

Setup (once): in Vercel, open the project, then **Storage** and connect **Turso** (accept the defaults). This adds
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Redeploy so the new code picks them up, then check
`your-url/api/live` (it answers `{"count":0,"recent":0}` or higher numbers) and `your-url/api/visits`.

Until Turso is connected both endpoints answer 503 and the pill stays hidden.

## How the bottom sheet moves

On phones the whole sheet is the handle: a vertical drag that starts anywhere on it (in any state) moves it. When a finger lets go, the sheet looks at how fast the finger was going and settles on the nearest of peek / half / full to where that speed would carry it, so a short fast flick jumps a state and a slow drag settles on the nearest one. The motion style is **iOS-style** (a lightly damped spring that keeps your momentum).

To compare other styles on a phone without a rebuild, open the app with `?motionlab` at the end of the address (a "Motion" chip appears at the top right) or `?sheetMotion=snappy` (also `spring`, `quick-out`, `decel`, `ios`, `bouncy`). The choice is remembered on that phone. The default lives in `src/features/layout/sheetMotion.js`.
