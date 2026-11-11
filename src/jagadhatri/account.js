import { useCallback, useEffect, useRef, useState } from 'react';
import { storage } from '../lib/storage.js';

/**
 * The signed-in account: Google sign-in, wish list and visited pujas, with the server at /api/jagadhatri/account.
 * The last copy is kept on the phone, so the profile shows at once and while offline. With no network, wish list and
 * visited changes are queued on the phone and sent when the network returns (design 7.14, 8).
 */
export const GOOGLE_CLIENT_ID = '359272102824-mpgianidjmi0163704u4v0th42oe4bb5.apps.googleusercontent.com';
const URL = '/api/jagadhatri/account';
const SNAP_KEY = 'jg_account';
const QUEUE_KEY = 'jg_queue';

/** @typedef {{ name: string, picture: string | null }} JgUser */
/** @typedef {{ user: JgUser | null, visited: import('./ranks.js').Visit[], wish: { puja: string, at: number }[] }} Snapshot */
/** @typedef {{ action: 'wish' | 'visited' | 'here', puja: string, on: boolean }} Change  'here' = completed in person */

const EMPTY = /** @type {Snapshot} */ ({ user: null, visited: [], wish: [] });

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

async function post(body) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, json.error || 'failed');
  return /** @type {Snapshot} */ (json);
}

/** The same change applied on the phone, so the screen updates before the server answers. */
function applyLocal(/** @type {Snapshot} */ s, /** @type {Change} */ c, now = Date.now()) {
  if (c.action === 'wish') {
    const wish = s.wish.filter((w) => w.puja !== c.puja);
    return { ...s, wish: c.on ? [{ puja: c.puja, at: now }, ...wish] : wish };
  }
  const had = s.visited.find((v) => v.puja === c.puja);
  if (c.action === 'here') {
    const day = new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
    const rest = s.visited.filter((v) => v.puja !== c.puja);
    return had?.mode === 'person' ? s : { ...s, visited: [{ puja: c.puja, mode: 'person', at: now, day }, ...rest] };
  }
  if (c.on) {
    if (had) return s;
    const day = new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
    return { ...s, visited: [{ puja: c.puja, mode: 'manual', at: now, day }, ...s.visited] };
  }
  return { ...s, visited: s.visited.filter((v) => !(v.puja === c.puja && v.mode === 'manual')) };
}

export function useAccount() {
  const [snap, setSnap] = useState(() => /** @type {Snapshot} */ (storage.get(SNAP_KEY, EMPTY)));
  const [pending, setPending] = useState(() => /** @type {Change[]} */ (storage.get(QUEUE_KEY, [])).length);
  const flushing = useRef(false);
  const latest = useRef(snap);

  const keep = useCallback((/** @type {Snapshot} */ s) => {
    latest.current = s;
    setSnap(s);
    storage.set(SNAP_KEY, s);
  }, []);
  const setQueue = (/** @type {Change[]} */ q) => {
    storage.set(QUEUE_KEY, q);
    setPending(q.length);
  };

  /** Sends what was saved offline, oldest first. Stops at the first network failure; drops changes the server refuses. */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let q = /** @type {Change[]} */ (storage.get(QUEUE_KEY, []));
      while (q.length) {
        try {
          keep(await post(q[0]));
        } catch (e) {
          if (!(e instanceof HttpError)) break; // still offline
          if (e.status === 401) {
            keep(EMPTY);
            break;
          }
        }
        q = q.slice(1);
        setQueue(q);
      }
    } finally {
      flushing.current = false;
    }
  }, [keep]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(URL, { credentials: 'same-origin', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return;
        // Queued offline changes are re-applied over the fresh copy until they are sent.
        const q = /** @type {Change[]} */ (storage.get(QUEUE_KEY, []));
        keep(s.user ? q.reduce((acc, c) => applyLocal(acc, c), s) : s);
        if (s.user && q.length) flush();
      })
      .catch(() => {});
    window.addEventListener('online', flush);
    return () => {
      controller.abort();
      window.removeEventListener('online', flush);
    };
  }, [keep, flush]);

  /** Google's ID token from the Sign in with Google button. Throws with a code the sheet turns into a message. */
  const signIn = useCallback(
    async (/** @type {string} */ credential) => {
      const s = await post({ action: 'signin', credential });
      keep(s);
      flush();
      return s;
    },
    [keep, flush],
  );

  const signOut = useCallback(async () => {
    try {
      await post({ action: 'signout' });
    } catch {
      /* the cookie expires on its own; the phone forgets now */
    }
    setQueue([]);
    keep(EMPTY);
  }, [keep]);

  /** @returns {Promise<'sent' | 'queued'>} */
  const change = useCallback(
    async (/** @type {Change} */ c) => {
      // Read the latest copy (not the one from an older render), so an Undo pressed later never rolls back other changes.
      const was = latest.current.visited.find((v) => v.puja === c.puja);
      keep(applyLocal(latest.current, c));
      try {
        keep(await post(c));
        return 'sent';
      } catch (e) {
        if (e instanceof HttpError) {
          if (e.status === 401) keep(EMPTY);
          else if (c.action === 'here') {
            const rest = latest.current.visited.filter((v) => v.puja !== c.puja);
            keep({ ...latest.current, visited: was ? [was, ...rest] : rest });
          } else keep(applyLocal(latest.current, { ...c, on: !c.on }));
          throw e;
        }
        setQueue([.../** @type {Change[]} */ (storage.get(QUEUE_KEY, [])), c]);
        return 'queued';
      }
    },
    [keep],
  );

  /** A crowd report, from someone at the puja. Not queued: an old report would mislead. */
  const report = useCallback(
    async (/** @type {string} */ puja, /** @type {'free' | 'crowded'} */ level) => {
      keep(await post({ action: 'crowd', puja, level }));
    },
    [keep],
  );

  return { ...snap, signedIn: !!snap.user, pending, signIn, signOut, change, report };
}

// ---- Sign in with Google (Google Identity Services) ----
/** @type {Promise<any> | null} */
let gisPromise = null;
/** @type {(credential: string) => void} */
let onCredential = () => {};

/** Loads Google's sign-in script once, only when a sign-in sheet opens. */
export function loadGoogle() {
  gisPromise ??= new Promise((resolve, reject) => {
    const w = /** @type {any} */ (window);
    if (w.google?.accounts?.id) return resolve(w.google);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      w.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (/** @type {{ credential: string }} */ r) => onCredential(r.credential),
        ux_mode: 'popup',
        auto_select: false,
        itp_support: true,
        use_fedcm_for_button: true,
      });
      resolve(w.google);
    };
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('google_unavailable'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * Draws Google's own "Continue with Google" button into `el` (Google's branding rules require their button).
 * @param {HTMLElement} el
 * @param {(credential: string) => void} handler
 */
export async function renderGoogleButton(el, handler) {
  const google = await loadGoogle();
  onCredential = handler;
  el.replaceChildren();
  google.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'center',
    width: Math.max(200, Math.min(400, Math.floor(el.clientWidth || 320))),
  });
}

/**
 * Live crowd status for every puja (last 60 minutes, 2+ reports), refreshed every 2 minutes while the app is on
 * screen. Kept in memory only: an hour-old status shown offline would mislead.
 * @returns {{ crowd: Record<string, { level: 'free' | 'crowded', n: number, at: number }>, at: number, refresh: () => void }}
 */
export function useCrowd() {
  const [state, setState] = useState({ crowd: {}, at: 0 });
  const load = useCallback(() => {
    fetch(`${URL}?crowd=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setState({ crowd: j.crowd || {}, at: Number(j.at) || 0 }))
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const id = window.setInterval(() => document.visibilityState === 'visible' && load(), 120_000);
    const onShow = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('online', load);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('online', load);
    };
  }, [load]);
  return { ...state, refresh: load };
}
