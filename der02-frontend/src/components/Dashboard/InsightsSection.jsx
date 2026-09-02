import React from 'react';
import HazardSummaryBlock from './HazardSummaryBlock';
import ThreatLevelBlock from './ThreatLevelBlock';
import AiSuggestionBox from './AiSuggestionBox';
import ExplanationBlock from './ExplanationBlock';
import RecentAlertsBlock from './RecentAlertsBlock';

/**
 * The four always-visible blocks below the map, in fixed order. Replaces the
 * collapsible "Why this shape?" drawer: nothing here needs a click to read,
 * it is simply further down the page.
 */
const InsightsSection = () => (
  <section className="flex flex-col gap-4 px-4 pb-4">
    <HazardSummaryBlock />

    {/* Threat level and the AI suggestion sit side by side: the computed
        classification and the advisory note about it belong on one line, and
        neither is tall enough to need a full row of its own. */}
    <div className="grid gap-4 lg:grid-cols-2">
      <ThreatLevelBlock />
      <AiSuggestionBox />
    </div>
    <ExplanationBlock />
    <RecentAlertsBlock />
  </section>
);

export default InsightsSection;
