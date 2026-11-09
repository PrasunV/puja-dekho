/**
 * Vercel entry point for the Jagadhatri "people exploring now" counter: /api/jagadhatri/live.
 * Its own table (jg_live_presence), separate from the Durga count.
 */
import { createLiveHandler } from '../../server/live.js';

export default createLiveHandler({ table: 'jg_live_presence' });
