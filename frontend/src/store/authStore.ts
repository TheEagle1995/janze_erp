import { create } from 'zustand'
import { authApi } from '../lib/api'

interface User {
  id: string
  name: string
  email: string
  role: string
  branchId: string | null
  branch?: { id: string; name: string; brand: string } | null
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginPin: (branchId: string, pin: string) => Promise<void>
  logout: () => Promise<void>
  init: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:      null,
  token:     null,
  isLoading: false,

  init() {
    const token = localStorage.getItem('access_token')
    const raw   = localStorage.getItem('auth_user')
    if (token && raw) {
      try {
        set({ token, user: JSON.parse(raw) })
      } catch {}
    }
  },

  async login(email, password) {
    set({ isLoading: true })
    try {
      const data = await authApi.login(email, password)
      localStorage.setItem('access_token',  data.accessToken)
      localStorage.setItem('refresh_token', data.refreshToken)
      localStorage.setItem('auth_user',     JSON.stringify(data.user))
      set({ user: data.user, token: data.accessToken, isLoading: false })
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },

  async loginPin(branchId, pin) {
    set({ isLoading: true })
    try {
      const data = await authApi.loginPin(branchId, pin)
      localStorage.setItem('access_token',  data.accessToken)
      localStorage.setItem('refresh_token', data.refreshToken)
      localStorage.setItem('auth_user',     JSON.stringify(data.user))
      set({ user: data.user, token: data.accessToken, isLoading: false })
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },

  async logout() {
    const refresh = localStorage.getItem('refresh_token')
    if (refresh) authApi.logout(refresh).catch(() => {})
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    set({ user: null, token: null })
  },
}))
