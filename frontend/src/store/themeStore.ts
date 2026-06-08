import { create } from 'zustand'
import { persist }  from 'zustand/middleware'

export type ThemeId = 'dark' | 'light' | 'neon' | 'luxury' | 'minimal'

export interface Theme {
  id:      ThemeId
  name:    string
  emoji:   string
  preview: string   // accent colour hex for swatch
  dark:    boolean
}

export const THEMES: Theme[] = [
  { id: 'dark',    name: 'Dark',    emoji: '🌙', preview: '#d4a85a', dark: true  },
  { id: 'light',   name: 'Light',   emoji: '☀️', preview: '#4f46e5', dark: false },
  { id: 'neon',    name: 'Neon',    emoji: '⚡', preview: '#00ff41', dark: true  },
  { id: 'luxury',  name: 'Luxury',  emoji: '👑', preview: '#d4af37', dark: true  },
  { id: 'minimal', name: 'Minimal', emoji: '◻',  preview: '#3b82f6', dark: false },
]

interface ThemeState {
  theme:    ThemeId
  setTheme: (t: ThemeId) => void
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement
  root.setAttribute('data-theme', id)

  // Remove all theme classes
  root.classList.remove('theme-dark', 'theme-light', 'theme-neon', 'theme-luxury', 'theme-minimal')
  root.classList.add(`theme-${id}`)

  const t = THEMES.find(t => t.id === id)
  root.classList.toggle('dark', t?.dark ?? true)

  // Apply CSS variable overrides per theme
  // IMPORTANT: values must be space-separated RGB numbers (not hex),
  // because Tailwind uses them as: rgb(var(--color-X) / <alpha-value>)
  const styles: Record<ThemeId, Record<string, string>> = {
    dark: {
      '--color-bg':       '15 15 19',
      '--color-surface':  '20 23 34',
      '--color-surface2': '28 33 48',
      '--color-border':   '46 49 65',
      '--color-fg':       '232 232 224',
      '--color-muted':    '110 118 146',
      '--color-gold':     '212 168 90',
      '--color-gold-dim': 'rgba(212,168,90,0.15)',
      '--color-jade':     '86 196 168',
      '--color-rose':     '242 107 107',
    },
    light: {
      '--color-bg':       '245 245 247',
      '--color-surface':  '255 255 255',
      '--color-surface2': '240 240 243',
      '--color-border':   '224 224 232',
      '--color-fg':       '26 26 46',
      '--color-muted':    '122 122 154',
      '--color-gold':     '79 70 229',
      '--color-gold-dim': 'rgba(79,70,229,0.15)',
      '--color-jade':     '5 150 105',
      '--color-rose':     '225 29 72',
    },
    neon: {
      '--color-bg':       '5 8 16',
      '--color-surface':  '10 14 26',
      '--color-surface2': '15 20 40',
      '--color-border':   '26 37 64',
      '--color-fg':       '224 255 232',
      '--color-muted':    '74 96 128',
      '--color-gold':     '0 255 65',
      '--color-gold-dim': 'rgba(0,255,65,0.15)',
      '--color-jade':     '0 212 255',
      '--color-rose':     '255 0 85',
    },
    luxury: {
      '--color-bg':       '10 8 5',
      '--color-surface':  '18 15 8',
      '--color-surface2': '26 21 16',
      '--color-border':   '46 38 24',
      '--color-fg':       '245 230 200',
      '--color-muted':    '122 106 80',
      '--color-gold':     '212 175 55',
      '--color-gold-dim': 'rgba(212,175,55,0.15)',
      '--color-jade':     '143 188 143',
      '--color-rose':     '192 96 106',
    },
    minimal: {
      '--color-bg':       '250 250 250',
      '--color-surface':  '255 255 255',
      '--color-surface2': '244 244 246',
      '--color-border':   '229 229 234',
      '--color-fg':       '17 17 17',
      '--color-muted':    '136 136 136',
      '--color-gold':     '59 130 246',
      '--color-gold-dim': 'rgba(59,130,246,0.15)',
      '--color-jade':     '16 185 129',
      '--color-rose':     '239 68 68',
    },
  }

  const vars = styles[id] ?? styles.dark
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v)
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme:    'dark',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'janze-theme-v1',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme)
      },
    }
  )
)

// Apply theme on cold start before React hydrates
;(function () {
  try {
    const raw = localStorage.getItem('janze-theme-v1')
    const id  = raw ? (JSON.parse(raw)?.state?.theme as ThemeId) : 'dark'
    applyTheme(id ?? 'dark')
  } catch {
    applyTheme('dark')
  }
})()
