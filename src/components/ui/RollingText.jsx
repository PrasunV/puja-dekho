import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Longest a roll can take: the slide itself plus the stagger across the characters. Must match styles.css. */
const ROLL_MS = 520;
const STAGGER_MS = 22;

/**
 * A line of text that rolls over when it changes: the old characters slide up and out, the new ones slide up
 * into place, one after another from the left. The box also eases to the width of the new text, so whatever sits
 * beside it glides rather than jumps. Nothing animates on first render. Hidden from screen readers on purpose:
 * put the full sentence in an aria-label on the parent.
 *
 * @param {{ text: string }} props
 */
export function RollingText({ text }) {
  const [state, setState] = useState({ now: text, before: /** @type {string | null} */ (null), n: 0 });
  const [width, setWidth] = useState(/** @type {number | undefined} */ (undefined));
  const [ready, setReady] = useState(false);
  const measure = useRef(/** @type {HTMLSpanElement | null} */ (null));

  // A new text starts a roll; the old one stays for the length of the animation.
  if (text !== state.now) setState({ now: text, before: state.now, n: state.n + 1 });

  useEffect(() => {
    if (state.before === null) return undefined;
    const done = setTimeout(
      () => setState((s) => (s.n === state.n ? { ...s, before: null } : s)),
      ROLL_MS + STAGGER_MS * Math.max(state.now.length, state.before.length) + 60,
    );
    return () => clearTimeout(done);
  }, [state.n, state.before, state.now.length]);

  // Size the box to the new text before it paints, so the width and the roll start together.
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

  const rolling = state.before !== null;
  return (
    <span className={`roll${ready ? ' ready' : ''}${rolling ? ' rolling' : ''}`} style={{ width }} aria-hidden="true">
      <span className="roll-measure" ref={measure}>
        {state.now}
      </span>
      {rolling && (
        <span className="roll-layer before" key={`b${state.n}`}>
          {chars(state.before ?? '')}
        </span>
      )}
      <span className="roll-layer now" key={`n${state.n}`}>
        {chars(state.now)}
      </span>
    </span>
  );
}

/** One span per character, each with its place in line for the stagger. */
function chars(text) {
  return Array.from(text).map((ch, i) => (
    <span className="roll-ch" key={i} style={/** @type {import('react').CSSProperties} */ ({ '--i': i })}>
      {ch}
    </span>
  ));
}
