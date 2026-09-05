import React, { useMemo } from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import { SAFE_APPROACH_COLOR } from '../../theme';

const METERS_PER_DEGREE_LAT = 111320.0;

// How far past the recommended standoff the wedge is drawn, so it visibly
// clears the outermost hazard boundary rather than stopping at its edge.
const WEDGE_EXTENT_FACTOR = 1.15;

const ARC_STEP_DEG = 2.5; // arc smoothness

/** Offset a lat/lon by a distance and bearing (same flat-earth model as the backend). */
function project(lat, lon, bearingDeg, distanceM) {
  const rad = (bearingDeg * Math.PI) / 180;
  const dy = distanceM * Math.cos(rad);
  const dx = distanceM * Math.sin(rad);
  return [
    lat + dy / METERS_PER_DEGREE_LAT,
    lon + dx / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)),
  ];
}

/**
 * Green wedge showing the recommended approach corridor.
 *
 * WRAPAROUND: best_bearing_range_deg is read as "clockwise from start to end",
 * so start > end means the arc crosses 0/360 (e.g. [335, 115] is a 140 degree
 * corridor through north, not a 220 degree one the other way). Sweeping by
 * (end - start + 360) % 360 walks the correct arc in one pass, so no second
 * segment is needed.
 */
const SafeApproachWedge = ({ safeApproach, centerLat, centerLon }) => {
  const positions = useMemo(() => {
    if (!safeApproach) return null;

    const [start, end] = safeApproach.best_bearing_range_deg;
    const sweep = ((end - start + 360) % 360) || 360;
    const radius = safeApproach.min_standoff_m * WEDGE_EXTENT_FACTOR;

    // Apex at the facility, then an arc across the corridor.
    const points = [[centerLat, centerLon]];
    for (let a = 0; a <= sweep; a += ARC_STEP_DEG) {
      points.push(project(centerLat, centerLon, start + a, radius));
    }
    points.push(project(centerLat, centerLon, end, radius));
    points.push([centerLat, centerLon]);

    return points;
  }, [safeApproach, centerLat, centerLon]);

  if (!positions) return null;

  const [start, end] = safeApproach.best_bearing_range_deg;

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
        Safe approach: {start}° to {end}°, standoff{' '}
        {safeApproach.min_standoff_m} m
      </Tooltip>
    </Polygon>
  );
};

export default SafeApproachWedge;
