import { Icon } from '../components/ui/Icon.jsx';
import { useMinute } from './traffic.jsx';
import {
  capacityText,
  IMMERSION_DATES,
  IMMERSION_SOURCE,
  immersionState,
  NO_ENTRY,
  NO_ENTRY_VEHICLES,
  noEntryId,
  PARKING,
  parkingTotal,
} from './immersion-traffic.js';

/** The no-entry sign: a ring with a bar across it. Takes its colour from the text colour. */
export const NoEntryIcon = (/** @type {import('react').SVGProps<SVGSVGElement>} */ props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M7 10h10v4H7z" />
    <path
      fill="currentColor"
      d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10s10-4.486 10-10S17.514 2 12 2m0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8s8 3.589 8 8s-3.589 8-8 8"
    />
  </svg>
);

/** The parking sign: a blue rounded square with a white P. */
export const ParkIcon = (/** @type {import('react').SVGProps<SVGSVGElement>} */ props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-park)" />
    <path
      d="M9.5 18V6h4a3.5 3.5 0 0 1 0 7h-4"
      fill="none"
      stroke="var(--color-on-park)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TABS = ['Overview', 'Parking', 'No entry'];
const ALTS = [...new Set(PARKING.map((p) => p.alt).filter((a) => a != null))];
const onMap = (/** @type {{ la?: number }} */ x) => x.la != null;
const PLACED = PARKING.filter(onMap).length + NO_ENTRY.filter(onMap).length;

/** @param {ReturnType<typeof immersionState>} state */
const statusLine = (state) =>
  state === 'on'
    ? 'In force today'
    : state === 'ended'
      ? 'Restrictions have ended'
      : `No entry at ${NO_ENTRY.length} points, parking at ${PARKING.length} places`;

/**
 * Pinned in What's new beside the goods-vehicle notice: the procession-day restrictions and the way into them.
 * @param {{ onOpen: () => void }} props
 */
export function ImmersionCard({ onOpen }) {
  const state = immersionState(useMinute());
  return (
    <button type="button" className="jg-card jg-traffic-card" onClick={onOpen}>
      <span className="jg-traffic-ic jg-imm-ic" aria-hidden="true">
        <NoEntryIcon />
      </span>
      <span className="jg-traffic-text">
        <span className="jg-traffic-title">Procession day traffic</span>
        <p className="jg-traffic-status" data-state={state === 'on' ? 'on' : undefined}>
          <span className="jg-traffic-dot" aria-hidden="true" />
          {statusLine(state)}
        </p>
        <span className="jg-meta">{`Police notice · ${IMMERSION_DATES}`}</span>
      </span>
      <Icon name="next" size={20} />
    </button>
  );
}

/**
 * One row of the Parking or No entry list. A point with a place on the map is a button that shows it; the others are
 * plain rows that say they are not on the map yet.
 * @param {{ id: string, icon: import('react').ReactNode, title: string, meta: string, spot: boolean, near?: boolean, selected: boolean, onPick: () => void }} props
 */
function Row({ icon, title, meta, spot, near, selected, onPick }) {
  const body = (
    <>
      <span className="jg-imm-sign">{icon}</span>
      <span className="jg-proc-main">
        <span className="jg-row-title jg-proc-name">{title}</span>
        <span className="jg-row-meta">
          <span>{meta}</span>
        </span>
        {!spot && <span className="jg-caption jg-imm-note">Not on the map yet</span>}
        {spot && near && <span className="jg-caption jg-imm-note">Approx. location</span>}
      </span>
      {spot && <Icon name="pin" size={20} />}
    </>
  );
  return spot ? (
    <button type="button" className="jg-proc-row jg-imm-row" aria-pressed={selected} onClick={onPick}>
      {body}
    </button>
  ) : (
    <div className="jg-proc-row jg-imm-row" data-static>
      {body}
    </div>
  );
}

/**
 * The procession-day traffic sheet: Overview, Parking, No entry. A row with a place on the map flies the map to it.
 * @param {{ tab: string, onTab: (t: string) => void, sel: string | null, onPick: (id: string, la: number, lo: number) => void, onBack: () => void, onClose: () => void }} props
 */
export function ImmersionSheet({ tab, onTab, sel, onPick, onBack, onClose }) {
  const state = immersionState(useMinute());
  return (
    <div className="jg-detail jg-proc jg-imm">
      <div className="jg-detail-head" data-sheet-head>
        <button type="button" className="jg-icon-btn" aria-label="Back to What's new" onClick={onBack}>
          <Icon name="back" />
        </button>
        <div className="jg-detail-titles">
          <h2 className="jg-title">Procession day traffic</h2>
          <p className="jg-meta">{`${IMMERSION_DATES} · Chandannagar and Bhadreswar`}</p>
        </div>
        <button type="button" className="jg-icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- the focusable tabs inside carry focus; arrows bubble up here */}
      <div
        className="jg-tabs"
        role="tablist"
        aria-label="Procession day traffic"
        onKeyDown={(e) => {
          const i = TABS.indexOf(tab);
          const next =
            e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length] : e.key === 'ArrowLeft' ? TABS[(i + TABS.length - 1) % TABS.length] : null;
          if (next) {
            e.preventDefault();
            onTab(next);
          }
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`jg-imm-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="jg-imm-panel"
            tabIndex={tab === t ? 0 : -1}
            className="jg-tab"
            onClick={() => onTab(t)}
          >
            {t}
            {t === 'Parking' && <span className="jg-tab-n">{PARKING.length}</span>}
            {t === 'No entry' && <span className="jg-tab-n">{NO_ENTRY.length}</span>}
          </button>
        ))}
      </div>
      <div id="jg-imm-panel" role="tabpanel" aria-labelledby={`jg-imm-tab-${tab}`}>
        {tab === 'Overview' && (
          <>
            <div className="jg-proc-when">
              <strong>{statusLine(state)}</strong>
              <span>{NO_ENTRY_VEHICLES}.</span>
            </div>
            <div className="jg-proc-stats jg-imm-stats">
              <div>
                <strong>{NO_ENTRY.length}</strong>
                <span>no entry</span>
              </div>
              <div>
                <strong>{PARKING.length}</strong>
                <span>parking</span>
              </div>
              <div>
                <strong>{PARKING.reduce((n, p) => n + parkingTotal(p), 0)}</strong>
                <span>spaces</span>
              </div>
            </div>
            <h3 className="jg-proc-h">On the map</h3>
            <ul className="jg-imm-legend">
              <li>
                <span className="jg-imm-sign">
                  <ParkIcon />
                </span>
                Parking place
              </li>
              <li>
                <span className="jg-imm-sign jg-imm-no">
                  <NoEntryIcon />
                </span>
                No entry point
              </li>
            </ul>
            <p className="jg-caption">
              {`${PLACED} of ${PARKING.length + NO_ENTRY.length} points are on the map so far. The notice gives names, not map positions, so a pin marked Approx. location is at a nearby named spot. The rest are in the lists.`}
            </p>
            <h3 className="jg-proc-h">Alternative routes</h3>
            <ul className="jg-proc-list">
              {ALTS.map((a) => (
                <li key={a} className="jg-proc-reach">
                  <span className="jg-imm-sign jg-imm-alt">
                    <Icon name="route" size={20} />
                  </span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
            <p className="jg-caption jg-imm-src">{`Source: ${IMMERSION_SOURCE}. Always follow traffic police on the road.`}</p>
          </>
        )}
        {tab === 'Parking' && (
          <ul className="jg-proc-list">
            {PARKING.map((p) => (
              <li key={p.id}>
                <Row
                  id={p.id}
                  icon={<ParkIcon />}
                  title={p.name}
                  meta={`${p.ps} · ${capacityText(p)}`}
                  spot={p.la != null}
                  near={p.near}
                  selected={sel === p.id}
                  onPick={() => p.la != null && p.lo != null && onPick(p.id, p.la, p.lo)}
                />
                {p.alt && <p className="jg-caption jg-imm-alt-line">{`Alternative: ${p.alt}`}</p>}
              </li>
            ))}
          </ul>
        )}
        {tab === 'No entry' && (
          <>
            <p className="jg-caption jg-imm-lead">{NO_ENTRY_VEHICLES}.</p>
            <ul className="jg-proc-list">
              {NO_ENTRY.map((n) => (
                <li key={n.sl}>
                  <Row
                    id={`n${n.sl}`}
                    icon={<NoEntryIcon />}
                    title={`${n.sl}. ${n.name}`}
                    meta="No entry"
                    spot={n.la != null}
                    near={n.near}
                    selected={sel === noEntryId(n)}
                    onPick={() => n.la != null && n.lo != null && onPick(noEntryId(n), n.la, n.lo)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
