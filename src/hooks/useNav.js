import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * What the bottom sheet is showing, apart from the plain list.
 * @typedef {object} Nav
 * @property {string | null} pujaId   A puja's details are open
 * @property {string | null} stationId  Results for a metro station are open
 * @property {boolean} metro   The "Metro nearby" list is open
 * @property {string[]} lines   Metro lines switched on (`blue`, `green`)
 * @property {boolean} ghat   The Bhasan ghat's details are open
 * @property {boolean} meetup   The meetup highlights are open
 */

export const HOME = Object.freeze({ pujaId: null, stationId: null, metro: false, lines: /** @type {string[]} */ ([]), ghat: false, meetup: false });

/** The address of a puja's page: `/?puja=S001`. This is what Share copies and what a shared link opens. */
export const pujaUrl = (/** @type {string} */ id) => `${location.pathname}?puja=${encodeURIComponent(id)}`;

/** A shared link opens that puja's details directly; anything else starts at the list. */
function fromUrl() {
  try {
    const query = new URLSearchParams(location.search);
    const id = query.get('puja');
    if (id) return { ...HOME, pujaId: id };
    // A shared meetup link (/?meetup=1) opens the highlights.
    return query.get('meetup') === '1' ? { ...HOME, meetup: true } : HOME;
  } catch {
    return HOME;
  }
}

/** The address bar follows what the sheet shows: a puja has its own link, everything else is the bare page. */
const addressFor = (/** @type {Nav} */ nav) => {
  // Other query words (a test or preview switch) stay; only `puja` follows the sheet.
  const query = new URLSearchParams(location.search);
  if (nav.pujaId) query.set('puja', nav.pujaId);
  else query.delete('puja');
  if (nav.meetup) query.set('meetup', '1');
  else query.delete('meetup');
  const text = query.toString();
  return `${location.pathname}${text ? `?${text}` : ''}${location.hash}`;
};

/**
 * Sheet state with browser history: every change of what the sheet shows is a history entry, so the
 * phone's Back button steps back through states instead of leaving the app (PRD section 8).
 * @returns {[Nav, (patch: Partial<Nav>, options?: { replace?: boolean }) => void, () => void]}
 */
export function useNav() {
  const [nav, setNav] = useState(/** @type {Nav} */ (fromUrl));
  const navRef = useRef(nav);
  useEffect(() => {
    navRef.current = nav;
  }, [nav]);

  useEffect(() => {
    history.replaceState({ pd: navRef.current }, '', addressFor(navRef.current));
    const onPop = (/** @type {PopStateEvent} */ event) => setNav(event.state?.pd ?? fromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((patch, { replace = false } = {}) => {
    const next = { ...navRef.current, ...patch };
    navRef.current = next;
    setNav(next);
    if (replace) history.replaceState({ pd: next }, '', addressFor(next));
    else history.pushState({ pd: next }, '', addressFor(next));
  }, []);

  /** In-app back control: the same as the browser Back button. */
  const back = useCallback(() => {
    if (
      history.state?.pd &&
      history.length > 1 &&
      (navRef.current.pujaId || navRef.current.stationId || navRef.current.metro || navRef.current.lines.length || navRef.current.ghat || navRef.current.meetup)
    ) {
      history.back();
    } else go(HOME, { replace: true });
  }, [go]);

  return [nav, go, back];
}
