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

export interface DevelopmentGoal {
  id: string
  boxer_id: string
  title: string
  description: string | null
  start_date: string
  target_date: string | null
  success_criteria: string | null
  assigned_coach: string | null
  status: string
  progress_note: string | null
  completion_percent: number | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface TrainingJournalEntry {
  id: string
  boxer_id: string
  session_date: string
  session_type: string
  duration_minutes: number
  focus: string | null
  what_went_well: string | null
  needs_improvement: string | null
  questions_for_coach: string | null
  notes: string | null
  attachments_json: string | null
  is_private: boolean
  coach_visible: boolean
  created_at: string
  updated_at: string
}

export interface SkillAssessment {
  id: string
  boxer_id: string
  skill_name: string
  current_level: string | null
  development_goal: string | null
  coach_notes: string | null
  video_reference: string | null
  assigned_drill: string | null
  review_history: string | null
  coach_assessed: boolean
  created_at: string
  updated_at: string
}

export interface RecoveryCheckin {
  id: string
  boxer_id: string
  entry_date: string
  energy_level: number | null
  sleep_hours: number | null
  recovery_score: number | null
  soreness_notes: string | null
  stress_level: number | null
  readiness_rating: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CompetitionPlan {
  id: string
  boxer_id: string
  competition_name: string
  competition_date: string
  weight_category: string | null
  timeline: string | null
  milestones: string | null
  coach_checklist: string | null
  equipment_checklist: string | null
  travel_notes: string | null
  post_competition_review: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface DevelopmentDashboard {
  primary_goal: DevelopmentGoal | null
  journal_entries: TrainingJournalEntry[]
  recovery_checkins: RecoveryCheckin[]
  goals: DevelopmentGoal[]
}

export interface NutritionProfile {
  id: string
  boxer_id: string
  age: number | null
  height_cm: number | null
  current_weight_kg: number | null
  target_weight_kg: number | null
  target_competition_weight_category: string | null
  dietary_preferences: string | null
  vegetarian: boolean
  food_allergies: string | null
  foods_to_avoid: string | null
  meal_timing: string | null
  training_schedule: string | null
  nutrition_goals: string | null
  nutritionist_targets: string | null
  target_calories: number | null
  target_protein_g: number | null
  target_carbs_g: number | null
  target_fat_g: number | null
  target_fibre_g: number | null
  created_at: string
  updated_at: string
}

export interface FoodEntry {
  id: string
  boxer_id: string
  entry_date: string
  meal_type: string
  food_name: string
  quantity: string | null
  serving_size: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fibre_g: number
  meal_time: string | null
  notes: string | null
  is_estimate: boolean
  source: string
  created_at: string
}

export interface MealPlan {
  id: string
  boxer_id: string
  title: string
  plan_date: string
  meal_type: string
  foods_json: string | null
  notes: string | null
  adherence_status: string
  assigned_nutritionist: string | null
  created_at: string
  updated_at: string
}

export interface HydrationEntry {
  id: string
  boxer_id: string
  entry_date: string
  drink_name: string
  amount_ml: number
  time_of_day: string | null
  notes: string | null
  created_at: string
}

export interface WeightRecord {
  id: string
  boxer_id: string
  entry_date: string
  weight_kg: number
  is_official: boolean
  notes: string | null
  coach_note: string | null
  nutritionist_note: string | null
  created_at: string
}

export interface SupplementLog {
  id: string
  boxer_id: string
  product_name: string
  dosage: string | null
  timing: string | null
  notes: string | null
  start_date: string | null
  review_date: string | null
  professional_review_required: boolean
  created_at: string
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
