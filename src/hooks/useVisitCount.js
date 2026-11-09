import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { storage } from '../lib/storage.js';

/**
 * The number of people who have viewed the app since the counter went live. Every open asks the server to count
 * this device (it counts once per device per day) and gets the shared total back. The last total is kept on
 * the phone, so the pill shows something at once and while offline. With no number at all, nothing is shown.
 * @param {{ path?: string, key?: string }} [options]  Jagadhatri passes its own endpoint and phone storage key.
 * @returns {number | null}
 */
export function useVisitCount({ path = '/visits', key = 'visitCount' } = {}) {
  const [count, setCount] = useState(() => /** @type {number | null} */ (storage.get(key, null)));
  useEffect(() => {
    const controller = new AbortController();
    // A link shared with a tag (`?s=wa`) is also counted, out of sight, as a visit from a shared link.
    const tag = new URLSearchParams(location.search).get('s');
    api(`${path}${tag ? `?s=${encodeURIComponent(tag.slice(0, 20))}` : ''}`, { method: 'POST', signal: controller.signal })
      .then((result) => {
        if (typeof result?.count !== 'number') return;
        setCount(result.count);
        storage.set(key, result.count);
      })
      .catch(() => {
        /* offline or the counter is not set up: keep what we have */
      });
    return () => controller.abort();
  }, [path, key]);
  return count;
}
