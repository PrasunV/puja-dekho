import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.js';
import { CrowdDot } from '../../components/ui/Crowd.jsx';
import { POPULAR_IDS, POPULAR_MAX } from '../../data/popular.js';
import { formatDistance, walkMinutes } from '../../lib/geo.js';

/**
 * "Popular pujas": a hand-picked, swipeable strip with pagination dots. It shows only picked pujas that
 * are inside the active radius (and pass the other filters) and hides itself when there are none.
 * It is called Popular, not Trending, because nothing about it is live.
 */
export default function PopularStrip() {
  const { data, filters, openPuja } = useApp();
  const items = useMemo(() => {
    const allowed = new Set(filters.mapResults.map((puja) => puja.id));
    return POPULAR_IDS.map((id) => data.byId.get(id))
      .filter((puja) => puja && allowed.has(puja.id) && filters.inRadius(puja))
      .slice(0, POPULAR_MAX);
  }, [data, filters]);
  const trackRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [index, setIndex] = useState(0);

  if (items.length === 0) return null;

  const onScroll = () => {
    const track = trackRef.current;
    const first = /** @type {HTMLElement | null} */ (track?.firstElementChild ?? null);
    if (!track || !first) return;
    const step = first.offsetWidth + 12;
    setIndex(Math.max(0, Math.min(items.length - 1, Math.round(track.scrollLeft / step))));
  };

  return (
    <section className="popular" aria-label="Popular pujas">
      <h3>Popular pujas</h3>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable strip must be reachable by keyboard */}
      <div className="popular-track" ref={trackRef} onScroll={onScroll} tabIndex={0} aria-label="Swipe to see more popular pujas">
        {items.map((puja) =>
          puja ? (
            <button key={puja.id} type="button" className="popular-card" onClick={() => openPuja(puja.id)}>
              <b className="pname">{puja.n}</b>
              <span className="sub">{puja.ar}</span>
              <span className="row tightgap">
                {filters.distances?.get(puja.id) != null && (
                  <span className="num sub">{`~${formatDistance(filters.distances.get(puja.id) ?? 0)} · ~${walkMinutes(filters.distances.get(puja.id) ?? 0)} min`}</span>
                )}
                <CrowdDot puja={puja} />
              </span>
            </button>
          ) : null,
        )}
      </div>
      <div className="dots" role="presentation">
        {items.map((puja, i) => (
          <span key={puja?.id ?? i} className={i === Math.min(index, items.length - 1) ? 'on' : ''} />
        ))}
      </div>
    </section>
  );
}
