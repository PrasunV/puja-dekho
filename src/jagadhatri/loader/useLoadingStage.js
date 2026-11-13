import { useEffect, useState } from 'react';
import { FAIL_AFTER_MS, SLOW_AFTER_MS } from './config.js';

/**
 * How long a wait has run: idle (not loading) · hidden (inside the delay) · wait · slow · fail.
 * @param {boolean} isLoading
 * @param {number} delayMs Wait this long before showing anything.
 * @param {number} [resetKey] Change it to start the clock again (Try again).
 * @returns {import('./lines.js').LoaderStage}
 */
export function useLoadingStage(isLoading, delayMs, resetKey = 0) {
  // The stage belongs to one wait; a new wait (loading again, or Try again) starts from its first stage.
  const key = `${delayMs}|${resetKey}`;
  const [reached, setReached] = useState(/** @type {{ key: string, stage: import('./lines.js').LoaderStage } | null} */ (null));
  useEffect(() => {
    if (!isLoading) return undefined;
    /** @param {import('./lines.js').LoaderStage} stage */
    const at = (stage) => () => setReached({ key, stage });
    // Slow and fail count from when the wait began, not from when the eye appeared.
    const timers = [
      window.setTimeout(at('slow'), Math.max(SLOW_AFTER_MS, delayMs)),
      window.setTimeout(at('fail'), Math.max(FAIL_AFTER_MS, delayMs)),
    ];
    if (delayMs > 0) timers.push(window.setTimeout(at('wait'), delayMs));
    return () => {
      timers.forEach(clearTimeout);
      setReached(null);
    };
  }, [isLoading, delayMs, key]);
  if (!isLoading) return 'idle';
  if (reached && reached.key === key) return reached.stage;
  return delayMs > 0 ? 'hidden' : 'wait';
}
