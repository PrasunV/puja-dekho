import assert from 'node:assert/strict';
import test from 'node:test';
import { phaseFor, timingText } from '../../src/lib/metro.js';

const metro = /** @type {any} */ ({
  phases: [
    { id: 'ps', label: 'Panchami / Shashthi', from: '2026-10-15', to: '2026-10-16' },
    { id: 'uncertain', label: 'Unsure', from: '2026-10-17', to: '2026-10-17' },
    { id: 'sn', label: 'Saptami to Navami', from: '2026-10-18', to: '2026-10-20' },
    { id: 'd', label: 'Dashami', from: '2026-10-21', to: '2026-10-21' },
  ],
  timings: {
    'Blue (Dakshineswar - Kavi Subhash)': { Panchami_Shashthi: '06:00-23:00', Saptami_to_Navami: 'night-long', Dashami: '13:00-22:30' },
    'Purple (Joka - Majerhat)': { Panchami_Shashthi: '06:40-21:26', Saptami_to_Dashami: '15:00-22:55' },
    'Orange (Kavi Subhash - Beleghata)': 'No service on main Puja days',
  },
});

test('phaseFor: picks the phase for an IST date and null outside the festival', () => {
  assert.equal(phaseFor(metro, '2026-10-14'), null);
  assert.equal(phaseFor(metro, '2026-10-15')?.id, 'ps');
  assert.equal(phaseFor(metro, '2026-10-17')?.id, 'uncertain');
  assert.equal(phaseFor(metro, '2026-10-19')?.id, 'sn');
  assert.equal(phaseFor(metro, '2026-10-21')?.id, 'd');
  assert.equal(phaseFor(metro, '2026-10-22'), null);
});

test('timingText: per phase, the uncertain phase shows both, and plain-text lines pass through', () => {
  const at = (id) => metro.phases.find((p) => p.id === id) ?? null;
  assert.equal(timingText(metro, 'blue', at('ps')), '06:00-23:00');
  assert.equal(timingText(metro, 'blue', at('sn')), 'night-long');
  assert.equal(timingText(metro, 'blue', at('uncertain')), '06:00-23:00 or night-long');
  assert.equal(timingText(metro, 'purple', at('d')), '15:00-22:55');
  assert.equal(timingText(metro, 'orange', at('sn')), 'No service on main Puja days');
  assert.equal(timingText(metro, 'blue', null), null);
  assert.equal(timingText(metro, 'yellow', at('ps')), null);
});
