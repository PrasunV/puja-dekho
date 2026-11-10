/**
 * Vercel entry point for Jagadhatri accounts: /api/jagadhatri/account (Google sign-in, wish list, visited pujas).
 * Needs SECRET (signs the session cookie) and the Turso settings, both already set for the Durga app.
 */
import { createAccountHandler } from '../../server/jagadhatri/account.js';

export default createAccountHandler();
