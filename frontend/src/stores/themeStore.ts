import { create } from 'zustand'
import { persist }  from 'zustand/middleware'

export type ThemeId = 'dark' | 'light' | 'neon' | 'luxury' | 'minimal'

export interface Theme {
  id:      ThemeId
  name:    string
  emoji:   string
  preview: string   // accent colour hex for swatch
  dark:    boolean  // is it a dark variant?
}

export const THEMES: Theme[] = [
  { id: 'dark',    name: 'Dark',    emoji: '🌙', preview: '#c8912a', dark: true  },
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
  document.documentElement.setAttribute('data-theme', id)
  const t = THEMES.find(t => t.id === id)
  document.documentElement.classList.toggle('dark', t?.dark ?? true)
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
      name: 'avero-theme-v1',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme)
      },
    }
  )
)

// Call once on cold start before React hydrates
;(function () {
  try {
    const raw = localStorage.getItem('avero-theme-v1')
    const id  = raw ? (JSON.parse(raw)?.state?.theme as ThemeId) : 'dark'
    applyTheme(id ?? 'dark')
  } catch {
    applyTheme('dark')
  }
})()
