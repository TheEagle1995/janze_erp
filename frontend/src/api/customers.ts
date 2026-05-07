import api from './client'
export const customersApi = {
  list:        (params?: any)   => api.get('/customers', { params }).then(r => r.data),
  getOne:      (id: string)     => api.get(`/customers/${id}`).then(r => r.data),
  byPhone:     (phone: string)  => api.get(`/customers/phone/${encodeURIComponent(phone)}`).then(r => r.data),
  history:     (id: string, p?: any) => api.get(`/customers/${id}/history`, { params: p }).then(r => r.data),
  create:      (d: any)         => api.post('/customers', d).then(r => r.data),
  update:      (id: string, d: any) => api.put(`/customers/${id}`, d).then(r => r.data),
  adjustPoints:(id: string, d: any) => api.post(`/customers/${id}/points`, d).then(r => r.data),
}
