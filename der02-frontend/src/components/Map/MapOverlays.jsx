import React from 'react';
import { Rewind } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';

// Overlays drawn on top of the dark map: light-on-dark with a subtle dark
// backing so they stay legible against the tiles.
const MapOverlays = () => {
  const zoneData = useFacilityStore((s) => s.getDisplayedZoneData());
  const isTimelineReplay = useFacilityStore((s) => s.isTimelineReplay);
  const safeApproachBearing = zoneData?.safe_approach?.best_bearing_deg;

  return (
    <>
      {/* Replay tag ON the map. The status bar already swaps LIVE for REPLAY,
          but the map is what gets looked at (and screenshotted) on its own,
          so the state it is drawing has to be readable without glancing up. */}
      {isTimelineReplay && (
        <div className="pointer-events-none absolute left-4 top-4 z-[400] flex items-center gap-1.5 rounded-card border border-alert-border bg-alert-surface px-2.5 py-1.5 shadow-overlay">
          <Rewind className="h-3.5 w-3.5 text-alert" aria-hidden="true" />
          <span className="text-meta font-semibold uppercase tracking-wider text-ink">
            Replay — past moment
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 z-[400] flex items-center gap-4 rounded-card border border-viewport-hairline bg-viewport-overlay px-4 py-3 shadow-overlay backdrop-blur-sm">
      <div>
        <p className="text-meta font-medium uppercase tracking-wider text-viewport-text-muted">
          Safe approach
        </p>
        <p className="mt-0.5 text-stat font-semibold text-hazard-safe tnum">
          {safeApproachBearing ?? '—'}
          <span className="ml-0.5 text-meta font-medium text-viewport-text-muted">
            °
          </span>
        </p>
      </div>
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 text-hazard-safe"
        style={{ transform: `rotate(${safeApproachBearing ?? 0}deg)` }}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      </div>
    </>
  );
};

export default MapOverlays;
