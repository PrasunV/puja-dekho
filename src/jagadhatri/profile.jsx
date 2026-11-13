import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import { storage } from '../lib/storage.js';
import { renderGoogleButton } from './account.js';
import { IN_APP_BROWSER, useBackClose } from './hooks.js';
import { badgeSvg, progressTo, rankOf, RANKS, statsOf, unlocked, unlockLine } from './ranks.js';
import { Avatar, ModalSheet, ViewCue } from './ui.jsx';

/** One message per reason the sign-in sheet opens (copy approved in the prototype). */
const SIGN_IN_COPY = {
  start: ['Start your puja tour', 'One tap with your Google account, and Puja Dekho keeps track for you.'],
  wish: ['Save pujas for later', 'Sign in to keep your wish list on any phone.'],
  visited: ['Keep track of your pujas', 'Sign in to mark pujas visited and see them on your profile.'],
  here: ['Count this puja', 'Sign in to count the pujas you visit and unlock badges as you go.'],
};

/** What signing in gives, shown on every sign-in sheet. */
/** @type {{ icon: import('../components/ui/Icon.jsx').IconName, text: string }[]} */
const BENEFITS = [
  { icon: 'award', text: 'Earn badges as you visit pujas' },
  { icon: 'heart', text: 'Keep your wish list on any phone' },
  { icon: 'share', text: 'Share your badges with friends' },
];

/** Why sign-in failed, in words the person can act on. */
export function signInError(/** @type {unknown} */ e) {
  const code = /** @type {any} */ (e)?.message;
  if (code === 'google_unavailable') return "Couldn't load Google sign-in. Check your network, then try again.";
  if (code === 'not_configured') return "Sign-in isn't ready yet. Please try again later.";
  if (!(/** @type {any} */ (e)?.status)) return 'No network. Connect, then try again.';
  return "Couldn't sign you in. Please try again.";
}

/**
 * The sign-in sheet: one title, one line, Google's button, Later.
 * @param {{ reason: 'start' | 'wish' | 'visited' | 'here' | null, busy: boolean, error: string | null, onCredential: (c: string) => void, onClose: () => void }} props
 */
export function SignInSheet({ reason, busy, error, onCredential, onClose }) {
  const open = reason != null;
  const [title, text] = SIGN_IN_COPY[reason ?? 'start'];
  const slot = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));
  const [attempt, setAttempt] = useState(0);
  const handler = useRef(onCredential);
  useEffect(() => {
    handler.current = onCredential;
  });
  useBackClose(open, onClose);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    // The sheet slides in first, so the button is measured at its real width.
    const t = setTimeout(() => {
      if (!slot.current) return;
      setLoadError(null);
      renderGoogleButton(slot.current, (c) => handler.current(c)).catch((e) => alive && setLoadError(signInError(e)));
    }, 260);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, attempt]);

  const message = error || loadError;
  return (
    <ModalSheet open={open} strong title={title} onClose={onClose} className="jg-signin">
      <p className="jg-body">{text}</p>
      <ul className="jg-benefits">
        {BENEFITS.map((b) => (
          <li key={b.icon}>
            <span className="jg-benefit-ic" aria-hidden="true">
              <Icon name={b.icon} size={18} />
            </span>
            {b.text}
          </li>
        ))}
      </ul>
      <div className="jg-signin-actions">
        <div className="jg-gsi" aria-busy={busy || undefined}>
          <div ref={slot} className="jg-gsi-slot" data-busy={busy || undefined} />
          {busy && <span className="jg-spinner" aria-label="Signing you in" />}
        </div>
        <button type="button" className="jg-notnow" onClick={onClose}>
          Not now
        </button>
      </div>
      {message && (
        <div className="jg-signin-error" role="alert">
          <p>{message}</p>
          {loadError && (
            <button type="button" className="btn small jg-btn-outline" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          )}
        </div>
      )}
      {IN_APP_BROWSER && (
        <p className="jg-note">
          <Icon name="info" size={16} />
          Google sign-in may not work inside a social app. If it doesn't, open this link in Chrome or Safari.
        </p>
      )}
      <p className="jg-caption jg-signin-terms">
        By continuing, you agree to our{' '}
        <a href="/privacy.html" target="_blank" rel="noopener">
          Privacy notice
        </a>
      </p>
    </ModalSheet>
  );
}

/** Badge art (placeholder until the final art arrives): grey with a lock until earned. */
export function BadgeArt({ i, locked = false, size = 48, label = false }) {
  return (
    <span className="jg-badge-art" style={{ width: size, height: size }} data-locked={locked || undefined}>
      {/* Markup built from constants in ranks.js, never from user input. */}
      <span className="jg-badge-svg" dangerouslySetInnerHTML={{ __html: badgeSvg(i, { locked, label, size }) }} />
      {locked && (
        <span className="jg-badge-lock">
          <Icon name="lock" size={14} />
        </span>
      )}
    </span>
  );
}

/** Before any badge: the first one and today's progress towards it. */
function FirstBadgeCard({ stats }) {
  const p = progressTo(stats, 0);
  return (
    <section className="jg-card jg-rank-card" aria-label="Your first badge">
      <BadgeArt i={0} locked size={56} />
      <div className="jg-rank-text">
        <p className="jg-label">Your first badge</p>
        <p className="jg-rank-name">{RANKS[0].name}</p>
        <p className="jg-meta">Visit 5 pujas in one day to unlock it</p>
        <Bar pct={p.pct} label={`${stats.today} of 5 today`} />
      </div>
    </section>
  );
}

function Upcoming({ stats, next, onSee }) {
  const p = progressTo(stats, next);
  return (
    <button type="button" className="jg-card jg-upcoming" onClick={() => onSee?.()} data-see>
      <span className="jg-upcoming-head">
        <span>
          Upcoming: <strong>{RANKS[next].name}</strong>
        </span>
        <span className="jg-see">
          See <Icon name="next" size={16} />
        </span>
      </span>
      <Bar pct={p.pct} label={null} />
      <span className="jg-meta">{unlockLine(p)}</span>
    </button>
  );
}

function Bar({ pct, label }) {
  return (
    <span className="jg-bar-wrap">
      <span className="jg-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span style={{ width: `${Math.min(100, Math.max(pct, pct > 0 ? 4 : 0))}%` }} />
      </span>
      {label && <span className="jg-bar-label">{label}</span>}
    </span>
  );
}

/**
 * The profile (design D): profile card, two stat cards, the rank card, the next badge, then Visited, Wish list and
 * Badges tabs. Only the tabs pin while the list scrolls.
 */
export function ProfileSheet({ open, account, byId, onClose, onOpenPuja, onRemoveWish, onSettings, onShare }) {
  const [tab, setTab] = useState(/** @type {'visited' | 'wish' | 'badges'} */ ('visited'));
  const [tall, setTall] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setTall(false);
  }
  const tabsRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const user = account.user;
  const [now] = useState(Date.now);
  const stats = statsOf(account.visited, now);
  const { cur, next } = rankOf(stats);
  const visited = account.visited.filter((v) => byId.has(v.puja));
  const wish = account.wish.filter((w) => byId.has(w.puja));

  const seeBadges = () => {
    setTab('badges');
    setTall(true);
    setTimeout(() => tabsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  };

  return (
    <ModalSheet
      open={open && !!user}
      title="Your profile"
      onClose={onClose}
      className={`jg-profile${tall ? ' tall' : ''}`}
      onBodyScroll={(e) => !tall && e.currentTarget.scrollTop > 4 && setTall(true)}
    >
      {user && (
        <>
          <button type="button" className="jg-card jg-me" onClick={onSettings} aria-label={`${user.name}. Open settings`}>
            <Avatar user={user} size={48} />
            <span className="jg-me-text">
              <span className="jg-me-name">{user.name}</span>
              <span className="jg-meta">Signed in with Google</span>
            </span>
            <span className="jg-me-gear" aria-hidden="true">
              <Icon name="gear" />
            </span>
          </button>

          <div className="jg-stats">
            <div className="jg-card jg-stat">
              <span className="jg-stat-n">{stats.today}</span>
              <span className="jg-stat-l">Pujas completed today</span>
            </div>
            <div className="jg-card jg-stat">
              <span className="jg-stat-n">{stats.total}</span>
              <span className="jg-stat-l">Total pujas completed</span>
            </div>
          </div>

          {cur < 0 ? (
            <FirstBadgeCard stats={stats} />
          ) : (
            <>
              <RankCardEarned stats={stats} cur={cur} onShare={() => onShare(cur)} />
              {next >= 0 && <Upcoming stats={stats} next={next} onSee={seeBadges} />}
            </>
          )}

          <div className="jg-ptabs" role="tablist" aria-label="Your pujas" ref={tabsRef}>
            {[
              ['visited', `Visited`, visited.length],
              ['wish', 'Wish list', wish.length],
              ['badges', 'Badges', null],
            ].map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className="jg-ptab"
                onClick={() => setTab(/** @type {any} */ (id))}
              >
                {label}
                {n != null && n > 0 && <span className="jg-ptab-n">{n}</span>}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="jg-ppanel">
            {tab === 'visited' &&
              (visited.length === 0 ? (
                <div className="jg-pempty">
                  <p className="jg-pempty-title">No pujas visited yet</p>
                  <p>Visit a puja and tap Yes when asked, or tap Mark as visited.</p>
                </div>
              ) : (
                <ul className="jg-list">
                  {visited.map((v) => {
                    const p = byId.get(v.puja);
                    return (
                      <li key={v.puja} className="jg-prow">
                        <button type="button" className="jg-row" onClick={() => onOpenPuja(v.puja)}>
                          <span className="jg-row-text">
                            <span className="jg-row-head">
                              <span className="jg-row-title">{p.n}</span>
                              {v.mode === 'manual' && <span className="jg-tag">Manual</span>}
                            </span>
                            <span className="jg-row-meta">
                              <span>{v.mode === 'manual' ? 'Not counted for badges' : p.t}</span>
                            </span>
                          </span>
                        </button>
                        <ViewCue onClick={() => onOpenPuja(v.puja)} />
                      </li>
                    );
                  })}
                </ul>
              ))}
            {tab === 'wish' &&
              (wish.length === 0 ? (
                <div className="jg-pempty">
                  <p className="jg-pempty-title">No pujas saved yet</p>
                  <p>Tap Wish list on any puja to save it here.</p>
                </div>
              ) : (
                <ul className="jg-list">
                  {wish.map((w) => {
                    const p = byId.get(w.puja);
                    return (
                      <li key={w.puja} className="jg-prow jg-wish-row">
                        <button type="button" className="jg-row" onClick={() => onOpenPuja(w.puja)}>
                          <span className="jg-row-text">
                            <span className="jg-row-title">{p.n}</span>
                            <span className="jg-row-meta">
                              <span>{p.t}</span>
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="jg-icon-btn jg-heart"
                          aria-label={`Remove ${p.n} from wish list`}
                          onClick={() => onRemoveWish(w.puja)}
                        >
                          <Icon name="heart" fill />
                        </button>
                        <ViewCue onClick={() => onOpenPuja(w.puja)} />
                      </li>
                    );
                  })}
                </ul>
              ))}
            {tab === 'badges' && (
              <ul className="jg-ladder">
                {RANKS.map((r, i) => {
                  const got = unlocked(stats, i);
                  const status = got
                    ? i === 0 && stats.best < 5
                      ? `Unlocked with ${RANKS[1].id}-Rank`
                      : 'Unlocked'
                    : i === 0
                      ? 'Unlocks at 5 pujas in one day'
                      : `Unlocks at ${r.need} pujas`;
                  const body = (
                    <>
                      <BadgeArt i={i} locked={!got} />
                      <span className="jg-row-text">
                        <span className="jg-row-head">
                          <span className="jg-row-title">{r.name}</span>
                          {i === cur && <span className="jg-tag tonal">Current</span>}
                        </span>
                        <span className="jg-row-meta">
                          <span>{`${r.id}-Rank · ${status}`}</span>
                        </span>
                      </span>
                    </>
                  );
                  // An earned badge opens the share screen for it.
                  return got ? (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="jg-ladder-row"
                        data-got=""
                        aria-label={`${r.id}-Rank ${r.name}, unlocked. Share it`}
                        onClick={() => onShare(i)}
                      >
                        {body}
                        <Icon name="next" size={20} />
                      </button>
                    </li>
                  ) : (
                    <li key={r.id} className="jg-ladder-row">
                      {body}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </ModalSheet>
  );
}

function RankCardEarned({ stats, cur, onShare }) {
  const r = RANKS[cur];
  const line = cur === 0 && stats.best >= 5 ? 'You completed 5 pujas in one day' : `You completed ${r.need} pujas`;
  return (
    <section className="jg-card jg-rank-card" aria-label={`${r.name}, ${r.id}-Rank`}>
      <BadgeArt i={cur} size={56} />
      <div className="jg-rank-text">
        <p className="jg-rank-name">
          {r.name} <span className="jg-tag tonal">{`${r.id}-Rank`}</span>
        </p>
        <p className="jg-meta">{line}</p>
        <button type="button" className="jg-share-pill" onClick={onShare} aria-label={`Share your ${r.name} badge`}>
          <svg
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
            <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
          </svg>
          Share
        </button>
      </div>
    </section>
  );
}

/**
 * Settings, opened from the profile card: celebration sound, counting visits, local or visitor, privacy notice, sign out.
 * @param {{ open: boolean, pending: number, track: boolean, onTrack: (on: boolean) => void, local: boolean,
 *   onLocal: (on: boolean) => void, onClose: () => void, onSignOut: () => void }} props
 */
export function SettingsSheet({ open, pending, track, onTrack, local, onLocal, onClose, onSignOut }) {
  const [sound, setSound] = useState(() => storage.get('jg_sound', true));
  useBackClose(open, onClose);
  return (
    <ModalSheet open={open} title="Settings" onClose={onClose} className="jg-settings">
      <button
        type="button"
        role="switch"
        aria-checked={sound}
        className="jg-choice jg-switch-row"
        onClick={() => {
          setSound(!sound);
          storage.set('jg_sound', !sound);
        }}
      >
        <span className="jg-choice-text">
          <span className="jg-choice-label">Celebration sound</span>
          <span className="jg-choice-count">Plays when you unlock a badge</span>
        </span>
        <span className="jg-switch" aria-hidden="true" />
      </button>
      <button type="button" role="switch" aria-checked={track} className="jg-choice jg-switch-row" onClick={() => onTrack(!track)}>
        <span className="jg-choice-text">
          <span className="jg-choice-label">Count visits with location</span>
          <span className="jg-choice-count">Asks when you spend 2 minutes at a puja</span>
        </span>
        <span className="jg-switch" aria-hidden="true" />
      </button>
      <button type="button" role="switch" aria-checked={local} className="jg-choice jg-switch-row" onClick={() => onLocal(!local)}>
        <span className="jg-choice-text">
          <span className="jg-choice-label">I live in town</span>
          <span className="jg-choice-count">Chandannagar, Mankundu or Bhadreswar</span>
        </span>
        <span className="jg-switch" aria-hidden="true" />
      </button>
      <a className="jg-choice" href="/privacy.html" target="_blank" rel="noopener">
        <span className="jg-choice-text">
          <span className="jg-choice-label">Privacy notice</span>
        </span>
        <Icon name="external" size={18} />
      </a>
      {pending > 0 && (
        <p className="jg-note">
          <Icon name="info" size={16} />
          {`${pending} ${pending === 1 ? "change hasn't" : "changes haven't"} been sent yet. Signing out deletes ${pending === 1 ? 'it' : 'them'}.`}
        </p>
      )}
      <button type="button" className="jg-choice jg-signout" onClick={onSignOut}>
        <Icon name="signout" />
        <span className="jg-choice-text">
          <span className="jg-choice-label">Sign out</span>
        </span>
      </button>
    </ModalSheet>
  );
}
