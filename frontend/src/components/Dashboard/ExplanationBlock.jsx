import React, { useState } from 'react';
import { Check } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';
import { PRESETS } from '../../config/presets';
import {
  ASSUMPTION_LIST,
  VALIDATION_STATEMENT,
  generateComparisonExplanation,
  generateShapeExplanation,
} from '../../utils/explainability';
import Card from '../ui/Card';
import SectionLabel from '../ui/SectionLabel';

/**
 * Block 3 -- Module 6's explainability content, always visible.
 *
 * The generators (generateShapeExplanation, generateComparisonExplanation),
 * the sources array and ASSUMPTION_LIST are all unchanged: this only restyles
 * their output from a collapsible drawer into a permanent block, with the
 * method and assumption lists compressed to checkmark lines so they fit.
 *
 * Every number still comes from the SAME zoneData that drew the map, via the
 * replay-aware selector -- no separate fetch, no local copy.
 */
const CheckLine = ({ children }) => (
  <li className="flex gap-2 text-meta leading-relaxed text-ink">
    <Check
      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-subtle"
      aria-hidden="true"
    />
    <span>{children}</span>
  </li>
);

const ExplanationBlock = () => {
  const zoneData = useFacilityStore((s) => s.getDisplayedZoneData());
  const results = useFacilityStore((s) => s.results);
  const activePreset = useFacilityStore((s) => s.activePreset);
  const [showReasoning, setShowReasoning] = useState(false);

  if (!zoneData) return null;

  const shapeSentence = generateShapeExplanation(zoneData);

  // Comparison needs both presets cached; omitted on hand-edited values.
  let comparisonSentence = null;
  if (activePreset) {
    const otherKey = activePreset === 'configA' ? 'configB' : 'configA';
    comparisonSentence = generateComparisonExplanation(
      results[activePreset],
      results[otherKey],
      PRESETS[activePreset].label,
      PRESETS[otherKey].label
    );
  }

  const sources = zoneData.sources ?? [];

  return (
    <Card>
      <SectionLabel>Explanation</SectionLabel>
      <h3 className="mt-3 text-section font-semibold text-ink">
        Why these zones?
      </h3>

      {shapeSentence ? (
        <p className="mt-2 max-w-prose text-body leading-relaxed text-ink">
          {shapeSentence}
        </p>
      ) : (
        <p className="mt-2 text-body text-subtle">
          No hazard bands available to describe.
        </p>
      )}

      {comparisonSentence && (
        <p className="mt-2 max-w-prose text-body leading-relaxed text-subtle">
          {comparisonSentence}
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-body font-medium text-ink">Models used</p>
          {sources.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {sources.map((source) => (
                <CheckLine key={source}>{source}</CheckLine>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-meta text-subtle">
              No methods reported yet.
            </p>
          )}
          <p className="mt-3 text-meta text-subtle">{VALIDATION_STATEMENT}</p>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-body font-medium text-ink">Assumptions</p>
            {/* Titles are always visible; only the reasoning is behind this. */}
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              className="text-meta font-medium text-accent hover:underline dark:text-indigo-400"
            >
              {showReasoning ? 'Hide reasoning' : 'Learn more'}
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {ASSUMPTION_LIST.map(({ assumption, reason }) => (
              <CheckLine key={assumption}>
                {assumption}
                {showReasoning && (
                  <span className="mt-0.5 block text-subtle">{reason}</span>
                )}
              </CheckLine>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default ExplanationBlock;
