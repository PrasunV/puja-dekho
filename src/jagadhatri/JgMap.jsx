import maplibregl from 'maplibre-gl';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MAP_BOUNDS, MAP_CENTER, MAP_STYLE_URL, MAP_STYLE_URL_DARK, MAP_ZOOM } from './config.js';

const darkQuery = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);
/** Pin, label and location colours for each phone theme (design tokens --color-primary, surface, text, me). */
const THEME = {
  light: {
    primary: '#B31D24',
    surface: '#FFFFFF',
    ink: '#2B1214',
    me: '#1A73E8',
    free: '#0B7A75',
    crowded: '#C2410C',
    visited: '#2E7D32',
    tick: '#FFFFFF',
    glow: '#F5C400',
    glowInk: '#6B4E00',
    routeInk: '#2B1214',
    badge: '#4A0E14',
    onBadge: '#FFFFFF',
    park: '#1A56C4',
    onPark: '#FFFFFF',
  },
  dark: {
    primary: '#E0434B',
    surface: '#1C1C1C',
    ink: '#F2F2F2',
    me: '#669DF6',
    free: '#35B3AA',
    crowded: '#F0813F',
    visited: '#5BC470',
    tick: '#0F2A14',
    glow: '#FFD426',
    glowInk: '#FFE27A',
    routeInk: '#F2F2F2',
    badge: '#F0D3D6',
    onBadge: '#2B1214',
    park: '#7BA7FF',
    onPark: '#0B1F4A',
  },
};

/**
 * The Jagadhatri map (MapLibre). Puja pins are one GeoJSON source drawn as circles, with name labels in a symbol layer
 * that hides any label that would overlap another (design 7.21). Stations and ghats are HTML markers with a train or
 * boat icon and their name. The map is created once; props are synced by small effects.
 *
 * @typedef {object} MapHandle
 * @property {(lat: number, lng: number, zoom?: number) => void} flyTo
 * @property {(lat: number, lng: number, radius: number) => void} fitRadius
 * @property {() => { center: [number, number], zoom: number } | null} camera
 * @property {(cam: { center: [number, number], zoom: number }) => void} restore
 * @property {(points: { la: number, lo: number }[]) => void} fitPoints  Frame a planned route above the sheet
 *
 * @typedef {object} MapProps
 * @property {import('./lib.js').JgPuja[]} pujas
 * @property {import('./lib.js').JgStation[]} stations
 * @property {Set<string> | null} lit       Ids shown at full strength; the rest fade to 10% and ignore taps. Null means all.
 * @property {Set<string>} priority          Ids whose labels win when labels compete (Must visit, active filter)
 * @property {string | null} selectedId
 * @property {Record<string, { level: string }>} [crowd]  Live crowd status: a teal (free) or orange (crowded) dot
 * @property {Set<string>} [visited]         Ids the signed-in person has visited: a solid green pin with a white tick
 * @property {import('./lib.js').JgCentre | null} centre
 * @property {{ lat: number, lng: number, accuracy: number, heading?: number | null } | null} me   heading: a triangle on the dot points the way you are going; none, no triangle
 * @property {(id: string) => void} onPuja
 * @property {(id: string) => void} onStation
 * @property {() => void} onBlank
 * @property {(moving: boolean) => void} onPan    True when a person starts to pan or zoom, false when the map stops
 * @property {() => void} [onReady]
 * @property {() => void} [onFail]     The map style could not load (no network on a first visit)
 * @property {{ la: number, lo: number, n?: number, end?: boolean }[] | null} [route]  A planned walk: dotted line, numbered stops
 * @property {ProcessionLayer | null} [procession]  The procession guide: a yellow glow on each procession puja, the route, zone badges, watch points
 * @property {TrafficLayer | null} [traffic]      Procession-day traffic: blue P for parking, no-entry sign for closed roads
 * @property {boolean} [focus]   Traffic-only view: the station and ghat pins hide, so only the traffic spots stand out
 * @property {(zone: string) => void} [onProcZone]   A zone badge was tapped
 * @property {(i: number) => void} [onProcWatch]     A numbered watch point was tapped
 *
 * @typedef {object} TrafficLayer
 * @property {readonly { k: 'p' | 'n', id: string, la: number, lo: number, near: boolean }[]} spots
 * @property {string | null} sel                      The spot in focus (`k` + id), or null
 *
 * @typedef {object} ProcessionLayer
 * @property {import('./lib.js').JgPuja[]} pujas      The pujas in the procession
 * @property {string | null} zone                     The zone tab that is open: its pins get serial numbers, the others fade
 * @property {Record<string, { la: number, lo: number }>} badges
 * @property {readonly { la: number, lo: number }[]} watch
 * @property {number} watchSel                        The watch point in focus, or -1
 * @property {readonly (readonly [number, number])[]} route
 */

/** Pin radius by zoom: small dots for the whole town, 30 px pins at street level. */
const STOPS = [
  [11, 3.5],
  [13, 5.5],
  [14.5, 9],
  [16, 15],
];
/**
 * A zoom curve of the pin radius times `factor` (times 1.14 more for the selected pin). MapLibre allows the zoom curve
 * only at the top of an expression, so the selected case sits inside each stop.
 * @returns {any}
 */
const pinRadius = (factor = 1) => [
  'interpolate',
  ['linear'],
  ['zoom'],
  ...STOPS.flatMap(([z, r]) => [z, ['case', ['get', 'sel'], r * factor * 1.14, r * factor]]),
];

/** A circle of `radius` metres as a GeoJSON polygon. */
function circle(lat, lng, radius, steps = 72) {
  const coords = [];
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}
const EMPTY = { type: 'FeatureCollection', features: [] };

/** A planned walk: one dotted line through every point, and a numbered dot for each puja (start and end unnumbered). */
function routeFeatures(/** @type {{ la: number, lo: number, n?: number, end?: boolean }[] | null | undefined} */ route) {
  if (!route || route.length < 2) return { line: EMPTY, stops: EMPTY };
  return {
    line: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: route.map((p) => [p.lo, p.la]) },
    },
    stops: {
      type: 'FeatureCollection',
      features: route.map((p, i) => ({
        type: 'Feature',
        properties: { label: p.n != null ? String(p.n) : '', end: !!p.end, i },
        geometry: { type: 'Point', coordinates: [p.lo, p.la] },
      })),
    },
  };
}

function pujaFeatures(pujas, lit, priority, selectedId, crowd = {}, visited = new Set()) {
  return {
    type: 'FeatureCollection',
    features: pujas.map((p) => {
      const sel = p.id === selectedId;
      const on = sel || !lit || lit.has(p.id);
      return {
        type: 'Feature',
        id: p.id,
        properties: {
          id: p.id,
          name: p.n,
          on,
          sel,
          rank: sel ? 0 : p.pop ? 1 : priority.has(p.id) ? 2 : 3,
          crowd: crowd[p.id]?.level || '',
          visited: visited.has(p.id),
        },
        geometry: { type: 'Point', coordinates: [p.lo, p.la] },
      };
    }),
  };
}

/**
 * The heading triangle on a canvas: 44 px square with the dot at its centre and the triangle above it, pointing up
 * (north), so turning the whole image by the heading points it the right way. White edge, like the dot.
 */
function headingImage(/** @type {string} */ color) {
  const size = 88; // 44 px at 2x
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const cx = size / 2;
  g.beginPath();
  g.moveTo(cx, 4); // apex
  g.lineTo(cx + 14, 30);
  g.lineTo(cx - 14, 30);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 6;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = color;
  g.fill();
  return g.getImageData(0, 0, size, size);
}

/** The tick drawn on a canvas (32 px at 2x), because a style's glyph fonts may not carry one. */
function tickImage(/** @type {string} */ color) {
  const size = 32;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(7, 17);
  g.lineTo(14, 24);
  g.lineTo(25, 9);
  g.stroke();
  return g.getImageData(0, 0, size, size);
}

/** Features for the procession guide layers. */
function procFeatures(/** @type {ProcessionLayer | null | undefined} */ pr) {
  const none = { type: 'FeatureCollection', features: [] };
  if (!pr) return { route: none, pujas: none, badge: none, watch: none };
  return {
    route: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pr.route.map(([la, lo]) => [lo, la]) } }],
    },
    pujas: {
      type: 'FeatureCollection',
      features: pr.pujas.map((p) => ({
        type: 'Feature',
        properties: { id: p.id, s: p.pr?.s ?? 0, on: pr.zone == null || p.pr?.z === pr.zone, num: pr.zone != null && p.pr?.z === pr.zone },
        geometry: { type: 'Point', coordinates: [p.lo, p.la] },
      })),
    },
    badge: {
      type: 'FeatureCollection',
      features: Object.entries(pr.badges).map(([z, c]) => ({
        type: 'Feature',
        properties: { z, sel: pr.zone === z },
        geometry: { type: 'Point', coordinates: [c.lo, c.la] },
      })),
    },
    watch: {
      type: 'FeatureCollection',
      features: pr.watch.map((w, i) => ({
        type: 'Feature',
        properties: { n: String(i + 1), i, sel: pr.watchSel === i },
        geometry: { type: 'Point', coordinates: [w.lo, w.la] },
      })),
    },
  };
}

/** Features for the traffic layer. */
function trafficFeatures(/** @type {TrafficLayer | null | undefined} */ tr) {
  return {
    type: 'FeatureCollection',
    features: (tr?.spots ?? []).map((t) => ({
      type: 'Feature',
      properties: { k: t.k, id: t.id, sel: tr?.sel === t.id },
      geometry: { type: 'Point', coordinates: [t.lo, t.la] },
    })),
  };
}

/** A blue rounded square with a white P: a parking place. */
function parkImage(/** @type {string} */ fill, /** @type {string} */ ink, /** @type {string} */ edge) {
  const size = 56; // 28 px at 2x
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.beginPath();
  g.roundRect(4, 4, 48, 48, 12);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = edge;
  g.stroke();
  g.beginPath();
  g.moveTo(20, 42);
  g.lineTo(20, 14);
  g.lineTo(31, 14);
  g.arc(31, 23, 9, -Math.PI / 2, Math.PI / 2);
  g.lineTo(20, 32);
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = ink;
  g.stroke();
  return g.getImageData(0, 0, size, size);
}

/** A white disc with a red ring and bar: a no-entry point. */
function noEntryImage(/** @type {string} */ ring, /** @type {string} */ disc) {
  const size = 56;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.beginPath();
  g.arc(28, 28, 24, 0, Math.PI * 2);
  g.fillStyle = disc;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = ring;
  g.stroke();
  g.fillStyle = ring;
  g.fillRect(14, 22, 28, 12);
  return g.getImageData(0, 0, size, size);
}

/** A small arrow pointing right (east), drawn on a canvas; the route layer turns it along the line. */
function arrowImage(/** @type {string} */ fill, /** @type {string} */ edge) {
  const size = 40; // 20 px at 2x
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.beginPath();
  g.moveTo(10, 8);
  g.lineTo(32, 20);
  g.lineTo(10, 32);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 5;
  g.strokeStyle = edge;
  g.stroke();
  g.fillStyle = fill;
  g.fill();
  return g.getImageData(0, 0, size, size);
}

const TRAIN =
  '<path d="M7 3h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2ZM5 10h14M9 14h.01M15 14h.01M8 17l-2 4M16 17l2 4"/>';
const BOAT = '<path d="M3 17c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0M5 14l1.5-5h11l1.5 5M9 9V6h6v3"/>';

const JgMap = forwardRef(
  /** @param {MapProps} props */
  function JgMap(props, ref) {
    const box = useRef(/** @type {HTMLDivElement | null} */ (null));
    const mapRef = useRef(/** @type {maplibregl.Map | null} */ (null));
    const ready = useRef(false);
    const latest = useRef(props);
    /** The station and ghat pins, kept so the traffic-only view can hide them. */
    const pins = useRef(/** @type {HTMLElement[]} */ ([]));
    latest.current = props;

    useImperativeHandle(ref, () => ({
      flyTo(lat, lng, zoom = 16) {
        const map = mapRef.current;
        if (!map) return;
        // Keep the pin above the bottom sheet: aim a little below the middle of the screen.
        const offsetY = -Math.round(map.getContainer().clientHeight * 0.18);
        map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), zoom), offset: [0, offsetY], duration: 700, essential: true });
      },
      fitRadius(lat, lng, radius) {
        const map = mapRef.current;
        if (!map) return;
        const dLat = radius / 111320;
        const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180));
        const h = map.getContainer().clientHeight;
        map.fitBounds(
          [
            [lng - dLng, lat - dLat],
            [lng + dLng, lat + dLat],
          ],
          { padding: { top: 150, bottom: Math.round(h * 0.4), left: 24, right: 24 }, duration: 700, maxZoom: 17 },
        );
      },
      camera() {
        const map = mapRef.current;
        if (!map) return null;
        const c = map.getCenter();
        return { center: [c.lng, c.lat], zoom: map.getZoom() };
      },
      restore(cam) {
        mapRef.current?.flyTo({ center: cam.center, zoom: cam.zoom, duration: 600 });
      },
      fitPoints(points) {
        const map = mapRef.current;
        if (!map || points.length === 0) return;
        const lats = points.map((p) => p.la);
        const lngs = points.map((p) => p.lo);
        const h = map.getContainer().clientHeight;
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: { top: 140, bottom: Math.round(h * 0.4), left: 40, right: 40 }, duration: 700, maxZoom: 16 },
        );
      },
    }));

    // Create the map once.
    useEffect(() => {
      if (!box.current) return undefined;
      const map = new maplibregl.Map({
        container: box.current,
        style: darkQuery()?.matches ? MAP_STYLE_URL_DARK : MAP_STYLE_URL,
        center: [MAP_CENTER[1], MAP_CENTER[0]],
        zoom: MAP_ZOOM,
        minZoom: 11,
        maxZoom: 19,
        maxBounds: MAP_BOUNDS,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
      // MapLibre opens the compact credit box on first load. Keep it closed: the (i) button stays, and About carries the credits.
      const closeCredit = () => {
        const el = box.current?.querySelector('.maplibregl-ctrl-attrib');
        el?.classList.remove('maplibregl-compact-show');
        el?.removeAttribute('open');
      };
      closeCredit();
      map.on('load', closeCredit);
      map.on('styledata', closeCredit);
      mapRef.current = map;
      if (/** @type {any} */ (window).__PD_E2E__) /** @type {any} */ (window).__jgMap = map;

      // Puja layers on top of the map style. Run again after a theme switch, because a new style drops them.
      const addLayers = () => {
        const { primary, surface, ink, me, free, crowded, visited, tick } = darkQuery()?.matches ? THEME.dark : THEME.light;
        const font = map.getStyle().layers.find((l) => l.type === 'symbol' && l.layout?.['text-font'])?.layout?.['text-font'] || [
          'Noto Sans Regular',
        ];
        const bold = Array.isArray(font) ? font.map((f) => String(f).replace(/Regular|Italic/, 'Bold')) : font;
        const p = latest.current;

        map.addSource('jg-radius', { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'jg-radius-fill', type: 'fill', source: 'jg-radius', paint: { 'fill-color': me, 'fill-opacity': 0.08 } });
        map.addLayer({
          id: 'jg-radius-line',
          type: 'line',
          source: 'jg-radius',
          paint: { 'line-color': me, 'line-width': 1.5, 'line-opacity': 0.7 },
        });

        map.addSource('jg-pujas', { type: 'geojson', data: pujaFeatures(p.pujas, p.lit, p.priority, p.selectedId, p.crowd, p.visited) });
        map.addLayer({
          id: 'jg-pins',
          type: 'circle',
          source: 'jg-pujas',
          layout: { 'circle-sort-key': ['case', ['get', 'sel'], 2, ['get', 'on'], 1, 0] },
          paint: {
            'circle-radius': pinRadius(),
            'circle-color': ['case', ['get', 'visited'], visited, ['get', 'sel'], primary, surface],
            'circle-stroke-color': ['case', ['get', 'visited'], visited, primary],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1.25, 14.5, 2],
            'circle-opacity': ['case', ['get', 'on'], 1, 0.1],
            'circle-stroke-opacity': ['case', ['get', 'on'], 1, 0.1],
          },
        });
        map.addLayer({
          id: 'jg-pin-dot',
          type: 'circle',
          source: 'jg-pujas',
          minzoom: 13.5,
          filter: ['!', ['get', 'visited']],
          layout: { 'circle-sort-key': ['case', ['get', 'sel'], 2, ['get', 'on'], 1, 0] },
          paint: {
            'circle-radius': pinRadius(0.36),
            'circle-color': ['case', ['get', 'sel'], surface, primary],
            'circle-opacity': ['case', ['get', 'on'], 1, 0.1],
          },
        });
        // A white tick on the green pin from street level up; zoomed out the pin is a plain green dot.
        if (map.hasImage('jg-tick')) map.removeImage('jg-tick');
        map.addImage('jg-tick', tickImage(tick), { pixelRatio: 2 });
        map.addLayer({
          id: 'jg-visited-tick',
          type: 'symbol',
          source: 'jg-pujas',
          minzoom: 13.5,
          filter: ['get', 'visited'],
          layout: {
            'icon-image': 'jg-tick',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 13.5, 0.34, 14.5, 0.5, 16, 0.8],
          },
          paint: { 'icon-opacity': ['case', ['get', 'on'], 1, 0.1] },
        });
        // Crowd dot at the pin's top-right edge, from street level up.
        map.addLayer({
          id: 'jg-crowd',
          type: 'circle',
          source: 'jg-pujas',
          minzoom: 13,
          filter: ['!=', ['get', 'crowd'], ''],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3.5, 16, 5.5],
            'circle-translate': ['interpolate', ['linear'], ['zoom'], 13, ['literal', [5, -5]], 16, ['literal', [10, -10]]],
            'circle-color': ['match', ['get', 'crowd'], 'free', free, crowded],
            'circle-stroke-color': surface,
            'circle-stroke-width': 1.5,
            'circle-opacity': ['case', ['get', 'on'], 1, 0.1],
            'circle-stroke-opacity': ['case', ['get', 'on'], 1, 0.1],
          },
        });
        map.addLayer({
          id: 'jg-labels',
          type: 'symbol',
          source: 'jg-pujas',
          minzoom: 13.6,
          filter: ['all', ['get', 'on'], ['!', ['get', 'sel']]],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': bold,
            'text-size': 13,
            'text-anchor': 'top',
            'text-offset': [0, 1.1],
            'text-max-width': 9,
            'symbol-sort-key': ['get', 'rank'],
            'text-padding': 3,
          },
          paint: { 'text-color': ink, 'text-halo-color': surface, 'text-halo-width': 2 },
        });
        map.addLayer({
          id: 'jg-label-sel',
          type: 'symbol',
          source: 'jg-pujas',
          filter: ['get', 'sel'],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': bold,
            'text-size': 13,
            'text-anchor': 'top',
            'text-offset': [0, 1.3],
            'text-max-width': 10,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': ink, 'text-halo-color': surface, 'text-halo-width': 2 },
        });

        // Planned walk, above the pins: dotted line, then numbered stops.
        const rf = routeFeatures(p.route);
        map.addSource('jg-route', { type: 'geojson', data: /** @type {any} */ (rf.line) });
        map.addSource('jg-route-stops', { type: 'geojson', data: /** @type {any} */ (rf.stops) });
        map.addLayer({
          id: 'jg-route-line',
          type: 'line',
          source: 'jg-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': primary, 'line-width': 3, 'line-dasharray': [0.6, 2] },
        });
        map.addLayer({
          id: 'jg-route-dot',
          type: 'circle',
          source: 'jg-route-stops',
          paint: {
            'circle-radius': ['case', ['==', ['get', 'label'], ''], 6, 11],
            'circle-color': ['case', ['==', ['get', 'label'], ''], surface, primary],
            'circle-stroke-color': ['case', ['==', ['get', 'label'], ''], primary, surface],
            'circle-stroke-width': 2.5,
          },
        });
        map.addLayer({
          id: 'jg-route-num',
          type: 'symbol',
          source: 'jg-route-stops',
          filter: ['!=', ['get', 'label'], ''],
          layout: {
            'text-field': ['get', 'label'],
            'text-font': bold,
            'text-size': 12,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': surface },
        });

        // Procession guide: glow and route sit under the pins, badges and watch points above them.
        const pf = procFeatures(p.procession);
        const { glow, glowInk, routeInk, badge, onBadge, park, onPark } = darkQuery()?.matches ? THEME.dark : THEME.light;
        if (!map.hasImage('jg-arrow')) map.addImage('jg-arrow', arrowImage(routeInk, surface), { pixelRatio: 2 });
        map.addSource('jg-proc-route', { type: 'geojson', data: /** @type {any} */ (pf.route) });
        map.addSource('jg-proc-pujas', { type: 'geojson', data: /** @type {any} */ (pf.pujas) });
        map.addSource('jg-proc-badge', { type: 'geojson', data: /** @type {any} */ (pf.badge) });
        map.addSource('jg-proc-watch', { type: 'geojson', data: /** @type {any} */ (pf.watch) });
        map.addLayer(
          {
            id: 'jg-proc-casing',
            type: 'line',
            source: 'jg-proc-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': surface, 'line-width': 7, 'line-opacity': 0.8 },
          },
          'jg-pins',
        );
        map.addLayer(
          {
            id: 'jg-proc-line',
            type: 'line',
            source: 'jg-proc-route',
            layout: { 'line-join': 'round' },
            paint: { 'line-color': routeInk, 'line-width': 3.5, 'line-dasharray': [1.6, 1.4] },
          },
          'jg-pins',
        );
        map.addLayer(
          {
            id: 'jg-proc-glow',
            type: 'circle',
            source: 'jg-proc-pujas',
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                11,
                ['case', ['get', 'on'], 9, 5],
                15,
                ['case', ['get', 'on'], 20, 10],
              ],
              'circle-color': glow,
              'circle-opacity': ['case', ['get', 'on'], 0.5, 0.18],
              'circle-blur': 0.6,
            },
          },
          'jg-pins',
        );
        map.addLayer({
          id: 'jg-proc-arrows',
          type: 'symbol',
          source: 'jg-proc-route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 110,
            'icon-image': 'jg-arrow',
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });
        map.addLayer({
          id: 'jg-proc-serial',
          type: 'symbol',
          source: 'jg-proc-pujas',
          minzoom: 13,
          filter: ['get', 'num'],
          layout: {
            'text-field': ['to-string', ['get', 's']],
            'text-font': bold,
            'text-size': 11,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-offset': [0, -1.7],
          },
          paint: { 'text-color': glowInk, 'text-halo-color': surface, 'text-halo-width': 1.6 },
        });
        map.addLayer({
          id: 'jg-proc-badge',
          type: 'circle',
          source: 'jg-proc-badge',
          paint: {
            'circle-radius': 16,
            'circle-color': badge,
            'circle-stroke-color': ['case', ['get', 'sel'], glow, surface],
            'circle-stroke-width': ['case', ['get', 'sel'], 4, 2.5],
          },
        });
        map.addLayer({
          id: 'jg-proc-badge-t',
          type: 'symbol',
          source: 'jg-proc-badge',
          layout: {
            'text-field': ['get', 'z'],
            'text-font': bold,
            'text-size': 15,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': onBadge },
        });
        map.addLayer({
          id: 'jg-proc-watch',
          type: 'circle',
          source: 'jg-proc-watch',
          paint: {
            'circle-radius': 13,
            'circle-color': primary,
            'circle-stroke-color': ['case', ['get', 'sel'], glow, '#FFFFFF'],
            'circle-stroke-width': ['case', ['get', 'sel'], 4, 2.5],
          },
        });
        map.addLayer({
          id: 'jg-proc-watch-t',
          type: 'symbol',
          source: 'jg-proc-watch',
          layout: {
            'text-field': ['get', 'n'],
            'text-font': bold,
            'text-size': 13,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': '#FFFFFF' },
        });

        // Procession-day traffic: a blue P for parking, a no-entry sign for closed roads. Drawn above the procession layers.
        if (map.hasImage('jg-park')) map.removeImage('jg-park');
        if (map.hasImage('jg-noentry')) map.removeImage('jg-noentry');
        map.addImage('jg-park', parkImage(park, onPark, surface), { pixelRatio: 2 });
        map.addImage('jg-noentry', noEntryImage(primary, surface), { pixelRatio: 2 });
        map.addSource('jg-traffic', { type: 'geojson', data: /** @type {any} */ (trafficFeatures(p.traffic)) });
        map.addLayer({
          id: 'jg-traffic',
          type: 'symbol',
          source: 'jg-traffic',
          layout: {
            'icon-image': ['case', ['==', ['get', 'k'], 'p'], 'jg-park', 'jg-noentry'],
            'icon-size': ['case', ['get', 'sel'], 1.3, 1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        map.addSource('jg-me', { type: 'geojson', data: EMPTY });
        map.addSource('jg-me-acc', { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'jg-me-acc', type: 'fill', source: 'jg-me-acc', paint: { 'fill-color': me, 'fill-opacity': 0.14 } });
        map.addLayer({
          id: 'jg-me',
          type: 'circle',
          source: 'jg-me',
          paint: { 'circle-radius': 7, 'circle-color': me, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 },
        });
        // The way you are heading: a small triangle just outside the dot, turned to the heading. No heading, no triangle.
        if (map.hasImage('jg-me-dir')) map.removeImage('jg-me-dir');
        map.addImage('jg-me-dir', headingImage(me), { pixelRatio: 2 });
        map.addLayer({
          id: 'jg-me-dir',
          type: 'symbol',
          source: 'jg-me',
          filter: ['has', 'heading'],
          layout: {
            'icon-image': 'jg-me-dir',
            'icon-rotate': ['get', 'heading'],
            'icon-rotation-alignment': 'map',
            'icon-pitch-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });
      };

      map.on('load', () => {
        addLayers();
        const p = latest.current;
        // Stations and ghats: HTML markers, so the train and boat icons stay crisp and each has a 48 px tap area.
        for (const s of p.stations) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = `jg-station-pin ${s.kind}`;
          el.setAttribute('aria-label', `${s.name}, ${s.kind === 'ghat' ? 'ferry ghat' : 'railway station'}`);
          el.innerHTML = `<span class="jg-station-ic"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s.kind === 'ghat' ? BOAT : TRAIN}</svg></span><span class="jg-station-name">${s.name}</span>`;
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            latest.current.onStation(s.id);
          });
          el.hidden = !!p.focus;
          pins.current.push(el);
          new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, -14] }).setLngLat([s.lo, s.la]).addTo(map);
        }

        ready.current = true;
        syncAll();
        latest.current.onReady?.();
      });

      // The map follows the phone's light or dark setting, like the rest of the app (design 2.3).
      const mq = darkQuery();
      const onTheme = () => {
        if (!ready.current) return;
        ready.current = false;
        map.setStyle(mq?.matches ? MAP_STYLE_URL_DARK : MAP_STYLE_URL);
        map.once('style.load', () => {
          addLayers();
          ready.current = true;
          syncAll();
        });
      };
      mq?.addEventListener?.('change', onTheme);

      // No style (offline on a first visit): say so instead of showing an empty map.
      // A failed tile or icon has a source; only a style that never arrived counts as the map failing.
      map.on('error', (e) => {
        const ev = /** @type {any} */ (e);
        if (/** @type {any} */ (window).__PD_E2E__) console.warn('jg map error', ev.error?.message || ev.error);
        if (!ready.current && !ev.sourceId && !ev.tile && !map.isStyleLoaded()) latest.current.onFail?.();
      });

      // A tap within 24 px of a pin opens it (48 px tap area); otherwise it is a tap on the empty map.
      map.on('click', (e) => {
        if (!ready.current) return;
        const { x, y } = e.point;
        // The procession badges and watch points sit on top, so they take the tap first.
        const proc = map.queryRenderedFeatures(
          [
            [x - 22, y - 22],
            [x + 22, y + 22],
          ],
          { layers: ['jg-proc-badge', 'jg-proc-watch'] },
        );
        if (proc.length) {
          const f = proc[0];
          if (f.layer.id === 'jg-proc-badge') latest.current.onProcZone?.(String(f.properties.z));
          else latest.current.onProcWatch?.(Number(f.properties.i));
          return;
        }
        // Pins the filters have faded to 10% are not tappable.
        const hits = map
          .queryRenderedFeatures(
            [
              [x - 20, y - 20],
              [x + 20, y + 20],
            ],
            { layers: ['jg-pins'] },
          )
          .filter((f) => f.properties.on);
        if (!hits.length) return latest.current.onBlank();
        let best = hits[0];
        let bestD = Infinity;
        for (const f of hits) {
          const [lng, lat] = /** @type {any} */ (f.geometry).coordinates;
          const pt = map.project([lng, lat]);
          const d = (pt.x - x) ** 2 + (pt.y - y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = f;
          }
        }
        latest.current.onPuja(String(best.properties.id));
      });
      map.on('mousemove', (e) => {
        if (!ready.current) return;
        const hit = map.queryRenderedFeatures(e.point, { layers: ['jg-pins'] }).some((f) => f.properties.on);
        map.getCanvas().style.cursor = hit ? 'pointer' : '';
      });
      // The chip row fades while a person pans or zooms, and comes back 200 ms after the map stops (design section 6).
      let settle = 0;
      map.on('movestart', (e) => {
        if (!e.originalEvent) return;
        clearTimeout(settle);
        latest.current.onPan(true);
      });
      map.on('moveend', () => {
        clearTimeout(settle);
        settle = window.setTimeout(() => latest.current.onPan(false), 200);
      });
      return () => {
        mq?.removeEventListener?.('change', onTheme);
        clearTimeout(settle);
        map.remove();
        mapRef.current = null;
        ready.current = false;
      };
    }, []);

    function syncAll() {
      const map = mapRef.current;
      if (!map || !ready.current) return;
      const p = latest.current;
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-pujas')).setData(
        /** @type {any} */ (pujaFeatures(p.pujas, p.lit, p.priority, p.selectedId, p.crowd, p.visited)),
      );
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-radius')).setData(
        /** @type {any} */ (p.centre ? circle(p.centre.lat, p.centre.lng, p.centre.radius) : EMPTY),
      );
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-me')).setData(
        /** @type {any} */ (
          p.me
            ? {
                type: 'Feature',
                properties: p.me.heading == null ? {} : { heading: Math.round(p.me.heading) },
                geometry: { type: 'Point', coordinates: [p.me.lng, p.me.lat] },
              }
            : EMPTY
        ),
      );
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-me-acc')).setData(
        /** @type {any} */ (p.me && p.me.accuracy > 15 ? circle(p.me.lat, p.me.lng, p.me.accuracy, 48) : EMPTY),
      );
      const rf = routeFeatures(p.route);
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-route')).setData(/** @type {any} */ (rf.line));
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-route-stops')).setData(/** @type {any} */ (rf.stops));
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-traffic')).setData(/** @type {any} */ (trafficFeatures(p.traffic)));
      const pf = procFeatures(p.procession);
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-proc-route')).setData(/** @type {any} */ (pf.route));
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-proc-pujas')).setData(/** @type {any} */ (pf.pujas));
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-proc-badge')).setData(/** @type {any} */ (pf.badge));
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-proc-watch')).setData(/** @type {any} */ (pf.watch));
    }

    const { pujas, lit, priority, selectedId, centre, me, crowd, route, visited, procession, traffic, focus } = props;
    useEffect(syncAll, [pujas, lit, priority, selectedId, centre, me, crowd, route, visited, procession, traffic]);
    // Traffic-only view: the station and ghat pins step aside.
    useEffect(() => {
      for (const el of pins.current) el.hidden = !!focus;
    }, [focus]);

    return <div ref={box} className="jg-map" role="region" aria-label="Map of Jagadhatri pujas" />;
  },
);

export default JgMap;
