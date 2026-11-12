import { MotionConfig } from 'motion/react';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui/Icon.jsx';
import BottomSheet from '../features/layout/BottomSheet.jsx';
import { ViewCount } from '../features/layout/MapOverlays.jsx';
import { useLiveCount } from '../hooks/useLiveCount.js';
import { useOnline } from '../hooks/useOnline.js';
import { useVisitCount } from '../hooks/useVisitCount.js';
import {
  AGE_GROUPS,
  APPROX_ACCURACY_M,
  CATEGORIES,
  FAR_FROM_TOWN_M,
  POPULAR_ORDER,
  RADIUS_STEPS,
  STATION_RADIUS_M,
  TOWN_POINT,
  TOWNS,
  ZONES,
} from './config.js';
import { storage } from '../lib/storage.js';
import { useAccount, useCrowd } from './account.js';
import { IN_APP_BROWSER, useBackClose, useGeo, useJgData, useToast } from './hooks.js';
import {
  ageGroup,
  countsByRadius,
  formatDistance,
  haversine,
  makeIndex,
  moreCount,
  NO_FILTERS,
  passes,
  pujas as pujaCount,
  visibleList,
} from './lib.js';
import { Celebration, primeSound, ShareScreen } from './celebrate.jsx';
import { ProfileSheet, SettingsSheet, SignInSheet, signInError } from './profile.jsx';
import { rankOf, statsOf } from './ranks.js';
import { TrafficDetail } from './traffic.jsx';
import { NO_STAY, nextStay, sayNo, saidNoToday, stayedLongEnough } from './visit.js';
import { VisitBar } from './VisitBar.jsx';
import { Welcome } from './Welcome.jsx';
import { EventActions, EventDetail, eventById, WhatsNew } from './events.jsx';
import { About, PujaActions, PujaDetail, PujaListSheet, PujaRow } from './sheets.jsx';
import { ChoiceRow, ModalSheet, RadiusTrigger, SearchBar, Section, useCollapse } from './ui.jsx';

const JgMap = React.lazy(() => import('./JgMap.jsx'));

/** Near me re-centres only after the person has walked this far, so the list never jumps under a finger. */
const RECENTRE_M = 40;
/** The sign-in sheet opens once a session, after this much time on screen (design 7.14). */
const NUDGE_AFTER_S = 300;
/** Past tense, 1 to 5 words (design 7.18). */
const TOAST_TEXT = {
  'wish:true': 'Added to wish list',
  'wish:false': 'Removed from wish list',
  'visited:true': 'Marked as visited',
  'visited:false': 'Unmarked as visited',
};

/**
 * @typedef {{ kind: 'list' } | { kind: 'puja', id: string } | { kind: 'whatsnew' } | { kind: 'traffic' } | { kind: 'event', id: string } | { kind: 'about' } | { kind: 'popular' }} View
 */

export default function App() {
  const { data, error, retry } = useJgData();
  if (error) {
    return (
      <div className="jg-fail" role="alert">
        <h1 className="jg-title">Couldn't load the pujas</h1>
        <p className="jg-body">Check your connection, then try again.</p>
        <button type="button" className="btn dark" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="jg-loading" aria-busy="true" aria-label="Loading pujas">
        <div className="jg-skel bar" />
        <div className="jg-skel chips" />
      </div>
    );
  }
  return (
    <MotionConfig reducedMotion="user">
      <Loaded data={data} />
    </MotionConfig>
  );
}

/** @param {{ data: { pujas: import('./lib.js').JgPuja[], stations: import('./lib.js').JgStation[] } }} props */
function Loaded({ data }) {
  const { pujas, stations } = data;
  const byId = useMemo(() => new Map(pujas.map((p) => [p.id, p])), [pujas]);
  const stById = useMemo(() => new Map(stations.map((s) => [s.id, s])), [stations]);
  const defaultOrder = useMemo(() => visibleList(pujas, NO_FILTERS, null).map((r) => r.puja), [pujas]);
  const pujaIndex = useMemo(() => makeIndex(defaultOrder, (p) => ({ main: p.n, extra: [p.t, p.bn || ''] })), [defaultOrder]);
  const stationIndex = useMemo(
    () => makeIndex(stations, (s) => ({ main: s.name, extra: [s.kind === 'ghat' ? 'ferry ghat' : 'railway station'] })),
    [stations],
  );
  const popular = useMemo(
    () => /** @type {import('./lib.js').JgPuja[]} */ (POPULAR_ORDER.map((id) => byId.get(id)).filter(Boolean)),
    [byId],
  );
  const mustVisitRows = useMemo(() => defaultOrder.filter((p) => p.pop).map((puja) => ({ puja, d: null })), [defaultOrder]);

  const online = useOnline();
  const visits = useVisitCount({ path: '/jagadhatri/visits', key: 'jg_visitCount' });
  const live = useLiveCount({ path: '/jagadhatri/live' });
  const geo = useGeo();
  const { toast, show, hide } = useToast();
  const account = useAccount();
  const crowd = useCrowd();
  // Counting visits with location: asked once after sign-in (null = not asked yet). Location stays on the phone.
  const [track, setTrackState] = useState(() => /** @type {boolean | null} */ (storage.get('jg_track', null)));
  const setTrack = (/** @type {boolean} */ v) => {
    setTrackState(v);
    storage.set('jg_track', v);
  };
  const tracking = account.signedIn && track === true;
  const mapRef = useRef(/** @type {import('./JgMap.jsx').MapHandle | null} */ (null));

  const [view, setView] = useState(/** @type {View} */ ({ kind: 'list' }));
  const [sheet, setSheet] = useState(/** @type {'peek' | 'initial' | 'half' | 'full'} */ ('initial'));
  // The full sheet stops 8 px under the search bar's tap area (4-point grid). Measured, so safe areas and text size count.
  const searchRowRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [topInset, setTopInset] = useState(76);
  useEffect(() => {
    const el = searchRowRef.current;
    if (!el) return undefined;
    const measure = () => setTopInset(Math.round(el.getBoundingClientRect().bottom + 8));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const [filtersRaw, setFilters] = useState(NO_FILTERS);
  // The two "Your pujas" filters read the wish list and visited pujas; signed out, they are off.
  const mine = useMemo(
    () => ({ wish: new Set(account.wish.map((w) => w.puja)), visited: new Set(account.visited.map((v) => v.puja)) }),
    [account.wish, account.visited],
  );
  const filters = useMemo(
    () =>
      account.signedIn
        ? { ...filtersRaw, mine, crowd: crowd.crowd }
        : { ...filtersRaw, wish: false, notVisited: false, crowd: crowd.crowd },
    [filtersRaw, mine, account.signedIn, crowd.crowd],
  );
  /** Why the sign-in sheet is open, and the change to make once signed in. */
  const [signIn, setSignIn] = useState(
    /** @type {{ reason: 'start' | 'wish' | 'visited' | 'here', change?: import('./account.js').Change } | null} */ (null),
  );
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInErr, setSignInErr] = useState(/** @type {string | null} */ (null));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [choosing, setChoosing] = useState(/** @type {null | 'type' | 'stations' | 'more' | 'locate' | 'profile' | 'track'} */ (null));
  const [stationOpen, stationToggle] = useCollapse(choosing === 'stations');
  const [searchOpen, setSearchOpen] = useState(false);
  // First-visit card: once per phone (About opens it again). Until it is closed, nothing else asks for anything.
  const [welcome, setWelcome] = useState(() => !storage.get('jg_welcome_seen', false));
  const closeWelcome = useCallback(() => {
    setWelcome(false);
    storage.set('jg_welcome_seen', true);
  }, []);
  const [picked, setPicked] = useState(/** @type {{ kind: 'puja' | 'station', id: string, name: string } | null} */ (null));
  const [stationCentre, setStationCentre] = useState(/** @type {{ id: string, radius: number } | null} */ (null));
  const [near, setNear] = useState({ on: false, radius: RADIUS_STEPS[0] });
  const [meCentre, setMeCentre] = useState(/** @type {{ lat: number, lng: number } | null} */ (null));
  const [panning, setPanning] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const camBeforePick = useRef(/** @type {ReturnType<import('./JgMap.jsx').MapHandle['camera']>} */ (null));
  const sheetBeforeSearch = useRef(sheet);
  /** What a pending location request is for, once the first fix arrives. */
  const wantFix = useRef(/** @type {null | 'near' | 'locate'} */ (null));

  // ---------- Location ----------
  const pos = geo.position;
  const farM = useMemo(() => {
    if (!pos) return null;
    let min = Infinity;
    for (const p of pujas) min = Math.min(min, haversine(pos.lat, pos.lng, p.la, p.lo));
    return min > FAR_FROM_TOWN_M ? haversine(pos.lat, pos.lng, TOWN_POINT.lat, TOWN_POINT.lng) : null;
  }, [pos, pujas]);
  const approx = !!pos && pos.accuracy > Math.max(APPROX_ACCURACY_M, near.radius);

  // The Near me centre moves only after a 40 m walk (set while rendering, so there is no extra frame).
  if (near.on && pos && farM == null && (!meCentre || haversine(meCentre.lat, meCentre.lng, pos.lat, pos.lng) > RECENTRE_M)) {
    setMeCentre({ lat: pos.lat, lng: pos.lng });
  }

  // First fix after a request: fit the circle (Near me) or fly to the dot (location button).
  useEffect(() => {
    if (!pos || !wantFix.current) return;
    const why = wantFix.current;
    wantFix.current = null;
    if (farM != null) {
      if (why === 'locate') show(`You are ${formatDistance(farM)} from ${TOWN_POINT.name}`);
      return;
    }
    if (why === 'near') mapRef.current?.fitRadius(pos.lat, pos.lng, near.radius);
    else mapRef.current?.flyTo(pos.lat, pos.lng, 16);
  }, [pos, farM, near.radius, show]);

  useEffect(() => {
    if (geo.status === 'denied' && wantFix.current === 'locate') {
      wantFix.current = null;
      show('Location is off for Puja Dekho');
    }
  }, [geo.status, show]);

  const askLocation = useCallback(
    (/** @type {'near' | 'locate'} */ why) => {
      wantFix.current = why;
      if (geo.permission === 'granted' || geo.permission === 'denied') geo.start();
      else setChoosing('locate');
    },
    [geo],
  );

  // ---------- Centre: Near me or a station ----------
  /** @type {import('./lib.js').JgCentre | null} */
  const centre = useMemo(() => {
    if (near.on) return meCentre && farM == null ? { kind: 'me', lat: meCentre.lat, lng: meCentre.lng, radius: near.radius } : null;
    if (stationCentre) {
      const s = stById.get(stationCentre.id);
      if (s) return { kind: 'station', lat: s.la, lng: s.lo, radius: stationCentre.radius, stationId: s.id };
    }
    return null;
  }, [near, meCentre, farM, stationCentre, stById]);

  const list = useMemo(() => visibleList(pujas, filters, centre), [pujas, filters, centre]);
  const filtered = filters !== NO_FILTERS && (filters.mustVisit || filters.type || moreCount(filters) > 0);
  const lit = useMemo(() => (centre || filtered ? new Set(list.map((r) => r.puja.id)) : null), [centre, filtered, list]);
  const priority = useMemo(() => (filtered ? new Set(list.map((r) => r.puja.id)) : new Set()), [filtered, list]);
  const radiusCounts = useMemo(
    () => (centre ? countsByRadius(pujas, filters, centre.lat, centre.lng, RADIUS_STEPS) : {}),
    [centre, pujas, filters],
  );

  const turnNearOff = useCallback(() => {
    setNear((n) => ({ ...n, on: false }));
    setMeCentre(null);
    // While visits are being counted, location keeps running for the "Are you visiting?" bar.
    if (!tracking) geo.stop();
  }, [geo, tracking]);
  const { start: geoStart, stop: geoStop } = geo;
  useEffect(() => {
    if (tracking && geo.permission === 'granted') geoStart();
  }, [tracking, geo.permission, geoStart]);
  const clearStation = useCallback(() => {
    setStationCentre(null);
    setPicked((p) => (p?.kind === 'station' ? null : p));
  }, []);

  const toggleNear = () => {
    if (near.on) return turnNearOff();
    clearStation();
    setView({ kind: 'list' });
    setNear({ on: true, radius: RADIUS_STEPS[0] });
    if (sheet === 'peek') setSheet('initial');
    if (pos && farM == null) mapRef.current?.fitRadius(pos.lat, pos.lng, RADIUS_STEPS[0]);
    else askLocation('near');
  };

  const chooseStation = useCallback(
    (/** @type {string} */ id) => {
      const s = stById.get(id);
      if (!s) return;
      if (near.on) turnNearOff();
      if (!picked) camBeforePick.current = mapRef.current?.camera() ?? null;
      setStationCentre({ id, radius: STATION_RADIUS_M });
      setPicked({ kind: 'station', id, name: s.name });
      setView({ kind: 'list' });
      setChoosing(null);
      setSheet((cur) => (cur === 'peek' ? 'initial' : cur));
      mapRef.current?.fitRadius(s.la, s.lo, STATION_RADIUS_M);
    },
    [stById, near.on, turnNearOff, picked],
  );

  const setRadius = (/** @type {number} */ m) => {
    if (!centre) return;
    if (centre.kind === 'me') setNear((n) => ({ ...n, radius: m }));
    else setStationCentre((s) => (s ? { ...s, radius: m } : s));
    mapRef.current?.fitRadius(centre.lat, centre.lng, m);
  };

  // ---------- Views ----------
  const openPuja = useCallback(
    (/** @type {string} */ id, fly = true) => {
      const p = byId.get(id);
      if (!p) return;
      setView({ kind: 'puja', id });
      setSheet((cur) => (cur === 'full' || cur === 'peek' ? 'half' : cur === 'initial' ? 'half' : cur));
      if (fly) mapRef.current?.flyTo(p.la, p.lo, 16);
    },
    [byId],
  );
  const toList = useCallback(() => setView({ kind: 'list' }), []);
  const closePuja = useCallback(() => {
    setView({ kind: 'list' });
    if (picked?.kind === 'puja') setPicked(null);
  }, [picked]);

  const onPick = (/** @type {'puja' | 'station'} */ kind, /** @type {string} */ id) => {
    setSearchOpen(false);
    if (kind === 'station') return chooseStation(id);
    const p = byId.get(id);
    if (!p) return;
    if (!picked) camBeforePick.current = mapRef.current?.camera() ?? null;
    setPicked({ kind: 'puja', id, name: p.n });
    openPuja(id);
  };
  const clearPick = () => {
    if (picked?.kind === 'station') clearStation();
    else setPicked(null);
    setView({ kind: 'list' });
    if (camBeforePick.current) mapRef.current?.restore(camBeforePick.current);
    camBeforePick.current = null;
  };

  // Search panel: the open sheet steps down to its peek and comes back when the panel closes.
  const openSearch = (/** @type {boolean} */ open) => {
    if (open && !searchOpen) {
      sheetBeforeSearch.current = sheet;
      setSheet('peek');
    }
    if (!open && searchOpen) setSheet(sheetBeforeSearch.current === 'peek' ? 'initial' : sheetBeforeSearch.current);
    setSearchOpen(open);
  };

  // The phone's back button closes the top layer first.
  useBackClose(searchOpen, () => openSearch(false));
  useBackClose(choosing != null, () => setChoosing(null));
  useBackClose(view.kind !== 'list', () => (view.kind === 'puja' ? closePuja() : toList()));
  // An event or the traffic notice sits on top of What's new: Back returns there first, like the on-screen back arrow.
  useBackClose(view.kind === 'event' || view.kind === 'traffic', () => setView({ kind: 'whatsnew' }));

  // ---------- Account: wish list, visited, sign-in ----------
  const { change: accountChange } = account;
  const applyChange = useCallback(
    function apply(/** @type {import('./account.js').Change} */ c, undoable = true) {
      accountChange(c).then(
        (how) => {
          const text = how === 'queued' ? 'Saved. Sends when online' : TOAST_TEXT[`${c.action}:${c.on}`];
          show(text, 3200, undoable ? { label: 'Undo', run: () => apply({ ...c, on: !c.on }, false) } : undefined);
        },
        (e) => {
          if (/** @type {any} */ (e)?.status === 401) {
            show('Session ended. Sign in again');
            setSignIn({ reason: c.action === 'wish' ? 'wish' : 'visited', change: c });
          } else show("Couldn't save. Try again");
        },
      );
    },
    [accountChange, show],
  );
  /** Signed in: make the change. Signed out: sign in first, then make it. */
  const ask = (/** @type {import('./account.js').Change} */ c) => {
    if (account.signedIn) return applyChange(c);
    setSignInErr(null);
    setSignIn({ reason: c.action === 'wish' ? 'wish' : 'visited', change: c });
  };
  const closeSignIn = useCallback(() => {
    setSignIn(null);
    setSignInErr(null);
  }, []);
  const onCredential = async (/** @type {string} */ credential) => {
    const then = signIn;
    setSignInBusy(true);
    setSignInErr(null);
    try {
      const s = await account.signIn(credential);
      setSignIn(null);
      // The first time, ask to count visits with location (or switch it on quietly if location is already allowed).
      let asking = false;
      if (track == null) {
        // Location already running counts as allowed (some browsers report "prompt" while it is in use).
        if (geo.permission === 'granted' || geo.status === 'on') setTrack(true);
        else if (geo.permission !== 'denied') asking = true;
      }
      // Badges already earned elsewhere aren't celebrated again on this phone.
      if (s.user) setSeen({ u: s.user.name, r: rankOf(statsOf(s.visited, 0)).cur });
      if (then?.change?.action === 'here') {
        const p = byId.get(then.change.puja);
        if (p) countHere(p);
      } else if (then?.change) {
        const already =
          then.change.action === 'wish'
            ? s.wish.some((w) => w.puja === then.change?.puja) === then.change.on
            : s.visited.some((v) => v.puja === then.change?.puja) === then.change.on;
        if (already) show(TOAST_TEXT[`${then.change.action}:${then.change.on}`]);
        else applyChange(then.change, false);
      } else {
        show(`Signed in as ${s.user?.name.split(' ')[0] ?? 'you'}`);
      }
      if (asking) setChoosing('track');
      else if (!then?.change) setChoosing('profile');
    } catch (e) {
      setSignInErr(signInError(e));
    } finally {
      setSignInBusy(false);
    }
  };
  const openProfile = () => {
    if (account.signedIn) return setChoosing('profile');
    setSignInErr(null);
    setSignIn({ reason: 'start' });
  };

  // Once a session, after 5 minutes on screen, signed-out people are asked to start their tour, but never over
  // another sheet, the search panel or a puja.
  const nudgeBlocked = useRef(true);
  const blocked = account.signedIn || choosing != null || searchOpen || view.kind !== 'list' || signIn != null || welcome;
  useEffect(() => {
    nudgeBlocked.current = blocked;
  }, [blocked]);
  useEffect(() => {
    let seen = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      seen += 5;
      if (seen < NUDGE_AFTER_S || nudgeBlocked.current) return;
      window.clearInterval(id);
      try {
        if (sessionStorage.getItem('pd_jg_nudged')) return;
        sessionStorage.setItem('pd_jg_nudged', '1');
      } catch {
        /* storage blocked: still ask only once, this page load */
      }
      setSignIn({ reason: 'start' });
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  // ---------- "Are you visiting?" (2 minutes within 100 m), then the crowd ----------
  const [visitStep, setVisitStep] = useState(/** @type {null | { kind: 'ask' | 'crowd', puja: import('./lib.js').JgPuja }} */ (null));
  const [visitBusy, setVisitBusy] = useState(false);
  // While the bar shows, the sheet drops to its resting third so the map stays visible, then goes back (design 7.9).
  const sheetBeforeBar = useRef(/** @type {null | 'peek' | 'initial' | 'half' | 'full'} */ (null));
  const setBar = useCallback((/** @type {null | { kind: 'ask' | 'crowd', puja: import('./lib.js').JgPuja }} */ next) => {
    setVisitStep(next);
    if (next && sheetBeforeBar.current == null) {
      setSheet((cur) => {
        sheetBeforeBar.current = cur;
        return cur === 'half' || cur === 'full' ? 'initial' : cur;
      });
    } else if (!next && sheetBeforeBar.current != null) {
      const back = sheetBeforeBar.current;
      sheetBeforeBar.current = null;
      setSheet((cur) => (cur === 'initial' ? back : cur));
    }
  }, []);
  // ---- Badges: celebrate a rank earned on this phone, once (design 9.4) ----
  // Rank depends only on totals and the best day, so "now" doesn't matter here.
  const curRank = useMemo(() => rankOf(statsOf(account.visited, 0)).cur, [account.visited]);
  const personTotal = useMemo(() => account.visited.filter((v) => v.mode === 'person').length, [account.visited]);
  /** The highest rank this person has already seen celebrated here. Starts at their rank when they sign in. */
  const [seen, setSeen] = useState(() => /** @type {{ u: string, r: number } | null} */ (storage.get('jg_seen_rank', null)));
  const userKey = account.user?.name ?? null;
  if (account.signedIn && (seen == null || seen.u !== userKey)) setSeen({ u: /** @type {string} */ (userKey), r: curRank });
  if (!account.signedIn && seen != null) setSeen(null);
  useEffect(() => {
    storage.set('jg_seen_rank', seen);
  }, [seen]);
  const [shareRank, setShareRank] = useState(/** @type {number | null} */ (null));
  const markSeen = () => userKey && setSeen({ u: userKey, r: curRank });
  const stay = useRef(/** @type {import('./visit.js').Stay} */ (NO_STAY));
  const askedThisSession = useRef(/** @type {Set<string>} */ (new Set()));
  const visitCtx = useRef({ pos, blocked: true, inPerson: /** @type {Set<string>} */ (new Set()) });
  const inPerson = useMemo(() => new Set(account.visited.filter((v) => v.mode === 'person').map((v) => v.puja)), [account.visited]);
  const visitBlocked = visitStep != null || choosing != null || signIn != null || searchOpen || settingsOpen || welcome;
  useEffect(() => {
    visitCtx.current = { pos, blocked: visitBlocked, inPerson };
  }, [pos, visitBlocked, inPerson]);
  useEffect(() => {
    const check = () => {
      const { pos: at, blocked: busy, inPerson: done } = visitCtx.current;
      const t = Date.now();
      stay.current = nextStay(stay.current, at, pujas, t);
      const id = stay.current.id;
      if (!id || busy || !stayedLongEnough(stay.current, t)) return;
      if (done.has(id) || askedThisSession.current.has(id) || saidNoToday(id, t)) return;
      const p = byId.get(id);
      if (!p) return;
      askedThisSession.current.add(id);
      setBar({ kind: 'ask', puja: p });
    };
    check();
    const timer = window.setInterval(check, 10_000);
    return () => window.clearInterval(timer);
  }, [pos, pujas, byId, setBar]);

  /** Yes, signed in: count it in person, then ask about the crowd. */
  const countHere = (/** @type {import('./lib.js').JgPuja} */ p) => {
    setVisitBusy(true);
    accountChange({ action: 'here', puja: p.id, on: true })
      .then(
        (how) => {
          if (how === 'queued') {
            show('Saved. Counts when online');
            setBar(null);
          } else {
            show('Puja counted');
            setBar({ kind: 'crowd', puja: p });
          }
        },
        (e) => {
          const code = /** @type {any} */ (e)?.message;
          if (code === 'too_soon') {
            show('Not counted. Try again in 2 minutes');
            setBar({ kind: 'crowd', puja: p });
          } else {
            show(code === 'daily_limit' ? 'Today’s limit reached' : "Couldn't count it. Try again");
            setBar(null);
          }
        },
      )
      .finally(() => setVisitBusy(false));
  };
  const onVisitYes = () => {
    primeSound(); // a badge may unlock: let its sound play after the crowd step
    const p = visitStep?.puja;
    if (!p) return;
    if (account.signedIn) return countHere(p);
    setBar(null);
    setSignInErr(null);
    setSignIn({ reason: 'here', change: { action: 'here', puja: p.id, on: true } });
  };
  const onCrowd = (/** @type {'free' | 'crowded'} */ level) => {
    primeSound();
    const p = visitStep?.puja;
    if (!p) return;
    setVisitBusy(true);
    account
      .report(p.id, level)
      .then(
        () => {
          show('Crowd report sent');
          crowd.refresh();
        },
        (e) => show(/** @type {any} */ (e)?.status ? "Couldn't send. Try again later" : 'Offline. Report not sent'),
      )
      .finally(() => {
        setVisitBusy(false);
        setBar(null);
      });
  };

  // ---------- Chips ----------
  const nearLabel = !near.on
    ? 'Near me'
    : geo.status === 'finding' || (!pos && geo.status !== 'denied' && geo.status !== 'unavailable')
      ? 'Finding you…'
      : `Near me · ${near.radius < 1000 ? `${near.radius} m` : `${near.radius / 1000} km`}`;
  const nMore = moreCount(filters);
  // Filters switched on inside More, shown as chips at the start of the row so they stay visible (as in Google Maps).
  const appliedChips = [
    ...filters.towns.map((t) => ({
      key: `t-${t}`,
      label: t,
      remove: () => setFilters((f) => ({ ...f, towns: f.towns.filter((x) => x !== t) })),
    })),
    ...filters.ages.map((a) => ({
      key: `a-${a}`,
      label: AGE_GROUPS.find((g) => g[0] === a)?.[1] ?? a,
      remove: () => setFilters((f) => ({ ...f, ages: f.ages.filter((x) => x !== a) })),
    })),
    ...(filters.procession ? [{ key: 'proc', label: 'Procession', remove: () => setFilters((f) => ({ ...f, procession: false })) }] : []),
    ...filters.zones.map((z) => ({
      key: `z-${z}`,
      label: `Zone ${z}`,
      remove: () => setFilters((f) => ({ ...f, zones: f.zones.filter((x) => x !== z) })),
    })),
    ...(filters.wish ? [{ key: 'wish', label: 'Wish list', remove: () => setFilters((f) => ({ ...f, wish: false })) }] : []),
    ...(filters.notVisited
      ? [{ key: 'notv', label: 'Not visited yet', remove: () => setFilters((f) => ({ ...f, notVisited: false })) }]
      : []),
    ...(filters.freeNow ? [{ key: 'free', label: 'Free now', remove: () => setFilters((f) => ({ ...f, freeNow: false })) }] : []),
    ...(filters.hideCrowded
      ? [{ key: 'hidec', label: 'Hide crowded', remove: () => setFilters((f) => ({ ...f, hideCrowded: false })) }]
      : []),
  ];

  // ---------- Sheet content ----------
  const selectedId = view.kind === 'puja' ? view.id : null;
  let body;
  let footer = null;
  let peek;
  if (view.kind === 'puja') {
    const p = /** @type {import('./lib.js').JgPuja} */ (byId.get(view.id));
    body = (
      <PujaDetail
        puja={p}
        station={stById.get(p.st[0])}
        onClose={closePuja}
        visit={account.visited.find((v) => v.puja === p.id)}
        crowd={crowd.crowd[p.id]}
        crowdAt={crowd.at}
        onVisited={(on) => ask({ action: 'visited', puja: p.id, on })}
      />
    );
    footer = <PujaActions puja={p} wished={mine.wish.has(p.id)} onWish={(on) => ask({ action: 'wish', puja: p.id, on })} />;
    peek = p.n;
  } else if (view.kind === 'whatsnew') {
    body = (
      <WhatsNew
        byId={byId}
        onClose={toList}
        onTraffic={() => setView({ kind: 'traffic' })}
        onEvent={(id) => setView({ kind: 'event', id })}
      />
    );
    peek = "What's new";
  } else if (view.kind === 'event' && eventById(view.id)) {
    const ev = /** @type {import('./config.js').JgEvent} */ (eventById(view.id));
    const evPuja = ev.pujaId ? byId.get(ev.pujaId) : undefined;
    body = (
      <EventDetail ev={ev} puja={evPuja} onBack={() => setView({ kind: 'whatsnew' })} onClose={toList} onOpenPuja={(id) => openPuja(id)} />
    );
    footer = <EventActions puja={evPuja} place={ev.place} />;
    peek = ev.title;
  } else if (view.kind === 'traffic') {
    body = <TrafficDetail onBack={() => setView({ kind: 'whatsnew' })} onClose={toList} />;
    peek = 'Traffic and road closures';
  } else if (view.kind === 'about') {
    body = <About onClose={toList} onWelcome={() => setWelcome(true)} />;
    peek = 'About Puja Dekho';
  } else if (view.kind === 'popular') {
    body = <PujaListSheet title="Popular pujas" rows={mustVisitRows} onOpen={(id) => openPuja(id)} onClose={toList} />;
    peek = 'Popular pujas';
  } else {
    body = (
      <ListBody
        list={list}
        centre={centre}
        near={near}
        geo={geo}
        farM={farM}
        approx={approx}
        station={stationCentre ? stById.get(stationCentre.id) : undefined}
        radiusCounts={radiusCounts}
        filters={filters}
        crowd={crowd.crowd}
        onRadius={setRadius}
        onClear={() => (near.on ? turnNearOff() : clearPick())}
        onOpen={(id) => openPuja(id)}
        onRetryLocation={() => {
          wantFix.current = 'near';
          geo.stop();
          geo.start();
        }}
        onPickStation={() => setChoosing('stations')}
        onClearFilters={() => setFilters(NO_FILTERS)}
      />
    );
    peek = centre
      ? `${pujaCount(list.length)} within ${centre.radius < 1000 ? `${centre.radius} m` : `${centre.radius / 1000} km`}`
      : pujaCount(list.length);
  }

  const toolsBottom = 'calc(var(--sheet-h, 35%) + 16px)';
  // The bar takes the space above the sheet: chips, the counter pill and the location button step aside meanwhile.
  const barShown = visitStep != null && !searchOpen && sheet !== 'full';
  const pillBottom = 'min(calc(var(--sheet-h, 35%) + 16px), calc(100% - 38px))';

  return (
    <div className="jg" data-dim={choosing && choosing !== 'locate' && choosing !== 'profile' ? '' : undefined}>
      <header
        className="jg-top"
        data-fade={panning && !searchOpen ? '' : undefined}
        data-full={sheet === 'full' && !searchOpen ? '' : undefined}
      >
        <SearchBar
          rowRef={searchRowRef}
          popular={popular}
          stations={stations}
          pujaIndex={pujaIndex}
          stationIndex={stationIndex}
          picked={picked}
          open={searchOpen}
          onOpen={openSearch}
          onPick={onPick}
          onClear={clearPick}
          onAbout={() => {
            setSearchOpen(false);
            setView({ kind: 'about' });
            setSheet('half');
          }}
          onProfile={openProfile}
          user={account.user}
          onSeePopular={() => {
            setSearchOpen(false);
            setView({ kind: 'popular' });
            setSheet('half');
          }}
        />
        {!searchOpen && sheet !== 'full' && !barShown && (
          <nav className="jg-chips" aria-label="Filters">
            <div className="jg-chip-scroll">
              {appliedChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="chip compact jg-chip jg-applied"
                  aria-pressed="true"
                  aria-label={`Remove filter: ${c.label}`}
                  onClick={c.remove}
                >
                  {c.label}
                  <Icon name="x" size={16} />
                </button>
              ))}
              <WhatsNewChip
                open={view.kind === 'whatsnew' || view.kind === 'traffic' || view.kind === 'event'}
                onOpen={() => {
                  setView({ kind: 'whatsnew' });
                  setSheet('half');
                }}
              />
              <button type="button" className="chip compact jg-chip" aria-pressed={near.on} onClick={toggleNear}>
                <Icon name="locate" size={16} />
                {nearLabel}
              </button>
              <button
                type="button"
                className="chip compact jg-chip"
                aria-pressed={!!stationCentre}
                aria-haspopup="dialog"
                onClick={() => setChoosing('stations')}
              >
                <Icon name="train" size={16} />
                Stations & ghats
              </button>
              <button
                type="button"
                className="chip compact jg-chip"
                aria-pressed={filters.mustVisit}
                onClick={() => {
                  setFilters((f) => ({ ...f, mustVisit: !f.mustVisit }));
                  setView({ kind: 'list' });
                }}
              >
                <Icon name="star" size={16} />
                Must visit
              </button>
              <button
                type="button"
                className="chip compact jg-chip"
                aria-pressed={!!filters.type}
                aria-haspopup="dialog"
                onClick={() => setChoosing('type')}
              >
                {filters.type || 'Puja type'}
                <Icon name="chevron" size={16} />
              </button>
              <button
                type="button"
                className="chip compact jg-chip"
                aria-pressed={nMore > 0}
                aria-haspopup="dialog"
                onClick={() => setChoosing('more')}
              >
                <Icon name="sliders" size={16} />
                {nMore > 0 ? `More · ${nMore}` : 'More'}
              </button>
            </div>
          </nav>
        )}
        {!online && (
          <p className="jg-offline" role="status">
            <Icon name="offline" size={16} />
            <span>
              <strong>You&apos;re offline.</strong> List, search and puja details still work.
            </span>
          </p>
        )}
      </header>

      {searchOpen && <div className="jg-scrim light" onClick={() => openSearch(false)} aria-hidden="true" />}

      <main className="stage jg-stage">
        <div className="jg-map-wrap">
          {mapFailed ? (
            // Offline, the banner under the search bar already says this: one message, not two.
            <div className="jg-map-fail">
              {online && (
                <>
                  <Icon name="offline" />
                  <p>The map needs a network. List, search and puja details still work.</p>
                </>
              )}
            </div>
          ) : (
            <MapBoundary onFail={() => setMapFailed(true)}>
              <Suspense fallback={<div className="jg-map-loading" aria-hidden="true" />}>
                <JgMap
                  ref={mapRef}
                  pujas={pujas}
                  stations={stations}
                  lit={lit}
                  priority={priority}
                  selectedId={selectedId}
                  crowd={crowd.crowd}
                  centre={centre}
                  me={pos && farM == null ? pos : null}
                  onPuja={(id) => openPuja(id, false)}
                  onStation={chooseStation}
                  onBlank={() => {
                    if (view.kind === 'puja') closePuja();
                  }}
                  onPan={setPanning}
                  onFail={() => setMapFailed(true)}
                />
              </Suspense>
            </MapBoundary>
          )}
        </div>

        {!barShown && <ViewCount visits={visits} live={live} bottom={pillBottom} full={sheet === 'full'} />}
        <VisitBar
          step={barShown ? visitStep : null}
          busy={visitBusy}
          bottom="calc(var(--sheet-h, 35%) + 12px)"
          onYes={onVisitYes}
          onNo={() => {
            if (visitStep) sayNo(visitStep.puja.id, Date.now());
            setBar(null);
          }}
          onCrowd={onCrowd}
          onSkip={() => {
            primeSound();
            setBar(null);
          }}
        />
        <div className="map-tools jg-tools" style={{ bottom: toolsBottom }} hidden={barShown}>
          <button
            type="button"
            className="jg-locate"
            data-state={geo.status}
            aria-label={geo.status === 'denied' ? 'Location is off. How to turn it on' : 'Show my location'}
            onClick={() => {
              if (geo.status === 'denied') return setChoosing('locate');
              if (pos && farM == null) return mapRef.current?.flyTo(pos.lat, pos.lng, 16);
              if (pos && farM != null) return show(`You are ${formatDistance(farM)} from ${TOWN_POINT.name}`);
              askLocation('locate');
            }}
          >
            {geo.status === 'finding' ? <span className="jg-spinner" aria-hidden="true" /> : <Icon name={pos ? 'myloc' : 'locate'} />}
            {geo.status === 'denied' && <span className="jg-slash" aria-hidden="true" />}
          </button>
        </div>

        <BottomSheet sheet={sheet} onSheetChange={setSheet} desktop={false} peek={peek} footer={footer} topInset={topInset}>
          {body}
        </BottomSheet>
      </main>

      {/* Choosing sheets */}
      <ModalSheet open={choosing === 'type'} title="Puja type" onClose={() => setChoosing(null)}>
        <ChoiceRow
          label="All pujas"
          count={pujaCount(pujas.filter((p) => passes(p, { ...filters, type: null })).length)}
          selected={!filters.type}
          onClick={() => {
            setFilters((f) => ({ ...f, type: null }));
            setChoosing(null);
            setView({ kind: 'list' });
          }}
        />
        {CATEGORIES.map((c) => (
          <ChoiceRow
            key={c}
            label={c}
            count={pujaCount(pujas.filter((p) => passes(p, { ...filters, type: c })).length)}
            selected={filters.type === c}
            onClick={() => {
              setFilters((f) => ({ ...f, type: c }));
              setChoosing(null);
              setView({ kind: 'list' });
              setSheet((s) => (s === 'peek' ? 'initial' : s));
            }}
          />
        ))}
      </ModalSheet>

      <ModalSheet open={choosing === 'stations'} title="Stations & ghats" onClose={() => setChoosing(null)}>
        {['station', 'ghat'].map((kind) => (
          <Section
            key={kind}
            title={kind === 'station' ? 'Railway stations' : 'Ferry ghats'}
            open={stationOpen(kind)}
            onToggle={() => stationToggle(kind)}
          >
            {stations
              .filter((s) => s.kind === kind)
              .map((s) => (
                <ChoiceRow
                  key={s.id}
                  icon={kind === 'ghat' ? 'boat' : 'train'}
                  label={s.name}
                  count={`${pujaCount(countsByRadius(pujas, filters, s.la, s.lo, [STATION_RADIUS_M])[STATION_RADIUS_M])} within 1 km`}
                  selected={stationCentre?.id === s.id}
                  onClick={() => chooseStation(s.id)}
                />
              ))}
          </Section>
        ))}
      </ModalSheet>

      <MoreSheet
        open={choosing === 'more'}
        pujas={pujas}
        filters={filters}
        centre={centre}
        mine={account.signedIn ? mine : null}
        crowd={crowd.crowd}
        onSignIn={() => {
          setChoosing(null);
          setSignInErr(null);
          setSignIn({ reason: 'wish' });
        }}
        onApply={(f) => {
          setFilters(f);
          setChoosing(null);
          setView({ kind: 'list' });
          setSheet((s) => (s === 'peek' ? 'initial' : s));
        }}
        onClose={() => setChoosing(null)}
      />

      <ModalSheet
        open={choosing === 'locate'}
        strong
        title={geo.permission === 'denied' || geo.status === 'denied' ? 'Location is off for Puja Dekho' : 'See pujas near you'}
        onClose={() => {
          setChoosing(null);
          if (wantFix.current === 'near' && geo.status !== 'on') turnNearOff();
          wantFix.current = null;
        }}
        footer={
          geo.permission === 'denied' || geo.status === 'denied' ? (
            <button
              type="button"
              className="btn dark block"
              onClick={() => {
                turnNearOff();
                setChoosing('stations');
              }}
            >
              Pick a station or ghat
            </button>
          ) : (
            <div className="jg-two">
              <button
                type="button"
                className="btn jg-btn-outline"
                onClick={() => {
                  setChoosing(null);
                  if (wantFix.current === 'near') turnNearOff();
                  wantFix.current = null;
                }}
              >
                Not now
              </button>
              <button
                type="button"
                className="btn dark"
                onClick={() => {
                  setChoosing(null);
                  geo.start();
                }}
              >
                Turn on location
              </button>
            </div>
          )
        }
      >
        {geo.permission === 'denied' || geo.status === 'denied' ? (
          <p className="jg-body">
            To see pujas near you, allow location for this site in your browser settings, then reload the page. Or start from a station or
            ghat.
          </p>
        ) : (
          <p className="jg-body">Turn on location to see pujas around you. Your location stays on your phone.</p>
        )}
        {IN_APP_BROWSER && (
          <p className="jg-note">
            <Icon name="info" size={16} />
            This app is open inside a social app, which may block location. If it does not work, open the link in Chrome or Safari.
          </p>
        )}
      </ModalSheet>

      <ProfileSheet
        open={choosing === 'profile'}
        account={account}
        byId={byId}
        onClose={() => setChoosing(null)}
        onOpenPuja={(id) => {
          setChoosing(null);
          openPuja(id);
        }}
        onRemoveWish={(id) => applyChange({ action: 'wish', puja: id, on: false })}
        onSettings={() => setSettingsOpen(true)}
        onShare={(i) => setShareRank(i)}
      />
      <SettingsSheet
        open={settingsOpen}
        pending={account.pending}
        track={track === true}
        onTrack={(on) => {
          setTrack(on);
          if (on) geoStart();
          else if (!near.on) geoStop();
        }}
        onClose={() => setSettingsOpen(false)}
        onSignOut={async () => {
          setSettingsOpen(false);
          setChoosing(null);
          await account.signOut();
          if (!near.on) geoStop();
          setBar(null);
          show('Signed out');
        }}
      />
      <ModalSheet
        open={choosing === 'track'}
        strong
        title="Count the pujas you visit"
        onClose={() => {
          setTrack(false);
          setChoosing(null);
        }}
        footer={
          <div className="jg-two">
            <button
              type="button"
              className="btn jg-btn-outline"
              onClick={() => {
                setTrack(false);
                setChoosing(null);
              }}
            >
              Not now
            </button>
            <button
              type="button"
              className="btn dark"
              onClick={() => {
                setTrack(true);
                setChoosing(null);
                geoStart();
              }}
            >
              Turn on location
            </button>
          </div>
        }
      >
        <p className="jg-body">Turn on location so Puja Dekho can ask when you are at a puja. Your location stays on your phone.</p>
        {IN_APP_BROWSER && (
          <p className="jg-note">
            <Icon name="info" size={16} />
            This app is open inside a social app, which may block location. If it does not work, open the link in Chrome or Safari.
          </p>
        )}
      </ModalSheet>
      <Celebration
        rank={
          account.signedIn && seen && curRank > seen.r && visitStep == null && signIn == null && !searchOpen && choosing == null
            ? curRank
            : null
        }
        total={personTotal}
        onShare={() => {
          markSeen();
          setShareRank(curRank);
        }}
        onClose={markSeen}
      />
      <ShareScreen
        rank={shareRank}
        total={personTotal}
        user={account.user}
        online={online}
        onClose={() => setShareRank(null)}
        toast={show}
      />
      <Welcome open={welcome} onClose={closeWelcome} />
      <SignInSheet reason={signIn?.reason ?? null} busy={signInBusy} error={signInErr} onCredential={onCredential} onClose={closeSignIn} />

      <div className="jg-toast-zone" aria-live="polite" style={barShown ? { top: topInset + 4, bottom: 'auto' } : { bottom: toolsBottom }}>
        {toast && (
          <div key={toast.id} className="jg-toast" data-action={toast.action ? '' : undefined}>
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="jg-toast-action"
                onClick={() => {
                  hide();
                  toast.action?.run();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** "What's new": the Puja Dekho chip with the light that runs round its outline on load (design section 6). */
function WhatsNewChip({ open, onOpen }) {
  const [tap, setTap] = useState(false);
  return (
    <button
      type="button"
      className={`chip compact whats-new jg-chip${tap ? ' tap' : ''}`}
      aria-pressed={open}
      onClick={() => {
        setTap(true);
        onOpen();
      }}
      onAnimationEnd={(e) => e.animationName === 'chip-tap' && setTap(false)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9l2-6.5Z" />
      </svg>
      What's new
    </button>
  );
}

/**
 * The list sheet: the Near me or station header with the radius trigger, its states, and the rows.
 */
function ListBody({
  list,
  centre,
  near,
  geo,
  farM,
  approx,
  station,
  radiusCounts,
  filters,
  crowd,
  onRadius,
  onClear,
  onOpen,
  onRetryLocation,
  onPickStation,
  onClearFilters,
}) {
  // A new list starts again at the first 60 rows.
  const [shown, setShown] = useState(60);
  const [forList, setForList] = useState(list);
  if (forList !== list) {
    setForList(list);
    setShown(60);
  }
  const filtered = filters.mustVisit || filters.type || moreCount(filters) > 0;
  // Name every filter that is on, so the summary reads "Must visit · Jubilee · Bhadreswar", never "1 more".
  const chips = [
    filters.mustVisit && 'Must visit',
    filters.type,
    ...filters.towns,
    ...filters.ages.map((a) => AGE_GROUPS.find((g) => g[0] === a)?.[1] ?? a),
    filters.procession && 'Procession',
    ...filters.zones.map((z) => `Zone ${z}`),
    filters.wish && 'Wish list',
    filters.notVisited && 'Not visited yet',
    filters.freeNow && 'Free now',
    filters.hideCrowded && 'Hide crowded',
  ].filter(Boolean);

  // Near me states before there are results.
  if (near.on && !centre) {
    let title = 'Finding you…';
    let text = 'Looking for your location.';
    let action = null;
    if (geo.status === 'denied') {
      title = 'Location is off for Puja Dekho';
      text = 'Allow location for this site in your browser settings, or start from a station or ghat.';
      action = (
        <button type="button" className="btn dark small" onClick={onPickStation}>
          Pick a station or ghat
        </button>
      );
    } else if (geo.status === 'unavailable') {
      title = "Couldn't find your location";
      text = 'Check that location is on for your phone, then try again.';
      action = (
        <div className="jg-two">
          <button type="button" className="btn small jg-btn-outline" onClick={onPickStation}>
            Pick a station or ghat
          </button>
          <button type="button" className="btn dark small" onClick={onRetryLocation}>
            Try again
          </button>
        </div>
      );
    } else if (farM != null) {
      title = `You are ${formatDistance(farM)} from Chandannagar`;
      text = 'Near me works once you are in town. Until then, start from the station or ghat you will arrive at.';
      action = (
        <button type="button" className="btn dark small" onClick={onPickStation}>
          Pick a station or ghat
        </button>
      );
    }
    return (
      <div className="jg-state" data-sheet-head>
        <div className="jg-state-head">
          <h2 className="jg-title">{title}</h2>
          <button type="button" className="btn text" onClick={onClear}>
            Clear
          </button>
        </div>
        <p className="jg-body">{text}</p>
        {action}
      </div>
    );
  }

  return (
    <>
      <div className="jg-list-head" data-sheet-head>
        {centre ? (
          <>
            <div className="jg-within">
              <h2 className="jg-title">{`${pujaCount(list.length)} within`}</h2>
              <RadiusTrigger radius={centre.radius} steps={RADIUS_STEPS} counts={radiusCounts} onChange={onRadius} />
              <button type="button" className="btn text jg-clear" onClick={onClear}>
                Clear
              </button>
            </div>
            <p className="jg-meta">
              {[centre.kind === 'me' ? 'Straight-line distance from you' : `Straight-line distance from ${station?.name}`, ...chips].join(
                ' · ',
              )}
            </p>
            {approx && centre.kind === 'me' && <p className="jg-note">Your location is approximate, so distances may be off.</p>}
          </>
        ) : (
          <>
            <div className="jg-within">
              <h2 className="jg-title">{filtered ? pujaCount(list.length) : `All ${pujaCount(list.length)}`}</h2>
              {filtered && (
                <button type="button" className="btn text jg-clear" onClick={onClearFilters}>
                  Clear
                </button>
              )}
            </div>
            {filtered && <p className="jg-meta">{chips.join(' · ')}</p>}
          </>
        )}
      </div>
      {list.length === 0 ? (
        <div className="jg-empty">
          {centre ? (
            <EmptyRadius centre={centre} counts={radiusCounts} onRadius={onRadius} />
          ) : (
            <>
              <p>
                {filters.freeNow && !Object.values(crowd).some((c) => c.level === 'free')
                  ? 'No crowd reports in the last hour'
                  : 'No pujas match these filters.'}
              </p>
              <button type="button" className="btn dark small" onClick={onClearFilters}>
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <ListRows list={list.slice(0, shown)} sectioned={!centre} onOpen={onOpen} total={list} crowd={crowd} />
      )}
      {list.length > shown && (
        <button type="button" className="btn block jg-btn-outline jg-more-rows" onClick={() => setShown((n) => n + 60)}>
          {`Show ${Math.min(60, list.length - shown)} more`}
        </button>
      )}
    </>
  );
}

/**
 * The rows. Without a centre: "Must visit" then "Other pujas", each heading with its count and pinned while its rows
 * scroll. With Near me or a station: one list, nearest first, with the Must visit tag after the name.
 */
function ListRows({ list, sectioned, onOpen, total, crowd }) {
  const [isOpen, toggle] = useCollapse(sectioned);
  if (!sectioned) {
    return (
      <ul className="jg-list">
        {list.map((r) => (
          <PujaRow key={r.puja.id} puja={r.puja} d={r.d} onOpen={onOpen} showTag crowd={crowd[r.puja.id]?.level} />
        ))}
      </ul>
    );
  }
  const groups = [
    ['Must visit', list.filter((r) => r.puja.pop), total.filter((r) => r.puja.pop).length],
    ['Other pujas', list.filter((r) => !r.puja.pop), total.filter((r) => !r.puja.pop).length],
  ].filter(([, rows]) => rows.length > 0);
  return (
    <>
      {groups.map(([title, rows, count]) => (
        <Section key={title} title={title} count={count} open={isOpen(title)} onToggle={() => toggle(title)}>
          <ul className="jg-list">
            {rows.map((r) => (
              <PujaRow key={r.puja.id} puja={r.puja} d={r.d} onOpen={onOpen} crowd={crowd[r.puja.id]?.level} />
            ))}
          </ul>
        </Section>
      ))}
    </>
  );
}

/** "No pujas within 500 m. 4 within 1 km." with "Show 1 km". */
function EmptyRadius({ centre, counts, onRadius }) {
  const next = RADIUS_STEPS.find((m) => m > centre.radius && (counts[m] ?? 0) > 0);
  const r = (m) => (m < 1000 ? `${m} m` : `${m / 1000} km`);
  return (
    <>
      <p>{`No pujas within ${r(centre.radius)}.${next ? ` ${counts[next]} within ${r(next)}.` : ''}`}</p>
      {next && (
        <button type="button" className="btn dark small" onClick={() => onRadius(next)}>
          {`Show ${r(next)}`}
        </button>
      )}
    </>
  );
}

/**
 * More (design 7.4): crowd and your-pujas groups (coming with sign-in), town, age, procession and zone.
 * Choices are a draft until "Show N pujas", which updates live.
 */
function MoreSheet({ open, pujas, filters, centre, mine, crowd, onSignIn, onApply, onClose }) {
  // Each time the sheet opens, the draft starts from the filters that are on.
  const [draftRaw, setDraft] = useState(filters);
  const draft = useMemo(() => ({ ...draftRaw, crowd, ...(mine ? { mine } : {}) }), [draftRaw, mine, crowd]);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setDraft(filters);
  }
  const count = useMemo(() => visibleList(pujas, draft, centre).length, [pujas, draft, centre]);
  const [isOpen, toggle] = useCollapse(open);
  /** Props for one filter group; `chosen` is what is on inside it, shown in the header while collapsed. */
  const group = (/** @type {string} */ title, /** @type {(string | false)[]} */ chosen) => ({
    title,
    open: isOpen(title),
    onToggle: () => toggle(title),
    summary: chosen.filter(Boolean).join(', ') || undefined,
  });
  const toggleIn = (/** @type {'towns' | 'ages' | 'zones'} */ key, /** @type {string} */ v) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v] }));
  const n = (/** @type {(p: any) => boolean} */ fn) => pujaCount(pujas.filter(fn).length);
  return (
    <ModalSheet
      open={open}
      title="More filters"
      onClose={onClose}
      footer={
        <div className="jg-two">
          <button
            type="button"
            className="btn text"
            onClick={() => setDraft({ ...NO_FILTERS, mustVisit: draft.mustVisit, type: draft.type })}
          >
            Clear all
          </button>
          <button type="button" className="btn dark" disabled={count === 0} onClick={() => onApply(draftRaw)}>
            {count === 0 ? 'No pujas match' : `Show ${pujaCount(count)}`}
          </button>
        </div>
      }
    >
      <Section {...group('Crowd', [draft.freeNow && 'Free now', draft.hideCrowded && 'Hide crowded'])}>
        <ChoiceRow
          label="Free now"
          count={n((p) => crowd[p.id]?.level === 'free')}
          selected={draft.freeNow}
          onClick={() => setDraft((d) => ({ ...d, freeNow: !d.freeNow }))}
        />
        <ChoiceRow
          label="Hide crowded"
          count={`${n((p) => crowd[p.id]?.level === 'crowded')} crowded now`}
          selected={draft.hideCrowded}
          onClick={() => setDraft((d) => ({ ...d, hideCrowded: !d.hideCrowded }))}
        />
      </Section>
      <Section {...group('Your pujas', [!!mine && draft.wish && 'Wish list', !!mine && draft.notVisited && 'Not visited yet'])}>
        {mine ? (
          <>
            <ChoiceRow
              label="Wish list"
              count={pujaCount(pujas.filter((p) => mine.wish.has(p.id)).length)}
              selected={draft.wish}
              onClick={() => setDraft((d) => ({ ...d, wish: !d.wish }))}
            />
            <ChoiceRow
              label="Not visited yet"
              count={pujaCount(pujas.filter((p) => !mine.visited.has(p.id)).length)}
              selected={draft.notVisited}
              onClick={() => setDraft((d) => ({ ...d, notVisited: !d.notVisited }))}
            />
          </>
        ) : (
          <>
            <ChoiceRow label="Wish list" note="Sign in to use" selected={false} onClick={onSignIn} />
            <ChoiceRow label="Not visited yet" note="Sign in to use" selected={false} onClick={onSignIn} />
          </>
        )}
      </Section>
      <Section {...group('Town', draft.towns)}>
        {TOWNS.map((t) => (
          <ChoiceRow
            key={t}
            label={t}
            count={n((p) => p.t === t)}
            selected={draft.towns.includes(t)}
            onClick={() => toggleIn('towns', t)}
          />
        ))}
      </Section>
      <Section
        {...group(
          'Age',
          AGE_GROUPS.filter(([id]) => draft.ages.includes(id)).map(([, label]) => label),
        )}
      >
        {AGE_GROUPS.map(([id, label]) => (
          <ChoiceRow
            key={id}
            label={label}
            count={n((p) => ageGroup(p) === id)}
            selected={draft.ages.includes(id)}
            onClick={() => toggleIn('ages', id)}
          />
        ))}
      </Section>
      <Section {...group('Procession', [draft.procession && 'Going for procession'])}>
        <ChoiceRow
          label="Going for procession"
          count={n((p) => !!p.pr)}
          selected={draft.procession}
          onClick={() => setDraft((d) => ({ ...d, procession: !d.procession }))}
        />
      </Section>
      <Section
        {...group(
          'Procession zone',
          draft.zones.map((z) => `Zone ${z}`),
        )}
      >
        {ZONES.map((z) => (
          <ChoiceRow
            key={z}
            label={`Zone ${z}`}
            count={n((p) => p.pr?.z === z)}
            selected={draft.zones.includes(z)}
            onClick={() => toggleIn('zones', z)}
          />
        ))}
      </Section>
    </ModalSheet>
  );
}

/** If the map library or tiles fail to start, the list, search and details still work. */
class MapBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
