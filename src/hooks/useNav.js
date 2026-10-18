import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * What the bottom sheet is showing, apart from the plain list.
 * @typedef {object} Nav
 * @property {string | null} pujaId   A puja's details are open
 * @property {string | null} stationId  Results for a metro station are open
 * @property {boolean} metro   The "Metro nearby" list is open
 * @property {string[]} lines   Metro lines switched on (`blue`, `green`)
 */

export const HOME = Object.freeze({ pujaId: null, stationId: null, metro: false, lines: /** @type {string[]} */ ([]) });

/**
 * Sheet state with browser history: every change of what the sheet shows is a history entry, so the
 * phone's Back button steps back through states instead of leaving the app (PRD section 8).
 * @returns {[Nav, (patch: Partial<Nav>, options?: { replace?: boolean }) => void, () => void]}
 */
export function useNav() {
  const [nav, setNav] = useState(/** @type {Nav} */ (HOME));
  const navRef = useRef(nav);
  useEffect(() => {
    navRef.current = nav;
  }, [nav]);

  useEffect(() => {
    history.replaceState({ pd: HOME }, '');
    const onPop = (/** @type {PopStateEvent} */ event) => setNav(event.state?.pd ?? HOME);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((patch, { replace = false } = {}) => {
    const next = { ...navRef.current, ...patch };
    navRef.current = next;
    setNav(next);
    if (replace) history.replaceState({ pd: next }, '');
    else history.pushState({ pd: next }, '');
  }, []);

  /** In-app back control: the same as the browser Back button. */
  const back = useCallback(() => {
    if (
      history.state?.pd &&
      history.length > 1 &&
      (navRef.current.pujaId || navRef.current.stationId || navRef.current.metro || navRef.current.lines.length)
    ) {
      history.back();
    } else go(HOME, { replace: true });
  }, [go]);

  return [nav, go, back];
}
