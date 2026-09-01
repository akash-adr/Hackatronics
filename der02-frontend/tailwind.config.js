/** @type {import('tailwindcss').Config} */
// Single source of truth for the DER-02 design system.
// Tailwind v4 does not auto-load this file -- src/index.css pulls it in with
// an @config directive. src/theme.js re-exports the hazard palette so Leaflet
// (which needs raw hex, not classes) draws from these same values.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- light UI shell ---
        canvas: "#F7F8FA",
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F3F4F6", // supporting panels (explainability)
        },
        ink: "#1A1A1A",
        subtle: "#6B7280",
        line: "#E5E7EB",
        accent: {
          DEFAULT: "#4F46E5",
          hover: "#4338CA",
          soft: "#EEF2FF",
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
          DEFAULT: "#F59E0B", // icon / accent bar
          surface: "#FEF3C7", // banner background
          border: "#FCD34D",
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
        // soft depth instead of hard borders
        card: "0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.06)",
        "card-hover": "0 2px 4px rgba(16,24,40,0.06), 0 8px 20px rgba(16,24,40,0.10)",
        viewport: "0 2px 6px rgba(16,24,40,0.08), 0 12px 32px rgba(16,24,40,0.14)",
        overlay: "0 2px 10px rgba(0,0,0,0.45)",
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
