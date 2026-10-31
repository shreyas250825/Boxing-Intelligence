import type { TrackingPayload, BoxerTrackPayload } from "../../api/analysis"
import { MEASUREMENT_LABEL, TRACKING_VERSION, type LossInterval, type NormBox, type TrackingSample, type TrackStatus } from "./types"
import { chartSeries } from "./movement"
import type { PerformanceReportData } from "./buildReport"

export interface PersistedBoxerTrack {
  boxerId: string
  label: "A" | "B"
  name: string
  color: string
  bbox: NormBox | null
  identified: boolean
  identifyTime: number
  identifyVideoWidth: number
  identifyVideoHeight: number
  tracked: NormBox | null
  status: TrackStatus
  confidence: number
  validPoints: number
  samples: TrackingSample[]
  totalMovement: number
  validSampleCount: number
  lossIntervals: LossInterval[]
  lastKnown: NormBox | null
  lastKnownTime: number | null
  fromSave?: boolean
}

export function tracksToPayload(
  tracks: PersistedBoxerTrack[],
  videoWidth: number,
  videoHeight: number,
  extras?: { report?: PerformanceReportData | null; status?: string; completedAt?: string | null },
): TrackingPayload {
  return {
    version: TRACKING_VERSION,
    measurement: MEASUREMENT_LABEL,
    camera_compensated: false,
    video_width: videoWidth,
    video_height: videoHeight,
    report_status: extras?.status,
    completed_at: extras?.completedAt ?? null,
    report: extras?.report ?? null,
    boxers: tracks.map((t): BoxerTrackPayload => ({
      label: t.label,
      boxer_id: t.boxerId,
      name: t.name,
      color: t.color,
      bbox: t.bbox,
      identify_time: t.identifyTime,
      identify_video_width: t.identifyVideoWidth,
      identify_video_height: t.identifyVideoHeight,
      total_movement: t.totalMovement,
      valid_sample_count: t.validSampleCount,
      samples: t.samples.map(s => ({ ...s, status: s.status })),
      loss_intervals: t.lossIntervals,
    })),
  }
}

export function tracksFromPayload(payload: TrackingPayload): PersistedBoxerTrack[] {
  return payload.boxers.map((b, i) => {
    const last = b.samples.length ? b.samples[b.samples.length - 1] : null
    const label = (b.label === "B" ? "B" : "A") as "A" | "B"
    const bbox = b.bbox ?? (last ? { x: last.x, y: last.y, w: last.w, h: last.h } : null)
    return {
      boxerId: b.boxer_id,
      label,
      name: b.name,
      color: b.color || (i === 0 ? "#3b82f6" : "#f59e0b"),
      bbox,
      identified: !!bbox,
      identifyTime: b.identify_time ?? b.samples[0]?.t ?? 0,
      identifyVideoWidth: b.identify_video_width ?? payload.video_width,
      identifyVideoHeight: b.identify_video_height ?? payload.video_height,
      tracked: last ? { x: last.x, y: last.y, w: last.w, h: last.h } : bbox,
      status: "PENDING",
      confidence: last?.confidence ?? 0,
      validPoints: last?.valid_points ?? 0,
      samples: b.samples.map(s => ({
        ...s,
        status: (s.status === "LOST" || s.status === "UNCERTAIN" || s.status === "PENDING" || s.status === "TRACKING")
          ? s.status
          : "PENDING",
      })),
      totalMovement: b.total_movement,
      validSampleCount: b.valid_sample_count,
      lossIntervals: b.loss_intervals,
      lastKnown: last ? { x: last.x, y: last.y, w: last.w, h: last.h } : bbox,
      lastKnownTime: last?.t ?? null,
      fromSave: true,
    }
  })
}

export function cumulativeSeries(samples: TrackingSample[]) {
  return chartSeries(samples)
}

export function restoredTotalsMatch(payload: TrackingPayload): boolean {
  return payload.boxers.every(b => {
    const sum = b.samples.reduce((s, p) => s + p.displacement, 0)
    return Math.abs(sum - b.total_movement) <= 0.05 + 0.02 * Math.max(1, b.total_movement)
  })
}
