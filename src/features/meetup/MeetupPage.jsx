import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PhotoViewer from './PhotoViewer.jsx';
import { useApp } from '../../context/AppContext.js';
import { BentoCard } from '../../components/ui/Bento.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { MEETUP, meetupDirectionsUrl, personLabel, personSite, taggedPeople } from '../../data/meetup.js';
import { onboardingReplay } from '../../data/bhasan.js';
// PARKED: the record player (see RecordPlayer.jsx). To bring it back, restore this import, the `song` in src/data/meetup.js,
// and the line below that renders it, and un-skip the 'record player' tests in e2e/meetup.spec.js.
// import RecordPlayer from './RecordPlayer.jsx';
import { playLoveSound } from './loveSound.js';
import { formatLoves, loveLab, useLove } from './useLove.js';
import { useStoredState } from '../../hooks/useStoredState.js';
import ShareIcon from '../share/ShareIcon.jsx';
import ShareSheet from '../share/ShareSheet.jsx';
import { meetupShare } from '../share/shareItems.js';

const initials = (/** @type {string} */ name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** A round profile picture; initials when there is no picture or it fails to load. */
function Avatar({ person, index }) {
  const [failed, setFailed] = useState(false);
  const picture = person.avatar && !failed;
  return (
    <span className={`mu-av mu-av-${index % 3}`} aria-hidden="true">
      {picture ? <img src={person.avatar} alt="" draggable="false" onError={() => setFailed(true)} /> : initials(person.name)}
    </span>
  );
}

/** One photo in a 4:3 frame. Tags are not drawn on the photo; the people sit in the chip below the dots. */
function Photo({ photo, index, onOpen }) {
  return (
    <figure className="mu-photo" data-testid={`mu-photo-${index}`}>
      <button type="button" className="mu-photo-hit" aria-label={`Open photo ${index + 1} full screen`} onClick={() => onOpen(index)} />
      <img
        src={photo.src}
        alt={photo.alt}
        style={photo.focus ? { objectPosition: photo.focus } : undefined}
        loading={index === 0 ? 'eager' : 'lazy'}
        draggable="false"
      />
    </figure>
  );
}

/** The photos with pagination dots (left aligned) under the frame. */
function Gallery() {
  const [at, setAt] = useState(0);
  const [viewer, setViewer] = useState(/** @type {number | null} */ (null));
  const closeViewer = useCallback(() => setViewer(null), []);
  const count = MEETUP.photos.length;
  return (
    <div className="mu-media">
      {viewer !== null && <PhotoViewer photos={MEETUP.photos} index={viewer} onClose={closeViewer} />}
      <div
        className="mu-gallery"
        data-no-sheet-drag
        role="group"
        aria-label="Meetup photos"
        data-testid="mu-gallery"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))));
        }}
      >
        {MEETUP.photos.map((photo, index) => (
          <Photo key={photo.src} photo={photo} index={index} onOpen={setViewer} />
        ))}
      </div>
      {count > 1 && (
        <div className="mu-dots" data-testid="mu-dots">
          {MEETUP.photos.map((photo, index) => (
            <span key={photo.src} className={`mu-dot${index === at ? ' on' : ''}`} aria-hidden="true" />
          ))}
          <span className="visually-hidden" aria-live="polite">
            Photo {at + 1} of {count}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Tagged people: one chip with the first three profile circles, the first person's name and "+N". Tapping it opens
 * one chip per person, each a link to their Instagram or Facebook in a new tab.
 */
function People({ people }) {
  const [open, setOpen] = useState(false);
  const shown = people.slice(0, 3);
  return (
    <div className="mu-people" data-testid="mu-people">
      <div className="mu-bar">
        {people.length > 0 && (
          <button
            type="button"
            className="chip compact mu-stack"
            aria-expanded={open}
            aria-controls="mu-handles"
            aria-label={`${people[0].name}${people.length > 1 ? ` and ${people.length - 1} more` : ''} tagged. ${open ? 'Hide' : 'Show'} their profile links`}
            data-testid="mu-stack"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="mu-avatars">
              {shown.map((person, index) => (
                <Avatar key={person.url} person={person} index={index} />
              ))}
            </span>
            <span className="mu-first">{shown[0].name}</span>
            {people.length > 1 && <span className="num mu-more">+{people.length - 1}</span>}
            <svg
              className={`mu-caret${open ? ' open' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="mu-handles"
            className="mu-handles"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
          >
            {people.map((person, index) => (
              <a
                key={person.url}
                className="chip compact mu-person"
                href={person.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${person.name} on ${personSite(person)}`}
                data-testid="mu-person"
              >
                <Avatar person={person} index={index} />
                {personLabel(person)}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A hand-drawn style illustration for the intro card: a phone with a heart on its screen, with sparkles and hearts floating around it. Drawn with plain strokes and the app's colour tokens so it works in light and dark.
 */
function CelebfieArt() {
  const spark = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r) => (
    <path d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`} />
  );
  return (
    <svg
      className="mu-art"
      viewBox="0 0 240 132"
      role="img"
      aria-label="A phone taking a selfie, with hearts and sparkles"
      data-testid="mu-art"
    >
      <g className="mu-art-line" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <ellipse className="mu-art-ground" cx="120" cy="122" rx="62" ry="5" stroke="none" />
        <g transform="rotate(-7 120 70)">
          <rect className="mu-art-phone" x="86" y="22" width="68" height="92" rx="12" />
          <rect x="93" y="30" width="54" height="68" rx="6" />
          <path d="M112 105h16" />
          <circle cx="120" cy="26.5" r="0.6" />
          <path className="mu-art-heart" d="M120 82s-16-9.5-16-21a8.4 8.4 0 0 1 16-3.6A8.4 8.4 0 0 1 136 61c0 11.5-16 21-16 21Z" />
          <path d="M104 47c3-4 7-6 12-6" opacity="0.5" />
        </g>
      </g>
      <g className="mu-art-spark">
        {spark(48, 38, 9)}
        {spark(196, 30, 11)}
        {spark(176, 64, 6)}
        {spark(70, 66, 5)}
      </g>
      <g className="mu-art-love">
        <path d="M206 78s-9-5.2-9-11.5a4.6 4.6 0 0 1 9-2 4.6 4.6 0 0 1 9 2c0 6.3-9 11.5-9 11.5Z" />
        <path d="M30 78s-6-3.5-6-7.7a3.1 3.1 0 0 1 6-1.3 3.1 3.1 0 0 1 6 1.3c0 4.2-6 7.7-6 7.7Z" opacity="0.6" />
      </g>
    </svg>
  );
}

/** The one-time "What's new" card, in the style of Instagram's map card: two short rows and one button. */
function Intro({ onClose }) {
  const button = useRef(/** @type {HTMLButtonElement | null} */ (null));
  useEffect(() => {
    const frame = requestAnimationFrame(() => button.current?.focus());
    const onKey = (/** @type {KeyboardEvent} */ event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return createPortal(
    <motion.div className="sheet-scrim mu-intro-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="sheet mu-intro"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mu-intro-title"
        data-testid="mu-intro"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
      >
        <CelebfieArt />
        <h2 id="mu-intro-title">Celebfie is on. Join the challenge.</h2>
        <div className="mu-intro-row">
          <span className="mu-intro-ic" aria-hidden="true">
            <Icon name="heart" size={22} />
          </span>
          <div>
            <b>Take part</b>
            <p>Tap Join challenge to fill in a short form and you're in.</p>
          </div>
        </div>
        <div className="mu-intro-row">
          <span className="mu-intro-ic" aria-hidden="true">
            <Icon name="star" size={22} />
          </span>
          <div>
            <b>How it started</b>
            <p>
              It began on a Shashthi night in Shyambazar, when we met the OG Bengali creators: Tapojit da, Bishal da and Rohit da. See the
              photos.
            </p>
          </div>
        </div>
        <div className="mu-intro-row">
          <span className="mu-intro-ic" aria-hidden="true">
            <Icon name="pin" size={22} />
          </span>
          <div>
            <b>Find the pin</b>
            <p>Look for the round photo pin on the map, or tap What's new any time.</p>
          </div>
        </div>
        <button ref={button} type="button" className="btn dark block" onClick={onClose}>
          Got it
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** The meetup recap: headline, photos with dots, tagged people, the text and the place. */
export default function MeetupPage() {
  const { back, toast, setSheet } = useApp();
  const people = taggedPeople();
  const [introStored, setIntroStored] = useStoredState('meetupIntroSeen', false);
  // Until the Bijoya replay ends, the card shows once per open for everyone, so it can be reviewed again.
  const [replay] = useState(() => onboardingReplay());
  const [introSession, setIntroSession] = useState(false);
  const introSeen = replay ? introSession : introStored;
  const closeIntro = useCallback(() => {
    setIntroSession(true);
    setIntroStored(true);
  }, [setIntroStored]);
  const [open, setOpen] = useState(false);
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(MEETUP.place.address);
      toast('Address copied');
    } catch {
      toast("Couldn't copy the address. Press and hold it to copy.");
    }
  };
  return (
    <div className="stack mu-page" data-testid="meetup-page">
      <div className="detail-head" data-sheet-head>
        <div className="detail-id">
          <h2>{MEETUP.headline}</h2>
          <div className="sub" data-testid="mu-meta">
            {MEETUP.place.short} · {MEETUP.date}
          </div>
        </div>
        <button type="button" className="back back-btn" aria-label="Close highlights" onClick={back}>
          <Icon name="x" size={22} />
        </button>
      </div>

      <Gallery />

      <People people={people} />

      {/* PARKED: record player under the tagged chips.
      {MEETUP.song && <RecordPlayer song={MEETUP.song} />}
      */}

      <p className="mu-blurb">{MEETUP.blurb}</p>

      <div className="bento">
        <BentoCard
          id="mu-place"
          icon="pin"
          title="Place"
          preview={<b className="bp-big">{MEETUP.place.name}</b>}
          open={open}
          onToggle={() => {
            if (!open) setSheet('full');
            setOpen((v) => !v);
          }}
          full
        >
          <p className="bento-address">{MEETUP.place.address}</p>
          <div className="row wrap bento-actions">
            <button type="button" className="btn small" onClick={copyAddress}>
              <Icon name="copy" size={18} />
              Copy
            </button>
            <a className="btn small" target="_blank" rel="noopener noreferrer" href={meetupDirectionsUrl()}>
              <Icon name="nav" size={18} />
              Directions
            </a>
          </div>
        </BentoCard>
      </div>

      <AnimatePresence>{!introSeen && <Intro key="intro" onClose={closeIntro} />}</AnimatePresence>
    </div>
  );
}

/**
 * The love button: a round floating button above the pinned buttons, with three looks.
 *  idle    outline heart, light grey (icon only)
 *  clicked the same button, darker, for a moment while the tap lands (icon only)
 *  liked   filled pink-red heart and the number
 * A love cannot be taken back. In the preview it can be tapped again and again.
 */
function LoveFab() {
  const { count, loved, love } = useLove(MEETUP.id);
  const [clicked, setClicked] = useState(false);
  const [taps, setTaps] = useState(0);
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined));
  useEffect(() => () => clearTimeout(timer.current), []);
  const state = clicked ? 'clicked' : loved ? 'liked' : 'idle';
  const label = count ? `${count} ${count === 1 ? 'love' : 'loves'}` : 'No loves yet';
  const tap = () => {
    if (loved && !loveLab()) return;
    playLoveSound();
    love();
    setClicked(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setClicked(false);
      setTaps((n) => n + 1);
    }, 280);
  };
  return (
    <button
      type="button"
      className={`mu-fab ${state}${taps > 0 && state === 'liked' ? ' tapped' : ''}`}
      aria-pressed={loved}
      aria-label={loved ? `You loved this meetup. ${label}` : `Love this meetup. ${label}`}
      data-testid="mu-love"
      data-state={state}
      onClick={tap}
    >
      <span key={taps} className="mu-heart-wrap" aria-hidden="true">
        {taps > 0 && state === 'liked' && (
          <span className="mu-burst">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <i key={i} style={{ '--a': `${i * 60}deg` }} />
            ))}
          </span>
        )}
        <svg
          className="mu-heart"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill={state === 'liked' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.6c0 5.6-7.5 10.2-7.5 10.2Z" />
        </svg>
      </span>
      <span className="num mu-fab-n">{count ? formatLoves(count) : ''}</span>
    </button>
  );
}

/** Pinned buttons: the next-meetup link (or Directions when there is no next meetup) and Share. */
export function MeetupActions() {
  const [sharing, setSharing] = useState(false);
  const close = useCallback(() => setSharing(false), []);
  const next = MEETUP.next;
  return (
    <div className="actions">
      <LoveFab />
      <div className="row actions-row">
        {next ? (
          <a className="btn primary grow" target="_blank" rel="noopener noreferrer" href={next.url} data-testid="mu-join">
            {next.label}
          </a>
        ) : (
          <a className="btn primary grow" target="_blank" rel="noopener noreferrer" href={meetupDirectionsUrl()}>
            <Icon name="nav" />
            Get directions
          </a>
        )}
        <button type="button" className="btn save share-act" data-testid="meetup-share" onClick={() => setSharing(true)}>
          <ShareIcon />
          Share
        </button>
      </div>
      <ShareSheet item={sharing ? meetupShare() : null} onClose={close} />
    </div>
  );
}
