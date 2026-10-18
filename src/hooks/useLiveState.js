import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_SECONDS } from '../config.js';
import { api } from '../lib/api.js';
import { DEFAULT_QUEUE_LEVELS } from '../lib/pujas.js';
import { useToast } from '../context/ToastContext.jsx';

const EMPTY_LIVE = { pujas: {}, closures: [] };
const EMPTY_MINE = { ratings: {}, votes: {} };

/**
 * Live server data: queues, ratings, road reports and what this device has done.
 * Falls back to an offline preview (`mode: 'local'`) when the API is unreachable.
 *
 * @param {boolean} enabled Start once the static data has loaded
 */
export function useLiveState(enabled) {
  const toast = useToast();
  const [mode, setMode] = useState(/** @type {'server' | 'local'} */ ('server'));
  const [live, setLive] = useState(/** @type {import('../lib/types.js').LiveState} */ (EMPTY_LIVE));
  const [mine, setMine] = useState(/** @type {import('../lib/types.js').Mine} */ (EMPTY_MINE));
  const [levels, setLevels] = useState(/** @type {readonly import('../lib/types.js').QueueLevel[]} */ (DEFAULT_QUEUE_LEVELS));
  const modeRef = useRef(mode);

  const refresh = useCallback(async () => {
    try {
      const state = await api('/state');
      setLive({ pujas: state.pujas, closures: state.closures });
      setMine({ ratings: state.mine.ratings, votes: state.mine.votes });
      return true;
    } catch {
      return false;
    }
  }, []);

  const changeMode = useCallback((next) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      try {
        const health = await api('/health');
        if (health.levels) setLevels(health.levels);
        changeMode('server');
        await refresh();
      } catch {
        changeMode('local');
        toast('Offline preview: ratings stay on this device. Queue and road reports need the server.');
      }
    })();
  }, [enabled, refresh, changeMode, toast]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden && modeRef.current === 'server') refresh();
    };
    const timer = setInterval(tick, POLL_SECONDS * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  return { mode, modeRef, live, setLive, mine, setMine, levels, refresh };
}
