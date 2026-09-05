import React from 'react';
import { Moon, Sun } from 'lucide-react';
import useThemeStore from '../../store/useThemeStore';

/**
 * Light/dark switch for the dashboard chrome.
 *
 * A pill with a sliding thumb rather than a bare icon button: the track shows
 * both destinations at once, so the control reads as a state you are in, not a
 * button whose effect you have to guess. Entirely separate from the map's
 * basemap toggle, which controls tiles, not the shell.
 */
const ThemeToggle = () => {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="relative flex h-7 w-[3.25rem] items-center rounded-full border border-line bg-surface-muted px-0.5 shadow-card transition-colors duration-300 ease-out hover:border-subtle/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {/* Sliding thumb. transform, not layout, so it animates smoothly. */}
      <span
        className={`absolute flex h-6 w-6 items-center justify-center rounded-full bg-surface shadow-card transition-transform duration-300 ease-out ${
          isDark ? 'translate-x-[1.5rem]' : 'translate-x-0'
        }`}
        aria-hidden="true"
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-ink" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-ink" />
        )}
      </span>

      {/* Both destinations stay visible behind the thumb. */}
      <span className="flex w-full items-center justify-between px-1.5">
        <Sun
          className={`h-3 w-3 transition-opacity duration-300 ${isDark ? 'opacity-45 text-subtle' : 'opacity-0'}`}
          aria-hidden="true"
        />
        <Moon
          className={`h-3 w-3 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-45 text-subtle'}`}
          aria-hidden="true"
        />
      </span>
    </button>
  );
};

export default ThemeToggle;
