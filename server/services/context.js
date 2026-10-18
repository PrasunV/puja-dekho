/**
 * Shared dependencies handed to every service.
 * @typedef {object} ServiceContext
 * @property {(sql: string) => { get: Function, all: Function, run: Function }} query
 * @property {() => number} now                          Current time in ms (injectable for tests)
 * @property {ReturnType<typeof import('../lib/cookies.js').createCookieTools>} cookies
 * @property {Map<string, import('../lib/pujas.js').Puja>} pujas
 */

const IST_OFFSET_MS = 5.5 * 3600e3;

/**
 * Start of the current day in India Standard Time, as epoch ms. Daily caps reset here.
 * @param {number} nowMs
 */
export function startOfIstDay(nowMs) {
  const day = new Date(nowMs + IST_OFFSET_MS).toISOString().slice(0, 10);
  return Date.parse(`${day}T00:00:00+05:30`);
}
