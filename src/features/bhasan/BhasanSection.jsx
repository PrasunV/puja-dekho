import { useCallback, useState } from 'react';
import { useApp } from '../../context/AppContext.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { formatDistance, haversine } from '../../lib/geo.js';
import ShareSheet from '../share/ShareSheet.jsx';
import ShareIcon from '../share/ShareIcon.jsx';
import { videoShare } from '../share/shareItems.js';
import { useLongPress } from '../share/useLongPress.js';
import { useBhasan } from './useBhasan.js';

/** The small share button on a card. It sits beside the card (never inside the link) and has a 48 px tap area. */
function ShareButton({ label, onShare, className = '' }) {
  return (
    <button type="button" className={`share-btn ${className}`} aria-label={label} onClick={onShare} data-testid="share-btn">
      <ShareIcon />
    </button>
  );
}

/** The chip that says where the ghat stands today. "Bhasan on now" is the only live-style one. */
export function GhatChip({ status }) {
  return (
    <span className={`tag ghat-chip${status.key === 'on' ? ' accent on' : ''}`} data-status={status.key}>
      {status.key === 'on' && <i className="pulse-dot" aria-hidden="true" />}
      {status.label}
    </span>
  );
}

/** Distance to the ghat, or null when the person's location is off (no error text, nothing shown). */
export function useGhatDistance(ghat) {
  const { position } = useApp();
  return position ? formatDistance(haversine(position.lat, position.lng, ghat.lat, ghat.lng)) : null;
}

function GhatCard({ config, status }) {
  const { openGhat } = useApp();
  const distance = useGhatDistance(config.ghat);
  return (
    <button type="button" className="ghat-card" data-testid="ghat-card" onClick={openGhat}>
      <span className="ghat-ic" aria-hidden="true">
        <Icon name="pin" size={22} />
      </span>
      <span className="ghat-body">
        <b className="ghat-name">{config.ghat.name}</b>
        <span className="ghat-area">{config.ghat.area}</span>
        <span className="ghat-meta">
          <GhatChip status={status} />
          <span className="tag ghat-chip" data-testid="ghat-started">{config.startedLabel}</span>
          <span className="tag ghat-vip">CM S.Adhikari visited</span>
          {distance && <span className="ghat-dist num">{distance}</span>}
        </span>
      </span>
      <span className="ghat-go" aria-hidden="true">
        <Icon name="chevron" size={20} />
      </span>
    </button>
  );
}

function PlayMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
    </svg>
  );
}

function VideoCard({ video, index, onShare }) {
  const press = useLongPress(onShare);
  const [broken, setBroken] = useState(false);
  const isLive = video.type === 'live';
  const kind = isLive ? 'Watch live' : 'Replay';
  return (
    <div className="vid-wrap">
    <a
      className="vid-card"
      data-type={video.type}
      data-testid={`video-${index}`}
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${kind}: ${video.title}, ${video.channel}. Opens YouTube in a new tab. Press and hold to share`}
      {...press}
    >
      <span className="vid-thumb" aria-hidden="true">
        {video.thumb && !broken && <img src={video.thumb} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />}
        <span className="vid-play">
          <PlayMark />
        </span>
        {isLive && video.live && (
          <span className="live-badge" data-testid="live-badge">
            <i className="pulse-dot" aria-hidden="true" />
            LIVE
          </span>
        )}
      </span>
      <span className="vid-text">
        <span className="vid-kind">
          <b>{kind}</b> · {video.channel}
        </span>
        <span className="vid-title">{video.title}</span>
      </span>
    </a>
    <ShareButton label={`Share: ${video.title}`} onShare={onShare} className="on-video" />
    </div>
  );
}

/**
 * The two timely sections above "Must-visit pujas": the ghat card and the Live / Replay row.
 * Both show until the end of 23 Oct 2026 (India time), then render nothing at all, so the list takes their place.
 */
export default function BhasanSection() {
  const { active, config, status } = useBhasan();
  const [sharing, setSharing] = useState(/** @type {import('../share/shareItems.js').ShareItem | null} */ (null));
  const close = useCallback(() => setSharing(null), []);
  if (!active) return null;
  return (
    <div className="bhasan" data-testid="bhasan">
      <section aria-label="Immersion ghat">
        <GhatCard config={config} status={status} />
      </section>
      <section aria-labelledby="bhasan-live-h">
        <h3 id="bhasan-live-h" className="bhasan-h">
          View live at
        </h3>
        <div className="vid-row">
          {config.videos.map((video, index) => (
            <VideoCard key={video.url} video={video} index={index} onShare={() => setSharing(videoShare(video))} />
          ))}
        </div>
      </section>
      <ShareSheet item={sharing} onClose={close} />
    </div>
  );
}
