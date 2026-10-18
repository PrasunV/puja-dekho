import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { loadConfig } from './config.js';
import { openDatabase } from './db/client.js';
import { migrate } from './db/schema.js';
import { createCookieTools } from './lib/cookies.js';
import { loadPujaIndex } from './lib/pujas.js';
import { errorHandler } from './http/errors.js';
import { writeRateLimiter } from './http/rateLimit.js';
import { securityHeaders } from './http/security.js';
import { createApiRouter } from './routes/api.js';
import { createVisitHandler } from './visits.js';
import { createAggregates } from './services/aggregates.js';
import { createDeviceService } from './services/devices.js';
import { createReportService } from './services/reports.js';

/**
 * Build the Puja Dekho server. One function, no globals, so tests can boot isolated copies.
 *
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env]  Environment (defaults to process.env)
 * @param {() => number} [options.now]                         Clock (tests inject a fake)
 * @param {string} [options.dbPath]                            Local database file override
 * @returns {{ app: import('express').Express, client: ReturnType<typeof openDatabase>['client'],
 *             ready: Promise<void>, close: () => void }}
 */
export function createApp({ env = process.env, now = Date.now, dbPath } = {}) {
  const config = loadConfig(env);
  if (!config.databaseUrl) fs.mkdirSync(config.dataDir, { recursive: true });

  const database = openDatabase(config, dbPath || path.join(config.dataDir, 'pujadekho.db'));
  const ready = migrate(database.client);
  ready.catch(() => {}); // surfaced to each request via the /api gate; avoids an unhandled rejection at boot
  const cookies = createCookieTools(config.secret);

  const ctx = { query: database.query, now, cookies, pujas: loadPujaIndex(config.root) };
  const aggregates = createAggregates(ctx);
  const devices = createDeviceService(ctx);
  const reports = createReportService(ctx, { devices, aggregates });

  const app = express();
  if (config.trustProxy !== undefined) app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use('/api/visits', createVisitHandler({ env, now, dbPath: path.join(config.dataDir, 'pujadekho.db') }));
  app.use('/api', (req, res, next) => ready.then(() => next(), next));
  app.use('/api', express.json({ limit: '20kb' }));
  app.use('/api', writeRateLimiter({ now, clientKey: cookies.hashIp }));
  app.use('/api', createApiRouter({ reports, aggregates, now }));

  // On Vercel the CDN serves the static site. Locally this server serves the built site too.
  if (!config.onVercel) {
    const webRoot = fs.existsSync(path.join(config.root, 'dist', 'index.html')) ? 'dist' : 'public';
    app.use(
      express.static(path.join(config.root, webRoot), {
        maxAge: '5m',
        setHeaders: (res, file) => {
          if (file.endsWith('index.html') || file.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
  }
  app.use(errorHandler);

  return { app, client: database.client, ready, close: database.close };
}
