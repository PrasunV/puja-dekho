import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Longest a swap can take. Must match styles.css. */
const SWAP_MS = 260;

/**
 * A short phrase that crossfades when it changes: the old text fades up and out while the new text fades up into
 * place. The box eases to the new width with a short, stiff curve, so whatever sits beside it follows without
 * lingering. Nothing animates on first render. Hidden from screen readers on purpose: put the full sentence in an
 * aria-label on the parent. `data-text` carries the plain text for tests and tooling.
 *
 * @param {{ text: string }} props
 */
export function PhraseSwap({ text }) {
  const [state, setState] = useState({ now: text, before: /** @type {string | null} */ (null), n: 0 });
  const [width, setWidth] = useState(/** @type {number | undefined} */ (undefined));
  const [ready, setReady] = useState(false);
  const measure = useRef(/** @type {HTMLSpanElement | null} */ (null));

  if (text !== state.now) setState({ now: text, before: state.now, n: state.n + 1 });

  useEffect(() => {
    if (state.before === null) return undefined;
    const done = setTimeout(() => setState((s) => (s.n === state.n ? { ...s, before: null } : s)), SWAP_MS + 60);
    return () => clearTimeout(done);
  }, [state.n, state.before]);

  // Size the box to the new text before it paints, so the width and the fade start together.
  useLayoutEffect(() => {
    if (measure.current) setWidth(measure.current.offsetWidth);
  }, [state.now]);

  // A web font arriving after first paint changes the width: follow it.
  useEffect(() => {
    const el = measure.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const watcher = new ResizeObserver(() => setWidth(el.offsetWidth));
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);

  // Switch the width transition on only after the first measurement, so the first paint is not animated.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span className={`swap${ready ? ' ready' : ''}`} style={{ width }} data-text={state.now} aria-hidden="true">
      <span className="swap-measure" ref={measure}>
        {state.now}
      </span>
      {state.before !== null && (
        <span className="swap-layer out" key={`o${state.n}`}>
          {state.before}
        </span>
      )}
      <span className={`swap-layer${state.n > 0 ? ' in' : ''}`} key={`i${state.n}`}>
        {state.now}
      </span>
    </span>
  );
}
