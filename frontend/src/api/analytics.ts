import api from './client'
export const analyticsApi = {
  dashboard:      (params?: any) => api.get('/analytics/dashboard',       { params }).then(r => r.data),
  salesChart:     (params?: any) => api.get('/analytics/sales-chart',     { params }).then(r => r.data),
  topProducts:    (params?: any) => api.get('/analytics/top-products',    { params }).then(r => r.data),
  slowMovers:     (params?: any) => api.get('/analytics/slow-movers',     { params }).then(r => r.data),
  profitLoss:     (params?: any) => api.get('/analytics/profit-loss',     { params }).then(r => r.data),
  byEmployee:     (params?: any) => api.get('/analytics/by-employee',     { params }).then(r => r.data),
  paymentMethods: (params?: any) => api.get('/analytics/payment-methods', { params }).then(r => r.data),
  byBranch:       (params?: any) => api.get('/analytics/by-branch',       { params }).then(r => r.data),
  hourlyStats:    (params?: any) => api.get('/analytics/hourly-stats',    { params }).then(r => r.data),
  weekdayStats:   (params?: any) => api.get('/analytics/weekday-stats',   { params }).then(r => r.data),
}
