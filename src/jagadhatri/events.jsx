import { useCallback, useRef, useState } from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import PhotoViewer from '../features/meetup/PhotoViewer.jsx';
import { EVENTS } from './config.js';
import { directionsUrl } from './lib.js';
import { useBackClose } from './hooks.js';
import LazyImage from './loader/LazyImage.jsx';
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

/** A Highlight that ended more than this many days ago moves down to Latest events. */
const HIGHLIGHT_DAYS_AFTER_END = 2;
const DAY_MS = 24 * 3600 * 1000;

/**
 * Which section an event belongs in right now: a Highlight stays up the day it ends and the next 2 days, then moves
 * to Latest events for good.
 * @param {JgEvent} ev
 * @param {number} now
 * @returns {'highlight' | 'latest'}
 */
export function sectionOf(ev, now) {
  if (ev.section !== 'highlight') return ev.section;
  const last = Date.parse(`${ev.endDay ?? ev.day}T00:00:00Z`);
  const today = Date.parse(`${istDay(now)}T00:00:00Z`);
  return today - last > HIGHLIGHT_DAYS_AFTER_END * DAY_MS ? 'latest' : 'highlight';
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
      if (a.state === 'ended') return b.ev.day.localeCompare(a.ev.day) || (b.ev.start ?? '').localeCompare(a.ev.start ?? '');
      return a.ev.day.localeCompare(b.ev.day) || (a.ev.start ?? '').localeCompare(b.ev.start ?? '');
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
          <LazyImage compact src={ph.thumb ?? ph.src} alt="" loading="lazy" decoding="async" />
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
        aria-label={`${ev.title}. ${STATE_WORD[state]}. ${ev.short ?? ev.when}, ${puja?.n ?? ev.place ?? ''}${n ? `. ${n} photo${n > 1 ? 's' : ''}` : ''}`}
      >
        <span className="jg-ev-head">
          <span className="jg-ev-title">{ev.title}</span>
          <StateTag state={state} />
        </span>
        <span className="jg-ev-meta">{[ev.short ?? ev.when, puja?.n ?? ev.place].filter(Boolean).join(' · ')}</span>
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
      EVENTS.filter((e) => sectionOf(e, now) === key),
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
                <EventCard
                  key={ev.id}
                  ev={ev}
                  state={state}
                  puja={ev.pujaId ? byId.get(ev.pujaId) : undefined}
                  onOpen={() => onEvent(ev.id)}
                />
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
 * The photos in a row: each one 85% wide so the next peeks in, snapping one at a time, with dots below.
 * Every photo sits in the same 4:3 frame (portrait ones cropped from the top); tapping opens it whole, full screen.
 * @param {{ photos: { src: string, alt: string }[] }} props
 */
function PhotoRow({ photos }) {
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(/** @type {number | null} */ (null));
  const row = useRef(/** @type {HTMLDivElement | null} */ (null));
  const close = useCallback(() => setOpen(null), []);
  // Back closes the viewer only, through the same stack as the sheets.
  useBackClose(open !== null, close);
  const n = photos.length;
  if (n === 0) return null;
  return (
    <>
      <div
        ref={row}
        className={`jg-ev-row${n === 1 ? ' one' : ''}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          const slide = /** @type {HTMLElement | null} */ (el.firstElementChild);
          if (!slide) return;
          const step = slide.offsetWidth + 8;
          setAt(Math.min(n - 1, Math.round(el.scrollLeft / step)));
        }}
      >
        {photos.map((ph, i) => (
          <button
            key={ph.src}
            type="button"
            className="jg-ev-slide"
            aria-label={`Open photo ${i + 1} of ${n}: ${ph.alt}`}
            onClick={() => setOpen(i)}
          >
            <LazyImage
              src={ph.src}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalHeight > img.naturalWidth) img.classList.add('tall');
              }}
            />
          </button>
        ))}
      </div>
      {n > 1 && (
        <div className="jg-ev-dots" aria-hidden="true">
          {photos.map((ph, i) => (
            <span key={ph.src} className={i === at ? 'on' : undefined} />
          ))}
        </div>
      )}
      {open !== null && <PhotoViewer photos={photos} index={open} onClose={close} captions ownBack={false} />}
    </>
  );
}

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
      <ul className="jg-ev-facts">
        <li>
          <Icon name="calendar" size={18} />
          {ev.when}
        </li>
        {(puja || ev.place) && (
          <li>
            <Icon name="pin" size={18} />
            {puja ? `${puja.n}, ${puja.t}` : ev.place}
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
      <PhotoRow photos={ev.photos} />
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

/**
 * Footer for an event: Get directions to its puja (or its place), the one main action (same as a puja sheet).
 * @param {{ puja: import('./lib.js').JgPuja | undefined, place?: string }} props
 */
export function EventActions({ puja, place }) {
  const href = puja
    ? directionsUrl(puja.la, puja.lo)
    : place
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}&travelmode=walking`
      : null;
  if (!href) return null;
  return (
    <div className="jg-actions">
      <a className="btn primary block" href={href} target="_blank" rel="noopener noreferrer">
        <Icon name="nav" size={20} />
        Get directions
      </a>
    </div>
  );
}
