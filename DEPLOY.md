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

The pill opens on "N people viewed" with the number counting up from zero, holds for about nine seconds, rolls over to
"N people exploring now", holds nine seconds, then rolls back, and keeps alternating. The number is an odometer (each
digit is its own wheel that turns through the digits in between, right-most landing last; it turns up when the number
grows and down when it shrinks, and also rolls when the live count changes). The words crossfade, and the pill eases to
each new width in a quarter of a second. A green dot shows while it says "exploring now". "1 person exploring now" is allowed.

It only says "exploring now" while **another device has used the app in the last 2 hours**. On a quiet app, or at the
very first visit of the night, it stays on "N people viewed" and does not roll. The hold is `HOLD_MS` at the top of
`src/features/layout/MapOverlays.jsx`; the wheels are `src/components/ui/CountRoll.jsx` and the words
`PhraseSwap.jsx`; the 2 hours is `RECENT_MS` in `server/live.js`.

- Each open, visible tab checks in every 30 seconds with a random device id (kept in the phone's storage, not tied to a
  person). Anyone seen in the last 90 seconds counts. A hidden tab stops checking in and drops off.
- Check-ins older than 3 hours are deleted as it goes, so the table stays small (one short row per device). Each active phone makes about two
  small writes a minute, which is fine for the free Turso plan at festival scale. Watch the Turso dashboard if it goes viral.
- Crawlers and link previews are read but never counted. The count can still be inflated by someone scripting fake ids.
- If a counter is down, the pill uses the other one. If both are down it hides.
- With reduced motion switched on, the number and words swap without rolling.

Setup (once): in Vercel, open the project, then **Storage** and connect **Turso** (accept the defaults). This adds
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Redeploy so the new code picks them up, then check
`your-url/api/live` (it answers `{"count":0,"recent":0}` or higher numbers) and `your-url/api/visits`.

Until Turso is connected both endpoints answer 503 and the pill stays hidden.

## How the bottom sheet moves

On phones the whole sheet is the handle: a vertical drag that starts anywhere on it (in any state) moves it. When a finger lets go, the sheet looks at how fast the finger was going and settles on the nearest of peek / half / full to where that speed would carry it, so a short fast flick jumps a state and a slow drag settles on the nearest one. The motion style is **iOS-style** (a lightly damped spring that keeps your momentum).

To compare other styles on a phone without a rebuild, open the app with `?motionlab` at the end of the address (a "Motion" chip appears at the top right) or `?sheetMotion=snappy` (also `spring`, `quick-out`, `decel`, `ios`, `bouncy`). The choice is remembered on that phone. The default lives in `src/features/layout/sheetMotion.js`.

## Festival greeting (the Lottie animation, or a still picture, in the first sheet)

When someone opens the app from a link in a browser, the first sheet they see plays a short Lottie greeting in place of
its round icon: "See pujas around you" for people in Kolkata, "N pujas in Kolkata" for people far away. Only the
first sheet of an open gets it (the next sheet keeps its icon), for the first 3 opens on a phone (counted across both
sheets), and never in the installed app.

- A shimmer box of the animation's exact shape holds the space until it is ready, so nothing moves. It waits up to
  8 seconds; after that the box folds away, the normal icon takes its place, and that open is not counted. A late
  arrival does not pop back in. With reduced motion it shows the finished frame.
- The file is used exactly as exported (`public/anim/maha-ashtami.lottie`, about 1.9 MB) and is drawn by the official
  dotLottie player (`@lottiefiles/dotlottie-web`, pinned), which is what LottieFiles uses. The web player
  (`lottie-web`) cuts this particular file at the top and bottom, so it is not used. The player's engine
  (`dotlottie-player.wasm`, about 1.2 MB, 0.5 MB over the wire) is bundled with the app. All of it is fetched as soon
  as the app starts, but only on opens that get a greeting.
- Running the engine needs WebAssembly, so the content security policy has `'wasm-unsafe-eval'` in `script-src`. That
  allows WebAssembly only, not eval of JavaScript. It is set in `server/http/security.js` and mirrored in
  `vercel.json` (a test keeps them identical).
- A greeting can also be a still picture: give its row `kind: 'image'` and a `.svg` or `.png` in `public/anim/` (Shubho Bijoya, `shubho-bijoya.svg`, is one). It fades in once decoded and stays; no player or engine is loaded for it.
  It is on every open, any day, browser and installed app, until its row is set to `days: []`.
- Greetings live in `src/features/greeting/greetings.js` (`GREETINGS`): an id, the file, a label, the size and the
  India dates it plays on (`days: null` means any day). Add a row and drop the file in `public/anim/`.
- To check one at any time: add `?greeting=maha-ashtami` to the address (not counted). `?greeting=off` turns it off.
  The count is kept in the phone's storage as `pd_greeted`.

## Share-link count (private)

Share the app with a tag so you can count who came from where: `https://puja-dekho.vercel.app/?s=wa` (WhatsApp), `?s=ig`, `?s=fb`. A tag is 1 to 20 letters, digits, `-` or `_`.
Each device counts once per day per tag-visit, apart from the public "people viewed" number (which is unchanged).
To read it, add a long secret as `STATS_KEY` in Vercel (Settings, Environment Variables), redeploy, then open `https://puja-dekho.vercel.app/api/stats?key=<STATS_KEY>`. It shows today and the last 7 days (India time). Nothing about it appears in the app.
