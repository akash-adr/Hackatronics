import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';

// Overlays drawn on top of the dark map: light-on-dark with a subtle dark
// backing so they stay legible against the tiles.
const MapOverlays = () => {
  const zoneData = useFacilityStore((s) => s.zoneData);
  const safeApproachBearing = zoneData?.safe_approach?.best_bearing_deg;

  return (
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
  );
};

export default MapOverlays;
