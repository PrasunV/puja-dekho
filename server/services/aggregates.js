import { RULES } from '../rules.js';
import { weightedMedian } from '../lib/stats.js';

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Public, derived numbers: rating scores, queue estimates and live road reports.
 * Computed from raw rows and cached briefly per server instance.
 *
 * @param {import('./context.js').ServiceContext} ctx
 */
export function createAggregates({ query, now }) {
  /** @type {{ at: number, data: any }} */
  let cache = { at: 0, data: null };

  /** Bayesian-weighted rating per puja. Anonymous ratings count 0.4; heavy single-network voting counts 0.1. */
  async function ratingsByPuja(out) {
    const rows = await query('SELECT puja_id, ip_hash, stars FROM ratings ORDER BY created_at').all();
    const seenPerIp = new Map();
    const perPuja = new Map();
    let totalWeight = 0;
    let totalScore = 0;
    for (const row of rows) {
      /** @type {number} */
      let weight = RULES.weightAnonymous;
      const ipKey = `${row.puja_id}|${row.ip_hash}`;
      const seen = (seenPerIp.get(ipKey) || 0) + 1;
      seenPerIp.set(ipKey, seen);
      if (seen > RULES.ipFreeRatingsPerPuja) weight = Math.min(weight, RULES.weightIpOverflow);
      const sum = perPuja.get(row.puja_id) || { count: 0, weight: 0, score: 0 };
      sum.count += 1;
      sum.weight += weight;
      sum.score += weight * row.stars;
      perPuja.set(row.puja_id, sum);
      totalWeight += weight;
      totalScore += weight * row.stars;
    }
    const globalMean = totalWeight >= RULES.priorMeanMinWeight ? totalScore / totalWeight : RULES.priorMeanFloor;
    for (const [pujaId, sum] of perPuja) {
      const bayes = (RULES.priorWeight * globalMean + sum.score) / (RULES.priorWeight + sum.weight);
      (out.pujas[pujaId] ||= {}).r = { avg: round1(bayes), raw: round1(sum.score / sum.weight), n: sum.count };
    }
  }

  /** Recency-weighted median queue level and wait per puja. */
  async function queueByPuja(out, t) {
    const since = t - RULES.queueWindowMin * 60e3;
    const rows = await query(
      "SELECT puja_id, level, wait_min, near, created_at, nickname FROM reports WHERE kind = 'queue' AND created_at > ?",
    ).all(since);
    const grouped = Map.groupBy(rows, (row) => row.puja_id);
    for (const [pujaId, list] of grouped) {
      const weighted = list.map((row) => {
        const ageMin = (t - row.created_at) / 60e3;
        const base = row.near ? 1 : RULES.queueRemoteWeight;
        return { level: row.level, wait: row.wait_min, weight: base * 0.5 ** (ageMin / RULES.queueHalfLifeMin) };
      });
      const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
      const waits = weighted.filter((item) => item.wait != null).map((item) => ({ value: item.wait, weight: item.weight }));
      const latest = list.reduce((a, b) => (b.created_at >= a.created_at ? b : a));
      (out.pujas[pujaId] ||= {}).q = {
        level: weightedMedian(weighted.map((item) => ({ value: item.level, weight: item.weight }))),
        wait: waits.length ? weightedMedian(waits) : null,
        n: list.length,
        ageMin: Math.round((t - latest.created_at) / 60e3),
        conf: totalWeight >= 1 ? 'ok' : 'low',
        by: latest.nickname || null,
      };
    }
  }

  /** Live road reports, minus the ones neighbours say have cleared. */
  async function activeClosures(out, t) {
    const rows = await query("SELECT * FROM reports WHERE kind = 'closure' AND created_at > ? ORDER BY created_at DESC").all(
      t - RULES.closureWindowMin * 60e3,
    );
    const votes = await query('SELECT report_id, vote, COUNT(*) AS n FROM closure_votes GROUP BY report_id, vote').all();
    const countOf = (reportId, vote) => votes.find((v) => v.report_id === reportId && v.vote === vote)?.n || 0;
    for (const row of rows) {
      const cleared = countOf(row.id, 'cleared');
      const still = countOf(row.id, 'still') + 1; // the reporter counts as one "still there"
      if (cleared >= 2 && cleared > still) continue;
      out.closures.push({
        id: row.id,
        type: row.closure_type,
        lat: row.lat,
        lng: row.lng,
        note: row.note,
        ageMin: Math.round((t - row.created_at) / 60e3),
        still,
        cleared,
      });
    }
  }

  /** Aggregates for every puja and road report. Cached for `RULES.aggregateCacheMs`. */
  const get = async () => {
    const t = now();
    if (cache.data && t - cache.at < RULES.aggregateCacheMs) return cache.data;
    const out = { pujas: {}, closures: [] };
    await ratingsByPuja(out);
    await queueByPuja(out, t);
    await activeClosures(out, t);
    cache = { at: t, data: out };
    return out;
  };

  /** Drop the cache after a write so the next read is fresh. */
  const invalidate = () => {
    cache = { at: 0, data: null };
  };

  return { get, invalidate };
}
