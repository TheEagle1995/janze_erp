import api from './client'
export const usersApi = {
  list:           (params?: any)        => api.get('/users', { params }).then(r => r.data),
  getOne:         (id: string)           => api.get(`/users/${id}`).then(r => r.data),
  create:         (d: any)              => api.post('/users', d).then(r => r.data),
  update:         (id: string, d: any)  => api.put(`/users/${id}`, d).then(r => r.data),
  updateProfile:  (d: { name?: string; email?: string }) => api.patch('/users/me', d).then(r => r.data),
  changePassword: (d: { currentPassword: string; newPassword: string }) => api.patch('/users/me/password', d).then(r => r.data),
}
