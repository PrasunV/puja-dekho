import { useCallback, useEffect, useRef, useState } from 'react';
import { NEAR_RADIUS_M } from '../config.js';
import { haversine } from '../lib/geo.js';
import { NO_NEAR, dismissNear, nextNear, skipNear } from '../lib/near.js';

const TICK_MS = 5000;

/**
 * Offers "You're near [puja]" while the app is open. The rule lives in lib/near.js; this hook
 * feeds it every GPS fix and also re-checks every few seconds, because a person standing still
 * may get no new fix but the 60 seconds still need to run out.
 *
 * @param {import('../lib/types.js').Puja[] | undefined} pujas
 * @param {import('../lib/types.js').Position | null} position
 * @returns {{ puja: import('../lib/types.js').Puja | null, canSkip: boolean, dismiss: () => void, notThisOne: () => void }}
 */
export function useNearPuja(pujas, position) {
  const [state, setState] = useState(/** @type {import('../lib/near.js').NearState} */ (NO_NEAR));
  const latest = useRef(position);
  useEffect(() => {
    latest.current = position;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- every GPS fix feeds the dwell rule
    if (pujas && position) setState((s) => nextNear(s, position, pujas, Date.now()));
  }, [pujas, position]);
  useEffect(() => {
    if (!pujas) return undefined;
    const timer = setInterval(() => {
      if (document.hidden || !latest.current) return;
      setState((s) => nextNear(s, /** @type {import('../lib/types.js').Position} */ (latest.current), pujas, Date.now()));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [pujas]);

  const puja = (state.active && pujas?.find((p) => p.id === state.active)) || null;
  const notThisOne = useCallback(() => {
    setState((s) => (pujas && latest.current ? nextNear(skipNear(s), latest.current, pujas, Date.now()) : skipNear(s)));
  }, [pujas]);
  const dismiss = useCallback(() => setState(dismissNear), []);
  // "Not this one?" only makes sense when another puja is also within range.
  const canSkip =
    puja != null &&
    position != null &&
    (pujas ?? []).some(
      (p) =>
        p.id !== puja.id &&
        !state.dismissed.includes(p.id) &&
        !state.skipped.includes(p.id) &&
        haversine(position.lat, position.lng, p.la, p.lo) <= NEAR_RADIUS_M,
    );
  return { puja, canSkip, dismiss, notThisOne };
}
