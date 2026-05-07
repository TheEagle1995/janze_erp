import api from './client'
export const productsApi = {
  list:       (params?: any)          => api.get('/products', { params }).then(r => r.data),
  getOne:     (id: string)            => api.get(`/products/${id}`).then(r => r.data),
  barcode:    (code: string)          => api.get(`/products/barcode/${code}`).then(r => r.data),
  categories: (brand?: string)        => api.get('/products/categories', { params: { brand } }).then(r => r.data),
  create:     (d: any)               => api.post('/products', d).then(r => r.data),
  update:     (id: string, d: any)   => api.put(`/products/${id}`, d).then(r => r.data),
  remove:     (id: string)           => api.delete(`/products/${id}`).then(r => r.data),
  bulkImport: (rows: any[], branchId?: string) =>
    api.post('/products/bulk-import', { rows, branchId }).then(r => r.data),
}
