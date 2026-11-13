/** Approved copy. Do not reword without asking the owner. */
export const LINES = {
  wait: [
    'Lighting up the lanes of Chandannagar...',
    'Warming up the dhak...',
    'Counting the lights, one by one...',
    'Finding the best pandals for you...',
    'Ma is almost ready to meet you...',
    'Ektu wait, the lights are coming on...',
    'Asking the committees for directions...',
  ],
  slow: [
    'Slow network today. Still fetching, hang on.',
    'Big bhiir on the network. Still on the way.',
    'Taking longer than usual. Almost there.',
  ],
  fail: ["Couldn't reach the pandals. Check your connection and try again.", "Looks like you're offline. Reconnect and try again."],
  map: ['Unrolling the map...', 'Placing the pandals...', 'Finding your way around...'],
};

/** @typedef {'page' | 'map'} LoaderContext */
/** @typedef {'idle' | 'hidden' | 'wait' | 'slow' | 'fail'} LoaderStage */

/**
 * The lines to show for a context and stage. A context with no approved wait lines shows the eye alone.
 * @param {LoaderContext} context
 * @param {LoaderStage} stage
 * @returns {string[]}
 */
export function linesFor(context, stage) {
  if (stage === 'wait') return context === 'page' ? LINES.wait : context === 'map' ? LINES.map : [];
  if (stage === 'slow') return LINES.slow;
  if (stage === 'fail') return [typeof navigator !== 'undefined' && navigator.onLine === false ? LINES.fail[1] : LINES.fail[0]];
  return [];
}
