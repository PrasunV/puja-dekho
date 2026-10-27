/**
 * Vercel entry point for the meetup "love" counter: /api/loves. Needs only the Turso settings.
 */
import { createLoveHandler } from '../server/loves.js';

export default createLoveHandler();
