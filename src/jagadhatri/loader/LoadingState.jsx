import { useState } from 'react';
import EyeLoader from './EyeLoader.jsx';
import { SMALL_LOADER_DELAY_MS } from './config.js';
import { useLoadingStage } from './useLoadingStage.js';
import { useRotatingLine } from './useRotatingLine.js';
import './loader.css';

/**
 * The eye, a rotating line, and (after 15 s or on error) a Try again button.
 * It shows nothing for the first 300 ms, so a fast load never flashes.
 * @param {{
 *   isLoading: boolean,
 *   isError?: boolean,
 *   onRetry?: () => void,
 *   context?: import('./lines.js').LoaderContext,
 *   size?: number,
 *   delayMs?: number,
 * }} props
 */
export default function LoadingState({
  isLoading,
  isError = false,
  onRetry,
  context = 'page',
  size = 56,
  delayMs = SMALL_LOADER_DELAY_MS,
}) {
  const [attempt, setAttempt] = useState(0);
  const timed = useLoadingStage(isLoading && !isError, delayMs, attempt);
  const stage = isError ? 'fail' : timed;
  const { line, index } = useRotatingLine(context, stage);
  if (stage === 'idle' || stage === 'hidden') return null;
  const failed = stage === 'fail';
  return (
    <div className={`pd-loading pd-loading--${context}`} role={failed ? 'alert' : 'status'}>
      {!failed && <EyeLoader size={size} />}
      {!failed && <span className="pd-sr">Loading</span>}
      {line && (
        <p key={`${stage}-${index}`} className="pd-line" aria-hidden={stage === 'wait' || undefined}>
          {line}
        </p>
      )}
      {failed && (
        <button
          type="button"
          className="btn dark"
          onClick={() => {
            setAttempt((n) => n + 1);
            onRetry?.();
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
