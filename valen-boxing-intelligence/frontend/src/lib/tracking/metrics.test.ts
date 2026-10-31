import { describe, expect, it } from "vitest"
import { actionStats, computeBoxerMetrics, overlapInterval, validPairs } from "./metrics"
import { buildPerformanceReport } from "./buildReport"
import { reportToPdfBlob } from "./exportReport"
import type { TrackingSample } from "./types"
import type { PersistedBoxerTrack } from "./persist"

function s(partial: Partial<TrackingSample> & Pick<TrackingSample, "t" | "cx" | "cy" | "status" | "displacement">): TrackingSample {
  return {
    x: 0.1, y: 0.2, w: 0.2, h: 0.4, confidence: 0.8, valid_points: 16, camera_reliable: false, ...partial,
  }
}

function track(label: "A" | "B", samples: TrackingSample[], identifyTime: number): PersistedBoxerTrack {
  const total = samples.reduce((n, x) => n + x.displacement, 0)
  return {
    boxerId: `id-${label}`, label, name: label === "A" ? "Alpha" : "Bravo",
    color: "#3b82f6", bbox: { x: 0.1, y: 0.2, w: 0.2, h: 0.4 }, identified: true,
    identifyTime, identifyVideoWidth: 640, identifyVideoHeight: 360,
    tracked: { x: 0.1, y: 0.2, w: 0.2, h: 0.4 }, status: "TRACKING", confidence: 0.8,
    validPoints: 16, samples, totalMovement: total, validSampleCount: samples.filter(x => x.status === "TRACKING").length,
    lossIntervals: [], lastKnown: null, lastKnownTime: null,
  }
}

describe("movement metrics", () => {
  it("does not count movement before initialization or across loss", () => {
    const samples = [
      s({ t: 3, cx: 0.2, cy: 0.5, status: "TRACKING", displacement: 0 }),
      s({ t: 3.1, cx: 0.3, cy: 0.5, status: "TRACKING", displacement: 0.1 }),
      s({ t: 3.2, cx: 0.3, cy: 0.5, status: "LOST", displacement: 0 }),
      s({ t: 4, cx: 0.8, cy: 0.5, status: "TRACKING", displacement: 0 }),
    ]
    const m = computeBoxerMetrics({
      label: "A", name: "A", boxerId: "a", identifyTime: 3, samples,
      lossIntervals: [{ start: 3.2, end: 4, reason: "LOST" }],
      totalMovement: 0.1, validSampleCount: 3,
    })
    expect(m.totalMovement).toBeCloseTo(0.1)
    expect(validPairs(samples)).toHaveLength(1)
    expect(m.lossDuration).toBeCloseTo(0.8)
  })

  it("computes rate from timestamp differences", () => {
    const samples = [
      s({ t: 1, cx: 0.1, cy: 0.5, status: "TRACKING", displacement: 0 }),
      s({ t: 2, cx: 0.2, cy: 0.5, status: "TRACKING", displacement: 0.2 }),
    ]
    const m = computeBoxerMetrics({
      label: "A", name: "A", boxerId: "a", identifyTime: 1, samples,
      lossIntervals: [], totalMovement: 0.2, validSampleCount: 2,
    })
    expect(m.averageRate).toBeCloseTo(0.2)
    expect(m.validTrackingDuration).toBeCloseTo(1)
  })

  it("marks insufficient data honestly", () => {
    const m = computeBoxerMetrics({
      label: "A", name: "A", boxerId: "a", identifyTime: 0, samples: [],
      lossIntervals: [], totalMovement: 0, validSampleCount: 0,
    })
    expect(m.insufficientData).toBe(true)
  })

  it("does not invent punch counts from movement", () => {
    const stats = actionStats([], 1, "A")
    expect(stats.empty).toBe(true)
    expect(stats.offensive).toBe(0)
  })
})

describe("performance report", () => {
  it("keeps two boxers independent and records unequal identification times", () => {
    const a = track("A", [
      s({ t: 3, cx: 0.2, cy: 0.5, status: "TRACKING", displacement: 0 }),
      s({ t: 3.2, cx: 0.4, cy: 0.5, status: "TRACKING", displacement: 0.2 }),
    ], 3)
    const b = track("B", [
      s({ t: 12, cx: 0.7, cy: 0.5, status: "TRACKING", displacement: 0 }),
      s({ t: 12.2, cx: 0.71, cy: 0.5, status: "TRACKING", displacement: 0.01 }),
    ], 12)
    const report = buildPerformanceReport({
      tracks: [a, b], events: [], coach: {},
      roundCfg: { num_rounds: 3, round_duration: 180, rest_duration: 60, start_offset: 0 },
      videoName: "spar.mp4", videoId: "vid", videoDuration: 30, status: "complete",
    })
    expect(report.boxers[0].identifyTime).toBe(3)
    expect(report.boxers[1].identifyTime).toBe(12)
    expect(report.boxers[0].metrics.totalMovement).toBeCloseTo(0.2)
    expect(report.boxers[1].metrics.totalMovement).toBeCloseTo(0.01)
    expect(report.boxers[0].actions.empty).toBe(true)
    const ov = overlapInterval(report.boxers[0].metrics, report.boxers[1].metrics)
    expect(ov).toBeNull()
  })

  it("writes a PDF that starts with a PDF header", async () => {
    const a = track("A", [
      s({ t: 0, cx: 0.2, cy: 0.5, status: "TRACKING", displacement: 0 }),
      s({ t: 0.2, cx: 0.3, cy: 0.5, status: "TRACKING", displacement: 0.05 }),
      s({ t: 0.4, cx: 0.4, cy: 0.5, status: "TRACKING", displacement: 0.05 }),
    ], 0)
    const report = buildPerformanceReport({
      tracks: [a], events: [], coach: { went_well: "Guard stayed high" },
      roundCfg: { num_rounds: 1, round_duration: 180, rest_duration: 0, start_offset: 0 },
      videoName: "clip.mp4", videoId: "abcdef12-xxxx", videoDuration: 12, status: "complete",
    })
    const blob = reportToPdfBlob(report)
    const buf = new Uint8Array(await blob.arrayBuffer())
    const head = String.fromCharCode(...buf.slice(0, 5))
    expect(head).toBe("%PDF-")
    expect(blob.size).toBeGreaterThan(200)
  })
})
