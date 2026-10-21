/** Vercel entry point for shared links: /api/share?v=<video id | ghat>&s=<wa | cp>. See server/share.js. */
import { createShareHandler } from '../server/share.js';

export default createShareHandler();
