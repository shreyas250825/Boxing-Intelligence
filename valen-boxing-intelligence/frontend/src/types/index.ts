// All TypeScript interfaces matching backend Pydantic schemas

export interface Boxer {
  id: string
  permanent_id: string
  full_name: string
  date_of_birth: string | null
  weight_class: string | null
  stance: 'orthodox' | 'southpaw' | 'switch'
  experience_level: 'amateur' | 'semi-pro' | 'professional'
  primary_coach: string | null
  training_goals: string | null
  notes: string | null
  status: 'active' | 'archived'
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface BoxerListItem {
  id: string
  permanent_id: string
  full_name: string
  weight_class: string | null
  stance: string
  experience_level: string
  primary_coach: string | null
  status: string
  created_at: string
}

export interface FightCamp {
  id: string
  boxer_id: string
  name: string
  start_date: string
  end_date: string | null
  target_fight_date: string | null
  status: 'planned' | 'active' | 'completed' | 'archived'
  objectives: string | null
  coach_notes: string | null
  created_at: string
  updated_at: string
}

export interface TrainingSession {
  id: string
  boxer_id: string
  fight_camp_id: string | null
  session_type: string
  session_date: string
  rounds: number | null
  round_duration_seconds: number | null
  objectives: string | null
  coach_notes: string | null
  created_at: string
}

export interface Video {
  id: string
  boxer_id: string
  session_id: string | null
  storage_filename: string
  original_filename_safe: string
  mime_type: string
  file_size_bytes: number
  status: string
  uploaded_at: string
}

export interface AnalysisJob {
  id: string
  video_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  queued_at: string
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  result_id: string | null
}

export interface Metric {
  id: string
  metric_key: string
  value: number
  unit: string
  source: 'automated' | 'coach_entered'
  calculation_method: string
  recorded_at: string
}

export interface AnalysisResult {
  id: string
  job_id: string
  video_id: string
  duration_seconds: number
  width_px: number
  height_px: number
  fps: number
  total_frames: number
  sampled_frames: number
  pose_available: boolean
  pose_detected_frames: number
  metrics: Metric[]
  analysed_at: string
}

export type ObservationCategory =
  | 'guard_position'
  | 'stance_and_balance'
  | 'footwork'
  | 'punch_execution'
  | 'return_to_guard'
  | 'defensive_movement'
  | 'timing_and_distance'
  | 'conditioning_related'
  | 'other'

export interface Observation {
  id: string
  video_id: string
  boxer_id: string
  session_id: string | null
  timestamp_seconds: number
  category: ObservationCategory
  description: string
  severity: 'low' | 'medium' | 'high'
  coach_notes: string | null
  recommended_drill: string | null
  review_status: 'pending' | 'reviewed' | 'resolved'
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  boxer_id: string
  storage_filename: string
  title: string
  session_ids_json: string
  generated_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

export interface SingleResponse<T> {
  data: T
  meta: null
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}
