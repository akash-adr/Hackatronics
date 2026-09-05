// Design tokens for consumers that cannot use Tailwind classes.
// Leaflet paths take raw hex, so the map and the legend both read their
// colours from here -- defined once, so they cannot drift apart.
import tailwindConfig from "../tailwind.config.js";

export const viewport = tailwindConfig.theme.extend.colors.viewport;

// ---------------------------------------------------------------------------
// Hazard severity palette -- THE single source of truth.
// Keyed by the band labels the API actually returns, for both hazard types.
// ---------------------------------------------------------------------------
// Vivid, saturated severity colours. The earlier muted set (#a32d2d /
// #993c1d / #854f0b) is dark brown-red through brown-amber: at 55% fill over
// satellite photography those read as a faint tint rather than a solid
// coloured region, which is why the outer bands looked like outlines even
// though they were correctly filled. These read as red / orange / yellow, as
// the severity ramp is meant to.
export const SEVERITY_COLORS = {
  // thermal
  fatal: "#EF4444", // red
  serious: "#F97316", // orange
  pain: "#FACC15", // yellow
  // blast -- same three tiers, same colours, so severity reads consistently
  // across hazard types
  structural: "#F97316",
  glass_breakage: "#FACC15",
};

// Reserved EXCLUSIVELY for the safe-approach corridor. This value must never
// appear in SEVERITY_COLORS, so green can only ever mean "safe".
export const SAFE_APPROACH_COLOR = "#22C55E";

// Short, plain-language consequence for each band. These restate the
// physical meaning already in Module 3's threshold table -- no new numbers,
// just a punchier phrasing for the legend.
export const SEVERITY_CONSEQUENCE = {
  fatal: 'Lethal in 60s',
  serious: '2nd degree burns',
  pain: 'Pain in 20s',
  structural: 'Severe damage',
  glass_breakage: 'Glass breakage',
};

/** Blast "fatal" means structural collapse, not a burn -- distinct wording. */
export const BLAST_CONSEQUENCE = {
  fatal: 'Severe structural damage',
  structural: 'Glass breakage / injury',
  glass_breakage: 'Minor damage',
};

export function bandConsequence(label, hazardType) {
  if (hazardType === 'blast') {
    return BLAST_CONSEQUENCE[label] ?? SEVERITY_CONSEQUENCE[label] ?? '';
  }
  return SEVERITY_CONSEQUENCE[label] ?? '';
}

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
