import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Cairo"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#e6f4f1',
          500: '#0e9384',
          600: '#0c7a6e',
          700: '#085f54',
        },
        // لون داري الرئيسي (cyan/aqua) — مطابق لـ #0891b2 في app.json (تطبيق الموبايل)
        // كان مرجَّعاً في كل المكوّنات (bg-aqua-600, text-aqua-700, …) لكن غير معرّف،
        // فالـ Tailwind purge كان يُنتج CSS فارغاً لكل هذه الكلاسات → أزرار بلا ألوان.
        aqua: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
      },
    },
  },
  plugins: [],
};

export default config;
