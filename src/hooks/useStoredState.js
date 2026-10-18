import { useEffect, useState } from 'react';
import { storage } from '../lib/storage.js';

/**
 * `useState` that survives reloads (localStorage, namespaced, never throws).
 * @template T
 * @param {string} key
 * @param {T} initial Used when nothing is stored
 * @returns {[T, import('react').Dispatch<import('react').SetStateAction<T>>]}
 */
export function useStoredState(key, initial) {
  const [value, setValue] = useState(() => storage.get(key, initial));
  useEffect(() => {
    storage.set(key, value);
  }, [key, value]);
  return [value, setValue];
}
