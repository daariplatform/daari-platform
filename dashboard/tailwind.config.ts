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
      },
    },
  },
  plugins: [],
};

export default config;
