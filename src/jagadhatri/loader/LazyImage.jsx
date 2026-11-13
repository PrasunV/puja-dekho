import { useEffect, useRef, useState } from 'react';
import eyeSvg from '../../assets/loader/eye-lineart.svg?raw';
import './loader.css';

/**
 * A photo with a still line-art eye while it loads (after 300 ms, so cached photos never flash it) and a quiet fallback
 * if it fails. No animation per photo, so long lists stay cheap. It fills its parent, like a plain <img> would.
 * `compact` is for small thumbnails: no message, only the tinted frame.
 * @param {import('react').ImgHTMLAttributes<HTMLImageElement> & { compact?: boolean }} props
 */
export default function LazyImage({ src, alt = '', compact = false, onLoad, onError, ...rest }) {
  const [state, setState] = useState(/** @type {'loading' | 'loaded' | 'error'} */ ('loading'));
  const ref = useRef(/** @type {HTMLImageElement | null} */ (null));
  useEffect(() => {
    const img = ref.current;
    setState(img && img.complete && img.naturalWidth > 0 ? 'loaded' : 'loading'); // already cached
  }, [src]);
  return (
    <span className={`pd-img${compact ? ' compact' : ''}`} data-state={state}>
      {state !== 'loaded' && (
        <span
          className="pd-img-ph"
          role={state === 'error' && !compact ? 'img' : undefined}
          aria-label={state === 'error' && !compact ? "Photo didn't load" : undefined}
        >
          <span className="pd-img-eye" aria-hidden="true" dangerouslySetInnerHTML={{ __html: eyeSvg }} />
          {state === 'error' && !compact && <span className="pd-img-msg">Photo didn't load</span>}
        </span>
      )}
      {state !== 'error' && (
        <img
          {...rest}
          ref={ref}
          src={src}
          alt={alt}
          onLoad={(e) => {
            setState('loaded');
            onLoad?.(e);
          }}
          onError={(e) => {
            setState('error');
            onError?.(e);
          }}
        />
      )}
    </span>
  );
}
