import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: '#0A0E12',
        panel: '#141A21',
        lime: '#C8F542',
        muted: '#8B98A5',
        line: '#2A343F',
      },
      fontFamily: {
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Barlow Condensed', 'Archivo', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        card: '0 12px 28px rgba(0, 0, 0, .28)',
      },
      borderRadius: {
        panel: '6px',
      },
    },
  },
  plugins: [],
} satisfies Config
