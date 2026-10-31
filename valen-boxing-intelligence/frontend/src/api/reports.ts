import apiClient from './client'
import type { Report, SingleResponse } from '../types'

export const listReports = (boxerId: string) =>
  apiClient.get<SingleResponse<Report[]>>(`/api/v1/boxers/${boxerId}/reports`).then(r => r.data.data)

export const generateReport = (data: { boxer_id: string; session_ids: string[]; title?: string }) =>
  apiClient.post<SingleResponse<{ report_id: string; filename: string }>>('/api/v1/reports', data).then(r => r.data.data)

export const downloadReport = (reportId: string) =>
  `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1/reports/${reportId}/download`
