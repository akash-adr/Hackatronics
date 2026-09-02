import React from 'react';
import { Flame } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';

/**
 * Cross-facility exposure warning: one facility's thermal zone reaches the
 * other's location, i.e. a credible escalation path between the two tanks.
 *
 * Deliberately distinguishable from BOTH neighbours on this screen:
 *  - the hazard ramp (red / orange / yellow fills) means "this is the zone";
 *  - Module 5's "zone has shifted" banner is a full-bleed amber strip with a
 *    warning triangle.
 * This one is an inset card with a thick left rule and a flame icon, so it
 * reads as a distinct, second kind of statement rather than a duplicate of
 * either -- amber-toned for attention without competing with the fill colours.
 */
const CrossExposureBanner = () => {
  const dualZoneData = useFacilityStore((s) => s.dualZoneData);
  const exposures = dualZoneData?.cross_facility_exposure;

  if (!exposures?.length) return null;

  return (
    <div
      role="alert"
      className="mx-4 mb-1 flex flex-shrink-0 items-start gap-3 rounded-card border border-amber-400/60 border-l-4 border-l-amber-500 bg-amber-50 px-4 py-2.5 dark:border-amber-500/40 dark:border-l-amber-500 dark:bg-amber-500/10"
    >
      <Flame className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />

      <div className="min-w-0">
        <p className="text-body font-semibold text-ink">
          Cross-facility exposure detected
        </p>
        <ul className="mt-1 space-y-0.5">
          {exposures.map((e) => (
            <li
              key={`${e.source_facility}-${e.exposed_facility}-${e.band_label}`}
              className="text-meta text-subtle"
            >
              Facility {e.source_facility}&apos;s{' '}
              <span className="font-medium text-ink">{e.band_label}</span>{' '}
              thermal band reaches Facility {e.exposed_facility}, which sits{' '}
              <span className="tnum">{e.distance_m} m</span> away — escalation
              between the two tanks is credible.
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CrossExposureBanner;
