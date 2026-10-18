/**
 * Vercel entry point. Every /api/* request lands here (see vercel.json rewrites).
 */
import { createApp } from '../server/app.js';

export default createApp().app;
