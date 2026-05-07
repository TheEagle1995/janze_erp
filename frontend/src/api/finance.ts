import api from './client'
export const financeApi = {
  // Expenses
  listExpenses:    (p?: any) => api.get('/finance/expenses', { params: p }).then(r => r.data),
  createExpense:   (d: any)  => api.post('/finance/expenses', d).then(r => r.data),
  approveExpense:  (id: string, d: any) => api.patch(`/finance/expenses/${id}/approve`, d).then(r => r.data),
  rejectExpense:   (id: string, d: any) => api.patch(`/finance/expenses/${id}/reject`, d).then(r => r.data),
  payExpense:      (id: string) => api.patch(`/finance/expenses/${id}/pay`).then(r => r.data),
  expenseBreakdown:(p?: any) => api.get('/finance/expenses/breakdown', { params: p }).then(r => r.data),
  // Reports
  profitLoss:      (p?: any) => api.get('/finance/reports/profit-loss', { params: p }).then(r => r.data),
  plTrend:         (p?: any) => api.get('/finance/reports/profit-loss/trend', { params: p }).then(r => r.data),
  cashFlow:        (p?: any) => api.get('/finance/reports/cash-flow', { params: p }).then(r => r.data),
  cashProjection:  (branchId: string) => api.get('/finance/reports/cash-flow/projection', { params: { branchId } }).then(r => r.data),
  // Accounts
  accounts:        () => api.get('/finance/accounts').then(r => r.data),
  // Journals
  journals:        (p?: any) => api.get('/finance/journals', { params: p }).then(r => r.data),
}
