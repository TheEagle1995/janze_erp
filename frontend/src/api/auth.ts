import api from './client'
export const authApi = {
  login:    (email: string, password: string) => api.post('/auth/login', { email, password }).then(r => r.data),
  loginPin: (branchId: string, pin: string)   => api.post('/auth/login/pin', { branchId, pin }).then(r => r.data),
  refresh:  (refreshToken: string)             => api.post('/auth/refresh', { refreshToken }).then(r => r.data),
  logout:   (refreshToken: string)             => api.post('/auth/logout', { refreshToken }),
}
