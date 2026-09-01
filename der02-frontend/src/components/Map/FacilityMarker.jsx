import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import useFacilityStore from '../../store/useFacilityStore';

/**
 * Facility marker.
 *
 * `position` and `label` are OPTIONAL. When omitted the component behaves
 * exactly as before -- reading the primary facility straight from the store --
 * so the existing single-facility call site is completely unaffected. The
 * dual-facility map supplies them explicitly to place a second marker.
 */
const FacilityMarker = ({ position, label }) => {
  const { facilityConfig } = useFacilityStore();

  const resolvedPosition =
    position ?? (facilityConfig ? [facilityConfig.lat, facilityConfig.lng] : null);
  const resolvedLabel =
    label ?? (facilityConfig ? `${facilityConfig.substance} Facility` : null);

  if (!resolvedPosition) return null;

  return (
    <Marker position={resolvedPosition}>
      {/* der-tip: light-on-dark styling so it reads against dark tiles */}
      <Tooltip permanent direction="top" offset={[0, -40]} className="der-tip">
        {resolvedLabel}
      </Tooltip>
    </Marker>
  );
};

export default FacilityMarker;
