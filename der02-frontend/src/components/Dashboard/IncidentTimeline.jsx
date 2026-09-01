import React from 'react';
import { Radio, Rewind } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * Incident timeline scrubber.
 *
 * Read-only over the log: it selects which logged moment is being LOOKED at,
 * and nothing else. While timelineViewIndex is null the component reports the
 * live tail and touches no other state, so the rest of the dashboard behaves
 * exactly as it did before this feature existed.
 *
 * Stage 1: the selection is displayed here only -- the map is not yet driven
 * from it.
 */

const TRIGGER_LABELS = {
  preset_load: 'Scenario loaded',
  wind_shift: 'Wind shift',
  manual_edit: 'Configuration change',
};

/** m:ss for anything under an hour; the demo never runs longer. */
function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const IncidentTimeline = () => {
  const incidentLog = useFacilityStore((s) => s.incidentLog);
  const timelineViewIndex = useFacilityStore((s) => s.timelineViewIndex);
  const isTimelineReplay = useFacilityStore((s) => s.isTimelineReplay);
  const viewTimelineEntry = useFacilityStore((s) => s.viewTimelineEntry);
  const exitTimelineReplay = useFacilityStore((s) => s.exitTimelineReplay);

  // One snapshot is a state, not a history -- nothing to scrub through yet.
  if (incidentLog.length < 2) return null;

  const lastIndex = incidentLog.length - 1;
  // Not in replay: the scrubber parks on the live tail.
  const viewIndex = timelineViewIndex ?? lastIndex;
  const entry = incidentLog[viewIndex];

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Incident timeline</SectionLabel>
        {isTimelineReplay ? (
          <span className="flex items-center gap-1 text-meta font-semibold uppercase tracking-wider text-alert">
            <Rewind className="h-3 w-3" aria-hidden="true" />
            Replay
          </span>
        ) : (
          <span className="flex items-center gap-1 text-meta font-semibold uppercase tracking-wider text-subtle">
            <Radio className="h-3 w-3" aria-hidden="true" />
            Live
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-meta text-subtle tnum">0:00</span>
        <input
          id="incident-timeline"
          aria-label="Incident timeline scrubber"
          type="range"
          min={0}
          max={lastIndex}
          step={1}
          value={viewIndex}
          onChange={(e) => viewTimelineEntry(Number(e.target.value))}
          className="der-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-line"
        />
        <span className="text-meta text-subtle tnum">
          {formatElapsed(incidentLog[lastIndex].elapsedSeconds)}
        </span>
      </div>

      {/* The figures for the moment currently under the scrubber head. */}
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-meta text-subtle">
            T+{formatElapsed(entry.elapsedSeconds)} ·{' '}
            {TRIGGER_LABELS[entry.trigger] ?? entry.trigger}
          </p>
          <p className="mt-0.5 text-meta text-subtle">
            Snapshot {viewIndex + 1} of {incidentLog.length}
          </p>
        </div>
        <div className="text-right">
          <p className="text-meta text-subtle">Fatal radius</p>
          <p className="text-section font-semibold text-ink tnum">
            {entry.worstFatalRadius ?? '—'}
            <span className="ml-1 text-meta font-normal text-subtle">m</span>
          </p>
        </div>
      </div>

      {isTimelineReplay && (
        <button
          type="button"
          onClick={exitTimelineReplay}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-card border border-line bg-surface px-3 py-2 text-body font-medium text-ink transition-colors hover:bg-surface-muted"
        >
          <Radio className="h-4 w-4" aria-hidden="true" />
          Return to live
        </button>
      )}
    </Card>
  );
};

export default IncidentTimeline;
