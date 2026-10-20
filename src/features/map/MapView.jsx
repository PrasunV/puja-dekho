import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { CENTRED_TOLERANCE_PX, MAP_CENTER, MAP_STYLE_URL, MAP_ZOOM, RECENTER_MIN_ZOOM } from '../../config.js';
import { circleRing, haversine, toMapZoom } from '../../lib/geo.js';
import { LINE_ORDER, MAPPED_LINES, stationLines } from '../../lib/metro.js';
import { CLOSURE_KINDS, formatAge } from '../../lib/pujas.js';
import { routeLabel } from '../../lib/route.js';
import { cssVar, el, holder, toLngLat } from './dom.js';
import { makePin } from './pin.js';

/**
 * @typedef {object} MapHandle  Imperative camera controls for the parent
 * @property {(puja: import('../../lib/types.js').Puja) => void} flyToPuja
 * @property {(stationId: string) => void} flyToStation
 * @property {(position?: import('../../lib/types.js').Position) => void} recenter   Fly back to the person from anywhere, zoomed in
 * @property {(position: import('../../lib/types.js').Position) => void} autoCenter  Same, but only if the person has not moved the map yet
 * @property {(points: [number, number][]) => void} fitPoints  `[lat, lng]` pairs
 * @property {() => void} fitTour
 * @property {(position: import('../../lib/types.js').Position, metres: number) => void} fitRadius  Zoom to a circle around the person
 * @property {(points: [number, number][], me?: { lat: number, lng: number }) => void} fitCity  Show all pujas (`[lat, lng]` pairs), plus the person when given and not too far
 * @property {() => import('../../lib/types.js').Viewport | null} getViewport  What the map shows right now
 */

/**
 * @typedef {object} MapProps
 * @property {import('../../lib/types.js').PujaData} data
 * @property {import('../../lib/types.js').Puja[]} results         Pujas to draw (the filtered list)
 * @property {import('../../lib/types.js').LiveState} live
 * @property {string[]} saved
 * @property {Record<string, boolean>} layers
 * @property {string | null} selectedId
 * @property {import('../../lib/types.js').Position | null} position
 * @property {[number, number][]} tourPoints                       `[lat, lng]` pairs
 * @property {boolean} roadMode
 * @property {Record<string, 'still' | 'cleared'>} votes
 * @property {boolean} desktop
 * @property {string[]} highlightedStations
 * @property {string[]} visibleLines                           Metro lines switched on: only these lines and their stations are drawn
 * @property {import('../../lib/route.js').Route | null} route  Walking route from the person to the open puja, or null
 * @property {(centred: boolean) => void} onCentredChange  Whether the person's dot is in the middle of the visible map
 * @property {boolean} following                             Keep the map on the person as they move
 * @property {() => void} onFollowStop                       Following ended (the person dragged the map, or another screen took the camera)
 * @property {(empty: boolean) => void} [onEmptyView]   After every move: true when no puja is on screen
 * @property {() => void} onUserMoved                        The person finished dragging, pinching or scrolling the map
 * @property {() => void} onMapTap                         A tap on empty map (not a puja, cluster or drag)
 * @property {(id: string) => void} onPuja
 * @property {(id: string) => void} onStation
 * @property {(spot: { lat: number, lng: number }) => void} onRoadPick
 * @property {(closure: import('../../lib/types.js').Closure, vote: 'still' | 'cleared') => void} onVote
 */

const LINE_COLOR = { blue: '#1F6FEB', green: '#12975A' };
const QUEUE_FALLBACK = ['#8A8A8A', '#1FA463', '#E49B0F', '#D92D20'];
const EMPTY = { type: 'FeatureCollection', features: [] };
const SELECTION_NONE = '';
/** Taps within this many pixels of a dot or cluster count as hitting it. */
const TAP_SLOP_PX = 14;
/** Drawn accuracy circles are capped so a coarse network fix does not cover the whole map. */
const MAX_ACCURACY_RING_M = 1500;
/** Outside Kolkata, the person joins the city in one frame only when they are within this distance. */
const FRAME_ME_WITHIN_M = 350_000;

/** Height of the list sheet covering the bottom of the map on phones. */
/** Bounds around `[lat, lng]` points. */
const boundsOf = (/** @type {[number, number][]} */ points) =>
  points.reduce((bounds, p) => bounds.extend(toLngLat(p)), new maplibregl.LngLatBounds(toLngLat(points[0]), toLngLat(points[0])));
const panelHeight = () => document.querySelector('.panel')?.getBoundingClientRect().height || 300;
/**
 * The height the sheet is heading for, from its state (peek, half, full) rather than from a live measurement,
 * so a fit made while the sheet is still sliding clears the sheet where it will end up.
 */
const sheetTargetHeight = () => {
  const panel = /** @type {HTMLElement | null} */ (document.querySelector('.panel'));
  if (!panel) return 300;
  const share = { peek: 0.14, initial: 0.35, half: 0.5, full: 1 }[panel.dataset.sheet ?? 'half'] ?? 0.5;
  const parent = panel.offsetParent ?? panel.parentElement;
  return parent ? parent.clientHeight * share : panel.getBoundingClientRect().height;
};
/** Bottom padding that keeps fitted points above the sheet, but never more than 55% of the map (a full-height sheet). */
const sheetPadding = (/** @type {boolean} */ desktop, /** @type {HTMLElement | null} */ canvas) =>
  desktop ? 40 : Math.min(sheetTargetHeight(), (canvas?.clientHeight ?? 800) * 0.55) + 24;
/** Camera offset that puts a point in the middle of the part of the map the sheet does not cover. */
const visibleOffset = (desktop) => /** @type {[number, number]} */ (desktop ? [0, 0] : [0, -panelHeight() / 2]);

/** Map style layers added on top of the base style. */
function addLayers(map, data) {
  const accent = cssVar('--accent', '#fc8105');
  const primary = cssVar('--primary', '#b31d24');
  const queueColors = [0, 1, 2, 3].map((n) => cssVar(`--q${n}`, QUEUE_FALLBACK[n]));
  // Cluster counts need a font the base style already ships, so the glyph files exist.
  const labelLayer = map.getStyle().layers.find((layer) => layer.type === 'symbol' && layer.layout?.['text-font']);
  const rawFont = labelLayer?.layout?.['text-font'];
  const font = Array.isArray(rawFont) && rawFont.every((name) => typeof name === 'string') ? rawFont : ['Noto Sans Regular'];

  map.addSource('lines', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: MAPPED_LINES.map((line) => ({
        type: 'Feature',
        properties: { line },
        geometry: {
          type: 'LineString',
          coordinates: LINE_ORDER[line]
            .map((id) => data.stById.get(id))
            .filter(Boolean)
            .map((station) => [station.lng, station.lat]),
        },
      })),
    },
  });
  map.addLayer({
    id: 'metro-lines',
    type: 'line',
    source: 'lines',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['match', ['get', 'line'], 'blue', LINE_COLOR.blue, LINE_COLOR.green], 'line-width': 4, 'line-opacity': 0.75 },
  });
  map.addSource('route', { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-dasharray': [0.001, 1.1] },
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    // Dotted like a Google Maps walking route: white dots under blue dots, so they read on any background.
    paint: { 'line-color': '#1a73e8', 'line-width': 5, 'line-dasharray': [0.001, 1.76] },
  });
  map.addSource('tour', { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: 'tour-line',
    type: 'line',
    source: 'tour',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': accent, 'line-width': 5, 'line-opacity': 0.95, 'line-dasharray': [0.3, 2] },
  });
  map.addSource('me-accuracy', { type: 'geojson', data: EMPTY });
  const me = cssVar('--me', '#1a73e8');
  map.addLayer({ id: 'me-accuracy-fill', type: 'fill', source: 'me-accuracy', paint: { 'fill-color': me, 'fill-opacity': 0.14 } });
  map.addLayer({
    id: 'me-accuracy-line',
    type: 'line',
    source: 'me-accuracy',
    paint: { 'line-color': me, 'line-opacity': 0.35, 'line-width': 1 },
  });
  map.addSource('pujas', {
    type: 'geojson',
    data: EMPTY,
    cluster: true,
    clusterRadius: 44,
    clusterMaxZoom: toMapZoom(17) - 1,
    promoteId: 'id',
  });
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'pujas',
    filter: ['has', 'point_count'],
    paint: { 'circle-color': cssVar('--maroon', '#4a0e14'), 'circle-radius': 19, 'circle-stroke-width': 3, 'circle-stroke-color': accent },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'pujas',
    filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': font, 'text-size': 14, 'text-allow-overlap': true },
    paint: { 'text-color': cssVar('--on-maroon', '#ffffff') },
  });
  map.addLayer({
    id: 'puja-sel',
    type: 'circle',
    source: 'pujas',
    filter: ['==', ['get', 'id'], SELECTION_NONE],
    paint: { 'circle-radius': 20, 'circle-color': accent, 'circle-opacity': 0.4 },
  });
  map.addLayer({
    id: 'pujas',
    type: 'circle',
    source: 'pujas',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'f'], 1], 12, 10],
      'circle-color': ['match', ['get', 'q'], 0, queueColors[0], 1, queueColors[1], 2, queueColors[2], 3, queueColors[3], primary],
      'circle-stroke-width': 3,
      'circle-stroke-color': ['case', ['==', ['get', 's'], 1], primary, '#ffffff'],
    },
  });
}

/** One marker per metro station; a few dozen DOM nodes is cheaper than a symbol layer with icons. */
function createStationMarkers(data, callbacks) {
  return data.stations
    .filter((station) => station.lines.length)
    .map((station) => {
      const lines = stationLines(station);
      const tone = lines.length === 2 ? 'both' : lines[0] || 'muted';
      const letter = lines.length === 2 ? 'M' : { blue: 'B', green: 'G' }[lines[0]] || '';
      const inner = el('span', { class: `sm ${tone}`, title: station.name }, letter);
      const wrapper = holder(inner);
      wrapper.addEventListener('click', (event) => {
        event.stopPropagation();
        callbacks.current.onStation(station.id);
      });
      return {
        station,
        inner,
        wrapper,
        mapped: lines.length > 0,
        marker: new maplibregl.Marker({ element: wrapper }).setLngLat([station.lng, station.lat]),
        visible: false,
      };
    });
}

/** Popup for a road report with "still there / cleared" voting. */
function createClosurePopup(closure, callbacks) {
  const [label] = CLOSURE_KINDS[closure.type] || ['Road issue'];
  const popup = new maplibregl.Popup({ offset: 16, maxWidth: '260px' });
  popup.on('open', () => {
    const myVote = callbacks.current.votes?.[closure.id];
    const voteButton = (text, vote) =>
      el(
        'button',
        {
          class: 'btn small grow',
          type: 'button',
          'aria-pressed': String(myVote === vote),
          onclick: () => {
            callbacks.current.onVote(closure, vote);
            popup.remove();
          },
        },
        text,
      );
    const counts = `Reported ${formatAge(closure.ageMin)} · ${closure.still} say still there${closure.cleared ? `, ${closure.cleared} say cleared` : ''}`;
    popup.setDOMContent(
      el(
        'div',
        { class: 'stack tight' },
        el('b', {}, label),
        ...(closure.note ? [el('div', {}, closure.note)] : []),
        el('div', { class: 'sub' }, counts),
        el('div', { class: 'row' }, voteButton('Still there', 'still'), voteButton('Cleared', 'cleared')),
      ),
    );
  });
  popup.setDOMContent(el('div', {}, label));
  return popup;
}

/**
 * The MapLibre map: puja points (clustered), metro lines and stations, road reports,
 * the tour line and the person's location. Everything it shows arrives as props.
 */
const MapView = forwardRef(
  /** @param {MapProps} props @param {import('react').ForwardedRef<MapHandle>} ref */ function MapView(
    {
      data,
      results,
      live,
      saved,
      layers,
      selectedId,
      position,
      tourPoints,
      roadMode,
      votes,
      desktop,
      highlightedStations,
      visibleLines,
      route,
      onCentredChange,
      following,
      onFollowStop,
      onUserMoved,
      onEmptyView,
      onMapTap,
      onPuja,
      onStation,
      onRoadPick,
      onVote,
    },
    ref,
  ) {
    const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
    const mapRef = useRef(/** @type {maplibregl.Map | null} */ (null));
    const overlays = useRef({
      stations: /** @type {any[]} */ ([]),
      roads: /** @type {any[]} */ ([]),
      me: /** @type {maplibregl.Marker | null} */ (null),
      tourPoints: /** @type {[number, number][]} */ ([]),
    });
    const [ready, setReady] = useState(false);
    // Latest fix, and whether the person has dragged or zoomed the map themselves.
    const positionRef = useRef(/** @type {import('../../lib/types.js').Position | null} */ (null));
    const userMoved = useRef(false);
    const centredRef = useRef(false);
    // Map event handlers are bound once; they read the freshest props through this ref.
    const callbacks = useRef({
      roadMode,
      onRoadPick,
      onPuja,
      onStation,
      onVote,
      onCentredChange,
      following,
      onFollowStop,
      onUserMoved,
      onEmptyView,
      onMapTap,
      votes,
      desktop,
    });
    useEffect(() => {
      callbacks.current = {
        roadMode,
        onRoadPick,
        onPuja,
        onStation,
        onVote,
        onCentredChange,
        following,
        onFollowStop,
        onUserMoved,
        onEmptyView,
        onMapTap,
        votes,
        desktop,
      };
    });

    /** Tell the parent whether the person's dot sits in the middle of the visible map. */
    const syncCentred = () => {
      const map = mapRef.current;
      const point = positionRef.current;
      if (!map || !point) return;
      const canvas = map.getCanvas();
      const covered = callbacks.current.desktop ? 0 : panelHeight();
      const screen = map.project([point.lng, point.lat]);
      const offCentre = Math.hypot(screen.x - canvas.clientWidth / 2, screen.y - (canvas.clientHeight - covered) / 2);
      const centred = offCentre <= CENTRED_TOLERANCE_PX && map.getZoom() >= toMapZoom(RECENTER_MIN_ZOOM - 1);
      if (centred !== centredRef.current) {
        centredRef.current = centred;
        callbacks.current.onCentredChange(centred);
      }
    };

    // Create the map once.
    useEffect(() => {
      const map = new maplibregl.Map({
        container: /** @type {HTMLDivElement} */ (containerRef.current),
        style: MAP_STYLE_URL,
        center: [MAP_CENTER[1], MAP_CENTER[0]],
        zoom: toMapZoom(MAP_ZOOM),
        // Low enough that the whole of Kolkata, Howrah and the northern suburbs fit above the sheet on a phone.
        minZoom: toMapZoom(7),
        maxZoom: toMapZoom(19),
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      });
      mapRef.current = map;
      if (window.__PD_E2E__) window.__pdMap = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
      // A move with an original event is the person's own drag, pinch or scroll.
      let dragging = false;
      map.on('movestart', (event) => {
        if (!event.originalEvent) return;
        userMoved.current = true;
        dragging = true;
        if (callbacks.current.following) callbacks.current.onFollowStop();
      });
      map.on('moveend', () => {
        syncCentred();
        // No puja dot or cluster anywhere on screen: the person has drifted off the map of pujas.
        // Asked once the map has drawn, since a jump has not painted its dots yet when it ends.
        map.once('idle', () => {
          if (map.getLayer('pujas')) callbacks.current.onEmptyView?.(map.queryRenderedFeatures({ layers: ['clusters', 'pujas'] }).length === 0);
        });
        if (dragging) {
          dragging = false;
          callbacks.current.onUserMoved();
        }
      });
      map.on('error', (event) => {
        if (event?.error) console.warn('map:', event.error.message || event.error);
      });
      map.on('load', () => {
        addLayers(map, data);
        // One click handler with a forgiving hit area: the dots are 20 px, a thumb is not.
        map.on('click', async (event) => {
          if (callbacks.current.roadMode) {
            callbacks.current.onRoadPick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
            return;
          }
          const { x, y } = event.point;
          const hits = map.queryRenderedFeatures(
            [
              [x - TAP_SLOP_PX, y - TAP_SLOP_PX],
              [x + TAP_SLOP_PX, y + TAP_SLOP_PX],
            ],
            { layers: ['clusters', 'pujas'] },
          );
          const pixelsAway = (feature) => {
            const at = map.project(/** @type {[number, number]} */ (/** @type {any} */ (feature.geometry).coordinates));
            return Math.hypot(at.x - x, at.y - y);
          };
          const feature = hits.sort((a, b) => pixelsAway(a) - pixelsAway(b))[0];
          if (!feature) {
            callbacks.current.onMapTap?.();
            return;
          }
          if (feature.properties.cluster_id == null) {
            callbacks.current.onPuja(feature.properties.id);
            return;
          }
          const zoom = await /** @type {maplibregl.GeoJSONSource} */ (map.getSource('pujas')).getClusterExpansionZoom(
            feature.properties.cluster_id,
          );
          map.easeTo({ center: /** @type {[number, number]} */ (/** @type {any} */ (feature.geometry).coordinates), zoom: zoom + 0.01 });
        });
        for (const layer of ['pujas', 'clusters']) {
          map.on('mouseenter', layer, () => {
            if (!callbacks.current.roadMode) map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', layer, () => {
            map.getCanvas().style.cursor = callbacks.current.roadMode ? 'crosshair' : '';
          });
        }
        overlays.current.stations = createStationMarkers(data, callbacks);
        setReady(true);
      });
      return () => {
        map.remove();
        mapRef.current = null;
      };
      // The map is created once; `data` is static for the life of the page.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const timer = setTimeout(() => mapRef.current?.resize(), 50);
      return () => clearTimeout(timer);
    }, [desktop]);

    // Puja points, coloured by queue level.
    useEffect(() => {
      const map = mapRef.current;
      if (!ready || !map) return;
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('pujas')).setData({
        type: 'FeatureCollection',
        features: results.map((puja) => ({
          type: 'Feature',
          id: puja.id,
          properties: {
            id: puja.id,
            f: puja.f ? 1 : 0,
            q: layers.crowd ? (live.pujas[puja.id]?.q?.level ?? -1) : -1,
            s: saved.includes(puja.id) ? 1 : 0,
          },
          geometry: { type: 'Point', coordinates: [puja.lo, puja.la] },
        })),
      });
    }, [ready, results, live, saved, layers.crowd]);

    useEffect(() => {
      const map = mapRef.current;
      if (ready && map) map.setFilter('puja-sel', ['==', ['get', 'id'], selectedId || SELECTION_NONE]);
    }, [ready, selectedId]);

    // The selected puja gets a pin and a tooltip with its name. DOM markers keep one readable size at every zoom.
    useEffect(() => {
      const map = mapRef.current;
      const puja = selectedId ? data.byId.get(selectedId) : null;
      if (!ready || !map || !puja) return undefined;
      const marker = new maplibregl.Marker({ element: holder(makePin(puja.n)), anchor: 'bottom' }).setLngLat([puja.lo, puja.la]).addTo(map);
      marker.getElement().classList.add('sel-pin-holder');
      return () => {
        marker.remove();
      };
    }, [ready, selectedId, data]);

    // Metro lines and stations appear only for the lines switched on (and for stations the Metro list highlights).
    useEffect(() => {
      const map = mapRef.current;
      if (!ready || !map) return;
      map.setFilter('metro-lines', ['in', ['get', 'line'], ['literal', visibleLines]]);
      for (const item of overlays.current.stations) {
        const onLine = stationLines(item.station).some((line) => visibleLines.includes(line));
        const wanted = onLine || Boolean(highlightedStations?.includes(item.station.id));
        if (wanted && !item.visible) {
          item.marker.addTo(map);
          item.visible = true;
        } else if (!wanted && item.visible) {
          item.marker.remove();
          item.visible = false;
        }
      }
      for (const road of overlays.current.roads) road.wrapper.style.display = layers.roads ? '' : 'none';
    }, [ready, layers, visibleLines, highlightedStations]);

    // Highlight the stations the Metro screen is listing.
    useEffect(() => {
      for (const item of overlays.current.stations) {
        const on = Boolean(highlightedStations?.includes(item.station.id));
        item.inner.classList.toggle('hl', on);
        item.wrapper.style.zIndex = on ? '9' : '';
      }
    }, [ready, highlightedStations]);

    // Road reports.
    useEffect(() => {
      const map = mapRef.current;
      if (!ready || !map) return;
      for (const road of overlays.current.roads) road.marker.remove();
      overlays.current.roads = live.closures.map((closure) => {
        const [, glyph] = CLOSURE_KINDS[closure.type] || ['Road issue', '!'];
        const wrapper = holder(el('span', { class: 'cm' }, el('span', {}, glyph)));
        const marker = new maplibregl.Marker({ element: wrapper })
          .setLngLat([closure.lng, closure.lat])
          .setPopup(createClosurePopup(closure, callbacks))
          .addTo(map);
        wrapper.style.zIndex = '5';
        wrapper.style.display = layers.roads ? '' : 'none';
        return { marker, wrapper };
      });
      // `layers.roads` is applied by the layer-toggle effect; re-running here would rebuild markers on every toggle.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, live.closures]);

    // The person's location: Google Maps style blue dot with a pulse, plus the accuracy area.
    useEffect(() => {
      const map = mapRef.current;
      if (!ready || !map || !position) return;
      positionRef.current = position;
      const state = overlays.current;
      if (state.me) state.me.setLngLat([position.lng, position.lat]);
      else {
        const dot = el('span', { class: 'me', title: 'You are here' }, el('span', { class: 'me-pulse' }), el('span', { class: 'me-dot' }));
        state.me = new maplibregl.Marker({ element: holder(dot) }).setLngLat([position.lng, position.lat]).addTo(map);
        state.me.getElement().style.zIndex = '4';
      }
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('me-accuracy')).setData(
        position.acc && position.acc > 0
          ? {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [circleRing(position.lat, position.lng, Math.min(position.acc, MAX_ACCURACY_RING_M))],
              },
            }
          : EMPTY,
      );
      if (callbacks.current.following) {
        map.easeTo({
          center: [position.lng, position.lat],
          offset: visibleOffset(callbacks.current.desktop),
          duration: 600,
          essential: true,
        });
      }
      syncCentred();
      // syncCentred only reads refs, so it is safe to leave out of the dependencies.
    }, [ready, position]);

    // Walking route to the open puja: a dotted line that always starts at the person's dot and ends on the puja,
    // with one time and distance label that stays on the visible part of the line while the map moves.
    const routeUi = useRef({ path: /** @type {[number, number][]} */ ([]), marker: /** @type {maplibregl.Marker | null} */ (null) });
    const placeRouteLabel = () => {
      const map = mapRef.current;
      const { marker, path } = routeUi.current;
      if (!map || !marker || path.length < 2) return;
      const width = map.getContainer().clientWidth;
      const height = map.getContainer().clientHeight - (callbacks.current.desktop ? 0 : panelHeight());
      const visible = path.filter((point) => {
        const at = map.project(point);
        return at.x > 40 && at.x < width - 40 && at.y > 40 && at.y < height - 20;
      });
      const holderEl = marker.getElement();
      if (!visible.length) {
        holderEl.style.visibility = 'hidden';
        return;
      }
      holderEl.style.visibility = '';
      marker.setLngLat(visible[Math.floor(visible.length / 2)]);
    };
    useEffect(() => {
      const map = mapRef.current;
      if (!ready || !map || !route || route.coords.length < 2) return undefined;
      const label = document.createElement('div');
      label.className = 'route-label';
      label.textContent = routeLabel(route);
      const marker = new maplibregl.Marker({ element: holder(label), offset: [0, -18] }).setLngLat(route.coords[0]).addTo(map);
      const ui = routeUi.current;
      ui.marker = marker;
      map.on('move', placeRouteLabel);
      const me = positionRef.current;
      callbacks.current.onFollowStop();
      map.fitBounds(
        boundsOf([
          ...(me ? [/** @type {[number, number]} */ ([me.lat, me.lng])] : []),
          ...route.coords.map(([lng, lat]) => /** @type {[number, number]} */ ([lat, lng])),
        ]),
        {
          padding: { top: 60, left: 50, right: 50, bottom: callbacks.current.desktop ? 60 : panelHeight() + 30 },
          maxZoom: toMapZoom(17),
          duration: 700,
        },
      );
      return () => {
        map.off('move', placeRouteLabel);
        marker.remove();
        ui.marker = null;
      };
      // placeRouteLabel only reads refs
    }, [ready, route]);
    // The line is rebuilt whenever the person moves, so it never stops short of the blue dot.
    useEffect(() => {
      const map = mapRef.current;
      if (!ready || !map) return;
      const puja = selectedId ? data.byId.get(selectedId) : null;
      const path = route
        ? [
            ...(position ? [/** @type {[number, number]} */ ([position.lng, position.lat])] : []),
            ...route.coords,
            ...(puja ? [/** @type {[number, number]} */ ([puja.lo, puja.la])] : []),
          ]
        : [];
      routeUi.current.path = path;
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('route')).setData(
        path.length > 1 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } } : EMPTY,
      );
      placeRouteLabel();
      // placeRouteLabel only reads refs
    }, [ready, route, position, selectedId, data]);

    // Tour line.
    useEffect(() => {
      const map = mapRef.current;
      if (!ready || !map) return;
      overlays.current.tourPoints = tourPoints;
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('tour')).setData(
        tourPoints.length > 1
          ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: tourPoints.map(toLngLat) } }
          : EMPTY,
      );
    }, [ready, tourPoints]);

    useEffect(() => {
      const map = mapRef.current;
      if (map) map.getCanvas().style.cursor = roadMode ? 'crosshair' : '';
    }, [roadMode, ready]);

    useImperativeHandle(ref, () => {
      /** Fly to the person, never leaving the map zoomed out further than street level. */
      const recenter = (point) => {
        const map = mapRef.current;
        const target = point ?? positionRef.current;
        if (!map || !target) return;
        userMoved.current = false;
        map.flyTo({
          center: [target.lng, target.lat],
          zoom: Math.max(map.getZoom(), toMapZoom(RECENTER_MIN_ZOOM)),
          offset: visibleOffset(callbacks.current.desktop),
          duration: 700,
          essential: true,
        });
      };
      return {
        flyToPuja(puja) {
          const map = mapRef.current;
          if (!map) return;
          callbacks.current.onFollowStop();
          map.flyTo({
            center: [puja.lo, puja.la],
            zoom: Math.max(map.getZoom(), toMapZoom(17)),
            duration: 500,
            offset: visibleOffset(callbacks.current.desktop),
          });
        },
        flyToStation(stationId) {
          callbacks.current.onFollowStop();
          const station = data.stById.get(stationId);
          if (station) mapRef.current?.flyTo({ center: [station.lng, station.lat], zoom: toMapZoom(15), duration: 500 });
        },
        getViewport() {
          const map = mapRef.current;
          if (!map) return null;
          const box = map.getBounds();
          const centre = map.getCenter();
          // On phones the list sheet covers the bottom of the map; the area "in view" is the part above it.
          const covered = callbacks.current.desktop ? 0 : panelHeight();
          const canvasHeight = map.getCanvas().clientHeight;
          const south = covered
            ? map.unproject([map.getCanvas().clientWidth / 2, Math.max(canvasHeight - covered, 1)]).lat
            : box.getSouth();
          const visibleCentre = map.unproject([map.getCanvas().clientWidth / 2, (canvasHeight - covered) / 2]);
          return {
            bounds: [box.getWest(), south, box.getEast(), box.getNorth()],
            centre: { lat: covered ? visibleCentre.lat : centre.lat, lng: centre.lng },
          };
        },
        recenter,
        autoCenter(point) {
          if (!userMoved.current) recenter(point);
        },
        fitPoints(points) {
          if (!points.length) return;
          callbacks.current.onFollowStop();
          mapRef.current?.fitBounds(boundsOf(points), {
            padding: { top: 64, left: 40, right: 40, bottom: sheetPadding(callbacks.current.desktop, mapRef.current?.getCanvas() ?? null) },
            maxZoom: toMapZoom(16),
            duration: 500,
          });
        },
        fitRadius(point, metres) {
          const ring = circleRing(point.lat, point.lng, metres, 8);
          callbacks.current.onFollowStop();
          mapRef.current?.fitBounds(boundsOf(ring.map(([lng, lat]) => /** @type {[number, number]} */ ([lat, lng]))), {
            padding: { top: 64, left: 40, right: 40, bottom: sheetPadding(callbacks.current.desktop, mapRef.current?.getCanvas() ?? null) },
            maxZoom: toMapZoom(17),
            duration: 600,
          });
        },
        fitCity(points, me) {
          if (!points.length) return;
          callbacks.current.onFollowStop();
          // The person's dot joins the frame only when they are not hopelessly far away (a country apart).
          const withMe =
            me && haversine(me.lat, me.lng, MAP_CENTER[0], MAP_CENTER[1]) <= FRAME_ME_WITHIN_M
              ? [...points, /** @type {[number, number]} */ ([me.lat, me.lng])]
              : points;
          mapRef.current?.fitBounds(boundsOf(withMe), {
            padding: { top: 64, left: 40, right: 40, bottom: sheetPadding(callbacks.current.desktop, mapRef.current?.getCanvas() ?? null) },
            duration: 0,
          });
        },
        fitTour() {
          callbacks.current.onFollowStop();
          const points = overlays.current.tourPoints;
          if (points.length > 1) mapRef.current?.fitBounds(boundsOf(points), { padding: 50, maxZoom: toMapZoom(16), duration: 500 });
        },
      };
    }, [data]);

    return <div id="map" ref={containerRef} role="application" aria-label="Map of Kolkata pujas" />;
  },
);

export default MapView;
