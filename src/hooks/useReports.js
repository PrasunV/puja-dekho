import { useCallback } from 'react';
import { ApiError, api } from '../lib/api.js';
import { getPosition } from '../lib/geo.js';
import { useToast } from '../context/ToastContext.jsx';

const OFFLINE_MESSAGE = 'This is the offline preview. Start the server to use this.';

/**
 * Everything the person can send to the server: queue reports, ratings, road reports, votes.
 * Each action shows its own toast and refreshes live data.
 *
 * @param {object} input
 * @param {React.MutableRefObject<'server' | 'local'>} input.modeRef
 * @param {string} input.nickname
 * @param {() => Promise<boolean>} input.refresh
 * @param {React.Dispatch<React.SetStateAction<import('../lib/types.js').Mine>>} input.setMine
 * @param {React.Dispatch<React.SetStateAction<import('../lib/types.js').LiveState>>} input.setLive
 * @param {React.Dispatch<React.SetStateAction<Record<string, number>>>} input.setLocalRatings
 */
export function useReports({ modeRef, nickname, refresh, setMine, setLive, setLocalRatings }) {
  const toast = useToast();
  const nick = nickname.trim();

  /** True (and a toast) when the server is unreachable, so the caller should stop. */
  const offline = useCallback(() => {
    if (modeRef.current === 'server') return false;
    toast(OFFLINE_MESSAGE, 'err');
    return true;
  }, [modeRef, toast]);

  const attempt = useCallback(
    async (work) => {
      try {
        await work();
      } catch (error) {
        toast(error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong. Try again.', 'err');
      }
    },
    [toast],
  );

  const sendQueue = useCallback(
    async (puja, level, waitMinutes) => {
      if (offline()) return;
      const position = await getPosition({ timeout: 4000 }).catch(() => null);
      await attempt(async () => {
        const body = { pujaId: puja.id, level };
        if (nick) body.nickname = nick;
        if (waitMinutes !== '' && waitMinutes != null) body.waitMin = Number(waitMinutes);
        if (position) Object.assign(body, { lat: position.lat, lng: position.lng });
        const result = await api('/report/queue', { method: 'POST', body });
        toast(result.near ? 'Queue report sent. Thank you!' : 'Report sent. Reports from far away count less.', 'ok');
        await refresh();
      });
    },
    [offline, attempt, nick, refresh, toast],
  );

  const sendRating = useCallback(
    async (puja, stars) => {
      if (modeRef.current !== 'server') {
        setLocalRatings((ratings) => ({ ...ratings, [puja.id]: stars }));
        toast('Saved on this device only', 'ok');
        return;
      }
      await attempt(async () => {
        const result = await api('/rate', { method: 'POST', body: { pujaId: puja.id, stars, ...(nick ? { nickname: nick } : {}) } });
        setMine((mine) => ({ ...mine, ratings: { ...result.mine.ratings, [puja.id]: stars } }));
        setLive((live) => ({ ...live, pujas: { ...live.pujas, [puja.id]: { ...live.pujas[puja.id], r: result.r } } }));
        toast(result.updated ? 'Rating updated' : 'Thanks for rating', 'ok');
      });
    },
    [modeRef, attempt, nick, setMine, setLive, setLocalRatings, toast],
  );

  const voteOnClosure = useCallback(
    async (closure, vote) => {
      if (offline()) return;
      await attempt(async () => {
        await api(`/closure/${closure.id}/vote`, { method: 'POST', body: { vote } });
        toast('Thanks, noted', 'ok');
        await refresh();
      });
    },
    [offline, attempt, refresh, toast],
  );

  /**
   * @param {string} type  Closure kind
   * @param {string} note
   * @param {{ lat: number, lng: number }} spot
   * @returns {Promise<boolean>} true when the report was accepted
   */
  const sendRoad = useCallback(
    async (type, note, spot) => {
      if (offline()) return false;
      let accepted = false;
      await attempt(async () => {
        const result = await api('/report/closure', { method: 'POST', body: { type, note, lat: spot.lat, lng: spot.lng } });
        toast(result.merged ? 'Matched an existing report, thanks' : 'Road reported', 'ok');
        accepted = true;
        await refresh();
      });
      return accepted;
    },
    [offline, attempt, refresh, toast],
  );

  return { sendQueue, sendRating, voteOnClosure, sendRoad };
}
