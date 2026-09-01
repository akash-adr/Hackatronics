import React from 'react';

// Single shared button. Every action in the app uses one of these variants --
// there are no one-off button styles elsewhere.
const VARIANTS = {
  primary:
    'bg-accent text-white hover:bg-accent-hover shadow-card disabled:bg-accent/40',
  secondary:
    'bg-surface text-ink border border-line hover:bg-surface-muted disabled:text-subtle',
  ghost:
    'bg-transparent text-subtle hover:bg-surface-muted hover:text-ink disabled:text-line',
};

const SIZES = {
  sm: 'h-8 px-3 text-meta',
  md: 'h-10 px-4 text-body',
};

const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-card font-medium
      transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2
      focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed
      ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default Button;
