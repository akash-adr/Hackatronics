import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';

/**
 * Escalation status callout.
 *
 * Sits as a card on the map (bottom-right), deliberately NOT a full-width bar:
 * that shape is what distinguishes it from Module 5's "zone has shifted"
 * banner, which spans the top of the dashboard. Both mean "attention", so both
 * use the reserved alert amber -- the placement and the warning-triangle icon
 * are what tell them apart, rather than inventing a second warning colour that
 * would compete with the hazard ramp.
 *
 * NOTE: the on-map "Add Second Facility" trigger has been removed from the UI.
 * The feature itself is intact -- togglePlacementMode / placeSecondFacility in
 * the store, PlacementHandler in SecondFacilityLayer, and the backend
 * escalation endpoint are all untouched -- so this card still renders correctly
 * the moment a facility is placed by any future trigger. With no trigger
 * mounted, secondFacility stays null and the component renders nothing at all,
 * which is why the whole panel bails out below rather than leaving an empty
 * absolutely-positioned box on the map: that box would still be swallowing
 * clicks and drags in the bottom-right corner.
 */
const EscalationPanel = () => {
  const secondFacility = useFacilityStore((s) => s.secondFacility);
  const escalation = useFacilityStore((s) => s.escalation);
  const escalationError = useFacilityStore((s) => s.escalationError);
  const clearSecondFacility = useFacilityStore((s) => s.clearSecondFacility);

  // Nothing to say -> no element on the map at all.
  if (!secondFacility && !escalationError) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-[500] w-64">
      {/* Result card, shown once a facility is placed. */}
      {secondFacility && escalation && (
        <div
          className={`mb-2 rounded-card border px-3 py-2 shadow-overlay backdrop-blur-sm ${
            escalation.at_risk
              ? 'border-alert-border bg-alert-surface'
              : 'border-viewport-hairline bg-viewport-overlay'
          }`}
        >
          {escalation.at_risk ? (
            <div className="flex gap-2">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-alert"
                aria-hidden="true"
              />
              {/* Message text comes verbatim from the backend. */}
              <p className="text-meta leading-relaxed text-ink">
                {escalation.message}
              </p>
            </div>
          ) : (
            <p className="text-meta text-viewport-text-muted">
              Facility B is outside the primary facility&apos;s hazard zones.
            </p>
          )}
        </div>
      )}

      {/* Validation / network problems. No marker is placed in either case. */}
      {escalationError && (
        <div className="mb-2 rounded-card border border-viewport-hairline bg-viewport-overlay px-3 py-2 shadow-overlay backdrop-blur-sm">
          <p className="text-meta text-viewport-text">{escalationError}</p>
        </div>
      )}

      {/* Clearing stays available whenever a facility is actually placed. */}
      {secondFacility && (
        <button
          type="button"
          onClick={clearSecondFacility}
          className="flex w-full items-center justify-center gap-1.5 rounded-card border border-viewport-hairline bg-viewport-overlay px-3 py-1.5 text-meta font-medium text-viewport-text shadow-overlay backdrop-blur-sm transition-colors hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Remove Second Facility
        </button>
      )}
    </div>
  );
};

export default EscalationPanel;
