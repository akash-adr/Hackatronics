import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';
import { getFatalRadius } from '../../utils/hazard';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * The two figures a commander needs first, shown large enough to read from
 * across a room. Both are read from the central store -- never fetched here.
 */
const KeyFigures = () => {
  const zoneData = useFacilityStore((s) => s.getDisplayedZoneData());

  const fatal = getFatalRadius(zoneData);
  const safe = zoneData?.safe_approach;

  return (
    <Card>
      <SectionLabel>Key figures</SectionLabel>

      <div className="mt-4">
        <p className="text-meta font-medium text-subtle">Max fatal radius</p>
        <p className="mt-1 text-ink">
          <span className="text-[32px] font-semibold leading-none tnum">
            {fatal !== null ? fatal : '—'}
          </span>
          <span className="ml-1.5 text-body font-medium text-subtle">m</span>
        </p>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-meta font-medium text-subtle">Safe approach</p>
        {safe ? (
          <p className="mt-1 text-ink">
            <span className="text-[26px] font-semibold leading-none tnum text-hazard-safe">
              {safe.best_bearing_range_deg[0]}–{safe.best_bearing_range_deg[1]}
              <span className="ml-0.5 text-body font-medium text-subtle">°</span>
            </span>
            <span className="mt-1 block text-body text-subtle">
              standoff{' '}
              <span className="font-semibold text-ink tnum">
                {safe.min_standoff_m}
              </span>
              <span className="ml-0.5 text-meta">m</span>+
            </span>
          </p>
        ) : (
          <p className="mt-1 text-body text-subtle">
            Could not be determined — hazard extent exceeds modeled range.
          </p>
        )}
      </div>
    </Card>
  );
};

export default KeyFigures;
