import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {object} Puja
 * @property {string} id
 * @property {string} n   Name
 * @property {number} la  Latitude
 * @property {number} lo  Longitude
 * @property {boolean} ck Pin is exact (not a shared or approximate pin)
 */

/**
 * Load the puja list that ships with the front end, indexed by id.
 * @param {string} root Project root
 * @returns {Map<string, Puja>}
 */
export function loadPujaIndex(root) {
  const file = path.join(root, 'public', 'data', 'pujas.json');
  /** @type {Puja[]} */
  const pujas = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Map(pujas.map((puja) => [puja.id, puja]));
}
