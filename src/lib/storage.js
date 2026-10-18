const PREFIX = 'pd_';

/**
 * Typed-ish wrapper over localStorage that never throws (storage can be blocked, full or absent).
 * Values are JSON. Keys are namespaced with `pd_`.
 */
export const storage = {
  /**
   * @template T
   * @param {string} key
   * @param {T} fallback Returned when nothing usable is stored
   * @returns {T}
   */
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  /**
   * @param {string} key
   * @param {unknown} value
   */
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage blocked or full: the app still works, it just forgets */
    }
  },
};
