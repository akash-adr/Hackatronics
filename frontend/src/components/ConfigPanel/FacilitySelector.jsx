import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';
import { PRESETS } from '../../config/presets';

/**
 * Preset toggle. Clicking a side performs a full field overwrite and
 * recomputes immediately -- there is no separate apply step.
 *
 * activePreset goes null after a manual edit, so neither button reads as
 * selected while the values are custom. That is the honest state: the map is
 * no longer showing either preset.
 */
const FacilitySelector = () => {
  const activePreset = useFacilityStore((s) => s.activePreset);
  const loadPreset = useFacilityStore((s) => s.loadPreset);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Configuration preset">
        {Object.entries(PRESETS).map(([key, preset]) => {
          const active = activePreset === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => loadPreset(key)}
              aria-pressed={active}
              className={`rounded-card px-3 py-2 text-meta font-medium transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-2 ${
                  active
                    ? 'bg-accent text-white shadow-card'
                    : 'border border-line bg-surface text-ink hover:bg-surface-muted'
                }`}
            >
              {key === 'configA' ? 'Config A' : 'Config B'}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-body font-medium text-ink">
        {activePreset ? PRESETS[activePreset].label : 'Custom configuration'}
      </p>
      <p className="mt-1 text-meta leading-relaxed text-subtle">
        {activePreset
          ? PRESETS[activePreset].narrative
          : 'Values edited by hand — no longer matching either preset.'}
      </p>
    </div>
  );
};

export default FacilitySelector;
