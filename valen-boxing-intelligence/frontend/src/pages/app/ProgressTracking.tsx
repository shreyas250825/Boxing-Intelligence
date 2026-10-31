import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import Layout from "../../components/Layout"
import ProgressChart from "../../components/ProgressChart"
import { SkeletonBlock } from "../../components/SkeletonLoader"
import { getProgress } from "../../api/progress"
import { getBoxer } from "../../api/boxers"
import type { Boxer } from "../../types"
import { ArrowLeft, TrendingUp } from "lucide-react"

export default function ProgressTracking() {
  const { id } = useParams<{ id: string }>()
  const [boxer, setBoxer] = useState<Boxer | null>(null)
  const [data, setData] = useState<Record<string, {session_date:string;value:number;session_type:string;source_note:string}[]> | null>(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (id) getBoxer(id).then(setBoxer).catch(() => {}) }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getProgress(id, { start_date: startDate || undefined, end_date: endDate || undefined })
      .then(d => setData(d as Record<string, {session_date:string;value:number;session_type:string;source_note:string}[]>))
      .finally(() => setLoading(false))
  }, [id, startDate, endDate])

  const warnings: string[] = []
  if (data) {
    const types = new Set(Object.values(data).flat().map(p => p.session_type))
    const sources = new Set(Object.values(data).flat().map(p => p.source_note))
    if (types.size > 1) warnings.push("Mixed session types — comparisons may not be directly meaningful.")
    if (sources.size > 1) warnings.push("Metrics from different sources are shown together.")
  }

  const empty = data && Object.keys(data).length === 0

  return (
    <Layout>
      <div className="px-8 py-8 max-w-4xl">
        <Link to={"/app/boxers/" + id} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} />{boxer?.full_name ?? "Profile"}
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Progress Tracking</h1>
        <p className="text-sm text-gray-500 mb-6">Trend charts derived from completed video analysis sessions.</p>

        <div className="card p-4 mb-6 flex items-center gap-4">
          <div>
            <label className="label">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-40" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-40" />
          </div>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(""); setEndDate("") }} className="mt-5 text-xs text-blue-600 hover:underline">Clear</button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4"><SkeletonBlock className="h-48 w-full" /><SkeletonBlock className="h-48 w-full" /></div>
        ) : empty ? (
          <div className="card p-10 text-center">
            <TrendingUp size={32} className="mx-auto mb-3 text-gray-300" />
            <h3 className="font-semibold text-gray-900 mb-1">No metrics yet</h3>
            <p className="text-sm text-gray-500">Complete a video analysis session to see progress charts here.</p>
          </div>
        ) : (
          <ProgressChart data={data!} warnings={warnings} />
        )}
      </div>
    </Layout>
  )
}