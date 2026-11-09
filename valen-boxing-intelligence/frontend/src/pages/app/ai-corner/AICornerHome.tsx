/**
 * AI Corner Home — personalised hub for the boxer's AI companion team.
 *
 * Shows:
 * - Selected boxer name + change option
 * - Ollama/AI status banner (real health check, not simulated)
 * - Daily briefing (from actual saved data via AI)
 * - All 8 companions with clear descriptions
 * - Recent conversations
 * - Active goals and challenges
 * - Quick tool links
 *
 * Handles all offline/unconfigured states gracefully.
 * Never shows fake briefing data when AI is offline.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain,
  Zap,
  Target,
  Trophy,
  MessageSquare,
  ChevronRight,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Bot,
  WifiOff,
  Wifi,
  User,
} from 'lucide-react'
import Layout from '../../../components/Layout'
import {
  fetchCornerHome,
  fetchDailyBriefing,
  fetchAIHealth,
  type CornerHome,
  type DailyBriefing,
  type AIHealth,
} from '../../../api/aiCorner'
import { getBoxer } from '../../../api/boxers'

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useBoxerId() {
  const stored = localStorage.getItem('valen-selected-boxer')
  return stored || null
}

// ─── AI Status Banner ─────────────────────────────────────────────────────────

function AIStatusBanner({ health, onRetry }: { health: AIHealth; onRetry: () => void }) {
  if (health.available && health.model_installed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-green-500/20 bg-green-500/5 text-xs text-green-400">
        <Wifi size={12} />
        <span>
          Ollama connected · <span className="font-mono">{health.model}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
      <div className="flex items-start gap-3">
        <WifiOff size={15} className="text-orange-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white mb-1">AI is offline</p>
          <p className="text-xs text-slate-400 mb-2">{health.error}</p>
          <div className="text-xs text-slate-500 space-y-0.5">
            <div>1. Install Ollama: <a href="https://ollama.com/download" className="text-orange-400 underline" target="_blank" rel="noopener noreferrer">ollama.com/download</a></div>
            <div>2. Pull a model: <code className="text-orange-300">ollama pull llama3:latest</code></div>
            <div>3. Start Ollama: <code className="text-orange-300">ollama serve</code></div>
            <div>4. Restart the backend server</div>
          </div>
          <button
            onClick={onRetry}
            className="mt-3 flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition"
          >
            <RefreshCw size={11} /> Retry connection
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-orange-500/10">
        <p className="text-xs text-slate-500">
          AI-free features still work: Learning Centre, Boxing Simulator, stored conversations, goals, challenges.
        </p>
      </div>
    </div>
  )
}

// ─── Companion definitions for fallback render ───────────────────────────────

const COMPANION_DEFS = [
  {
    slug: 'coach-valen', icon: '🥊', name: 'Coach Valen',
    role: 'AI Boxing Coach', color: '#f97316',
    tagline: 'Technique, drills, skill gaps, training plans',
  },
  {
    slug: 'nutricoach', icon: '🥗', name: 'NutriCoach',
    role: 'AI Sports Nutritionist', color: '#22c55e',
    tagline: 'Food diary, meal planning, macros, hydration',
  },
  {
    slug: 'recoverai', icon: '😴', name: 'RecoverAI',
    role: 'AI Recovery Coach', color: '#6366f1',
    tagline: 'Sleep, fatigue, readiness, training load',
  },
  {
    slug: 'corneriq', icon: '🎯', name: 'CornerIQ',
    role: 'AI Fight Strategist', color: '#ef4444',
    tagline: 'Fight prep, round objectives, camp organisation',
  },
  {
    slug: 'visionbox', icon: '📹', name: 'VisionBox AI',
    role: 'AI Video Analyst', color: '#0ea5e9',
    tagline: 'Video analysis results, punch events, annotations',
  },
  {
    slug: 'mindcorner', icon: '🧠', name: 'MindCorner',
    role: 'Mental Performance', color: '#a855f7',
    tagline: 'Daily check-ins, confidence, competition focus',
  },
  {
    slug: 'performancelab', icon: '💪', name: 'PerformanceLab AI',
    role: 'Strength & Conditioning', color: '#f59e0b',
    tagline: 'Fitness assessments, programme drafts, tracking',
  },
  {
    slug: 'boxing-academy', icon: '🎓', name: 'Boxing Academy AI',
    role: 'AI Boxing Mentor', color: '#14b8a6',
    tagline: 'Rules, history, lessons, quizzes, learning paths',
  },
]

// ─── Main component ────────────────────────────────────────────────────────────

export default function AICornerHome() {
  const navigate = useNavigate()
  const boxerId = useBoxerId()

  const [home, setHome] = useState<CornerHome | null>(null)
  const [boxerName, setBoxerName] = useState<string | null>(null)
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null)
  const [briefingMissing, setBriefingMissing] = useState<string[]>([])
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingError, setBriefingError] = useState<string | null>(null)
  const [aiHealth, setAiHealth] = useState<AIHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  const checkHealth = useCallback(() => {
    setHealthLoading(true)
    fetchAIHealth()
      .then(setAiHealth)
      .catch(() => setAiHealth({
        available: false,
        model: 'unknown',
        model_installed: false,
        error: 'Could not reach Ollama. Run: ollama serve',
      }))
      .finally(() => setHealthLoading(false))
  }, [])

  useEffect(() => { checkHealth() }, [checkHealth])

  useEffect(() => {
    if (!boxerId) return
    fetchCornerHome(boxerId).then(setHome).catch(() => {})
    // Load boxer name for header
    getBoxer(boxerId)
      .then((b) => setBoxerName(b.full_name))
      .catch(() => {})
  }, [boxerId])

  const loadBriefing = useCallback(() => {
    if (!boxerId) return
    // Only attempt briefing when AI is online
    if (!aiHealth?.available || !aiHealth?.model_installed) return
    setBriefingLoading(true)
    setBriefingError(null)
    fetchDailyBriefing(boxerId)
      .then((data) => {
        setBriefing(data.briefing)
        setBriefingMissing(data.missing_data)
      })
      .catch((e) => setBriefingError(e.message || 'Briefing failed'))
      .finally(() => setBriefingLoading(false))
  }, [boxerId, aiHealth])

  useEffect(() => {
    if (boxerId && aiHealth?.available && aiHealth?.model_installed) {
      loadBriefing()
    }
  }, [boxerId, aiHealth?.available, aiHealth?.model_installed])

  // ── No boxer selected ──────────────────────────────────────────────────────
  if (!boxerId) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto mt-20 text-center px-4 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/15 flex items-center justify-center mx-auto">
            <Bot size={28} className="text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to AI Corner</h1>
          <p className="text-slate-400">
            Select an athlete profile to unlock your personalised AI companion team — coaching,
            nutrition, recovery, fight preparation and more.
          </p>
          <button onClick={() => navigate('/app/boxers')} className="btn-primary mx-auto">
            Browse Athletes
          </button>
          <p className="text-xs text-slate-600">
            Open any athlete profile and click "AI Corner" to set the active profile.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Brain size={18} className="text-orange-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AI Corner</h1>
              {boxerName && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <User size={10} /> {boxerName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/app/boxers')}
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Change athlete
            </button>
            {!healthLoading && aiHealth && (
              aiHealth.available && aiHealth.model_installed
                ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-400">
                    <Wifi size={11} /> AI ready
                  </div>
                )
                : (
                  <div className="flex items-center gap-1.5 text-xs text-orange-400">
                    <WifiOff size={11} /> AI offline
                  </div>
                )
            )}
          </div>
        </div>

        {/* ── AI Status (shown when offline) ── */}
        {!healthLoading && aiHealth && (!aiHealth.available || !aiHealth.model_installed) && (
          <AIStatusBanner health={aiHealth} onRetry={checkHealth} />
        )}

        {/* ── Daily Briefing ── */}
        <section className="rounded-2xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/40 bg-slate-900/80">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Today's AI Briefing</h2>
            </div>
            <button
              onClick={loadBriefing}
              disabled={briefingLoading || !aiHealth?.available}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition disabled:opacity-30"
              title="Refresh briefing"
            >
              <RefreshCw size={13} className={briefingLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="p-5">
            {/* AI offline state */}
            {!healthLoading && aiHealth && (!aiHealth.available || !aiHealth.model_installed) && (
              <div className="text-center py-4 space-y-2">
                <WifiOff size={20} className="mx-auto text-slate-600" />
                <p className="text-sm text-slate-500">
                  Daily briefing requires Ollama to be running.
                </p>
                <p className="text-xs text-slate-600">
                  Start Ollama, then click the refresh button above.
                </p>
              </div>
            )}

            {/* Loading skeleton */}
            {briefingLoading && !briefing && aiHealth?.available && (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-slate-700/60 rounded w-3/4" />
                <div className="h-3 bg-slate-700/60 rounded w-1/2 mt-2" />
                <div className="h-3 bg-slate-700/60 rounded w-2/3" />
              </div>
            )}

            {/* Error state */}
            {briefingError && !briefingLoading && (
              <div className="flex items-start gap-2 text-sm text-red-400">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>{briefingError}</span>
              </div>
            )}

            {/* Briefing content */}
            {briefing && !briefingLoading && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-white">{briefing.greeting}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <BriefingCard label="Training Today" value={briefing.training_today} />
                  {briefing.recovery_note && <BriefingCard label="Recovery" value={briefing.recovery_note} />}
                  {briefing.nutrition_reminder && <BriefingCard label="Nutrition" value={briefing.nutrition_reminder} />}
                  {briefing.hydration_status && <BriefingCard label="Hydration" value={briefing.hydration_status} />}
                </div>
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Today's Challenge</p>
                  <p className="text-sm text-white">{briefing.development_challenge}</p>
                </div>
                {briefing.ai_insight && (
                  <div className="rounded-xl bg-blue-500/8 border border-blue-500/15 p-3">
                    <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">AI Insight</p>
                    <p className="text-sm text-slate-200">{briefing.ai_insight}</p>
                  </div>
                )}
                {briefingMissing.length > 0 && (
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <AlertCircle size={11} />
                    Missing data: {briefingMissing.slice(0, 3).join(', ')}
                    {briefingMissing.length > 3 ? ` +${briefingMissing.length - 3} more` : ''}
                    {' '}— log more to improve your briefing.
                  </p>
                )}
              </div>
            )}

            {/* No briefing yet, AI is online */}
            {!briefing && !briefingLoading && !briefingError && aiHealth?.available && (
              <div className="text-center py-3 space-y-2">
                <p className="text-sm text-slate-500">No briefing yet for today.</p>
                <button
                  onClick={loadBriefing}
                  className="text-xs text-orange-400 hover:text-orange-300 transition flex items-center gap-1 mx-auto"
                >
                  <Sparkles size={11} /> Generate briefing
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Companion Grid ── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Your AI Team
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(home?.companions?.length ? home.companions : COMPANION_DEFS).map((c) => {
              const def = COMPANION_DEFS.find((d) => d.slug === c.slug) || { tagline: c.role, color: '#f97316' }
              // home.companions items have color_accent; COMPANION_DEFS items have color
              const color = ('color_accent' in c ? (c as any).color_accent : ('color' in def ? def.color : '#f97316')) || '#f97316'
              return (
                <button
                  key={c.slug}
                  onClick={() => navigate(`/app/ai-corner/${c.slug}?boxer=${boxerId}`)}
                  className="group text-left rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 hover:border-slate-600 hover:bg-slate-800/50 transition-all"
                  style={{ borderTopColor: `${color}35`, borderTopWidth: 2 }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 text-lg"
                    style={{ background: `${color}18` }}
                  >
                    {c.icon}
                  </div>
                  <p className="text-sm font-semibold text-white leading-tight">{c.name}</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-tight line-clamp-2">
                    {def.tagline || c.role}
                  </p>
                  <div className="flex items-center gap-1 mt-2.5 text-xs text-slate-600 group-hover:text-orange-400 transition">
                    <MessageSquare size={10} />
                    <span>Start conversation</span>
                    <ChevronRight size={9} />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Recent Conversations ── */}
        {home?.recent_conversations && home.recent_conversations.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Continue a Conversation
              </h2>
              <button
                onClick={() => navigate(`/app/ai-corner/history?boxer=${boxerId}`)}
                className="text-xs text-orange-400 hover:text-orange-300 transition"
              >
                View all
              </button>
            </div>
            <div className="space-y-1.5">
              {home.recent_conversations.slice(0, 3).map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/app/ai-corner/${conv.companion_slug}?boxer=${boxerId}&conversation=${conv.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-700/40 bg-slate-900/50 hover:bg-slate-800/60 hover:border-slate-600 transition text-left"
                >
                  <MessageSquare size={12} className="text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{conv.title}</p>
                    <p className="text-xs text-slate-600 capitalize">
                      {conv.companion_slug.replace(/-/g, ' ')}
                    </p>
                  </div>
                  <span className="text-xs text-slate-600 shrink-0">
                    {new Date(conv.updated_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short',
                    })}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Goals + Challenges ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <section className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={13} className="text-orange-400" />
                <h2 className="text-sm font-semibold text-white">Active Goals</h2>
              </div>
              <button
                onClick={() => navigate(`/app/ai-corner/goals?boxer=${boxerId}`)}
                className="text-xs text-orange-400 hover:text-orange-300 transition"
              >
                Manage
              </button>
            </div>
            {home?.active_goals && home.active_goals.length > 0 ? (
              <div className="space-y-2.5">
                {home.active_goals.slice(0, 3).map((g) => (
                  <div key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-200 truncate flex-1 mr-2">{g.title}</p>
                      <span className="text-xs text-slate-400 shrink-0">{g.completion_percent}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-700">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all duration-300"
                        style={{ width: `${g.completion_percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-xs text-slate-600">No goals yet.</p>
                <button
                  onClick={() => navigate(`/app/ai-corner/goals?boxer=${boxerId}`)}
                  className="mt-1.5 text-xs text-orange-400 hover:text-orange-300 transition flex items-center gap-1 mx-auto"
                >
                  <Zap size={10} /> Set a goal
                </button>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy size={13} className="text-orange-400" />
                <h2 className="text-sm font-semibold text-white">Active Challenges</h2>
              </div>
              <button
                onClick={() => navigate(`/app/ai-corner/challenges?boxer=${boxerId}`)}
                className="text-xs text-orange-400 hover:text-orange-300 transition"
              >
                View all
              </button>
            </div>
            {home?.active_challenges && home.active_challenges.length > 0 ? (
              <div className="space-y-2">
                {home.active_challenges.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 truncate">{c.title}</p>
                      <p className="text-[10px] text-slate-600">by {c.end_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-xs text-slate-600">No active challenges.</p>
                <button
                  onClick={() => navigate(`/app/ai-corner/challenges?boxer=${boxerId}`)}
                  className="mt-1.5 text-xs text-orange-400 hover:text-orange-300 transition flex items-center gap-1 mx-auto"
                >
                  <Zap size={10} /> Generate challenges
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ── Bottom tool grid ── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Ask My Data', icon: '🔍', path: `/app/ai-corner/ask-my-data?boxer=${boxerId}`, needsAI: true },
            { label: 'Weekly Review', icon: '📊', path: `/app/ai-corner/weekly-review?boxer=${boxerId}`, needsAI: true },
            { label: 'Learning Centre', icon: '📚', path: `/app/ai-corner/learning?boxer=${boxerId}`, needsAI: false },
            { label: 'Boxing Simulator', icon: '🥊', path: `/app/ai-corner/simulator?boxer=${boxerId}`, needsAI: false },
          ].map(({ label, icon, path, needsAI }) => {
            const aiOk = aiHealth?.available && aiHealth?.model_installed
            const offline = needsAI && !aiOk
            return (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition text-left
                  ${offline
                    ? 'border-slate-700/30 bg-slate-950/40 opacity-60'
                    : 'border-slate-700/50 bg-slate-900/60 hover:bg-slate-800/50 hover:border-slate-600'}
                `}
                title={offline ? 'Requires Ollama to be running' : ''}
              >
                <span className="text-base">{icon}</span>
                <span className="text-xs font-medium text-slate-300">{label}</span>
                {offline && <WifiOff size={9} className="text-slate-600 ml-auto" />}
              </button>
            )
          })}
        </section>
      </div>
    </Layout>
  )
}

function BriefingCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xs text-slate-200 leading-relaxed">{value}</p>
    </div>
  )
}
