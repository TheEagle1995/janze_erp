import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // All reference CSS custom-properties so themes swap at runtime
        bg:        'rgb(var(--color-bg)  / <alpha-value>)',
        surface:   'rgb(var(--color-surface)  / <alpha-value>)',
        surface2:  'rgb(var(--color-surface2) / <alpha-value>)',
        border:    'rgb(var(--color-border)   / <alpha-value>)',
        gold:      'rgb(var(--color-gold)     / <alpha-value>)',
        'gold-dim': 'var(--color-gold-dim)',   // pre-built rgba – no modifier needed
        jade:      'rgb(var(--color-jade)     / <alpha-value>)',
        rose:      'rgb(var(--color-rose)     / <alpha-value>)',
        muted:     'rgb(var(--color-muted)    / <alpha-value>)',
        fg:        'rgb(var(--color-fg)       / <alpha-value>)',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        mono:    ['DM Mono', 'monospace'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
