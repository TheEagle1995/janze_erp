import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList,
  BarChart3, Users, Warehouse, DollarSign, UserCheck,
  Truck, Settings, LogOut, Menu, X, Building2,
  Percent, CreditCard, Sparkles,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const JANZE_GOLD = '#d4a85a'
const JANZE_JADE = '#56c4a8'

const navItems = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos',         icon: ShoppingCart,    label: 'POS' },
  { to: '/products',    icon: Package,         label: 'Products' },
  { to: '/orders',      icon: ClipboardList,   label: 'Orders' },
  { to: '/analytics',   icon: BarChart3,       label: 'Analytics' },
  { to: '/customers',   icon: Users,           label: 'Customers' },
  { to: '/inventory',   icon: Warehouse,       label: 'Inventory' },
  { to: '/finance',     icon: DollarSign,      label: 'Finance' },
  { to: '/employees',   icon: UserCheck,       label: 'Employees' },
  { to: '/suppliers',   icon: Truck,           label: 'Suppliers' },
  { to: '/discounts',   icon: Percent,         label: 'Discounts' },
  { to: '/debts',       icon: CreditCard,      label: 'Debts' },
  { to: '/branches',    icon: Building2,       label: 'Branches' },
  { to: '/ai-insights', icon: Sparkles,        label: 'AI Insights' },
  { to: '/settings',    icon: Settings,        label: 'Settings' },
]

export default function Layout() {
  const [sideOpen, setSideOpen] = useState(true)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const brand = user?.branch?.brand ?? 'AVERO'
  const accent = brand === 'AVERO' ? JANZE_GOLD : JANZE_JADE

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className="flex flex-col shrink-0 bg-surface border-r border-border transition-all duration-200 overflow-hidden"
        style={{ width: sideOpen ? 220 : 56 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-display font-bold text-sm"
            style={{ background: accent + '22', color: accent }}>
            A
          </div>
          {sideOpen && (
            <span className="font-display font-bold text-sm tracking-tight truncate" style={{ color: accent }}>
              AVERO × Janze
            </span>
          )}
          <button
            onClick={() => setSideOpen(v => !v)}
            className="ml-auto text-muted hover:text-fg transition-colors shrink-0"
          >
            {sideOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 mx-1 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'text-fg font-medium'
                    : 'text-muted hover:text-fg hover:bg-surface2'
                }`
              }
              style={({ isActive }) => isActive ? { background: accent + '1a', color: accent } : {}}
            >
              <Icon size={16} className="shrink-0" />
              {sideOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
              style={{ background: accent + '22', color: accent }}>
              {user?.name?.[0] ?? '?'}
            </div>
            {sideOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-fg truncate">{user?.name}</p>
                <p className="text-xs text-muted truncate capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            )}
            <button onClick={handleLogout} className="text-muted hover:text-rose transition-colors shrink-0" title="Logout">
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
