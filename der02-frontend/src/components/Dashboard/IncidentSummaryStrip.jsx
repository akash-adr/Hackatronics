import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';
import { fatalRadiusM } from './KeyFigures';

/**
 * Full-width glance target under the map.
 *
 * Deliberately restates figures already in the right panel: when a viewer's
 * attention is on the map, this sits directly beneath it. Same central store,
 * so the restatement can never disagree with the panel it repeats.
 */
const Divider = () => (
  <span className="text-line" aria-hidden="true">
    |
  </span>
);

const IncidentSummaryStrip = () => {
  const zoneData = useFacilityStore((s) => s.zoneData);
  const facilityConfig = useFacilityStore((s) => s.facilityConfig);

  const fatal = fatalRadiusM(zoneData);
  const safe = zoneData?.safe_approach;

  return (
    <footer className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface px-6 py-3">
      <span className="text-body text-subtle">
        Substance:{' '}
        <span className="font-semibold text-ink">{facilityConfig.substance}</span>
      </span>

      <Divider />

      <span className="text-body text-subtle">
        Fatal:{' '}
        <span className="font-semibold text-ink tnum">
          {fatal !== null ? `${fatal}m` : '—'}
        </span>
      </span>

      <Divider />

      {safe ? (
        <span className="text-body text-subtle">
          Safe:{' '}
          <span className="font-semibold text-ink tnum">
            {safe.min_standoff_m}m+
          </span>{' '}
          from{' '}
          <span className="font-semibold text-ink tnum">
            {safe.best_bearing_range_deg[0]}–{safe.best_bearing_range_deg[1]}°
          </span>
        </span>
      ) : (
        <span className="text-body text-subtle">
          Safe approach: <span className="text-ink">could not be determined</span>
        </span>
      )}
    </footer>
  );
};

export default IncidentSummaryStrip;
