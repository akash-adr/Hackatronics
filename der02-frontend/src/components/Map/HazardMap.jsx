import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useFacilityStore from '../../store/useFacilityStore';
import FacilityMarker from './FacilityMarker';
import WindArrow from './WindArrow';
import HazardZoneLayer from './HazardZoneLayer';
import SafeApproachWedge from './SafeApproachWedge';

// Fix for default marker icons in Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Keeps Leaflet's internal size in sync with its flex-sized container.
// Without this the map measures itself before the shell finishes laying out
// and renders tiles into a small box. Presentation only -- no data logic.
const ResizeHandler = () => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
};

// Component to recenter map when facility changes
const RecenterAutomatically = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
};

const HazardMap = () => {
  const { facilityConfig, zoneData } = useFacilityStore();

  if (!facilityConfig) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-viewport text-body text-viewport-text-muted">
        Loading map…
      </div>
    );
  }

  const center = [facilityConfig.lat, facilityConfig.lng];

  return (
    <div className="relative z-0 h-full w-full">
      <MapContainer center={center} zoom={14} className="h-full w-full" zoomControl={false}>
        {/* Esri Dark Gray Canvas -- dark basemap that is genuinely keyless.
            CARTO's dark_all endpoint now watermarks tiles "API KEY REQUIRED",
            so it is not usable without a credential. Tile layer only; no map
            data logic depends on the provider. */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
          attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
        />

        <ResizeHandler />
        <RecenterAutomatically lat={facilityConfig.lat} lng={facilityConfig.lng} />

        {/* Hazard zones. Blast is drawn before thermal so the small filled
            thermal bands sit above the wide blast outlines. Within each
            hazard type, HazardZoneLayer orders bands largest-first so fatal
            ends up on top. */}
        {zoneData?.blast && (
          <HazardZoneLayer bands={zoneData.blast.bands} hazardType="blast" />
        )}
        {zoneData?.thermal && (
          <HazardZoneLayer bands={zoneData.thermal.bands} hazardType="thermal" />
        )}

        <SafeApproachWedge
          safeApproach={zoneData?.safe_approach}
          centerLat={facilityConfig.lat}
          centerLon={facilityConfig.lng}
        />

        <FacilityMarker />
        <WindArrow />
      </MapContainer>
    </div>
  );
};

export default HazardMap;
