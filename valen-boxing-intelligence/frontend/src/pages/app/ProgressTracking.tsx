import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import Layout from "../../components/Layout"
import ProgressChart from "../../components/ProgressChart"
import { SkeletonBlock } from "../../components/SkeletonLoader"
import { getProgress } from "../../api/progress"
import { getBoxer } from "../../api/boxers"
import type { Boxer } from "../../types"
import { ArrowLeft, TrendingUp, AlertCircle } from "lucide-react"

export default function ProgressTracking() {
  const { id } = useParams<{ id: string }>()
  const [boxer, setBoxer] = useState<Boxer | null>(null)
  const [data, setData] = useState<Record<
    string,
    { session_date: string; value: number; session_type: string; source_note: string }[]
  > | null>(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) getBoxer(id).then(setBoxer).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getProgress(id, { start_date: startDate || undefined, end_date: endDate || undefined })
      .then((d) => setData(d as typeof data))
      .finally(() => setLoading(false))
  }, [id, startDate, endDate])

  const warnings: string[] = []
  if (data) {
    const types = new Set(Object.values(data).flat().map((p) => p.session_type))
    const sources = new Set(Object.values(data).flat().map((p) => p.source_note))
    if (types.size > 1) warnings.push("Mixed session types — comparisons may not be directly meaningful.")
    if (sources.size > 1) warnings.push("Metrics from different sources are shown together.")
  }

  const empty = data && Object.keys(data).length === 0

  return (
    <Layout>
      <div className="px-6 py-6 max-w-4xl mx-auto">
        <Link
          to={`/app/boxers/${id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 transition"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft size={14} />
          {boxer?.full_name ?? "Profile"}
        </Link>

        <div className="page-header">
          <div>
            <h1>Progress Tracking</h1>
            <p>Trend charts derived from completed video analysis sessions.</p>
          </div>
        </div>

        {/* Date range filter */}
        <div className="card p-4 mb-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input w-40"
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input w-40"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate("") }}
                className="text-xs mb-0.5 transition"
                style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2 mb-4">
            {warnings.map((w) => (
              <div
                key={w}
                className="flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs"
                style={{ color: 'var(--color-warning)', borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.08)' }}
              >
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            <SkeletonBlock className="h-48 w-full" />
            <SkeletonBlock className="h-48 w-full" />
          </div>
        ) : empty ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <TrendingUp size={22} />
              </div>
              <h3>No metrics yet</h3>
              <p>
                Complete a video analysis session to see progress charts here. Metrics are
                derived from the server-side pose estimation pipeline.
              </p>
            </div>
          </div>
        ) : (
          <ProgressChart data={data!} warnings={[]} />
        )}
      </div>
    </Layout>
  )
}
