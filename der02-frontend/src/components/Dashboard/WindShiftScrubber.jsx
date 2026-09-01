import React from 'react';

const WindShiftScrubber = () => (
  <div>
    <div className="flex items-center justify-between">
      <label className="text-body font-medium text-ink" htmlFor="wind-shift">
        Wind shift timeline
      </label>
      <span className="text-meta font-medium text-subtle tnum">Now</span>
    </div>

    <div className="mt-3 flex items-center gap-3">
      <span className="text-meta text-subtle tnum">0h</span>
      <input
        id="wind-shift"
        type="range"
        min="0"
        max="24"
        defaultValue="0"
        className="der-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-line"
      />
      <span className="text-meta text-subtle tnum">24h</span>
    </div>

    <p className="mt-3 text-meta text-subtle">Timeline scrubbing coming soon.</p>
  </div>
);

export default WindShiftScrubber;
