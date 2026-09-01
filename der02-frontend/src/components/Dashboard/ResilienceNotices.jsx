import React from 'react';
import { X } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';
import { PRESETS } from '../../config/presets';

/**
 * Two notices for two genuinely different situations.
 *
 * Neither auto-hides -- same reasoning as the what-changed alert: a notice
 * that disappears on a timer can be missed, which defeats the point of
 * telling the viewer the data is not live.
 */

const DismissButton = ({ onClick, tone }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Dismiss notice"
    className={`ml-auto flex flex-shrink-0 items-center gap-1 rounded-card px-2 py-0.5 text-meta font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${tone}`}
  >
    <X className="h-3.5 w-3.5" aria-hidden="true" />
    Dismiss
  </button>
);

/**
 * Calm, muted: a preset's cached answer was served because the live call
 * failed. The numbers on screen are real and correct, just not fresh -- so
 * this deliberately does not look like a crisis.
 */
export const FallbackNotice = () => {
  const fallbackPreset = useFacilityStore((s) => s.fallbackPreset);
  const dismiss = useFacilityStore((s) => s.dismissFallbackNotice);

  if (!fallbackPreset) return null;

  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface-muted px-6 py-1.5">
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-subtle" />
      <p className="text-meta text-subtle">
        Using last saved data for{' '}
        <span className="font-medium text-ink">
          {PRESETS[fallbackPreset]?.label ?? fallbackPreset}
        </span>{' '}
        — live backend unavailable.
      </p>
      <DismissButton onClick={dismiss} tone="text-subtle hover:bg-line/50" />
    </div>
  );
};

/**
 * The unrecoverable case: a hand-edited configuration with no cached answer.
 * This one should look like a real problem, because it is one. Uses the same
 * reserved alert colour as the what-changed banner -- both mean "attention
 * needed", and neither is a hazard-severity colour.
 */
export const HardFailureNotice = () => {
  const hardFailure = useFacilityStore((s) => s.hardFailure);
  const dismiss = useFacilityStore((s) => s.dismissHardFailure);

  if (!hardFailure) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-alert-border bg-alert-surface px-6 py-2.5"
    >
      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-alert" />
      <p className="text-body font-medium text-ink">{hardFailure}</p>
      <DismissButton onClick={dismiss} tone="text-ink hover:bg-alert-border/40" />
    </div>
  );
};
