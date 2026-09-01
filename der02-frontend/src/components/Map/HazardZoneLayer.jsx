import React, { useMemo } from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import {
  SEVERITY_COLORS,
  bandRadius,
  bandThresholdText,
  severityColor,
  severityLabel,
} from '../../theme';

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

// ---------------------------------------------------------------------------
// THERMAL BAND STYLES -- one explicit, fully-written object per band.
//
// Deliberately NOT derived in a loop or from a shared template: each band's
// style is stated in full and independently, so no band can inherit a partial
// or defaulted value. Every property is set explicitly; nothing relies on
// Leaflet defaults.
//
// The hex values come from SEVERITY_COLORS (the single palette the legend also
// reads) so the map and legend cannot drift -- but each object is written out
// separately rather than generated.
// ---------------------------------------------------------------------------
const fatalStyle = {
  fill: true,
  fillColor: SEVERITY_COLORS.fatal, // #EF4444 red
  fillOpacity: 0.55,
  color: SEVERITY_COLORS.fatal, // #EF4444 red
  weight: 2,
  opacity: 0.9,
};

const seriousStyle = {
  fill: true,
  fillColor: SEVERITY_COLORS.serious, // #F97316 orange
  fillOpacity: 0.55,
  color: SEVERITY_COLORS.serious, // #F97316 orange
  weight: 2,
  opacity: 0.9,
};

const painStyle = {
  fill: true,
  fillColor: SEVERITY_COLORS.pain, // #FACC15 yellow
  fillOpacity: 0.55,
  color: SEVERITY_COLORS.pain, // #FACC15 yellow
  weight: 2,
  opacity: 0.9,
};

/** Dispatch only -- the three objects above are each defined independently. */
const THERMAL_STYLES = {
  fatal: fatalStyle,
  serious: seriousStyle,
  pain: painStyle,
};

const HazardZoneLayer = ({ bands, hazardType }) => {
  // Sorted copy: never mutate the array held in the store.
  const orderedBands = useMemo(
    () => [...(bands ?? [])].sort((a, b) => bandRadius(b) - bandRadius(a)),
    [bands]
  );

  const isThermal = hazardType === 'thermal';

  return (
    <>
      {orderedBands.map((band) => {
        const color = severityColor(band.label);

        // Thermal always uses its own explicit style object -- no exceptions,
        // including clipped bands.
        // Blast stays outline-only (dashed), and a clipped blast band is drawn
        // faint so a search-boundary radius is never mistaken for a real one.
        let pathOptions;
        if (isThermal) {
          pathOptions = THERMAL_STYLES[band.label] ?? painStyle;
        } else if (band.clipped) {
          pathOptions = {
            color,
            fill: false,
            weight: 1.5,
            opacity: 0.15,
            dashArray: '2 6',
          };
        } else {
          // Blast bands: dashed outline UNCHANGED (colour, weight, dashArray
          // all as before) -- fill added underneath it.
          //
          // 0.18 matches the safe-approach wedge exactly, for visual
          // consistency. It is deliberately far lighter than thermal's 0.55:
          // together with the dashed stroke, that is what still tells the two
          // hazard types apart now that both are filled.
          pathOptions = {
            color,
            fill: true,
            fillColor: color,
            fillOpacity: 0.18,
            weight: 2,
            opacity: 1,
            dashArray: '6 4',
          };
        }

        // TEMPORARY: logs the exact final style object handed to each thermal
        // Polygon, immediately before it renders.
        if (isThermal) {
          // eslint-disable-next-line no-console
          console.log(
            `[thermal band] ${band.label}`,
            JSON.stringify(pathOptions)
          );
        }

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
