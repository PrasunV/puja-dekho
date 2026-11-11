import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/ui/Icon.jsx';
import { storage } from '../lib/storage.js';
import { useBackClose } from './hooks.js';
import { badgeSvg, rareLine, RANKS } from './ranks.js';

/**
 * Drop 3 (design 9.4, the profile prototype): the fireworks celebration when a badge unlocks, then the share screen.
 * Both are full-screen on the light cream ground, in light and dark mode alike, so the badge colours stay true.
 */
export const SITE = 'puja-dekho.vercel.app/jagadhatripuja';
const SITE_URL = `https://${SITE}`;

// ---- Sound: "Firework Whistle Burst" by BudgetPixel AI (CC BY 4.0, credited in About) ----
export const SOUND_URL = '/jagadhatripuja/sounds/firework.mp3';
/** Five fireworks: where they burst (% of the screen) and when the rocket leaves (seconds). */
const FIREWORKS = [
  { x: 24, y: 20, t: 0, colors: ['#B31D24', '#FC8105', '#F2B705'] },
  { x: 76, y: 16, t: 0.35, colors: ['#DD2A7B', '#FC8105', '#B31D24'] },
  { x: 52, y: 30, t: 0.8, colors: ['#0B7A75', '#1A73E8', '#F2B705'] },
  { x: 18, y: 42, t: 1.2, colors: ['#FC8105', '#F2B705', '#DD2A7B'] },
  { x: 82, y: 38, t: 1.55, colors: ['#1A73E8', '#B31D24', '#FC8105'] },
];

/**
 * How the one sound file plays across the five fireworks. The file is trimmed so its whistle lasts as long as a rocket
 * rises (0.6 s) and its bang lands at BANG_AT, the moment the first burst opens on screen.
 *   rockets 1 and 3: the whole whistle and bang, from launch
 *   rockets 2, 4, 5: only the bang, quieter, as they burst, so the sky isn't a wall of whistles
 */
const BANG_AT = 0.6;
const PLAN = [
  { whole: true, gain: 0.85 },
  { whole: false, gain: 0.45 },
  { whole: true, gain: 0.6 },
  { whole: false, gain: 0.4 },
  { whole: false, gain: 0.5 },
];
/** A buzz on each burst (Android): bursts open at 0.6, 0.95, 1.4, 1.8 and 2.15 s. */
const BUZZ = [0, 600, 60, 290, 60, 390, 60, 340, 60, 290, 60];

/** @type {AudioContext | null} */
let ctx = null;
/** @type {Promise<AudioBuffer | null> | null} */
let buffer = null;

export const soundOn = () => storage.get('jg_sound', /** @type {boolean} */ (true)) !== false;

/**
 * Phones only play sound that starts from a tap. The "Are you visiting?" buttons call this, so the celebration that
 * follows a moment later may play. Nothing is downloaded until the person has tapped (17 KB).
 */
export function primeSound() {
  if (!soundOn()) return;
  try {
    const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!Ctx) return;
    ctx ??= new Ctx();
    ctx.resume?.().catch(() => {});
    const c = ctx;
    buffer ??= fetch(SOUND_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(
        (data) =>
          // Safari still wants the callback form.
          new Promise((resolve, reject) => {
            const p = c.decodeAudioData(data, resolve, reject);
            /** @type {any} */ (p)?.catch?.(() => {});
          }),
      )
      .catch(() => {
        buffer = null; // try again next time
        return null;
      });
  } catch {
    /* sound is a nice-to-have */
  }
}

/** The fireworks sound in step with the animation, and a buzz on Android. Falls back to a made-up whistle and bang. */
export async function playFireworks() {
  if (!soundOn()) return;
  try {
    navigator.vibrate?.(BUZZ);
  } catch {
    /* not on iPhone */
  }
  primeSound();
  const buf = buffer ? await buffer : null;
  if (!ctx || !buf) return synth();
  try {
    const c = ctx;
    await c.resume?.();
    const now = c.currentTime + 0.02;
    FIREWORKS.forEach((f, k) => {
      const plan = PLAN[k];
      const src = c.createBufferSource();
      const g = c.createGain();
      src.buffer = buf;
      g.gain.value = plan.gain;
      src.connect(g);
      g.connect(c.destination);
      // Whole sound from launch; bang only from its start, timed to the burst.
      if (plan.whole) src.start(now + f.t);
      else src.start(now + f.t + BANG_AT - 0.03, BANG_AT - 0.03);
    });
  } catch {
    synth();
  }
}

function synth() {
  try {
    const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!Ctx) return;
    ctx ??= new Ctx();
    const c = ctx;
    const now = c.currentTime;
    const noise = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    FIREWORKS.forEach((f, k) => {
      const t0 = now + f.t;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(900 + k * 60, t0);
      o.frequency.exponentialRampToValueAtTime(2300 + k * 80, t0 + 0.55);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(k === 0 ? 0.06 : 0.035, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.58);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + 0.6);
      const src = c.createBufferSource();
      const lp = c.createBiquadFilter();
      const bg = c.createGain();
      src.buffer = noise;
      lp.type = 'lowpass';
      lp.frequency.value = 1400 + k * 200;
      bg.gain.setValueAtTime(0.5, t0 + 0.6);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.7);
      src.connect(lp);
      lp.connect(bg);
      bg.connect(c.destination);
      src.start(t0 + 0.6);
      src.stop(t0 + 1.8);
    });
  } catch {
    /* sound is a nice-to-have */
  }
}

/** Badge markup from constants in ranks.js (never user input). */
function Badge({ i, size }) {
  return <span className="jg-cel-badge" dangerouslySetInnerHTML={{ __html: badgeSvg(i, { label: true, size }) }} />;
}

/** Keeps focus inside a full-screen layer and closes it with Escape. */
function useLayer(open, onClose) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  useBackClose(open, onClose);
  useEffect(() => {
    if (!open) return undefined;
    const back = /** @type {HTMLElement | null} */ (document.activeElement);
    ref.current?.querySelector(/** @type {any} */ ('[data-autofocus]'))?.focus();
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !ref.current) return;
      const f = [...ref.current.querySelectorAll('button:not([disabled]), a[href]')];
      if (!f.length) return;
      const first = /** @type {HTMLElement} */ (f[0]);
      const last = /** @type {HTMLElement} */ (f[f.length - 1]);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      back?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return ref;
}

/**
 * Full-screen fireworks: "E-Rank unlocked" / "Lantern Rookie!" / "5 pujas in one day", Share my badge, Not now.
 * @param {{ rank: number | null, total: number, onShare: () => void, onClose: () => void }} props
 */
export function Celebration({ rank, total, onShare, onClose }) {
  const open = rank != null;
  const ref = useLayer(open, onClose);
  const [sound, setSound] = useState(soundOn);
  const [h] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  useEffect(() => {
    if (open) playFireworks();
  }, [open]);
  if (!open) return null;
  const r = RANKS[rank];
  return createPortal(
    <div ref={ref} className="jg-cel" role="dialog" aria-modal="true" aria-label={`Badge unlocked. ${r.name}`}>
      <div className="jg-fw" aria-hidden="true">
        {FIREWORKS.map((f, fi) => (
          <span key={fi}>
            <span
              className="jg-rocket"
              style={
                /** @type {any} */ ({
                  left: `${f.x}%`,
                  top: `${f.y}%`,
                  '--from': `${Math.round(h * (1 - f.y / 100))}px`,
                  animationDelay: `${f.t}s`,
                })
              }
            />
            <span className="jg-sparks" style={{ left: `${f.x}%`, top: `${f.y}%` }}>
              <span
                className="jg-flash"
                style={{
                  background: `radial-gradient(circle, ${f.colors[0]}66 0%, rgba(255,255,255,0) 70%)`,
                  animationDelay: `${f.t + 0.6}s`,
                }}
              />
              {Array.from({ length: 16 }, (_, k) => {
                const ang = (k / 16) * Math.PI * 2 + fi * 0.3;
                const dist = (70 + (fi % 2) * 18) * (0.75 + ((k * 7) % 5) * 0.07);
                const col = f.colors[k % f.colors.length];
                return (
                  <i
                    key={k}
                    style={
                      /** @type {any} */ ({
                        '--dx': `${(Math.cos(ang) * dist).toFixed(1)}px`,
                        '--dy': `${(Math.sin(ang) * dist).toFixed(1)}px`,
                        background: col,
                        boxShadow: `0 0 6px ${col}`,
                        animationDelay: `${f.t + 0.6}s`,
                      })
                    }
                  />
                );
              })}
            </span>
          </span>
        ))}
      </div>
      <div className="jg-cel-top">
        <button
          type="button"
          className="jg-cel-mute"
          aria-label="Sound"
          aria-pressed={sound}
          onClick={() => {
            storage.set('jg_sound', !sound);
            setSound(!sound);
          }}
        >
          <Icon name={sound ? 'sound' : 'mute'} size={22} />
        </button>
      </div>
      <div className="jg-cel-main">
        <div className="jg-burst jg-pop">
          <svg className="jg-burst-rays" width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
            <path d={burstPath()} fill={r.c1} fillOpacity="0.12" />
          </svg>
          <Badge i={rank} size={170} />
        </div>
        <span className="jg-cel-kicker jg-rise d1" style={{ color: r.c1 }}>
          {`${r.id}-Rank unlocked`}
        </span>
        <h2 className="jg-cel-name jg-rise d1">{`${r.name}!`}</h2>
        <span className="jg-cel-rare jg-rise d2">{rareLine(rank, total)}</span>
      </div>
      <div className="jg-cel-foot jg-rise d3">
        <button type="button" className="jg-big" data-autofocus onClick={onShare}>
          Share my badge
        </button>
        <button type="button" className="jg-ghost" onClick={onClose}>
          Not now
        </button>
      </div>
    </div>,
    document.body,
  );
}

function burstPath() {
  const out = [];
  for (let b = 0; b < 12; b++) {
    const a1 = (b / 12) * Math.PI * 2;
    const a2 = a1 + Math.PI / 24;
    out.push(
      `M110 110L${(110 + 110 * Math.cos(a1)).toFixed(1)} ${(110 + 110 * Math.sin(a1)).toFixed(1)}L${(110 + 110 * Math.cos(a2)).toFixed(1)} ${(110 + 110 * Math.sin(a2)).toFixed(1)}Z`,
    );
  }
  return out.join('');
}

// ---- Share image, drawn on the phone ----
const INK = '#2B1214';
const FONT = "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif";

function wrap(/** @type {CanvasRenderingContext2D} */ c, /** @type {string} */ text, /** @type {number} */ max) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (c.measureText(t).width > max && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function loadBadge(/** @type {number} */ i, /** @type {number} */ size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg(i, { label: true, size }))}`;
  });
}

/**
 * The share card as a JPEG (about a tenth of the PNG size, for festival-night networks): 'story' 1080 × 1920 for Instagram and Save, 'wide' 1200 × 630 for other apps.
 * @param {{ kind: 'story' | 'wide', rank: number, total: number, me: { name: string, initials: string } | null }} o
 * @returns {Promise<Blob>}
 */
export async function shareImage({ kind, rank, total, me }) {
  await document.fonts?.ready;
  const r = RANKS[rank];
  const story = kind === 'story';
  const W = story ? 1080 : 1200;
  const H = story ? 1920 : 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const g = c.createRadialGradient(W / 2, H * 0.36, 0, W / 2, H * 0.36, Math.max(W, H) * 0.75);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.55, '#FFF6EA');
  g.addColorStop(1, '#FDEBDD');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const head = `Unlocked: ${r.name} badge in Jagadhatri Puja’26`;
  const rare = rareLine(rank, total);
  const meLine = me ? `${me.name} · ${total.toLocaleString('en-IN')} ${total === 1 ? 'puja' : 'pujas'} completed` : '';
  const pad = story ? 96 : 64;

  c.textBaseline = 'alphabetic';
  if (story) {
    c.font = `800 44px ${FONT}`;
    c.fillStyle = '#B31D24';
    c.textAlign = 'left';
    c.fillText('Puja Dekho', pad, 150);
    c.textAlign = 'right';
    c.fillStyle = r.c1;
    c.fillText(`${r.id}-RANK`, W - pad, 150);
    const size = 560;
    c.drawImage(/** @type {any} */ (await loadBadge(rank, size)), (W - size) / 2, 330, size, size);
    c.textAlign = 'center';
    c.fillStyle = r.c1;
    c.font = `800 40px ${FONT}`;
    c.fillText(`${r.id}-RANK UNLOCKED`, W / 2, 1010);
    c.fillStyle = INK;
    c.font = `800 104px ${FONT}`;
    let y = 1140;
    for (const l of wrap(c, `${r.name}!`, W - pad * 2)) {
      c.fillText(l, W / 2, y);
      y += 116;
    }
    c.fillStyle = '#5F5456';
    c.font = `600 52px ${FONT}`;
    c.fillText(rare, W / 2, y + 10);
    if (me) {
      c.font = `600 44px ${FONT}`;
      const tw = c.measureText(meLine).width;
      const x0 = (W - (tw + 112)) / 2;
      const cy = y + 150;
      c.fillStyle = '#4A0E14';
      c.beginPath();
      c.arc(x0 + 40, cy - 14, 40, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#FFFFFF';
      c.font = `700 34px ${FONT}`;
      c.fillText(me.initials, x0 + 40, cy - 2);
      c.fillStyle = INK;
      c.font = `600 44px ${FONT}`;
      c.textAlign = 'left';
      c.fillText(meLine, x0 + 112, cy);
      c.textAlign = 'center';
    }
    c.fillStyle = '#7A3A00';
    c.font = `700 40px ${FONT}`;
    c.fillText(SITE, W / 2, H - 140);
  } else {
    const size = 400;
    c.drawImage(/** @type {any} */ (await loadBadge(rank, size)), pad, (H - size) / 2, size, size);
    const x = pad + size + 56;
    const max = W - x - pad;
    c.textAlign = 'left';
    c.font = `800 30px ${FONT}`;
    c.fillStyle = '#B31D24';
    c.fillText('Puja Dekho', x, 120);
    c.fillStyle = INK;
    c.font = `800 52px ${FONT}`;
    let y = 196;
    for (const l of wrap(c, head, max).slice(0, 3)) {
      c.fillText(l, x, y);
      y += 62;
    }
    c.fillStyle = '#5F5456';
    c.font = `600 34px ${FONT}`;
    c.fillText(rare, x, y + 12);
    if (me) {
      c.fillStyle = INK;
      c.font = `600 30px ${FONT}`;
      c.fillText(wrap(c, meLine, max)[0], x, y + 68);
    }
    c.fillStyle = '#7A3A00';
    c.font = `700 28px ${FONT}`;
    c.fillText(SITE, x, H - 70);
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no_image'))), 'image/jpeg', 0.9));
}

export function shareText(/** @type {number} */ rank, /** @type {number} */ total) {
  return `Unlocked: ${RANKS[rank].name} badge in Jagadhatri Puja’26. ${rareLine(rank, total)}. Can you beat that? ${SITE_URL}`;
}

function download(/** @type {Blob} */ blob, /** @type {string} */ name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const initialsOf = (/** @type {string} */ name) =>
  name
    .split(/\s+/)
    .map((w) => w.match(/\p{L}/u)?.[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

/**
 * The share screen: the card, "Show my name and pujas" (on by default, like Reddit), then Instagram, WhatsApp, Save,
 * More (or Copy link where the phone has no share menu). Not now is the only way out.
 * @param {{ rank: number | null, total: number, user: { name: string } | null, online: boolean, onClose: () => void, toast: (t: string) => void }} props
 */
export function ShareScreen({ rank, total, user, online, onClose, toast }) {
  const open = rank != null;
  const ref = useLayer(open, onClose);
  const [showMe, setShowMe] = useState(() => storage.get('jg_share_me', /** @type {boolean} */ (true)) !== false);
  const [busy, setBusy] = useState(false);
  if (!open || !user) return null;
  const r = RANKS[rank];
  const me = showMe ? { name: user.name, initials: initialsOf(user.name) } : null;
  const file = `puja-dekho-${r.name.toLowerCase().replace(/\s+/g, '-')}`;
  const canShare = typeof navigator.share === 'function';

  const run = async (/** @type {() => Promise<void>} */ fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (/** @type {any} */ (e)?.name !== 'AbortError') toast("Couldn't share. Try Save instead");
    } finally {
      setBusy(false);
    }
  };
  const asFile = async (/** @type {'story' | 'wide'} */ kind) =>
    new File([await shareImage({ kind, rank, total, me })], `${file}.jpg`, { type: 'image/jpeg' });

  const onInstagram = () =>
    run(async () => {
      const f = await asFile('story');
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f] });
      } else {
        download(f, f.name);
        toast('Image saved. Add it to your Instagram story');
      }
    });
  const onWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText(rank, total))}`, '_blank', 'noopener');
  };
  const onSave = () =>
    run(async () => {
      const f = await asFile('story');
      download(f, f.name);
      toast('Image downloaded');
    });
  const onMore = () =>
    run(async () => {
      const f = await asFile('wide');
      const text = shareText(rank, total);
      if (navigator.canShare?.({ files: [f], text })) await navigator.share({ files: [f], text });
      else await navigator.share({ text, url: SITE_URL });
    });
  const onCopy = () =>
    run(async () => {
      await navigator.clipboard.writeText(SITE_URL);
      toast('Link copied');
    });

  return createPortal(
    <div ref={ref} className="jg-cel jg-share" role="dialog" aria-modal="true" aria-label="Share your badge">
      <div className="jg-cel-main jg-share-main">
        <div
          className="jg-scard jg-pop"
          role="img"
          aria-label={`Unlocked: ${r.name} badge in Jagadhatri Puja’26. ${rareLine(rank, total)}${me ? `. ${me.name}, ${total} pujas completed` : ''}`}
        >
          <div className="jg-scard-top">
            <span style={{ color: '#B31D24' }}>Puja Dekho</span>
            <span style={{ color: r.c1 }}>{`${r.id}-RANK`}</span>
          </div>
          <div className="jg-scard-mid">
            <Badge i={rank} size={84} />
            <span className="jg-scard-head">{`Unlocked: ${r.name} badge in Jagadhatri Puja’26`}</span>
          </div>
          {me && (
            <div className="jg-scard-me">
              <span className="jg-scard-av" aria-hidden="true">
                {me.initials}
              </span>
              <span>
                <b>{me.name}</b>
                {` · ${total.toLocaleString('en-IN')} ${total === 1 ? 'puja' : 'pujas'} completed`}
              </span>
            </div>
          )}
          <div className="jg-scard-bot">
            <span>{rareLine(rank, total)}</span>
            <span>{SITE}</span>
          </div>
        </div>
        <button
          type="button"
          className="jg-me-toggle"
          role="switch"
          aria-checked={showMe}
          onClick={() => {
            storage.set('jg_share_me', !showMe);
            setShowMe(!showMe);
          }}
        >
          <span>Show my name and pujas</span>
          <span className="jg-switch" aria-hidden="true" />
        </button>
      </div>
      <div className="jg-cel-foot">
        <div className="jg-circ-row" role="group" aria-label="Share to">
          <button type="button" className="jg-circ" onClick={onInstagram} disabled={!online || busy} data-autofocus>
            <span className="jg-circ-ic ig">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </span>
            Instagram
          </button>
          <button type="button" className="jg-circ" onClick={onWhatsApp} disabled={!online || busy}>
            <span className="jg-circ-ic wa">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z" />
              </svg>
            </span>
            WhatsApp
          </button>
          <button type="button" className="jg-circ" onClick={onSave} disabled={busy}>
            <span className="jg-circ-ic plain">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
            </span>
            Save
          </button>
          {canShare ? (
            <button type="button" className="jg-circ" onClick={onMore} disabled={!online || busy}>
              <span className="jg-circ-ic plain">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </span>
              More
            </button>
          ) : (
            <button type="button" className="jg-circ" onClick={onCopy} disabled={!online || busy}>
              <span className="jg-circ-ic plain">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                </svg>
              </span>
              Copy link
            </button>
          )}
        </div>
        {!online && <span className="jg-cel-note">You&apos;re offline. Save the image now and share it later.</span>}
        <button type="button" className="jg-ghost" onClick={onClose}>
          Not now
        </button>
      </div>
    </div>,
    document.body,
  );
}
