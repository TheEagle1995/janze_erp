import api from './client'

export const employeesApi = {
  list:        (p?: any)              => api.get('/employees', { params: p }).then(r => r.data),
  getOne:      (id: string)           => api.get(`/employees/${id}`).then(r => r.data),
  create:      (d: any)               => api.post('/employees', d).then(r => r.data),
  update:      (id: string, d: any)   => api.put(`/employees/${id}`, d).then(r => r.data),
  remove:      (id: string)           => api.delete(`/employees/${id}`).then(r => r.data),
  checkIn:     (id: string, notes?: string) => api.post(`/employees/${id}/check-in`, { notes }).then(r => r.data),
  checkOut:    (id: string, notes?: string) => api.post(`/employees/${id}/check-out`, { notes }).then(r => r.data),
  timesheet:   (id: string, p?: any)  => api.get(`/employees/${id}/timesheet`, { params: p }).then(r => r.data),
  performance: (id: string, p?: any)  => api.get(`/employees/${id}/performance`, { params: p }).then(r => r.data),
}
