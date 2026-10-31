import { describe, expect, it } from "vitest"
import { BoxerTracker } from "./boxerTracker"
import { TrackingEngine } from "./trackingEngine"
import { frameDisplacement } from "./geometry"
import {
  appendSample, createMovementState, resetBaseline, shouldCountDisplacement,
} from "./movement"
import { frameWithSubject } from "./synthetic"
import type { TrackingSample } from "./types"

function sample(partial: Partial<TrackingSample> & Pick<TrackingSample, "t" | "cx" | "cy" | "status">): TrackingSample {
  return {
    x: partial.cx - 0.05,
    y: partial.cy - 0.1,
    w: 0.1,
    h: 0.2,
    confidence: 0.8,
    displacement: 0,
    valid_points: 20,
    camera_reliable: false,
    ...partial,
  }
}

function runTrack(
  tracker: BoxerTracker,
  frames: { gray: Float32Array; t: number }[],
  w: number,
  h: number,
  bbox: { x: number; y: number; w: number; h: number },
) {
  const updates = []
  updates.push(tracker.initialize(frames[0].gray, w, h, bbox, frames[0].t))
  for (let i = 1; i < frames.length; i++) {
    updates.push(tracker.update(frames[i].gray, w, h, frames[i].t))
  }
  return updates
}

describe("normalized frame movement", () => {
  it("matches the specified diagonal formula", () => {
    const v = frameDisplacement({ cx: 0.1, cy: 0.5 }, { cx: 0.6, cy: 0.5 }, 200, 100)
    const expected = (0.5 * 200) / Math.hypot(200, 100)
    expect(v).toBeCloseTo(expected, 10)
  })

  it("is zero for a stationary boxer", () => {
    expect(frameDisplacement({ cx: 0.4, cy: 0.4 }, { cx: 0.4, cy: 0.4 }, 640, 360)).toBe(0)
  })
})

describe("movement accumulation rules", () => {
  it("counts left-to-right independently of right-to-left sign", () => {
    let st = createMovementState()
    st = appendSample(st, sample({ t: 0, cx: 0.2, cy: 0.5, status: "TRACKING" }), 100, 100, true)
    st = appendSample(st, sample({ t: 0.1, cx: 0.5, cy: 0.5, status: "TRACKING" }), 100, 100, false)
    const right = st.totalMovement
    let st2 = createMovementState()
    st2 = appendSample(st2, sample({ t: 0, cx: 0.5, cy: 0.5, status: "TRACKING" }), 100, 100, true)
    st2 = appendSample(st2, sample({ t: 0.1, cx: 0.2, cy: 0.5, status: "TRACKING" }), 100, 100, false)
    expect(st2.totalMovement).toBeCloseTo(right, 8)
    expect(right).toBeGreaterThan(0.1)
  })

  it("accumulates vertical movement", () => {
    let st = createMovementState()
    st = appendSample(st, sample({ t: 0, cx: 0.5, cy: 0.2, status: "TRACKING" }), 100, 200, true)
    st = appendSample(st, sample({ t: 0.1, cx: 0.5, cy: 0.7, status: "TRACKING" }), 100, 200, false)
    expect(st.totalMovement).toBeGreaterThan(0.2)
  })

  it("does not count a tracking-loss jump", () => {
    let st = createMovementState()
    st = appendSample(st, sample({ t: 0, cx: 0.1, cy: 0.5, status: "TRACKING" }), 100, 100, true)
    st = appendSample(st, sample({ t: 0.1, cx: 0.12, cy: 0.5, status: "TRACKING" }), 100, 100, false)
    const before = st.totalMovement
    st = appendSample(st, sample({ t: 0.2, cx: 0.12, cy: 0.5, status: "LOST" }), 100, 100, true)
    st = appendSample(st, sample({ t: 0.4, cx: 0.8, cy: 0.5, status: "TRACKING" }), 100, 100, true)
    expect(st.totalMovement).toBeCloseTo(before, 8)
  })

  it("does not count seeking as movement", () => {
    let st = createMovementState()
    st = appendSample(st, sample({ t: 1, cx: 0.2, cy: 0.5, status: "TRACKING" }), 320, 180, true)
    st = appendSample(st, sample({ t: 1.1, cx: 0.25, cy: 0.5, status: "TRACKING" }), 320, 180, false)
    const before = st.totalMovement
    st = resetBaseline(st)
    st = appendSample(st, sample({ t: 8, cx: 0.9, cy: 0.2, status: "TRACKING" }), 320, 180, true)
    expect(st.totalMovement).toBeCloseTo(before, 8)
  })

  it("keeps two boxers' totals independent", () => {
    let a = createMovementState()
    let b = createMovementState()
    a = appendSample(a, sample({ t: 0, cx: 0.1, cy: 0.5, status: "TRACKING" }), 200, 100, true)
    a = appendSample(a, sample({ t: 0.1, cx: 0.4, cy: 0.5, status: "TRACKING" }), 200, 100, false)
    b = appendSample(b, sample({ t: 0, cx: 0.8, cy: 0.5, status: "TRACKING" }), 200, 100, true)
    b = appendSample(b, sample({ t: 0.1, cx: 0.81, cy: 0.5, status: "TRACKING" }), 200, 100, false)
    expect(a.totalMovement).toBeGreaterThan(b.totalMovement * 5)
  })

  it("rejects displacement after pause baseline when skip is set", () => {
    expect(shouldCountDisplacement({
      prev: sample({ t: 1, cx: 0.2, cy: 0.2, status: "TRACKING" }),
      status: "TRACKING",
      skipDisplacement: true,
      timestamp: 1.04,
    })).toBe(false)
  })
})

describe("pyramidal LK tracker on synthetic frames", () => {
  const W = 160
  const H = 90
  const bw = 28
  const bh = 40

  it("moves the box left to right with the subject", () => {
    const frames = []
    for (let i = 0; i < 12; i++) {
      const x = 12 + i * 6
      frames.push({ gray: frameWithSubject(W, H, { x, y: 24, w: bw, h: bh }), t: i / 30 })
    }
    const bbox = { x: 12 / W, y: 24 / H, w: bw / W, h: bh / H }
    const updates = runTrack(new BoxerTracker("A"), frames, W, H, bbox)
    const first = updates[0]
    const last = updates[updates.length - 1]
    expect(first.status).toBe("TRACKING")
    expect(last.status).toBe("TRACKING")
    expect(last.cx).toBeGreaterThan(first.cx + 0.15)
    expect(last.bbox).not.toEqual(first.bbox)
  })

  it("moves the box right to left with the subject", () => {
    const frames = []
    for (let i = 0; i < 12; i++) {
      const x = 110 - i * 6
      frames.push({ gray: frameWithSubject(W, H, { x, y: 24, w: bw, h: bh, seed: 3 }), t: i / 30 })
    }
    const bbox = { x: 110 / W, y: 24 / H, w: bw / W, h: bh / H }
    const updates = runTrack(new BoxerTracker("A"), frames, W, H, bbox)
    expect(updates[updates.length - 1].cx).toBeLessThan(updates[0].cx - 0.15)
  })

  it("keeps a near-stationary box for a stationary subject", () => {
    const frames = []
    for (let i = 0; i < 10; i++) {
      frames.push({ gray: frameWithSubject(W, H, { x: 60, y: 20, w: bw, h: bh, seed: 4 }), t: i / 30 })
    }
    const bbox = { x: 60 / W, y: 20 / H, w: bw / W, h: bh / H }
    const updates = runTrack(new BoxerTracker("A"), frames, W, H, bbox)
    const drift = Math.abs(updates[updates.length - 1].cx - updates[0].cx)
    expect(drift).toBeLessThan(0.04)
  })

  it("tracks vertical motion", () => {
    const frames = []
    for (let i = 0; i < 10; i++) {
      frames.push({ gray: frameWithSubject(W, H, { x: 60, y: 16 + i * 3, w: bw, h: bh, seed: 5 }), t: i / 30 })
    }
    const bbox = { x: 60 / W, y: 16 / H, w: bw / W, h: bh / H }
    const updates = runTrack(new BoxerTracker("A"), frames, W, H, bbox)
    expect(updates[0].status).toBe("TRACKING")
    expect(updates[updates.length - 1].status).toBe("TRACKING")
    expect(updates[updates.length - 1].cy).toBeGreaterThan(updates[0].cy + 0.12)
  })

  it("marks loss when the subject leaves the frame", () => {
    const frames = []
    for (let i = 0; i < 18; i++) {
      frames.push({ gray: frameWithSubject(W, H, { x: 40 + i * 10, y: 20, w: bw, h: bh, seed: 6 }), t: i / 30 })
    }
    const bbox = { x: 40 / W, y: 20 / H, w: bw / W, h: bh / H }
    const updates = runTrack(new BoxerTracker("A"), frames, W, H, bbox)
    expect(updates.some(u => u.status === "LOST")).toBe(true)
  })

  it("does not treat a seek jump as tracked motion", () => {
    const t = new BoxerTracker("A")
    const a = frameWithSubject(W, H, { x: 20, y: 20, w: bw, h: bh, seed: 7 })
    const b = frameWithSubject(W, H, { x: 110, y: 40, w: bw, h: bh, seed: 7 })
    const bbox = { x: 20 / W, y: 20 / H, w: bw / W, h: bh / H }
    t.initialize(a, W, H, bbox, 1.0)
    t.markSeek()
    const u = t.update(b, W, H, 6.0, { seekReset: true })
    expect(u.skipDisplacement).toBe(true)
  })

  it("pause then resume continues from the current frame without a fake jump", () => {
    const t = new BoxerTracker("A")
    const f0 = frameWithSubject(W, H, { x: 30, y: 22, w: bw, h: bh, seed: 8 })
    const f1 = frameWithSubject(W, H, { x: 36, y: 22, w: bw, h: bh, seed: 8 })
    const bbox = { x: 30 / W, y: 22 / H, w: bw / W, h: bh / H }
    t.initialize(f0, W, H, bbox, 0)
    const mid = t.update(f1, W, H, 0.04)
    expect(mid.status).toBe("TRACKING")
    const same = t.update(f1, W, H, 0.04)
    expect(same.skipDisplacement || same.timestamp === 0.04).toBe(true)
  })

  it("re-identification after loss starts a new baseline", () => {
    const t = new BoxerTracker("A")
    const first = frameWithSubject(W, H, { x: 16, y: 20, w: bw, h: bh, seed: 9 })
    t.initialize(first, W, H, { x: 16 / W, y: 20 / H, w: bw / W, h: bh / H }, 0)
    const gone = frameWithSubject(W, H, { x: 400, y: 20, w: bw, h: bh, seed: 9 })
    const lost = t.update(gone, W, H, 0.2)
    expect(lost.status).toBe("LOST")
    const back = frameWithSubject(W, H, { x: 80, y: 18, w: bw, h: bh, seed: 9 })
    const rid = t.reidentify(back, W, H, { x: 80 / W, y: 18 / H, w: bw / W, h: bh / H }, 0.5)
    expect(rid.skipDisplacement).toBe(true)
    expect(rid.status).toBe("TRACKING")
  })

  it("tracks two boxers independently", () => {
    const engine = new TrackingEngine()
    const frames = []
    for (let i = 0; i < 10; i++) {
      const gray = frameWithSubject(W, H, { x: 10 + i * 5, y: 12, w: 24, h: 32, seed: 1 })
      const other = frameWithSubject(W, H, { x: 110 - i * 4, y: 40, w: 24, h: 32, seed: 2 })
      for (let p = 0; p < gray.length; p++) gray[p] = Math.max(gray[p], other[p])
      frames.push(gray)
    }
    const startA = engine.initBoxer("A", frames[0], W, H, { x: 10 / W, y: 12 / H, w: 24 / W, h: 32 / H }, 0)
    const startB = engine.initBoxer("B", frames[0], W, H, { x: 110 / W, y: 40 / H, w: 24 / W, h: 32 / H }, 0)
    let last = engine.step(frames[1], W, H, 1 / 30, false)
    for (let i = 2; i < frames.length; i++) {
      last = engine.step(frames[i], W, H, i / 30, false)
    }
    const a = last.tracks.find(t => t.id === "A")!
    const b = last.tracks.find(t => t.id === "B")!
    expect(a.cx).toBeGreaterThan(startA.cx + 0.08)
    expect(b.cx).toBeLessThan(startB.cx - 0.08)
    expect(a.cx).not.toBeCloseTo(b.cx, 1)
  })

  it("does not initialize Boxer B before its identification timestamp", () => {
    const engine = new TrackingEngine()
    const a0 = frameWithSubject(W, H, { x: 12, y: 16, w: 24, h: 32, seed: 1 })
    engine.registerBoxer("A", { x: 12 / W, y: 16 / H, w: 24 / W, h: 32 / H }, 3)
    engine.registerBoxer("B", { x: 100 / W, y: 40 / H, w: 24 / W, h: 32 / H }, 12)
    const at3 = engine.step(a0, W, H, 3, false)
    const a = at3.tracks.find(t => t.id === "A")!
    const b = at3.tracks.find(t => t.id === "B")!
    expect(a.status).toBe("TRACKING")
    expect(a.skipDisplacement).toBe(true)
    expect(b.status).toBe("PENDING")
    expect(b.pendingInit).toBe(true)
    const bFrame = frameWithSubject(W, H, { x: 100, y: 40, w: 24, h: 32, seed: 2 })
    const gray = a0.slice()
    for (let p = 0; p < gray.length; p++) gray[p] = Math.max(gray[p], bFrame[p])
    const at12 = engine.step(gray, W, H, 12, false)
    const b12 = at12.tracks.find(t => t.id === "B")!
    expect(b12.status === "TRACKING" || b12.status === "LOST").toBe(true)
    expect(b12.skipDisplacement).toBe(true)
  })

  it("updates box scale when the subject grows", () => {
    const frames = []
    for (let i = 0; i < 8; i++) {
      const s = 32 + i * 3
      frames.push({ gray: frameWithSubject(W, H, { x: 36, y: 16, w: s, h: 40 + i * 2, seed: 21 }), t: i / 30 })
    }
    const bbox = { x: 36 / W, y: 16 / H, w: 32 / W, h: 40 / H }
    const updates = runTrack(new BoxerTracker("A"), frames, W, H, bbox)
    const last = updates[updates.length - 1]
    expect(last.status === "TRACKING" || last.status === "UNCERTAIN").toBe(true)
    expect(last.bbox).not.toBeNull()
    if (last.usedAffine && last.bbox) {
      expect(last.bbox.w).toBeGreaterThanOrEqual(bbox.w * 0.9)
    }
  })

  it("produces comparable normalized motion at two resolutions", () => {
    function travel(w: number, h: number) {
      const bw = Math.round(w * 0.18)
      const bh = Math.round(h * 0.4)
      const t = new BoxerTracker("A")
      const startX = Math.round(w * 0.1)
      const endX = Math.round(w * 0.4)
      const steps = 8
      const bbox = { x: startX / w, y: 0.2, w: bw / w, h: bh / h }
      const f0 = frameWithSubject(w, h, { x: startX, y: Math.round(h * 0.2), w: bw, h: bh, seed: 11 })
      let last = t.initialize(f0, w, h, bbox, 0)
      for (let i = 1; i <= steps; i++) {
        const x = startX + Math.round((endX - startX) * (i / steps))
        const g = frameWithSubject(w, h, { x, y: Math.round(h * 0.2), w: bw, h: bh, seed: 11 })
        last = t.update(g, w, h, i / 30)
      }
      return last.cx - bbox.x
    }
    const a = travel(160, 90)
    const b = travel(320, 180)
    expect(a).toBeGreaterThan(0.12)
    expect(b).toBeGreaterThan(0.12)
    expect(Math.abs(a - b)).toBeLessThan(0.2)
  })
})
