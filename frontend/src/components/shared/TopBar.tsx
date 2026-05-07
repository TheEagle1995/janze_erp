import { useAuthStore }             from '../../stores/authStore'
import { authApi }                  from '../../api/auth'
import { LANGUAGES, useLang }       from '../../i18n'
import ThemeSwitcher                from './ThemeSwitcher'
import { LogOut, Bell }             from 'lucide-react'
import clsx                         from 'clsx'

export default function TopBar() {
  const { user, refreshToken, logout } = useAuthStore()
  const { lang, setLang }             = useLang()

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken) } catch {}
    logout()
  }

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 flex-shrink-0">
      <div />
      <div className="flex items-center gap-2">

        {/* ── Theme Switcher ── */}
        <ThemeSwitcher />

        {/* ── Language Switcher ── */}
        <div className="flex items-center gap-0.5 bg-surface2 rounded-lg p-0.5 border border-border">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={clsx(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                lang === l.code
                  ? 'bg-gold-dim text-gold shadow-sm'
                  : 'text-muted hover:text-fg'
              )}
              title={l.code.toUpperCase()}
            >
              <span>{l.flag}</span>
              <span className="hidden sm:inline">{l.label}</span>
            </button>
          ))}
        </div>

        {/* ── Notifications ── */}
        <button className="p-2 rounded-lg hover:bg-surface2 text-muted transition-colors">
          <Bell size={18} />
        </button>

        {/* ── User ── */}
        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 rounded-full bg-gold-dim border border-gold/30 flex items-center justify-center text-gold font-semibold text-xs">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <div className="font-medium text-fg text-xs">{user?.name}</div>
            <div className="text-muted text-xs">{user?.role}</div>
          </div>
        </div>

        {/* ── Logout ── */}
        <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-surface2 text-muted hover:text-rose transition-colors">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
