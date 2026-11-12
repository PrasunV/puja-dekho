/** @type {AudioContext | null} */
let context = null;

/**
 * A short, soft "pop" for a new love, made on the spot with the Web Audio API (no sound file, nothing to download).
 * It plays only from a tap, as browsers require, never throws, and does nothing when the browser has no audio.
 */
export function playLoveSound() {
  try {
    const Ctx = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
    if (!Ctx) return;
    context ??= new Ctx();
    const ctx = /** @type {AudioContext} */ (context);
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const note = (
      /** @type {number} */ from,
      /** @type {number} */ to,
      /** @type {number} */ start,
      /** @type {number} */ length,
      /** @type {number} */ peak,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(from, t + start);
      osc.frequency.exponentialRampToValueAtTime(to, t + start + length * 0.7);
      gain.gain.setValueAtTime(0.0001, t + start);
      gain.gain.exponentialRampToValueAtTime(peak, t + start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + start);
      osc.stop(t + start + length + 0.02);
    };
    note(420, 760, 0, 0.12, 0.16); // the pop
    note(900, 1320, 0.07, 0.14, 0.07); // a small sparkle on top
  } catch {
    /* no sound is fine */
  }
}
