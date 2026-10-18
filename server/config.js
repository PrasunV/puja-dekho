/**
 * Environment parsing. The only place that reads `process.env`-style values.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @typedef {object} Config
 * @property {boolean} production     NODE_ENV=production
 * @property {boolean} onVercel       Running as a Vercel function
 * @property {string} secret          Signs device cookies
 * @property {string | undefined} databaseUrl  Turso/libSQL URL; unset means a local file
 * @property {string | undefined} databaseToken
 * @property {string} dataDir         Folder for the local database file
 * @property {string | number | undefined} trustProxy  Express "trust proxy" value
 * @property {string} root            Project root
 */

/**
 * Validate and normalise environment variables.
 * @param {Record<string, string | undefined>} env
 * @returns {Config}
 * @throws {Error} when production is missing the secret, or Vercel is missing the database URL.
 */
export function loadConfig(env) {
  const production = env.NODE_ENV === 'production';
  const onVercel = Boolean(env.VERCEL);
  if (onVercel && !env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is required on Vercel');
  }
  let secret = env.SECRET;
  if (!secret) {
    if (production) throw new Error('SECRET is required in production (a long random string)');
    secret = 'dev-secret-not-for-production';
  }
  let trustProxy;
  if (env.TRUST_PROXY || onVercel) trustProxy = env.TRUST_PROXY && env.TRUST_PROXY !== '1' ? env.TRUST_PROXY : 1;
  return {
    production,
    onVercel,
    secret,
    databaseUrl: env.TURSO_DATABASE_URL || undefined,
    databaseToken: env.TURSO_AUTH_TOKEN || undefined,
    dataDir: env.DATA_DIR || path.join(ROOT, 'data'),
    trustProxy,
    root: ROOT,
  };
}
