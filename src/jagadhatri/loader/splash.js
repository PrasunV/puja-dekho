/**
 * Hands the first-paint splash (jagadhatripuja/index.html + public/jagadhatripuja/splash.js) over to React. Call it once
 * the first screen's data has arrived or failed. The splash enforces its own minimum time, so call it as early as you like.
 * If the splash script never loaded (blocked, offline), the splash is removed here so it can never trap the app.
 */
export function hideSplash() {
  if (typeof window === 'undefined') return;
  const w = /** @type {any} */ (window);
  if (w.pdSplash) {
    w.pdSplash.hide();
    return;
  }
  document.getElementById('pd-splash')?.remove();
  document.getElementById('root')?.removeAttribute('inert');
  window.dispatchEvent(new Event('pd-splash-gone'));
}
