// Design tokens for consumers that cannot use Tailwind classes.
// Leaflet paths take raw hex, so the map and the legend both read their
// colours from here -- defined once, so they cannot drift apart.
import tailwindConfig from "../tailwind.config.js";

export const viewport = tailwindConfig.theme.extend.colors.viewport;

// ---------------------------------------------------------------------------
// Hazard severity palette -- THE single source of truth.
// Keyed by the band labels the API actually returns, for both hazard types.
// ---------------------------------------------------------------------------
export const SEVERITY_COLORS = {
  // thermal
  fatal: "#a32d2d", // dark red
  serious: "#993c1d", // orange-red
  pain: "#854f0b", // amber
  // blast -- same three tiers, same colours, so severity reads consistently
  // across hazard types
  structural: "#993c1d",
  glass_breakage: "#854f0b",
};

// Reserved EXCLUSIVELY for the safe-approach corridor. This value must never
// appear in SEVERITY_COLORS, so green can only ever mean "safe".
export const SAFE_APPROACH_COLOR = "#22C55E";

export const SEVERITY_LABELS = {
  fatal: "Fatal",
  serious: "Serious",
  pain: "Pain threshold",
  structural: "Structural damage",
  glass_breakage: "Glass breakage",
};

/** Colour for a band, falling back to amber for any unexpected label. */
export function severityColor(label) {
  return SEVERITY_COLORS[label] ?? SEVERITY_COLORS.pain;
}

/** Human-readable name for a band label. */
export function severityLabel(label) {
  return SEVERITY_LABELS[label] ?? label;
}

/**
 * Threshold with units, matching the tooltip text on the map.
 * Thermal bands carry threshold_kw_m2; blast bands carry threshold_psi.
 */
export function bandThresholdText(band) {
  if (band.threshold_kw_m2 !== undefined) {
    return `${band.threshold_kw_m2} kW/m²`;
  }
  return `${band.threshold_psi} psi`;
}

/**
 * The radius field differs by hazard type: Module 1 names the thermal one
 * radius_no_wind_m and the blast one radius_m.
 */
export function bandRadius(band) {
  return band.radius_no_wind_m ?? band.radius_m;
}
