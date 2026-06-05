import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage          from './pages/LoginPage'
import DashboardPage      from './pages/DashboardPage'
import POSPage            from './pages/POSPage'
import ProductsPage       from './pages/ProductsPage'
import OrdersPage         from './pages/OrdersPage'
import AnalyticsPage      from './pages/AnalyticsPage'
import CustomersPage      from './pages/CustomersPage'
import InventoryPage      from './pages/InventoryPage'
import FinancePage        from './pages/FinancePage'
import EmployeesPage      from './pages/EmployeesPage'
import SuppliersPage      from './pages/SuppliersPage'
import DiscountsPage      from './pages/DiscountsPage'
import DebtsPage          from './pages/DebtsPage'
import BranchesPage       from './pages/BranchesPage'
import SettingsPage       from './pages/SettingsPage'
import AIInsightsPage     from './pages/AIInsightsPage'
import SellersPage        from './pages/SellersPage'
import MarketingPage      from './pages/MarketingPage'
import LabelDesignerPage  from './pages/LabelDesignerPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore()
  if (!token || !user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore()
  if (token && user) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { init } = useAuthStore()

  useEffect(() => {
    init()
  }, [init])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          <PublicOnly><LoginPage /></PublicOnly>
        } />

        <Route element={
          <RequireAuth><Layout /></RequireAuth>
        }>
          <Route index           element={<DashboardPage />} />
          <Route path="pos"      element={<POSPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders"   element={<OrdersPage />} />
          <Route path="analytics"  element={<AnalyticsPage />} />
          <Route path="customers"  element={<CustomersPage />} />
          <Route path="inventory"  element={<InventoryPage />} />
          <Route path="finance/*"  element={<FinancePage />} />
          <Route path="employees"  element={<EmployeesPage />} />
          <Route path="suppliers"  element={<SuppliersPage />} />
          <Route path="discounts"  element={<DiscountsPage />} />
          <Route path="debts"      element={<DebtsPage />} />
          <Route path="branches"   element={<BranchesPage />} />
          <Route path="sellers"    element={<SellersPage />} />
          <Route path="marketing"  element={<MarketingPage />} />
          <Route path="labels"     element={<LabelDesignerPage />} />
          <Route path="settings"    element={<SettingsPage />} />
          <Route path="ai-insights" element={<AIInsightsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
