/**
 * Vercel entry point for the owner's private share-link count: /api/stats?key=<STATS_KEY>.
 * Needs STATS_KEY (any long secret) and the Turso settings. See server/stats.js.
 */
import { createStatsHandler } from '../server/stats.js';

export default createStatsHandler();
