import type { ActionEvent, CoachSummary, RoundConfig } from "../../api/analysis"
import {
  actionStats,
  computeBoxerMetrics,
  describeMovement,
  movementInWindow,
  overlapInterval,
  roundDefinitions,
  type BoxerMetrics,
  type RoundDefinition,
} from "./metrics"
import type { PersistedBoxerTrack } from "./persist"
import { MEASUREMENT_LABEL, TRACKING_VERSION } from "./types"

export type ReportStatus = "draft" | "complete"

export interface BoxerReportBlock {
  metrics: BoxerMetrics
  identifyTime: number
  actions: ReturnType<typeof actionStats>
  observation: string
  rounds: {
    round: number
    kind: "round" | "segment"
    start: number
    end: number
    movement: number
    coverage: number
    confidence: number
    actions: number
    offensive: number
    defensive: number
  }[]
}

export interface PerformanceReportData {
  version: string
  measurement: string
  camera_compensated: false
  title: string
  videoName: string
  videoId: string
  dateIso: string
  videoDuration: number
  mode: "single" | "both"
  status: ReportStatus
  completedAt: string | null
  insufficientData: boolean
  segmentsKind: "round" | "segment"
  boxers: BoxerReportBlock[]
  comparison: {
    overlapStart: number
    overlapEnd: number
    aMovement: number
    bMovement: number
    aCoverage: number
    bCoverage: number
    aActions: number
    bActions: number
    note: string
  } | null
  coach: CoachSummary
  events: ActionEvent[]
  roundConfig: RoundConfig
}

export function buildPerformanceReport(args: {
  tracks: PersistedBoxerTrack[]
  events: ActionEvent[]
  coach: CoachSummary
  roundCfg: RoundConfig
  videoName: string
  videoId: string
  videoDuration: number
  status: ReportStatus
  completedAt?: string | null
  dateIso?: string
}): PerformanceReportData {
  const defs = roundDefinitions(args.roundCfg, args.videoDuration)
  const kind = defs[0]?.kind ?? "segment"
  const boxers = args.tracks.map(t => {
    const metrics = computeBoxerMetrics({
      label: t.label,
      name: t.name,
      boxerId: t.boxerId,
      identifyTime: t.identifyTime,
      samples: t.samples,
      lossIntervals: t.lossIntervals,
      totalMovement: t.totalMovement,
      validSampleCount: t.validSampleCount,
    })
    const minutes = metrics.validTrackingDuration / 60
    const actions = actionStats(args.events, minutes, t.label)
    const rounds = defs.map(d => {
      const win = movementInWindow(t.samples, d.start, d.end)
      const ev = args.events.filter(e =>
        e.timestamp >= d.start && e.timestamp < d.end && (!e.boxer_label || e.boxer_label === t.label),
      )
      return {
        round: d.round,
        kind: d.kind,
        start: d.start,
        end: d.end,
        movement: win.movement,
        coverage: win.coverage,
        confidence: win.confidence,
        actions: ev.length,
        offensive: ev.filter(e => ["jab", "cross", "lead_hook", "rear_hook", "uppercut", "combo"].includes(e.action_type)).length,
        defensive: ev.filter(e => ["block", "slip", "duck", "defensive", "head_move", "guard"].includes(e.action_type)).length,
      }
    })
    return {
      metrics,
      identifyTime: t.identifyTime,
      actions,
      observation: describeMovement(metrics, rounds),
      rounds,
    }
  })

  let comparison: PerformanceReportData["comparison"] = null
  if (boxers.length === 2) {
    const ov = overlapInterval(boxers[0].metrics, boxers[1].metrics)
    if (ov) {
      const a = movementInWindow(args.tracks[0].samples, ov.start, ov.end)
      const b = movementInWindow(args.tracks[1].samples, ov.start, ov.end)
      const aActs = args.events.filter(e => e.timestamp >= ov.start && e.timestamp <= ov.end && (!e.boxer_label || e.boxer_label === "A")).length
      const bActs = args.events.filter(e => e.timestamp >= ov.start && e.timestamp <= ov.end && e.boxer_label === "B").length
      comparison = {
        overlapStart: ov.start,
        overlapEnd: ov.end,
        aMovement: a.movement,
        bMovement: b.movement,
        aCoverage: a.coverage,
        bCoverage: b.coverage,
        aActions: aActs,
        bActions: bActs,
        note: "Comparison uses only the overlapping valid tracking interval. Different identification timestamps mean earlier footage is excluded for the later-identified boxer. Movement is not a ranking of who boxed better.",
      }
    } else {
      comparison = {
        overlapStart: 0,
        overlapEnd: 0,
        aMovement: 0,
        bMovement: 0,
        aCoverage: 0,
        bCoverage: 0,
        aActions: 0,
        bActions: 0,
        note: "No overlapping valid tracking interval is long enough for a comparison. Identification timestamps or tracking coverage differ.",
      }
    }
  }

  return {
    version: TRACKING_VERSION,
    measurement: MEASUREMENT_LABEL,
    camera_compensated: false,
    title: "Boxing Performance Report",
    videoName: args.videoName,
    videoId: args.videoId,
    dateIso: args.dateIso ?? new Date().toISOString(),
    videoDuration: args.videoDuration,
    mode: args.tracks.length > 1 ? "both" : "single",
    status: args.status,
    completedAt: args.completedAt ?? (args.status === "complete" ? new Date().toISOString() : null),
    insufficientData: boxers.every(b => b.metrics.insufficientData),
    segmentsKind: kind,
    boxers,
    comparison,
    coach: args.coach,
    events: args.events,
    roundConfig: args.roundCfg,
  }
}

export function roundsForUi(cfg: RoundConfig, duration: number): RoundDefinition[] {
  return roundDefinitions(cfg, duration)
}
