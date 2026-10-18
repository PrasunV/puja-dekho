/**
 * Shared JSDoc types. This file has no runtime code; `tsc` reads it.
 *
 * @typedef {object} Puja
 * @property {string} id
 * @property {string} n       Name
 * @property {string} ad      Address
 * @property {string} ar      Area (neighbourhood group)
 * @property {'south' | 'north' | 'central' | 'east' | 'other'} z  Zone, for the area chips
 * @property {string[]} a     Alternate names
 * @property {number} la      Latitude
 * @property {number} lo      Longitude
 * @property {boolean} ck     Pin is exact (not shared or approximate)
 * @property {boolean} [f]    Featured
 * @property {boolean} [h]    Heritage
 * @property {number} [e]     Founding year
 * @property {number} [ec]    Conflicting founding year from another source
 * @property {string[]} fl    Data-quality flags
 * @property {[string, number][]} m  Nearest stations as `[stationId, metres]`
 *
 * @typedef {object} Station
 * @property {string} id
 * @property {string} name
 * @property {number} lat
 * @property {number} lng
 * @property {string[]} lines
 *
 * @typedef {object} MetroPhase
 * @property {string} id      `ps` | `sn` | `d` | `uncertain`
 * @property {string} label
 * @property {string} from    Inclusive ISO date (IST)
 * @property {string} to      Inclusive ISO date (IST)
 *
 * @typedef {object} MetroData
 * @property {Station[]} stations
 * @property {Record<string, string | Record<string, string>>} timings
 * @property {MetroPhase[]} phases
 * @property {string} note
 *
 * @typedef {object} PujaData
 * @property {Puja[]} pujas
 * @property {Map<string, Puja>} byId
 * @property {Station[]} stations
 * @property {Map<string, Station>} stById
 * @property {MetroData} metro
 *
 * @typedef {object} QueueInfo
 * @property {number} level
 * @property {number | null} wait
 * @property {number} n
 * @property {number} ageMin
 * @property {'ok' | 'low'} conf
 * @property {string | null} by
 *
 * @typedef {object} RatingInfo
 * @property {number} avg
 * @property {number} raw
 * @property {number} n
 *
 * @typedef {object} Closure
 * @property {number} id
 * @property {string} type
 * @property {number} lat
 * @property {number} lng
 * @property {string} note
 * @property {number} ageMin
 * @property {number} still
 * @property {number} cleared
 *
 * @typedef {object} LiveState
 * @property {Record<string, { r?: RatingInfo, q?: QueueInfo }>} pujas
 * @property {Closure[]} closures
 *
 * @typedef {object} Mine
 * @property {Record<string, number>} ratings
 * @property {Record<string, 'still' | 'cleared'>} votes
 *
 * @typedef {{ lat: number, lng: number, acc?: number }} Position
 * @typedef {{ la: number, lo: number, name?: string }} RoutePoint
 * @typedef {{ bounds: [number, number, number, number], centre: { lat: number, lng: number } }} Viewport  A map view: `[west, south, east, north]` and its centre
 * @typedef {{ n: number, label: string }} QueueLevel
 */
export {};
