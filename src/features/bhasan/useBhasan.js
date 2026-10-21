import { useEffect, useState } from 'react';
import { BHASAN, bhasanActive, ghatStatus } from '../../data/bhasan.js';

/** Whether the Bhasan specials are showing, and the ghat's status. It re-checks every minute, so the sections vanish on time. */
export function useBhasan() {
  const [now, setNow] = useState(() => Date.now());
  const active = bhasanActive(now);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [active]);
  return { active, config: BHASAN, status: ghatStatus(now) };
}
