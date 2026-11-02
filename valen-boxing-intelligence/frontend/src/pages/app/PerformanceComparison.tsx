import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, BarChart3, Gauge, TrendingUp, Trophy } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"

import { listBoxers } from "../../api/boxers"
import { getProgress, type ProgressDataPoint } from "../../api/progress"
import Layout from "../../components/Layout"
import type { BoxerListItem } from "../../types"

export default function PerformanceComparison() {
  const [athletes, setAthletes] = useState<BoxerListItem[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, Record<string, ProgressDataPoint[]>>>({})
  const [selectedMetric, setSelectedMetric] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    listBoxers({ page_size: 50 })
      .then(async (result) => {
        if (!active) return
        setAthletes(result.data)

        const entries = await Promise.all(
          result.data.map(async (athlete) => {
            const data = await getProgress(athlete.id)
            return [athlete.id, data] as const
          }),
        )

        const nextMap = Object.fromEntries(entries)
        setProgressMap(nextMap)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const metricKeys = useMemo(() => {
    const all = new Set<string>()
    Object.values(progressMap).forEach((metrics) => {
      Object.keys(metrics || {}).forEach((key) => all.add(key))
    })
    return [...all].sort((a, b) => a.localeCompare(b))
  }, [progressMap])

  useEffect(() => {
    if (!selectedMetric && metricKeys.length > 0) {
      setSelectedMetric(metricKeys[0])
    }
  }, [metricKeys, selectedMetric])

  const comparisonRows = useMemo(() => {
    const rows = athletes
      .map((athlete) => {
        const series = progressMap[athlete.id]?.[selectedMetric] ?? []
        const ordered = [...series].sort((a, b) => (a.session_date || "").localeCompare(b.session_date || ""))
        const values = ordered
          .map((point) => Number(point.value))
          .filter((value) => Number.isFinite(value))

        const latest = values.length > 0 ? values[values.length - 1] : null
        const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null

        return {
          athlete,
          latest,
          average,
          count: values.length,
          latestDate: ordered.length > 0 ? ordered[ordered.length - 1].session_date : "—",
        }
      })
      .filter((row) => row.average !== null || row.latest !== null)
      .sort((a, b) => (b.average ?? b.latest ?? 0) - (a.average ?? a.latest ?? 0))

    return rows
  }, [athletes, progressMap, selectedMetric])

  const winner = comparisonRows[0]
  const chartData = comparisonRows.map((row) => ({
    name: row.athlete.full_name.split(" ")[0],
    value: row.average ?? row.latest ?? 0,
  }))

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl">
        <Link to="/app/coach" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={14} /> Back to coach center
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-orange-300">Athlete comparison</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Performance bench-marking</h1>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Metric", value: selectedMetric ? selectedMetric.replace(/_/g, " ") : "No data", icon: Gauge },
            { label: "Leader", value: winner ? winner.athlete.full_name : "Awaiting data", icon: Trophy },
            { label: "Athletes tracked", value: String(athletes.length), icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <Icon size={16} className="text-orange-300" />
              </div>
              <p className="mt-4 text-lg font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Metric selector</p>
              <h2 className="text-base font-semibold text-white mt-1">Compare athlete output</h2>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-orange-300" />
              {metricKeys.length > 0 ? (
                <select
                  value={selectedMetric}
                  onChange={(event) => setSelectedMetric(event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-400 focus:outline-none"
                >
                  {metricKeys.map((metric) => (
                    <option key={metric} value={metric}>{metric.replace(/_/g, " ")}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-slate-400">No progress metrics yet</span>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading athlete metrics…</p>
          ) : comparisonRows.length === 0 ? (
            <p className="text-sm text-slate-400">No analysis data is available for comparison yet.</p>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value) => [Number(value ?? 0).toFixed(3), selectedMetric.replace(/_/g, " ")]}
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 12 }}
                    />
                    <Bar dataKey="value" fill="#f97316" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 space-y-3">
                {comparisonRows.map((row) => (
                  <div key={row.athlete.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{row.athlete.full_name}</p>
                        <p className="text-xs text-slate-400">{row.latestDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-orange-300">
                          {row.average !== null ? row.average.toFixed(3) : row.latest !== null ? row.latest.toFixed(3) : "—"}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Average</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>Latest: {row.latest !== null ? row.latest.toFixed(3) : "—"}</span>
                      <span>Sessions: {row.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
