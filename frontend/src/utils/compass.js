// 16-point compass rose, ordered so that index = round(deg / 22.5) % 16.
const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
];

/**
 * Convert a bearing in degrees to a plain-language compass point.
 *
 * Responders think in compass points, not degrees, so the status bar reads
 * "18 km/h NE" rather than "18 km/h 45°". The modulo keeps bearings at or
 * past 360 (and negative ones) on the rose rather than off the end of it.
 */
export function degreesToCompass(deg) {
  if (deg === null || deg === undefined || Number.isNaN(Number(deg))) return null;
  const index = Math.round(Number(deg) / 22.5) % 16;
  return COMPASS_POINTS[(index + 16) % 16];
}

export { COMPASS_POINTS };

/**
 * Smallest signed difference from b to a, in [-180, 180].
 *
 * Mirrors the backend's geometry/wind_scaling.py angle_diff() exactly -- the
 * same wraparound rule Modules 2 and 3 rely on, so a bearing shift measured
 * here matches one measured server-side. Defined once, here, so the frontend
 * has a single wraparound implementation rather than one per caller.
 *
 * The extra `+ 360) % 360` is not in the Python original and is required:
 * Python's % always returns a non-negative result for a positive divisor,
 * while JavaScript's keeps the sign of the dividend.
 */
export function angleDiff(a, b) {
  return ((((a - b + 180) % 360) + 360) % 360) - 180;
}
