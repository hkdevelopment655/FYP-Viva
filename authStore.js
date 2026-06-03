import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,

      login: async (email, password) => {
        set({ loading: true })
        const res = await api.post('/auth/login', { email, password })
        const { token, user } = res.data
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        set({ user, token, isAuthenticated: true, loading: false })
        return user
      },

      register: async (username, email, password) => {
        set({ loading: true })
        const res = await api.post('/auth/register', { username, email, password })
        const { token, user } = res.data
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        set({ user, token, isAuthenticated: true, loading: false })
        return user
      },

      socialLogin: async (provider, email, username, avatar, providerId) => {
        set({ loading: true })
        try {
          const res = await api.post('/auth/social-login', { provider, email, username, avatar, providerId })
          const { token, user } = res.data
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          set({ user, token, isAuthenticated: true, loading: false })
          return user
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization']
        set({ user: null, token: null, isAuthenticated: false })
      },

      initAuth: () => {
        const { token } = get()
        if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      }
    }),
    { name: 'smart-ai-auth', partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }) }
  )
)
