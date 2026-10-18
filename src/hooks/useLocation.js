import { useCallback, useEffect, useRef, useState } from 'react';
import { getPosition } from '../lib/geo.js';
import { useToast } from '../context/ToastContext.jsx';

/**
 * Device location: one-shot lookup, then a live watch once the person has allowed it.
 * Starts on its own when the browser already has permission for this site.
 *
 * @param {(position: import('../lib/types.js').Position, isFirstFix: boolean) => void} onFix  Called for every update
 */
export function useLocation(onFix) {
  const toast = useToast();
  const [position, setPosition] = useState(/** @type {import('../lib/types.js').Position | null} */ (null));
  const [status, setStatus] = useState(/** @type {'idle' | 'asking' | 'on' | 'denied'} */ ('idle'));
  const watchId = useRef(/** @type {number | null} */ (null));
  const onFixRef = useRef(onFix);
  useEffect(() => {
    onFixRef.current = onFix;
  }, [onFix]);

  const accept = useCallback((next, isFirstFix) => {
    setPosition(next);
    setStatus('on');
    onFixRef.current(next, isFirstFix);
  }, []);

  /**
   * Ask for the location (shows the browser prompt the first time).
   * @param {(position: import('../lib/types.js').Position) => void} [then] Runs after the first fix
   */
  const locate = useCallback(
    (then) => {
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
        .catch(() => {
          setStatus('denied');
          toast('Location is off. Allow it in your browser settings to see what is nearest, or pick areas under Filters.', 'err');
        });
    },
    [accept, toast],
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
        else if (result.state === 'denied') setStatus('denied');
      })
      .catch(() => {
        /* Permissions API not available: wait for a tap */
      });
    return () => {
      cancelled = true;
    };
  }, [locate]);

  return { position, status, locate, simulateFix: (p) => accept(p, false) };
}
