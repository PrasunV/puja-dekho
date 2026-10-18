import express from 'express';
import { CLOSURE_TYPES, QUEUE_LEVELS, RULES } from '../rules.js';
import { asyncHandler, notFound } from '../http/errors.js';

/**
 * The JSON API, mounted at /api. Routes only translate HTTP to service calls.
 * Contract: docs/API.md.
 *
 * @param {{ reports: ReturnType<typeof import('../services/reports.js').createReportService>,
 *           aggregates: ReturnType<typeof import('../services/aggregates.js').createAggregates>,
 *           now: () => number }} deps
 */
export function createApiRouter({ reports, aggregates, now }) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ ok: true, rules: { nearRadiusM: RULES.nearRadiusM }, levels: QUEUE_LEVELS, closureTypes: CLOSURE_TYPES });
  });

  router.get(
    '/state',
    asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ts: now(), ...(await aggregates.get()), mine: await reports.mine(req) });
    }),
  );

  router.post(
    '/rate',
    asyncHandler(async (req, res) => res.json(await reports.rate(req, res, req.body))),
  );
  router.post(
    '/report/queue',
    asyncHandler(async (req, res) => res.json(await reports.reportQueue(req, res, req.body))),
  );
  router.post(
    '/report/closure',
    asyncHandler(async (req, res) => res.json(await reports.reportClosure(req, res, req.body))),
  );
  router.post(
    '/closure/:id/vote',
    asyncHandler(async (req, res) => res.json(await reports.voteOnClosure(req, res, Number(req.params.id), req.body?.vote))),
  );

  router.use((req, res, next) => next(notFound()));
  return router;
}
