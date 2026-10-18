import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { storage } from '../lib/storage.js';

/**
 * The number of people who have viewed the app since the counter went live. Every open asks the server to count
 * this device (it counts once per device per day) and gets the shared total back. The last total is kept on
 * the phone, so the pill shows something at once and while offline. With no number at all, the pill stays hidden.
 * @returns {number | null}
 */
export function useVisitCount() {
  const [count, setCount] = useState(() => /** @type {number | null} */ (storage.get('visitCount', null)));
  useEffect(() => {
    const controller = new AbortController();
    api('/visits', { method: 'POST', signal: controller.signal })
      .then((result) => {
        if (typeof result?.count !== 'number') return;
        setCount(result.count);
        storage.set('visitCount', result.count);
      })
      .catch(() => {
        /* offline or the counter is not set up: keep what we have */
      });
    return () => controller.abort();
  }, []);
  return count;
}
