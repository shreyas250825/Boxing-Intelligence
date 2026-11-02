import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Trophy,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  RotateCcw,
} from 'lucide-react'
import Layout from '../../../components/Layout'
import {
  fetchChallenges,
  generateChallenges,
  updateChallengeStatus,
  type AIChallenge,
} from '../../../api/aiCorner'

const CATEGORY_COLORS: Record<string, string> = {
  training: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  nutrition: 'text-green-400 bg-green-500/10 border-green-500/20',
  recovery: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  learning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  mindset: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-slate-400' },
  in_progress: { label: 'In Progress', color: 'text-orange-400' },
  completed: { label: 'Completed', color: 'text-green-400' },
  failed: { label: 'Failed', color: 'text-red-400' },
  expired: { label: 'Expired', color: 'text-slate-600' },
}

export default function AIChallenges() {
  const [searchParams] = useSearchParams()
  const boxerId = searchParams.get('boxer') || ''
  const [challenges, setChallenges] = useState<AIChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!boxerId) return
    setLoading(true)
    fetchChallenges(boxerId)
      .then(setChallenges)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [boxerId])

  const handleGenerate = async () => {
    if (!boxerId) return
    setGenerating(true)
    try {
      await generateChallenges(boxerId)
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateChallengeStatus(id, status)
      setChallenges((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c))
      )
    } catch (e: any) {
      setError(e.message)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const active = challenges.filter((c) => ['pending', 'in_progress'].includes(c.status) && c.end_date >= today)
  const past = challenges.filter((c) => !['pending', 'in_progress'].includes(c.status) || c.end_date < today)

  if (!boxerId) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
          <p className="text-slate-300">Select a boxer to view AI Challenges.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-orange-400" />
            <h1 className="text-lg font-bold text-white">AI Challenges</h1>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary text-xs py-2"
          >
            {generating ? (
              <><Loader2 size={12} className="animate-spin" /> Generating…</>
            ) : (
              <><Zap size={12} /> Generate New Challenges</>
            )}
          </button>
        </div>

        <p className="text-sm text-slate-400">
          Personalised challenges generated from your actual training, nutrition, and learning records.
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-orange-400" />
          </div>
        ) : (
          <>
            {/* Active challenges */}
            {active.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active</p>
                {active.map((c) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    onStatusUpdate={handleStatusUpdate}
                  />
                ))}
              </div>
            )}

            {active.length === 0 && (
              <div className="text-center py-10 border border-dashed border-slate-700/50 rounded-xl">
                <Trophy size={28} className="mx-auto mb-2 text-slate-600" />
                <p className="text-sm text-slate-500">No active challenges.</p>
                <p className="text-xs text-slate-600 mt-1">
                  Click "Generate New Challenges" to get personalised challenges from your records.
                </p>
              </div>
            )}

            {/* Past challenges */}
            {past.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">History</p>
                {past.slice(0, 10).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-700/30 bg-slate-900/40"
                  >
                    {c.status === 'completed' ? (
                      <CheckCircle size={14} className="text-green-400 shrink-0" />
                    ) : (
                      <Clock size={14} className="text-slate-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-400 truncate">{c.title}</p>
                    </div>
                    <span className={`text-xs shrink-0 ${STATUS_CONFIG[c.status]?.color || 'text-slate-500'}`}>
                      {STATUS_CONFIG[c.status]?.label || c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

function ChallengeCard({
  challenge,
  onStatusUpdate,
}: {
  challenge: AIChallenge
  onStatusUpdate: (id: string, status: string) => void
}) {
  const categoryColor = CATEGORY_COLORS[challenge.category] || 'text-slate-400 bg-slate-800 border-slate-700'
  const daysLeft = Math.ceil(
    (new Date(challenge.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColor}`}>
              {challenge.category}
            </span>
            <span className="text-xs text-slate-500">
              {challenge.challenge_type}
            </span>
          </div>
          <p className="text-sm font-semibold text-white">{challenge.title}</p>
          {challenge.description && (
            <p className="text-xs text-slate-400 mt-1">{challenge.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">
            {daysLeft > 0 ? `${daysLeft}d left` : 'Expires today'}
          </p>
          <p className="text-xs text-slate-600">{challenge.end_date}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {challenge.status === 'pending' && (
          <button
            onClick={() => onStatusUpdate(challenge.id, 'in_progress')}
            className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition"
          >
            Start
          </button>
        )}
        {(challenge.status === 'pending' || challenge.status === 'in_progress') && (
          <button
            onClick={() => onStatusUpdate(challenge.id, 'completed')}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition"
          >
            <CheckCircle size={11} className="inline mr-1" />
            Mark Complete
          </button>
        )}
        {challenge.status === 'in_progress' && (
          <span className="text-xs text-orange-400 flex items-center gap-1">
            <RotateCcw size={10} className="animate-spin" /> In Progress
          </span>
        )}
      </div>
    </div>
  )
}
