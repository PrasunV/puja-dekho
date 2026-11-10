import maplibregl from 'maplibre-gl';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MAP_BOUNDS, MAP_CENTER, MAP_STYLE_URL, MAP_STYLE_URL_DARK, MAP_ZOOM } from './config.js';

const darkQuery = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);
/** Pin, label and location colours for each phone theme (design tokens --color-primary, surface, text, me). */
const THEME = {
  light: { primary: '#B31D24', surface: '#FFFFFF', ink: '#2B1214', me: '#1A73E8' },
  dark: { primary: '#E0434B', surface: '#1C1C1C', ink: '#F2F2F2', me: '#669DF6' },
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
 *
 * @typedef {object} MapProps
 * @property {import('./lib.js').JgPuja[]} pujas
 * @property {import('./lib.js').JgStation[]} stations
 * @property {Set<string> | null} lit       Ids shown at full strength; the rest fade to 35%. Null means all.
 * @property {Set<string>} priority          Ids whose labels win when labels compete (Must visit, active filter)
 * @property {string | null} selectedId
 * @property {import('./lib.js').JgCentre | null} centre
 * @property {{ lat: number, lng: number, accuracy: number } | null} me
 * @property {(id: string) => void} onPuja
 * @property {(id: string) => void} onStation
 * @property {() => void} onBlank
 * @property {(moving: boolean) => void} onPan    True when a person starts to pan or zoom, false when the map stops
 * @property {() => void} [onReady]
 * @property {() => void} [onFail]     The map style could not load (no network on a first visit)
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

function pujaFeatures(pujas, lit, priority, selectedId) {
  return {
    type: 'FeatureCollection',
    features: pujas.map((p) => {
      const on = !lit || lit.has(p.id);
      const sel = p.id === selectedId;
      return {
        type: 'Feature',
        id: p.id,
        properties: { id: p.id, name: p.n, on, sel, rank: sel ? 0 : p.pop ? 1 : priority.has(p.id) ? 2 : 3 },
        geometry: { type: 'Point', coordinates: [p.lo, p.la] },
      };
    }),
  };
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
      mapRef.current = map;
      if (/** @type {any} */ (window).__PD_E2E__) /** @type {any} */ (window).__jgMap = map;

      // Puja layers on top of the map style. Run again after a theme switch, because a new style drops them.
      const addLayers = () => {
        const { primary, surface, ink, me } = darkQuery()?.matches ? THEME.dark : THEME.light;
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

        map.addSource('jg-pujas', { type: 'geojson', data: pujaFeatures(p.pujas, p.lit, p.priority, p.selectedId) });
        map.addLayer({
          id: 'jg-pins',
          type: 'circle',
          source: 'jg-pujas',
          layout: { 'circle-sort-key': ['case', ['get', 'sel'], 2, ['get', 'on'], 1, 0] },
          paint: {
            'circle-radius': pinRadius(),
            'circle-color': ['case', ['get', 'sel'], primary, surface],
            'circle-stroke-color': primary,
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1.25, 14.5, 2],
            'circle-opacity': ['case', ['get', 'on'], 1, 0.35],
            'circle-stroke-opacity': ['case', ['get', 'on'], 1, 0.35],
          },
        });
        map.addLayer({
          id: 'jg-pin-dot',
          type: 'circle',
          source: 'jg-pujas',
          minzoom: 13.5,
          layout: { 'circle-sort-key': ['case', ['get', 'sel'], 2, ['get', 'on'], 1, 0] },
          paint: {
            'circle-radius': pinRadius(0.36),
            'circle-color': ['case', ['get', 'sel'], surface, primary],
            'circle-opacity': ['case', ['get', 'on'], 1, 0.35],
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

        map.addSource('jg-me', { type: 'geojson', data: EMPTY });
        map.addSource('jg-me-acc', { type: 'geojson', data: EMPTY });
        map.addLayer({ id: 'jg-me-acc', type: 'fill', source: 'jg-me-acc', paint: { 'fill-color': me, 'fill-opacity': 0.14 } });
        map.addLayer({
          id: 'jg-me',
          type: 'circle',
          source: 'jg-me',
          paint: { 'circle-radius': 7, 'circle-color': me, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 },
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
        const hits = map.queryRenderedFeatures(
          [
            [x - 20, y - 20],
            [x + 20, y + 20],
          ],
          { layers: ['jg-pins'] },
        );
        if (!hits.length) return latest.current.onBlank();
        let best = hits[0];
        let bestD = Infinity;
        for (const f of hits) {
          const [lng, lat] = /** @type {any} */ (f.geometry).coordinates;
          const pt = map.project([lng, lat]);
          const d = (pt.x - x) ** 2 + (pt.y - y) ** 2 - (f.properties.on ? 400 : 0);
          if (d < bestD) {
            bestD = d;
            best = f;
          }
        }
        latest.current.onPuja(String(best.properties.id));
      });
      map.on('mousemove', (e) => {
        if (!ready.current) return;
        const hit = map.queryRenderedFeatures(e.point, { layers: ['jg-pins'] }).length > 0;
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
        /** @type {any} */ (pujaFeatures(p.pujas, p.lit, p.priority, p.selectedId)),
      );
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-radius')).setData(
        /** @type {any} */ (p.centre ? circle(p.centre.lat, p.centre.lng, p.centre.radius) : EMPTY),
      );
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-me')).setData(
        /** @type {any} */ (
          p.me ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.me.lng, p.me.lat] } } : EMPTY
        ),
      );
      /** @type {maplibregl.GeoJSONSource} */ (map.getSource('jg-me-acc')).setData(
        /** @type {any} */ (p.me && p.me.accuracy > 15 ? circle(p.me.lat, p.me.lng, p.me.accuracy, 48) : EMPTY),
      );
    }

    const { pujas, lit, priority, selectedId, centre, me } = props;
    useEffect(syncAll, [pujas, lit, priority, selectedId, centre, me]);

    return <div ref={box} className="jg-map" role="region" aria-label="Map of Jagadhatri pujas" />;
  },
);

export default JgMap;
