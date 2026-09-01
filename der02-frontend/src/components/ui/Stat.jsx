import React from 'react';

// A number paired with its unit: tabular figures so columns of radii line up,
// unit rendered smaller and lighter than the value it belongs to.
const Stat = ({ label, value, unit, valueClassName = '' }) => (
  <div>
    {label && <p className="text-meta font-medium text-subtle">{label}</p>}
    <p className={`mt-1 text-stat font-semibold text-ink tnum ${valueClassName}`}>
      {value}
      {unit && (
        <span className="ml-1 text-meta font-medium text-subtle">{unit}</span>
      )}
    </p>
  </div>
);

export default Stat;
