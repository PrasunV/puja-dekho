import { useEffect } from 'react';
import { api } from '../lib/api.js';

/**
 * Quietly records this visit in the running total of people who have opened the app since go-live (one count per
 * device per day, decided by the server). The total is not shown yet, but keeping it means a "N people have used
 * this" line can be added later with the full history behind it.
 */
export function useVisitCount() {
  useEffect(() => {
    const controller = new AbortController();
    api('/visits', { method: 'POST', signal: controller.signal }).catch(() => {
      /* offline or the counter is not set up: nothing to show, nothing to do */
    });
    return () => controller.abort();
  }, []);
}
