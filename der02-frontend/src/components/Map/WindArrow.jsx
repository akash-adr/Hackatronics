import React, { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import useFacilityStore from '../../store/useFacilityStore';

// Arrow length in pixels across the demo wind range. Length AND thickness both
// grow with speed, so strength is readable at a glance without reading a number.
const MIN_LENGTH_PX = 34;
const MAX_LENGTH_PX = 74;
const DESIGN_MAX_KMH = 60; // Module 2's design-maximum wind speed

/**
 * Wind direction indicator anchored at the facility.
 *
 * Rotation uses wind.to_deg straight from the API -- the direction the wind
 * blows TOWARD. It is deliberately not re-derived from from_deg here: the
 * backend owns that flip, and duplicating it is exactly how the two could end
 * up disagreeing.
 *
 * Bearings are clockwise from north; CSS rotation is clockwise from the arrow's
 * drawn "up" direction, so a to_deg rotation maps directly.
 */
const WindArrow = () => {
  const zoneData = useFacilityStore((s) => s.zoneData);
  const facilityConfig = useFacilityStore((s) => s.facilityConfig);

  const wind = zoneData?.wind;

  const icon = useMemo(() => {
    if (!wind) return null;

    const speed = wind.speed_kmh ?? 0;
    const ratio = Math.min(speed / DESIGN_MAX_KMH, 1);
    const length = MIN_LENGTH_PX + (MAX_LENGTH_PX - MIN_LENGTH_PX) * ratio;
    const stroke = 2 + 2.5 * ratio;
    const box = MAX_LENGTH_PX * 2;

    // Calm: no direction to show, so render a neutral ring instead of an
    // arrow pointing an arbitrary way.
    const body =
      speed <= 0
        ? `<circle cx="${box / 2}" cy="${box / 2}" r="7" fill="none"
             stroke="#F9FAFB" stroke-width="2" opacity="0.75" />`
        : `<g transform="rotate(${wind.to_deg} ${box / 2} ${box / 2})">
             <line x1="${box / 2}" y1="${box / 2 + length / 2}"
                   x2="${box / 2}" y2="${box / 2 - length / 2}"
                   stroke="#F9FAFB" stroke-width="${stroke}" stroke-linecap="round" />
             <polygon points="${box / 2},${box / 2 - length / 2 - 3}
                              ${box / 2 - 6},${box / 2 - length / 2 + 8}
                              ${box / 2 + 6},${box / 2 - length / 2 + 8}"
                      fill="#F9FAFB" />
           </g>`;

    return L.divIcon({
      className: 'der-wind-arrow',
      iconSize: [box, box],
      iconAnchor: [box / 2, box / 2],
      html: `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}"
                  style="filter: drop-shadow(0 1px 3px rgba(0,0,0,0.8))">
               ${body}
             </svg>`,
    });
  }, [wind]);

  if (!icon || !facilityConfig) return null;

  return (
    <Marker
      position={[facilityConfig.lat, facilityConfig.lng]}
      icon={icon}
      interactive={false}
      zIndexOffset={500}
    />
  );
};

export default WindArrow;
