/**
 * Tunable product rules. Everything a product owner might want to change lives here,
 * so tuning never means hunting through route code.
 */

/** @typedef {{ n: number, label: string }} QueueLevel */

export const RULES = Object.freeze({
  /** A queue report from within this distance of the puja counts fully. */
  nearRadiusM: 500,
  /** Queue reports older than this are ignored. */
  queueWindowMin: 60,
  /** One queue report per device per puja per this many minutes. */
  queueCooldownMin: 10,
  /** Weight of a report with no (or far away) GPS, compared with 1 for a near one. */
  queueRemoteWeight: 0.3,
  /** Half-life of a queue report's influence, in minutes. */
  queueHalfLifeMin: 20,
  /** Road reports stay visible this long. */
  closureWindowMin: 180,
  /** Two reports of the same kind closer than this are treated as one road. */
  closureDedupeM: 40,
  closureCooldownMin: 5,
  /** Distinct pujas one device may rate per (IST) day. */
  deviceDailyRatingCap: 40,
  deviceDailyReportCap: 60,
  /** Limits mass-minting of device ids from one network. */
  newDevicesPerIpPerHour: 60,
  /** Weight of an anonymous (device-only) rating. */
  weightAnonymous: 0.4,
  /** Weight of the 4th and later rating for one puja from one network. */
  weightIpOverflow: 0.1,
  ipFreeRatingsPerPuja: 3,
  /** Bayesian prior: pulls young scores toward the average. */
  priorWeight: 3,
  priorMeanFloor: 3.8,
  /** Minimum total rating weight before the global mean replaces the floor. */
  priorMeanMinWeight: 20,
  /** Write requests allowed per IP per minute (per server instance). */
  writesPerMinutePerIp: 90,
  /** Aggregates are cached this long, per server instance. */
  aggregateCacheMs: 10_000,
});

/** @type {readonly QueueLevel[]} */
export const QUEUE_LEVELS = Object.freeze([
  { n: 0, label: 'No queue' },
  { n: 1, label: 'Short, under 15 min' },
  { n: 2, label: 'Medium, 15 to 45 min' },
  { n: 3, label: 'Long, 45 min or more' },
]);

export const CLOSURE_TYPES = Object.freeze(['closed', 'oneway', 'barricade', 'diverted']);

/** Bounding box that road reports must fall in (greater Kolkata). */
export const KOLKATA_BOUNDS = Object.freeze({ minLat: 22.2, maxLat: 22.8, minLng: 88.0, maxLng: 88.6 });
