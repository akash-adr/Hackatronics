import React, { useEffect } from 'react';
import { Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import useFacilityStore from '../../store/useFacilityStore';

/**
 * Multi-tank domino / escalation detection -- map half.
 *
 * Purely additive: it adds a click handler and one marker. It does not touch
 * the hazard layers, the safe-approach wedge, or the basemap.
 */

/** Distinct from the primary pin: a square "B" badge, not a teardrop marker. */
function secondFacilityIcon(atRisk) {
  const ring = atRisk ? '#F59E0B' : '#F9FAFB';
  const warning = atRisk
    ? `<span style="position:absolute;top:-9px;right:-9px;width:16px;height:16px;
         border-radius:50%;background:#F59E0B;color:#1A1A1A;font:700 11px/16px Inter,sans-serif;
         text-align:center;">!</span>`
    : '';
  return L.divIcon({
    className: 'der-second-facility',
    html: `<div style="position:relative;width:26px;height:26px;">
        <div style="width:26px;height:26px;border-radius:6px;
             background:rgba(15,20,35,0.88);border:2px solid ${ring};
             color:#F9FAFB;font:700 13px/22px Inter,sans-serif;text-align:center;
             box-shadow:0 2px 10px rgba(0,0,0,0.45);">B</div>
        ${warning}
      </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/** Captures the placement click and drives the crosshair cursor. */
const PlacementHandler = () => {
  const placing = useFacilityStore((s) => s.placingSecondFacility);
  const placeSecondFacility = useFacilityStore((s) => s.placeSecondFacility);
  const map = useMap();

  useMapEvents({
    click(e) {
      if (!placing) return;
      placeSecondFacility(e.latlng.lat, e.latlng.lng);
    },
  });

  // Standard "click to place" affordance.
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = placing ? 'crosshair' : '';
    return () => {
      container.style.cursor = '';
    };
  }, [placing, map]);

  return null;
};

const SecondFacilityLayer = () => {
  const secondFacility = useFacilityStore((s) => s.secondFacility);
  const escalation = useFacilityStore((s) => s.escalation);

  return (
    <>
      <PlacementHandler />

      {secondFacility && (
        <Marker
          position={[secondFacility.lat, secondFacility.lon]}
          icon={secondFacilityIcon(Boolean(escalation?.at_risk))}
          zIndexOffset={600}
        >
          <Tooltip direction="top" offset={[0, -16]} className="der-tip">
            Facility B
          </Tooltip>
        </Marker>
      )}
    </>
  );
};

export default SecondFacilityLayer;
