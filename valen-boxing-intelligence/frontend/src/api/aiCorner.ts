/**
 * AI Corner API client.
 *
 * All calls go through the shared axios instance which injects auth headers.
 * Streaming responses use fetch directly (axios does not support SSE streaming).
 */
import apiClient from './client'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const API = '/api/v1/ai'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Companion {
  slug: string
  name: string
  role: string
  description: string
  icon: string
  color_accent: string
  min_role: string
  capabilities: string[]
  quick_actions: QuickAction[]
  suggested_prompts: string[]
}

export interface QuickAction {
  id: string
  label: string
  action_type: string
}

export interface Conversation {
  id: string
  companion_slug: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  content_type: string
  feedback: string | null
  is_saved: boolean
  created_at: string
  prompt_tokens?: number
  completion_tokens?: number
}

export interface ChatResponse {
  conversation_id: string
  message_id: string
  content: string
  prompt_tokens?: number
  completion_tokens?: number
}

export interface AIMemory {
  id: string
  companion_slug: string
  memory_key: string
  memory_value: string
  origin: string
  updated_at: string
}

export interface AIGoal {
  id: string
  title: string
  description?: string
  category: string
  status: string
  completion_percent: number
  target_date?: string
  milestones: Milestone[]
  created_at: string
}

export interface Milestone {
  title: string
  target_date?: string | null
  completed: boolean
}

export interface AIChallenge {
  id: string
  title: string
  description?: string
  challenge_type: string
  category: string
  start_date: string
  end_date: string
  status: string
  completed_at?: string | null
}

export interface DailyBriefing {
  greeting: string
  training_today: string
  recovery_note?: string | null
  nutrition_reminder?: string | null
  hydration_status?: string | null
  upcoming_competitions: string[]
  recommended_activity: string
  development_challenge: string
  reminders: string[]
  ai_insight: string
}

export interface WeeklyReview {
  summary: string
  completed_sessions: number
  missed_sessions: string
  training_volume: string
  nutrition_summary: string
  hydration_summary: string
  recovery_summary: string
  achievements: string[]
  areas_for_attention: string[]
  next_week_priorities: string[]
  data_available: string[]
  data_missing: string[]
}

export interface SimulatorScenario {
  slug: string
  title: string
  difficulty: string
  description: string
  total_steps: number
}

export interface SimulatorStep {
  step_index: number
  scenario_text: string
  options: string[]
}

export interface SimulatorAnswerResult {
  correct: boolean
  correct_index: number
  feedback: string
  is_last_step: boolean
  educational_note: string
}

export interface LearningLesson {
  id: string
  slug: string
  title: string
  category: string
  difficulty: string
  estimated_minutes: number
  has_quiz: boolean
  content?: string
  quiz?: QuizQuestion[] | null
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

export interface SavedCombination {
  id: string
  title: string
  description?: string
  punches: string[]
  difficulty: string
  category: string
  is_coach_assigned: boolean
  coach_notes?: string | null
}

export interface CollaborationFinding {
  companion_slug: string
  companion_name: string
  finding: string
  missing_data?: string | null
  status: string
}

export interface CollaborationResult {
  session_id: string
  question: string
  companions_involved: string[]
  findings: CollaborationFinding[]
  consolidated_report: string
}

export interface CornerHome {
  boxer_id: string
  today: string
  companions: { slug: string; name: string; role: string; icon: string; color_accent: string }[]
  recent_conversations: { id: string; companion_slug: string; title: string; updated_at: string }[]
  active_goals: { id: string; title: string; completion_percent: number; category: string }[]
  active_challenges: { id: string; title: string; category: string; end_date: string }[]
  learning_progress: { total_lessons: number; completed_lessons: number }
  pending_action_proposals: number
}

// ─── Companion API ─────────────────────────────────────────────────────────

export async function fetchCompanions(): Promise<Companion[]> {
  const res = await apiClient.get(`${API}/companions`)
  return res.data.companions
}

export async function fetchCompanion(slug: string): Promise<Companion> {
  const res = await apiClient.get(`${API}/companions/${slug}`)
  return res.data
}

// ─── Conversations ─────────────────────────────────────────────────────────

export async function fetchConversations(boxerId: string, companionSlug?: string): Promise<Conversation[]> {
  const params = companionSlug ? `?companion_slug=${companionSlug}` : ''
  const res = await apiClient.get(`${API}/boxers/${boxerId}/conversations${params}`)
  return res.data.conversations
}

export async function fetchConversationMessages(conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  const res = await apiClient.get(`${API}/conversations/${conversationId}/messages`)
  return res.data
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await apiClient.delete(`${API}/conversations/${conversationId}`)
}

export async function updateConversation(conversationId: string, data: { title?: string; is_archived?: boolean }): Promise<void> {
  await apiClient.patch(`${API}/conversations/${conversationId}`, data)
}

// ─── Chat ──────────────────────────────────────────────────────────────────

export async function sendMessage(
  companionSlug: string,
  boxerId: string,
  message: string,
  conversationId?: string,
): Promise<ChatResponse> {
  const res = await apiClient.post(`${API}/chat/${companionSlug}`, {
    boxer_id: boxerId,
    message,
    conversation_id: conversationId || null,
    stream: false,
  })
  return res.data
}

/**
 * Streaming chat — returns an async generator that yields string deltas.
 */
export async function* streamMessage(
  companionSlug: string,
  boxerId: string,
  message: string,
  conversationId?: string,
): AsyncGenerator<string, void, unknown> {
  const stored = localStorage.getItem('valen-auth')
  const token = stored ? JSON.parse(stored).token : ''

  const response = await fetch(`${BASE}${API}/chat/${companionSlug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      boxer_id: boxerId,
      message,
      conversation_id: conversationId || null,
      stream: true,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Stream request failed: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          if (parsed.delta) yield parsed.delta
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}

// ─── Message actions ───────────────────────────────────────────────────────

export async function submitFeedback(messageId: string, feedback: 'thumbs_up' | 'thumbs_down'): Promise<void> {
  await apiClient.patch(`${API}/messages/${messageId}/feedback`, { feedback })
}

export async function toggleSaveMessage(messageId: string): Promise<{ is_saved: boolean }> {
  const res = await apiClient.patch(`${API}/messages/${messageId}/save`, {})
  return res.data
}

// ─── Memory ───────────────────────────────────────────────────────────────

export async function fetchMemories(boxerId: string, companionSlug?: string): Promise<AIMemory[]> {
  const params = companionSlug ? `?companion_slug=${companionSlug}` : ''
  const res = await apiClient.get(`${API}/boxers/${boxerId}/memory${params}`)
  return res.data.memories
}

export async function createMemory(data: {
  boxer_id: string
  companion_slug: string
  memory_key: string
  memory_value: string
  origin?: string
}): Promise<{ id: string }> {
  const res = await apiClient.post(`${API}/memory`, data)
  return res.data
}

export async function deleteMemory(memoryId: string): Promise<void> {
  await apiClient.delete(`${API}/memory/${memoryId}`)
}

export async function updateMemory(memoryId: string, value: string): Promise<void> {
  await apiClient.patch(`${API}/memory/${memoryId}`, { memory_value: value })
}

// ─── Goals ────────────────────────────────────────────────────────────────

export async function fetchAIGoals(boxerId: string): Promise<AIGoal[]> {
  const res = await apiClient.get(`${API}/boxers/${boxerId}/ai-goals`)
  return res.data.goals
}

export async function createAIGoal(data: {
  boxer_id: string
  title: string
  description?: string
  category?: string
  target_date?: string
}): Promise<{ id: string; milestones: Milestone[] }> {
  const res = await apiClient.post(`${API}/goals`, data)
  return res.data
}

export async function updateAIGoal(goalId: string, data: Partial<{
  title: string
  description: string
  status: string
  completion_percent: number
  milestones: Milestone[]
}>): Promise<void> {
  await apiClient.patch(`${API}/goals/${goalId}`, data)
}

export async function deleteAIGoal(goalId: string): Promise<void> {
  await apiClient.delete(`${API}/goals/${goalId}`)
}

// ─── Daily Briefing ───────────────────────────────────────────────────────

export async function fetchDailyBriefing(boxerId: string, date?: string): Promise<{
  date: string
  briefing: DailyBriefing
  missing_data: string[]
  generated_at: string
  from_cache: boolean
}> {
  const params = date ? `?briefing_date=${date}` : ''
  const res = await apiClient.get(`${API}/boxers/${boxerId}/daily-briefing${params}`)
  return res.data
}

// ─── Weekly Review ────────────────────────────────────────────────────────

export async function fetchWeeklyReview(boxerId: string, weekStart?: string): Promise<{
  week_start: string
  week_end: string
  review: WeeklyReview
  missing_data: string[]
  generated_at: string
  from_cache: boolean
}> {
  const params = weekStart ? `?week_start=${weekStart}` : ''
  const res = await apiClient.get(`${API}/boxers/${boxerId}/weekly-review${params}`)
  return res.data
}

// ─── Challenges ───────────────────────────────────────────────────────────

export async function fetchChallenges(boxerId: string): Promise<AIChallenge[]> {
  const res = await apiClient.get(`${API}/boxers/${boxerId}/challenges`)
  return res.data.challenges
}

export async function generateChallenges(boxerId: string): Promise<{ generated: number; challenges: { id: string; title: string }[] }> {
  const res = await apiClient.post(`${API}/boxers/${boxerId}/generate-challenges`, {})
  return res.data
}

export async function updateChallengeStatus(challengeId: string, status: string): Promise<void> {
  await apiClient.patch(`${API}/challenges/${challengeId}`, { status })
}

// ─── Learning Centre ──────────────────────────────────────────────────────

export async function fetchLessons(category?: string, difficulty?: string): Promise<LearningLesson[]> {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (difficulty) params.set('difficulty', difficulty)
  const qs = params.toString() ? `?${params}` : ''
  const res = await apiClient.get(`${API}/lessons${qs}`)
  return res.data.lessons
}

export async function fetchLesson(lessonId: string): Promise<LearningLesson> {
  const res = await apiClient.get(`${API}/lessons/${lessonId}`)
  return res.data
}

export async function fetchLearningProgress(boxerId: string): Promise<{
  lesson_id: string
  status: string
  quiz_score?: number
  completed_at?: string
}[]> {
  const res = await apiClient.get(`${API}/boxers/${boxerId}/learning-progress`)
  return res.data.progress
}

export async function updateLessonProgress(
  boxerId: string,
  lessonId: string,
  status: 'in_progress' | 'completed',
  quizScore?: number,
): Promise<void> {
  await apiClient.post(`${API}/boxers/${boxerId}/lessons/${lessonId}/progress`, {
    status,
    quiz_score: quizScore ?? null,
  })
}

// ─── Simulator ────────────────────────────────────────────────────────────

export async function fetchSimulatorScenarios(): Promise<SimulatorScenario[]> {
  const res = await apiClient.get(`${API}/simulator/scenarios`)
  return res.data.scenarios
}

export async function fetchSimulatorScenario(slug: string): Promise<{
  slug: string
  title: string
  difficulty: string
  description: string
  steps: SimulatorStep[]
}> {
  const res = await apiClient.get(`${API}/simulator/scenarios/${slug}`)
  return res.data
}

export async function submitSimulatorAnswer(data: {
  boxer_id: string
  scenario_slug: string
  step_index: number
  chosen_option_index: number
}): Promise<SimulatorAnswerResult> {
  const res = await apiClient.post(`${API}/simulator/answer`, data)
  return res.data
}

// ─── Combinations ─────────────────────────────────────────────────────────

export async function fetchCombinations(boxerId: string): Promise<SavedCombination[]> {
  const res = await apiClient.get(`${API}/boxers/${boxerId}/combinations`)
  return res.data.combinations
}

export async function createCombination(data: {
  boxer_id: string
  title: string
  description?: string
  punches: string[]
  difficulty?: string
  category?: string
}): Promise<{ id: string }> {
  const res = await apiClient.post(`${API}/combinations`, data)
  return res.data
}

export async function deleteCombination(comboId: string): Promise<void> {
  await apiClient.delete(`${API}/combinations/${comboId}`)
}

export async function generateCombinations(boxerId: string): Promise<{ generated: number }> {
  const res = await apiClient.post(`${API}/boxers/${boxerId}/generate-combinations`, {})
  return res.data
}

// ─── AI Collaboration ─────────────────────────────────────────────────────

export async function startCollaboration(data: {
  boxer_id: string
  question: string
  companion_slugs?: string[]
}): Promise<CollaborationResult> {
  const res = await apiClient.post(`${API}/collaborate`, data)
  return res.data
}

// ─── Ask My Data ─────────────────────────────────────────────────────────

export async function askMyData(data: {
  boxer_id: string
  question: string
}): Promise<{ question: string; answer: string; data_sources: Record<string, number>; query_date: string }> {
  const res = await apiClient.post(`${API}/ask-my-data`, data)
  return res.data
}

// ─── Corner Home ──────────────────────────────────────────────────────────

export async function fetchCornerHome(boxerId: string): Promise<CornerHome> {
  const res = await apiClient.get(`${API}/boxers/${boxerId}/corner-home`)
  return res.data
}

// ─── Voice ────────────────────────────────────────────────────────────────

export async function saveVoiceTranscript(data: {
  boxer_id: string
  companion_slug: string
  conversation_id?: string
  transcript: string
  language?: string
}): Promise<{ id: string }> {
  const res = await apiClient.post(`${API}/voice-transcripts`, data)
  return res.data
}
