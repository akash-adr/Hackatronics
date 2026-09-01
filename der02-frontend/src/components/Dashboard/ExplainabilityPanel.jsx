import React, { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import useFacilityStore from '../../store/useFacilityStore';
import { PRESETS } from '../../config/presets';
import {
  generateComparisonExplanation,
  generateShapeExplanation,
} from '../../utils/explainability';
import FormulaDisclosure from './FormulaDisclosure';
import AssumptionList from './AssumptionList';
import SectionLabel from '../ui/SectionLabel';

/**
 * "Why this shape?" -- the one deliberately collapsed thing on the dashboard.
 *
 * Every number shown here is read from the SAME zoneData object in the central
 * store that drew the map, the right panel and the summary strip. There is no
 * separate fetch and no local copy, so the explanation cannot describe a
 * different moment in time than the shape it explains.
 */
const Section = ({ title, children }) => (
  <div>
    <SectionLabel>{title}</SectionLabel>
    <div className="mt-3">{children}</div>
  </div>
);

const ExplainabilityPanel = () => {
  const zoneData = useFacilityStore((s) => s.getDisplayedZoneData());
  const results = useFacilityStore((s) => s.results);
  const activePreset = useFacilityStore((s) => s.activePreset);
  const [expanded, setExpanded] = useState(false);

  // Nothing to explain until at least one computation has landed. The trigger
  // stays disabled rather than opening an empty panel.
  const hasData = zoneData !== null && zoneData !== undefined;

  const shapeSentence = hasData ? generateShapeExplanation(zoneData) : null;

  // Comparison needs both presets cached. On custom/live-edited values there
  // is no "other" preset to compare against, so it is simply omitted.
  let comparisonSentence = null;
  if (hasData && activePreset) {
    const otherKey = activePreset === 'configA' ? 'configB' : 'configA';
    comparisonSentence = generateComparisonExplanation(
      results[activePreset],
      results[otherKey],
      PRESETS[activePreset].label,
      PRESETS[otherKey].label
    );
  }

  return (
    <section className="flex-shrink-0 border-t border-line bg-surface-muted">
      <button
        type="button"
        onClick={() => hasData && setExpanded(!expanded)}
        disabled={!hasData}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-6 py-2.5 text-left transition-colors hover:bg-line/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
      >
        <div className="flex items-baseline gap-3">
          <span className="text-body font-semibold text-ink">
            Why this shape?
          </span>
          <span className="text-meta text-subtle">
            {hasData
              ? 'methods, live breakdown, and model limits'
              : 'available once the first result arrives'}
          </span>
        </div>
        <ChevronUp
          className={`h-4 w-4 flex-shrink-0 text-subtle transition-transform ${expanded ? '' : 'rotate-180'}`}
          aria-hidden="true"
        />
      </button>

      {expanded && hasData && (
        <div className="max-h-[42vh] overflow-y-auto border-t border-line px-6 py-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Methods used">
              <FormulaDisclosure sources={zoneData.sources ?? []} />
            </Section>

            <Section title="This zone, explained">
              {shapeSentence ? (
                <p className="text-body leading-relaxed text-ink">
                  {shapeSentence}
                </p>
              ) : (
                <p className="text-body text-subtle">
                  No hazard bands available to describe.
                </p>
              )}

              {comparisonSentence && (
                <p className="mt-3 border-t border-line pt-3 text-body leading-relaxed text-subtle">
                  {comparisonSentence}
                </p>
              )}
            </Section>

            <Section title="Model assumptions and limitations">
              <AssumptionList />
            </Section>
          </div>
        </div>
      )}
    </section>
  );
};

export default ExplainabilityPanel;
