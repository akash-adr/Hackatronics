import React, { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, Satellite } from 'lucide-react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useFacilityStore from '../../store/useFacilityStore';
import FacilityMarker from './FacilityMarker';
import WindArrow from './WindArrow';
import HazardZoneLayer from './HazardZoneLayer';
import SafeApproachWedge from './SafeApproachWedge';
import SecondFacilityLayer from './SecondFacilityLayer';
import EscalationPanel from './EscalationPanel';

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

// Two user-selectable basemaps, both keyless.
//
// NOTE ON DARK: CartoDB Dark Matter is NOT usable -- its tiles now come back
// stamped "API KEY REQUIRED / carto.com/basemaps/apikey" (HTTP 200, so it
// fails silently rather than erroring). Esri's Dark Gray Canvas is the
// keyless equivalent and is what this project used before the satellite swap.
const BASEMAPS = {
  light: {
    name: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Esri, Maxar, Earthstar Geographics',
  },
  dark: {
    name: 'Esri Dark Gray Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  },
};

// Used only when the selected basemap's provider fails (Module 7). Not a
// user-facing choice.
const FALLBACK_TILES = {
  name: 'OpenStreetMap',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

/**
 * Fit the view to the current configuration's outermost hazard band.
 *
 * A fixed zoom cannot serve both presets: Config A's blast bands reach ~870 m
 * while Config B's pass 2 km, so any single level renders one of them as
 * specks. Fitting to the data keeps the zones readable at either scale.
 *
 * WHAT RETRIGGERS IT: only changes that actually resize the zones -- the
 * preset, substance, tank volume and tank diameter. Wind speed, direction and
 * humidity are deliberately excluded: they reshape the polygon without
 * changing its scale, and re-fitting on every slider tick would make the map
 * lurch while a judge is dragging.
 */
const FitToHazardBounds = ({ zoneData }) => {
  const map = useMap();
  const config = useFacilityStore((s) => s.config);
  const activePreset = useFacilityStore((s) => s.activePreset);
  const timelineViewIndex = useFacilityStore((s) => s.timelineViewIndex);
  const lastFitKeyRef = useRef(null);

  // Only the size-affecting inputs appear in this key.
  //
  // timelineViewIndex is one of them: a replayed moment can be several times
  // larger than the live one (Config B's 34.3 m fatal band against Config A's
  // 7.8 m), and framing that on the live scenario's zoom crops it off the
  // viewport. Scrubbing therefore refits, and returning to live refits back.
  // With the timeline untouched the index is always null, so this key -- and
  // the framing behaviour -- is exactly what it was before.
  const fitKey = [
    activePreset ?? 'custom',
    config.substance,
    config.tank_volume_m3,
    config.tank_diameter_m,
    timelineViewIndex,
  ].join('|');

  useEffect(() => {
    if (!zoneData) return;
    if (lastFitKeyRef.current === fitKey) return;

    // Fit to the outermost THERMAL band, not the outermost band overall.
    //
    // Blast reaches 234-870 m while thermal spans only 7.8-35.9 m, so framing
    // the blast extent squeezes all three thermal bands into 16/7/2 px --
    // leaving visible rings just 4.5, 2.5 and 1 px wide, thinner than their
    // own 1.5 px strokes. They are filled correctly, but far too thin to read
    // as filled. Framing thermal instead makes all three legible; the blast
    // rings extend past the viewport, and are outline-only anyway, with their
    // radii stated numerically in the legend.
    const preferred = zoneData.thermal?.bands?.length
      ? zoneData.thermal.bands
      : (zoneData.blast?.bands ?? []);

    const outer = preferred.reduce(
      (best, b) => {
        const r = b.radius_no_wind_m ?? b.radius_m ?? 0;
        return r > best.r ? { r, band: b } : best;
      },
      { r: 0, band: null }
    ).band;

    if (!outer?.polygon?.length) return;

    lastFitKeyRef.current = fitKey;
    const bounds = L.latLngBounds(outer.polygon);
    // pad() expands the bounds by a ratio, giving breathing room without the
    // zones being pushed to the very edge of the viewport.
    map.fitBounds(bounds.pad(0.2), { animate: true });
  }, [fitKey, zoneData, map]);

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
  const { facilityConfig } = useFacilityStore();
  // Live result normally; the replayed snapshot while the timeline is scrubbed.
  const zoneData = useFacilityStore((s) => s.getDisplayedZoneData());

  // Pure display preference -- deliberately local state, not in the Zustand
  // store, because it affects nothing that is computed.
  const [basemap, setBasemap] = useState('light');
  const [usingFallback, setUsingFallback] = useState(false);

  // A failing provider emits tileerror per tile, so the switch is guarded to
  // fire once rather than once per broken tile.
  const hasFallenBack = useRef(false);

  const tileSource = usingFallback ? FALLBACK_TILES : BASEMAPS[basemap];

  const handleTileError = () => {
    if (hasFallenBack.current || usingFallback) return;
    hasFallenBack.current = true;
    console.warn(
      `Tile source failed (${tileSource.name}) -- switching to ` +
        `${FALLBACK_TILES.name}. Hazard overlays are unaffected.`
    );
    setUsingFallback(true);
  };

  const selectBasemap = (next) => {
    if (next === basemap) return;
    // Give the newly chosen provider a clean chance rather than inheriting a
    // previous provider's failure.
    hasFallenBack.current = false;
    setUsingFallback(false);
    setBasemap(next);
  };

  if (!facilityConfig) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-viewport text-body text-viewport-text-muted">
        Loading map…
      </div>
    );
  }

  const center = [facilityConfig.lat, facilityConfig.lng];

  const toggleButton = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => selectBasemap(value)}
      aria-pressed={basemap === value}
      title={`${label} basemap`}
      aria-label={`${label} basemap`}
      className={`flex items-center gap-1 px-2 py-1 text-meta font-medium transition-colors ${
        basemap === value
          ? 'bg-viewport-text text-viewport'
          : 'text-viewport-text hover:bg-white/10'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div className="relative z-0 h-full w-full">
      {/* Basemap switch. Sits top-right; Leaflet's zoom control is disabled on
          this map, so there is nothing to collide with.
          Labels describe what each layer SHOWS ("Satellite View" / "Street
          View"); the underlying state keys stay 'light' / 'dark', so the tile
          configs and failover logic are untouched. */}
      <div className="absolute right-3 top-3 z-[500] flex overflow-hidden rounded-card border border-viewport-hairline bg-viewport-overlay shadow-overlay backdrop-blur-sm">
        {toggleButton('light', Satellite, 'Satellite View')}
        {toggleButton('dark', MapIcon, 'Street View')}
      </div>

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
        <FitToHazardBounds zoneData={zoneData} />

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

        <SecondFacilityLayer />
        <FacilityMarker />
        <WindArrow />
      </MapContainer>

      <EscalationPanel />
    </div>
  );
};

export default HazardMap;
