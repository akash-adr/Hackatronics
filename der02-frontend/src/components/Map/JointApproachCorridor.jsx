import React, { useMemo } from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import { SAFE_APPROACH_COLOR } from '../../theme';

/**
 * Dual-facility approach corridor.
 *
 * A separate component from SafeApproachWedge on purpose: the single-facility
 * wedge is a pie slice with its apex ON the facility (it answers "which way do
 * I stand off"), and it stays exactly as it is. This one answers a different
 * question -- "which way do I walk IN" -- so it is drawn the other way round:
 * WIDE at the safe outer end, narrowing toward the facilities, and truncated
 * well before it reaches them.
 *
 * Geometry, measured from the midpoint of the two facilities (the point the
 * backend's joint bearing is computed from):
 *
 *   outer edge    min_standoff_m * 1.15   the safe starting point
 *   inner edge    min_standoff_m * 0.35   pushed back out if that would put a
 *                                         corner inside either drawn zone
 *   width         +/-15 degrees at both ends, so the corridor narrows in
 *                 absolute metres as it closes on the incident
 *
 * CLEARANCE IS TESTED AGAINST THE WARPED ZONES, not the nominal radius. The
 * backend's standoff is computed against radius_no_wind_m, but the polygons on
 * screen are wind-warped and reach up to ~1.6x that downwind (measured: 176 m
 * against a nominal 110 m at 90 km/h). Testing the nominal radius therefore
 * drew corridors that visibly cut through the pain band in strong wind.
 */

const METERS_PER_DEGREE_LAT = 111320.0;

const OUTER_EXTENT_FACTOR = 1.15; // same convention as the single-facility wedge
const INNER_EXTENT_FACTOR = 0.35; // "still well short of the facilities"
const HALF_WIDTH_DEG = 15;
const ARC_STEP_DEG = 2.5;

const CLEARANCE_MARGIN_M = 15; // the visible gap the corridor keeps
const SEARCH_STEP_M = 5;
const MAX_OUTER_EXTENSION_M = 1500; // give up rather than draw something absurd

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

/** Metres and bearing from a facility centre to a point. */
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

/** The zone's own reach at that bearing -- nearest of the 72 samples. */
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

const JointApproachCorridor = ({ joint, midpoint, facilities }) => {
  const positions = useMemo(() => {
    if (!joint?.available || !joint.min_standoff_m) return null;
    if (!facilities.length) return null;

    const [midLat, midLon] = midpoint;
    const bearing = joint.best_bearing_deg;
    const start = bearing - HALF_WIDTH_DEG;
    const end = bearing + HALF_WIDTH_DEG;

    /** Clear of every facility's warped outer band, by the margin. */
    const pointIsClear = (point) =>
      facilities.every((f) => {
        const { distanceM, bearingDeg } = vectorFrom(f.center, point);
        return (
          distanceM >=
          warpedRadiusAt(f.perAngleRadii, bearingDeg) + CLEARANCE_MARGIN_M
        );
      });

    const edgeIsClear = (radius, angles) =>
      angles.every((a) => pointIsClear(project(midLat, midLon, a, radius)));

    // The outer edge starts where the backend says, and is pushed further out
    // only if the warped zones actually reach it.
    const arcAngles = [];
    for (let a = start; a <= end; a += ARC_STEP_DEG) arcAngles.push(a);
    if (arcAngles[arcAngles.length - 1] !== end) arcAngles.push(end);

    let outerRadius = joint.min_standoff_m * OUTER_EXTENT_FACTOR;
    const outerLimit = outerRadius + MAX_OUTER_EXTENSION_M;
    while (outerRadius < outerLimit && !edgeIsClear(outerRadius, arcAngles)) {
      outerRadius += SEARCH_STEP_M;
    }
    if (outerRadius >= outerLimit) return null;

    // Then the inner edge walks outward from 35% until it clears too.
    let innerRadius = joint.min_standoff_m * INNER_EXTENT_FACTOR;
    while (innerRadius < outerRadius && !edgeIsClear(innerRadius, [start, end])) {
      innerRadius += SEARCH_STEP_M;
    }
    // Nothing between the two ends is clear -- draw nothing rather than a
    // corridor that cuts through a hazard band.
    if (innerRadius >= outerRadius) return null;

    // Trapezoid: inner edge, out along one side, arc across the wide end,
    // back down the other side. No vertex at the midpoint itself.
    return [
      project(midLat, midLon, start, innerRadius),
      ...arcAngles.map((a) => project(midLat, midLon, a, outerRadius)),
      project(midLat, midLon, end, innerRadius),
    ];
  }, [joint, midpoint, facilities]);

  if (!positions) return null;

  return (
    <Polygon
      positions={positions}
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
        Approach corridor: enter on {joint.best_bearing_deg}°, standoff{' '}
        {joint.min_standoff_m} m
      </Tooltip>
    </Polygon>
  );
};

export default JointApproachCorridor;
