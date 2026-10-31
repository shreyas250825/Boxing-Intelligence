import apiClient from './client'
import type { Boxer, BoxerListItem, PaginatedResponse, SingleResponse } from '../types'

export const listBoxers = (params?: { search?: string; page?: number; page_size?: number }) =>
  apiClient.get<PaginatedResponse<BoxerListItem>>('/api/v1/boxers', { params }).then(r => r.data)

export const getBoxer = (id: string) =>
  apiClient.get<SingleResponse<Boxer>>(`/api/v1/boxers/${id}`).then(r => r.data.data)

export const registerBoxer = (data: Partial<Boxer>) =>
  apiClient.post<SingleResponse<Boxer>>('/api/v1/boxers', data).then(r => r.data.data)

export const updateBoxer = (id: string, data: Partial<Boxer>) =>
  apiClient.put<SingleResponse<Boxer>>(`/api/v1/boxers/${id}`, data).then(r => r.data.data)

export const archiveBoxer = (id: string) =>
  apiClient.post<SingleResponse<Boxer>>(`/api/v1/boxers/${id}/archive`).then(r => r.data.data)
