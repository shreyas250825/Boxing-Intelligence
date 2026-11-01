import type { PerformanceReportData } from "./buildReport"
import { fmtHms } from "./time"

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > width) {
      if (cur) lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [""]
}

export function reportLines(report: PerformanceReportData): string[] {
  const lines: string[] = []
  const add = (s: string) => { lines.push(...wrap(s, 92)) }
  add(report.title)
  add(`${report.videoName}  ·  ${new Date(report.dateIso).toLocaleString()}`)
  add(`Mode: ${report.mode === "both" ? "two boxers" : "one boxer"}  ·  Duration ${fmtHms(report.videoDuration)}  ·  Status ${report.status}`)
  add(`Measurement: ${report.measurement.replace(/_/g, " ")} (not metres). Camera compensation is not applied.`)
  add(`Data sources: movement is ${report.dataSources.movement}; punches are ${report.dataSources.punches}; coach notes are ${report.dataSources.notes}; camera claims are ${report.dataSources.camera}.`)
  if (report.insufficientData) add("Insufficient valid tracking samples. Statistics below are incomplete, not invented.")
  for (const b of report.boxers) {
    add("")
    add(`Boxer ${b.metrics.label} — ${b.metrics.name}`)
    add(`Identified at ${fmtHms(b.identifyTime)}. Track ${fmtHms(b.metrics.trackingStart ?? 0)}–${fmtHms(b.metrics.trackingEnd ?? 0)}.`)
    add(`Valid tracking ${b.metrics.validTrackingDuration.toFixed(2)}s  ·  coverage ${b.metrics.coveragePercent.toFixed(1)}%  ·  samples ${b.metrics.validSampleCount}`)
    add(`Cumulative movement ${b.metrics.totalMovement.toFixed(4)}  ·  avg rate ${b.metrics.averageRate.toFixed(4)}/s  ·  peak ${b.metrics.peakRate.toFixed(4)}/s`)
    add(`Moving ${b.metrics.movingDuration.toFixed(2)}s (rate > 0.015 /s)  ·  relatively stationary ${b.metrics.stationaryDuration.toFixed(2)}s`)
    add(`Avg confidence ${(b.metrics.averageConfidence * 100).toFixed(0)}%  ·  loss ${b.metrics.lossDuration.toFixed(2)}s`)
    add(b.observation)
    if (b.actions.empty) add("No coach annotations recorded.")
    else add(`Tagged offensive ${b.actions.offensive}  ·  defensive ${b.actions.defensive}  ·  rate ${b.actions.ratePerMinute.toFixed(2)} / valid min`)
    for (const r of b.rounds) {
      add(`${r.kind === "round" ? "Round" : "Segment"} ${r.round} ${fmtHms(r.start)}–${fmtHms(r.end)} movement ${r.movement.toFixed(4)} coverage ${r.coverage.toFixed(0)}% actions ${r.actions}`)
    }
  }
  if (report.comparison) {
    add("")
    add("Two-boxer comparison")
    add(report.comparison.note)
    if (report.comparison.overlapEnd > report.comparison.overlapStart) {
      add(`Overlap ${fmtHms(report.comparison.overlapStart)}–${fmtHms(report.comparison.overlapEnd)}`)
      add(`A movement ${report.comparison.aMovement.toFixed(4)} vs B ${report.comparison.bMovement.toFixed(4)}`)
    }
  }
  add("")
  add("Coach notes (coach-entered, not model-generated)")
  add(`Went well: ${report.coach.went_well || "—"}`)
  add(`Needs attention: ${report.coach.needs_improvement || "—"}`)
  add(`Technical: ${report.coach.technical_issues || "—"}`)
  add(`Follow-up: ${report.coach.next_session_objectives || report.coach.recommended_drills || "—"}`)
  return lines
}

/** Minimal multi-page PDF. Charts remain in the in-app report view. */
export function reportToPdfBlob(report: PerformanceReportData): Blob {
  const lines = reportLines(report)
  const pages: string[][] = []
  let y = 800
  let current: string[] = []
  const flush = () => {
    pages.push(["BT", "/F1 10 Tf", ...current, "ET"])
    current = []
    y = 800
  }
  for (const line of lines) {
    if (y < 48) flush()
    current.push(`1 0 0 1 48 ${y} Tm (${pdfEscape(line)}) Tj`)
    y -= 13
  }
  if (current.length) flush()
  if (!pages.length) flush()

  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let size = 0
  const push = (s: string) => {
    const b = encoder.encode(s)
    chunks.push(b)
    size += b.length
  }

  push("%PDF-1.4\n")
  const objBodies: string[] = []
  objBodies[0] = "<< /Type /Catalog /Pages 2 0 R >>"
  const pageCount = pages.length
  const fontId = 3
  const firstPageId = 4
  const pageIds = pages.map((_, i) => firstPageId + i * 2)
  const contentIds = pages.map((_, i) => firstPageId + i * 2 + 1)
  objBodies[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`
  objBodies[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  pages.forEach((ops, i) => {
    const stream = ops.join("\n")
    objBodies[pageIds[i] - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    objBodies[contentIds[i] - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })

  for (let i = 0; i < objBodies.length; i++) {
    if (!objBodies[i]) continue
    offsets[i] = size
    push(`${i + 1} 0 obj\n${objBodies[i]}\nendobj\n`)
  }
  const xrefPos = size
  const maxId = objBodies.length
  push(`xref\n0 ${maxId + 1}\n`)
  push("0000000000 65535 f \n")
  for (let i = 0; i < maxId; i++) {
    push(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`)
  }
  push(`trailer << /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`)
  const out = new Uint8Array(size)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return new Blob([out], { type: "application/pdf" })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadReportPdf(report: PerformanceReportData): void {
  downloadBlob(reportToPdfBlob(report), `valen-report-${report.videoId.slice(0, 8)}.pdf`)
}

export function downloadReportJson(report: PerformanceReportData): void {
  downloadBlob(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    `valen-report-${report.videoId.slice(0, 8)}.json`,
  )
}
