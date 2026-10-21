import { useEffect, useRef, useState } from 'react';
import { LOAD_BUDGET_MS, claimGreeting, loadGreeting, markGreeted } from './greetings.js';

/** Let the sheet finish sliding in before the animation starts. */
const START_AFTER_MS = 350;

/**
 * The festival greeting, in place of a sheet's round icon. Only the first sheet of an open gets it (see
 * claimGreeting); any other sheet, a phone that has seen it enough, or the installed app just shows `fallback`.
 * Until the animation is ready a shimmer box of exactly its shape holds the space, so nothing moves when it
 * arrives. It plays once and holds its last frame. If it has not loaded within the budget the box folds away and
 * the normal icon takes its place; that open is not counted. With reduced motion it shows the last frame.
 *
 * @param {{ slot: string, fallback: import('react').ReactNode }} props
 */
export default function GreetingMedia({ slot, fallback }) {
  const [claim] = useState(() => claimGreeting(slot));
  if (!claim) return <>{fallback}</>;
  if (claim.greeting.kind === 'image') return <StillGreeting greeting={claim.greeting} forced={claim.forced} fallback={fallback} />;
  return <Player greeting={claim.greeting} forced={claim.forced} fallback={fallback} />;
}

/**
 * A still greeting (a picture, not an animation): the shimmer holds the space, the picture fades in once it has loaded and
 * decoded, and it stays. Not loaded within the budget: the box folds away and the normal icon takes over (not counted).
 * @param {{ greeting: import('./greetings.js').Greeting, forced: boolean, fallback: import('react').ReactNode }} props
 */
function StillGreeting({ greeting, forced, fallback }) {
  const [phase, setPhase] = useState(/** @type {'loading' | 'still' | 'gone'} */ ('loading'));
  useEffect(() => {
    let cancelled = false;
    const give = setTimeout(() => setPhase((p) => (p === 'loading' ? 'gone' : p)), LOAD_BUDGET_MS);
    loadGreeting(greeting).then(
      () => !cancelled && setPhase((p) => (p === 'loading' ? 'still' : p)),
      () => !cancelled && setPhase('gone'),
    );
    return () => {
      cancelled = true;
      clearTimeout(give);
    };
  }, [greeting]);
  // Counted once it is really on screen, not for a failed load.
  useEffect(() => {
    if (phase === 'still' && !forced) markGreeted(greeting.id);
  }, [phase, forced, greeting.id]);
  return (
    <>
      <div className={`greet${phase === 'gone' ? ' gone' : ''}`} data-phase={phase} aria-hidden={phase === 'gone' || undefined}>
        <div className="greet-fold">
          <div
            className="greet-box"
            role="img"
            aria-label={greeting.label}
            style={{ aspectRatio: `${greeting.width} / ${greeting.height}` }}
          >
            <div className={`greet-shimmer${phase === 'still' ? ' off' : ''}`} />
            <img className="greet-image" src={greeting.file} alt="" data-shown={phase === 'still' || undefined} draggable={false} />
          </div>
        </div>
      </div>
      {phase === 'gone' && <div className="greet-fallback">{fallback}</div>}
    </>
  );
}

/** @param {{ greeting: import('./greetings.js').Greeting, forced: boolean, fallback: import('react').ReactNode }} props */
function Player({ greeting, forced, fallback }) {
  const canvas = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const [phase, setPhase] = useState(/** @type {'loading' | 'ready' | 'playing' | 'still' | 'gone'} */ ('loading'));
  const player = useRef(/** @type {any} */ (null));

  // Load the engine and the animation, and give up after the budget.
  useEffect(() => {
    let cancelled = false;
    const give = setTimeout(() => setPhase((p) => (p === 'loading' ? 'gone' : p)), LOAD_BUDGET_MS);
    loadGreeting(greeting).then(
      ({ DotLottie, buffer }) => {
        const el = canvas.current;
        if (cancelled || !el) return;
        const rect = el.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        el.width = Math.round(rect.width * dpr);
        el.height = Math.round(rect.height * dpr);
        const anim = new DotLottie({
          canvas: el,
          data: buffer.slice(0), // the player takes what it is given
          autoplay: false,
          loop: false,
          renderConfig: { devicePixelRatio: dpr, autoResize: true },
          layout: { fit: 'contain', align: [0.5, 0.5] },
        });
        player.current = anim;
        // Past the budget the box has already folded away: stay folded rather than pop back.
        anim.addEventListener('load', () => !cancelled && setPhase((p) => (p === 'loading' ? 'ready' : p)));
        anim.addEventListener('complete', () => !cancelled && setPhase((p) => (p === 'playing' ? 'still' : p)));
        anim.addEventListener('loadError', () => !cancelled && setPhase('gone'));
      },
      () => !cancelled && setPhase('gone'),
    );
    return () => {
      cancelled = true;
      clearTimeout(give);
      player.current?.destroy();
      player.current = null;
    };
  }, [greeting]);

  // Start once it is ready and the sheet has settled.
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const t = setTimeout(() => {
      const anim = player.current;
      if (!anim) return;
      if (!forced) markGreeted(greeting.id);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        anim.setFrame(anim.totalFrames - 1);
        setPhase('still');
      } else {
        anim.play();
        setPhase('playing');
      }
    }, START_AFTER_MS);
    return () => clearTimeout(t);
  }, [phase, forced, greeting.id]);

  const shown = phase === 'playing' || phase === 'still';
  // Once it has finished, a tap plays it again (not counted as another open). Not with reduced motion, which only ever shows the last frame.
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canReplay = phase === 'still' && !reduced;
  const replay = () => {
    const anim = player.current;
    if (!anim || phase !== 'still') return;
    anim.setFrame(0);
    anim.play();
    setPhase('playing');
  };
  return (
    <>
      <div className={`greet${phase === 'gone' ? ' gone' : ''}`} data-phase={phase} aria-hidden={phase === 'gone' || undefined}>
        <div className="greet-fold">
          <div
            className="greet-box"
            role={canReplay ? 'button' : 'img'}
            aria-label={canReplay ? `${greeting.label}. Play again` : greeting.label}
            tabIndex={canReplay ? 0 : undefined}
            data-replay={canReplay || undefined}
            onClick={canReplay ? replay : undefined}
            onKeyDown={canReplay ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), replay()) : undefined}
            style={{ aspectRatio: `${greeting.width} / ${greeting.height}` }}
          >
            <div className={`greet-shimmer${shown ? ' off' : ''}`} />
            <canvas className="greet-canvas" ref={canvas} />
          </div>
        </div>
      </div>
      {phase === 'gone' && <div className="greet-fallback">{fallback}</div>}
    </>
  );
}
