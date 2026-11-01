import apiClient from './client'

export type AuthUser = {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  email_verified: boolean
}

export type AuthSession = {
  token: string
  user: AuthUser
}

export const AUTH_KEY = 'valen-auth'

export function getStoredAuth(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) as AuthSession : null
  } catch {
    localStorage.removeItem(AUTH_KEY)
    return null
  }
}

export function setStoredAuth(session: AuthSession) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY)
}

export async function registerUser(payload: { full_name: string; email: string; password: string; role?: string }) {
  const response = await apiClient.post('/api/v1/auth/register', payload)
  const session = response.data.data as AuthSession
  setStoredAuth(session)
  return session
}

export async function loginUser(payload: { email: string; password: string }) {
  const response = await apiClient.post('/api/v1/auth/login', payload)
  const session = response.data.data as AuthSession
  setStoredAuth(session)
  return session
}

export async function fetchCurrentUser() {
  const response = await apiClient.get('/api/v1/auth/me')
  return response.data.data as AuthUser
}

export async function forgotPassword(email: string) {
  const response = await apiClient.post('/api/v1/auth/forgot-password', { email })
  return response.data.data
}
