import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import { storage } from '../lib/storage.js';
import { renderGoogleButton } from './account.js';
import { IN_APP_BROWSER, useBackClose } from './hooks.js';
import { badgeArt, progressTo, rankOf, RANKS, statsOf, unlocked, unlockLine } from './ranks.js';
import { Avatar, ModalSheet } from './ui.jsx';

/** One message per reason the sign-in sheet opens (copy approved in the prototype). */
const SIGN_IN_COPY = {
  start: ['Start your puja tour', 'Sign in to count every puja you visit and unlock badges as you go.'],
  wish: ['Save pujas for later', 'Sign in to keep your wish list on any phone.'],
  visited: ['Keep track of your pujas', 'Sign in to mark pujas visited and see them on your profile.'],
  here: ['Count this puja', 'Sign in to count the pujas you visit and unlock badges as you go.'],
};

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
    <ModalSheet
      open={open}
      strong
      title={title}
      onClose={onClose}
      className="jg-signin"
      footer={
        <button type="button" className="btn jg-btn-outline block jg-later" onClick={onClose}>
          Later
        </button>
      }
    >
      <p className="jg-body">{text}</p>
      <div className="jg-gsi" aria-busy={busy || undefined}>
        <div ref={slot} className="jg-gsi-slot" data-busy={busy || undefined} />
        {busy && <span className="jg-spinner" aria-label="Signing you in" />}
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

/** Placeholder badge art: a lamp inside a ring of rays, grey with a lock until earned. */
export function BadgeArt({ i, locked = false, size = 48 }) {
  const a = badgeArt(i, locked);
  return (
    <span className="jg-badge-art" style={{ width: size, height: size }} data-locked={locked || undefined}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <path d={a.rays} stroke={a.c1} strokeWidth="5" strokeLinecap="round" />
        <circle cx="60" cy="58" r="40" fill={a.c2} stroke={a.c1} strokeWidth="5" />
        <path d="M60 30c9 11 15 19 15 29a15 15 0 0 1-30 0c0-10 6-18 15-29Z" fill={a.flame} />
        <rect x="44" y="80" width="32" height="8" rx="4" fill={a.c1} />
      </svg>
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
export function ProfileSheet({ open, account, byId, onClose, onOpenPuja, onRemoveWish, onSettings }) {
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
              <RankCardEarned stats={stats} cur={cur} />
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
                <p className="jg-pempty">Pujas you visit show here. Open a puja and tap Mark as visited.</p>
              ) : (
                <ul className="jg-list">
                  {visited.map((v) => {
                    const p = byId.get(v.puja);
                    return (
                      <li key={v.puja}>
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
                      </li>
                    );
                  })}
                </ul>
              ))}
            {tab === 'wish' &&
              (wish.length === 0 ? (
                <p className="jg-pempty">Tap the heart on a puja to save it here.</p>
              ) : (
                <ul className="jg-list">
                  {wish.map((w) => {
                    const p = byId.get(w.puja);
                    return (
                      <li key={w.puja} className="jg-wish-row">
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
                  return (
                    <li key={r.id} className="jg-ladder-row" data-got={got || undefined}>
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

function RankCardEarned({ stats, cur }) {
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
      </div>
    </section>
  );
}

/** Settings, opened from the profile card: celebration sound, privacy notice, sign out. */
export function SettingsSheet({ open, pending, track, onTrack, onClose, onSignOut }) {
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
      <a className="jg-choice" href="/privacy.html" target="_blank" rel="noopener">
        <span className="jg-choice-text">
          <span className="jg-choice-label">Privacy notice</span>
        </span>
        <Icon name="external" size={18} />
      </a>
      {pending > 0 && (
        <p className="jg-note">
          <Icon name="info" size={16} />
          {`${pending} ${pending === 1 ? 'change is' : 'changes are'} waiting for a network. Sign out now and ${pending === 1 ? 'it is' : 'they are'} lost.`}
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
