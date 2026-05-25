/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        cairo: ['Cairo'],
        cairoBold: ['Cairo-Bold'],
        cairoBlack: ['Cairo-Black'],
      },
      colors: {
        // ── Brand-aligned with dashboard (teal-green) 2026-05-26 ──
        // Dashboard's primary scale is teal-green (#0e9384). The mobile-admin
        // was built sky-blue by mistake; this palette now matches the web
        // dashboard so the owner perceives one brand across web + mobile.
        // The legacy "aqua" name is retained because some old screens still
        // reference `bg-aqua-600` etc.; treat it as an alias for teal.
        aqua: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
          400: '#2dd4bf', 500: '#14b8a6', 600: '#0e9384', 700: '#0c7a6e',
          800: '#115e59', 900: '#134e4a',
        },
        warn:   { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
        danger: { 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
        leaf:   { 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
      },
    },
  },
  plugins: [],
};
