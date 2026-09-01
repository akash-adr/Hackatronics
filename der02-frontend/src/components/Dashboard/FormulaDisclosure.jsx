import React from 'react';
import { VALIDATION_STATEMENT } from '../../utils/explainability';

/**
 * Layer 1: the methods behind the numbers on screen.
 *
 * `sources` is the array the backend already returned with the current
 * result, so this can only ever cite methods that produced what is displayed.
 * Defaults to an empty array rather than throwing if it is missing.
 */
const FormulaDisclosure = ({ sources = [] }) => (
  <div>
    {sources.length > 0 ? (
      <ul className="space-y-1.5">
        {sources.map((source) => (
          <li key={source} className="flex gap-2 text-body text-ink">
            <span className="text-subtle" aria-hidden="true">
              •
            </span>
            <span>{source}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-body text-subtle">No methods reported yet.</p>
    )}

    <p className="mt-3 border-t border-line pt-3 text-meta text-subtle">
      {VALIDATION_STATEMENT}
    </p>
  </div>
);

export default FormulaDisclosure;
