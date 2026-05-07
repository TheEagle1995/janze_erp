import { useState, useRef, useEffect } from 'react'
import { Palette }                      from 'lucide-react'
import clsx                             from 'clsx'
import { THEMES, useThemeStore }        from '../../stores/themeStore'

export default function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore()
  const [open, setOpen]     = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = THEMES.find(t => t.id === theme)!

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
          'border border-border bg-surface2 hover:bg-surface transition-colors',
          open && 'bg-surface ring-1 ring-gold/30'
        )}
        title="Switch theme"
      >
        <Palette size={13} className="text-gold" />
        <span className="hidden sm:inline text-fg/80">{current.emoji} {current.name}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={clsx(
          'absolute right-0 top-full mt-2 z-50',
          'bg-surface border border-border rounded-2xl shadow-2xl',
          'p-3 w-52',
          'animate-in fade-in slide-in-from-top-1 duration-150'
        )}>
          <p className="text-[10px] text-muted font-semibold tracking-widest uppercase mb-2.5 px-1">
            Appearance
          </p>

          <div className="space-y-0.5">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setOpen(false) }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all',
                  theme === t.id
                    ? 'bg-gold-dim text-gold'
                    : 'text-muted hover:bg-surface2 hover:text-fg'
                )}
              >
                {/* Colour swatch */}
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-border"
                  style={{ background: t.preview }}
                />
                <span className="font-medium text-xs">
                  {t.emoji} {t.name}
                </span>
                {theme === t.id && (
                  <span className="ml-auto text-[9px] font-bold bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">
                    ON
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Subtle footer hint */}
          <p className="text-[9px] text-muted/50 text-center mt-3">
            Preference saved automatically
          </p>
        </div>
      )}
    </div>
  )
}
