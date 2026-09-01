import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';
import {
  bandConsequence,
  bandRadius,
  bandThresholdText,
  severityColor,
  severityLabel,
} from '../../theme';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * Severity legend.
 *
 * Swatches call severityColor() -- the same function HazardZoneLayer uses to
 * paint the polygons -- so legend and map colours are identical by
 * construction and cannot drift. The colours are defined once, in theme.js.
 *
 * Each row carries three things:
 *   label      what the band means
 *   threshold  the physical constant that defines it -- never changes
 *   radius     where that threshold falls for the CURRENT configuration
 *
 * The radius is read fresh from the store's zoneData on every render via
 * bandRadius() (radius_no_wind_m for thermal, radius_m for blast), never
 * cached or held in local state -- so it tracks the map exactly, including
 * mid-drag. The threshold is rendered as a muted sub-label and the radius as
 * the prominent figure, because the radius is the number that actually
 * changes between configurations.
 */
const LegendRow = ({ band, hazardType }) => {
  const radius = bandRadius(band);
  const consequence = bandConsequence(band.label, hazardType);

  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-1 h-3 w-3 flex-shrink-0 rounded-sm"
          style={{ backgroundColor: severityColor(band.label) }}
        />
        <div className="min-w-0">
          <p className="truncate text-body text-ink">
            {severityLabel(band.label)}
          </p>
          {/* The fixed physical constant, plus what it means in practice. */}
          <p className="text-meta text-subtle tnum">
            {bandThresholdText(band)}
            {consequence && (
              <span className="ml-1.5 not-italic">— {consequence}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p
          className={`text-body font-semibold tnum ${
            band.clipped ? 'text-subtle' : 'text-ink'
          }`}
        >
          {radius !== undefined && radius !== null ? radius : '—'}
          <span className="ml-0.5 text-meta font-medium text-subtle">m</span>
        </p>
        {/* A clipped radius is the solver's search boundary, not a real
            threshold crossing, so it is shown de-emphasised and labelled
            rather than presented as a trustworthy distance. */}
        {band.clipped && (
          <p className="text-meta text-subtle">beyond range</p>
        )}
      </div>
    </div>
  );
};

const HazardGroup = ({ title, hint, bands, hazardType }) => {
  if (!bands?.length) return null;

  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-baseline justify-between">
        <p className="text-meta font-semibold text-ink">{title}</p>
        <p className="text-meta text-subtle">{hint}</p>
      </div>
      <div className="mt-1 flex flex-col divide-y divide-line">
        {bands.map((band) => (
          <LegendRow key={band.label} band={band} hazardType={hazardType} />
        ))}
      </div>
    </div>
  );
};

const SeverityLegend = () => {
  const zoneData = useFacilityStore((s) => s.getDisplayedZoneData());

  if (!zoneData) return null;

  return (
    <Card>
      <SectionLabel>Severity bands</SectionLabel>
      <HazardGroup
        title="Thermal radiation (kW/m²)"
        hint="filled"
        hazardType="thermal"
        bands={zoneData.thermal?.bands}
      />
      <HazardGroup
        title="Blast overpressure (psi)"
        hint="dashed outline"
        hazardType="blast"
        bands={zoneData.blast?.bands}
      />
    </Card>
  );
};

export default SeverityLegend;
