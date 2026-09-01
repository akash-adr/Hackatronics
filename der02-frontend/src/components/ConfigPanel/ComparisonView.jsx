import React from 'react';
import useFacilityStore from '../../store/useFacilityStore';
import { PRESETS } from '../../config/presets';
import { getFatalRadius } from '../../utils/hazard';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * Compares the active configuration against the other one, using only the
 * results cached at startup -- this never triggers a fetch of its own.
 */
export function buildComparisonSentence(activeResult, otherResult) {
  const active = getFatalRadius(activeResult);
  const other = getFatalRadius(otherResult);

  if (!active || !other) return null;

  const ratio = active / other;
  return ratio > 1
    ? `This configuration's fatal-radius zone is approximately ${ratio.toFixed(1)}x larger than the alternative.`
    : `This configuration's fatal-radius zone is approximately ${(1 / ratio).toFixed(1)}x smaller than the alternative.`;
}

const ComparisonView = () => {
  const activePreset = useFacilityStore((s) => s.activePreset);
  const results = useFacilityStore((s) => s.results);

  if (!activePreset) {
    return (
      <Card tone="muted">
        <SectionLabel>Comparison</SectionLabel>
        <p className="mt-3 text-body text-subtle">
          Load Config A or Config B to compare the two scenarios.
        </p>
      </Card>
    );
  }

  const otherKey = activePreset === 'configA' ? 'configB' : 'configA';
  const sentence = buildComparisonSentence(results[activePreset], results[otherKey]);

  const activeRadius = getFatalRadius(results[activePreset]);
  const otherRadius = getFatalRadius(results[otherKey]);

  return (
    <Card tone="muted">
      <SectionLabel>Comparison</SectionLabel>

      {sentence ? (
        <p className="mt-3 text-body leading-relaxed text-ink">{sentence}</p>
      ) : (
        <p className="mt-3 text-body text-subtle">Computing both scenarios…</p>
      )}

      <div className="mt-4 flex flex-col divide-y divide-line border-t border-line">
        {[activePreset, otherKey].map((key) => {
          const radius = key === activePreset ? activeRadius : otherRadius;
          return (
            <div key={key} className="flex items-baseline justify-between py-2">
              <span className="text-meta text-subtle">
                {PRESETS[key].label}
                {key === activePreset && ' (active)'}
              </span>
              <span className="text-meta font-medium text-ink tnum">
                {radius !== null ? `${radius} m` : '—'}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-meta text-subtle">Fatal thermal radius, no wind</p>
    </Card>
  );
};

export default ComparisonView;
