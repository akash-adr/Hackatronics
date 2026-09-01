import React from 'react';
import { Plus, X } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';
import { FACILITY_CENTER } from '../../config/presets';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * Facility B's OWN configuration panel.
 *
 * Every control here writes to secondFacilityConfig only, and every change
 * triggers recomputeDual() on the same 120 ms debounce the primary panel uses.
 * Facility A's config is never touched from this panel, which is what makes
 * B's zone move independently of A's on the map.
 */

// ~540 m east of the primary facility: far enough to read as a separate site,
// close enough that the two zones share a viewport at the default zoom.
const DEFAULT_OFFSET_LNG = 0.005;

const inputClass =
  'w-full rounded-card border border-line bg-surface px-3 py-2 text-body text-ink ' +
  'transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

const Field = ({ label, hint, children }) => (
  <div className="mt-4 first:mt-0">
    <div className="flex items-baseline justify-between gap-2">
      <label className="text-body font-medium text-ink">{label}</label>
      {hint && <span className="text-meta text-subtle tnum">{hint}</span>}
    </div>
    <div className="mt-2">{children}</div>
  </div>
);

const SecondFacilityPanel = () => {
  const schema = useFacilityStore((s) => s.schema);
  const config = useFacilityStore((s) => s.config);
  const enabled = useFacilityStore((s) => s.secondFacilityEnabled);
  const secondConfig = useFacilityStore((s) => s.secondFacilityConfig);
  const dualZoneData = useFacilityStore((s) => s.dualZoneData);
  const enableSecondFacility = useFacilityStore((s) => s.enableSecondFacility);
  const disableSecondFacility = useFacilityStore((s) => s.disableSecondFacility);
  const setSecondFacilityField = useFacilityStore((s) => s.setSecondFacilityField);

  // Facility B starts as a copy of A at a different location. Starting from
  // identical parameters is what makes the independence obvious: change one
  // control here and only B's zone moves.
  const handleEnable = () =>
    enableSecondFacility({
      substance: config.substance,
      tank_volume_m3: config.tank_volume_m3,
      tank_diameter_m: config.tank_diameter_m,
      lat: FACILITY_CENTER.lat,
      lng: FACILITY_CENTER.lng + DEFAULT_OFFSET_LNG,
    });

  if (!enabled || !secondConfig) {
    return (
      <Card>
        <SectionLabel>Second facility</SectionLabel>
        <p className="mt-3 text-meta text-subtle">
          Add a second storage facility to see both hazard footprints and a
          joint approach corridor that clears them together.
        </p>
        <button
          type="button"
          onClick={handleEnable}
          disabled={!schema}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-card border border-line bg-surface px-3 py-2 text-body font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add second facility
        </button>
      </Card>
    );
  }

  const { bounds, substances } = schema;
  const joint = dualZoneData?.joint_safe_approach;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Facility B</SectionLabel>
        <button
          type="button"
          onClick={disableSecondFacility}
          title="Remove facility B"
          aria-label="Remove facility B"
          className="rounded p-1 text-subtle transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4">
        {/* B's OWN substance -- independent of facility A's. */}
        <Field label="Substance">
          <select
            aria-label="Facility B substance"
            className={inputClass}
            value={secondConfig.substance}
            onChange={(e) => setSecondFacilityField('substance', e.target.value)}
          >
            {substances.map((s) => (
              <option key={s.key} value={s.key}>
                {s.display_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tank volume" hint="m³">
          <input
            type="number"
            className={`${inputClass} tnum`}
            // Strictly positive, same exclusive-min rule as the primary panel.
            aria-label="Facility B tank volume"
            min={Math.max(bounds.tank_volume_m3.min, 0.1)}
            max={bounds.tank_volume_m3.max}
            value={secondConfig.tank_volume_m3}
            onChange={(e) => setSecondFacilityField('tank_volume_m3', e.target.value)}
          />
        </Field>

        <Field label="Tank diameter" hint="m">
          <input
            type="number"
            className={`${inputClass} tnum`}
            aria-label="Facility B tank diameter"
            min={Math.max(bounds.tank_diameter_m.min, 0.1)}
            max={bounds.tank_diameter_m.max}
            value={secondConfig.tank_diameter_m}
            onChange={(e) => setSecondFacilityField('tank_diameter_m', e.target.value)}
          />
        </Field>

        <Field label="Location" hint="lat, lon">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.0005"
              aria-label="Facility B latitude"
              className={`${inputClass} tnum`}
              value={secondConfig.lat}
              onChange={(e) => setSecondFacilityField('lat', e.target.value)}
            />
            <input
              type="number"
              step="0.0005"
              aria-label="Facility B longitude"
              className={`${inputClass} tnum`}
              value={secondConfig.lng}
              onChange={(e) => setSecondFacilityField('lng', e.target.value)}
            />
          </div>
        </Field>

        {/* Weather is shared: one wind field blows over both sites. */}
        <p className="mt-4 text-meta text-subtle">
          Wind and humidity are shared with facility A — a single weather
          condition covers both sites.
        </p>

        {joint && (
          <div className="mt-4 rounded-card border border-line bg-surface-muted px-3 py-2">
            <p className="text-meta text-subtle">Joint approach</p>
            <p className="mt-0.5 text-body font-medium text-ink tnum">
              {joint.best_bearing_deg}° · {joint.min_standoff_m} m standoff
            </p>
          </div>
        )}

        {dualZoneData?.joint_analysis_note && (
          <p className="mt-3 text-meta text-subtle">
            {dualZoneData.joint_analysis_note}
          </p>
        )}
      </div>
    </Card>
  );
};

export default SecondFacilityPanel;
