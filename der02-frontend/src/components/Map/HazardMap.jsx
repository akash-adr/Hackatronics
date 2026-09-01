import React, { useEffect, useRef, useState } from 'react';
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

// Primary: Esri Dark Gray Canvas -- keyless, and dark to match the viewport.
// Fallback: standard OpenStreetMap -- keyless, and about as reliable as free
// tiles get. It is lighter than the primary, but index.css darkens the tile
// pane, so the switch stays visually coherent.
const TILE_SOURCES = [
  {
    name: 'Esri Dark Gray Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  },
  {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
];

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

  const [tileSourceIndex, setTileSourceIndex] = useState(0);
  // A failing provider emits tileerror per tile, so the switch is guarded to
  // fire once rather than once per broken tile.
  const hasFallenBack = useRef(false);

  const tileSource = TILE_SOURCES[tileSourceIndex];

  const handleTileError = () => {
    if (hasFallenBack.current || tileSourceIndex >= TILE_SOURCES.length - 1) {
      return;
    }
    hasFallenBack.current = true;
    console.warn(
      `Primary tile source failed (${TILE_SOURCES[tileSourceIndex].name}) -- ` +
        `switching to ${TILE_SOURCES[tileSourceIndex + 1].name}. ` +
        `Hazard overlays are unaffected.`
    );
    setTileSourceIndex((i) => i + 1);
  };

  if (!facilityConfig) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-viewport text-body text-viewport-text-muted">
        Loading map…
      </div>
    );
  }

  const center = [facilityConfig.lat, facilityConfig.lng];

  return (
    <div
      className={`relative z-0 h-full w-full ${
        tileSourceIndex > 0 ? 'der-tiles-fallback' : ''
      }`}
    >
      <MapContainer center={center} zoom={14} className="h-full w-full" zoomControl={false}>
        {/* Basemap with an automatic fallback provider. The hazard polygons,
            marker and wedge live in Leaflet's overlay pane, which is drawn
            independently of the tile pane -- so if BOTH providers fail the
            zones still render correctly against a blank background. The map
            degrades to a plain backdrop, never to a broken dashboard. */}
        <TileLayer
          key={tileSource.url}
          url={tileSource.url}
          maxZoom={tileSource.maxZoom}
          attribution={tileSource.attribution}
          eventHandlers={{ tileerror: handleTileError }}
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
