/**
 * Growth-animation geometry.
 *
 * PURELY COSMETIC. Nothing here models fire growth over time -- the backend
 * has no time domain and none is implied. These functions interpolate the
 * ALREADY-COMPUTED final result between a point at the facility and its real
 * extent, so the finished frame is the same data that was on screen before.
 *
 * Pure functions over plain data: no store access, no rendering, no fetches.
 */

/** Every polygon point moved toward the facility centre by (1 - growth). */
export function scalePolygonTowardCenter(polygon, centerLat, centerLon, growthFactor) {
  return polygon.map(([lat, lon]) => [
    centerLat + (lat - centerLat) * growthFactor,
    centerLon + (lon - centerLon) * growthFactor,
  ]);
}

/** Radii and per-angle samples scale with the same factor as the geometry. */
function scaleBand(band, centerLat, centerLon, growthFactor) {
  const scaled = { ...band };
  if (band.polygon) {
    scaled.polygon = scalePolygonTowardCenter(
      band.polygon,
      centerLat,
      centerLon,
      growthFactor
    );
  }
  if (typeof band.radius_no_wind_m === 'number') {
    scaled.radius_no_wind_m =
      Math.round(band.radius_no_wind_m * growthFactor * 10) / 10;
  }
  if (typeof band.radius_m === 'number') {
    scaled.radius_m = Math.round(band.radius_m * growthFactor * 10) / 10;
  }
  if (band.per_angle_radii) {
    scaled.per_angle_radii = band.per_angle_radii.map(([theta, r]) => [
      theta,
      r * growthFactor,
    ]);
  }
  return scaled;
}

/**
 * A compute-zone response redrawn at `growthFactor` of its real size.
 *
 * `clipped` flags and bearings are carried through untouched: they are
 * classifications, not magnitudes, and scaling them would make the threat
 * level or the approach direction flicker mid-animation.
 */
export function scaleZoneData(zoneData, centerLat, centerLon, growthFactor) {
  if (!zoneData || growthFactor >= 1) return zoneData;

  const scaled = { ...zoneData };

  for (const hazardType of ['thermal', 'blast']) {
    const section = zoneData[hazardType];
    if (!section?.bands) continue;
    scaled[hazardType] = {
      ...section,
      bands: section.bands.map((b) =>
        scaleBand(b, centerLat, centerLon, growthFactor)
      ),
    };
  }

  // The standoff figure counts up with the zones; the bearing does not move.
  if (zoneData.safe_approach) {
    scaled.safe_approach = {
      ...zoneData.safe_approach,
      min_standoff_m:
        Math.round(zoneData.safe_approach.min_standoff_m * growthFactor * 10) /
        10,
    };
  }

  return scaled;
}

/** Dual response: each facility grows from its OWN centre, together. */
export function scaleDualZoneData(dualZoneData, centers, growthFactor) {
  if (!dualZoneData || growthFactor >= 1) return dualZoneData;

  const scaled = { ...dualZoneData };
  const keys = [
    ['facility_a', centers.a],
    ['facility_b', centers.b],
  ];

  for (const [key, center] of keys) {
    if (!dualZoneData[key] || !center) continue;
    scaled[key] = scaleZoneData(
      dualZoneData[key],
      center.lat,
      center.lng,
      growthFactor
    );
  }

  if (dualZoneData.joint_safe_approach?.available) {
    scaled.joint_safe_approach = {
      ...dualZoneData.joint_safe_approach,
      min_standoff_m:
        Math.round(
          dualZoneData.joint_safe_approach.min_standoff_m * growthFactor * 10
        ) / 10,
    };
  }

  return scaled;
}
