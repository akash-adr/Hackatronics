import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';
import { SEVERITY_COLORS } from '../../theme';
import {
  THREAT_LEVEL_MESSAGE,
  THREAT_LEVEL_SEVERITY,
  getThreatLevel,
} from '../../utils/hazard';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * Block 2 -- one word for the whole picture.
 *
 * The rule lives in utils/hazard.js so it is testable and has a single
 * definition; this component only renders it. The colour is borrowed from the
 * hazard ramp itself, so HIGH is the same red as the fatal band on the map.
 */
const ThreatLevelBlock = () => {
  const zoneData = useFacilityStore((s) => s.getDisplayedZoneData());

  if (!zoneData) return null;

  const level = getThreatLevel(zoneData);
  const color = SEVERITY_COLORS[THREAT_LEVEL_SEVERITY[level]];

  return (
    <Card>
      <SectionLabel>Threat level</SectionLabel>
      <div className="mt-3 flex items-start gap-4">
        <span
          className="mt-1.5 h-10 w-1.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <div>
          <p
            className="text-[32px] font-bold leading-none tracking-tight"
            style={{ color }}
          >
            {level}
          </p>
          <p className="mt-2 max-w-prose text-body leading-relaxed text-ink">
            {THREAT_LEVEL_MESSAGE[level]}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default ThreatLevelBlock;
