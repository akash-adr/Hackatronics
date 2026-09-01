import { create } from 'zustand';
import { fetchComputeZone, fetchConfigSchema } from '../api/zones';
import { CACHED_FALLBACK_RESULTS } from '../data/fallbackResults';
import { angleDiff } from '../utils/compass';
import {
  CONFIG_FIELDS,
  FACILITY_CENTER,
  PRESETS,
  matchingPreset,
  presetConfig,
} from '../config/presets';

// Wait this long after the last slider movement before firing a request.
// Short enough to feel live, long enough that a drag sends one request
// instead of dozens.
const SLIDER_DEBOUNCE_MS = 120;

// ---------------------------------------------------------------------------
// Race handling.
//
// Every recompute takes the next id from this counter. When a response comes
// back, it is applied ONLY if its id is still the most recent one issued.
// Clicking A then B then A lands on A's data even if the responses return out
// of order, because the two earlier replies are discarded on arrival.
// ---------------------------------------------------------------------------
let requestCounter = 0;
let latestRequestId = 0;
let debounceTimer = null;

// initialize() is idempotent. React StrictMode invokes mount effects twice
// in development, and without this guard the startup pre-compute would
// fire two schema fetches and four compute requests instead of one and two.
let initializeStarted = false;

// Fields the backend validates with a STRICT lower bound (0 < x, because a
// tank with no volume or no diameter is not a scenario). The schema's
// {min, max} shape cannot express that, so clamping naively to bound.min
// yields exactly 0 and the backend answers 400. This set mirrors that one
// backend semantic so the panel never sends a value it knows is invalid.
//
// REMOVE THIS once GET /api/facility-config-schema advertises exclusive_min
// per field -- at which point the exclusivity comes from the schema like
// every other bound, and this local copy stops being a second source of truth.
const EXCLUSIVE_MIN_FIELDS = new Set(['tank_volume_m3', 'tank_diameter_m']);

// Smallest value offered for those fields: 0.1 m3 and 0.1 m are both far
// below any real facility while remaining strictly positive.
const EXCLUSIVE_MIN_FLOOR = 0.1;

/** Cyclic wrap for bearings; clamp for every other field. */
function coerceField(field, value, bounds) {
  if (Number.isNaN(value)) return value;

  if (field === 'wind_dir_deg') {
    // A bearing is cyclic, so out-of-range values wrap rather than clamp:
    // 370 becomes 10 and -30 becomes 330, matching the backend's own
    // normalize_wind_dir(). 360 is folded onto 0, the same bearing.
    return ((value % 360) + 360) % 360;
  }

  const bound = bounds?.[field];
  if (!bound) return value;

  // Every non-cyclic field clamps into range, consistently. The panel never
  // sends a value the backend would reject.
  const lowerBound = EXCLUSIVE_MIN_FIELDS.has(field)
    ? Math.max(bound.min, EXCLUSIVE_MIN_FLOOR)
    : bound.min;

  return Math.min(Math.max(value, lowerBound), bound.max);
}

// ---------------------------------------------------------------------------
// "What changed" detection.
//
// A dashboard that silently revises its safe-approach recommendation lets a
// viewer's mental model go stale without them noticing. This watches for a
// change big enough to be worth re-reading the map for.
//
// THRESHOLDS: 15 degrees of bearing shift and a 20% shift in standoff are
// reasonable starting values chosen to separate a genuinely meaningful
// operational change from routine minor fluctuation. They are NOT rigorously
// derived -- tune them if the banner fires too often or too rarely in
// rehearsal.
// ---------------------------------------------------------------------------
const SIGNIFICANT_BEARING_SHIFT_DEG = 15;
const SIGNIFICANT_STANDOFF_SHIFT_PCT = 0.2;

// The recommendation the user has actually seen and (implicitly) absorbed.
// Only updated when a change is significant enough to announce, so a series
// of small drifts still trips the alert once it accumulates past a threshold.
let lastDisplayedApproach = null;

function checkForSignificantChange(newSafeApproach) {
  if (newSafeApproach === null || newSafeApproach === undefined) {
    return { changed: false }; // no valid recommendation to compare against
  }

  if (lastDisplayedApproach === null) {
    // The first result establishes the baseline. Never fires on initial load.
    lastDisplayedApproach = newSafeApproach;
    return { changed: false };
  }

  // Shared wraparound rule, so 350 -> 10 reads as 20 degrees, not 340.
  const bearingShift = Math.abs(
    angleDiff(newSafeApproach.best_bearing_deg, lastDisplayedApproach.best_bearing_deg)
  );

  const standoffShift = Math.abs(
    newSafeApproach.min_standoff_m - lastDisplayedApproach.min_standoff_m
  );

  const significant =
    bearingShift > SIGNIFICANT_BEARING_SHIFT_DEG ||
    standoffShift / lastDisplayedApproach.min_standoff_m > SIGNIFICANT_STANDOFF_SHIFT_PCT;

  if (significant) {
    lastDisplayedApproach = newSafeApproach;
    return { changed: true, bearingShift, standoffShift };
  }

  return { changed: false };
}

function buildDescriptor(config, schema) {
  const substance = schema?.substances.find((s) => s.key === config.substance);
  return {
    lat: FACILITY_CENTER.lat,
    lng: FACILITY_CENTER.lng,
    substance: substance?.display_name ?? config.substance,
    volume_m3: config.tank_volume_m3,
    wind_speed_kmh: config.wind_speed_kmh,
    wind_dir_deg: config.wind_dir_deg,
  };
}

const useFacilityStore = create((set, get) => ({
  // --- schema (backend-owned bounds; never hardcoded here) ---
  schema: null,
  schemaError: null,

  // --- the single source of truth for the current scenario ---
  config: presetConfig('configA'),
  activePreset: 'configA',

  // --- results ---
  zoneData: null, // the response currently on screen
  results: { configA: null, configB: null }, // cached, for the comparison panel
  loading: false,
  error: null,

  // isLive is false from the moment a recompute is issued until its response
  // lands. It drives the status bar's LIVE / STALE badge, so a viewer can
  // always tell whether the numbers on screen match the current inputs.
  isLive: true,

  // Two DISTINCT failure states, because they mean different things.
  //
  // fallbackPreset: a live call failed but the active configuration is a
  // preset, so its cached answer was served instead. The demo is still
  // correct, just not live -- this gets a calm, muted notice.
  //
  // hardFailure: a live call failed for a hand-edited configuration, which
  // has no cached answer. Genuinely unrecoverable, and it looks like it.
  //
  // Neither auto-hides; both are dismissed explicitly, for the same reason
  // the what-changed alert is (a notice that vanishes can be missed).
  fallbackPreset: null,
  hardFailure: null,

  dismissFallbackNotice: () => set({ fallbackPreset: null }),
  dismissHardFailure: () => set({ hardFailure: null }),

  // Non-null while an unacknowledged significant change is outstanding. Only
  // ever replaced, never stacked: a second change before the first is
  // dismissed updates this object rather than adding another banner.
  changeAlert: null,

  /** Explicit user acknowledgement -- the banner never self-dismisses. */
  dismissAlert: () => set({ changeAlert: null }),

  // Derived descriptor the map marker and panels read. Held in state and
  // rebuilt on every config change rather than computed in a selector: a
  // selector returning a fresh object would fail zustand's identity check and
  // re-render forever.
  facilityConfig: buildDescriptor(presetConfig('configA'), null),

  /** Load bounds + substance list from the backend. */
  loadSchema: async () => {
    try {
      const schema = await fetchConfigSchema();
      set((state) => ({
        schema,
        schemaError: null,
        facilityConfig: buildDescriptor(state.config, schema),
      }));
      return schema;
    } catch (err) {
      set({ schemaError: err.message });
      return null;
    }
  },

  /**
   * Fire a recompute for the current config.
   * Only the most recently issued request is allowed to update the store.
   */
  recompute: async () => {
    const { config } = get();
    const id = ++requestCounter;
    latestRequestId = id;

    // Displayed data no longer reflects the current inputs until this lands.
    set({ loading: true, isLive: false, error: null });

    // Captured before the await: the preset the user is looking at now is the
    // one whose cached answer is valid if this call fails.
    const presetAtRequestTime = get().activePreset;

    let data;
    let servedFromCache = false;

    try {
      data = await fetchComputeZone({
        ...config,
        hazard_type: 'both',
        center_lat: FACILITY_CENTER.lat,
        center_lon: FACILITY_CENTER.lng,
      });
    } catch (err) {
      // A superseded request failing is not news -- stay silent and let the
      // newer one own the outcome.
      if (id !== latestRequestId) return;

      console.warn('Live compute failed, falling back:', err);

      const cached =
        presetAtRequestTime && CACHED_FALLBACK_RESULTS[presetAtRequestTime];

      if (!cached) {
        // No cached answer for a hand-edited configuration. This is the one
        // genuinely unrecoverable case: fail visibly rather than pretending.
        set({
          loading: false,
          isLive: false,
          error: err.message,
          hardFailure:
            'Connection issue — unable to compute this configuration right now. Try a preset or check your connection.',
        });
        return;
      }

      data = cached;
      servedFromCache = true;
    }

    // Stale response from a superseded click: drop it silently.
    if (id !== latestRequestId) return;

    try {
      // Only the latest accepted response reaches this point, so the check
      // never runs against a superseded result.
      const change = checkForSignificantChange(data.safe_approach);

      const preset = get().activePreset;
      set((state) => ({
        zoneData: data,
        loading: false,
        // Cached data is real and correct, but it is not live.
        isLive: !servedFromCache,
        hardFailure: null,
        fallbackPreset: servedFromCache ? presetAtRequestTime : null,
        // Replace rather than stack; keep any existing unacknowledged alert.
        changeAlert: change.changed
          ? {
              bearingShift: Math.round(change.bearingShift),
              standoffShift: Math.round(change.standoffShift),
            }
          : state.changeAlert,
        // Cache by preset so the comparison panel always has both sides.
        results: preset
          ? { ...state.results, [preset]: data }
          : state.results,
      }));
    } catch (err) {
      // Reached only if processing an already-received response throws.
      if (id !== latestRequestId) return;
      set({ loading: false, isLive: false, error: err.message });
    }
  },

  /**
   * Full overwrite of every field from the preset -- never a merge.
   * Re-clicking a preset after a manual edit must snap back to the original
   * values, so the previous config is discarded outright rather than spread.
   */
  loadPreset: (presetKey) => {
    if (!PRESETS[presetKey]) return;

    const config = presetConfig(presetKey);
    set((state) => ({
      config,
      activePreset: presetKey,
      facilityConfig: buildDescriptor(config, state.schema),
    }));

    // No apply button: the recompute is the click.
    const cached = get().results[presetKey];
    if (cached) {
      // Show the pre-computed result immediately, then refresh in the
      // background so the view is never blank while waiting.
      set({ zoneData: cached });
    }
    get().recompute();
  },

  /**
   * Update one field. `immediate` is false for sliders, which fire many
   * events per drag and are debounced; dropdowns and numeric inputs commit
   * straight away.
   */
  setField: (field, rawValue, { immediate = true } = {}) => {
    if (!CONFIG_FIELDS.includes(field)) return;

    const { schema } = get();
    const value =
      field === 'substance'
        ? rawValue
        : coerceField(field, Number(rawValue), schema?.bounds);

    const config = { ...get().config, [field]: value };

    // A manual edit may coincidentally land back on a preset's exact values,
    // in which case that preset is active again.
    set((state) => ({
      config,
      activePreset: matchingPreset(config),
      facilityConfig: buildDescriptor(config, state.schema),
    }));

    if (debounceTimer) clearTimeout(debounceTimer);

    if (immediate) {
      get().recompute();
    } else {
      debounceTimer = setTimeout(() => get().recompute(), SLIDER_DEBOUNCE_MS);
    }
  },

  /**
   * First mount: fetch the schema, then compute BOTH presets in the
   * background so the comparison panel has data for the config the user is
   * not currently looking at, with no extra request when they open it.
   */
  initialize: async () => {
    if (initializeStarted) return;
    initializeStarted = true;

    await get().loadSchema();

    set({ loading: true, isLive: false });
    try {
      const [resultA, resultB] = await Promise.all([
        fetchComputeZone({
          ...presetConfig('configA'),
          hazard_type: 'both',
          center_lat: FACILITY_CENTER.lat,
          center_lon: FACILITY_CENTER.lng,
        }),
        fetchComputeZone({
          ...presetConfig('configB'),
          hazard_type: 'both',
          center_lat: FACILITY_CENTER.lat,
          center_lon: FACILITY_CENTER.lng,
        }),
      ]);

      // Establish the baseline from the first result so the very first load
      // (and the first preset selection) can never raise an alert.
      checkForSignificantChange(resultA.safe_approach);

      // Only seed the view if the user has not already changed something.
      const untouched = latestRequestId === 0;
      set((state) => ({
        results: { configA: resultA, configB: resultB },
        zoneData: untouched ? resultA : state.zoneData,
        loading: false,
        isLive: true,
        fallbackPreset: null,
        hardFailure: null,
      }));
    } catch (err) {
      // Startup pre-compute failed: seed from the cached presets so the
      // dashboard opens fully populated rather than empty.
      console.warn('Startup pre-compute failed, seeding from cache:', err);
      checkForSignificantChange(CACHED_FALLBACK_RESULTS.configA.safe_approach);
      set({
        results: { ...CACHED_FALLBACK_RESULTS },
        zoneData: CACHED_FALLBACK_RESULTS.configA,
        loading: false,
        isLive: false,
        error: err.message,
        fallbackPreset: 'configA',
      });
    }
  },
}));

export default useFacilityStore;
