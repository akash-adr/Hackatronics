import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useFacilityStore from '../../store/useFacilityStore';
import { FACILITY_CENTER } from '../../config/presets';
import FacilityMarker from './FacilityMarker';
import HazardZoneLayer from './HazardZoneLayer';
import JointApproachCorridor, {
  computeSectorPositions,
} from './JointApproachCorridor';
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
const FitToDualBounds = ({ dualZoneData, fitKey, sectorPositions }) => {
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
    // The approach sector starts OUTSIDE the combined region, so it reaches
    // well past the bands. Framing the bands alone left it half off-screen.
    if (sectorPositions?.length) points.push(...sectorPositions);
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
  // Live result normally; a growth-scaled copy while the simulation plays.
  const dualZoneData = useFacilityStore((s) => s.getDisplayedDualZoneData());
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

  const jointApproach = dualZoneData?.joint_safe_approach ?? null;

  /**
   * Each facility's centre and outer thermal reach, which the corridor needs
   * to keep its inner end clear of both zones. Read from the same response
   * that drew the polygons, so the two can never disagree.
   */
  const facilities = useMemo(() => {
    if (!dualZoneData || !centerB) return [];
    // The OUTER thermal band's own per-angle (wind-warped) reach -- the exact
    // numbers behind the drawn polygon, so the corridor cannot disagree with
    // what is on screen.
    const outerBand = (warped) => {
      const bands = warped?.thermal?.bands ?? [];
      if (!bands.length) return null;
      return bands.reduce((a, b) =>
        (b.radius_no_wind_m ?? 0) > (a.radius_no_wind_m ?? 0) ? b : a
      );
    };
    const bandA = outerBand(dualZoneData.facility_a);
    const bandB = outerBand(dualZoneData.facility_b);
    if (!bandA?.per_angle_radii || !bandB?.per_angle_radii) return [];
    return [
      { center: [centerA.lat, centerA.lng], perAngleRadii: bandA.per_angle_radii },
      { center: [centerB.lat, centerB.lng], perAngleRadii: bandB.per_angle_radii },
    ];
  }, [dualZoneData, centerA.lat, centerA.lng, centerB]);

  // Only size- and position-affecting inputs, per FitToHazardBounds' rule.
  // Computed once here and reused by both the drawn sector and the fit bounds,
  // so the framing can never disagree with the shape it is framing.
  const sectorPositions = useMemo(
    () => computeSectorPositions({ joint: jointApproach, midpoint, facilities }),
    [jointApproach, midpoint, facilities]
  );

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

      {/* Silence would read as "no hazard here". The backend's own reason
          string says why there is no recommendation instead. */}
      {jointApproach && jointApproach.available === false && (
        <div className="pointer-events-none absolute left-3 top-14 z-[500] max-w-[min(22rem,60%)] rounded-card border border-alert-border bg-alert-surface px-3 py-2 shadow-overlay">
          <p className="text-meta font-semibold text-ink">
            No joint safe approach available
          </p>
          <p className="mt-0.5 text-meta leading-relaxed text-ink">
            {jointApproach.reason}
          </p>
        </div>
      )}

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
        <FitToDualBounds
          dualZoneData={dualZoneData}
          fitKey={fitKey}
          sectorPositions={sectorPositions}
        />

        {/* Facility A -- its own bands, from its own compute. */}
        <FacilityZones warped={dualZoneData?.facility_a} />
        {/* Facility B -- SAME components, B's own independent bands. */}
        <FacilityZones warped={dualZoneData?.facility_b} />

        {/* The JOINT approach corridor: wide at the safe outer end, narrowing
            toward the incident, and drawn ONLY when the backend actually found
            a clearing bearing. available === false means no bearing clears
            both zones, so nothing is drawn rather than something wrong. */}
        {jointApproach?.available ? (
          <JointApproachCorridor
            joint={jointApproach}
            midpoint={midpoint}
            facilities={facilities}
          />
        ) : null}

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
