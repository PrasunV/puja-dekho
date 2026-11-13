import { useEffect, useState } from 'react';
import { LINE_ROTATE_MS, SLOW_ROTATE_MS } from './config.js';
import { linesFor } from './lines.js';

/**
 * The line to show now; it changes once per loader loop. Reduced-motion users get the first line, still.
 * @param {import('./lines.js').LoaderContext} context
 * @param {import('./lines.js').LoaderStage} stage
 */
export function useRotatingLine(context, stage) {
  const lines = linesFor(context, stage);
  // The count restarts whenever the context or stage changes.
  const key = `${context}|${stage}`;
  const [at, setAt] = useState({ key, i: 0 });
  useEffect(() => {
    if (stage === 'fail' || lines.length < 2) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(
      () => setAt((cur) => ({ key, i: ((cur.key === key ? cur.i : 0) + 1) % lines.length })),
      stage === 'slow' ? SLOW_ROTATE_MS : LINE_ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [key, stage, lines.length]);
  const i = at.key === key ? at.i : 0;
  return { line: lines[i % (lines.length || 1)] || '', index: i };
}
