import apiClient from './client'
import type {
  CompetitionPlan,
  DevelopmentDashboard,
  DevelopmentGoal,
  RecoveryCheckin,
  SkillAssessment,
  TrainingJournalEntry,
  SingleResponse,
} from '../types'

export const getDevelopmentDashboard = (boxerId: string) =>
  apiClient.get<SingleResponse<DevelopmentDashboard>>(`/api/v1/development/boxers/${boxerId}/dashboard`).then((r) => r.data.data)

export const createDevelopmentGoal = (boxerId: string, payload: Partial<DevelopmentGoal>) =>
  apiClient.post<SingleResponse<DevelopmentGoal>>(`/api/v1/development/boxers/${boxerId}/goals`, payload).then((r) => r.data.data)

export const createJournalEntry = (boxerId: string, payload: Partial<TrainingJournalEntry>) =>
  apiClient.post<SingleResponse<TrainingJournalEntry>>(`/api/v1/development/boxers/${boxerId}/journal`, payload).then((r) => r.data.data)

export const createRecoveryCheckin = (boxerId: string, payload: Partial<RecoveryCheckin>) =>
  apiClient.post<SingleResponse<RecoveryCheckin>>(`/api/v1/development/boxers/${boxerId}/recovery-checkins`, payload).then((r) => r.data.data)

export const createSkillAssessment = (boxerId: string, payload: Partial<SkillAssessment>) =>
  apiClient.post<SingleResponse<SkillAssessment>>(`/api/v1/development/boxers/${boxerId}/skill-assessments`, payload).then((r) => r.data.data)

export const createCompetitionPlan = (boxerId: string, payload: Partial<CompetitionPlan>) =>
  apiClient.post<SingleResponse<CompetitionPlan>>(`/api/v1/development/boxers/${boxerId}/competition-plans`, payload).then((r) => r.data.data)
