import api from './client'
export const branchesApi = {
  list:   ()              => api.get('/branches').then(r => r.data),
  getOne: (id: string)    => api.get(`/branches/${id}`).then(r => r.data),
  create: (d: any)        => api.post('/branches', d).then(r => r.data),
  update: (id: string, d: any) => api.put(`/branches/${id}`, d).then(r => r.data),
}
