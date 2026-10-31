import apiClient from './client'
import type { AnalysisJob, AnalysisResult, SingleResponse } from '../types'

export const enqueueAnalysis = (videoId: string, config?: { frame_interval_seconds?: number; max_frames?: number }) =>
  apiClient.post<SingleResponse<AnalysisJob>>(`/api/v1/videos/${videoId}/analyse`, config || {}).then(r => r.data.data)

export const getAnalysisJob = (jobId: string) =>
  apiClient.get<SingleResponse<AnalysisJob>>(`/api/v1/analysis-jobs/${jobId}`).then(r => r.data.data)

export const getAnalysisResult = (resultId: string) =>
  apiClient.get<SingleResponse<AnalysisResult>>(`/api/v1/analysis-results/${resultId}`).then(r => r.data.data)

export const cancelAnalysisJob = (jobId: string) =>
  apiClient.delete(`/api/v1/analysis-jobs/${jobId}`)

// ── Browser Video Analysis ───────────────────────────────────────────────────

export interface ActivityPoint { t: number; v: number }
export interface ActivityBurst { start: number; end: number; peak: number; duration: number }
export interface ActionEvent {
  id: string; timestamp: number; action_type: string; label: string
  note?: string; round_num?: number; boxer_label?: string
}
export interface ROIConfig { x: number; y: number; width: number; height: number; enabled: boolean }
export interface RoundConfig { num_rounds: number; round_duration: number; rest_duration: number; start_offset: number }
export interface CoachSummary {
  went_well?: string; needs_improvement?: string; technical_issues?: string
  recommended_drills?: string; next_session_objectives?: string
}

export interface TrackingSamplePayload {
  t: number; cx: number; cy: number; x: number; y: number; w: number; h: number
  confidence: number; status: string; displacement: number
  valid_points: number; camera_reliable: boolean
}

export interface BoxerTrackPayload {
  label: string; boxer_id: string; name: string; color: string
  bbox: { x: number; y: number; w: number; h: number } | null
  identify_time?: number
  identify_video_width?: number
  identify_video_height?: number
  total_movement: number; valid_sample_count: number
  samples: TrackingSamplePayload[] // timestamped LK samples; displacement is image-plane normalized
  loss_intervals: { start: number; end: number | null; reason: string }[]
}

export interface TrackingPayload {
  version: string
  measurement: string
  camera_compensated: boolean
  video_width: number
  video_height: number
  report_status?: string
  completed_at?: string | null
  report?: unknown
  boxers: BoxerTrackPayload[]
}

export interface BrowserAnalysis {
  id: string; video_id: string; boxer_id: string; fight_camp_id: string | null
  average_visual_activity: number | null; peak_visual_activity: number | null
  processed_frames: number; duration_seconds: number | null
  activity_series_json: string | null; activity_bursts_json: string | null
  action_events_json: string | null; roi_config_json: string | null
  round_config_json: string | null; coach_summary_json: string | null
  tracking_json: string | null
  report_json: string | null
  report_status: string | null
  completed_at: string | null
  methodology_version: string; created_at: string; updated_at: string
}

export interface SaveBrowserAnalysisPayload {
  video_id: string; boxer_id: string; fight_camp_id?: string
  average_visual_activity?: number; peak_visual_activity?: number
  processed_frames?: number; duration_seconds?: number
  activity_series?: ActivityPoint[]; activity_bursts?: ActivityBurst[]
  action_events?: ActionEvent[]; roi_config?: ROIConfig
  round_config?: RoundConfig; coach_summary?: CoachSummary
  tracking?: TrackingPayload
  report?: unknown
  report_status?: string
  completed_at?: string | null
}

export const saveBrowserAnalysis = (videoId: string, payload: SaveBrowserAnalysisPayload) =>
  apiClient.post<SingleResponse<BrowserAnalysis>>(`/api/v1/videos/${videoId}/browser-analysis`, payload)
    .then(r => r.data.data)

export const getBrowserAnalysis = (videoId: string) =>
  apiClient.get<SingleResponse<BrowserAnalysis | null>>(`/api/v1/videos/${videoId}/browser-analysis`)
    .then(r => r.data.data)

export const updateBrowserAnalysis = (analysisId: string, payload: Partial<SaveBrowserAnalysisPayload>) =>
  apiClient.put<SingleResponse<BrowserAnalysis>>(`/api/v1/browser-analyses/${analysisId}`, payload)
    .then(r => r.data.data)