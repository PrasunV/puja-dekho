import { useCallback, useEffect, useRef, useState } from 'react';
import { DATA_URL } from './config.js';
import { compassFromEvent, pickHeading, smoothAngle, turn } from './heading.js';

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

/** A browser position as the app keeps it: heading and speed are null when the phone has no direction of travel. */
const fix = (/** @type {GeolocationPosition} */ p) => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy,
  at: p.timestamp,
  heading: p.coords.heading != null && Number.isFinite(p.coords.heading) ? p.coords.heading : null,
  speed: p.coords.speed != null && Number.isFinite(p.coords.speed) ? p.coords.speed : null,
});

/**
 * The phone's location, watched only while something asks for it (Near me or the location button). It never leaves
 * the phone.
 *
 * status: off · finding · on · denied (blocked by the person or the browser) · unavailable (no GPS, or it failed)
 * permission: granted · prompt · denied · unknown (browsers without the Permissions API)
 */
export function useGeo() {
  const [status, setStatus] = useState(/** @type {'off' | 'finding' | 'on' | 'denied' | 'unavailable'} */ ('off'));
  const [position, setPosition] = useState(
    /** @type {{ lat: number, lng: number, accuracy: number, at: number, heading: number | null, speed: number | null } | null} */ (null),
  );
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
        setPosition(fix(p));
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

  /** One fresh fix right now: the browser pauses the watch while another app is in front, so ask again on return. */
  const refresh = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        hasFix.current = true;
        setPosition(fix(p));
        setStatus('on');
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }, []);

  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    },
    [],
  );

  return { status, position, permission, start, stop, refresh };
}

/**
 * The phone compass, listened to only while `active`. Android needs no permission. iPhone asks once, and only from a
 * tap, so `request()` belongs in a button handler; until then (or if refused) there is simply no compass heading.
 */
export function useCompass(/** @type {boolean} */ active) {
  const [reading, setReading] = useState(/** @type {{ heading: number, at: number } | null} */ (null));
  /** @type {() => 'prompt' | 'granted' | 'denied' | 'unsupported'} */
  const initialPermission = () => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return 'unsupported';
    return typeof (/** @type {any} */ (window).DeviceOrientationEvent.requestPermission) === 'function' ? 'prompt' : 'granted';
  };
  const [permission, setPermission] = useState(initialPermission);
  const request = useCallback(() => {
    const DOE = typeof window !== 'undefined' ? /** @type {any} */ (window).DeviceOrientationEvent : null;
    if (permission !== 'prompt' || typeof DOE?.requestPermission !== 'function') return;
    DOE.requestPermission().then(
      (r) => setPermission(r === 'granted' ? 'granted' : 'denied'),
      () => setPermission('denied'),
    );
  }, [permission]);

  useEffect(() => {
    if (!active || permission !== 'granted') return undefined;
    let last = 0;
    const onEvent = (/** @type {any} */ e) => {
      const now = Date.now();
      if (now - last < 200) return; // 5 readings a second is plenty for an arrow
      const h = compassFromEvent(e, screen.orientation?.angle ?? 0);
      if (h == null) return;
      last = now;
      setReading((cur) => {
        const next = smoothAngle(cur?.heading ?? null, h);
        return cur && Math.abs(turn(cur.heading, next)) < 2 ? { heading: cur.heading, at: now } : { heading: next, at: now };
      });
    };
    // Android's absolute event is true north; the plain one is relative to wherever the phone started. iPhone only
    // has the plain one, with a ready compass heading.
    window.addEventListener('deviceorientationabsolute', onEvent, true);
    window.addEventListener('deviceorientation', onEvent, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onEvent, true);
      window.removeEventListener('deviceorientation', onEvent, true);
    };
  }, [active, permission]);

  return { reading, permission, request };
}

/**
 * The direction for the pin: walking direction, else compass, else null. Re-checked every second so a reading that
 * stops arriving fades to a plain dot.
 */
export function useHeading(
  /** @type {{ heading: number | null, speed: number | null, at: number } | null} */ gps,
  /** @type {{ heading: number, at: number } | null} */ compass,
) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const latest = Math.max(now, gps?.at ?? 0, compass?.at ?? 0);
  return pickHeading({ gps, compass, now: latest });
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
