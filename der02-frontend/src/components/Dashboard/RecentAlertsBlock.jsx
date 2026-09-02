import React from 'react';
import { AlertTriangle, Wind } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';
import { PRESETS } from '../../config/presets';
import { degreesToCompass } from '../../utils/compass';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * Block 4 -- what has actually happened, newest first.
 *
 * Backed ONLY by real detections. Two sources, both already in the store:
 *   incidentLog  every accepted recompute, with its own captured timestamp,
 *                config and trigger
 *   changeAlert  the shift figures from checkForSignificantChange, attached to
 *                the most recent wind-shift entry
 *
 * Nothing here is synthesised. There is no "tank pressure stable" line because
 * pressure is not modelled, so no such event exists to report.
 */

const MAX_ALERTS = 10;

const FIELD_LABELS = {
  substance: 'Substance',
  tank_volume_m3: 'Tank volume',
  tank_diameter_m: 'Tank diameter',
  wind_speed_kmh: 'Wind speed',
  wind_dir_deg: 'Wind direction',
  humidity_pct: 'Humidity',
};

const FIELD_UNITS = {
  tank_volume_m3: ' m³',
  tank_diameter_m: ' m',
  wind_speed_kmh: ' km/h',
  humidity_pct: '%',
};

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}

/** Which preset, if any, these exact values match -- for a nicer sub-line. */
function presetLabel(config) {
  const key = Object.keys(PRESETS).find((k) =>
    ['substance', 'tank_volume_m3', 'tank_diameter_m', 'wind_speed_kmh', 'wind_dir_deg', 'humidity_pct'].every(
      (field) => PRESETS[k][field] === config[field]
    )
  );
  return key ? PRESETS[key].label : null;
}

/** What changed between two logged configurations, in plain language. */
function describeChange(entry, previous) {
  // The first entry has nothing to diff against -- name the configuration it
  // captured rather than calling every session-opening change "initial".
  if (!previous) {
    const first = presetLabel(entry.config);
    return first
      ? `Baseline captured: ${first}.`
      : 'Baseline configuration captured.';
  }

  const changed = Object.keys(FIELD_LABELS).filter(
    (field) => entry.config[field] !== previous.config[field]
  );
  if (changed.length === 0) return 'Recomputed with unchanged inputs.';

  // A whole-scenario switch reads better as one sentence than six deltas.
  const label = presetLabel(entry.config);
  if (changed.length > 2 && label) return `Preset switched to ${label}.`;

  return `${changed
    .map((field) => {
      const value = entry.config[field];
      if (field === 'wind_dir_deg') {
        return `Wind direction changed to ${value}° (${degreesToCompass(value)})`;
      }
      return `${FIELD_LABELS[field]} changed to ${value}${FIELD_UNITS[field] ?? ''}`;
    })
    .join(', ')}.`;
}

const RecentAlertsBlock = () => {
  const incidentLog = useFacilityStore((s) => s.incidentLog);
  const changeAlert = useFacilityStore((s) => s.changeAlert);

  // The block is always present -- one of the four -- so an empty log gets an
  // empty state rather than a missing card. Nothing is invented to fill it.
  if (!incidentLog.length) {
    return (
      <Card>
        <SectionLabel>Recent alerts</SectionLabel>
        <p className="mt-3 text-body text-subtle">
          No changes detected yet. Alerts appear here when the configuration
          changes or the recommended approach shifts significantly.
        </p>
      </Card>
    );
  }

  // Newest first, capped. Each entry keeps its predecessor for the diff.
  const newestWindShift = incidentLog.reduce(
    (found, entry, i) => (entry.trigger === 'wind_shift' ? i : found),
    -1
  );

  const alerts = incidentLog
    .map((entry, i) => ({ entry, previous: incidentLog[i - 1], index: i }))
    .slice(-MAX_ALERTS)
    .reverse();

  return (
    <Card>
      <SectionLabel>Recent alerts</SectionLabel>

      <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {alerts.map(({ entry, previous, index }) => {
          const isShift = entry.trigger === 'wind_shift';
          // The measured shift figures belong to the alert that fired them.
          const shift =
            isShift && index === newestWindShift && changeAlert
              ? [
                  changeAlert.bearingShift >= 1 &&
                    `Approach bearing moved ${changeAlert.bearingShift}°`,
                  changeAlert.standoffShift >= 1 &&
                    `standoff by ${changeAlert.standoffShift} m`,
                ]
                  .filter(Boolean)
                  .join(', ')
              : null;

          return (
            <li
              key={entry.timestamp + '-' + index}
              className="flex gap-3 border-b border-line py-2 last:border-b-0"
            >
              {isShift ? (
                <Wind
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-alert"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-subtle"
                  aria-hidden="true"
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-body font-medium text-ink">
                    {isShift ? 'Wind Shift Detected' : 'Configuration Updated'}
                  </p>
                  <span className="flex-shrink-0 text-meta text-subtle tnum">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                <p className="mt-0.5 text-meta leading-relaxed text-subtle">
                  {describeChange(entry, previous)}
                  {shift && <span className="block text-ink">{shift}.</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

export default RecentAlertsBlock;
