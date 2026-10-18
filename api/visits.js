/**
 * Vercel entry point for the "people viewed" counter: /api/visits.
 * A file in api/ wins over the /api/* rewrite in vercel.json, and this function needs only the Turso settings.
 */
import { createVisitHandler } from '../server/visits.js';

export default createVisitHandler();
