import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import Layout from "../../components/Layout"
import { SkeletonCard } from "../../components/SkeletonLoader"
import { listReports, generateReport, downloadReport } from "../../api/reports"
import { getSessions } from "../../api/progress"
import { getBoxer } from "../../api/boxers"
import type { Boxer, Report, TrainingSession } from "../../types"
import {
  FileText, Download, PlusCircle, AlertCircle,
  ArrowLeft, CheckSquare, Square, RefreshCw,
} from "lucide-react"

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

  const toggle = (sid: string) =>
    setSelected((s) => s.includes(sid) ? s.filter((x) => x !== sid) : [...s, sid])

  const handleGenerate = async () => {
    if (!id || selected.length === 0) return
    setGenerating(true)
    setError("")
    try {
      await generateReport({ boxer_id: id, session_ids: selected })
      const r = await listReports(id)
      setReports(r)
      setSelected([])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate report")
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-6 py-6 max-w-3xl mx-auto">
        <Link
          to={`/app/boxers/${id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 transition"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft size={14} />
          {boxer?.full_name}
        </Link>

        <div className="page-header">
          <div>
            <h1>Reports</h1>
            <p>Generate PDF reports from session analysis data.</p>
          </div>
        </div>

        {/* Session picker */}
        <div className="card p-5 mb-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-strong)' }}>
            Select Sessions
          </h3>

          {sessions.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>No sessions yet. Upload a video to create a session.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto mb-4">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left transition"
                  style={{
                    border: selected.includes(s.id)
                      ? '1px solid rgba(59,130,246,0.3)'
                      : '1px solid var(--color-border)',
                    background: selected.includes(s.id)
                      ? 'rgba(59,130,246,0.08)'
                      : 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                  }}
                >
                  {selected.includes(s.id)
                    ? <CheckSquare size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
                    : <Square size={14} style={{ color: 'var(--color-text-faint)', flexShrink: 0 }} />}
                  <span className="font-medium">{s.session_date}</span>
                  <span className="capitalize" style={{ color: 'var(--color-text-muted)' }}>
                    {s.session_type.replace(/_/g, " ")}
                  </span>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-2 text-xs mb-3 px-3 py-2 rounded-xl border"
              style={{ color: 'var(--color-danger)', borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(239,68,68,0.08)' }}
            >
              <AlertCircle size={12} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={selected.length === 0 || generating}
              className="btn-primary flex items-center gap-2"
              style={{ opacity: (selected.length === 0 || generating) ? 0.4 : 1, cursor: (selected.length === 0 || generating) ? 'not-allowed' : 'pointer' }}
            >
              {generating
                ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                : <><PlusCircle size={14} /> Generate Report</>}
            </button>
            {selected.length === 0 && (
              <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
                Select at least one session
              </span>
            )}
          </div>
        </div>

        {/* Reports list */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-strong)' }}>
            Generated Reports ({reports.length})
          </h3>

          {reports.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FileText size={20} />
                </div>
                <h3>No reports yet</h3>
                <p>Select sessions above and click Generate Report to create your first PDF.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="card px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}
                    >
                      <FileText size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-strong)' }}>
                        {r.title}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(r.generated_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <a
                    href={downloadReport(r.id)}
                    download
                    className="flex items-center gap-1.5 text-sm font-medium transition"
                    style={{ color: '#60a5fa' }}
                  >
                    <Download size={14} />
                    Download PDF
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
