import crypto from 'node:crypto';
import { RULES } from '../rules.js';

const COOKIE = 'pid';
const ONE_YEAR_SEC = 365 * 86400;

/**
 * Anonymous device identity: an HMAC-signed cookie, no sign-in.
 * @param {import('./context.js').ServiceContext} ctx
 */
export function createDeviceService({ query, now, cookies }) {
  /** Device id from a valid signed cookie, or null. */
  const read = (req) => {
    const value = cookies.parse(req)[COOKIE];
    if (!value) return null;
    const [id, signature] = value.split('.');
    return id && signature && cookies.safeEqual(signature, cookies.sign(`pid:${id}`)) ? id : null;
  };

  /**
   * Device id for a write. Mints one (rate-limited per network) when the cookie is missing.
   * @returns {Promise<string | null>} null when this network minted too many devices
   */
  const ensure = async (req, res) => {
    const existing = read(req);
    if (existing) return existing;
    const ipHash = cookies.hashIp(req);
    const recent = (await query('SELECT COUNT(*) AS n FROM devices WHERE ip_hash = ? AND created_at > ?').get(ipHash, now() - 3600e3)).n;
    if (recent >= RULES.newDevicesPerIpPerHour) return null;
    const id = crypto.randomBytes(16).toString('hex');
    await query('INSERT INTO devices (id, ip_hash, created_at) VALUES (?,?,?)').run(id, ipHash, now());
    cookies.set(req, res, COOKIE, `${id}.${cookies.sign(`pid:${id}`)}`, ONE_YEAR_SEC);
    return id;
  };

  return { read, ensure };
}
