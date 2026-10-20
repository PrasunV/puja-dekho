export const LINE_NAME = Object.freeze({ blue: 'Blue Line', green: 'Green Line', yellow: 'Yellow Line', orange: 'Orange Line' });

/** Stations in running order, used to draw the two mapped lines. */
export const LINE_ORDER = Object.freeze({
  blue: [
    'dakshineswar',
    'noapara',
    'dum-dum',
    'belgachia',
    'shyambazar',
    'shobhabazar-sutanuti',
    'girish-park',
    'mahatma-gandhi-road',
    'central',
    'chandni-chowk',
    'esplanade',
    'park-street',
    'maidan',
    'rabindra-sadan',
    'netaji-bhawan',
    'jatin-das-park',
    'kalighat',
    'rabindra-sarovar',
    'mahanayak-uttam-kumar',
    'netaji',
    'masterda-surya-sen',
    'gitanjali',
    'kavi-nazrul',
    'shahid-khudiram',
    'kavi-subhas',
  ],
  green: [
    'howrah-maidan',
    'howrah',
    'mahakaran',
    'esplanade',
    'sealdah',
    'phoolbagan',
    'bengal-chemical',
    'city-centre',
    'central-park',
    'karunamayee',
    'salt-lake-sector-v',
  ],
});

/** Lines drawn on the map and offered for planning. */
export const MAPPED_LINES = /** @type {const} */ (['blue', 'green']);

/** Table rows on the Metro screen. */
export const LINE_SUMMARY = [
  ['blue', 'Blue', 'Dakshineswar to Kavi Subhash'],
  ['green', 'Green', 'Howrah Maidan to Salt Lake Sector V'],
  ['yellow', 'Yellow', 'Noapara to Airport'],
  ['purple', 'Purple', 'Joka to Majerhat'],
  ['orange', 'Orange', 'Kavi Subhas to Beleghata'],
];

/**
 * Mapped lines (blue or green) that serve a station.
 * @param {import('./types.js').Station} station
 */
export const stationLines = (station) => station.lines.filter((line) => line === 'blue' || line === 'green');

/**
 * Which puja-time schedule applies on an IST date, or null outside the festival.
 * The calendar lives in public/data/metro.json (built by scripts/build-data.py), not in code.
 * @param {import('./types.js').MetroData} metro
 * @param {string} isoDate `YYYY-MM-DD`
 * @returns {import('./types.js').MetroPhase | null}
 */
export function phaseFor(metro, isoDate) {
  return metro.phases.find((phase) => isoDate >= phase.from && isoDate <= phase.to) ?? null;
}

/**
 * Timing table for a line, matched by the line's name prefix in `metro.timings`.
 * @param {import('./types.js').MetroData} metro
 * @param {string} line `blue`, `green`, ...
 */
export function lineTimings(metro, line) {
  const key = Object.keys(metro.timings).find((name) => name.toLowerCase().startsWith(line));
  return key ? metro.timings[key] : null;
}

/**
 * Operating hours text for a line in a phase, or null when unknown.
 * @param {import('./types.js').MetroData} metro
 * @param {string} line
 * @param {import('./types.js').MetroPhase | null} phase
 */
export function timingText(metro, line, phase) {
  const timings = lineTimings(metro, line);
  if (!timings || !phase) return null;
  if (typeof timings === 'string') return timings;
  const saptamiToNavami = timings.Saptami_to_Navami || timings.Saptami_to_Dashami;
  switch (phase.id) {
    case 'ps':
      return timings.Panchami_Shashthi;
    case 'sn':
      return saptamiToNavami;
    case 'd':
      return timings.Dashami || timings.Saptami_to_Dashami;
    case 'uncertain':
      return `${timings.Panchami_Shashthi} or ${saptamiToNavami}`;
    default:
      return null;
  }
}

/**
 * Plain-words cautions for a station on a Puja day: the Orange Line does not run, and the Yellow and Purple
 * Lines stop well before the Blue and Green Lines do. Empty outside the festival or when the lines are fine.
 * @param {import('./types.js').MetroData} metro
 * @param {import('./types.js').Station} station
 * @param {import('./types.js').MetroPhase | null} phase
 * @returns {string[]}
 */
export function metroNotes(metro, station, phase) {
  if (!phase) return [];
  const notes = [];
  if (station.lines.includes('orange')) notes.push('Orange Line: no service on the main Puja days.');
  for (const line of ['yellow', 'purple']) {
    if (!station.lines.includes(line)) continue;
    const hours = timingText(metro, line, phase);
    if (hours) notes.push(`${line[0].toUpperCase()}${line.slice(1)} Line runs ${hours.replace(/(\d)-(\d)/g, '$1 – $2')} only. Plan another way back at night.`);
  }
  return notes;
}
