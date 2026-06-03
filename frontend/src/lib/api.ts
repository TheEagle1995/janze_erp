import axios from 'axios'

// VITE_API_URL must include /api/v1  e.g. https://janze-erp-backend-gxbr.vercel.app/api/v1
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1'

export const http = axios.create({
  baseURL: BASE,
  timeout: 15_000,
})

// Attach token on every request
http.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-refresh on 401
http.interceptors.response.use(
  r => r,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken: refresh })
          localStorage.setItem('access_token', data.accessToken)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return http(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    http.post('/auth/login', { email, password }).then(r => r.data),
  loginPin: (branchId: string, pin: string) =>
    http.post('/auth/login/pin', { branchId, pin }).then(r => r.data),
  refresh: (refreshToken: string) =>
    http.post('/auth/refresh', { refreshToken }).then(r => r.data),
  logout: (refreshToken: string) =>
    http.post('/auth/logout', { refreshToken }).then(r => r.data),
}

// ── Branches ──────────────────────────────────────────────────────────────────
export const branchesApi = {
  list: () => http.get('/branches').then(r => r.data),
  get:  (id: string) => http.get(`/branches/${id}`).then(r => r.data),
  create: (d: any) => http.post('/branches', d).then(r => r.data),
  update: (id: string, d: any) => http.put(`/branches/${id}`, d).then(r => r.data),
}

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (p?: any) => http.get('/products', { params: p }).then(r => r.data),
  get:  (id: string) => http.get(`/products/${id}`).then(r => r.data),
  create: (d: any) => http.post('/products', d).then(r => r.data),
  update: (id: string, d: any) => http.put(`/products/${id}`, d).then(r => r.data),
  remove: (id: string) => http.delete(`/products/${id}`).then(r => r.data),
  categories: (brand?: string) => http.get('/products/categories', { params: { brand } }).then(r => r.data),
  barcode: (bc: string) => http.get(`/products/barcode/${bc}`).then(r => r.data),
  bulkImport: (rows: any[], branchId?: string) =>
    http.post('/products/bulk-import', { rows, branchId }).then(r => r.data),
}

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryApi = {
  list: (p?: any) => http.get('/inventory', { params: p }).then(r => r.data),
  adjust: (d: any) => http.post('/inventory/adjust', d).then(r => r.data),
  transfer: (d: any) => http.post('/inventory/transfer', d).then(r => r.data),
  lowStock: (p?: any) => http.get('/inventory/low-stock', { params: p }).then(r => r.data),
  movements: (p?: any) => http.get('/inventory/movements', { params: p }).then(r => r.data),
  summary: (p?: any) => http.get('/inventory/summary', { params: p }).then(r => r.data),
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  list:   (p?: any) => http.get('/orders', { params: p }).then(r => r.data),
  get:    (id: string) => http.get(`/orders/${id}`).then(r => r.data),
  create: (d: any) => http.post('/orders', d).then(r => r.data),
  update: (id: string, d: any) => http.put(`/orders/${id}`, d).then(r => r.data),
  void:   (id: string) => http.post(`/orders/${id}/void`).then(r => r.data),
  stats:  (p?: any) => http.get('/orders/stats', { params: p }).then(r => r.data),
}

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  list:   (p?: any) => http.get('/customers', { params: p }).then(r => r.data),
  get:    (id: string) => http.get(`/customers/${id}`).then(r => r.data),
  create: (d: any) => http.post('/customers', d).then(r => r.data),
  update: (id: string, d: any) => http.put(`/customers/${id}`, d).then(r => r.data),
  loyalty: (p?: any) => http.get('/customers/loyalty', { params: p }).then(r => r.data),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard:    (p?: any) => http.get('/analytics/dashboard', { params: p }).then(r => r.data),
  salesChart:   (p?: any) => http.get('/analytics/sales-chart', { params: p }).then(r => r.data),
  topProducts:  (p?: any) => http.get('/analytics/top-products', { params: p }).then(r => r.data),
  slowMovers:   (p?: any) => http.get('/analytics/slow-movers', { params: p }).then(r => r.data),
  byEmployee:   (p?: any) => http.get('/analytics/by-employee', { params: p }).then(r => r.data),
  profitLoss:   (p?: any) => http.get('/analytics/profit-loss', { params: p }).then(r => r.data),
  pl:           (p?: any) => http.get('/analytics/profit-loss', { params: p }).then(r => r.data),
  paymentMethods:(p?: any) => http.get('/analytics/payment-methods', { params: p }).then(r => r.data),
  byBranch:     (p?: any) => http.get('/analytics/by-branch', { params: p }).then(r => r.data),
  hourly:       (p?: any) => http.get('/analytics/hourly', { params: p }).then(r => r.data),
  weekday:      (p?: any) => http.get('/analytics/weekday', { params: p }).then(r => r.data),
}

// ── Finance ───────────────────────────────────────────────────────────────────
export const financeApi = {
  listAccounts:  (p?: any) => http.get('/finance/accounts', { params: p }).then(r => r.data),
  accounts:      (p?: any) => http.get('/finance/accounts', { params: p }).then(r => r.data),
  listExpenses:  (p?: any) => http.get('/finance/expenses', { params: p }).then(r => r.data),
  expenses:      (p?: any) => http.get('/finance/expenses', { params: p }).then(r => r.data),
  createExpense: (d: any)  => http.post('/finance/expenses', d).then(r => r.data),
  createExp:     (d: any)  => http.post('/finance/expenses', d).then(r => r.data),
  updateExpense: (id: string, d: any) => http.put(`/finance/expenses/${id}`, d).then(r => r.data),
  updateExp:     (id: string, d: any) => http.put(`/finance/expenses/${id}`, d).then(r => r.data),
  deleteExpense: (id: string) => http.delete(`/finance/expenses/${id}`).then(r => r.data),
  pl:            (p?: any) => http.get('/finance/profit-loss', { params: p }).then(r => r.data),
  journals:      (p?: any) => http.get('/finance/journals', { params: p }).then(r => r.data),
  budgets:       (p?: any) => http.get('/finance/budgets', { params: p }).then(r => r.data),
  cashRecon:     (p?: any) => http.get('/finance/cash-reconciliations', { params: p }).then(r => r.data),
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const suppliersApi = {
  list:   (p?: any) => http.get('/suppliers', { params: p }).then(r => r.data),
  get:    (id: string) => http.get(`/suppliers/${id}`).then(r => r.data),
  create: (d: any) => http.post('/suppliers', d).then(r => r.data),
  update: (id: string, d: any) => http.put(`/suppliers/${id}`, d).then(r => r.data),
  orders: (p?: any) => http.get('/suppliers/purchase-orders', { params: p }).then(r => r.data),
}

// ── Discounts ─────────────────────────────────────────────────────────────────
export const discountsApi = {
  list:   (p?: any) => http.get('/discounts', { params: p }).then(r => r.data),
  create: (d: any) => http.post('/discounts', d).then(r => r.data),
  update: (id: string, d: any) => http.put(`/discounts/${id}`, d).then(r => r.data),
  remove: (id: string) => http.delete(`/discounts/${id}`).then(r => r.data),
  delete: (id: string) => http.delete(`/discounts/${id}`).then(r => r.data),
}

// ── Employees ─────────────────────────────────────────────────────────────────
export const employeesApi = {
  list:      (p?: any) => http.get('/employees', { params: p }).then(r => r.data),
  get:       (id: string) => http.get(`/employees/${id}`).then(r => r.data),
  create:    (d: any) => http.post('/employees', d).then(r => r.data),
  update:    (id: string, d: any) => http.put(`/employees/${id}`, d).then(r => r.data),
  attendance:(p?: any) => http.get('/employees/attendance', { params: p }).then(r => r.data),
  checkin:   (d: any) => http.post('/employees/checkin', d).then(r => r.data),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:   (p?: any) => http.get('/users', { params: p }).then(r => r.data),
  get:    (id: string) => http.get(`/users/${id}`).then(r => r.data),
  create: (d: any) => http.post('/users', d).then(r => r.data),
  update: (id: string, d: any) => http.put(`/users/${id}`, d).then(r => r.data),
  me:     () => http.get('/users/me').then(r => r.data),
}

// ── Debts ─────────────────────────────────────────────────────────────────────
export const debtsApi = {
  list:   (p?: any) => http.get('/debts', { params: p }).then(r => r.data),
  create: (d: any) => http.post('/debts', d).then(r => r.data),
  pay:    (id: string, d: any) => http.post(`/debts/${id}/pay`, d).then(r => r.data),
}
