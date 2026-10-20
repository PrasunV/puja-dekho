import { useCallback, useEffect, useMemo, useState } from 'react';
import { PAGE_SIZE, RADIUS_STEPS } from '../config.js';
import { typicalCrowd } from '../lib/crowd.js';
import { formatBand, haversine } from '../lib/geo.js';
import { stationOutlook } from '../lib/stations.js';

const DEFAULT_RADIUS_M = RADIUS_STEPS[0];
/** The Filters panel offers this many of the nearest areas (PRD open question 8). */
export const NEARBY_AREAS = 10;

/** The zone chips, in the order they appear. `id` matches `puja.z`. */
export const ZONES = Object.freeze([
  { id: 'south', label: 'South' },
  { id: 'north', label: 'North' },
  { id: 'central', label: 'Central' },
  { id: 'east', label: 'East' },
  { id: 'other', label: 'Other' },
]);
/**
 * What a zone chip says: short while it is off ("South Kol."), the full name once it is on ("South Kolkata"),
 * so a visitor reading the row knows these are parts of Kolkata.
 * @param {{ id: string, label: string }} zone
 * @param {boolean} selected
 */
export function zoneChipLabel(zone, selected) {
  if (zone.id === 'other') return selected ? 'Other areas' : 'Other';
  return selected ? `${zone.label} Kolkata` : `${zone.label} Kol.`;
}
/**
 * Plain-words name for the chosen zones, in chip order: `South Kolkata`, `South & North Kolkata`,
 * `South, North & East Kolkata`, with `Other areas` (Howrah and the suburbs) added at the end.
 * @param {string[]} ids
 */
export function zoneName(ids) {
  const named = ZONES.filter((z) => z.id !== 'other' && ids.includes(z.id)).map((z) => z.label);
  const joined = named.length > 1 ? `${named.slice(0, -1).join(', ')} & ${named[named.length - 1]}` : named[0];
  const parts = [joined ? `${joined} Kolkata` : null, ids.includes('other') ? 'Other areas' : null].filter(Boolean);
  return parts.join(', ');
}

/** Fallback area names for pujas with no neighbourhood in their address: not useful as an area filter. */
const ZONE_AREA_LABELS = new Set(['Other', 'South Kolkata', 'North Kolkata', 'Central Kolkata', 'East Kolkata']);

/**
 * Radius, Less crowded, nearby area and metro station filters, plus the list they produce.
 * Filters combine with AND across groups (PRD section 5).
 *
 * - The radius is a straight-line distance from the person. It needs a location.
 * - Choosing a station replaces the radius: the list is the pujas within `NEAR_STATION_M` of it.
 * - The list holds every puja that passes the non-radius filters, nearest first, so the radius
 *   decides the count in the header and the Popular strip and where the list's "Farther away" divider sits.
 *
 * @param {object} input
 * @param {import('../lib/types.js').PujaData | null} input.data
 * @param {import('../lib/types.js').Position | null} input.position  null when location is off or far away
 * @param {import('../lib/types.js').Station | null} input.station  A chosen metro station replaces the radius
 * @param {Date} [input.now] The moment the typical crowd is read for (tests pass one)
 */
export function usePujaFilters({ data, position, station, now }) {
  const [radius, setRadius] = useState(DEFAULT_RADIUS_M);
  const [lessCrowded, setLessCrowded] = useState(false);
  const [area, setArea] = useState(/** @type {string | null} */ (null));
  // Zone chips (South, North, ...) combine: any puja in a chosen zone passes.
  const [zones, setZones] = useState(/** @type {string[]} */ ([]));
  const toggleZone = useCallback(
    (id) => setZones((current) => (current.includes(id) ? current.filter((z) => z !== id) : [...current, id])),
    [],
  );
  // The typical crowd depends on the hour, so re-read the clock every few minutes.
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    if (now) return undefined;
    const timer = setInterval(() => setClock(new Date()), 300_000);
    return () => clearInterval(timer);
  }, [now]);
  const moment = now ?? clock;

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const chooseRadius = useCallback((metres) => setRadius(metres), []);

  /** Straight-line metres from the person to each puja, or null without a location. */
  const distances = useMemo(() => {
    if (!data || !position) return null;
    return new Map(data.pujas.map((puja) => [puja.id, haversine(position.lat, position.lng, puja.la, puja.lo)]));
  }, [data, position]);

  /** Metres from the chosen station to each puja. */
  const stationDistances = useMemo(() => {
    if (!data || !station) return null;
    return new Map(data.pujas.map((puja) => [puja.id, haversine(station.lat, station.lng, puja.la, puja.lo)]));
  }, [data, station]);

  /** What the chosen station offers: pujas within 1 km, else within 5 km, else a pointer to a better station. */
  const outlook = useMemo(() => (data && station ? stationOutlook(station, data.stations, data.pujas) : null), [data, station]);
  const stationRadius = outlook?.radius ?? 0;

  /** Areas, nearest first when the location is known, else A to Z. */
  const areas = useMemo(() => {
    if (!data) return [];
    const byArea = new Map();
    for (const puja of data.pujas) {
      if (zones.length && !zones.includes(puja.z)) continue;
      const entry = byArea.get(puja.ar) || { name: puja.ar, count: 0, nearest: Infinity };
      entry.count += 1;
      if (distances) entry.nearest = Math.min(entry.nearest, distances.get(puja.id) ?? Infinity);
      byArea.set(puja.ar, entry);
    }
    const list = [...byArea.values()].filter((entry) => !ZONE_AREA_LABELS.has(entry.name));
    list.sort(distances ? (a, b) => a.nearest - b.nearest : (a, b) => a.name.localeCompare(b.name));
    return list;
  }, [data, distances, zones]);

  /** Pujas passing every filter except the radius: what the map draws and the list holds. */
  const matching = useMemo(() => {
    if (!data) return [];
    return data.pujas.filter((puja) => {
      if (station && (stationDistances?.get(puja.id) ?? Infinity) > stationRadius) return false;
      if (zones.length && !zones.includes(puja.z)) return false;
      if (area && puja.ar !== area) return false;
      // "Less crowded" ignores a puja with no crowd value for this hour instead of hiding it.
      if (lessCrowded) {
        const level = typicalCrowd(puja, moment);
        if (level != null && level !== 'Low') return false;
      }
      return true;
    });
  }, [data, station, stationDistances, stationRadius, zones, area, lessCrowded, moment]);

  /** Whether the radius applies: it needs a location and is replaced by a chosen station or zone. */
  const radiusActive = distances != null && !station && !zones.length;

  const inRadius = useCallback(
    (/** @type {{ id: string }} */ puja) => !radiusActive || (distances?.get(puja.id) ?? Infinity) <= radius,
    [radiusActive, distances, radius],
  );

  // A new set of filters starts the list from the top again.
  const [seenMatching, setSeenMatching] = useState(matching);
  if (seenMatching !== matching) {
    setSeenMatching(matching);
    setVisibleCount(PAGE_SIZE);
  }

  /** The list: everything that matches, nearest first (to the station when one is chosen). */
  const results = useMemo(() => {
    const by = stationDistances ?? distances;
    const list = [...matching];
    if (by) return list.sort((a, b) => (by.get(a.id) ?? 0) - (by.get(b.id) ?? 0) || a.n.localeCompare(b.n));
    return list.sort((a, b) => a.n.localeCompare(b.n));
  }, [matching, stationDistances, distances]);

  /** Pujas inside the radius that pass the other filters. This is the "X" in the header. */
  const nearCount = useMemo(() => (radiusActive ? matching.filter(inRadius).length : matching.length), [matching, radiusActive, inRadius]);

  /** What the Filters panel counts: radius has its own chip, so it is not included. */
  const filterCount = (lessCrowded ? 1 : 0) + (area ? 1 : 0) + (station ? 1 : 0);

  /** Next radius step above the current one, for "No pujas within 500 m" → "Show 1 km". */
  const nextRadius = RADIUS_STEPS.find((step) => step > radius) ?? null;

  return useMemo(
    () => ({
      radius,
      chooseRadius,
      radiusActive,
      nextRadius,
      lessCrowded,
      setLessCrowded,
      zones,
      toggleZone,
      area,
      setArea,
      areas,
      nearbyAreas: areas.slice(0, NEARBY_AREAS),
      filterCount,
      /** Back to defaults: radius 500 m, no other filter. */
      clearAll: () => {
        setRadius(DEFAULT_RADIUS_M);
        setLessCrowded(false);
        setArea(null);
        setZones([]);
      },
      /** Clear everything except the radius and the station (the station is cleared by the screen that owns it). */
      clearOthers: () => {
        setLessCrowded(false);
        setArea(null);
        setZones([]);
      },
      visibleCount,
      showMore: () => setVisibleCount((n) => n + PAGE_SIZE),
      distances,
      stationDistances,
      stationRadius,
      outlook,
      inRadius,
      mapResults: matching,
      results,
      nearCount,
      /** Words describing what is applied, for the line under the header. */
      appliedText: [
        radiusActive ? `Within ${formatBand(radius)}` : null,
        station ? `Near ${station.name}${stationRadius > 1000 ? ` (${stationRadius / 1000} km)` : ''}` : null,
        area,
        lessCrowded ? 'Less crowded' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }),
    [
      radius,
      chooseRadius,
      radiusActive,
      nextRadius,
      lessCrowded,
      zones,
      toggleZone,
      area,
      areas,
      filterCount,
      visibleCount,
      distances,
      stationDistances,
      stationRadius,
      outlook,
      inRadius,
      matching,
      results,
      nearCount,
      station,
    ],
  );
}
