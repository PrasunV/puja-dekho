/**
 * Vercel entry point for the Jagadhatri "people viewed" counter: /api/jagadhatri/visits.
 * Its own table (jg_visit_counter) and its own once-a-day cookie, so it never mixes with the Durga count.
 */
import { createVisitHandler, JAGADHATRI_VISITS } from '../../server/visits.js';

export default createVisitHandler({ counter: JAGADHATRI_VISITS });
