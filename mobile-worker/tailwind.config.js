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
        // ── Worker palette unified with customer app (sky-blue) 2026-05-23 ──
        // "aqua" name kept for backwards compat — all bg-aqua-* classNames in
        // existing screens now render as sky-blue without renaming.
        aqua: {
          50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc',
          400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
          800: '#075985', 900: '#0c4a6e',
        },
        warn:   { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
        danger: { 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
        leaf:   { 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
      },
    },
  },
  plugins: [],
};
