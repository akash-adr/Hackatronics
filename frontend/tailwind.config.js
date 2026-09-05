/** @type {import('tailwindcss').Config} */
// Single source of truth for the DER-02 design system.
// Tailwind v4 does not auto-load this file -- src/index.css pulls it in with
// an @config directive. src/theme.js re-exports the hazard palette so Leaflet
// (which needs raw hex, not classes) draws from these same values.
export default {
  // Dark mode is class-driven: a `dark` class on <html> flips the theme.
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- UI shell -------------------------------------------------
        // These resolve through CSS variables defined in index.css, so the
        // `dark` class on <html> reskins every panel at once. That is
        // deliberate: with ~180 token usages across 20+ components, adding a
        // dark: variant to each one by hand is exactly the kind of change
        // that leaves two or three components behind in the wrong palette.
        // The variables ARE the dark: variants, applied everywhere at once.
        canvas: "var(--der-canvas)",
        surface: {
          DEFAULT: "var(--der-surface)",
          muted: "var(--der-surface-muted)", // supporting panels
        },
        ink: "var(--der-ink)",
        subtle: "var(--der-subtle)",
        line: "var(--der-line)",
        accent: {
          DEFAULT: "#4F46E5",
          hover: "#4338CA",
          soft: "var(--der-accent-soft)",
        },

        // --- dark navy palette, also usable directly as dark:bg-navy-* ---
        navy: {
          950: "#0B1220", // page canvas
          900: "#0F172A", // deep background
          850: "#152238", // card surface
          800: "#1E293B", // raised surface
          700: "#334155", // borders
          400: "#94A3B8", // secondary text
          100: "#F1F5F9", // primary text
        },
        // --- dark map viewport ---
        viewport: {
          DEFAULT: "#0B1020", // basemap ground colour behind tiles
          overlay: "rgba(15, 20, 35, 0.85)", // on-map overlay backing
          hairline: "rgba(255, 255, 255, 0.14)",
          text: "#F9FAFB",
          "text-muted": "#9CA3AF",
        },
        // --- "what changed" alert -------------------------------------
        // Reserved EXCLUSIVELY for the zone-shift banner. Deliberately kept
        // out of the hazard ramp: the hazard ambers are dark, desaturated
        // strokes on the dark map, whereas this is a light amber field in the
        // light shell, so the two never read as the same signal.
        alert: {
          DEFAULT: "#F59E0B", // icon / accent bar -- same in both themes
          surface: "var(--der-alert-surface)", // banner field
          border: "var(--der-alert-border)",
        },

        // --- hazard severity (identical on map and in legend) ---
        hazard: {
          fatal: "#EF4444",
          serious: "#F97316",
          pain: "#FACC15",
          safe: "#22C55E",
        },
      },
      borderRadius: {
        card: "12px",
        viewport: "16px",
      },
      boxShadow: {
        // Soft depth in light mode. In dark mode these variables become a 1px
        // ring instead: a drop shadow is invisible against navy, so card
        // separation has to come from a hairline border.
        card: "var(--der-shadow-card)",
        "card-hover": "var(--der-shadow-card-hover)",
        viewport: "var(--der-shadow-viewport)",
        overlay: "0 2px 10px rgba(0,0,0,0.45)", // on-map, dark in both themes
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        title: ["26px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
        section: ["17px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        body: ["14px", { lineHeight: "20px" }],
        meta: ["12px", { lineHeight: "16px" }],
        stat: ["20px", { lineHeight: "26px", letterSpacing: "-0.01em" }],
      },
    },
  },
  plugins: [],
};
