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

/**
 * Threat level from the bands' own `clipped` flags.
 *
 * clipped=true means the solver never crossed that threshold inside its search
 * range -- the radius is a search boundary, not a real hazard distance. So an
 * UNCLIPPED fatal band is a genuine lethal envelope, an unclipped serious band
 * a genuine injury envelope, and neither means the hazard stayed small.
 */
export function getThreatLevel(zoneData) {
  const thermalBands = zoneData?.thermal?.bands ?? [];
  const fatalBand = findBand(thermalBands, 'fatal');
  const seriousBand = findBand(thermalBands, 'serious');

  if (fatalBand && !fatalBand.clipped) return 'HIGH';
  if (seriousBand && !seriousBand.clipped) return 'MEDIUM';
  return 'LOW';
}

/** Supporting sentence for each level. */
export const THREAT_LEVEL_MESSAGE = {
  HIGH: 'Conditions may be lethal within Red Zones. Follow recommended safe approach corridor.',
  MEDIUM:
    'Serious injury possible within marked zones. Exercise caution and follow the safe approach corridor.',
  LOW: 'Limited hazard extent under current conditions. Standard precautions apply.',
};

/** Which severity colour each level borrows -- never a new colour. */
export const THREAT_LEVEL_SEVERITY = {
  HIGH: 'fatal',
  MEDIUM: 'serious',
  LOW: 'pain',
};
