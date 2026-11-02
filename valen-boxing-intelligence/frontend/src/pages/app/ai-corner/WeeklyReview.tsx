import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart2, ChevronLeft, ChevronRight, Loader2, AlertTriangle, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react'
import Layout from '../../../components/Layout'
import { fetchWeeklyReview, type WeeklyReview as WeeklyReviewData } from '../../../api/aiCorner'

function getWeekStart(offsetWeeks = 0): string {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const monday = new Date(today.setDate(diff - offsetWeeks * 7))
  return monday.toISOString().split('T')[0]
}

export default function WeeklyReview() {
  const [searchParams] = useSearchParams()
  const boxerId = searchParams.get('boxer') || ''
  const [weekOffset, setWeekOffset] = useState(0)
  const [review, setReview] = useState<WeeklyReviewData | null>(null)
  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd] = useState('')
  const [missing, setMissing] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = (offset = 0) => {
    if (!boxerId) return
    setLoading(true)
    setError(null)
    setReview(null)
    const ws = getWeekStart(offset)
    fetchWeeklyReview(boxerId, ws)
      .then((data) => {
        setReview(data.review)
        setWeekStart(data.week_start)
        setWeekEnd(data.week_end)
        setMissing(data.missing_data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(weekOffset) }, [boxerId, weekOffset])

  if (!boxerId) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
          <p className="text-slate-300">Select a boxer to view the Weekly Review.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={20} className="text-orange-400" />
            <h1 className="text-lg font-bold text-white">AI Weekly Review</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset((o) => o + 1)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-slate-400 min-w-[140px] text-center">
              {weekStart && `${weekStart} — ${weekEnd}`}
            </span>
            <button
              onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
              disabled={weekOffset === 0}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
            <button onClick={() => load(weekOffset)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-2">
              <Loader2 size={24} className="animate-spin text-orange-400 mx-auto" />
              <p className="text-sm text-slate-400">Generating weekly review…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {review && !loading && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Summary</p>
              <p className="text-sm text-slate-200 leading-relaxed">{review.summary}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Sessions" value={String(review.completed_sessions)} />
              <StatCard label="Volume" value={review.training_volume} />
              <StatCard label="Nutrition Logged" value={review.nutrition_summary} small />
              <StatCard label="Hydration" value={review.hydration_summary} small />
            </div>

            {/* Domain summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SummaryCard title="Recovery" content={review.recovery_summary} />
              <SummaryCard title="Missed Sessions" content={review.missed_sessions} />
            </div>

            {/* Achievements */}
            {review.achievements.length > 0 && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                <p className="text-xs text-green-400 uppercase tracking-wider mb-2">Achievements</p>
                <ul className="space-y-1">
                  {review.achievements.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                      <CheckCircle size={12} className="text-green-400 shrink-0 mt-1" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Areas for attention */}
            {review.areas_for_attention.length > 0 && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                <p className="text-xs text-orange-400 uppercase tracking-wider mb-2">Areas for Attention</p>
                <ul className="space-y-1">
                  {review.areas_for_attention.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                      <AlertCircle size={12} className="text-orange-400 shrink-0 mt-1" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next week priorities */}
            {review.next_week_priorities.length > 0 && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-xs text-blue-400 uppercase tracking-wider mb-2">Next Week's Priorities</p>
                <ul className="space-y-1">
                  {review.next_week_priorities.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                      <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing data notice */}
            {missing.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl border border-slate-700/30 bg-slate-900/40">
                <AlertCircle size={12} className="text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500">
                  Missing data limited this review: {missing.join(', ')}. Log more data for a fuller analysis.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

function StatCard({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 text-center">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold text-white ${small ? 'text-xs' : 'text-base'} leading-tight`}>{value}</p>
    </div>
  )
}

function SummaryCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">{title}</p>
      <p className="text-sm text-slate-300">{content}</p>
    </div>
  )
}
