// Two deliberately contrasting demo scenarios. These are content design, not
// dynamic data, so they live in frontend code by intent.
export const PRESETS = {
  configA: {
    label: 'Suburban LPG depot',
    narrative:
      'A small-scale, densely-populated-area scenario — the kind of facility with the least margin for error given nearby residents.',
    substance: 'propane',
    tank_volume_m3: 500,
    tank_diameter_m: 8,
    wind_speed_kmh: 12,
    wind_dir_deg: 90,
    humidity_pct: 55,
  },
  configB: {
    label: 'Industrial crude terminal',
    narrative:
      'A large-scale, high-energy industrial scenario under severe wind conditions.',
    substance: 'crude_oil',
    tank_volume_m3: 20000,
    tank_diameter_m: 35,
    wind_speed_kmh: 45,
    wind_dir_deg: 315,
    humidity_pct: 40,
  },
};

export const PRESET_KEYS = Object.keys(PRESETS);

// The scenario fields that make up a facility configuration. Presets carry
// label/narrative alongside these, which are display-only and never sent.
export const CONFIG_FIELDS = [
  'substance',
  'tank_volume_m3',
  'tank_diameter_m',
  'wind_speed_kmh',
  'wind_dir_deg',
  'humidity_pct',
];

// Presets describe the facility, not its location, so the map centre is fixed
// for both. Keeping it constant is also what makes the comparison meaningful:
// only the facility parameters differ between the two configurations.
export const FACILITY_CENTER = { lat: 13.0827, lng: 80.2707 };

/** Just the scenario fields, stripped of label/narrative. */
export function presetConfig(presetKey) {
  const preset = PRESETS[presetKey];
  return CONFIG_FIELDS.reduce((acc, field) => {
    acc[field] = preset[field];
    return acc;
  }, {});
}

/** Which preset these values match exactly, or null after a manual edit. */
export function matchingPreset(config) {
  return (
    PRESET_KEYS.find((key) => {
      const preset = PRESETS[key];
      return CONFIG_FIELDS.every((field) => config[field] === preset[field]);
    }) ?? null
  );
}
