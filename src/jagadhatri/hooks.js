import { useCallback, useEffect, useRef, useState } from 'react';
import { DATA_URL } from './config.js';

/**
 * The puja data, loaded once. The offline worker caches it, so it also loads with no network after one visit.
 * @returns {{ data: { pujas: import('./lib.js').JgPuja[], stations: import('./lib.js').JgStation[] } | null, error: boolean, retry: () => void }}
 */
export function useJgData() {
  const [state, setState] = useState(/** @type {{ data: any, error: boolean }} */ ({ data: null, error: false }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(DATA_URL, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => setState({ data, error: false }))
      .catch((e) => {
        if (e?.name !== 'AbortError') setState({ data: null, error: true });
      });
    return () => controller.abort();
  }, [attempt]);
  const retry = useCallback(() => {
    setState({ data: null, error: false });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, retry };
}

/** Social apps whose in-app browsers often block location (and, from v0.2, Google sign-in). */
export const IN_APP_BROWSER =
  typeof navigator !== 'undefined' && /Instagram|FBAN|FBAV|FB_IAB|Snapchat|Line\/|LinkedInApp/i.test(navigator.userAgent);

/**
 * The phone's location, watched only while something asks for it (Near me or the location button). It never leaves
 * the phone.
 *
 * status: off · finding · on · denied (blocked by the person or the browser) · unavailable (no GPS, or it failed)
 * permission: granted · prompt · denied · unknown (browsers without the Permissions API)
 */
export function useGeo() {
  const [status, setStatus] = useState(/** @type {'off' | 'finding' | 'on' | 'denied' | 'unavailable'} */ ('off'));
  const [position, setPosition] = useState(/** @type {{ lat: number, lng: number, accuracy: number, at: number } | null} */ (null));
  const [permission, setPermission] = useState(/** @type {'granted' | 'prompt' | 'denied' | 'unknown'} */ ('unknown'));
  const watch = useRef(/** @type {number | null} */ (null));
  const hasFix = useRef(false);

  useEffect(() => {
    let alive = true;
    /** @type {PermissionStatus | null} */
    let perm = null;
    const onChange = () => perm && alive && setPermission(/** @type {any} */ (perm.state));
    navigator.permissions
      ?.query({ name: /** @type {PermissionName} */ ('geolocation') })
      .then((p) => {
        perm = p;
        onChange();
        p.addEventListener('change', onChange);
      })
      .catch(() => {});
    return () => {
      alive = false;
      perm?.removeEventListener('change', onChange);
    };
  }, []);

  const stop = useCallback(() => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    hasFix.current = false;
    setStatus('off');
    setPosition(null);
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    if (watch.current != null) return;
    setStatus(hasFix.current ? 'on' : 'finding');
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        hasFix.current = true;
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp });
        setStatus('on');
        setPermission('granted');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
          watch.current = null;
          setStatus('denied');
          setPermission('denied');
        } else if (!hasFix.current) {
          setStatus('unavailable');
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
  }, []);

  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    },
    [],
  );

  return { status, position, permission, start, stop };
}

// ---- Android back button: closes the top sheet instead of leaving the app ----
/** @type {{ close: () => void }[]} */
const layers = [];
/** How many of our history entries are in the browser's history right now. */
let pushed = 0;
/** Back steps we started ourselves, whose popstate must be ignored. */
let skipPop = 0;
let backTimer = 0;

/**
 * Brings the history in line with the open layers, once per tick. A sheet that closes as another opens (sign-in, then
 * the location question) nets out to no change, so a late history.back() can never land behind the page.
 */
function reconcile() {
  backTimer = 0;
  if (skipPop > 0) return; // a back step is still on its way; popstate runs this again
  const want = layers.length;
  while (pushed < want) {
    pushed += 1;
    history.pushState({ jg: pushed }, '');
  }
  if (pushed > want) {
    const n = pushed - want;
    pushed = want;
    skipPop += 1;
    history.go(-n);
  }
}
const schedule = () => {
  if (!backTimer) backTimer = window.setTimeout(reconcile, 0);
};

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (skipPop > 0) {
      skipPop -= 1;
      schedule();
      return;
    }
    // The person pressed back: close the top layer.
    if (pushed > 0) pushed -= 1;
    layers.pop()?.close();
    schedule();
  });
}

/**
 * While `open`, the phone's back button calls `onClose` (one history entry per open layer).
 * @param {boolean} open
 * @param {() => void} onClose
 */
export function useBackClose(open, onClose) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return undefined;
    const entry = { close: () => closeRef.current() };
    layers.push(entry);
    schedule();
    return () => {
      const i = layers.indexOf(entry);
      if (i >= 0) {
        // Closed from the screen, not the back button.
        layers.splice(i, 1);
        schedule();
      }
    };
  }, [open]);
}

/** Polite screen-reader and on-screen toast: past tense, 1 to 5 words (design 7.18). */
export function useToast() {
  const [toast, setToast] = useState(
    /** @type {{ text: string, id: number, action?: { label: string, run: () => void } } | null} */ (null),
  );
  const timer = useRef(0);
  /** An action (Undo) keeps the toast at least 5 seconds (design 7.18). */
  /** @type {(text: string, ms?: number, action?: { label: string, run: () => void }) => void} */
  const show = useCallback((text, ms = 3200, action = undefined) => {
    clearTimeout(timer.current);
    setToast({ text, id: Date.now(), action });
    timer.current = window.setTimeout(() => setToast(null), action ? Math.max(ms, 5000) : ms);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, show, hide };
}
