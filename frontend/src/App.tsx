import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import LoginPage      from './pages/LoginPage'
import Layout         from './components/shared/Layout'
import POSPage        from './pages/POSPage'
import DashboardPage  from './pages/DashboardPage'
import ProductsPage   from './pages/ProductsPage'
import InventoryPage  from './pages/InventoryPage'
import CustomersPage  from './pages/CustomersPage'
import OrdersPage     from './pages/OrdersPage'
import FinancePage    from './pages/FinancePage'
import SettingsPage   from './pages/SettingsPage'
import SellersPage    from './pages/SellersPage'
import BranchesPage   from './pages/BranchesPage'
import MarketingPage  from './pages/MarketingPage'
import DebtPage       from './pages/DebtPage'
import EmployeesPage  from './pages/EmployeesPage'
import AnalyticsPage  from './pages/AnalyticsPage'
import SuppliersPage      from './pages/SuppliersPage'
import AIInsightsPage     from './pages/AIInsightsPage'

function RequireAuth({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index           element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<DashboardPage />} />
        <Route path="pos"        element={<POSPage />} />
        <Route path="products/*" element={<ProductsPage />} />
        <Route path="inventory"  element={<InventoryPage />} />
        <Route path="customers"  element={<CustomersPage />} />
        <Route path="orders"     element={<OrdersPage />} />
        <Route path="finance/*"  element={<FinancePage />} />
        <Route path="debts"      element={<DebtPage />} />
        <Route path="employees"  element={<EmployeesPage />} />
        <Route path="sellers"    element={<SellersPage />} />
        <Route path="branches"   element={<BranchesPage />} />
        <Route path="marketing"  element={<MarketingPage />} />
        <Route path="analytics"  element={<AnalyticsPage />} />
        <Route path="suppliers"  element={<SuppliersPage />} />
        <Route path="ai-insights" element={<AIInsightsPage />} />
        <Route path="settings"   element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
