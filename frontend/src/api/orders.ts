import api from './client'
export const ordersApi = {
  list:        (params?: any) => api.get('/orders', { params }).then(r => r.data),
  getOne:      (id: string)   => api.get(`/orders/${id}`).then(r => r.data),
  create:      (d: any)       => api.post('/orders', d).then(r => r.data),
  refund:      (id: string)   => api.post(`/orders/${id}/refund`).then(r => r.data),
  update:      (id: string, d: any) => api.patch(`/orders/${id}`, d).then(r => r.data),
  finalize:    (id: string)   => api.patch(`/orders/${id}/finalize`).then(r => r.data),
  cancel:      (id: string)   => api.patch(`/orders/${id}/cancel`).then(r => r.data),
  syncOffline: (orders: any[]) => api.post('/orders/sync-offline', { orders }).then(r => r.data),
}
