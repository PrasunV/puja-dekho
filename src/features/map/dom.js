/**
 * Tiny DOM helpers for MapLibre markers and popups, which need real elements (not React nodes).
 * Text is always added with text nodes, never as HTML, so user-supplied notes cannot inject markup.
 */

/**
 * @param {string} tag
 * @param {Record<string, string | ((event: Event) => void)>} [attrs]  `class`, `onclick`-style handlers, or attributes
 * @param {...(string | Node)} children
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'class') node.className = /** @type {string} */ (value);
    else if (name.startsWith('on')) node.addEventListener(name.slice(2), /** @type {EventListener} */ (value));
    else node.setAttribute(name, /** @type {string} */ (value));
  }
  for (const child of children) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}

/** Wrap an element so MapLibre can move the wrapper while we style the inner element freely. */
export function holder(inner) {
  const wrapper = document.createElement('div');
  wrapper.append(inner);
  return wrapper;
}

/** `[lat, lng]` to MapLibre's `[lng, lat]`. */
export const toLngLat = (point) => /** @type {[number, number]} */ ([point[1], point[0]]);

/** Read a CSS custom property from :root so map colours follow the design tokens. */
export const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
