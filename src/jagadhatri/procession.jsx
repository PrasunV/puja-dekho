import { Icon } from '../components/ui/Icon.jsx';
import { formatDistance } from './lib.js';
import { lightingOf, PROCESSION_CREDIT, PROCESSION_MOVED, PROCESSION_WHEN, REACH, ROUTE_KM, WATCH, ZONES } from './procession.js';

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
            <p className="jg-meta">Picked from the route, the ghat and the big pandals. Tap one to see it on the map.</p>
            <ul className="jg-proc-list">
              {WATCH.map((w, i) => (
                <li key={w.t}>
                  <button type="button" className="jg-proc-row" aria-pressed={watchSel === i} onClick={() => onWatch(i)}>
                    <span className="jg-proc-no jg-proc-wp">{i + 1}</span>
                    <span className="jg-proc-main">
                      <span className="jg-proc-name">{w.t}</span>
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
