import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { storage } from '../lib/storage.js';

/** How often an open, visible app tells the server it is still here. The server counts anyone seen in the last 90 s. */
const BEAT_MS = 30_000;
/** If the server has not answered for this long, the number is stale, so the pill hides rather than guess. */
const STALE_MS = 2 * 60_000;

/** A random id for this device. It is not tied to a person and is only used to avoid counting the same phone twice. */
function deviceId() {
  const saved = storage.get('liveId', '');
  if (typeof saved === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const fresh = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  storage.set('liveId', fresh);
  return fresh;
}

/**
 * How many people have the app open right now, this device included. While the app is visible it checks in every
 * 30 seconds, and straight away when you come back to it. A hidden tab stops checking in and drops off the count
 * after about 90 seconds. With no fresh number the pill stays hidden.
 * @returns {number | null}
 */
export function useLiveCount() {
  const [count, setCount] = useState(/** @type {number | null} */ (null));
  useEffect(() => {
    const id = deviceId();
    let controller = new AbortController();
    let lastOk = 0;
    const beat = () => {
      controller.abort();
      controller = new AbortController();
      api(`/live?id=${id}`, { method: 'POST', signal: controller.signal })
        .then((result) => {
          if (typeof result?.count !== 'number') return;
          lastOk = Date.now();
          setCount(Math.max(1, result.count)); // this device is here, so never below one
        })
        .catch(() => {
          if (Date.now() - lastOk > STALE_MS) setCount(null);
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    beat();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') beat();
    }, BEAT_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return count;
}
