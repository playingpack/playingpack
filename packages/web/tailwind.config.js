/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'monospace'],
      },
      colors: {
        'pp-dark': '#0f0f0f',
        'pp-darker': '#0a0a0a',
        'pp-gray': '#1a1a1a',
        'pp-light': '#2a2a2a',
        'pp-accent': '#22c55e',
        'pp-warning': '#f59e0b',
        'pp-error': '#ef4444',
      },
    },
  },
  plugins: [],
};
