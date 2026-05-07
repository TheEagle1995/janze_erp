import api from './client'

export const debtsApi = {
  list:       (p?: any)              => api.get('/debts', { params: p }).then(r => r.data),
  summary:    (branchId?: string)    => api.get('/debts/summary', { params: { branchId } }).then(r => r.data),
  getOne:     (id: string)           => api.get(`/debts/${id}`).then(r => r.data),
  create:     (d: any)               => api.post('/debts', d).then(r => r.data),
  update:     (id: string, d: any)   => api.put(`/debts/${id}`, d).then(r => r.data),
  remove:     (id: string)           => api.delete(`/debts/${id}`).then(r => r.data),
  addPayment: (id: string, d: any)   => api.post(`/debts/${id}/payments`, d).then(r => r.data),
  markOverdue: ()                    => api.post('/debts/mark-overdue').then(r => r.data),
}
