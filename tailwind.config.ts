import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: '#0B1118',
        panel: '#151F2B',
        lime: '#B6F23B',
        muted: '#A5B3C1',
        line: '#263442',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Barlow Condensed', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 32px rgba(182, 242, 59, .12)',
        card: '0 14px 40px rgba(0, 0, 0, .22)',
      },
    },
  },
  plugins: [],
} satisfies Config
