// PARKED: this record player is not shown in the app at the moment (it is commented out in MeetupPage.jsx).
// It is kept here, complete and tested, so it can be switched back on. See the notes in MeetupPage.jsx and src/data/meetup.js.
import { useCallback, useEffect, useRef, useState } from 'react';

// The drawing is 320 x 220. The record is centred on (130, 110); the tonearm turns about its pivot at (284, 44).
const CX = 130;
const CY = 110;
const PIVOT_X = 284;
const PIVOT_Y = 44;
const ARM_ON = 15; // degrees from rest: the needle on the outer groove
const ARM_SPAN = 14.1; // further turn to the inner groove at the end of the song
const SPIN = 200; // degrees a second (33 rpm is 198)

const mmss = (/** @type {number} */ seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Grooves: thin rings across the record. */
const GROOVES = [88, 82, 76, 70, 64, 58, 52, 46];

/**
 * A mini record player seen from above: a record that spins, a tonearm that swings onto it and creeps inwards as the song
 * plays, and a play / pause button. The song starts only from a tap (browsers do not allow sound to start by itself), and
 * stops when the player leaves the screen.
 *
 * @param {{ song: { src: string, cover: string, title: string, artist: string } }} props
 */
export default function RecordPlayer({ song }) {
  const audio = useRef(/** @type {HTMLAudioElement | null} */ (null));
  const disc = useRef(/** @type {SVGGElement | null} */ (null));
  const arm = useRef(/** @type {SVGGElement | null} */ (null));
  const bar = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const motion = useRef({ angle: 0, speed: 0, arm: 0, last: 0, frame: 0, shownAt: 0 });
  const playingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ now: 0, total: 0 });
  const [failed, setFailed] = useState(false);
  const still = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const draw = useCallback(() => {
    const m = motion.current;
    disc.current?.setAttribute('transform', `rotate(${m.angle.toFixed(2)} ${CX} ${CY})`);
    arm.current?.setAttribute('transform', `rotate(${m.arm.toFixed(2)} ${PIVOT_X} ${PIVOT_Y})`);
  }, []);

  const progress = () => {
    const a = audio.current;
    return a && a.duration > 0 ? Math.min(1, a.currentTime / a.duration) : 0;
  };

  /** One animation frame: the record speeds up or slows down smoothly, the arm follows the song's progress. */
  const tickRef = useRef(/** @type {(now: number) => void} */ (() => {}));
  const loop = useCallback((/** @type {number} */ now) => tickRef.current(now), []);
  useEffect(() => {
    tickRef.current = (/** @type {number} */ now) => {
      const m = motion.current;
      const dt = Math.min(0.05, m.last ? (now - m.last) / 1000 : 0.016);
      m.last = now;
      const on = playingRef.current;
      const p = progress();
      const speedGoal = on && !still.current ? SPIN : 0;
      m.speed += (speedGoal - m.speed) * (1 - Math.exp(-dt / (on ? 0.35 : 0.45)));
      m.angle = (m.angle + m.speed * dt) % 360;
      const armGoal = on ? ARM_ON + ARM_SPAN * p : 0;
      m.arm += (armGoal - m.arm) * (1 - Math.exp(-dt / 0.3));
      draw();
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      if (now - m.shownAt > 250) {
        m.shownAt = now;
        const a = audio.current;
        if (a) setTime({ now: a.currentTime, total: a.duration || 0 });
      }
      const settled = !on && m.speed < 0.5 && Math.abs(m.arm - armGoal) < 0.05;
      m.frame = settled ? 0 : requestAnimationFrame(loop);
      if (settled) m.last = 0;
    };
  }, [draw, loop]);

  const run = useCallback(() => {
    if (!motion.current.frame) motion.current.frame = requestAnimationFrame(loop);
  }, [loop]);

  const setOn = useCallback(
    (/** @type {boolean} */ on) => {
      playingRef.current = on;
      setPlaying(on);
      run();
    },
    [run],
  );

  const toggle = async () => {
    if (!audio.current) {
      const a = new Audio();
      a.preload = 'metadata';
      a.src = song.src;
      a.addEventListener('ended', () => {
        a.currentTime = 0;
        setOn(false);
      });
      a.addEventListener('pause', () => {
        if (!a.ended) setOn(false);
      });
      a.addEventListener('loadedmetadata', () => setTime((t) => ({ ...t, total: a.duration || 0 })));
      audio.current = a;
    }
    const a = audio.current;
    if (a.paused) {
      try {
        setFailed(false);
        await a.play();
        setOn(true);
      } catch {
        setFailed(true);
        setOn(false);
      }
    } else {
      a.pause();
    }
  };

  // Stops and lets go of the song when the player leaves the screen (the sheet is closed) or the page is hidden.
  useEffect(() => {
    const m = motion.current;
    const hide = () => document.hidden && audio.current && !audio.current.paused && audio.current.pause();
    document.addEventListener('visibilitychange', hide);
    draw();
    return () => {
      document.removeEventListener('visibilitychange', hide);
      cancelAnimationFrame(m.frame);
      if (audio.current) {
        audio.current.pause();
        audio.current.removeAttribute('src');
        audio.current.load();
        audio.current = null;
      }
    };
  }, [draw]);

  return (
    <section className="mu-player" aria-label={`Song: ${song.title} by ${song.artist}`} data-testid="mu-player" data-playing={playing}>
      {/* The picture is a tap shortcut for people using a finger or mouse; the play button below is the real control. */}
      <div className="mu-deck" aria-hidden="true" onClick={toggle} data-testid="mu-deck">
        <svg viewBox="0 0 320 220" focusable="false">
          <defs>
            <linearGradient id="mu-case" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#cf7040" />
              <stop offset="1" stopColor="#a8501f" />
            </linearGradient>
            <radialGradient id="mu-vinyl" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0.35" stopColor="#1b1b1f" />
              <stop offset="1" stopColor="#0c0c0e" />
            </radialGradient>
            <linearGradient id="mu-sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.16" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id="mu-label">
              <circle cx={CX} cy={CY} r="34" />
            </clipPath>
          </defs>
          <rect x="0" y="0" width="320" height="220" rx="22" fill="url(#mu-case)" />
          <rect
            x="3"
            y="3"
            width="314"
            height="214"
            rx="19"
            fill="none"
            stroke="#f6d9c4"
            strokeOpacity="0.55"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <rect x="12" y="12" width="296" height="196" rx="14" fill="#1a191b" />
          <circle cx={CX} cy={CY} r="96" fill="#262527" />
          <g ref={disc}>
            <circle cx={CX} cy={CY} r="92" fill="url(#mu-vinyl)" />
            {GROOVES.map((r) => (
              <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="#fff" strokeOpacity="0.07" />
            ))}
            <path d={`M${CX} ${CY} L${CX - 70} ${CY - 56} A90 90 0 0 1 ${CX - 20} ${CY - 88} Z`} fill="url(#mu-sheen)" />
            <path d={`M${CX} ${CY} L${CX + 70} ${CY + 56} A90 90 0 0 1 ${CX + 20} ${CY + 88} Z`} fill="url(#mu-sheen)" />
            <circle cx={CX} cy={CY} r="36" fill="#d94a2b" />
            <image
              href={song.cover}
              x={CX - 34}
              y={CY - 34}
              width="68"
              height="68"
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#mu-label)"
            />
            <circle cx={CX} cy={CY} r="34" fill="none" stroke="#000" strokeOpacity="0.25" />
            <circle cx={CX} cy={CY} r="4" fill="#d9dce1" />
            <circle cx={CX} cy={CY} r="1.6" fill="#6b6f76" />
          </g>
          {/* A knob and the pivot base */}
          <circle cx="278" cy="186" r="9" fill="#2c2b2e" stroke="#555" strokeWidth="1" />
          <rect x="274" y="180" width="8" height="2.5" rx="1.2" fill="#c9ccd1" />
          <circle cx={PIVOT_X} cy={PIVOT_Y} r="15" fill="#2c2b2e" stroke="#6b6f76" strokeWidth="1.5" />
          {/* The tonearm, drawn at rest and turned about its pivot */}
          <g ref={arm}>
            <line x1={PIVOT_X} y1={PIVOT_Y} x2="225.6" y2="190.8" stroke="#c9ccd1" strokeWidth="4" strokeLinecap="round" />
            <line x1={PIVOT_X} y1={PIVOT_Y} x2="227" y2="187" stroke="#8c9097" strokeWidth="1" strokeLinecap="round" />
            <rect x="267" y="22" width="14" height="22" rx="4" fill="#3a393c" transform={`rotate(-18 ${PIVOT_X} ${PIVOT_Y})`} />
            <g transform="translate(225.6 190.8) rotate(21.8)">
              <rect x="-6" y="-4" width="12" height="22" rx="3" fill="#111113" />
              <rect x="-3" y="14" width="6" height="7" rx="1.5" fill="#e03b2e" />
            </g>
            <circle cx={PIVOT_X} cy={PIVOT_Y} r="7" fill="#d9dce1" />
          </g>
        </svg>
      </div>
      <div className="mu-song">
        <button
          type="button"
          className={`mu-play${playing ? ' on' : ''}`}
          aria-pressed={playing}
          aria-label={playing ? 'Pause the song' : 'Play the song'}
          onClick={toggle}
          data-testid="mu-play"
        >
          {playing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4.2" height="14" rx="1.2" />
              <rect x="13.8" y="5" width="4.2" height="14" rx="1.2" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10-6.5a1 1 0 0 0 0-1.72l-10-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
          )}
        </button>
        <span className="mu-meta2">
          <b>{song.title}</b>
          <span>{failed ? "Couldn't play the song. Tap to try again." : song.artist}</span>
        </span>
        <span className="num mu-time" aria-hidden="true">
          {mmss(time.now)} / {mmss(time.total)}
        </span>
      </div>
      <span className="mu-track" aria-hidden="true">
        <span ref={bar} className="mu-track-fill" />
      </span>
    </section>
  );
}
