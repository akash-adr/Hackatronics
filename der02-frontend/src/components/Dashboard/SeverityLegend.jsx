import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';
import { bandThresholdText, severityColor, severityLabel } from '../../theme';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * Severity legend.
 *
 * Swatches call severityColor() -- the same function HazardZoneLayer uses to
 * paint the polygons -- so legend and map colours are identical by
 * construction and cannot drift. The colours are defined once, in theme.js.
 */
const LegendRow = ({ band }) => (
  <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="h-3 w-3 flex-shrink-0 rounded-sm"
        style={{ backgroundColor: severityColor(band.label) }}
      />
      <span className="truncate text-body text-ink">
        {severityLabel(band.label)}
      </span>
    </div>
    <span className="ml-3 flex-shrink-0 text-meta font-medium text-subtle tnum">
      {band.clipped ? 'beyond range' : bandThresholdText(band)}
    </span>
  </div>
);

const HazardGroup = ({ title, hint, bands }) => {
  if (!bands?.length) return null;

  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-baseline justify-between">
        <p className="text-meta font-semibold text-ink">{title}</p>
        <p className="text-meta text-subtle">{hint}</p>
      </div>
      <div className="mt-1 flex flex-col divide-y divide-line">
        {bands.map((band) => (
          <LegendRow key={band.label} band={band} />
        ))}
      </div>
    </div>
  );
};

const SeverityLegend = () => {
  const zoneData = useFacilityStore((s) => s.zoneData);

  if (!zoneData) return null;

  return (
    <Card>
      <SectionLabel>Severity bands</SectionLabel>
      <HazardGroup
        title="Thermal"
        hint="filled"
        bands={zoneData.thermal?.bands}
      />
      <HazardGroup
        title="Blast"
        hint="dashed outline"
        bands={zoneData.blast?.bands}
      />
    </Card>
  );
};

export default SeverityLegend;
