import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Height of one digit in the wheel, in em (so it grows with the text size). Must match .od-win in styles.css. */
const ITEM = 1.35;
/** A wheel is three runs of 0-9; it rests on the middle one so it can spin either way without running out. */
const WHEEL = Array.from({ length: 30 }, (_, i) => i % 10);
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Roll length for the left-most digit; every digit further right takes a little longer, so the last one lands last. */
const BASE_MS = 560;
const LOAD_BASE_MS = 760;
const STEP_MS = 110;
/** How long a digit that has left the number takes to fold away. */
const FOLD_MS = 420;

const mod10 = (n) => ((n % 10) + 10) % 10;

/** "12,34,567" -> [{ d: 1, comma: false }, ...]; a comma belongs to the digit after it. */
function parse(text) {
  const out = [];
  let comma = false;
  for (const ch of text) {
    if (ch === ',') comma = true;
    else {
      out.push({ d: Number(ch), comma });
      comma = false;
    }
  }
  return out;
}

/**
 * @typedef {{ id: number, dir: 'up' | 'down', spin: number, ms: number, from: number | undefined }} Run
 */

/**
 * One digit: a tall strip of 0-9 behind a one-digit window. A change slides the strip with a transform, through
 * every digit in between, so nothing is laid out while it moves.
 * @param {{ digit: number, run: Run | null }} props
 */
function Wheel({ digit, run }) {
  const strip = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const shown = useRef(run?.from ?? digit);
  const last = useRef(0);

  useLayoutEffect(() => {
    const el = strip.current;
    if (!el || !run || run.id === last.current) return;
    last.current = run.id;
    const from = shown.current;
    shown.current = digit;
    const steps = (run.dir === 'up' ? mod10(digit - from) : mod10(from - digit)) + 10 * run.spin;
    if (steps === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = 10 + from;
    const end = run.dir === 'up' ? start + steps : start - steps;
    // The resting style already shows the new digit; the animation covers it from the old one to the new one.
    el.animate([{ transform: `translateY(${-start * ITEM}em)` }, { transform: `translateY(${-end * ITEM}em)` }], {
      duration: run.ms,
      easing: EASE,
      fill: 'backwards',
    });
  }, [digit, run]);

  return (
    <span className="od-win">
      <span className="od-strip" ref={strip} style={{ transform: `translateY(${-(10 + digit) * ITEM}em)` }}>
        {WHEEL.map((n, i) => (
          <span key={i}>{n}</span>
        ))}
      </span>
    </span>
  );
}

/**
 * A place in the number. It widens in when the number gets longer and folds away when it gets shorter; on the very
 * first paint it is simply there.
 * @param {{ digit: number, comma: boolean, gone: boolean, grow: boolean, run: Run | null }} props
 */
function Cell({ digit, comma, gone, grow, run }) {
  const [open, setOpen] = useState(!grow);
  useEffect(() => {
    if (open) return undefined;
    // Two frames, so the browser has painted the folded state before it is asked to open.
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setOpen(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [open]);
  return (
    <span className={`od-cell${open && !gone ? '' : ' off'}`}>
      <span className={`od-comma${comma ? ' on' : ''}`}>,</span>
      <Wheel digit={digit} run={gone ? null : run} />
    </span>
  );
}

/**
 * A number that rolls like an odometer. Each digit is its own wheel: when the number changes the wheels turn
 * through every digit in between (up when it grows, down when it shrinks), the right-most one landing last. The
 * first time it shows it counts up from zero. Hidden from screen readers on purpose: put the sentence in an
 * aria-label on the parent. `data-value` carries the plain text for tests and tooling.
 *
 * @param {{ value: number }} props
 */
export function CountRoll({ value }) {
  const text = value.toLocaleString('en-IN');
  const [st, setSt] = useState(
    /** @type {{ value: number, text: string, before: string | null, run: number, dir: 'up' | 'down', load: boolean }} */ ({
      value,
      text,
      before: null,
      run: 1,
      dir: 'up',
      load: true,
    }),
  );
  if (text !== st.text) {
    setSt({ value, text, before: st.text, run: st.run + 1, dir: value >= st.value ? 'up' : 'down', load: false });
  }

  // Digits that left the number stay just long enough to fold away.
  useEffect(() => {
    if (st.before === null) return undefined;
    const t = setTimeout(() => setSt((s) => (s.run === st.run ? { ...s, before: null } : s)), FOLD_MS + 60);
    return () => clearTimeout(t);
  }, [st.run, st.before]);

  const now = parse(st.text);
  const before = st.before ? parse(st.before) : null;
  const places = Math.max(now.length, before?.length ?? 0);
  const base = st.load ? LOAD_BASE_MS : BASE_MS;
  const cells = [];
  for (let p = places - 1; p >= 0; p--) {
    const live = now[now.length - 1 - p];
    const old = before?.[before.length - 1 - p];
    const k = now.length - 1 - p; // position from the left, among the digits that remain
    /** @type {Run | null} */
    const run = live
      ? { id: st.run, dir: st.load ? 'up' : st.dir, spin: st.load ? 1 : 0, ms: base + k * STEP_MS, from: old ? undefined : 0 }
      : null;
    const cell = live ?? old;
    cells.push(
      <Cell
        key={p}
        digit={cell?.d ?? 0}
        comma={Boolean(cell?.comma)}
        gone={!live}
        grow={!st.load && !old && st.before !== null}
        run={run}
      />,
    );
  }
  return (
    <span className="od" data-value={st.text} aria-hidden="true">
      {cells}
    </span>
  );
}
