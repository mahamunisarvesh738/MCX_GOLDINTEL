/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#090d16',
          card: '#111726',
          cardHover: '#161f33',
          border: '#1e293b',
          borderLight: '#334155',
          gold: '#f59e0b',
          goldLight: '#fbbf24',
          goldDim: '#92400e',
          cyan: '#06b6d4',
          emerald: '#10b981',
          crimson: '#f43f5e',
          muted: '#94a3b8'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
