import api from './client'

export const suppliersApi = {
  list:      ()                      => api.get('/suppliers').then(r => r.data),
  getOne:    (id: string)            => api.get(`/suppliers/${id}`).then(r => r.data),
  create:    (d: any)                => api.post('/suppliers', d).then(r => r.data),
  update:    (id: string, d: any)    => api.put(`/suppliers/${id}`, d).then(r => r.data),

  // Purchase Orders
  listPOs:   (params?: any)          => api.get('/suppliers/purchase-orders', { params }).then(r => r.data),
  createPO:  (supplierId: string, d: any) => api.post(`/suppliers/${supplierId}/purchase-orders`, d).then(r => r.data),
  receivePO: (poId: string)          => api.patch(`/suppliers/purchase-orders/${poId}/receive`).then(r => r.data),

  // Product insights
  insights:  ()                      => api.get('/suppliers/insights').then(r => r.data),
}
