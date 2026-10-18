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
