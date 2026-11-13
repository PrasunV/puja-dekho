import { Fragment, useState } from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import { BEST_ROUTES, PLAN_HOURS, PLAN_POINTS } from './config.js';
import { bestPlan, durationText, lastWayHome, planStats, stopTag, walkUrl } from './plan.js';
import { trafficStatus } from './traffic.js';
import { useMinute } from './traffic.jsx';
import { Section, useCollapse, ViewCue } from './ui.jsx';

/** @typedef {import('./plan.js').Plan} Plan */
/** @typedef {import('./plan.js').PlanPoint} PlanPoint */

/**
 * Roads note on every plan: closures are for vehicles, walking is always allowed. Opens the police notice.
 * @param {{ onTraffic: () => void }} props
 */
function RoadsNote({ onTraffic }) {
  const status = trafficStatus(useMinute());
  if (status.state === 'ended') return null;
  const line =
    status.state === 'on'
      ? 'Roads are closed to vehicles now · walking is allowed'
      : `${status.line.replace(/^Starts/, 'Vehicle closures start')} · walking is always allowed`;
  return (
    <button type="button" className="jg-plan-roads" onClick={onTraffic}>
      <Icon name="barrier" size={18} />
      <span>{line}</span>
      <Icon name="next" size={16} />
    </button>
  );
}

/**
 * A row of choice chips (start or end point).
 * @param {{ label: string, value: string, options: { id: string, name: string, icon: 'train' | 'boat' | 'locate' }[], onPick: (id: string) => void }} props
 */
function PointChips({ label, value, options, onPick }) {
  return (
    <fieldset className="jg-plan-field">
      <legend className="jg-plan-label">{label}</legend>
      <div className="jg-plan-chips">
        {options.map((o) => (
          <button key={o.id} type="button" className="chip compact jg-chip" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
            <Icon name={o.icon} size={16} />
            {o.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Short names for chips: "Chandannagar Station" → "Chandannagar". */
const short = (/** @type {string} */ name) => name.replace(/ (Station|Ghat)$/, '');

/**
 * Plan my route: start, end, 2 or 5 hours, Make my plan. Below, the Best routes.
 * @param {{ points: Map<string, PlanPoint>, byId: Map<string, import('./lib.js').JgPuja>,
 *   form: { start: string, end: string, hours: number }, onForm: (f: { start: string, end: string, hours: number }) => void,
 *   onMake: () => void, onBest: (plan: Plan) => void, onClose: () => void, onTraffic: () => void }} props
 */
export function PlanView({ points, byId, form, onForm, onMake, onBest, onClose, onTraffic }) {
  const [isOpen, toggle] = useCollapse(true);
  const pts = PLAN_POINTS.map((id) => points.get(id)).filter((p) => !!p);
  const opts = /** @type {PlanPoint[]} */ (pts).map((p) => ({
    id: p.id,
    name: short(p.name),
    icon: /** @type {'train' | 'boat'} */ (p.kind === 'ghat' ? 'boat' : 'train'),
  }));
  const best = BEST_ROUTES.map((r) => bestPlan(r, byId, points)).filter((p) => !!p);
  return (
    <div className="jg-detail jg-plan">
      <div className="jg-detail-head" data-sheet-head>
        <h2 className="jg-title">Plan my route</h2>
        <button type="button" className="jg-icon-btn" aria-label="Close Plan my route" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <p className="jg-body jg-plan-intro">Walk the best pujas your time allows, and get back before the last train or ferry.</p>
      <RoadsNote onTraffic={onTraffic} />
      <PointChips
        label="Start"
        value={form.start}
        options={[{ id: 'me', name: 'Where I am', icon: 'locate' }, ...opts]}
        onPick={(id) => onForm({ ...form, start: id })}
      />
      <PointChips label="End" value={form.end} options={opts} onPick={(id) => onForm({ ...form, end: id })} />
      <fieldset className="jg-plan-field">
        <legend className="jg-plan-label">Time</legend>
        <div className="jg-seg" role="radiogroup" aria-label="How long">
          {PLAN_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={form.hours === h}
              className="jg-seg-btn"
              onClick={() => onForm({ ...form, hours: h })}
            >
              {`${h} hours`}
            </button>
          ))}
        </div>
      </fieldset>
      <button type="button" className="btn dark block jg-plan-go" onClick={onMake}>
        Make my plan
      </button>
      <Section title="Best routes" open={isOpen('best')} onToggle={() => toggle('best')}>
        <ul className="jg-ev-list">
          {
            /** @type {Plan[]} */ (best).map((p) => {
              const s = planStats(p);
              return (
                <li key={p.bestId}>
                  <button type="button" className="jg-ev jg-best" onClick={() => onBest(p)}>
                    <span className="jg-ev-title">{p.title}</span>
                    <span className="jg-ev-meta">
                      {`${p.stops.length} pujas · ${p.km.toFixed(1)} km · about ${durationText(p.minutes)}`}
                    </span>
                    <span className="jg-best-stats">
                      <span>
                        <b>{s.jubilee}</b> Jubilee or Pre-Jubilee
                      </span>
                      <span>
                        <b>{s.must}</b> Must visit
                      </span>
                    </span>
                    <span className="jg-ev-meta">{`${p.start.name} to ${p.end.name}`}</span>
                  </button>
                </li>
              );
            })
          }
        </ul>
      </Section>
    </div>
  );
}

/**
 * One puja on a plan: number (a tick once visited), name and tag, View. A detour stop has no number.
 * @param {{ p: import('./lib.js').JgPuja, n: number | null, visited: Set<string>, onTick: (id: string, on: boolean) => void,
 *   onOpenPuja: (id: string) => void }} props
 */
function StopRow({ p, n, visited, onTick, onOpenPuja }) {
  const on = visited.has(p.id);
  const tag = [stopTag(p) || null, p.pop ? 'Must visit' : null].filter(Boolean).join(' · ');
  return (
    <li className="jg-prow jg-plan-row" data-seen={on || undefined}>
      <button
        type="button"
        className={`jg-plan-tick${on ? ' on' : ''}`}
        aria-pressed={on}
        aria-label={`${on ? 'Visited' : 'Mark as visited'}: ${p.n}`}
        onClick={() => onTick(p.id, !on)}
      >
        <span className={`jg-plan-num${n == null ? ' extra' : ''}`} aria-hidden="true">
          {on ? <Icon name="check" size={16} /> : (n ?? <Icon name="plus" size={14} />)}
        </span>
      </button>
      <button type="button" className="jg-row" onClick={() => onOpenPuja(p.id)}>
        <span className="jg-row-text">
          <span className="jg-row-title">{p.n}</span>
          <span className="jg-row-meta">
            <span>{tag || p.t}</span>
          </span>
        </span>
      </button>
      <ViewCue onClick={() => onOpenPuja(p.id)} />
    </li>
  );
}

/** The last row: where the plan ends. */
function EndRow({ end }) {
  return (
    <li className="jg-plan-end">
      <span className="jg-plan-num end" aria-hidden="true">
        <Icon name={end.kind === 'ghat' ? 'boat' : 'train'} size={16} />
      </span>
      <span>{`End: ${end.name}`}</span>
    </li>
  );
}

/**
 * A plan: numbered pujas in walking order, ticks as you go (ticking marks the puja visited), Show on map, Walk.
 * @param {{ plan: Plan, visited: Set<string>, onBack: () => void, onClose: () => void, onTick: (id: string, on: boolean) => void,
 *   onOpenPuja: (id: string) => void, onShowMap: () => void, onTraffic: () => void }} props
 */
export function RouteView({ plan, visited, onBack, onClose, onTick, onOpenPuja, onShowMap, onTraffic }) {
  const [isOpen, toggle] = useCollapse(plan);
  const [detourOpen, setDetourOpen] = useState(false);
  const [detourFor, setDetourFor] = useState(plan);
  if (detourFor !== plan) {
    setDetourFor(plan);
    setDetourOpen(false);
  }
  const rowProps = { visited, onTick, onOpenPuja };
  const seen = plan.stops.filter((p) => visited.has(p.id)).length;
  const next = plan.stops.find((p) => !visited.has(p.id)) ?? plan.end;
  const s = planStats(plan);
  const empty = plan.stops.length === 0;
  /** The line about getting home: trimmed, too late, or when to head back. */
  let home = `${lastWayHome(plan.end)} from ${plan.end.name}.`;
  if (plan.late)
    home = `Too late for the ${plan.end.kind === 'ghat' ? 'last ferry' : 'last train'} from ${plan.end.name}. Pick another end point.`;
  else if (plan.trimmed && empty)
    home = `Only time to walk to ${plan.end.name} before the ${plan.end.kind === 'ghat' ? 'last ferry' : 'last train'}.`;
  else if (plan.trimmed)
    home = `Starting now, you have ${durationText(plan.left ?? 0)} before the ${plan.end.kind === 'ghat' ? 'last ferry' : 'last train'}, so this plan is shorter.`;
  return (
    <div className="jg-detail jg-route">
      <div className="jg-detail-head" data-sheet-head>
        <button type="button" className="jg-icon-btn" aria-label="Back to Plan my route" onClick={onBack}>
          <Icon name="back" />
        </button>
        <div className="jg-detail-titles">
          <h2 className="jg-title">{plan.title}</h2>
          <p className="jg-meta">
            {empty ? 'No pujas on the way' : `${plan.stops.length} pujas · ${plan.km.toFixed(1)} km · about ${durationText(plan.minutes)}`}
          </p>
        </div>
        <button type="button" className="jg-icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      {plan.blurb && <p className="jg-body jg-plan-intro">{plan.blurb}</p>}
      <p className={`jg-plan-home${plan.late || plan.trimmed ? ' warn' : ''}`} role={plan.late ? 'alert' : undefined}>
        <Icon name={plan.end.kind === 'ghat' ? 'boat' : 'train'} size={18} />
        <span>{home}</span>
      </p>
      <RoadsNote onTraffic={onTraffic} />
      {!empty && (
        <>
          <div className="jg-plan-progress">
            <p className="jg-plan-seen">{`${seen} of ${plan.stops.length} seen`}</p>
            <span className="jg-plan-bar" aria-hidden="true">
              <span style={{ width: `${(seen / plan.stops.length) * 100}%` }} />
            </span>
            <p className="jg-meta">
              {[`${s.must} Must visit`, s.jubilee ? `${s.jubilee} Jubilee or Pre-Jubilee` : null, s.old ? `${s.old} over 100 years` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="jg-plan-actions">
            <button type="button" className="btn jg-btn-outline" onClick={onShowMap}>
              <Icon name="route" size={18} />
              Show on map
            </button>
            <a className="btn primary" href={walkUrl(next)} target="_blank" rel="noopener noreferrer">
              <Icon name="nav" size={18} />
              {seen === plan.stops.length ? 'Walk to the end' : 'Walk to next'}
            </a>
          </div>
          <p className="jg-caption jg-plan-from">{`In walking order from ${plan.start.name}`}</p>
          {plan.stages ? (
            <>
              {plan.stages.map((st, si) => (
                <Fragment key={st.title}>
                  <Section
                    title={`${si + 1}. ${st.title}`}
                    count={st.count}
                    open={isOpen(st.title)}
                    onToggle={() => toggle(st.title)}
                    className="jg-plan-stage"
                  >
                    <p className="jg-caption jg-plan-note">{st.note}</p>
                    <ol className="jg-list jg-plan-list" start={st.from + 1}>
                      {plan.stops.slice(st.from, st.from + st.count).map((p, k) => (
                        <StopRow key={p.id} p={p} n={st.from + k + 1} {...rowProps} />
                      ))}
                    </ol>
                  </Section>
                  {plan.detour && plan.detour.after === si + 1 && (
                    <Section
                      title={plan.detour.title}
                      count={plan.detour.stops.length}
                      open={detourOpen}
                      onToggle={() => setDetourOpen((o) => !o)}
                      className="jg-plan-stage jg-plan-detour"
                    >
                      <p className="jg-caption jg-plan-note">{plan.detour.note}</p>
                      <ul className="jg-list jg-plan-list">
                        {plan.detour.stops.map((p) => (
                          <StopRow key={p.id} p={p} n={null} {...rowProps} />
                        ))}
                      </ul>
                    </Section>
                  )}
                </Fragment>
              ))}
              <ul className="jg-list jg-plan-list">
                <EndRow end={plan.end} />
              </ul>
            </>
          ) : (
            <ol className="jg-list jg-plan-list">
              {plan.stops.map((p, i) => (
                <StopRow key={p.id} p={p} n={i + 1} {...rowProps} />
              ))}
              <EndRow end={plan.end} />
            </ol>
          )}
        </>
      )}
    </div>
  );
}
