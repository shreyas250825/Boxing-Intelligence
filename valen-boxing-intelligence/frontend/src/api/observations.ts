import apiClient from './client'
import type { Observation, SingleResponse } from '../types'

export const listObservations = (videoId: string) =>
  apiClient.get<SingleResponse<Observation[]>>(`/api/v1/videos/${videoId}/observations`).then(r => r.data.data)

export const createObservation = (data: Partial<Observation>) =>
  apiClient.post<SingleResponse<Observation>>('/api/v1/observations', data).then(r => r.data.data)

export const updateObservation = (id: string, data: Partial<Observation>) =>
  apiClient.put<SingleResponse<Observation>>(`/api/v1/observations/${id}`, data).then(r => r.data.data)

export const deleteObservation = (id: string) =>
  apiClient.delete(`/api/v1/observations/${id}`)
