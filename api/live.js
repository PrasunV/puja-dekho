/**
 * Vercel entry point for the "people exploring now" counter: /api/live.
 * A file in api/ wins over the /api/* rewrite in vercel.json, and this function needs only the Turso settings.
 */
import { createLiveHandler } from '../server/live.js';

export default createLiveHandler();
