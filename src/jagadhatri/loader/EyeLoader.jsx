import { useEffect, useId, useRef } from 'react';
// ?raw gives the SVG text, so it is inlined: SMIL animation, no player, about 2 KB.
import miniSvg from '../../assets/loader/loader-eye-mini.svg?raw';

/**
 * The small eye loader: eye and pupil only, drawn in the text colour of its parent.
 * @param {{ size?: number }} props
 */
export default function EyeLoader({ size = 56 }) {
  const ref = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const uid = useId().replace(/:/g, '');
  // Two loaders on screen must not share one mask id, or removing the first would break the second.
  const html = miniSvg.replaceAll('eye-mask-mini', `eye-mask-${uid}`);
  useEffect(() => {
    const svg = /** @type {SVGSVGElement | null} */ (ref.current?.querySelector('svg') ?? null);
    if (!svg || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (mq.matches) {
        svg.pauseAnimations();
        svg.setCurrentTime(0); // t=0 is the finished eye
      } else svg.unpauseAnimations();
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return (
    <span
      ref={ref}
      className="pd-eye"
      aria-hidden="true"
      style={{ width: size, aspectRatio: '305 / 450' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
