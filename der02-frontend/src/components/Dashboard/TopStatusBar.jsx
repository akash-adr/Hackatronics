import React from 'react';
import { Flame, Rewind } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';
import ThemeToggle from './ThemeToggle';
import { degreesToCompass } from '../../utils/compass';

/**
 * Persistent status strip.
 *
 * The LIVE / STALE badge is driven by isLive in the central store, so it
 * reports the state of the one request pipeline every panel reads from --
 * there is no second source that could disagree with it.
 */
const TopStatusBar = () => {
  const zoneData = useFacilityStore((s) => s.getDisplayedZoneData());
  const config = useFacilityStore((s) => s.config);
  const isLive = useFacilityStore((s) => s.isLive);
  const isTimelineReplay = useFacilityStore((s) => s.isTimelineReplay);

  // Prefer the wind the backend echoed back with the current result; fall
  // back to the pending input while the first response is still in flight.
  const speed = zoneData?.wind?.speed_kmh ?? config.wind_speed_kmh;
  const fromDeg = zoneData?.wind?.from_deg ?? config.wind_dir_deg;
  const compass = degreesToCompass(fromDeg);

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-line bg-surface px-6">
      <div className="flex items-center gap-2.5">
        {/* Neutral: hazard red belongs to the map's fatal band alone. */}
        <Flame className="h-5 w-5 text-subtle" aria-hidden="true" />
        <h1 className="text-section font-semibold text-ink">
          Threat-Zone Estimator
        </h1>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-meta font-medium uppercase tracking-wider text-subtle">
            Wind
          </span>
          <span className="text-body font-semibold text-ink tnum">{speed}</span>
          <span className="text-meta text-subtle">km/h</span>
          <span className="text-body font-semibold text-ink">{compass ?? '—'}</span>
        </div>

        {/* Neutral, not safe-green: green is reserved for the approach
            corridor. Live vs stale is carried by weight and the dot. */}
        {/* Replay outranks live/stale: while a past moment is on screen this
            badge must never be able to read "Live". */}
        {isTimelineReplay ? (
          <span className="flex items-center gap-1.5 rounded-full border border-alert-border bg-alert-surface px-2.5 py-1 text-meta font-semibold uppercase tracking-wider text-ink">
            <Rewind className="h-3 w-3 text-alert" aria-hidden="true" />
            Replay
          </span>
        ) : isLive ? (
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-meta font-semibold uppercase tracking-wider text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-meta font-semibold uppercase tracking-wider text-subtle">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-subtle" />
            Stale — recomputing
          </span>
        )}

        {/* Shell theme only. The map's basemap toggle is separate and stays
            independent of this control. */}
        <ThemeToggle />
      </div>
    </header>
  );
};

export default TopStatusBar;
