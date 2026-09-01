import React, { useMemo } from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import { bandRadius, bandThresholdText, severityColor, severityLabel } from '../../theme';

/**
 * Renders one hazard type's bands as Leaflet polygons.
 *
 * LAYERING: bands are sorted by radius DESCENDING, so the largest (least
 * severe) is emitted first and painted at the bottom, and the smallest (fatal)
 * is emitted last and painted on top. Reversing this would bury the most
 * important zone under the milder ones.
 *
 * LIVE UPDATES: each Polygon is keyed by its band label, which is stable
 * across responses. React therefore reuses the same component instance -- and
 * with it the same underlying Leaflet layer -- when new coordinates arrive, so
 * react-leaflet calls setLatLngs() on the existing path instead of removing
 * and re-adding it. That is what keeps slider-driven updates smooth rather
 * than flickering.
 */
const HazardZoneLayer = ({ bands, hazardType }) => {
  // Sorted copy: never mutate the array held in the store.
  const orderedBands = useMemo(
    () => [...(bands ?? [])].sort((a, b) => bandRadius(b) - bandRadius(a)),
    [bands]
  );

  return (
    <>
      {orderedBands.map((band) => {
        const color = severityColor(band.label);
        const isThermal = hazardType === 'thermal';

        // A clipped band's radius is the solver's search boundary, not a real
        // threshold crossing. It is drawn faint and unfilled whatever the
        // hazard type, so it can never be mistaken for a trustworthy zone.
        const pathOptions = band.clipped
          ? {
              color,
              fill: false,
              weight: 1.5,
              opacity: 0.15,
              dashArray: '2 6',
            }
          : isThermal
            ? {
                color,
                fillColor: color,
                fill: true,
                fillOpacity: 0.35,
                weight: 1.5,
                opacity: 1,
              }
            : {
                color,
                fill: false,
                weight: 2,
                opacity: 1,
                dashArray: '6 4',
              };

        const tooltip = band.clipped
          ? `${severityLabel(band.label)}: beyond modeled range`
          : `${severityLabel(band.label)}: ${bandThresholdText(band)}`;

        return (
          <Polygon
            key={`${hazardType}-${band.label}`}
            positions={band.polygon}
            pathOptions={pathOptions}
          >
            <Tooltip sticky className="der-tip">
              {tooltip}
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
};

export default HazardZoneLayer;
