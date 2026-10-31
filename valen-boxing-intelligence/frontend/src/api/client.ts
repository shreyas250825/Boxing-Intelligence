import axios, { AxiosError } from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Unwrap the success envelope automatically
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error: { code: string; message: string; details?: unknown } }>) => {
    const apiErr = error.response?.data?.error
    if (apiErr) {
      const e = new Error(apiErr.message) as Error & { code: string; details: unknown }
      e.code = apiErr.code
      e.details = apiErr.details
      return Promise.reject(e)
    }
    return Promise.reject(error)
  }
)

export default apiClient
