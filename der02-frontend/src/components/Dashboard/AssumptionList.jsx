import React from 'react';
import { ASSUMPTION_LIST } from '../../utils/explainability';

/**
 * Layer 3: deliberate scope decisions, stated plainly.
 *
 * Framed as "what we chose not to model, and why" -- these are engineering
 * trade-offs made on purpose, not shortcomings to apologise for.
 */
const AssumptionList = () => (
  <ul className="space-y-3">
    {ASSUMPTION_LIST.map(({ assumption, reason }) => (
      <li key={assumption}>
        <p className="text-body font-semibold text-ink">{assumption}</p>
        <p className="mt-0.5 text-meta leading-relaxed text-subtle">{reason}</p>
      </li>
    ))}
  </ul>
);

export default AssumptionList;
