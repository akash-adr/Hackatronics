import React from 'react';

// Small uppercase grey label that opens each grouped section.
const SectionLabel = ({ className = '', children }) => (
  <h2
    className={`text-meta font-semibold uppercase tracking-wider text-subtle ${className}`}
  >
    {children}
  </h2>
);

export default SectionLabel;
