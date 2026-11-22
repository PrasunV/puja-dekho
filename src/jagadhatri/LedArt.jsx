import { useEffect, useRef, useState } from 'react';

import { LED_FILE, LOAD_BUDGET_MS, STILL_FRAME } from './led-art.js';

/** The player's engine (WebAssembly), from our own files like the festival greeting, so it works offline once seen. */
const WASM_URL = new URL('../../node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm', import.meta.url).href;

/** @type {Promise<{ DotLottie: any, data: string }> | null} */
let loading = null;
/** The player, the file and the engine, fetched together once; a failed load can be tried again. */
function load() {
  loading ??= Promise.all([
    import('@lottiefiles/dotlottie-web').then((m) => {
      m.DotLottie.setWasmUrl(WASM_URL);
      return m.DotLottie;
    }),
    fetch(LED_FILE).then((r) => {
      if (!r.ok) throw new Error(`led ${r.status}`);
      return r.text();
    }),
    fetch(WASM_URL).then((r) => {
      if (!r.ok) throw new Error(`engine ${r.status}`);
      return r.arrayBuffer();
    }),
  ]).then(([DotLottie, data]) => ({ DotLottie, data }));
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * The LED animation in a 10:7 frame on white, drawn 1.25x (the canvas is 125% of the frame; the frame clips). The art is
 * a wide band across the middle of a square, so the frame crops the empty top and bottom (fit cover) and nothing is lost. The logo holds the frame until the animation is ready, then
 * fades out; it stays if the animation cannot load. With reduced motion it shows one lit frame and never plays. It
 * loops while the card is open and pauses when the page is hidden. It never takes a tap.
 * @param {{ logo: import('react').ReactNode }} props
 */
export default function LedArt({ logo }) {
  const canvas = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    /** @type {any} */
    let anim = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const give = setTimeout(() => {
      cancelled = true; // too slow: keep the logo
    }, LOAD_BUDGET_MS);
    load().then(
      ({ DotLottie, data }) => {
        const el = canvas.current;
        if (cancelled || !el) return;
        const rect = el.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        el.width = Math.round(rect.width * dpr);
        el.height = Math.round(rect.height * dpr);
        anim = new DotLottie({
          canvas: el,
          data,
          autoplay: false,
          loop: true,
          renderConfig: { devicePixelRatio: dpr, autoResize: true },
          layout: { fit: 'cover', align: [0.5, 0.5] },
        });
        anim.addEventListener('load', () => {
          if (cancelled) return;
          if (reduced) anim.setFrame(STILL_FRAME);
          else anim.play();
          setShown(true);
        });
      },
      () => {},
    );
    const onVisibility = () => {
      if (reduced || !anim?.isLoaded) return;
      if (document.hidden) anim.pause();
      else anim.play();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(give);
      document.removeEventListener('visibilitychange', onVisibility);
      anim?.destroy();
    };
  }, []);

  return (
    <div className="jg-welcome-art" aria-hidden="true">
      <span className="jg-welcome-fallback" data-hidden={shown || undefined}>
        {logo}
      </span>
      <canvas ref={canvas} className="jg-welcome-canvas" data-shown={shown || undefined} />
    </div>
  );
}
