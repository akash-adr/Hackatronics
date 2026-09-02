import React, { useMemo } from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import { SAFE_APPROACH_COLOR } from '../../theme';

/**
 * Combined approach sector for TWO facilities.
 *
 * ONE continuous polygon -- never two overlaid wedges -- built entirely from
 * latitude/longitude and the backend's calculated bearing. Nothing here is a
 * pixel offset or an eyeballed angle.
 *
 * SHAPE: an annular sector (a fan with an arc at both ends) anchored on the
 * geographic centre of the two facilities:
 *
 *   centre    the mean of A and B -- the same reference the backend computes
 *             its joint bearing from, so the drawn axis and the reported
 *             degree cannot disagree
 *   rInner    the smallest radius whose ENTIRE inner arc lies outside the
 *             combined affected region: the sector starts where the hazard
 *             ends, and its inner arc wraps around both facilities
 *   rOuter    extends outward along the bearing, arc-terminated
 *   2*alpha   wide enough that the inner arc spans the pair -- the chord
 *             across the sector at rInner is at least the A-B separation, so
 *             the shape reads as connecting them rather than pointing past one
 *
 * Because the angle is constant and the radius grows, the sector widens
 * smoothly outward on its own -- no separate taper term.
 *
 * OVERLAPPING FACILITIES: the region test is "inside EITHER facility's zone",
 * so two overlapping footprints are treated as one combined area by
 * construction; no special case is needed.
 *
 * CLEARANCE IS TESTED AGAINST THE WARPED ZONES, not the nominal radius. The
 * polygons on screen are wind-warped and reach up to ~1.6x radius_no_wind_m
 * downwind (measured: 176 m against a nominal 110 m at 90 km/h), so testing
 * the nominal radius would let the sector cut through a drawn band.
 */

const METERS_PER_DEGREE_LAT = 111320.0;

const HALF_ANGLE_MIN_DEG = 22; // never a slit, even for coincident facilities
const HALF_ANGLE_MAX_DEG = 62; // never so wide it stops reading as a direction
const ARC_STEP_DEG = 2; // outer/inner arc sampling -> smooth curves
const DEPTH_FACTOR = 1.9; // rOuter = rInner * this, at minimum
const CLEARANCE_MARGIN_M = 12; // visible gap between hazard edge and sector
const SEARCH_STEP_M = 5;
const MAX_SEARCH_M = 4000;

/** Flat-earth offset, the same model the backend and the other layers use. */
function project(lat, lon, bearingDeg, distanceM) {
  const rad = (bearingDeg * Math.PI) / 180;
  return [
    lat + (distanceM * Math.cos(rad)) / METERS_PER_DEGREE_LAT,
    lon +
      (distanceM * Math.sin(rad)) /
        (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)),
  ];
}

/** Metres and bearing from one lat/lon to another. */
function vectorFrom([fromLat, fromLon], [toLat, toLon]) {
  const dy = (toLat - fromLat) * METERS_PER_DEGREE_LAT;
  const dx =
    (toLon - fromLon) *
    METERS_PER_DEGREE_LAT *
    Math.cos((fromLat * Math.PI) / 180);
  return {
    distanceM: Math.hypot(dx, dy),
    bearingDeg: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360,
  };
}

/** A facility's own reach at that bearing -- nearest of its 72 samples. */
function warpedRadiusAt(perAngleRadii, bearingDeg) {
  let best = perAngleRadii[0];
  let smallest = 360;
  for (const sample of perAngleRadii) {
    const diff = Math.abs(((sample[0] - bearingDeg + 540) % 360) - 180);
    if (diff < smallest) {
      smallest = diff;
      best = sample;
    }
  }
  return best[1];
}

/**
 * The sector's ring, as [lat, lon] pairs -- exported so the map can include it
 * in its fit bounds. One definition of the geometry, two consumers.
 */
export function computeSectorPositions({ joint, midpoint, facilities }) {
  {
    if (!joint?.available) return null;
    if (facilities.length < 2) return null;

    // --- 1. Geographic reference point: the centre of the two facilities. ---
    const [centreLat, centreLon] = midpoint;
    const bearing = joint.best_bearing_deg; // the CALCULATED axis, used as-is

    // --- 2. How far apart are they, measured from that centre? ---
    const separationM = vectorFrom(
      facilities[0].center,
      facilities[1].center
    ).distanceM;

    /** Outside EVERY facility's warped zone, by the margin. */
    const pointIsClear = (point) =>
      facilities.every((f) => {
        const { distanceM, bearingDeg } = vectorFrom(f.center, point);
        return (
          distanceM >=
          warpedRadiusAt(f.perAngleRadii, bearingDeg) + CLEARANCE_MARGIN_M
        );
      });

    // --- 3. Half-angle: wide enough that the inner arc spans the pair. ---
    // chord = 2 * r * sin(alpha) >= separation  =>  alpha >= asin(sep / 2r).
    // Solved against a first-guess radius, then re-solved once rInner is
    // known, so the two stay consistent.
    const halfAngleFor = (radius) => {
      const ratio = Math.min(1, separationM / (2 * Math.max(radius, 1)));
      const needed = (Math.asin(ratio) * 180) / Math.PI;
      return Math.min(
        HALF_ANGLE_MAX_DEG,
        Math.max(HALF_ANGLE_MIN_DEG, needed)
      );
    };

    /** Bearings sampled across the sector, inclusive of both edges. */
    const arcBearings = (halfAngle) => {
      const out = [];
      for (let a = -halfAngle; a < halfAngle; a += ARC_STEP_DEG) {
        out.push(bearing + a);
      }
      out.push(bearing + halfAngle);
      return out;
    };

    // --- 4. rInner: the radius at which the inner arc lies BEYOND the whole
    //        combined affected region.
    //
    //        Not "the first radius that happens to be clear": when the two
    //        facilities are far enough apart, the centre point BETWEEN them is
    //        already clear, and a first-clear rule would start the fan in that
    //        gap -- pointing out from between the facilities instead of
    //        wrapping around them. Taking, for each facility, its distance
    //        from the centre PLUS its own furthest reach puts the arc outside
    //        every part of the combined region, whichever facility dominates.
    //        Overlapping footprints need no special case: the max simply
    //        resolves to the pair's outer envelope.
    const enclosingRadius = Math.max(
      ...facilities.map((f) => {
        const reach = Math.max(...f.perAngleRadii.map(([, r]) => r));
        return vectorFrom([centreLat, centreLon], f.center).distanceM + reach;
      })
    );

    let rInner = enclosingRadius + CLEARANCE_MARGIN_M;

    // Safety net: the enclosing radius is derived from each facility's own
    // reach, so the arc should already be clear -- but it is cheap to confirm
    // point by point and step out if anything still overlaps.
    let guard = 0;
    while (
      guard < MAX_SEARCH_M / SEARCH_STEP_M &&
      !arcBearings(halfAngleFor(rInner)).every((b) =>
        pointIsClear(project(centreLat, centreLon, b, rInner))
      )
    ) {
      rInner += SEARCH_STEP_M;
      guard += 1;
    }
    if (guard >= MAX_SEARCH_M / SEARCH_STEP_M) return null;

    const halfAngle = halfAngleFor(rInner);

    // --- 5. rOuter: extends outward along the bearing. Whichever is larger of
    //        the backend's own standoff and a proportional depth, so the fan
    //        always has visible depth to walk along.
    const rOuter = Math.max(
      rInner * DEPTH_FACTOR,
      (joint.min_standoff_m ?? 0) * 1.15,
      rInner + 60
    );

    // --- 6. One closed ring: inner arc across, then outer arc back. Both are
    //        sampled arcs, so both boundaries are curved.
    const bearings = arcBearings(halfAngle);
    const innerArc = bearings.map((b) =>
      project(centreLat, centreLon, b, rInner)
    );
    const outerArc = bearings
      .slice()
      .reverse()
      .map((b) => project(centreLat, centreLon, b, rOuter));

    return [...innerArc, ...outerArc];
  }
}

const JointApproachCorridor = ({ joint, midpoint, facilities }) => {
  const positions = useMemo(
    () => computeSectorPositions({ joint, midpoint, facilities }),
    [joint, midpoint, facilities]
  );

  if (!positions) return null;

  return (
    <Polygon
      positions={positions}
      // Leaflet's default simplification collapses a sampled arc into a few
      // straight segments at low zoom; 0 keeps every sample, so the curved
      // boundaries stay curved at every zoom level.
      smoothFactor={0}
      pathOptions={{
        color: SAFE_APPROACH_COLOR,
        fillColor: SAFE_APPROACH_COLOR,
        fill: true,
        fillOpacity: 0.18,
        weight: 2,
        opacity: 0.9,
      }}
    >
      <Tooltip sticky className="der-tip">
        Combined approach sector: enter on {joint.best_bearing_deg}°, standoff{' '}
        {joint.min_standoff_m} m
      </Tooltip>
    </Polygon>
  );
};

export default JointApproachCorridor;
