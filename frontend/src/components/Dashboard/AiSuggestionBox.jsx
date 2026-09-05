import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';
import { fetchAiSuggestion } from '../../api/zones';
import { getFatalRadius, getThreatLevel } from '../../utils/hazard';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * AI Insight -- a short operational suggestion for the CURRENT scenario.
 *
 * Reads the same replay-aware selectors every other panel uses
 * (getDisplayedConfig / getDisplayedZoneData), so while the timeline is being
 * scrubbed the advice describes the moment on screen rather than the live one.
 *
 * The request is debounced well past the main compute debounce: this proxies a
 * metered external model, so it fires on a settled scenario, never on a
 * keystroke or a slider tick. There is no polling and no auto-refresh -- a
 * request happens only in response to a user-driven change.
 */

// Long enough that a slider drag settles first; the main compute uses 120 ms.
const AI_DEBOUNCE_MS = 700;

// Backend fallbacks are sentences, not errors -- shown calmly, as-is.
const NETWORK_FALLBACK =
  'AI suggestion unavailable — could not reach the suggestion service.';

const AiSuggestionBox = () => {
  const config = useFacilityStore((s) => s.getDisplayedConfig());
  const zoneData = useFacilityStore((s) => s.getDisplayedZoneData());

  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);

  // Discards a slow response that a newer request has already superseded --
  // the same request-sequence rule the compute pipeline uses.
  const requestIdRef = useRef(0);

  // Only these values change the advice. Deriving a primitive key keeps the
  // effect from re-firing on every unrelated store update.
  const threatLevel = zoneData ? getThreatLevel(zoneData) : null;
  const fatalRadius = getFatalRadius(zoneData);
  const bearing = zoneData?.safe_approach?.best_bearing_deg ?? null;
  const standoff = zoneData?.safe_approach?.min_standoff_m ?? null;

  const scenarioKey = config
    ? [
        config.substance,
        config.tank_volume_m3,
        config.tank_diameter_m,
        config.wind_speed_kmh,
        config.wind_dir_deg,
        config.humidity_pct,
        threatLevel,
        fatalRadius,
        bearing,
        standoff,
      ].join('|')
    : null;

  useEffect(() => {
    if (!config || !zoneData || !threatLevel) return;

    const timer = setTimeout(async () => {
      // The spinner starts when the REQUEST does, not when the timer is
      // scheduled. Setting it at schedule time left the box stuck loading
      // forever whenever an effect run was superseded before its timer fired
      // -- the run that set the flag was never the run that cleared it.
      const id = ++requestIdRef.current;
      setLoading(true);
      try {
        const data = await fetchAiSuggestion({
          substance: config.substance,
          tank_volume_m3: config.tank_volume_m3,
          tank_diameter_m: config.tank_diameter_m,
          wind_speed_kmh: config.wind_speed_kmh,
          wind_dir_deg: config.wind_dir_deg,
          humidity_pct: config.humidity_pct,
          threat_level: threatLevel,
          fatal_radius_m: fatalRadius,
          safe_approach_bearing_deg: bearing,
          safe_approach_standoff_m: standoff,
        });
        if (id !== requestIdRef.current) return; // superseded
        setSuggestion(data.suggestion);
      } catch {
        if (id !== requestIdRef.current) return;
        // Backend unreachable or rate-limited. Stated plainly -- this panel is
        // advisory, and a failure here must never read as a hazard warning.
        setSuggestion(NETWORK_FALLBACK);
      } finally {
        if (id === requestIdRef.current) setLoading(false);
      }
    }, AI_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioKey]);

  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
        <SectionLabel>AI insight</SectionLabel>
      </div>

      <div className="mt-3 flex-1">
        {loading || !suggestion ? (
          // Skeleton rather than a spinner: it occupies the space the text
          // will, so the block does not jump when the answer arrives.
          <div className="space-y-2" aria-live="polite" aria-busy="true">
            <div className="h-3.5 w-full animate-pulse rounded bg-line" />
            <div className="h-3.5 w-11/12 animate-pulse rounded bg-line" />
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-line" />
            <span className="sr-only">Generating suggestion…</span>
          </div>
        ) : (
          <p className="max-w-prose text-body leading-relaxed text-ink">
            {suggestion}
          </p>
        )}
      </div>

      <p className="mt-4 text-meta text-subtle">
        Powered by Gemini · advisory only, not a substitute for the computed
        figures above
      </p>
    </Card>
  );
};

export default AiSuggestionBox;
