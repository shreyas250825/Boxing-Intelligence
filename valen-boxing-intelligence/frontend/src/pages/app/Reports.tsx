import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import Layout from "../../components/Layout"
import { SkeletonCard } from "../../components/SkeletonLoader"
import { listReports, generateReport, downloadReport } from "../../api/reports"
import { getSessions } from "../../api/progress"
import { getBoxer } from "../../api/boxers"
import type { Boxer, Report, TrainingSession } from "../../types"
import { FileText, Download, PlusCircle, AlertCircle, ArrowLeft, CheckSquare, Square } from "lucide-react"

export default function Reports() {
  const { id } = useParams<{ id: string }>()
  const [boxer, setBoxer] = useState<Boxer | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getBoxer(id), listReports(id), getSessions(id, { page_size: 50 })])
      .then(([b, r, s]) => { setBoxer(b); setReports(r); setSessions(s.data) })
      .finally(() => setLoading(false))
  }, [id])

  const toggle = (sid: string) => setSelected(s => s.includes(sid) ? s.filter(x => x !== sid) : [...s, sid])

  const handleGenerate = async () => {
    if (!id || selected.length === 0) return
    setGenerating(true); setError("")
    try {
      await generateReport({ boxer_id: id, session_ids: selected })
      const r = await listReports(id)
      setReports(r); setSelected([])
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed") }
    finally { setGenerating(false) }
  }

  if (loading) return <Layout><div className="p-8 space-y-3"><SkeletonCard /><SkeletonCard /></div></Layout>

  return (
    <Layout>
      <div className="px-8 py-8 max-w-3xl">
        <Link to={"/app/boxers/" + id} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} />{boxer?.full_name}
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Reports</h1>
        <p className="text-sm text-gray-500 mb-6">Generate professional PDF reports from session data.</p>

        {/* Session picker */}
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Select Sessions</h3>
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-sm">No sessions yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
              {sessions.map(s => (
                <button key={s.id} onClick={() => toggle(s.id)}
                  className={"w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left " +
                    (selected.includes(s.id) ? "bg-blue-50 border border-blue-200" : "bg-gray-50 hover:bg-gray-100 border border-transparent")}>
                  {selected.includes(s.id) ? <CheckSquare size={14} className="text-blue-600 shrink-0" /> : <Square size={14} className="text-gray-400 shrink-0" />}
                  <span className="font-medium text-gray-800">{s.session_date}</span>
                  <span className="text-gray-400 capitalize">{s.session_type.replace("_"," ")}</span>
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              <AlertCircle size={12} />{error}
            </div>
          )}
          <div>
            <button onClick={handleGenerate} disabled={selected.length === 0 || generating}
              className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <PlusCircle size={14} />{generating ? "Generating…" : "Generate Report"}
            </button>
            {selected.length === 0 && <p className="text-xs text-gray-400 mt-2">Select at least one session to generate a report.</p>}
          </div>
        </div>

        {/* Reports list */}
        <div>
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Generated Reports ({reports.length})</h3>
          {reports.length === 0 ? (
            <div className="card p-8 text-center">
              <FileText size={24} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">No reports yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map(r => (
                <div key={r.id} className="card px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <FileText size={14} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-400">{new Date(r.generated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <a href={downloadReport(r.id)} download
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                    <Download size={14} />Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}