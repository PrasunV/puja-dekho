/** Great-circle distance in metres between two latitude/longitude points. */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const earthRadiusM = 6_371_000;
  const toRad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * toRad) / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(((lng2 - lng1) * toRad) / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(a));
}

/** @param {unknown} value @returns {value is number} */
export const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
