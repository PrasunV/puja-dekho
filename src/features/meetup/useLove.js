import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { storage } from '../../lib/storage.js';

/** In the preview (the same flag as the pin switcher) the heart can be tapped again and again and nothing is saved, so it can be tested. */
export const loveLab = () => typeof window !== 'undefined' && Boolean(/** @type {any} */ (window).__PD_PIN_LAB__);

/** 1, 12, 999, 1.2k, 15k */
export function formatLoves(/** @type {number} */ n) {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

/**
 * The love count for one meetup. The total comes from the shared counter; whether this phone has loved it is remembered
 * on the phone (and by a cookie on the server, so it counts once per device). A love cannot be taken back.
 * Offline or with no counter set up, the heart still works on this phone and no number is shown.
 * @param {string} id
 * @returns {{ count: number | null, loved: boolean, love: () => void }}
 */
export function useLove(id) {
  const [count, setCount] = useState(() => /** @type {number | null} */ (loveLab() ? 0 : storage.get(`loveCount:${id}`, null)));
  const [loved, setLoved] = useState(() => !loveLab() && Boolean(storage.get(`loved:${id}`, false)));
  const query = `/loves?m=${encodeURIComponent(id)}`;

  useEffect(() => {
    if (loveLab()) return undefined;
    const controller = new AbortController();
    api(query, { signal: controller.signal })
      .then((result) => {
        if (typeof result?.count !== 'number') return;
        setCount(result.count);
        storage.set(`loveCount:${id}`, result.count);
        if (result.loved) {
          setLoved(true);
          storage.set(`loved:${id}`, true);
        }
      })
      .catch(() => {
        /* offline or no counter: keep what we have */
      });
    return () => controller.abort();
  }, [id, query]);

  const love = useCallback(() => {
    if (loveLab()) {
      setLoved(true); // preview: nothing is saved; the number just counts your taps so the look can be checked
      setCount((n) => (n ?? 0) + 1);
      return;
    }
    if (loved) return;
    setLoved(true);
    storage.set(`loved:${id}`, true);
    setCount((n) => (n == null ? n : n + 1)); // show it at once; the server's total replaces it below
    api(query, { method: 'POST' })
      .then((result) => {
        if (typeof result?.count !== 'number') return;
        setCount(result.count);
        storage.set(`loveCount:${id}`, result.count);
      })
      .catch(() => {
        /* the heart stays filled on this phone */
      });
  }, [id, loved, query]);

  return { count, loved, love };
}
