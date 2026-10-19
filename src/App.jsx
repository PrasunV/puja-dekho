import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AppContext } from './context/AppContext.js';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary.jsx';
import { FAR_FROM_KOLKATA_M, MAP_CENTER, ORS_KEY, REPORT_FORM_URL } from './config.js';
import { useLocation } from './hooks/useLocation.js';
import { useMediaQuery } from './hooks/useMediaQuery.js';
import { useNav } from './hooks/useNav.js';
import { useNearPuja } from './hooks/useNearPuja.js';
import { useOnline } from './hooks/useOnline.js';
import { usePujaData } from './hooks/usePujaData.js';
import { usePujaFilters } from './hooks/usePujaFilters.js';
import { useStoredState } from './hooks/useStoredState.js';
import { useLiveCount } from './hooks/useLiveCount.js';
import { useVisitCount } from './hooks/useVisitCount.js';
import { haversine } from './lib/geo.js';
import { LINE_ORDER } from './lib/metro.js';
import { walkingRoute } from './lib/route.js';
import Explore from './features/explore/Explore.jsx';
import BottomSheet from './features/layout/BottomSheet.jsx';
import Explainer from './features/layout/Explainer.jsx';
import OutsideCard from './features/layout/OutsideCard.jsx';
import Header from './features/layout/Header.jsx';
import MotionLab from './features/layout/MotionLab.jsx';
import { MapTools, OfflineBadge, ShowKolkata, ViewCount } from './features/layout/MapOverlays.jsx';
import Peek from './features/layout/Peek.jsx';
import GreetingMedia from './features/greeting/GreetingMedia.jsx';
import { claimGreeting, warmGreeting } from './features/greeting/greetings.js';
import Toasts from './features/layout/Toasts.jsx';
import Metro, { MetroLines, StationResults } from './features/metro/Metro.jsx';
import NearPuja from './features/puja/NearPuja.jsx';
import PujaPage, { PujaActions } from './features/puja/PujaPage.jsx';

// Start fetching the greeting animation straight away, if this open gets one.
warmGreeting();

// The map library is the heaviest dependency, so it loads after the first screen.
const MapView = React.lazy(() => import('./features/map/MapView.jsx'));

const DESKTOP_QUERY = '(min-width: 900px)';
const NEAREST_STATIONS_SHOWN = 4;
/** Fetch the walking route again when the person is this far from where it started, and not more often than this. */
const REROUTE_AWAY_M = 120;
const REROUTE_MIN_MS = 20_000;
/** Constant props for the map, so it does not redraw for nothing. */
const MAP_LAYERS = { stations: true, lines: true, roads: false, crowd: false, other: false };
const NO_LIVE = { pujas: {}, closures: [] };
const NONE = /** @type {never[]} */ ([]);
const NO_VOTES = /** @type {Record<string, 'still' | 'cleared'>} */ ({});

const distanceFromKolkata = (/** @type {{ lat: number, lng: number }} */ point) =>
  haversine(point.lat, point.lng, MAP_CENTER[0], MAP_CENTER[1]);
const isFarFromKolkata = (/** @type {{ lat: number, lng: number }} */ point) => distanceFromKolkata(point) > FAR_FROM_KOLKATA_M;

/** Everything after the static data has loaded. */
function Loaded({ data }) {
  const toast = useToast();
  const online = useOnline();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const mapRef = useRef(/** @type {import('./features/map/MapView.jsx').MapHandle | null} */ (null));

  // Screen state. `nav` is what the sheet shows apart from the list; every change is a browser history entry.
  const [nav, go, back] = useNav();
  const [sheet, setSheet] = useState(/** @type {'peek' | 'half' | 'full'} */ ('peek'));
  const [routeState, setRouteState] = useState(
    /** @type {{ id: string, route: import('./lib/route.js').Route, origin: { lat: number, lng: number }, at: number } | null} */ (null),
  );
  const visitCount = useVisitCount();
  const liveCount = useLiveCount();
  const [explainerSeen, setExplainerSeen] = useStoredState('explainerSeen', false);
  const [outsideSeen, setOutsideSeen] = useStoredState('outsideSeen', false);
  const [permission, setPermission] = useState(/** @type {string | null} */ (navigator.permissions ? null : 'unknown'));

  // Location. A fix far from Kolkata still draws the dot, but is not used for distances or for moving the map.
  const onFix = useCallback((point, isFirstFix) => {
    if (isFarFromKolkata(point)) return;
    if (isFirstFix) mapRef.current?.autoCenter(point);
  }, []);
  const { position: rawPosition, status: rawStatus, locate: requestLocation } = useLocation(onFix);
  const far = rawPosition != null && isFarFromKolkata(rawPosition);
  const position = far ? null : rawPosition;
  const locationStatus = /** @type {'idle' | 'asking' | 'on' | 'denied' | 'far'} */ (far ? 'far' : rawStatus);
  const farKm = far && rawPosition ? Math.round(distanceFromKolkata(rawPosition) / 1000) : null;
  const showOutside = far && !outsideSeen;
  const [centred, setCentred] = useState(false);
  const [following, setFollowing] = useState(false);

  /**
   * The one "take me to my location" action behind every location button. With a fix it flies back
   * straight away (no waiting on the GPS); without one it asks, then flies there.
   * @param {(position: import('./lib/types.js').Position) => void} [then]
   */
  const locate = useCallback(
    (then) => {
      if (then) return requestLocation(then);
      if (rawPosition) return mapRef.current?.recenter(rawPosition);
      return requestLocation((point) => mapRef.current?.recenter(point));
    },
    [rawPosition, requestLocation],
  );
  /** Google Maps behaviour: first tap centres on you, second follows you, third stops. It never changes the radius. */
  const onLocationButton = () => {
    if (following) setFollowing(false);
    else if (rawPosition && centred) setFollowing(true);
    else {
      locate();
      setFollowing(false);
    }
  };

  // First launch: explain before the browser asks. The browser prompt can only be shown once.
  useEffect(() => {
    let cancelled = false;
    if (!navigator.permissions?.query) return undefined;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => !cancelled && setPermission(result.state))
      .catch(() => !cancelled && setPermission('unknown'));
    return () => {
      cancelled = true;
    };
  }, []);
  const showExplainer = !explainerSeen && locationStatus === 'idle' && (permission === 'prompt' || permission === 'unknown');

  // When the greeting lives at the top of the list sheet, open the sheet to half so it is actually seen.
  useEffect(() => {
    if (permission === null || showExplainer || showOutside || desktop) return undefined;
    if (!claimGreeting('list')) return undefined;
    const frame = requestAnimationFrame(() => setSheet((s) => (s === 'peek' ? 'half' : s)));
    return () => cancelAnimationFrame(frame);
  }, [permission, showExplainer, showOutside, desktop]);

  // Without a location the map shows the whole city and the list says "271 pujas in Kolkata".
  const cityMode =
    locationStatus === 'denied' ||
    locationStatus === 'far' ||
    (explainerSeen && locationStatus === 'idle' && permission !== 'granted' && permission != null);
  const fitted = useRef(false);
  const meRef = useRef(/** @type {import('./lib/types.js').Position | null} */ (null));
  useEffect(() => {
    meRef.current = far ? rawPosition : null;
  }, [far, rawPosition]);
  useEffect(() => {
    if (!cityMode || fitted.current) return undefined;
    const points = data.pujas.map((puja) => /** @type {[number, number]} */ ([puja.la, puja.lo]));
    const timer = setInterval(() => {
      if (!mapRef.current) return;
      fitted.current = true;
      // Far away: frame the whole city and the person together, so the dot is not lost off-screen.
      mapRef.current.fitCity(points, meRef.current ?? undefined);
      clearInterval(timer);
    }, 300);
    return () => clearInterval(timer);
  }, [cityMode, data]);

  // Sheet state: a chosen station replaces the radius; lines only draw and list.
  const station = nav.stationId ? (data.stById.get(nav.stationId) ?? null) : null;
  const filters = usePujaFilters({ data, position, station });
  const near = useNearPuja(data.pujas, position);
  /** "Show Kolkata" for people outside the city: the cluster alone, without the far-away dot. */
  const showKolkata = useCallback(() => {
    mapRef.current?.fitCity(data.pujas.map((puja) => /** @type {[number, number]} */ ([puja.la, puja.lo])));
  }, [data]);

  // The latest of the two quick filters wins the sheet: choosing an area shows its list, choosing a line shows the line.
  const [zoneFocus, setZoneFocus] = useState(false);
  const view = /** @type {import('./context/AppContext.js').AppValue['view']} */ (
    nav.pujaId
      ? 'puja'
      : nav.stationId
        ? 'station'
        : nav.metro
          ? 'metro'
          : nav.lines.length && !(filters.zones.length && zoneFocus)
            ? 'lines'
            : near.puja
              ? 'near'
              : 'browse'
  );
  // Opening something from the peek brings the sheet up to the middle.
  useEffect(() => {
    if (!desktop && (view === 'puja' || view === 'lines' || view === 'station' || view === 'metro'))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to a navigation change; there is no event to hang it on
      setSheet((s) => (s === 'peek' ? 'half' : s));
  }, [view, desktop]);

  // The radius chip zooms the map to fit the circle.
  const lastRadius = useRef(filters.radius);
  useEffect(() => {
    if (lastRadius.current === filters.radius) return;
    lastRadius.current = filters.radius;
    if (position) mapRef.current?.fitRadius(position, filters.radius);
  }, [filters.radius, position]);

  // Choosing or clearing an area chip frames the map on those pujas (or back on the person / the city).
  // `frameZones` always reads the latest results; the effect below only reacts to the chips changing.
  const frameZones = useRef(() => {});
  useEffect(() => {
    frameZones.current = () => {
      if (filters.zones.length) {
        const points = filters.mapResults.map((puja) => /** @type {[number, number]} */ ([puja.la, puja.lo]));
        if (points.length) mapRef.current?.fitPoints(points);
      } else if (position) {
        mapRef.current?.fitRadius(position, filters.radius);
      } else {
        mapRef.current?.fitCity(data.pujas.map((puja) => /** @type {[number, number]} */ ([puja.la, puja.lo])));
      }
    };
  });
  const lastZones = useRef(filters.zones);
  useEffect(() => {
    if (lastZones.current === filters.zones) return undefined;
    lastZones.current = filters.zones;
    // Wait for the sheet to finish rising: the points must clear the sheet at its new height, not the old one.
    const timer = setTimeout(() => frameZones.current(), 450);
    return () => clearTimeout(timer);
  }, [filters.zones]);

  // Back keeps the list where it was: remember the scroll position when something opens over it.
  const listScroll = useRef(0);
  const prevView = useRef(view);
  useEffect(() => {
    const body = document.querySelector('.panel-body');
    if (prevView.current === 'browse' && view !== 'browse' && body) listScroll.current = body.scrollTop;
    // A new screen always opens at its top.
    if (view !== 'browse' && body) body.scrollTop = 0;
    if (prevView.current !== 'browse' && view === 'browse') {
      const top = listScroll.current;
      setTimeout(() => {
        const next = document.querySelector('.panel-body');
        if (next) next.scrollTop = top;
      }, 200);
    }
    prevView.current = view;
  }, [view, nav.pujaId, nav.stationId]);

  // Navigation.
  const openPuja = useCallback(
    (id) => {
      go({ pujaId: id });
      if (!desktop) setSheet((s) => (s === 'full' ? s : 'half'));
      const puja = data.byId.get(id);
      if (puja) setTimeout(() => mapRef.current?.flyToPuja(puja), 30);
    },
    [desktop, data, go],
  );
  const openStation = useCallback(
    (id) => {
      go({ stationId: id, pujaId: null, metro: false });
      if (!desktop) setSheet((s) => (s === 'full' ? s : 'half'));
      setTimeout(() => mapRef.current?.flyToStation(id), 30);
    },
    [desktop, go],
  );
  const setStation = useCallback((id) => go({ stationId: id, pujaId: null, metro: false }), [go]);
  const setLines = useCallback(
    (lines) => {
      if (lines.length) setZoneFocus(false);
      go({ lines, stationId: null, pujaId: null, metro: false }, { replace: lines.length > 0 && nav.lines.length > 0 });
      // Frame the whole selected line(s): a line like Green can lie entirely outside the current view.
      const byId = new Map(data.stations.map((stop) => [stop.id, stop]));
      const points = lines.flatMap((line) =>
        (LINE_ORDER[line] ?? []).flatMap((id) => {
          const stop = byId.get(id);
          return stop ? [/** @type {[number, number]} */ ([stop.lat, stop.lng])] : [];
        }),
      );
      if (points.length) setTimeout(() => mapRef.current?.fitPoints(points), 30);
    },
    [go, nav.lines.length, data],
  );

  const toggleZone = useCallback(
    (/** @type {string} */ id) => {
      const turningOn = !filters.zones.includes(id);
      filters.toggleZone(id);
      if (turningOn) {
        setZoneFocus(true);
        // Bring the list up so the count and the pujas of the chosen areas are what the sheet shows.
        setSheet((current) => (current === 'peek' ? 'half' : current));
      }
      // Whatever was open (a puja, a station, Metro nearby) closes: the sheet now shows the chosen areas.
      if (nav.pujaId || nav.stationId || nav.metro) go({ pujaId: null, stationId: null, metro: false }, { replace: true });
    },
    [filters, nav.pujaId, nav.stationId, nav.metro, go],
  );

  const highlightedStations = useMemo(() => {
    if (!nav.metro || !position) return NONE;
    return data.stations
      .filter((s) => s.lines.length)
      .map((s) => ({ id: s.id, d: haversine(position.lat, position.lng, s.lat, s.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, NEAREST_STATIONS_SHOWN)
      .map((entry) => entry.id);
  }, [nav.metro, position, data]);

  /** The Metro button: nearest stations with walking distance in the sheet. */
  const openMetro = useCallback(() => {
    go({ metro: true, pujaId: null, stationId: null });
    if (!desktop) setSheet((s) => (s === 'peek' ? 'half' : s));
    const fit = (point) => {
      const nearest = data.stations
        .filter((s) => s.lines.length)
        .map((s) => ({ s, d: haversine(point.lat, point.lng, s.lat, s.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, NEAREST_STATIONS_SHOWN);
      setTimeout(
        () =>
          mapRef.current?.fitPoints([
            [point.lat, point.lng],
            ...nearest.map((entry) => /** @type {[number, number]} */ ([entry.s.lat, entry.s.lng])),
          ]),
        60,
      );
    };
    if (position) fit(position);
    else if (locationStatus !== 'far') locate((point) => !isFarFromKolkata(point) && fit(point));
  }, [desktop, data, position, locationStatus, locate, go]);

  // Get directions hands off to Google Maps (the link itself); here we only warn when offline.
  const openDirections = useCallback(() => {
    if (!online) toast("You're offline. Directions need a connection.");
  }, [online, toast]);

  // Opening a puja draws the walking route from the person to it, dotted like Google Maps.
  // It is fetched once per puja, from where the person is at that moment, and goes away with the puja.
  // If they walk well away from where it started it is fetched again, at most every 20 seconds.
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  const positionNow = useRef(position);
  useEffect(() => {
    positionNow.current = position;
  }, [position]);
  const orsKey = ORS_KEY || (window.__PD_E2E__ && window.__PD_E2E_ORS_KEY__) || '';
  const hasPosition = position != null;
  const openPujaId = nav.pujaId;
  const [rerouteTick, setRerouteTick] = useState(0);
  const routeStateRef = useRef(routeState);
  useEffect(() => {
    const target = openPujaId ? data.byId.get(openPujaId) : null;
    const from = positionNow.current;
    if (!target || !from || !online || !orsKey) return undefined;
    const abort = new AbortController();
    walkingRoute(from, { lat: target.la, lng: target.lo }, { key: orsKey, signal: abort.signal }).then((found) => {
      if (abort.signal.aborted) return;
      if (found) setRouteState({ id: target.id, route: found, origin: from, at: Date.now() });
      else if (!routeStateRef.current || routeStateRef.current.id !== target.id)
        toastRef.current("Couldn't draw the walking route. Get directions still works.");
    });
    return () => abort.abort();
  }, [openPujaId, hasPosition, online, orsKey, data, rerouteTick]);
  const route = routeState && routeState.id === nav.pujaId ? routeState.route : null;
  useEffect(() => {
    routeStateRef.current = routeState;
    if (!routeState || routeState.id !== openPujaId || !position) return;
    const away = haversine(position.lat, position.lng, routeState.origin.lat, routeState.origin.lng);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the person walking off the route's start
    if (away > REROUTE_AWAY_M && Date.now() - routeState.at > REROUTE_MIN_MS) setRerouteTick((n) => n + 1);
  }, [routeState, position, openPujaId]);

  // Test-only hook, enabled by the e2e suite via `window.__PD_E2E__`.
  useEffect(() => {
    if (window.__PD_E2E__) window.__pd = { data, openPuja, openStation, openMetro, near };
  }, [data, openPuja, openStation, openMetro, near]);

  const context = useMemo(
    () => ({
      data,
      desktop,
      position,
      locationStatus,
      farKm,
      showKolkata,
      locate,
      filters,
      view,
      nav,
      pujaId: nav.pujaId,
      station,
      setStation,
      setLines,
      toggleZone,
      openPuja,
      openStation,
      back,
      openDirections,
      route,
      near,
      toast,
      setSheet,
      mapRef,
    }),
    [
      data,
      desktop,
      position,
      locationStatus,
      farKm,
      showKolkata,
      locate,
      filters,
      view,
      nav,
      station,
      setStation,
      setLines,
      toggleZone,
      openPuja,
      openStation,
      back,
      openDirections,
      route,
      near,
      toast,
    ],
  );

  let screen = <Explore />;
  /** @type {React.ReactNode} */
  let footer = null;
  if (view === 'puja' && nav.pujaId) {
    const puja = data.byId.get(nav.pujaId);
    screen = <PujaPage />;
    footer = puja ? <PujaActions puja={puja} /> : null;
  } else if (view === 'near' && near.puja) {
    screen = <NearPuja puja={near.puja} canSkip={near.canSkip} onDismiss={near.dismiss} onNotThisOne={near.notThisOne} />;
    footer = <PujaActions puja={near.puja} />;
  } else if (view === 'station') screen = <StationResults />;
  else if (view === 'lines') screen = <MetroLines />;
  else if (view === 'metro') screen = <Metro />;

  // Phones: the buttons and the pill sit 16px above the sheet and follow it while it moves (BottomSheet sets --sheet-h).
  // The pill stops at the top of the map and then rides on the sheet.
  const mapBottom = desktop ? 24 : 'calc(var(--sheet-h, 14%) + 16px)';
  const pillBottom = desktop ? 24 : 'min(calc(var(--sheet-h, 14%) + 16px), calc(100% - 38px))';
  const selectedId = nav.pujaId ?? (view === 'near' ? (near.puja?.id ?? null) : null);

  return (
    <MotionConfig reducedMotion="user">
      <AppContext.Provider value={context}>
        <div id="app">
          <Header />
          <main className="stage">
            <ErrorBoundary
              fallback={(reset) => (
                <div id="map" className="map-failed" role="alert">
                  <p>The map could not load.</p>
                  <button type="button" className="btn" onClick={reset}>
                    Try again
                  </button>
                </div>
              )}
            >
              <Suspense fallback={<div id="map" aria-busy="true" />}>
                <MapView
                  ref={mapRef}
                  data={data}
                  results={filters.mapResults}
                  live={NO_LIVE}
                  saved={NONE}
                  layers={MAP_LAYERS}
                  selectedId={selectedId}
                  position={rawPosition}
                  tourPoints={NONE}
                  roadMode={false}
                  votes={NO_VOTES}
                  desktop={desktop}
                  highlightedStations={highlightedStations}
                  visibleLines={nav.lines}
                  route={route}
                  onCentredChange={setCentred}
                  following={following}
                  onFollowStop={() => setFollowing(false)}
                  onUserMoved={() => {}}
                  onMapTap={() => {
                    if (!desktop) setSheet('peek');
                  }}
                  onPuja={openPuja}
                  onStation={openStation}
                  onRoadPick={() => {}}
                  onVote={() => {}}
                />
              </Suspense>
            </ErrorBoundary>
            <OfflineBadge online={online} />
            <MotionLab />
            <ViewCount visits={visitCount} live={liveCount} bottom={pillBottom} full={!desktop && sheet === 'full'} />
            <ShowKolkata visible={far} onClick={showKolkata} />
            <MapTools
              locationStatus={rawStatus}
              centred={centred}
              following={following}
              metroOpen={view === 'metro'}
              bottom={mapBottom}
              reportUrl={REPORT_FORM_URL}
              online={online}
              onLocate={onLocationButton}
              onMetro={view === 'metro' ? back : openMetro}
              onOfflineReport={() => toast(`You're offline. The report form is at ${REPORT_FORM_URL}`)}
            />
            <BottomSheet sheet={sheet} onSheetChange={setSheet} desktop={desktop} peek={<Peek />} footer={footer}>
              {/* Everyone else (not on their first visit) gets the greeting at the top of the list sheet. It is mounted
                  once the permission answer is in, so the first-visit sheets can claim it first, and it stays mounted
                  while a puja is open so it does not replay on the way back. */}
              {permission !== null && !showExplainer && !showOutside && (
                <div hidden={view !== 'browse'}>
                  <GreetingMedia slot="list" fallback={null} />
                </div>
              )}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={view + (nav.pujaId || '') + (nav.stationId || '')}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                >
                  {screen}
                </motion.div>
              </AnimatePresence>
            </BottomSheet>
          </main>
          <Toasts />
          <AnimatePresence>
            {showExplainer && (
              <Explainer
                key="explainer"
                onAllow={() => {
                  setExplainerSeen(true);
                  locate();
                }}
                onLater={() => setExplainerSeen(true)}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showOutside && !showExplainer && (
              <OutsideCard
                key="outside"
                km={farKm ?? 0}
                count={data.pujas.length}
                onClose={() => setOutsideSeen(true)}
                onShowKolkata={() => {
                  setOutsideSeen(true);
                  showKolkata();
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </AppContext.Provider>
    </MotionConfig>
  );
}

/** Loads the static data, then renders the app. */
function AppShell() {
  const { data, error } = usePujaData();
  if (error)
    return (
      <div className="fatal" role="alert">
        {error}
      </div>
    );
  if (!data)
    return (
      <div className="fatal" aria-busy="true">
        Loading Puja Dekho…
      </div>
    );
  return <Loaded data={data} />;
}

/** Root: error boundary, then toasts, then the shell. */
export default function App() {
  return (
    <ErrorBoundary
      fallback={() => (
        <div className="fatal" role="alert">
          Something went wrong.{' '}
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
    >
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ErrorBoundary>
  );
}
