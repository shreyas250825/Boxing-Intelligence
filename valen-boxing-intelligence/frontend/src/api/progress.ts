import apiClient from './client'
import type { TrainingSession, PaginatedResponse, SingleResponse } from '../types'

export interface ProgressDataPoint {
  session_date: string
  value: number
  session_type: string
  source_note: string
  metric_key: string
}

export const getProgress = (boxerId: string, params?: { start_date?: string; end_date?: string }) =>
  apiClient.get<SingleResponse<Record<string, ProgressDataPoint[]>>>(`/api/v1/boxers/${boxerId}/progress`, { params }).then(r => r.data.data)

export const getSessions = (boxerId: string, params?: { page?: number; page_size?: number }) =>
  apiClient.get<PaginatedResponse<TrainingSession>>(`/api/v1/boxers/${boxerId}/sessions`, { params }).then(r => r.data)
