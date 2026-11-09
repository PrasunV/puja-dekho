import { BentoCard, useBento } from '../components/ui/Bento.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { ABOUT, WHATS_NEW } from './config.js';
import { directionsUrl, formatDistance, pujas as pujaCount } from './lib.js';

/**
 * One row of the puja list (design: rows 52 tall, the name truncates, distances never do).
 * @param {{ puja: import('./lib.js').JgPuja, d: number | null, onOpen: (id: string) => void }} props
 */
export function PujaRow({ puja, d, onOpen }) {
  return (
    <li>
      <button type="button" className="jg-row" onClick={() => onOpen(puja.id)}>
        <span className="jg-row-text">
          <span className="jg-row-title">{puja.n}</span>
          <span className="jg-row-meta">
            {puja.pop && <span className="jg-tag must">Must visit</span>}
            <span>{[puja.t, puja.c !== 'Other' ? puja.c : null].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
        {d != null && <span className="jg-row-stat">{formatDistance(d)}</span>}
      </button>
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
 * @param {{ puja: import('./lib.js').JgPuja, station: import('./lib.js').JgStation | undefined, onClose: () => void }} props
 */
export function PujaDetail({ puja, station, onClose }) {
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
      <p className="jg-soon">Wish list and Mark as visited come with Google sign-in, before Panchami on 14 Nov.</p>
    </div>
  );
}

/** Get directions (the one main action) and the Wish list placeholder until sign-in ships. */
export function PujaActions({ puja }) {
  return (
    <div className="jg-actions">
      <a className="btn primary block" href={directionsUrl(puja.la, puja.lo)} target="_blank" rel="noopener noreferrer">
        <Icon name="nav" size={20} />
        Get directions
      </a>
      <button type="button" className="btn jg-btn-outline" disabled aria-describedby="jg-wish-soon">
        <Icon name="heart" size={20} />
        Wish list
      </button>
      <span id="jg-wish-soon" className="sr-only">
        Coming with sign-in before 14 Nov
      </span>
    </div>
  );
}

/** What's new (design 7.3, PRD chip row): the latest happenings, or an empty state. */
export function WhatsNew({ byId, onClose, onOpenPuja }) {
  return (
    <div className="jg-detail">
      <div className="jg-detail-head" data-sheet-head>
        <h2 className="jg-title">What's new</h2>
        <button type="button" className="jg-icon-btn" aria-label="Close What's new" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      {WHATS_NEW.length === 0 && (
        <div className="jg-empty">
          <p>No updates yet. News from the pujas shows here during the festival.</p>
        </div>
      )}
      {WHATS_NEW.map((item) => {
        const puja = byId.get(item.pujaId);
        return (
          <article key={item.id} className="jg-news">
            {item.past && <span className="jg-tag">Past event</span>}
            <h3 className="jg-news-title">{item.title}</h3>
            <p className="jg-meta">{item.by}</p>
            <ul className="jg-news-facts">
              <li>
                <Icon name="calendar" size={16} />
                {item.when}
              </li>
              <li>
                <Icon name="users" size={16} />
                {item.participants}
              </li>
            </ul>
            <p className="jg-body">{item.body}</p>
            {item.photos.length > 0 && (
              <div className="jg-photos">
                {item.photos.map((ph) => (
                  <img key={ph.src} src={ph.src} alt={ph.alt} loading="lazy" />
                ))}
              </div>
            )}
            <div className="jg-news-actions">
              {puja && (
                <a className="btn dark small" href={directionsUrl(puja.la, puja.lo)} target="_blank" rel="noopener noreferrer">
                  <Icon name="nav" size={16} />
                  Directions
                </a>
              )}
              {puja && (
                <button type="button" className="btn small jg-btn-outline" onClick={() => onOpenPuja(puja.id)}>
                  See the puja
                </button>
              )}
              {item.facebook && (
                <a className="btn small jg-btn-outline" href={item.facebook} target="_blank" rel="noopener noreferrer">
                  Visit Facebook page
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** About (F12, F13): the short story, the maker, the map credit and the disclaimer. */
export function About({ onClose }) {
  return (
    <div className="jg-detail">
      <div className="jg-detail-head" data-sheet-head>
        <h2 className="jg-title">About Puja Dekho</h2>
        <button type="button" className="jg-icon-btn" aria-label="Close About" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <p className="jg-body">{ABOUT.story}</p>
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
