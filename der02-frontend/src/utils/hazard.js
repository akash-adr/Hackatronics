/**
 * Hazard-band lookups.
 *
 * ONE definition of "which band is the fatal one, and where is its radius".
 * Every display point in the app -- key figures, summary strip, comparison
 * sentence, explainability text, timeline snapshots -- imports from here, so
 * the number they show cannot drift apart from each other.
 *
 * Nothing in this file computes a radius. It only reads the value the backend
 * already returned, which is what keeps every readout tied to the same source
 * of truth as the polygon drawn on the map.
 */

/**
 * Find a band by its label. Explicit label matching, never array position:
 * band order is a rendering detail (HazardZoneLayer sorts by radius) and must
 * never be relied on to identify severity.
 */
export function findBand(bands, label) {
  return bands?.find((b) => b.label === label) ?? null;
}

/**
 * Radius of the fatal thermal band, in metres, or null when absent
 * (no thermal data, e.g. a blast-only response).
 */
export function getFatalRadius(zoneData) {
  return findBand(zoneData?.thermal?.bands, 'fatal')?.radius_no_wind_m ?? null;
}
