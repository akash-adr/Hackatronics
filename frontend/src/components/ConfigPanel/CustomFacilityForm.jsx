import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';

/**
 * Every control's min/max comes from the backend schema, never from a literal
 * in this file. If the backend widens a bound, this panel follows on the next
 * load with no frontend edit.
 *
 * Sliders pass immediate:false so a drag is debounced into one request;
 * the dropdown and numeric inputs commit straight away.
 */

const Field = ({ label, hint, children }) => (
  <div className="mt-4 first:mt-0">
    <div className="flex items-baseline justify-between gap-2">
      <label className="text-body font-medium text-ink">{label}</label>
      {hint && <span className="text-meta text-subtle tnum">{hint}</span>}
    </div>
    <div className="mt-2">{children}</div>
  </div>
);

const inputClass =
  'w-full rounded-card border border-line bg-surface px-3 py-2 text-body text-ink ' +
  'transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ' +
  'disabled:bg-surface-muted disabled:text-subtle';

// The range is stated once, with its unit, beneath the track. Flanking the
// slider with bare "0" and "200" would put unlabelled numbers on screen, and
// every figure on this dashboard carries its unit.
const Slider = ({ value, bound, onChange, unit, step = 1 }) => (
  <div>
    <input
      type="range"
      className="der-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-line"
      min={bound.min}
      max={bound.max}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    <p className="mt-1.5 text-right text-meta text-subtle tnum">
      {bound.min}–{bound.max} {unit}
    </p>
  </div>
);

const CustomFacilityForm = () => {
  const schema = useFacilityStore((s) => s.schema);
  const config = useFacilityStore((s) => s.config);
  const setField = useFacilityStore((s) => s.setField);

  if (!schema) {
    return (
      <p className="text-body text-subtle">Loading configuration schema…</p>
    );
  }

  const { bounds, substances } = schema;

  return (
    <div>
      <Field label="Substance">
        <select
          className={inputClass}
          value={config.substance}
          onChange={(e) => setField('substance', e.target.value)}
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
          // Strictly positive: see EXCLUSIVE_MIN_FIELDS in the store.
          min={Math.max(bounds.tank_volume_m3.min, 0.1)}
          max={bounds.tank_volume_m3.max}
          value={config.tank_volume_m3}
          onChange={(e) => setField('tank_volume_m3', e.target.value)}
        />
      </Field>

      <Field label="Tank diameter" hint="m">
        <input
          type="number"
          className={`${inputClass} tnum`}
          min={Math.max(bounds.tank_diameter_m.min, 0.1)}
          max={bounds.tank_diameter_m.max}
          value={config.tank_diameter_m}
          onChange={(e) => setField('tank_diameter_m', e.target.value)}
        />
      </Field>

      <Field
        label="Wind speed"
        hint={`${config.wind_speed_kmh} km/h`}
      >
        <Slider
          value={config.wind_speed_kmh}
          bound={bounds.wind_speed_kmh}
          unit="km/h"
          onChange={(v) => setField('wind_speed_kmh', v, { immediate: false })}
        />
      </Field>

      <Field label="Wind direction" hint={`${config.wind_dir_deg}° from`}>
        <Slider
          value={config.wind_dir_deg}
          bound={bounds.wind_dir_deg}
          unit="°"
          step={5}
          onChange={(v) => setField('wind_dir_deg', v, { immediate: false })}
        />
      </Field>

      <Field label="Humidity" hint={`${config.humidity_pct}%`}>
        <Slider
          value={config.humidity_pct}
          bound={bounds.humidity_pct}
          unit="%"
          onChange={(v) => setField('humidity_pct', v, { immediate: false })}
        />
      </Field>
    </div>
  );
};

export default CustomFacilityForm;
