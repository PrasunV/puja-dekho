# Contributing

## Before you push

```sh
npm run check     # lint, format check, types, tests, build
npm run e2e       # browser tests (needs a build and a Chromium)
```

CI runs the same steps. Run `npm run format` to fix formatting and `npm run lint:fix` for auto-fixable lint errors.

## Style

- **JavaScript with JSDoc types.** `tsc` checks them (`npm run typecheck`). Every exported function, hook and component gets a JSDoc comment saying what it does, what the parameters mean (units included), and what it returns or throws. Shared shapes live in `src/lib/types.js`.
- **ES modules everywhere.** Named exports for functions and hooks; a default export only for a screen or component that is the file's whole point.
- **Names say what they are.** `position`, not `pos`; `puja`, not `p`; `distance`, not `d`. A single letter is fine only for a loop index or a tiny arrow function.
- **No magic numbers.** A number that means something is a named constant. A number a product owner might tune goes in `server/rules.js` (server) or `src/config.js` (client).
- **Small files, one job.** A component over about 150 lines, or a hook doing two things, should be split.
- **Pure logic goes in `lib/`**, with a unit test. Components and hooks call it; they do not contain it.
- **Accessibility.** Buttons are `<button type="button">`, icon-only buttons have `aria-label`, popups close on Escape, external links have `rel="noopener noreferrer"`. The ESLint a11y rules are on.
- **No `console.log` in app code.** Use `console.warn` or `console.error` for real problems.
- **Never build HTML from user text.** Use React, or the `el()` helper for map popups (it only creates text nodes).

## Adding things

**A new rule (for example, a different queue window).** Change the number in `server/rules.js`, update the "Rules" section of `docs/ARCHITECTURE.md`, and adjust the test that covers it.

**A new endpoint.** Add the service function in `server/services/`, a route in `server/routes/api.js`, an entry in `docs/API.md`, and a test in `test/server/api.test.js`. Validation and abuse limits belong in the service, not in the route.

**A new screen.** Create `src/features/<name>/`, read shared state with `useApp()`, and add the view to the switch in `App.jsx`. If the screen needs state nothing else uses, keep it in the screen.

**A new piece of shared state.** Put it in a hook in `src/hooks/`, compose it in `App.jsx`, and add it to the memoised context value (and the `AppValue` typedef). Do not put fast-changing values (toasts, input text) in the app context.

**Changing the tile provider.** Change `MAP_STYLE_URL` in `src/config.js`, then the host in `connect-src` in `server/http/security.js`, then copy the CSP into `vercel.json` (`test/server/csp.test.js` fails until they match).

**Changing the data.** Edit `data-src/` or `scripts/build-data.py`, run `npm run data`, and commit the regenerated `public/data/*.json`.

## Commits and pull requests

Small, focused commits with a message that says why. A pull request should say what changed, how you tested it, and anything a reviewer should look at closely.

## Design system

Colours, radius and fonts are CSS custom properties at the top of `src/styles.css`, with a dark theme. Use the tokens; do not hard-code colours in components. Map colours are read from the same tokens at runtime (`cssVar` in `features/map/dom.js`).
