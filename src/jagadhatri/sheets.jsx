import { BentoCard, useBento } from '../components/ui/Bento.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { ABOUT } from './config.js';
import { directionsUrl, formatDistance, pujas as pujaCount } from './lib.js';
import { ViewCue } from './ui.jsx';
import { agoText } from './visit.js';

const CROWD_WORD = { free: 'Free', crowded: 'Crowded' };

/**
 * One row of the puja list (design: rows 52 tall, the name truncates; distance leads the meta line so it never does; View sits right).
 * @param {{ puja: import('./lib.js').JgPuja, d: number | null, onOpen: (id: string) => void, showTag?: boolean, crowd?: string }} props
 */
export function PujaRow({ puja, d, onOpen, showTag = false, crowd }) {
  return (
    <li className="jg-prow">
      <button type="button" className="jg-row" onClick={() => onOpen(puja.id)}>
        <span className="jg-row-text">
          <span className="jg-row-head">
            <span className="jg-row-title">{puja.n}</span>
            {showTag && puja.pop && <span className="jg-tag must">Must visit</span>}
            {crowd && <span className={`jg-tag ${crowd}`}>{CROWD_WORD[crowd]}</span>}
          </span>
          <span className="jg-row-meta">
            <span>{[d != null ? formatDistance(d) : null, puja.t, puja.c !== 'Other' ? puja.c : null].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
      </button>
      <ViewCue onClick={() => onOpen(puja.id)} />
    </li>
  );
}

/** Theme and artist cards: two in one row, each grows in place to full width when tapped (design 7.7). */
function ThemeArtist({ puja }) {
  const { open, toggle, stacked } = useBento({ theme: false, artist: false });
  const card = (/** @type {'theme' | 'artist'} */ key, icon, title, value) => (
    <BentoCard
      id={`${key}-${puja.id}`}
      icon={icon}
      title={title}
      open={open[key]}
      full={stacked}
      onToggle={() => toggle(key)}
      preview={<span className={value ? 'jg-bento-preview' : 'jg-bento-preview muted'}>{value || 'Not updated yet'}</span>}
    >
      <p className={value ? 'jg-bento-text' : 'jg-bento-text muted'}>{value || 'Not updated yet. Check back soon.'}</p>
    </BentoCard>
  );
  return (
    <div className="bento jg-bento" data-stacked={stacked || undefined}>
      {card('theme', 'palette', 'Puja theme', puja.th)}
      {card('artist', 'brush', 'Artist', puja.ar)}
    </div>
  );
}

/**
 * The puja sheet (design 7.6): name, Bengali name, meta line, tags, theme and artist, details. The buttons are in
 * `PujaActions`, pinned at the bottom of the sheet.
 * @param {{ puja: import('./lib.js').JgPuja, station: import('./lib.js').JgStation | undefined, onClose: () => void, visit?: { mode: string } | undefined, onVisited: (on: boolean) => void, crowd?: { level: string, n: number, at: number }, crowdAt?: number }} props
 */
export function PujaDetail({ puja, station, onClose, visit, onVisited, crowd, crowdAt = 0 }) {
  const meta = [puja.t, puja.y ? `Estd ${puja.y}` : null, station ? `${station.name} ${formatDistance(puja.st[1])}` : null].filter(Boolean);
  const facts = [
    ['Address', puja.ad],
    ['Police station', puja.ps],
    ['CCJPC No.', puja.cc != null ? String(puja.cc) : null],
  ].filter(([, v]) => v);
  return (
    <div className="jg-detail">
      <div className="jg-detail-head" data-sheet-head>
        <div className="jg-detail-titles">
          <h2 className="jg-title jg-puja-name">{puja.n}</h2>
          {puja.bn && (
            <p className="jg-bn" lang="bn">
              {puja.bn}
            </p>
          )}
          <p className="jg-meta">{meta.join(' · ')}</p>
          {crowd && (
            <p className="jg-crowd-line" data-level={crowd.level}>
              <span className="jg-crowd-dot" aria-hidden="true" />
              <strong>{CROWD_WORD[crowd.level]}</strong>
              {` · ${crowd.n} reports · ${agoText(crowd.at, crowdAt)}`}
            </p>
          )}
        </div>
        <button type="button" className="jg-icon-btn" aria-label="Close puja details" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div className="jg-tags">
        {puja.pop && <span className="jg-tag must">Must visit</span>}
        {puja.c !== 'Other' && <span className="jg-tag">{puja.c}</span>}
        {puja.j && <span className="jg-tag">{puja.j}</span>}
        {puja.pr && <span className="jg-tag proc">{`Procession · Zone ${puja.pr.z} · No. ${puja.pr.s}`}</span>}
      </div>
      <ThemeArtist key={puja.id} puja={puja} />
      {facts.length > 0 && (
        <dl className="jg-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {visit?.mode === 'person' ? (
        <p className="jg-visited-person">
          <Icon name="check" size={20} />
          Visited in person
        </p>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={!!visit}
          className="jg-choice jg-switch-row jg-visit"
          onClick={() => onVisited(!visit)}
        >
          <span className="jg-choice-text">
            <span className="jg-choice-label">Mark as visited</span>
            <span className="jg-choice-count">Not counted for badges</span>
          </span>
          <span className="jg-switch" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Get directions (the one main action) and the wish list heart. */
export function PujaActions({ puja, wished, onWish }) {
  return (
    <div className="jg-actions">
      <a className="btn primary block" href={directionsUrl(puja.la, puja.lo)} target="_blank" rel="noopener noreferrer">
        <Icon name="nav" size={20} />
        Get directions
      </a>
      <button type="button" className="btn jg-btn-outline jg-wish-btn" aria-pressed={wished} onClick={() => onWish(!wished)}>
        <Icon name="heart" size={20} fill={wished} />
        Wish list
      </button>
    </div>
  );
}

/** About (F12, F13): the short story, the maker, the map credit and the disclaimer. */
export function About({ onClose, onWelcome }) {
  return (
    <div className="jg-detail">
      <div className="jg-detail-head" data-sheet-head>
        <h2 className="jg-title">About Puja Dekho</h2>
        <button type="button" className="jg-icon-btn" aria-label="Close About" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <p className="jg-body">{ABOUT.story}</p>
      <button type="button" className="btn small jg-btn-outline jg-about-how" onClick={onWelcome}>
        <Icon name="info" size={16} />
        How Puja Dekho works
      </button>
      <p className="jg-body">
        Made with love by{' '}
        <a href={ABOUT.makerUrl} target="_blank" rel="noopener noreferrer">
          {ABOUT.maker}
        </a>
      </p>
      <p className="jg-body">
        <a href={ABOUT.durgaUrl}>Open Durga Puja Dekho</a>
      </p>
      <p className="jg-caption">Map data © OpenStreetMap contributors. Map tiles by OpenFreeMap. Distances are straight-line.</p>
      <p className="jg-caption">
        Fireworks sound:{' '}
        <a href="https://budgetpixel.com/sfx/firework-whistle-burst-b9184d6f" target="_blank" rel="noopener noreferrer">
          “Firework Whistle Burst”
        </a>{' '}
        by BudgetPixel AI, CC BY 4.0
      </p>
      <p className="jg-caption jg-disclaimer">{ABOUT.disclaimer}</p>
    </div>
  );
}

/** A plain list sheet with a title, used for "See popular pujas". */
export function PujaListSheet({ title, rows, onOpen, onClose }) {
  return (
    <div className="jg-detail">
      <div className="jg-detail-head" data-sheet-head>
        <div>
          <h2 className="jg-title">{title}</h2>
          <p className="jg-meta">{pujaCount(rows.length)}</p>
        </div>
        <button type="button" className="jg-icon-btn" aria-label={`Close ${title}`} onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <ul className="jg-list">
        {rows.map((r) => (
          <PujaRow key={r.puja.id} puja={r.puja} d={r.d} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}
