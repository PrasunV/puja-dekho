import { animate, motion, useMotionValue } from 'motion/react';
import { activeSheetMotion, reportSheetGesture } from './sheetMotion.js';
import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const SHEET_STATES = /** @type {const} */ (['peek', 'initial', 'half', 'full']);

/** Doc 01: peek 12%, list 35%, detail 57%, full 85% (the top 15% of the map stays in view, so the header and chips stay reachable). */
const SHARE = { peek: 0.12, initial: 0.35, half: 0.57, full: 0.85 };

/** People who ask for less motion get a short, plain ease instead of whatever motion style is chosen. */
const REDUCED = { duration: 0.18, ease: /** @type {const} */ ('easeOut') };

/** A touch has to move this far before we decide what the gesture is. */
const DECIDE_PX = 6;
/** The finger speed only counts if it was still moving this recently. */
const STALE_MS = 80;
/** Past either end the sheet follows the finger with growing resistance and never travels further than this. */
const RUBBER_PX = 100;
/** A click this soon after a drag ended is the drag's own tail, not a tap. */
const SWALLOW_MS = 100;

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const rubber = (/** @type {number} */ over) => RUBBER_PX * (1 - 1 / ((over * 0.55) / RUBBER_PX + 1));
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The four heights for a stage of this height.
 * @param {number} stage
 */
const snapsFor = (stage, floor = 0) => {
  // Larger text (Android font size, iOS Dynamic Type) makes the title and the pinned buttons taller. The resting
  // heights never go below `floor` (the buttons plus the title block), so something is always readable above them.
  const full = stage * SHARE.full;
  const initial = Math.min(Math.max(stage * SHARE.initial, floor), stage * SHARE.half);
  const half = Math.min(Math.max(stage * SHARE.half, initial + 56), full - 56);
  return { peek: stage * SHARE.peek, initial, half: Math.max(half, initial), full };
};
/** The title block, handle and breathing room that must stay visible above the pinned buttons. */
const HANDLE_PX = 28;
/** A little of whatever follows the title, so it is clear the sheet continues. */
const PEEK_NEXT_PX = 56;
/** A title block taller than this (a very long name at the largest text) is not allowed to claim the whole sheet. */
const TITLE_MAX_PX = 260;

/**
 * The list panel. A draggable bottom sheet on phones with three snap points; a fixed side panel on desktop.
 * At the peek only `peek` shows (one line). Above it `children` scroll and `footer` stays pinned at the bottom.
 *
 * @param {object} props
 * @param {'peek' | 'initial' | 'half' | 'full'} props.sheet
 * @param {(s: 'peek' | 'initial' | 'half' | 'full') => void} props.onSheetChange
 * @param {boolean} props.desktop
 * @param {React.ReactNode} props.peek  The one line shown at the peek
 * @param {React.ReactNode} [props.footer]  Buttons pinned at the bottom
 * @param {React.ReactNode} props.children
 */
export default function BottomSheet({ sheet, onSheetChange, desktop, peek, footer, children }) {
  if (desktop) {
    return (
      <section className="panel" data-sheet={sheet}>
        <button type="button" className="grab" aria-label="Resize panel" tabIndex={-1}>
          <span />
        </button>
        <div className="panel-body">{children}</div>
        {footer && <div className="panel-foot">{footer}</div>}
      </section>
    );
  }
  return (
    <PhoneSheet sheet={sheet} onSheetChange={onSheetChange} peek={peek} footer={footer}>
      {children}
    </PhoneSheet>
  );
}

/**
 * The phone sheet. The whole panel is the handle: a vertical drag that starts anywhere on it, in any state, moves it.
 *
 * - Where it lands: the release velocity is projected 220 ms ahead and the sheet settles on the nearest of the three
 *   heights to that point. A slow drag settles on the nearest; a fast, short flick jumps a state.
 * - How it moves: a height motion value driven by a slightly under-damped spring, with rubber-banding past the peek
 *   and the full height.
 * - Scrolling: at full height the list scrolls natively. A downward drag that starts with the list at its top, or
 *   reaches its top mid-gesture, takes the sheet down. Below full height the sheet takes the drag first and hands
 *   any extra travel to the list once it is fully open.
 * - Direction: a drag that begins mostly sideways (a carousel) is left to the carousel. The angle of the first few
 *   pixels decides, and it never changes.
 *
 * Every frame it writes `--sheet-h` (height above the bottom of the map, px) onto the map buttons and the people pill,
 * so they follow it without React re-rendering. `data-sheet` on the
 * panel is the committed state and changes the moment a drag is released.
 */
function PhoneSheet({ sheet, onSheetChange, peek, footer, children }) {
  const panelRef = useRef(/** @type {HTMLElement | null} */ (null));
  const bodyRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const height = useMotionValue(0);
  const [ready, setReady] = useState(false);
  // True while a drag or the settling spring is running: the peek line stays mounted so it can fade out.
  const [moving, setMovingState] = useState(false);
  // Everything the gesture code needs, kept out of React state so nothing re-renders mid-drag.
  const live = useRef({
    sheet,
    onSheetChange,
    stage: 0,
    floor: 0,
    bottom: 0,
    target: sheet,
    anim: /** @type {ReturnType<typeof animate> | null} */ (null),
    moving: false,
    swallowUntil: 0,
    goTo: /** @type {((state: 'peek' | 'initial' | 'half' | 'full', velocity?: number) => void) | null} */ (null),
  });
  useEffect(() => {
    live.current.sheet = sheet;
    live.current.onSheetChange = onSheetChange;
  });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const stage = /** @type {HTMLElement | null} */ (panel?.offsetParent ?? null);
    if (!panel || !stage) return undefined;
    const L = live.current;

    const snaps = () => snapsFor(L.stage, L.floor);
    /** The pinned buttons' height, plus the title block. Read here, never per frame. */
    const readFloor = () => {
      const foot = /** @type {HTMLElement | null} */ (panel.querySelector('.panel-foot'));
      const title = /** @type {HTMLElement | null} */ (panel.querySelector('[data-sheet-head]'));
      const titleH = Math.min(title ? title.offsetHeight : 0, TITLE_MAX_PX);
      return (foot ? foot.offsetHeight : 0) + HANDLE_PX + titleH + PEEK_NEXT_PX;
    };
    const measure = () => {
      L.stage = stage.clientHeight;
      L.floor = readFloor();
      L.bottom = parseFloat(getComputedStyle(panel).bottom) || 0;
    };
    /**
     * What the rest of the screen reads, written straight onto the few elements that use it. Nothing is set on the
     * stage or the panel: a custom property there would make the browser re-check every card in the list each frame.
     */
    const publish = (/** @type {number} */ h) => {
      const s = snaps();
      const toFull = clamp01((h - s.half) / (s.full - s.half));
      const fromPeek = clamp01((h - s.peek) / (s.half - s.peek));
      for (const el of /** @type {HTMLElement[]} */ (Array.from(stage.children))) {
        if (el.classList.contains('map-tools') || el.classList.contains('view-pill') || el.classList.contains('show-kolkata')) {
          el.style.setProperty('--sheet-h', `${h + L.bottom}px`);
          if (!el.classList.contains('view-pill')) el.style.opacity = String(clamp01(1 - toFull * 2.5));
        }
      }
      // The peek line fades out over the first third of the way to half; the list and footer fade in behind it.
      for (const el of /** @type {HTMLElement[]} */ (Array.from(panel.children))) {
        if (el.classList.contains('peek-line')) el.style.opacity = String(clamp01(1 - fromPeek * 3));
        else if (el.classList.contains('panel-body') || el.classList.contains('panel-foot'))
          el.style.opacity = String(clamp01((fromPeek - 0.12) * 3));
      }
    };
    const setMoving = (/** @type {boolean} */ on) => {
      L.moving = on;
      setMovingState(on);
      panel.toggleAttribute('data-moving', on);
      stage.toggleAttribute('data-sheet-full', !on && L.target === 'full');
    };
    /** Spring to a state. `velocity` is px per second, positive when the sheet is rising. */
    const goTo = (/** @type {'peek' | 'initial' | 'half' | 'full'} */ state, velocity = 0) => {
      L.target = state;
      L.anim?.stop();
      setMoving(true);
      const to = snaps()[state];
      const m = activeSheetMotion();
      const how = reducedMotion()
        ? REDUCED
        : m.kind === 'spring'
          ? { type: /** @type {const} */ ('spring'), ...m.spring, velocity }
          : { type: /** @type {const} */ ('tween'), duration: m.duration, ease: m.ease };
      const startedAt = performance.now();
      const run = animate(height, to, how);
      L.anim = run;
      run.then(() => {
        if (L.anim !== run) return;
        L.anim = null;
        height.set(snaps()[L.target]);
        setMoving(false);
        reportSheetGesture({ what: `settled (${m.label})`, to: state, ms: Math.round(performance.now() - startedAt) });
      });
    };
    live.current.goTo = goTo;

    measure();
    height.set(snaps()[L.sheet]);
    publish(height.get());
    setMoving(false);
    setReady(true);
    const off = height.on('change', publish);
    // The people pill and the map buttons can arrive after the sheet has settled (they wait on data): give them the height too.
    const arrivals = new MutationObserver(() => publish(height.get()));
    arrivals.observe(stage, { childList: true });

    // A rotation or a keyboard resizes the map: jump to the same state at the new size.
    const relayout = () => {
      if (stage.clientHeight === L.stage && readFloor() === L.floor) return;
      measure();
      L.anim?.stop();
      L.anim = null;
      height.set(snaps()[L.target]);
      setMoving(false);
    };
    const watcher = new ResizeObserver(relayout);
    watcher.observe(stage);
    // The pinned buttons change height when text grows or wraps, or when they come and go (list to details).
    const footWatcher = new ResizeObserver(relayout);
    const watchFoot = () => {
      footWatcher.disconnect();
      const foot = panel.querySelector('.panel-foot');
      if (foot) footWatcher.observe(foot);
    };
    watchFoot();
    const footArrivals = new MutationObserver(watchFoot);
    footArrivals.observe(panel, { childList: true });

    /* ---- the gesture ---- */
    /** @type {null | { x0: number, y0: number, lastY: number, mode: 'undecided' | 'sheet' | 'content' | 'ignore', inBody: boolean, sideways: boolean, raw: number, samples: { t: number, y: number }[] }} */
    let g = null;
    let lastTouchAt = 0;
    const body = () => bodyRef.current;

    const horizontalScrollerAt = (/** @type {Element | null} */ el) => {
      for (let n = el; n && n !== panel; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 1) {
          const overflow = getComputedStyle(n).overflowX;
          if (overflow === 'auto' || overflow === 'scroll') return n;
        }
      }
      return null;
    };

    const begin = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ t, /** @type {EventTarget | null} */ target) => {
      const el = target instanceof Element ? target : null;
      if (el?.closest('input, textarea, select, [contenteditable], [data-no-sheet-drag]')) return false;
      g = {
        x0: x,
        y0: y,
        lastY: y,
        mode: 'undecided',
        inBody: !!(el && body()?.contains(el)),
        sideways: !!horizontalScrollerAt(el),
        raw: 0,
        samples: [{ t, y }],
      };
      return true;
    };

    /** The sheet takes the gesture from this finger position on. */
    const takeOver = (/** @type {number} */ fromY) => {
      if (!g) return;
      g.mode = 'sheet';
      g.lastY = fromY;
      L.anim?.stop();
      L.anim = null;
      g.raw = height.get();
      setMoving(true);
      // The list must not scroll under a finger that is moving the sheet.
      const list = body();
      if (list) list.style.overflowY = 'hidden';
    };

    /** Move the sheet (and, past the top, the list) by how far the finger moved. Down is positive. */
    const applyStep = (/** @type {number} */ step) => {
      if (!g) return;
      const { peek: min, full: max } = snaps();
      const list = body();
      let raw = g.raw;
      if (step < 0) {
        let up = -step;
        if (raw < max) {
          const take = Math.min(up, max - raw);
          raw += take;
          up -= take;
        }
        if (up > 0) {
          if (g.inBody && list && list.scrollHeight - list.clientHeight > 1) {
            // Fully open: whatever travel is left scrolls the list.
            list.scrollTop = Math.min(list.scrollTop + up, list.scrollHeight - list.clientHeight);
          } else raw += up;
        }
      } else {
        let down = step;
        if (raw >= max && g.inBody && list && list.scrollTop > 0) {
          const take = Math.min(down, list.scrollTop);
          list.scrollTop -= take;
          down -= take;
        }
        raw -= down;
      }
      g.raw = raw;
      height.set(raw > max ? max + rubber(raw - max) : raw < min ? min - rubber(min - raw) : raw);
    };

    const move = (/** @type {number} */ x, /** @type {number} */ y, /** @type {Event} */ e) => {
      if (!g) return;
      const now = e.timeStamp;
      g.samples.push({ t: now, y });
      while (g.samples.length > 2 && now - g.samples[0].t > 100) g.samples.shift();

      if (g.mode === 'undecided') {
        const dx = x - g.x0;
        const dy = y - g.y0;
        if (Math.hypot(dx, dy) < DECIDE_PX) return;
        // The angle of the first movement decides. Over a carousel it must be steeper than 45 degrees to be ours;
        // anywhere else only a nearly flat swipe is not.
        const vertical = g.sideways ? Math.abs(dy) > Math.abs(dx) : Math.abs(dx) < Math.abs(dy) * 2.5;
        if (!vertical) {
          g.mode = 'ignore';
          reportSheetGesture({ what: 'left to the carousel (sideways swipe)' });
          return;
        }
        const list = body();
        const atFull = height.get() >= snaps().full - 1;
        if (g.inBody && atFull && list && (dy < 0 || list.scrollTop > 0)) {
          // Fully open and the list has somewhere to go: let it scroll. We step in if it comes back to the top.
          g.mode = 'content';
          reportSheetGesture({ what: 'list is scrolling (sheet is full)' });
          g.lastY = y;
          return;
        }
        takeOver(g.y0);
      } else if (g.mode === 'content') {
        const list = body();
        const step = y - g.lastY;
        g.lastY = y;
        if (step > 0 && list && list.scrollTop <= 0) takeOver(y);
        else return;
      }
      if (g.mode !== 'sheet') return;
      applyStep(y - g.lastY);
      g.lastY = y;
      if (e.cancelable) e.preventDefault();
    };

    /** Finger velocity as sheet velocity: px per ms, positive when the sheet is rising. */
    const releaseVelocity = (/** @type {number} */ now) => {
      if (!g) return 0;
      const first = g.samples[0];
      const last = g.samples[g.samples.length - 1];
      if (now - last.t > STALE_MS || g.samples.length < 2) return 0;
      // Never divide by less than a frame: two events a hair apart say nothing about speed.
      return Math.max(-4, Math.min(4, -(last.y - first.y) / Math.max(last.t - first.t, 12)));
    };

    const settle = (/** @type {number} */ v) => {
      const style = activeSheetMotion();
      const s = snaps();
      const h = height.get();
      const states = /** @type {const} */ ([
        ['peek', s.peek],
        ['initial', s.initial],
        ['half', s.half],
        ['full', s.full],
      ]);
      const nearest = (/** @type {number} */ at) => states.reduce((a, b) => (Math.abs(b[1] - at) < Math.abs(a[1] - at) ? b : a));
      let pick = nearest(h + v * style.projectMs);
      // A quick flick always goes at least to the next state in its direction.
      if (Math.abs(v) >= style.flickV) {
        const ahead = v > 0 ? states.find(([, px]) => px > h + 4) : [...states].reverse().find(([, px]) => px < h - 4);
        if (ahead && (v > 0 ? states.indexOf(pick) < states.indexOf(ahead) : states.indexOf(pick) > states.indexOf(ahead))) pick = ahead;
      }
      const state = pick[0];
      goTo(state, v * 1000);
      reportSheetGesture({ what: `released from ${Math.round(h)}px`, v: v.toFixed(2), to: state });
      // Telling the app is a low-priority update: re-rendering the whole screen must not stall the first frames of the settle.
      if (state !== L.sheet) startTransition(() => L.onSheetChange(state));
    };

    const end = (/** @type {boolean} */ cancelled, /** @type {number} */ at = performance.now()) => {
      if (!g) return;
      const done = g;
      const v = cancelled ? 0 : releaseVelocity(at);
      const list = body();
      if (list) list.style.overflowY = '';
      if (done.mode === 'sheet') {
        L.swallowUntil = performance.now() + SWALLOW_MS;
        g = null;
        settle(v);
      } else {
        if (done.mode === 'undecided') reportSheetGesture({ what: cancelled ? 'touch cancelled' : 'tap (no drag)' });
        g = null;
      }
    };

    // Touch: native listeners, because the move handler must be able to cancel the page's own scrolling.
    const onTouchStart = (/** @type {TouchEvent} */ e) => {
      lastTouchAt = performance.now();
      if (e.touches.length > 1) {
        end(true);
        g = null;
        return;
      }
      begin(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp, e.target);
    };
    const onTouchMove = (/** @type {TouchEvent} */ e) => {
      if (e.touches.length > 1) return end(true);
      move(e.touches[0].clientX, e.touches[0].clientY, e);
    };
    const onTouchEnd = (/** @type {TouchEvent} */ e) => {
      if (e.touches.length === 0) end(false, e.timeStamp);
    };
    const onTouchCancel = () => end(true);
    // Mouse: the same gesture, for a narrow desktop window.
    const onMouseMove = (/** @type {MouseEvent} */ e) => move(e.clientX, e.clientY, e);
    const onMouseUp = (/** @type {MouseEvent} */ e) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      end(false, e.timeStamp);
    };
    const onMouseDown = (/** @type {MouseEvent} */ e) => {
      if (e.button !== 0 || performance.now() - lastTouchAt < 700) return;
      if (!begin(e.clientX, e.clientY, e.timeStamp, e.target)) return;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };
    // A click that is only the tail of a drag must not press the button the finger happened to be over.
    const onClickCapture = (/** @type {MouseEvent} */ e) => {
      if (performance.now() < L.swallowUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('touchend', onTouchEnd);
    panel.addEventListener('touchcancel', onTouchCancel);
    panel.addEventListener('mousedown', onMouseDown);
    panel.addEventListener('click', onClickCapture, true);
    return () => {
      off();
      arrivals.disconnect();
      watcher.disconnect();
      footWatcher.disconnect();
      footArrivals.disconnect();
      L.anim?.stop();
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
      panel.removeEventListener('touchcancel', onTouchCancel);
      panel.removeEventListener('mousedown', onMouseDown);
      panel.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      stage.removeAttribute('data-sheet-full');
    };
  }, [height]);

  // A change that did not come from a drag (a tap on the handle, opening a puja) springs to the new height.
  useEffect(() => {
    const L = live.current;
    if (L.goTo && L.target !== sheet) L.goTo(sheet);
  }, [sheet]);

  const cycle = () => onSheetChange(SHEET_STATES[(SHEET_STATES.indexOf(sheet) + 1) % SHEET_STATES.length]);
  return (
    <motion.section ref={panelRef} className="panel" data-sheet={sheet} style={ready ? { height } : undefined}>
      <button type="button" className="grab" aria-label={sheet === 'peek' ? 'Open list' : 'Resize panel'} onClick={cycle}>
        <span />
      </button>
      <button
        type="button"
        className="peek-line"
        aria-hidden={sheet !== 'peek'}
        // Out of the tab order and the accessibility tree while the list is open (React 18 needs the empty string).
        {...(sheet !== 'peek' && !moving ? { inert: '' } : {})}
        tabIndex={sheet === 'peek' ? 0 : -1}
        onClick={() => onSheetChange('initial')}
      >
        {(sheet === 'peek' || moving) && peek}
      </button>
      <div ref={bodyRef} className="panel-body" {...(sheet === 'peek' && !moving ? { inert: '' } : {})}>
        {children}
      </div>
      {footer && (
        <div className="panel-foot" {...(sheet === 'peek' && !moving ? { inert: '' } : {})}>
          {footer}
        </div>
      )}
    </motion.section>
  );
}
