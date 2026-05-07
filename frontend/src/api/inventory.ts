import api from './client'
export const inventoryApi = {
  list:      (params?: any) => api.get('/inventory', { params }).then(r => r.data),
  lowStock:  (branchId?: string) => api.get('/inventory/low-stock', { params: { branchId } }).then(r => r.data),
  movements: (params?: any) => api.get('/inventory/movements', { params }).then(r => r.data),
  adjust:    (d: any)       => api.patch('/inventory/adjust', d).then(r => r.data),
  transfer:  (d: any)       => api.post('/inventory/transfer', d).then(r => r.data),
}
