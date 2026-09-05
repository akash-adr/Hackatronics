import { create } from 'zustand';

/**
 * UI theme preference.
 *
 * Deliberately a SEPARATE store from useFacilityStore: this is a display
 * preference that affects nothing computed, and keeping it out of the facility
 * slice means a theme toggle can never invalidate or re-trigger a hazard
 * computation.
 */

const STORAGE_KEY = 'der02.theme';

/** Read the saved choice; default to light when nothing is stored. */
function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'light';
  } catch {
    // Private mode / storage disabled: the app still works, it just forgets.
    return 'light';
  }
}

/** The class on <html> is what Tailwind's dark: variants key off. */
function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore: persistence is a convenience, not a requirement */
  }
}

const useThemeStore = create((set, get) => ({
  theme: readStoredTheme(),

  /** Apply the stored choice on first mount, before anything paints. */
  initializeTheme: () => {
    applyTheme(get().theme);
    // Enable eased transitions only AFTER the first paint, so the initial
    // load does not visibly fade in from the wrong palette. setTimeout rather
    // than requestAnimationFrame: rAF is throttled in a hidden or background
    // tab, which would leave the transitions permanently off there.
    setTimeout(
      () => document.documentElement.classList.add('der-theme-transition'),
      0
    );
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
}));

export default useThemeStore;
