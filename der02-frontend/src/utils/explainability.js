import { angleDiff, degreesToCompass } from './compass';
import { getFatalRadius } from './hazard';

/**
 * Explanation text generation for the "Why this shape?" panel.
 *
 * DISCIPLINE: nothing in this file calculates a hazard number. Every figure it
 * reports is READ out of the state object passed in -- the same object that
 * drew the map. There is no import of the physics engine, the geometry engine,
 * or any API-calling code here, and there must never be one: the moment this
 * panel derives a radius independently, it can disagree with the map, which is
 * the exact failure the module exists to prevent.
 *
 * angleDiff and degreesToCompass are imported from utils/compass.js rather
 * than reimplemented, so the wraparound rule has one definition frontend-wide.
 */

/**
 * Radius at the sample angle closest to a target bearing.
 *
 * The 72 samples sit 5 degrees apart, so an arbitrary bearing rarely lands on
 * one exactly; this picks the nearest, measured with the shared wraparound
 * helper so a target near 0/360 matches samples on both sides of the seam.
 */
export function findRadiusAtBearing(perAngleRadii, targetBearingDeg) {
  if (!perAngleRadii?.length) return null;

  let closest = perAngleRadii[0];
  let smallestDiff = 360;

  for (const [theta, radius] of perAngleRadii) {
    const diff = Math.abs(angleDiff(theta, targetBearingDeg));
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = [theta, radius];
    }
  }

  return closest[1];
}

/** Reach directly downwind and directly upwind, read from the band's samples. */
export function getDownwindUpwindRadii(perAngleRadii, windFromDeg) {
  const windToDeg = (windFromDeg + 180) % 360;
  return {
    downwind_m: findRadiusAtBearing(perAngleRadii, windToDeg),
    upwind_m: findRadiusAtBearing(perAngleRadii, windFromDeg),
  };
}

/**
 * One sentence explaining why the zone on screen has the shape it has.
 *
 * @param state the current compute-zone response held in the central store
 * @returns a sentence, or null when there is no hazard data to describe
 */
export function generateShapeExplanation(state) {
  // Prefer the outermost thermal band -- it is the most visible on the map.
  // If the current hazard_type excludes thermal, describe the outermost blast
  // band instead.
  const band =
    state?.thermal?.bands?.find((b) => b.label === 'pain') ||
    state?.blast?.bands?.find((b) => b.label === 'glass_breakage');

  if (!band || !band.per_angle_radii?.length) return null;

  const windSpeed = state.wind?.speed_kmh;
  if (windSpeed === undefined || windSpeed === null) return null;

  // ZERO WIND: every sample radius is identical, so "extends X downwind versus
  // X upwind" would read as a non-statement. Distinct template instead.
  if (windSpeed === 0) {
    const radius = findRadiusAtBearing(band.per_angle_radii, 0);
    return `Zone is symmetric in all directions (${Math.round(radius)}m) because there is no wind to skew it.`;
  }

  const { downwind_m, upwind_m } = getDownwindUpwindRadii(
    band.per_angle_radii,
    state.wind.from_deg
  );
  const compassDir = degreesToCompass(state.wind.from_deg);

  return (
    `Zone extends ${Math.round(downwind_m)}m downwind versus ` +
    `${Math.round(upwind_m)}m upwind because wind speed is ` +
    `${windSpeed} km/h from the ${compassDir}.`
  );
}

/**
 * One sentence comparing the two preset configurations.
 *
 * Both figures come from results already cached by Module 4's startup
 * pre-compute; this never triggers or requires a fetch of its own.
 */
export function generateComparisonExplanation(
  activeState,
  otherState,
  activeLabel,
  otherLabel
) {
  if (!activeState || !otherState) return null;

  const activeFatal = getFatalRadius(activeState);
  const otherFatal = getFatalRadius(otherState);

  if (!activeFatal || !otherFatal) return null;

  const ratio = (
    Math.max(activeFatal, otherFatal) / Math.min(activeFatal, otherFatal)
  ).toFixed(1);
  const larger = activeFatal > otherFatal ? activeLabel : otherLabel;
  const smaller = activeFatal > otherFatal ? otherLabel : activeLabel;

  return (
    `${larger}'s fatal zone is approximately ${ratio}x larger than ${smaller}'s, ` +
    `driven by the combination of substance, tank size, and wind speed differences ` +
    `between the two configurations.`
  );
}

/**
 * Layer 3: what the model deliberately does not attempt, and why.
 *
 * Static by design -- these are scope decisions, not derived values, and
 * framing them as deliberate choices is the point.
 */
export const ASSUMPTION_LIST = [
  {
    assumption: 'Flat terrain, no elevation modeling',
    reason:
      'Terrain-aware radiation and blast shadowing requires significant additional computational-geometry work beyond a 24-hour build.',
  },
  {
    assumption: 'No obstacle shielding (buildings, other structures)',
    reason:
      'Modeling partial shielding by intervening structures would require a full 3D scene model of the surroundings.',
  },
  {
    assumption: 'Steady-state wind (constant speed and direction during the event)',
    reason:
      'Real wind can shift during an incident; the model recomputes live as new wind readings arrive, but does not predict future wind changes.',
  },
  {
    assumption: 'No confinement or congestion modeling for vapor cloud explosions',
    reason:
      'The TNT-equivalent method used for blast overpressure does not distinguish between an open, unobstructed release and a congested industrial area, which can amplify blast effects.',
  },
  {
    assumption:
      'Kinney-Graham approximation used instead of full Kingery-Bulmash polynomials',
    reason:
      'A deliberate, disclosed trade-off documented in Module 1, trading a small amount of numerical precision for significantly reduced implementation risk under time constraints.',
  },
];

/** Static description of Module 1's validation approach. */
export const VALIDATION_STATEMENT =
  'Validated against a published reference case within approximately 15% tolerance.';
