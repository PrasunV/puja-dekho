import { Icon } from '../components/ui/Icon.jsx';
import { EVENTS } from './config.js';
import { directionsUrl } from './lib.js';
import { TrafficCard, useMinute } from './traffic.jsx';
import { Section, useCollapse } from './ui.jsx';

const IST_MS = 5.5 * 3600 * 1000;
/** Today's date in India, YYYY-MM-DD. */
const istDay = (/** @type {number} */ now) => new Date(now + IST_MS).toISOString().slice(0, 10);

/** @typedef {import('./config.js').JgEvent} JgEvent */
/** @typedef {'live' | 'today' | 'upcoming' | 'ended'} EventState */

/**
 * Where an event stands right now, from its India date (and exact times when it has them).
 * @param {JgEvent} ev
 * @param {number} now
 * @returns {EventState}
 */
export function eventState(ev, now) {
  if (ev.start && ev.end) {
    const s = Date.parse(ev.start);
    const e = Date.parse(ev.end);
    if (now >= s && now < e) return 'live';
    if (now >= e) return 'ended';
  }
  const today = istDay(now);
  const last = ev.endDay ?? ev.day;
  if (today > last) return 'ended';
  if (today >= ev.day) return 'today';
  return 'upcoming';
}

const STATE_WORD = /** @type {const} */ ({ live: 'Live now', today: 'Today', upcoming: 'Upcoming', ended: 'Ended' });

/**
 * Happening now and coming up first (soonest first), then ended ones (most recent first).
 * @param {readonly JgEvent[]} list
 * @param {number} now
 */
export function orderEvents(list, now) {
  const rank = (/** @type {EventState} */ s) => (s === 'ended' ? 1 : 0);
  return [...list]
    .map((ev) => ({ ev, state: eventState(ev, now) }))
    .sort((a, b) => {
      const r = rank(a.state) - rank(b.state);
      if (r) return r;
      return a.state === 'ended' ? b.ev.day.localeCompare(a.ev.day) : a.ev.day.localeCompare(b.ev.day);
    });
}

function StateTag({ state }) {
  return (
    <span className={`jg-tag jg-ev-tag${state === 'ended' || state === 'upcoming' ? '' : ' tonal'}`} data-state={state}>
      {STATE_WORD[state]}
    </span>
  );
}

/** Up to three 4:3 photos, 44 px tall; with more, the third says +N. Left out when there are none. */
function Thumbs({ photos }) {
  if (photos.length === 0) return null;
  const more = photos.length - 3;
  return (
    <span className="jg-ev-thumbs" aria-hidden="true">
      {photos.slice(0, 3).map((ph, i) => (
        <span key={ph.src} className="jg-ev-thumb">
          <img src={ph.src} alt="" loading="lazy" decoding="async" />
          {i === 2 && more > 0 && <span className="jg-ev-more">{`+${more}`}</span>}
        </span>
      ))}
    </span>
  );
}

/**
 * One event: name and status tag, date · puja, photos. The whole card opens its details sheet.
 * @param {{ ev: JgEvent, state: EventState, puja: import('./lib.js').JgPuja | undefined, onOpen: () => void }} props
 */
function EventCard({ ev, state, puja, onOpen }) {
  const n = ev.photos.length;
  return (
    <li>
      <button
        type="button"
        className="jg-ev"
        data-state={state}
        onClick={onOpen}
        aria-label={`${ev.title}. ${STATE_WORD[state]}. ${ev.short ?? ev.when}${puja ? `, ${puja.n}` : ''}${n ? `. ${n} photo${n > 1 ? 's' : ''}` : ''}`}
      >
        <span className="jg-ev-head">
          <span className="jg-ev-title">{ev.title}</span>
          <StateTag state={state} />
        </span>
        <span className="jg-ev-meta">{[ev.short ?? ev.when, puja?.n].filter(Boolean).join(' · ')}</span>
        <Thumbs photos={ev.photos} />
      </button>
    </li>
  );
}

/**
 * What's new: Notice (pinned, the latest notice), Highlights, Latest events. Empty sections are left out.
 * @param {{ byId: Map<string, import('./lib.js').JgPuja>, onClose: () => void, onTraffic: () => void, onEvent: (id: string) => void }} props
 */
export function WhatsNew({ byId, onClose, onTraffic, onEvent }) {
  const now = useMinute();
  const [isOpen, toggle] = useCollapse(true);
  const groups = /** @type {const} */ ([
    ['highlight', 'Highlights'],
    ['latest', 'Latest events'],
  ]).map(([key, title]) => ({
    key,
    title,
    rows: orderEvents(
      EVENTS.filter((e) => e.section === key),
      now,
    ),
  }));
  return (
    <div className="jg-detail jg-whatsnew">
      <div className="jg-detail-head" data-sheet-head>
        <h2 className="jg-title">What's new</h2>
        <button type="button" className="jg-icon-btn" aria-label="Close What's new" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <Section title="Notice" collapsible={false} open onToggle={() => {}}>
        <TrafficCard onOpen={onTraffic} />
      </Section>
      {groups
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <Section key={g.key} title={g.title} open={isOpen(g.key)} onToggle={() => toggle(g.key)}>
            <ul className="jg-ev-list">
              {g.rows.map(({ ev, state }) => (
                <EventCard key={ev.id} ev={ev} state={state} puja={byId.get(ev.pujaId)} onOpen={() => onEvent(ev.id)} />
              ))}
            </ul>
          </Section>
        ))}
    </div>
  );
}

/** The event with this id, if there is one. */
export const eventById = (/** @type {string} */ id) => EVENTS.find((e) => e.id === id);

/**
 * An event's details: status, all photos full width, date, place and organiser, the description, and a link if any.
 * @param {{ ev: JgEvent, puja: import('./lib.js').JgPuja | undefined, onBack: () => void, onClose: () => void, onOpenPuja: (id: string) => void }} props
 */
export function EventDetail({ ev, puja, onBack, onClose, onOpenPuja }) {
  const state = eventState(ev, useMinute());
  return (
    <div className="jg-detail jg-ev-detail">
      <div className="jg-detail-head" data-sheet-head>
        <button type="button" className="jg-icon-btn" aria-label="Back to What's new" onClick={onBack}>
          <Icon name="back" />
        </button>
        <div className="jg-detail-titles">
          <h2 className="jg-title">{ev.title}</h2>
          {ev.subtitle && <p className="jg-meta jg-ev-sub">{ev.subtitle}</p>}
        </div>
        <button type="button" className="jg-icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <StateTag state={state} />
      {ev.photos.length > 0 && (
        <div className="jg-ev-photos">
          {ev.photos.map((ph) => (
            <img key={ph.src} src={ph.src} alt={ph.alt} loading="lazy" decoding="async" />
          ))}
        </div>
      )}
      <ul className="jg-ev-facts">
        <li>
          <Icon name="calendar" size={18} />
          {ev.when}
        </li>
        {puja && (
          <li>
            <Icon name="pin" size={18} />
            {`${puja.n}, ${puja.t}`}
          </li>
        )}
        <li>
          <Icon name="users" size={18} />
          {ev.by}
        </li>
        {(ev.facts ?? []).map((f) => (
          <li key={f}>
            <Icon name="star" size={18} />
            {f}
          </li>
        ))}
      </ul>
      <p className="jg-body">{ev.body}</p>
      <div className="jg-ev-links">
        {puja && (
          <button type="button" className="btn small jg-btn-outline" onClick={() => onOpenPuja(puja.id)}>
            See the puja
          </button>
        )}
        {ev.link && (
          <a className="btn small jg-btn-outline" href={ev.link} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={16} />
            {ev.linkLabel ?? 'See the post'}
          </a>
        )}
      </div>
    </div>
  );
}

/** Footer for an event: Get directions to its puja, the one main action (same as a puja sheet). */
export function EventActions({ puja }) {
  if (!puja) return null;
  return (
    <div className="jg-actions">
      <a className="btn primary block" href={directionsUrl(puja.la, puja.lo)} target="_blank" rel="noopener noreferrer">
        <Icon name="nav" size={20} />
        Get directions
      </a>
    </div>
  );
}
