# Parked for v2

Code from the first version that is not part of the current app. Nothing here is built, linted, type-checked or tested; it is kept so the work is not lost.

- `server/app.js`, `server/api.test.js`: Google sign-in, check-ins with a distance check, photos, points, badges and a leaderboard, with their tests. They target the old single-file server and will need porting to the `services/` structure.
- `client/`: the matching screens (`Checkin.jsx`, `Me.jsx`, `SignIn.jsx`), written against the old component layout.

Photos need file storage (for example Vercel Blob) because Vercel functions have no persistent disk.
