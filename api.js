import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 90000,
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      localStorage.removeItem('smart-ai-auth')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
