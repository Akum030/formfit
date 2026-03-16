/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gym: {
          900: '#0a0f1a',
          800: '#111827',
          700: '#1e293b',
          600: '#334155',
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
          cyan: '#06b6d4',
          purple: '#a855f7',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'score-pop': 'scorePop 0.3s ease-out',
      },
      keyframes: {
        scorePop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
