import React from 'react';
import HazardSummaryBlock from './HazardSummaryBlock';
import ThreatLevelBlock from './ThreatLevelBlock';
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
    <ThreatLevelBlock />
    <ExplanationBlock />
    <RecentAlertsBlock />
  </section>
);

export default InsightsSection;
