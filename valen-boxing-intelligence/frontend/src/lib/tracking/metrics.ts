import type { ActionEvent, RoundConfig } from "../../api/analysis"
import type { LossInterval, TrackingSample } from "./types"
import { RATE_WINDOW_SECONDS, STATIONARY_RATE_THRESHOLD } from "./types"

export const MOVING_RATE_THRESHOLD = STATIONARY_RATE_THRESHOLD

export interface RoundDefinition {
  round: number
  start: number
  end: number
  restEnd: number
  kind: "round" | "segment"
}

export interface BoxerMetrics {
  label: string
  name: string
  boxerId: string
  identifyTime: number
  trackingStart: number | null
  trackingEnd: number | null
  validTrackingDuration: number
  intervalDuration: number
  coveragePercent: number
  validSampleCount: number
  totalSamples: number
  lossCount: number
  lossDuration: number
  totalMovement: number
  averageRate: number
  peakRate: number
  peakRateTime: number | null
  movingDuration: number
  stationaryDuration: number
  averageConfidence: number
  peakConfidence: number
  insufficientData: boolean
  rateSeries: { t: number; rate: number; cum: number; confidence: number }[]
}

export function validPairs(samples: TrackingSample[]): { prev: TrackingSample; curr: TrackingSample }[] {
  const out: { prev: TrackingSample; curr: TrackingSample }[] = []
  let prev: TrackingSample | null = null
  for (const s of samples) {
    if (s.status === "TRACKING") {
      if (prev && s.t > prev.t) out.push({ prev, curr: s })
      prev = s
    } else {
      prev = null
    }
  }
  return out
}

export function lossDuration(intervals: LossInterval[], lastT: number): number {
  return intervals.reduce((sum, iv) => {
    const end = iv.end == null ? lastT : iv.end
    return sum + Math.max(0, end - iv.start)
  }, 0)
}

export function computeBoxerMetrics(args: {
  label: string
  name: string
  boxerId: string
  identifyTime: number
  samples: TrackingSample[]
  lossIntervals: LossInterval[]
  totalMovement: number
  validSampleCount: number
}): BoxerMetrics {
  const tracking = args.samples.filter(s => s.status === "TRACKING")
  const trackingStart = tracking.length ? tracking[0].t : null
  const trackingEnd = tracking.length ? tracking[tracking.length - 1].t : null
  const pairs = validPairs(args.samples)
  let validTrackingDuration = 0
  let movingDuration = 0
  let stationaryDuration = 0
  const rateSeries: BoxerMetrics["rateSeries"] = []
  let cum = 0
  for (const { prev, curr } of pairs) {
    const dt = curr.t - prev.t
    if (!(dt > 0)) continue
    validTrackingDuration += dt
    const disp = curr.displacement
    cum += disp
    const rate = disp / dt
    if (rate > MOVING_RATE_THRESHOLD) movingDuration += dt
    else stationaryDuration += dt
    rateSeries.push({ t: curr.t, rate, cum, confidence: curr.confidence })
  }

  let peakRate = 0
  let peakRateTime: number | null = null
  for (const p of pairs) {
    const t1 = p.curr.t
    const t0 = t1 - RATE_WINDOW_SECONDS
    let disp = 0
    let dt = 0
    for (const q of pairs) {
      if (q.curr.t <= t1 && q.prev.t >= t0) {
        disp += q.curr.displacement
        dt += q.curr.t - q.prev.t
      }
    }
    const rate = dt > 0 ? disp / dt : 0
    if (rate > peakRate) {
      peakRate = rate
      peakRateTime = t1
    }
  }

  const intervalDuration = trackingStart != null && trackingEnd != null
    ? Math.max(0, trackingEnd - trackingStart)
    : 0
  const lastT = args.samples.length ? args.samples[args.samples.length - 1].t : args.identifyTime
  const confs = tracking.map(s => s.confidence)
  const averageConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0
  const peakConfidence = confs.length ? Math.max(...confs) : 0
  const insufficientData = tracking.length < 3 || validTrackingDuration < 0.2

  return {
    label: args.label,
    name: args.name,
    boxerId: args.boxerId,
    identifyTime: args.identifyTime,
    trackingStart,
    trackingEnd,
    validTrackingDuration,
    intervalDuration,
    coveragePercent: intervalDuration > 0 ? (validTrackingDuration / intervalDuration) * 100 : 0,
    validSampleCount: args.validSampleCount,
    totalSamples: args.samples.length,
    lossCount: args.lossIntervals.length,
    lossDuration: lossDuration(args.lossIntervals, lastT),
    totalMovement: args.totalMovement,
    averageRate: validTrackingDuration > 0 ? args.totalMovement / validTrackingDuration : 0,
    peakRate,
    peakRateTime,
    movingDuration,
    stationaryDuration,
    averageConfidence,
    peakConfidence,
    insufficientData,
    rateSeries,
  }
}

export function roundDefinitions(cfg: RoundConfig, videoDuration: number): RoundDefinition[] {
  const rounds: RoundDefinition[] = []
  const tot = cfg.round_duration + cfg.rest_duration
  if (!(cfg.num_rounds > 0) || !(cfg.round_duration > 0) || !Number.isFinite(videoDuration)) {
    return timeSegments(videoDuration)
  }
  for (let i = 0; i < cfg.num_rounds; i++) {
    const start = cfg.start_offset + i * tot
    const end = start + cfg.round_duration
    if (start >= videoDuration) break
    rounds.push({
      round: i + 1,
      start,
      end: Math.min(end, videoDuration),
      restEnd: Math.min(start + tot, videoDuration),
      kind: "round",
    })
  }
  return rounds.length ? rounds : timeSegments(videoDuration)
}

export function timeSegments(videoDuration: number, size = 60): RoundDefinition[] {
  if (!(videoDuration > 0)) return []
  const n = Math.max(1, Math.ceil(videoDuration / size))
  return Array.from({ length: n }, (_, i) => ({
    round: i + 1,
    start: i * size,
    end: Math.min(videoDuration, (i + 1) * size),
    restEnd: Math.min(videoDuration, (i + 1) * size),
    kind: "segment" as const,
  }))
}

export function movementInWindow(samples: TrackingSample[], start: number, end: number): {
  movement: number
  coverage: number
  confidence: number
  valid: number
} {
  const duration = Math.max(0, end - start)
  if (duration <= 0) {
    return { movement: 0, coverage: 0, confidence: 0, valid: 0 }
  }

  let movement = 0
  let validDt = 0
  let confidenceTotal = 0
  let validCount = 0

  for (const { prev, curr } of validPairs(samples)) {
    const overlapStart = Math.max(start, prev.t)
    const overlapEnd = Math.min(end, curr.t)
    if (overlapEnd <= overlapStart) continue

    const pairDuration = Math.max(0, curr.t - prev.t)
    if (pairDuration <= 0) continue

    const overlap = overlapEnd - overlapStart
    movement += curr.displacement * (overlap / pairDuration)
    validDt += overlap
    confidenceTotal += curr.confidence
    validCount += 1
  }

  const confidence = validCount > 0 ? confidenceTotal / validCount : 0

  return {
    movement,
    coverage: duration > 0 ? (validDt / duration) * 100 : 0,
    confidence,
    valid: validCount,
  }
}

export const OFFENSIVE = ["jab", "cross", "lead_hook", "rear_hook", "uppercut", "combo"]
export const DEFENSIVE = ["block", "slip", "duck", "defensive", "head_move", "guard"]
export const FOOTWORK = ["footwork"]

export function actionStats(events: ActionEvent[], validMinutes: number, boxerLabel?: string) {
  const scoped = boxerLabel ? events.filter(e => !e.boxer_label || e.boxer_label === boxerLabel) : events
  const count = (ids: string[]) => scoped.filter(e => ids.includes(e.action_type)).length
  const byType: Record<string, number> = {}
  for (const e of scoped) byType[e.action_type] = (byType[e.action_type] || 0) + 1
  const offensive = count(OFFENSIVE)
  const defensive = count(DEFENSIVE)
  const footwork = count(FOOTWORK)
  return {
    total: scoped.length,
    offensive,
    defensive,
    footwork,
    other: Math.max(0, scoped.length - offensive - defensive - footwork),
    byType,
    ratePerMinute: validMinutes > 0 ? scoped.length / validMinutes : 0,
    empty: scoped.length === 0,
  }
}

export function overlapInterval(a: BoxerMetrics, b: BoxerMetrics): { start: number; end: number } | null {
  if (a.trackingStart == null || a.trackingEnd == null || b.trackingStart == null || b.trackingEnd == null) return null
  const start = Math.max(a.trackingStart, b.trackingStart)
  const end = Math.min(a.trackingEnd, b.trackingEnd)
  if (end - start < 0.2) return null
  return { start, end }
}

export function describeMovement(metrics: BoxerMetrics, rounds: { round: number; movement: number; kind: string }[]): string {
  if (metrics.insufficientData) {
    return "Insufficient valid tracking samples to describe movement distribution."
  }
  if (!rounds.length) {
    return `Cumulative normalized image-plane movement is ${metrics.totalMovement.toFixed(4)} over ${metrics.validTrackingDuration.toFixed(1)}s of valid tracking.`
  }
  const ranked = [...rounds].sort((x, y) => y.movement - x.movement)
  const top = ranked[0]
  const rest = ranked.slice(1).reduce((s, r) => s + r.movement, 0)
  const concentrated = top.movement > 0 && top.movement >= rest
  const label = top.kind === "round" ? `round ${top.round}` : `segment ${top.round}`
  if (concentrated) {
    return `Movement was concentrated in ${label} (${top.movement.toFixed(4)} of ${metrics.totalMovement.toFixed(4)} total normalized image-plane movement).`
  }
  return `Movement was distributed across ${rounds.length} ${top.kind === "round" ? "rounds" : "time segments"} rather than a single interval.`
}
