import { useState } from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import { formatDistance } from './lib.js';
import { PickerField } from './picker.jsx';
import {
  lightingOf,
  metres,
  PROCESSION_CREDIT,
  PROCESSION_MOVED,
  PROCESSION_WHEN,
  REACH,
  ROUTE,
  ROUTE_KM,
  WATCH,
  walkMinutes,
  watchPlan,
  ZONES,
} from './procession.js';

/**
 * @typedef {{ zone: string, n: number, lorries: number, first: number, last: number, rows: import('./lib.js').JgPuja[] }} ZoneSummary
 */

/** One puja in a zone: serial number, name with its Bengali, lorries and, where known, the lighting artist. */
function ProcRow({ puja, onOpen }) {
  const light = lightingOf(puja);
  const lorries = puja.pr?.tr;
  return (
    <li>
      <button
        type="button"
        className="jg-proc-row"
        aria-label={`No. ${puja.pr?.s}, ${puja.n}${lorries ? `, ${lorries} lorries` : ''}${light.length ? `, lighting by ${light.join(' and ')}` : ''}`}
        onClick={() => onOpen(puja.id)}
      >
        <span className="jg-proc-no">{puja.pr?.s}</span>
        <span className="jg-proc-main">
          <span className="jg-proc-name">{puja.n}</span>
          {puja.bn && (
            <span className="jg-bn" lang="bn">
              {puja.bn}
            </span>
          )}
          <span className="jg-proc-meta">
            {lorries ? (
              <span>
                <Icon name="lorry" size={16} />
                {`${lorries} lorries`}
              </span>
            ) : null}
            {light.length ? (
              <span>
                <Icon name="bulb" size={16} />
                {`Lighting: ${light.join(', ')}`}
              </span>
            ) : null}
          </span>
        </span>
        <Icon name="next" size={20} />
      </button>
    </li>
  );
}

/**
 * The Procession sheet: tabs Overview, Route, Zone A to D (a scrolling text tab group, the one place the app uses
 * underline tabs). Overview says when and how to get there, Route lists the suggested watch points, each zone lists
 * its pujas in walking order.
 * @param {{ tab: string, onTab: (t: string) => void, zones: ZoneSummary[], total: number, lorries: number, phase: 'before' | 'on' | 'after', watchSel: number, onWatch: (i: number) => void, onOpen: (id: string) => void, onClose: () => void }} props
 */
export function ProcessionSheet({ tab, onTab, zones, total, lorries, phase, watchSel, onWatch, onOpen, onClose }) {
  const tabs = ['Overview', 'Route', ...ZONES];
  const zone = zones.find((z) => z.zone === tab);
  return (
    <div className="jg-detail jg-proc">
      <div className="jg-detail-head" data-sheet-head>
        <div className="jg-detail-titles">
          <h2 className="jg-title">Procession</h2>
          <p className="jg-meta">{phase === 'after' ? 'Held on Sunday 22 Nov' : PROCESSION_WHEN}</p>
        </div>
        <button type="button" className="jg-icon-btn" aria-label="Close Procession" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- the focusable tabs inside carry focus; arrows bubble up here */}
      <div
        className="jg-tabs"
        role="tablist"
        aria-label="Procession"
        onKeyDown={(e) => {
          const i = tabs.indexOf(tab);
          const next =
            e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i + tabs.length - 1) % tabs.length] : null;
          if (next) {
            e.preventDefault();
            onTab(next);
          }
        }}
      >
        {tabs.map((t) => {
          const z = zones.find((x) => x.zone === t);
          return (
            <button
              key={t}
              type="button"
              role="tab"
              id={`jg-proc-tab-${t}`}
              aria-selected={tab === t}
              aria-controls="jg-proc-panel"
              tabIndex={tab === t ? 0 : -1}
              className="jg-tab"
              ref={(el) => {
                if (el && tab === t) el.scrollIntoView?.({ inline: 'center', block: 'nearest' });
              }}
              onClick={() => onTab(t)}
            >
              {z ? `Zone ${t}` : t}
              {z && <span className="jg-tab-n">{z.n}</span>}
            </button>
          );
        })}
      </div>
      <div id="jg-proc-panel" role="tabpanel" aria-labelledby={`jg-proc-tab-${tab}`}>
        {tab === 'Overview' && (
          <>
            <div className="jg-proc-when">
              <strong>{phase === 'after' ? 'Held on Sunday 22 Nov' : PROCESSION_WHEN}</strong>
              <span>{PROCESSION_MOVED}</span>
            </div>
            <div className="jg-proc-stats">
              <div>
                <strong>{total}</strong>
                <span>pujas</span>
              </div>
              <div>
                <strong>{lorries}</strong>
                <span>lorries</span>
              </div>
              <div>
                <strong>{ROUTE_KM} km</strong>
                <span>route</span>
              </div>
              <div>
                <strong>{ZONES.length}</strong>
                <span>zones</span>
              </div>
            </div>
            <h3 className="jg-proc-h">Reach the route</h3>
            <p className="jg-meta">Straight-line distance to the nearest point of the route</p>
            <ul className="jg-proc-list">
              {REACH.map((r) => (
                <li key={r.name} className="jg-proc-reach">
                  <Icon name={r.kind === 'ghat' ? 'boat' : 'train'} size={20} />
                  <span>{r.name}</span>
                  <span className="jg-meta">{formatDistance(r.m)}</span>
                </li>
              ))}
            </ul>
            <h3 className="jg-proc-h">Zones</h3>
            <ul className="jg-proc-list">
              {zones.map((z) => (
                <li key={z.zone}>
                  <button type="button" className="jg-proc-row" onClick={() => onTab(z.zone)}>
                    <span className="jg-proc-no">{z.zone}</span>
                    <span className="jg-proc-main">
                      <span className="jg-proc-name">{`Zone ${z.zone}`}</span>
                      <span className="jg-proc-meta">
                        <span>{`${z.n} pujas`}</span>
                        <span>
                          <Icon name="lorry" size={16} />
                          {`${z.lorries} lorries`}
                        </span>
                        <span>{`No. ${z.first} to ${z.last}`}</span>
                      </span>
                    </span>
                    <Icon name="next" size={20} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="jg-proc-credit">{PROCESSION_CREDIT}</p>
          </>
        )}
        {tab === 'Route' && (
          <>
            <p className="jg-proc-warn">
              <strong>Approximate route.</strong> Follow the police and volunteers on the ground, and check the police map on the day.
            </p>
            <h3 className="jg-proc-h">Suggested places to watch</h3>
            <p className="jg-meta">Nine points along the route, in procession order. Tap one to see it on the map.</p>
            <ul className="jg-proc-list">
              {WATCH.map((w, i) => (
                <li key={w.t}>
                  <button type="button" className="jg-proc-row" aria-pressed={watchSel === i} onClick={() => onWatch(i)}>
                    <span className="jg-proc-no jg-proc-wp">{i + 1}</span>
                    <span className="jg-proc-main">
                      <span className="jg-proc-name">
                        {w.t}
                        {w.best && <span className="jg-tag tonal jg-best-tag">Best view</span>}
                      </span>
                      <span className="jg-proc-meta">
                        <span>{w.why}</span>
                      </span>
                      <span className="jg-proc-meta">
                        <span>{`${formatDistance(w.d)} from ${w.st}`}</span>
                      </span>
                    </span>
                    <Icon name="next" size={20} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="jg-proc-credit">{PROCESSION_CREDIT}</p>
          </>
        )}
        {zone && (
          <>
            <h3 className="jg-proc-h">{`Zone ${zone.zone}`}</h3>
            <p className="jg-meta">{`${zone.n} pujas · ${zone.lorries} lorries · No. ${zone.first} to ${zone.last}`}</p>
            <ul className="jg-proc-list">
              {zone.rows.map((p) => (
                <ProcRow key={p.id} puja={p} onOpen={onOpen} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** The route and the watch points, drawn once as a small square picture for the cards. */
const THUMB = (() => {
  const cos = Math.cos((22.87 * Math.PI) / 180);
  const xy = (/** @type {readonly number[]} */ p) => [(p[1] ?? 0) * cos, -(p[0] ?? 0)];
  const pts = ROUTE.map(xy);
  const xs = pts.map((p) => p[0] ?? 0);
  const ys = pts.map((p) => p[1] ?? 0);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 8;
  const sc = Math.min((64 - 2 * pad) / (x1 - x0), (64 - 2 * pad) / (y1 - y0));
  const ox = pad + (64 - 2 * pad - (x1 - x0) * sc) / 2 - x0 * sc;
  const oy = pad + (64 - 2 * pad - (y1 - y0) * sc) / 2 - y0 * sc;
  const at = (/** @type {number[]} */ p) => [(p[0] ?? 0) * sc + ox, (p[1] ?? 0) * sc + oy];
  const d = pts
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${at(p)
          .map((n) => n.toFixed(1))
          .join(' ')}`,
    )
    .join('');
  const dots = WATCH.map((w) => at(xy([w.la, w.lo])));
  return { d, dots };
})();

/** 64 px square: the dashed route with a yellow dot at each watch point. Decorative. */
export function RouteThumb() {
  return (
    <svg className="jg-route-thumb" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d={THUMB.d} className="jg-rt-line" />
      {THUMB.dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" className="jg-rt-dot" />
      ))}
    </svg>
  );
}

const WATCH_COUNTS = /** @type {const} */ ([
  [1, '1'],
  [3, '3'],
  [WATCH.length, 'All'],
]);

/**
 * Plan my route, "Or watch it from a spot": pick where you arrive and how many spots, and get the nearest watch point
 * and the ones after it, in procession order. Tapping a spot shows it on the map.
 * @param {{ options: { id: string, name: string, short?: string, icon: 'train' | 'boat' | 'locate' }[], points: Map<string, { name: string, la: number, lo: number }>, onShow: (index: number) => void }} props
 */
export function WatchPlanCard({ options, points, onShow }) {
  const [from, setFrom] = useState(options[0]?.id ?? '');
  const [count, setCount] = useState(3);
  const [made, setMade] = useState(false);
  const at = points.get(from);
  const legs = made && at ? watchPlan(at, count) : [];
  const lead = legs[0];
  const bestIndex = WATCH.findIndex((w) => w.best);
  const best = WATCH[bestIndex];
  return (
    <>
      <div className="jg-plan-card">
        <PickerField label="Arrive" question="Where do you arrive?" value={from} options={options} onPick={setFrom} />
        <fieldset className="jg-plan-field">
          <legend className="jg-plan-label">How many spots?</legend>
          <div className="jg-seg" role="radiogroup" aria-label="How many spots">
            {WATCH_COUNTS.map(([n, label]) => (
              <button key={n} type="button" role="radio" aria-checked={count === n} className="jg-seg-btn" onClick={() => setCount(n)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="button" className="btn primary block jg-plan-go" onClick={() => setMade(true)}>
          {made ? 'Update my watch plan' : 'Make my watch plan'}
        </button>
      </div>
      {lead && at && (
        <>
          <p className="jg-meta jg-watch-lead">
            {`From ${at.name}: ${formatDistance(lead.m)} in a straight line to the first spot, about ${lead.min} min on foot.`}
          </p>
          <ul className="jg-proc-list">
            {legs.map((leg, k) => {
              const w = WATCH[leg.index];
              if (!w) return null;
              return (
                <li key={w.t}>
                  <button type="button" className="jg-proc-row" onClick={() => onShow(leg.index)}>
                    <span className="jg-proc-no jg-proc-wp">{leg.index + 1}</span>
                    <span className="jg-proc-main">
                      <span className="jg-proc-name">
                        {w.t}
                        {w.best && <span className="jg-tag tonal jg-best-tag">Best view</span>}
                      </span>
                      {k > 0 && (
                        <span className="jg-proc-meta">
                          <span>{`${formatDistance(leg.m)} along the route from the last spot · about ${leg.min} min`}</span>
                        </span>
                      )}
                    </span>
                    <Icon name="next" size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
          {!legs.some((l) => WATCH[l.index]?.best) && best && (
            <>
              <h3 className="jg-plan-h">Best viewing point</h3>
              <ul className="jg-proc-list">
                <li>
                  <button type="button" className="jg-proc-row" onClick={() => onShow(bestIndex)}>
                    <span className="jg-proc-no jg-proc-wp">{bestIndex + 1}</span>
                    <span className="jg-proc-main">
                      <span className="jg-proc-name">
                        {best.t}
                        <span className="jg-tag tonal jg-best-tag">Best view</span>
                      </span>
                      <span className="jg-proc-meta">
                        <span>{`${formatDistance(Math.round(metres(at, best)))} from ${at.name} in a straight line · about ${walkMinutes(metres(at, best))} min`}</span>
                      </span>
                    </span>
                    <Icon name="next" size={20} />
                  </button>
                </li>
              </ul>
            </>
          )}
          <p className="jg-meta">Route is approximate. Follow the police and volunteers, and check the police map on the day.</p>
        </>
      )}
    </>
  );
}
