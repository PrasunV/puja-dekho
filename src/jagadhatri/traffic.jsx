import { useEffect, useState } from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import { Section, useCollapse } from './ui.jsx';
import { ALL_POINTS, ALL_POINTS_COMPLETE, GOODS_POINTS, NOTICE_IMAGE, SOURCE, trafficStatus, windowRows } from './traffic.js';

/** The time, refreshed every minute, so the status line stays true while the sheet is open. */
function useMinute() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    const onShow = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, []);
  return now;
}

function StatusLine({ status }) {
  return (
    <p className="jg-traffic-status" data-state={status.state}>
      <span className="jg-traffic-dot" aria-hidden="true" />
      {status.line}
    </p>
  );
}

/**
 * Pinned at the top of What's new: "Traffic and road closures", today's status, and the way into the full notice.
 * @param {{ onOpen: () => void }} props
 */
export function TrafficCard({ onOpen }) {
  const status = trafficStatus(useMinute());
  return (
    <button type="button" className="jg-card jg-traffic-card" onClick={onOpen}>
      <span className="jg-traffic-ic" aria-hidden="true">
        <Icon name="barrier" size={22} />
      </span>
      <span className="jg-traffic-text">
        <span className="jg-traffic-title">Traffic and road closures</span>
        <StatusLine status={status} />
        <span className="jg-meta">Police notice · 13–20 Nov</span>
      </span>
      <Icon name="next" size={20} />
    </button>
  );
}

function PointList({ points }) {
  return (
    <ul className="jg-traffic-points">
      {points.map((p) => (
        <li key={`${p.at}-${p.toward}`}>
          <span className="jg-row-title">{`${p.at}, ${p.road}`}</span>
          <span className="jg-row-meta">
            <span>{`Towards ${p.toward}${p.via && p.via !== p.road ? ` via ${p.via}` : ''}`}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The full notice: live status, the hours for each day, then where goods vehicles and all vehicles are stopped.
 * @param {{ onBack: () => void, onClose: () => void }} props
 */
export function TrafficDetail({ onBack, onClose }) {
  const status = trafficStatus(useMinute());
  const rows = windowRows();
  const [isOpen, toggle] = useCollapse(true);
  const sec = (/** @type {string} */ key, /** @type {string} */ title) => ({ title, open: isOpen(key), onToggle: () => toggle(key) });
  return (
    <div className="jg-detail jg-traffic">
      <div className="jg-detail-head" data-sheet-head>
        <button type="button" className="jg-icon-btn" aria-label="Back to What's new" onClick={onBack}>
          <Icon name="back" />
        </button>
        <h2 className="jg-title">Traffic and road closures</h2>
        <button type="button" className="jg-icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>

      <div className="jg-card jg-traffic-now">
        <StatusLine status={status} />
        <p className="jg-meta">Worked out from the police notice. Always follow traffic police on the road.</p>
      </div>

      <Section {...sec('when', 'When vehicles are stopped')}>
        <ul className="jg-traffic-days">
          {rows.map((r, i) => {
            const now = status.state === 'on' && status.index === i;
            return (
              <li key={r.day} data-now={now || undefined}>
                <span className="jg-traffic-day">{r.day}</span>
                <span className="jg-traffic-hours">
                  {r.hours}
                  {now && <span className="jg-tag tonal">Now</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="jg-caption">Each closure ends the next morning. Same hours for both lists below.</p>
      </Section>

      <Section {...sec('goods', `Goods vehicles stopped at ${GOODS_POINTS.length} points`)}>
        <PointList points={GOODS_POINTS} />
      </Section>

      <Section {...sec('all', 'All vehicles stopped at')}>
        <p className="jg-caption">Including auto, toto, e-rickshaw, motorcycle, rickshaw and van.</p>
        <PointList points={ALL_POINTS} />
        {!ALL_POINTS_COMPLETE && <p className="jg-note">More points are in the notice. Open it below to see them all.</p>}
      </Section>

      <section className="jg-group jg-traffic-source">
        <p className="jg-caption">{`Source: ${SOURCE}`}</p>
        <a className="btn small jg-btn-outline" href={NOTICE_IMAGE} target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={16} />
          See the notice
        </a>
      </section>
    </div>
  );
}
