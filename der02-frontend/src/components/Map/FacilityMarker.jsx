import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import useFacilityStore from '../../store/useFacilityStore';

const FacilityMarker = () => {
  const { facilityConfig } = useFacilityStore();
  if (!facilityConfig) return null;

  return (
    <Marker position={[facilityConfig.lat, facilityConfig.lng]}>
      {/* der-tip: light-on-dark styling so it reads against dark tiles */}
      <Tooltip permanent direction="top" offset={[0, -40]} className="der-tip">
        {facilityConfig.substance} Facility
      </Tooltip>
    </Marker>
  );
};

export default FacilityMarker;
