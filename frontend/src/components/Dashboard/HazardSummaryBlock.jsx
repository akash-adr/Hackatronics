import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';
import { degreesToCompass } from '../../utils/compass';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * Block 1 -- the inputs behind the zones on screen.
 *
 * Every field here is a REAL modelled quantity: substance, tank diameter, tank
 * volume, wind and humidity are exactly the five things the physics engine
 * takes. Tank type, pressure and ambient temperature are not modelled by this
 * project, so they are not shown -- an invented field on a hazard readout is
 * worse than a missing one.
 *
 * Reads getDisplayedConfig(), so during a timeline replay it describes the
 * moment being viewed rather than the live inputs.
 */
const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
    <span className="text-body text-subtle">{label}</span>
    <span className="text-body font-medium text-ink tnum">{value}</span>
  </div>
);

const HazardSummaryBlock = () => {
  const config = useFacilityStore((s) => s.getDisplayedConfig());
  const schema = useFacilityStore((s) => s.schema);

  if (!config) return null;

  // Same source as the dropdown's own labels, so the two can never disagree.
  const substanceName =
    schema?.substances?.find((s) => s.key === config.substance)?.display_name ??
    config.substance;

  const compass = degreesToCompass(config.wind_dir_deg);

  return (
    <Card>
      <SectionLabel>Hazard summary</SectionLabel>
      <div className="mt-3 sm:grid sm:grid-cols-2 sm:gap-x-8">
        <Row label="Substance" value={substanceName} />
        <Row label="Tank diameter" value={`${config.tank_diameter_m} m`} />
        <Row label="Volume" value={`${config.tank_volume_m3} m³`} />
        <Row
          label="Wind"
          value={`${config.wind_speed_kmh} km/h from ${compass ?? '—'}`}
        />
        <Row label="Humidity" value={`${config.humidity_pct}%`} />
      </div>
    </Card>
  );
};

export default HazardSummaryBlock;
