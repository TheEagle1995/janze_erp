import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { useUIStore }   from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { useT }         from '../../i18n'
import {
  LayoutDashboard, ShoppingCart, Package, Archive,
  Users, Receipt, Wallet, Settings, ChevronLeft,
  UserCog, Building2, Megaphone, TrendingDown, HardHat,
  BarChart2, Truck, Sparkles,
} from 'lucide-react'

export default function Sidebar() {
  const open   = useUIStore(s => s.sidebarOpen)
  const toggle = useUIStore(s => s.toggleSidebar)
  const role   = useAuthStore(s => s.user?.role)
  const t      = useT()

  const NAV = [
    { to: '/dashboard',  icon: LayoutDashboard, label: t.nav.dashboard },
    { to: '/pos',        icon: ShoppingCart,    label: t.nav.pos },
    { to: '/products',   icon: Package,         label: t.nav.products },
    { to: '/inventory',  icon: Archive,         label: t.nav.inventory },
    { to: '/customers',  icon: Users,           label: t.nav.customers },
    { to: '/orders',     icon: Receipt,         label: t.nav.orders },
    { to: '/finance',    icon: Wallet,          label: t.nav.finance,   roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
    { to: '/debts',      icon: TrendingDown,    label: t.nav.debts,     roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
    { to: '/employees',  icon: HardHat,         label: t.nav.employees, roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
    { to: '/sellers',    icon: UserCog,         label: t.nav.sellers,   roles: ['SUPER_ADMIN','ADMIN'] },
    { to: '/branches',   icon: Building2,       label: t.nav.branches,  roles: ['SUPER_ADMIN','ADMIN'] },
    { to: '/marketing',  icon: Megaphone,       label: t.nav.marketing, roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
    { to: '/suppliers',  icon: Truck,           label: 'Suppliers',     roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
    { to: '/analytics',  icon: BarChart2,       label: t.nav.analytics, roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
    { to: '/ai-insights',icon: Sparkles,        label: 'AI Insights',   roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
    { to: '/settings',   icon: Settings,        label: t.nav.settings,  roles: ['SUPER_ADMIN','ADMIN'] },
  ]

  const allowed = (roles?: string[]) => !roles || roles.includes(role ?? '')

  return (
    <aside className={clsx(
      'fixed left-0 top-0 h-full bg-surface border-r border-border flex flex-col z-40',
      'transition-all duration-200',
      open ? 'w-60' : 'w-16'
    )}>
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-border">
        {open && <span className="font-display font-bold text-gold text-lg tracking-tight">AVERO × Janze</span>}
        <button onClick={toggle} className="p-1.5 rounded-lg hover:bg-surface2 text-muted ml-auto transition-colors">
          <ChevronLeft size={16} className={clsx('transition-transform', !open && 'rotate-180')} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label, roles }) => {
          if (!allowed(roles)) return null
          return (
            <NavLink key={to} to={to} className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-gold-dim text-gold'
                : 'text-muted hover:bg-surface2 hover:text-fg'
            )}>
              <Icon size={18} className="flex-shrink-0" />
              {open && <span>{label}</span>}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
