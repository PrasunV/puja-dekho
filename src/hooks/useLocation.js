import { useCallback, useEffect, useRef, useState } from 'react';
import { getPosition } from '../lib/geo.js';

/**
 * Device location: one-shot lookup, then a live watch once the person has allowed it.
 * Starts on its own when the browser already has permission for this site.
 *
 * @param {(position: import('../lib/types.js').Position, isFirstFix: boolean) => void} onFix  Called for every update
 * @param {(failure: 'blocked' | 'nosignal') => void} [onFail]  Called when a lookup fails (the card says what happened; the app may add a toast)
 */
export function useLocation(onFix, onFail) {
  const [position, setPosition] = useState(/** @type {import('../lib/types.js').Position | null} */ (null));
  const [status, setStatus] = useState(/** @type {'idle' | 'asking' | 'on' | 'denied'} */ ('idle'));
  // Why there is no location: the browser says no (`blocked`), or it could not find one (`nosignal`). `retries` counts taps made while already failing.
  const [failure, setFailure] = useState(/** @type {'blocked' | 'nosignal' | null} */ (null));
  const [retries, setRetries] = useState(0);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);
  const watchId = useRef(/** @type {number | null} */ (null));
  const onFixRef = useRef(onFix);
  useEffect(() => {
    onFixRef.current = onFix;
  }, [onFix]);

  const accept = useCallback((next, isFirstFix) => {
    setPosition(next);
    setStatus('on');
    setFailure(null);
    onFixRef.current(next, isFirstFix);
  }, []);

  /**
   * Ask for the location (shows the browser prompt the first time).
   * @param {(position: import('../lib/types.js').Position) => void} [then] Runs after the first fix
   */
  const locate = useCallback(
    (then) => {
      if (statusRef.current === 'denied') setRetries((n) => n + 1);
      setStatus((s) => (s === 'on' ? s : 'asking'));
      getPosition({ timeout: 12_000 })
        .then((first) => {
          accept(first, true);
          then?.(first);
          if (watchId.current == null && navigator.geolocation) {
            watchId.current = navigator.geolocation.watchPosition(
              (p) => accept({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }, false),
              () => {},
              { enableHighAccuracy: true, maximumAge: 20_000 },
            );
          }
        })
        .catch((error) => {
          // Code 1 is the browser refusing; anything else (no GPS, a timeout) is "could not find you".
          const why = error?.code === 1 ? 'blocked' : 'nosignal';
          setFailure(why);
          setStatus('denied');
          onFailRef.current?.(why);
        });
    },
    [accept],
  );

  useEffect(
    () => () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  // If permission is already granted, start straight away; otherwise wait for a tap.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((result) => {
        if (cancelled) return;
        if (result.state === 'granted') locate();
        else if (result.state === 'denied') {
          setFailure('blocked');
          setStatus('denied');
        }
      })
      .catch(() => {
        /* Permissions API not available: wait for a tap */
      });
    return () => {
      cancelled = true;
    };
  }, [locate]);

  return { position, status, failure, retries, locate, simulateFix: (p) => accept(p, false) };
}
