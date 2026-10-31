import { describe, expect, it } from "vitest"
import { restoredTotalsMatch, tracksFromPayload, tracksToPayload } from "./persist"
import type { PersistedBoxerTrack } from "./persist"
import type { TrackingSample } from "./types"

function track(label: "A" | "B", samples: TrackingSample[], total: number): PersistedBoxerTrack {
  return {
    boxerId: label === "A" ? "boxer-a" : "boxer-b",
    label,
    name: label === "A" ? "Alpha" : "Bravo",
    color: label === "A" ? "#3b82f6" : "#f59e0b",
    bbox: { x: 0.1, y: 0.2, w: 0.2, h: 0.4 },
    identified: true,
    identifyTime: 0,
    identifyVideoWidth: 640,
    identifyVideoHeight: 360,
    tracked: { x: 0.1, y: 0.2, w: 0.2, h: 0.4 },
    status: "TRACKING",
    confidence: 0.7,
    validPoints: 16,
    samples,
    totalMovement: total,
    validSampleCount: samples.length,
    lossIntervals: [],
    lastKnown: { x: 0.1, y: 0.2, w: 0.2, h: 0.4 },
    lastKnownTime: samples.length ? samples[samples.length - 1].t : null,
  }
}

describe("saved analysis restore", () => {
  it("round-trips measurements for two boxers", () => {
    const samplesA: TrackingSample[] = [
      { t: 0, cx: 0.2, cy: 0.5, x: 0.1, y: 0.3, w: 0.2, h: 0.4, confidence: 0.8, status: "TRACKING", displacement: 0, valid_points: 20, camera_reliable: false },
      { t: 0.1, cx: 0.4, cy: 0.5, x: 0.3, y: 0.3, w: 0.2, h: 0.4, confidence: 0.8, status: "TRACKING", displacement: 0.2, valid_points: 19, camera_reliable: false },
    ]
    const samplesB: TrackingSample[] = [
      { t: 0, cx: 0.7, cy: 0.5, x: 0.6, y: 0.3, w: 0.2, h: 0.4, confidence: 0.7, status: "TRACKING", displacement: 0, valid_points: 18, camera_reliable: false },
      { t: 0.1, cx: 0.71, cy: 0.5, x: 0.61, y: 0.3, w: 0.2, h: 0.4, confidence: 0.7, status: "TRACKING", displacement: 0.01, valid_points: 17, camera_reliable: false },
    ]
    const payload = tracksToPayload([
      track("A", samplesA, 0.2),
      track("B", samplesB, 0.01),
    ], 640, 360)
    expect(restoredTotalsMatch(payload)).toBe(true)
    const restored = tracksFromPayload(payload)
    expect(restored[0].totalMovement).toBe(0.2)
    expect(restored[1].totalMovement).toBe(0.01)
    expect(restored[0].samples.map(s => s.t)).toEqual([0, 0.1])
    expect(restored[0].totalMovement).not.toBe(restored[1].totalMovement)
    expect(restored[0].samples).toHaveLength(2)
    expect(restored[1].samples).toHaveLength(2)
    expect(restored[0].boxerId).toBe("boxer-a")
    expect(restored[1].boxerId).toBe("boxer-b")
    expect(restored[0].status).toBe("PENDING")
    expect(restored[0].fromSave).toBe(true)
    expect(restored[0].identifyTime).toBe(0)
    expect(restored[0].identifyVideoWidth).toBe(640)
    expect(payload.boxers[0].identify_time).toBe(0)
    expect(restored[0].lossIntervals).not.toBe(restored[1].lossIntervals)
  })
})
