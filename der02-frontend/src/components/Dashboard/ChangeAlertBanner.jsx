import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';

/**
 * "Zone has shifted" banner.
 *
 * Never auto-dismisses. An alert that vanishes on a timer reintroduces the
 * exact failure this feature exists to prevent -- a viewer missing that the
 * recommendation moved. It stays until explicitly acknowledged.
 *
 * Only one banner ever exists: a further significant change before dismissal
 * replaces its contents rather than stacking a second one.
 */
const ChangeAlertBanner = () => {
  const changeAlert = useFacilityStore((s) => s.changeAlert);
  const dismissAlert = useFacilityStore((s) => s.dismissAlert);

  if (!changeAlert) return null;

  const parts = [];
  if (changeAlert.bearingShift >= 1) {
    parts.push(`bearing moved ${changeAlert.bearingShift}°`);
  }
  if (changeAlert.standoffShift >= 1) {
    parts.push(`standoff by ${changeAlert.standoffShift} m`);
  }
  const detail = parts.join(', ');

  return (
    <div
      role="alert"
      className="flex flex-shrink-0 items-center gap-3 border-b border-alert-border bg-alert-surface px-6 py-2.5"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-alert" aria-hidden="true" />

      <p className="text-body font-semibold text-ink">
        Zone has shifted — re-evaluate approach
      </p>

      {/* Only report the components that actually moved. Rotating the wind
          shifts the bearing without changing the standoff, and reading
          "standoff by 0 m" invites a second look at a number that did not
          change. */}
      {detail && <p className="text-meta text-ink/70 tnum">{detail}</p>}

      <button
        type="button"
        onClick={dismissAlert}
        className="ml-auto flex items-center gap-1.5 rounded-card border border-alert-border px-2.5 py-1 text-meta font-medium text-ink transition-colors hover:bg-alert-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Acknowledge
      </button>
    </div>
  );
};

export default ChangeAlertBanner;
