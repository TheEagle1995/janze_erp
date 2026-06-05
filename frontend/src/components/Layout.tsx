import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList,
  BarChart3, Users, Warehouse, DollarSign, UserCheck,
  Truck, Settings, LogOut, Menu, X, Building2,
  Percent, CreditCard, Sparkles, Megaphone, UserCog,
  Tag, TrendingDown, ChevronLeft,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const GOLD = '#d4a85a'

const navItems = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard',   end: true },
  { to: '/pos',         icon: ShoppingCart,    label: 'POS' },
  { to: '/products',    icon: Package,         label: 'Products' },
  { to: '/inventory',   icon: Warehouse,       label: 'Inventory' },
  { to: '/customers',   icon: Users,           label: 'Customers' },
  { to: '/orders',      icon: ClipboardList,   label: 'Orders' },
  { to: '/finance',     icon: DollarSign,      label: 'Finance',   roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
  { to: '/debts',       icon: TrendingDown,    label: 'Debts',     roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
  { to: '/employees',   icon: UserCheck,       label: 'Employees', roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
  { to: '/sellers',     icon: UserCog,         label: 'Sellers',   roles: ['SUPER_ADMIN','ADMIN'] },
  { to: '/branches',    icon: Building2,       label: 'Branches',  roles: ['SUPER_ADMIN','ADMIN'] },
  { to: '/suppliers',   icon: Truck,           label: 'Suppliers', roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
  { to: '/marketing',   icon: Megaphone,       label: 'Marketing', roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
  { to: '/discounts',   icon: Percent,         label: 'Discounts', roles: ['SUPER_ADMIN','ADMIN'] },
  { to: '/labels',      icon: Tag,             label: 'Labels' },
  { to: '/analytics',   icon: BarChart3,       label: 'Analytics', roles: ['SUPER_ADMIN','ADMIN','MANAGER'] },
  { to: '/ai-insights', icon: Sparkles,        label: 'AI Insights' },
  { to: '/settings',    icon: Settings,        label: 'Settings',  roles: ['SUPER_ADMIN','ADMIN'] },
]

export default function Layout() {
  const [sideOpen, setSideOpen] = useState(true)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const role = user?.role ?? ''

  const allowed = (roles?: string[]) => !roles || roles.includes(role)

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col shrink-0 bg-surface border-r border-border transition-all duration-200 overflow-hidden',
      )} style={{ width: sideOpen ? 220 : 56 }}>

        {/* Brand */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-border">
          {sideOpen && (
            <span className="font-display font-bold text-sm tracking-tight" style={{ color: GOLD }}>
              AVERO × Janze
            </span>
          )}
          {!sideOpen && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-sm mx-auto"
              style={{ background: GOLD + '22', color: GOLD }}>A</div>
          )}
          <button onClick={() => setSideOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-surface2 text-muted transition-colors ml-auto shrink-0">
            {sideOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, end, roles }) => {
            if (!allowed(roles)) return null
            return (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gold-dim text-gold'
                    : 'text-muted hover:bg-surface2 hover:text-fg'
                )}>
                <Icon size={16} className="shrink-0" />
                {sideOpen && <span className="truncate">{label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
              style={{ background: GOLD + '22', color: GOLD }}>
              {user?.name?.[0] ?? '?'}
            </div>
            {sideOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-fg truncate">{user?.name}</p>
                <p className="text-xs text-muted truncate capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            )}
            <button onClick={handleLogout}
              className="text-muted hover:text-rose transition-colors shrink-0 p-1" title="Logout">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-bg">
        <Outlet />
      </main>
    </div>
  )
}
