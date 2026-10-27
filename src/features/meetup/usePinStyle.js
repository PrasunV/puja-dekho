import { useSyncExternalStore } from 'react';
import { DEFAULT_PIN_STYLE, PIN_STYLES } from '../../data/meetup.js';
import { storage } from '../../lib/storage.js';

const listeners = new Set();
let current = (() => {
  const saved = storage.get('pinStyle2', DEFAULT_PIN_STYLE);
  return PIN_STYLES.some((s) => s.id === saved) ? saved : DEFAULT_PIN_STYLE;
})();

/** Which of the three pin looks is showing. Shared by the map and the preview switcher; remembered on this phone. */
export function usePinStyle() {
  const style = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => current,
  );
  const choose = (/** @type {string} */ id) => {
    if (!PIN_STYLES.some((s) => s.id === id) || id === current) return;
    current = id;
    storage.set('pinStyle2', id);
    listeners.forEach((notify) => notify());
  };
  return [style, choose];
}

/** The pin-look switcher is a test aid: it shows in the preview and with `?pinlab` in the address, never for normal visitors. */
export function pinLabEnabled() {
  if (typeof window === 'undefined') return false;
  return Boolean(/** @type {any} */ (window).__PD_PIN_LAB__) || new URLSearchParams(window.location.search).has('pinlab');
}
