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
        // ── Brand palette (2026-05-23): أزرق بحري + فيروزي ──
        // navy: لون التطبيق الرئيسي (hero gradient + CTAs + accents)
        // اختير لأن الـ trust signal أقوى من الـ cyan في سياق اشتراك متكرر
        navy: {
          50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc',
          400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
          800: '#075985', 900: '#0c4a6e',
        },
        // turquoise: accent للماء + secondary CTAs (لا يتداخل مع water-success)
        turquoise: {
          50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
          400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
          800: '#115e59', 900: '#134e4a',
        },
        // ── Old tokens (kept for backwards compat during migration) ──
        // sky / aqua: قبل palette الجديد. الكود الجديد يستعمل navy بدلاً منهما.
        sky: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },
        // water (أخضر ماء طبيعي): accent للنجاحات + buttons ثانوية
        water: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
          800: '#065f46', 900: '#064e3b',
        },
        // أبقَى aqua للتوافق مع الكود القديم — يستعملها قبل الـ migration الكامل
        aqua: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },
        warn:   { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
        danger: { 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
        leaf:   { 400: '#34d399', 500: '#10b981', 600: '#059669' },
      },
    },
  },
  plugins: [],
};
