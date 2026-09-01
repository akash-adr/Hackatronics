import React from 'react';

// Every light-theme panel is this card: 12px radius, soft shadow (no hard
// border), 20px internal padding. Variants change only the background.
const TONES = {
  default: 'bg-surface',
  muted: 'bg-surface-muted', // supporting detail, e.g. explainability
};

const Card = ({ tone = 'default', className = '', children, ...props }) => (
  <div
    className={`rounded-card p-5 shadow-card ${TONES[tone]} ${className}`}
    {...props}
  >
    {children}
  </div>
);

export default Card;
