import type { CSSProperties } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts"
import type { CoachSummary } from "../api/analysis"
import type { PerformanceReportData } from "../lib/tracking/buildReport"
import { downloadReportJson, downloadReportPdf } from "../lib/tracking/exportReport"
import { MEASUREMENT_LABEL } from "../lib/tracking/types"
import { fmtHms, fmtTime } from "../lib/tracking/time"

export default function PerformanceReport(props: {
  report: PerformanceReportData
  coach: CoachSummary
  onCoachChange: (c: CoachSummary) => void
  onSaveNotes: () => void
  onBack: () => void
  saving?: boolean
  saveOk?: boolean
}) {
  const { report } = props
  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", color: "#e5e7eb", fontFamily: "Inter,system-ui,sans-serif" }}>
      <header style={{ background: "#111827", borderBottom: "1px solid #1f2937", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 5 }}>
        <button onClick={props.onBack} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer" }}>Back to workspace</button>
        <span style={{ fontWeight: 700 }}>Performance report</span>
        <span style={{ fontSize: 12, color: report.status === "complete" ? "#22c55e" : "#f59e0b", marginLeft: 8 }}>
          {report.status === "complete" ? "Complete" : "Draft"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => downloadReportPdf(report)} style={btn}>Export PDF</button>
          <button onClick={() => downloadReportJson(report)} style={btn}>Download JSON</button>
          <button onClick={props.onSaveNotes} style={{ ...btn, background: "#2563eb", borderColor: "#2563eb", color: "white" }}>
            {props.saving ? "Saving…" : props.saveOk ? "Saved" : "Save notes"}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{report.title}</h1>
        <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 18 }}>
          {report.videoName} · {new Date(report.dateIso).toLocaleString()} · {fmtHms(report.videoDuration)} · {report.mode === "both" ? "Two boxers" : "One boxer"} · {report.segmentsKind === "round" ? `${report.roundConfig.num_rounds} rounds` : "time segments"}
        </p>
        <p style={{ fontSize: 12, color: "#93c5fd", background: "rgba(37,99,235,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 24 }}>
          Units: {MEASUREMENT_LABEL.replace(/_/g, " ")}. This is not metres or punch count. Camera compensation is not applied. Punches come only from coach tags.
        </p>
        {report.insufficientData && (
          <p style={{ fontSize: 13, color: "#fbbf24", marginBottom: 16 }}>Insufficient valid tracking samples. The sections below report what was measured; missing values are not filled in.</p>
        )}

        {report.boxers.map(b => (
          <section key={b.metrics.label} style={card}>
            <h2 style={h2}>Boxer {b.metrics.label} — {b.metrics.name}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {([
                ["Identified", fmtHms(b.identifyTime)],
                ["Track start–end", `${fmtHms(b.metrics.trackingStart ?? 0)}–${fmtHms(b.metrics.trackingEnd ?? 0)}`],
                ["Valid duration", `${b.metrics.validTrackingDuration.toFixed(2)} s`],
                ["Coverage", `${b.metrics.coveragePercent.toFixed(1)}%`],
                ["Cumulative movement", b.metrics.totalMovement.toFixed(4)],
                ["Average rate", `${b.metrics.averageRate.toFixed(4)} /s`],
                ["Peak rate", `${b.metrics.peakRate.toFixed(4)} /s`],
                ["Moving time", `${b.metrics.movingDuration.toFixed(2)} s`],
                ["Stationary time", `${b.metrics.stationaryDuration.toFixed(2)} s`],
                ["Valid samples", String(b.metrics.validSampleCount)],
                ["Avg confidence", `${Math.round(b.metrics.averageConfidence * 100)}%`],
                ["Tracking loss", `${b.metrics.lossDuration.toFixed(2)} s`],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background: "#0f172a", borderRadius: 8, padding: "8px 10px" }}>
                  <p style={{ fontSize: 10, color: "#6b7280" }}>{k}</p>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{v}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 12 }}>{b.observation}</p>
            {b.metrics.rateSeries.length > 1 && (
              <div style={{ height: 180, marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Cumulative movement vs video time</p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={b.metrics.rateSeries}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={fmtTime} stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip formatter={(v) => Number(v).toFixed(4)} labelFormatter={t => fmtHms(Number(t))} />
                    <Line dataKey="cum" stroke={b.metrics.label === "B" ? "#f59e0b" : "#3b82f6"} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {b.metrics.rateSeries.length > 1 && (
              <div style={{ height: 160, marginTop: 18 }}>
                <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Movement rate (/s) and tracking confidence</p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={b.metrics.rateSeries}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={fmtTime} stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip />
                    <Line dataKey="rate" stroke="#22c55e" dot={false} isAnimationActive={false} />
                    <Line dataKey="confidence" stroke="#a78bfa" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <h3 style={h3}>Coach-tagged actions</h3>
            {b.actions.empty ? (
              <p style={{ color: "#fbbf24", fontSize: 13 }}>No coach annotations recorded</p>
            ) : (
              <p style={{ fontSize: 13 }}>
                Offensive {b.actions.offensive} · Defensive {b.actions.defensive} · Footwork {b.actions.footwork} · Other {b.actions.other} · {b.actions.ratePerMinute.toFixed(2)} per valid minute
              </p>
            )}
            <h3 style={h3}>{b.rounds[0]?.kind === "round" ? "Round-by-round" : "Time segments"}</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={b.rounds.map(r => ({ name: `${r.kind === "round" ? "R" : "S"}${r.round}`, movement: r.movement, actions: r.actions }))}>
                  <CartesianGrid stroke="#1f2937" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={10} />
                  <Legend />
                  <Bar dataKey="movement" fill="#3b82f6" />
                  <Bar dataKey="actions" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        ))}

        {report.comparison && (
          <section style={card}>
            <h2 style={h2}>Two-boxer comparison</h2>
            <p style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 10 }}>{report.comparison.note}</p>
            {report.comparison.overlapEnd > report.comparison.overlapStart ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <p>Overlap {fmtHms(report.comparison.overlapStart)}–{fmtHms(report.comparison.overlapEnd)}</p>
                <p>A movement {report.comparison.aMovement.toFixed(4)} · B {report.comparison.bMovement.toFixed(4)}</p>
                <p>A coverage {report.comparison.aCoverage.toFixed(1)}% · B {report.comparison.bCoverage.toFixed(1)}%</p>
                <p>A tagged actions {report.comparison.aActions} · B {report.comparison.bActions}</p>
              </div>
            ) : null}
          </section>
        )}

        <section style={card}>
          <h2 style={h2}>Coach notes</h2>
          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>Entered by the coach. Not generated from optical flow.</p>
          {([["went_well", "Summary / strengths observed"], ["needs_improvement", "Areas requiring attention"], ["technical_issues", "Technical notes"], ["next_session_objectives", "Follow-up"]] as [keyof CoachSummary, string][]).map(([key, label]) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</p>
              <textarea rows={3} value={props.coach[key] || ""} onChange={e => props.onCoachChange({ ...props.coach, [key]: e.target.value })}
                style={{ width: "100%", background: "#0f172a", border: "1px solid #374151", color: "#e5e7eb", borderRadius: 8, padding: 8, fontSize: 13 }} />
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

const btn: CSSProperties = {
  background: "#1f2937", border: "1px solid #374151", color: "#e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12,
}
const card: CSSProperties = { background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 18, marginBottom: 16 }
const h2: CSSProperties = { fontSize: 18, fontWeight: 800, marginBottom: 12 }
const h3: CSSProperties = { fontSize: 13, fontWeight: 700, margin: "16px 0 8px", color: "#9ca3af" }
