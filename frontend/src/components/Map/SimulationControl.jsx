import React from 'react';
import { Play, SkipForward } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';

/**
 * "Run Simulation" -- a cosmetic replay of the CURRENT result growing in.
 *
 * The wording matters: this animates an already-computed extent, it does not
 * model fire growth over time. The backend has no time domain, so the label
 * says "visualising final hazard extent" rather than anything that would imply
 * a physical growth rate.
 */
const SimulationControl = () => {
  const simulating = useFacilityStore((s) => s.simulating);
  const runSimulation = useFacilityStore((s) => s.runSimulation);
  const skipSimulation = useFacilityStore((s) => s.skipSimulation);
  const zoneData = useFacilityStore((s) => s.zoneData);

  if (!zoneData) return null; // nothing computed yet, nothing to dramatise

  if (simulating) {
    return (
      <div className="pointer-events-auto absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-card border border-viewport-hairline bg-viewport-overlay px-2.5 py-1.5 shadow-overlay backdrop-blur-sm">
        <span className="flex h-2 w-2 flex-shrink-0">
          <span className="h-2 w-2 animate-ping rounded-full bg-hazard-safe opacity-75" />
        </span>
        <span className="text-meta font-medium text-viewport-text">
          Visualizing final hazard extent…
        </span>
        <button
          type="button"
          onClick={skipSimulation}
          className="ml-1 flex items-center gap-1 rounded border border-viewport-hairline px-1.5 py-0.5 text-meta font-medium text-viewport-text transition-colors hover:bg-white/10"
        >
          <SkipForward className="h-3 w-3" aria-hidden="true" />
          Skip
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={runSimulation}
      title="Replay the current result growing to its computed extent"
      className="pointer-events-auto absolute left-3 top-3 z-[500] flex items-center gap-1.5 rounded-card border border-viewport-hairline bg-viewport-overlay px-2.5 py-1.5 text-meta font-semibold text-viewport-text shadow-overlay backdrop-blur-sm transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hazard-safe/50"
    >
      <Play className="h-3.5 w-3.5 text-hazard-safe" aria-hidden="true" />
      Run Simulation
    </button>
  );
};

export default SimulationControl;
