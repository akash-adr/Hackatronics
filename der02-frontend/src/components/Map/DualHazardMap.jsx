import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useFacilityStore from '../../store/useFacilityStore';
import { FACILITY_CENTER } from '../../config/presets';
import FacilityMarker from './FacilityMarker';
import HazardZoneLayer from './HazardZoneLayer';
import SafeApproachWedge from './SafeApproachWedge';
import WindArrow from './WindArrow';

/**
 * Dual-facility map.
 *
 * Purely additive: HazardMap.jsx, HazardZoneLayer, SafeApproachWedge and
 * WindArrow are untouched. This component simply INVOKES the existing
 * components a second time with facility B's own data, which is what makes
 * B's zone genuinely independent of A's on screen.
 */

// Same keyless satellite basemap the single-facility map uses.
const TILE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maxZoom: 19,
  attribution: 'Esri, Maxar, Earthstar Geographics',
};

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

/**
 * Frames BOTH facilities' outermost thermal bands.
 *
 * Keyed on the inputs that change zone SIZE or facility POSITION only -- so a
 * wind-direction nudge re-warps the polygons without yanking the viewport.
 */
const FitToDualBounds = ({ dualZoneData, fitKey }) => {
  const map = useMap();

  useEffect(() => {
    if (!dualZoneData) return;

    const points = [];
    for (const key of ['facility_a', 'facility_b']) {
      const bands = dualZoneData[key]?.thermal?.bands;
      if (!bands?.length) continue;
      const outer = bands.reduce((a, b) =>
        b.radius_no_wind_m > a.radius_no_wind_m ? b : a
      );
      points.push(...outer.polygon);
    }
    if (points.length < 2) return;

    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  return null;
};

/** Draw order per facility: blast (wide outlines) under thermal (filled). */
const FacilityZones = ({ warped }) => (
  <>
    {warped?.blast && <HazardZoneLayer bands={warped.blast.bands} hazardType="blast" />}
    {warped?.thermal && (
      <HazardZoneLayer bands={warped.thermal.bands} hazardType="thermal" />
    )}
  </>
);

const DualHazardMap = () => {
  const dualZoneData = useFacilityStore((s) => s.dualZoneData);
  const secondFacilityConfig = useFacilityStore((s) => s.secondFacilityConfig);
  const facilityConfig = useFacilityStore((s) => s.facilityConfig);

  const centerA = {
    lat: facilityConfig?.lat ?? FACILITY_CENTER.lat,
    lng: facilityConfig?.lng ?? FACILITY_CENTER.lng,
  };
  const centerB = secondFacilityConfig
    ? { lat: secondFacilityConfig.lat, lng: secondFacilityConfig.lng }
    : null;

  // The backend computes the joint corridor relative to the MIDPOINT of the
  // two facilities, so the wedge apex has to sit there too.
  const midpoint = centerB
    ? [(centerA.lat + centerB.lat) / 2, (centerA.lng + centerB.lng) / 2]
    : [centerA.lat, centerA.lng];

  // Only size- and position-affecting inputs, per FitToHazardBounds' rule.
  const fitKey = useMemo(
    () =>
      secondFacilityConfig
        ? [
            secondFacilityConfig.substance,
            secondFacilityConfig.tank_volume_m3,
            secondFacilityConfig.tank_diameter_m,
            secondFacilityConfig.lat,
            secondFacilityConfig.lng,
            facilityConfig?.substance,
            facilityConfig?.tank_volume_m3,
            facilityConfig?.tank_diameter_m,
          ].join('|')
        : '',
    [secondFacilityConfig, facilityConfig]
  );

  return (
    <div className="relative z-0 h-full w-full">
      <div className="absolute right-3 top-3 z-[500] rounded-card border border-viewport-hairline bg-viewport-overlay px-2.5 py-1 text-meta font-medium text-viewport-text shadow-overlay backdrop-blur-sm">
        Dual-facility view
      </div>

      <MapContainer
        center={[centerA.lat, centerA.lng]}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          url={TILE.url}
          maxZoom={TILE.maxZoom}
          attribution={TILE.attribution}
        />

        <ResizeHandler />
        <FitToDualBounds dualZoneData={dualZoneData} fitKey={fitKey} />

        {/* Facility A -- its own bands, from its own compute. */}
        <FacilityZones warped={dualZoneData?.facility_a} />
        {/* Facility B -- SAME components, B's own independent bands. */}
        <FacilityZones warped={dualZoneData?.facility_b} />

        {/* One JOINT corridor clearing both zones, drawn from the midpoint. */}
        <SafeApproachWedge
          safeApproach={dualZoneData?.joint_safe_approach}
          centerLat={midpoint[0]}
          centerLon={midpoint[1]}
        />

        <FacilityMarker position={[centerA.lat, centerA.lng]} label="Facility A" />
        {centerB && (
          <FacilityMarker
            position={[centerB.lat, centerB.lng]}
            label="Facility B"
          />
        )}
        <WindArrow />
      </MapContainer>
    </div>
  );
};

export default DualHazardMap;
