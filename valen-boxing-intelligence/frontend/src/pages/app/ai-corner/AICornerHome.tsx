import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain,
  Zap,
  Target,
  Trophy,
  BookOpen,
  MessageSquare,
  ChevronRight,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Bot,
  Dumbbell,
  Salad,
  Moon,
  Camera,
  Heart,
  GraduationCap,
} from 'lucide-react'
import Layout from '../../../components/Layout'
import { fetchCornerHome, fetchDailyBriefing, type CornerHome, type DailyBriefing } from '../../../api/aiCorner'
import { getStoredAuth } from '../../../api/auth'

const COMPANION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'coach-valen': Dumbbell,
  'nutricoach': Salad,
  'recoverai': Moon,
  'corneriq': Target,
  'visionbox': Camera,
  'mindcorner': Heart,
  'performancelab': Zap,
  'boxing-academy': GraduationCap,
}

// Grabs boxer_id from auth — in production this would come from a selector or user profile
function useBoxerId(): string | null {
  const session = getStoredAuth()
  // Using stored boxer_id if it exists (set after selecting a boxer), else null
  const stored = localStorage.getItem('valen-selected-boxer')
  return stored || null
}

export default function AICornerHome() {
  const navigate = useNavigate()
  const boxerId = useBoxerId()
  const [home, setHome] = useState<CornerHome | null>(null)
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null)
  const [briefingMissing, setBriefingMissing] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!boxerId) return
    setLoading(true)
    fetchCornerHome(boxerId)
      .then(setHome)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [boxerId])

  const loadBriefing = () => {
    if (!boxerId) return
    setBriefingLoading(true)
    fetchDailyBriefing(boxerId)
      .then((data) => {
        setBriefing(data.briefing)
        setBriefingMissing(data.missing_data)
      })
      .catch(() => {})
      .finally(() => setBriefingLoading(false))
  }

  useEffect(() => {
    if (boxerId) loadBriefing()
  }, [boxerId])

  if (!boxerId) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-20 text-center px-4">
          <Bot size={48} className="mx-auto mb-4 text-orange-400" />
          <h1 className="text-2xl font-bold text-white mb-3">Welcome to AI Corner</h1>
          <p className="text-slate-400 mb-6">
            Select a boxer profile to unlock your personalised AI companion team.
          </p>
          <button
            onClick={() => navigate('/app/boxers')}
            className="btn-primary"
          >
            Select a Boxer
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Brain size={22} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Corner</h1>
            <p className="text-sm text-slate-400">Your intelligent boxing support team</p>
          </div>
        </div>

        {/* Daily Briefing */}
        <section className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-orange-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Today's AI Briefing</h2>
            </div>
            <button
              onClick={loadBriefing}
              disabled={briefingLoading}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <RefreshCw size={14} className={briefingLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {briefingLoading && !briefing && (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-3/4" />
              <div className="h-4 bg-slate-700 rounded w-1/2" />
              <div className="h-4 bg-slate-700 rounded w-2/3" />
            </div>
          )}

          {briefing && (
            <div className="space-y-3">
              <p className="text-white font-medium">{briefing.greeting}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <BriefingCard label="Training Today" value={briefing.training_today} />
                {briefing.recovery_note && <BriefingCard label="Recovery" value={briefing.recovery_note} />}
                {briefing.nutrition_reminder && <BriefingCard label="Nutrition" value={briefing.nutrition_reminder} />}
                {briefing.hydration_status && <BriefingCard label="Hydration" value={briefing.hydration_status} />}
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Today's Challenge</p>
                <p className="text-sm text-white">{briefing.development_challenge}</p>
              </div>
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">AI Insight</p>
                <p className="text-sm text-slate-200">{briefing.ai_insight}</p>
              </div>
              {briefingMissing.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span>Missing data: {briefingMissing.slice(0, 3).join(', ')}{briefingMissing.length > 3 ? ` +${briefingMissing.length - 3} more` : ''}</span>
                </div>
              )}
            </div>
          )}

          {!briefing && !briefingLoading && (
            <p className="text-slate-500 text-sm">Briefing could not be loaded. Check your AI configuration.</p>
          )}
        </section>

        {/* Companions Grid */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Your AI Team</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(home?.companions || FALLBACK_COMPANIONS).map((c) => {
              const Icon = COMPANION_ICONS[c.slug] || Bot
              return (
                <button
                  key={c.slug}
                  onClick={() => navigate(`/app/ai-corner/${c.slug}?boxer=${boxerId}`)}
                  className="group rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 text-left hover:border-orange-500/40 hover:bg-slate-800/60 transition-all duration-200"
                  style={{ borderTopColor: `${c.color_accent}40` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-base"
                    style={{ background: `${c.color_accent}20` }}
                  >
                    <span className="text-lg">{c.icon}</span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-tight">{c.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-tight">{c.role}</p>
                  <ChevronRight size={12} className="text-slate-600 group-hover:text-orange-400 transition mt-2" />
                </button>
              )
            })}
          </div>
        </section>

        {/* Continue Conversations */}
        {home?.recent_conversations && home.recent_conversations.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Continue a Conversation</h2>
              <button
                onClick={() => navigate(`/app/ai-corner/history?boxer=${boxerId}`)}
                className="text-xs text-orange-400 hover:text-orange-300 transition"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {home.recent_conversations.slice(0, 4).map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/app/ai-corner/${conv.companion_slug}?boxer=${boxerId}&conversation=${conv.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-900/60 hover:bg-slate-800/60 hover:border-slate-600 transition text-left"
                >
                  <MessageSquare size={14} className="text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{conv.title}</p>
                    <p className="text-xs text-slate-500">{conv.companion_slug.replace(/-/g, ' ')}</p>
                  </div>
                  <p className="text-xs text-slate-600 shrink-0">
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Goals + Challenges row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Goals */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-orange-400" />
                <h2 className="text-sm font-semibold text-white">Active Goals</h2>
              </div>
              <button
                onClick={() => navigate(`/app/ai-corner/goals?boxer=${boxerId}`)}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                Manage
              </button>
            </div>
            {home?.active_goals && home.active_goals.length > 0 ? (
              <div className="space-y-2">
                {home.active_goals.slice(0, 3).map((g) => (
                  <div key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-200 truncate">{g.title}</p>
                      <span className="text-xs text-slate-400 shrink-0 ml-2">{g.completion_percent}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all"
                        style={{ width: `${g.completion_percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No active goals. Set one to get started.</p>
            )}
            <button
              onClick={() => navigate(`/app/ai-corner/goals?boxer=${boxerId}`)}
              className="mt-3 text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 transition"
            >
              <Zap size={10} /> Add a goal
            </button>
          </section>

          {/* Challenges */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy size={14} className="text-orange-400" />
                <h2 className="text-sm font-semibold text-white">Active Challenges</h2>
              </div>
              <button
                onClick={() => navigate(`/app/ai-corner/challenges?boxer=${boxerId}`)}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                View all
              </button>
            </div>
            {home?.active_challenges && home.active_challenges.length > 0 ? (
              <div className="space-y-2">
                {home.active_challenges.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    <p className="text-sm text-slate-200 truncate flex-1">{c.title}</p>
                    <span className="text-xs text-slate-500 shrink-0">by {c.end_date}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No active challenges.</p>
            )}
          </section>
        </div>

        {/* Bottom quick-links row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Ask My Data', icon: '🔍', path: `/app/ai-corner/ask-my-data?boxer=${boxerId}` },
            { label: 'Weekly Review', icon: '📊', path: `/app/ai-corner/weekly-review?boxer=${boxerId}` },
            { label: 'Learning Centre', icon: '📚', path: `/app/ai-corner/learning?boxer=${boxerId}` },
            { label: 'Boxing Simulator', icon: '🥊', path: `/app/ai-corner/simulator?boxer=${boxerId}` },
          ].map(({ label, icon, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-900/60 hover:bg-slate-800/50 hover:border-slate-600 transition text-left"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-sm font-medium text-slate-200">{label}</span>
            </button>
          ))}
        </section>
      </div>
    </Layout>
  )
}

function BriefingCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  )
}

const FALLBACK_COMPANIONS = [
  { slug: 'coach-valen', name: 'Coach Valen', role: 'AI Boxing Coach', icon: '🥊', color_accent: '#f97316' },
  { slug: 'nutricoach', name: 'NutriCoach', role: 'AI Nutritionist', icon: '🥗', color_accent: '#22c55e' },
  { slug: 'recoverai', name: 'RecoverAI', role: 'Recovery Coach', icon: '😴', color_accent: '#6366f1' },
  { slug: 'corneriq', name: 'CornerIQ', role: 'Fight Strategist', icon: '🎯', color_accent: '#ef4444' },
  { slug: 'visionbox', name: 'VisionBox AI', role: 'Video Analyst', icon: '📹', color_accent: '#0ea5e9' },
  { slug: 'mindcorner', name: 'MindCorner', role: 'Mental Performance', icon: '🧠', color_accent: '#a855f7' },
  { slug: 'performancelab', name: 'PerformanceLab AI', role: 'S&C Coach', icon: '💪', color_accent: '#f59e0b' },
  { slug: 'boxing-academy', name: 'Boxing Academy AI', role: 'AI Mentor', icon: '🎓', color_accent: '#14b8a6' },
]
