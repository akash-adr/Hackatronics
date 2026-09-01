import React from 'react';
import { TrendingUp } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * The worst moment of the incident so far -- the logged snapshot with the
 * largest fatal radius, which is not necessarily the most recent one.
 *
 * Subscribes to incidentLog (not just the getWorstMoment action) so it
 * re-renders as the log grows; the reduction itself stays in the store so
 * there is one definition of "worst".
 */

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const WorstMomentCard = () => {
  const incidentLog = useFacilityStore((s) => s.incidentLog);
  const getWorstMoment = useFacilityStore((s) => s.getWorstMoment);
  const viewTimelineEntry = useFacilityStore((s) => s.viewTimelineEntry);
  const timelineViewIndex = useFacilityStore((s) => s.timelineViewIndex);

  if (incidentLog.length < 2) return null;

  const worst = getWorstMoment();
  if (!worst) return null;

  // reduce() returns the entry itself, so identity gives its index directly.
  const worstIndex = incidentLog.indexOf(worst);
  const alreadyViewing = timelineViewIndex === worstIndex;

  return (
    <Card>
      <SectionLabel>Worst moment</SectionLabel>

      <div className="mt-3 flex items-start gap-2">
        <TrendingUp
          className="mt-1 h-4 w-4 flex-shrink-0 text-subtle"
          aria-hidden="true"
        />
        <div>
          <p className="text-stat font-semibold text-ink tnum">
            {worst.worstFatalRadius ?? '—'}
            <span className="ml-1 text-body font-normal text-subtle">m</span>
          </p>
          <p className="mt-0.5 text-meta text-subtle">
            Largest fatal radius, at T+{formatElapsed(worst.elapsedSeconds)} ·{' '}
            {worst.config.substance}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => viewTimelineEntry(worstIndex)}
        disabled={alreadyViewing}
        className="mt-4 flex w-full items-center justify-center rounded-card border border-line bg-surface px-3 py-2 text-body font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-45"
      >
        {alreadyViewing ? 'Viewing this moment' : 'View this moment'}
      </button>
    </Card>
  );
};

export default WorstMomentCard;
