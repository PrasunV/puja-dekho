import { BentoCard, useBento } from '../components/ui/Bento.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { ABOUT } from './config.js';
import { directionsUrl, formatDistance, pujas as pujaCount } from './lib.js';
import { ViewCue } from './ui.jsx';
import { agoText } from './visit.js';
import { awardsOf } from './winners.js';

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

/**
 * Theme and artist cards: two in one row, each grows in place to full width when tapped (design 7.7).
 * A puja with no theme and no artists shows no cards; one with only a theme shows the theme card across the row.
 */
function ThemeArtist({ puja }) {
  const { open, toggle, stacked } = useBento({ theme: false, artist: false });
  const artists = puja.ar ?? [];
  if (!puja.th && artists.length === 0) return null;
  const both = !!puja.th && artists.length > 0;
  return (
    <div className="bento jg-bento" data-stacked={stacked || undefined}>
      {puja.th && (
        <BentoCard
          id={`theme-${puja.id}`}
          icon="palette"
          title="Puja theme"
          open={open.theme}
          full={stacked || !both}
          onToggle={() => toggle('theme')}
          preview={<span className="jg-bento-preview">{puja.th}</span>}
        >
          <p className="jg-bento-text">{puja.th}</p>
        </BentoCard>
      )}
      {artists.length > 0 && (
        <BentoCard
          id={`artist-${puja.id}`}
          icon="brush"
          title={artists.length === 1 ? 'Artist' : 'Artists'}
          open={open.artist}
          full={stacked || !both}
          onToggle={() => toggle('artist')}
          preview={<span className="jg-bento-preview">{artists.map(([name]) => name).join(', ')}</span>}
        >
          <ul className="jg-artists">
            {artists.map(([name, role], i) => (
              <li key={`${name}-${role ?? ''}-${i}`}>
                <span className="jg-artist-name">{name}</span>
                {role && <span className="jg-artist-role">{role}</span>}
              </li>
            ))}
          </ul>
        </BentoCard>
      )}
    </div>
  );
}

/**
 * The puja sheet (design 7.6): name, Bengali name, meta line, tags, theme and artist, details. The buttons are in
 * `PujaActions`, pinned at the bottom of the sheet.
 * @param {{ puja: import('./lib.js').JgPuja, station: import('./lib.js').JgStation | undefined, onClose: () => void, visit?: { mode: string } | undefined, onVisited: (on: boolean) => void, crowd?: { level: string, n: number, at: number }, crowdAt?: number, onWinners?: () => void }} props
 */
export function PujaDetail({ puja, station, onClose, visit, onVisited, crowd, crowdAt = 0, onWinners }) {
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
        {onWinners &&
          awardsOf(puja.id).map(({ award, label }) => (
            <button
              key={award.id}
              type="button"
              className="jg-tag jg-tag-award"
              aria-label={`Winner, ${award.en}, ${label}. See all winners`}
              onClick={onWinners}
            >
              <Icon name="star" size={16} />
              {`${award.en} · ${label}`}
            </button>
          ))}
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
            <span className="jg-choice-count">Counts for badges</span>
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

/** About (F12, F13): the short story, the two buttons, the credits and the disclaimer. The maker line is the pinned AboutFooter. */
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
      <div className="jg-about-btns">
        <button type="button" className="btn block jg-btn-outline" onClick={onWelcome}>
          <Icon name="info" size={16} />
          How Puja Dekho works
        </button>
        <a className="btn block jg-btn-tonal" href={ABOUT.durgaUrl}>
          Open Durga Puja Dekho
          <Icon name="arrowNE" size={16} />
        </a>
      </div>
      <p className="jg-caption">Map data © OpenStreetMap contributors. Map tiles by OpenFreeMap. Distances are straight-line.</p>
      <p className="jg-caption">
        Map data contributions: {ABOUT.mapCredit.name} from{' '}
        <a href={ABOUT.mapCredit.url} target="_blank" rel="noopener noreferrer">
          {ABOUT.mapCredit.site}
        </a>
      </p>
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

/** The pinned bar at the bottom of About: a contrast fill (dark in light, light in dark), the whole line opens the maker's LinkedIn. */
export function AboutFooter() {
  return (
    <a
      className="jg-credit"
      href={ABOUT.makerUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Made with love by ${ABOUT.maker}, opens LinkedIn in a new tab`}
    >
      Made with
      <span className="jg-credit-heart">
        <Icon name="heart" size={18} fill />
      </span>
      by <strong>{ABOUT.maker}</strong>
      <Icon name="arrowNE" size={16} />
    </a>
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
