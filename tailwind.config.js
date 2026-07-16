/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#15161a',
          panel: '#1c1e24',
          panel2: '#22242b',
          border: '#2c2f38',
          text: '#e4e6eb',
          dim: '#8b8f9c',
          accent: '#ff8a3d',
          accent2: '#3ddcff',
          ok: '#5ee89a',
          warn: '#ffcf5c',
          danger: '#ff5c5c',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        inset: 'inset 0 1px 2px rgba(0,0,0,0.6)',
        knob: '0 2px 6px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
