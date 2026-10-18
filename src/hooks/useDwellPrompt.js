import { useCallback, useRef, useState } from 'react';
import { storage } from '../lib/storage.js';
import { NO_DWELL, nextDwell } from '../lib/dwell.js';

/**
 * Tracks how long the person stays near a puja and, when it is time, offers a one-tap queue report.
 *
 * @param {import('../lib/types.js').Puja[] | undefined} pujas
 * @param {boolean} enabled Only prompt when reports can actually be sent
 */
export function useDwellPrompt(pujas, enabled) {
  const [prompt, setPrompt] = useState(/** @type {import('../lib/types.js').Puja | null} */ (null));
  const state = useRef(/** @type {import('../lib/dwell.js').DwellState} */ (NO_DWELL));

  /**
   * Feed a position update.
   * @param {import('../lib/types.js').Position} position
   * @param {number} [now]
   */
  const track = useCallback(
    (position, now = Date.now()) => {
      if (!pujas) return;
      const askedAt = storage.get('asked', {});
      const result = nextDwell(state.current, position, pujas, now, askedAt);
      state.current = result.state;
      if (result.ask && enabled) {
        askedAt[result.ask.id] = now;
        storage.set('asked', askedAt);
        setPrompt((current) => current || result.ask);
      }
    },
    [pujas, enabled],
  );

  return { prompt, dismiss: () => setPrompt(null), track };
}
