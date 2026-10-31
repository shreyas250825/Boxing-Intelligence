import { BoxerTracker } from "./boxerTracker"
import { estimateCameraMotion, type CameraEstimate } from "./cameraMotion"
import { boxCenter, iou } from "./geometry"
import type { CheckpointSlot, IdentificationCheckpoint, TrackingCorrection } from "./checkpoints"
import type { NormBox, Point, TrackUpdate } from "./types"

export interface PendingBoxer {
  id: string
  checkpoints: IdentificationCheckpoint[]
  applied: Set<number>
}

export interface EngineFrameResult {
  timestamp: number
  width: number
  height: number
  camera: CameraEstimate
  tracks: TrackUpdate[]
  corrections: TrackingCorrection[]
}

export class TrackingEngine {
  private trackers = new Map<string, BoxerTracker>()
  private pending = new Map<string, PendingBoxer>()
  private prevGray: Float32Array | null = null
  private bgPoints: Point[] = []
  private width = 0
  private height = 0
  private lastCorrections: TrackingCorrection[] = []

  registerBoxer(id: string, checkpoints: IdentificationCheckpoint[]): void {
    const sorted = [...checkpoints].sort((a, b) => a.t - b.t)
    this.pending.set(id, { id, checkpoints: sorted, applied: new Set() })
    this.trackers.get(id)?.dispose()
    this.trackers.delete(id)
  }

  initBoxer(id: string, gray: Float32Array, w: number, h: number, bbox: NormBox, timestamp: number): TrackUpdate {
    this.ensureFrame(gray, w, h)
    let t = this.trackers.get(id)
    if (!t) {
      t = new BoxerTracker(id)
      this.trackers.set(id, t)
    }
    return t.initialize(gray, w, h, bbox, timestamp)
  }

  reidentify(id: string, gray: Float32Array, w: number, h: number, bbox: NormBox, timestamp: number): TrackUpdate {
    return this.initBoxer(id, gray, w, h, bbox, timestamp)
  }

  markSeek(): void {
    this.trackers.forEach(t => t.markSeek())
    this.prevGray = null
    this.bgPoints = []
  }

  step(gray: Float32Array, w: number, h: number, timestamp: number, seekReset: boolean): EngineFrameResult {
    if (seekReset) this.markSeek()
    this.lastCorrections = []

    const deferred: TrackUpdate[] = []
    for (const pending of [...this.pending.values()]) {
      const due = pending.checkpoints.find((c, i) => !pending.applied.has(i) && timestamp + 0.08 >= c.t)
      if (!due) {
        if (!this.trackers.has(pending.id)) {
          deferred.push(this.pendingUpdate(pending.id, timestamp))
        }
        continue
      }
      const idx = pending.checkpoints.indexOf(due)
      pending.applied.add(idx)
      const existing = this.trackers.get(pending.id)
      const predicted = existing?.bbox ?? null
      const update = this.initBoxer(pending.id, gray, w, h, due.bbox, timestamp)
      update.skipDisplacement = true
      if (predicted && idx > 0) {
        const p = boxCenter(predicted)
        const c = boxCenter(due.bbox)
        const drift = Math.hypot(p.cx - c.cx, p.cy - c.cy)
        update.checkpointCorrection = {
          slot: due.slot,
          predictedCx: p.cx,
          predictedCy: p.cy,
          confirmedCx: c.cx,
          confirmedCy: c.cy,
          drift,
        }
        this.lastCorrections.push({
          t: timestamp,
          slot: due.slot as CheckpointSlot,
          predictedCx: p.cx,
          predictedCy: p.cy,
          confirmedCx: c.cx,
          confirmedCy: c.cy,
          drift,
        })
      }
      deferred.push(update)
    }

    let camera: CameraEstimate = { dx: 0, dy: 0, reliable: false, points: 0 }
    if (this.prevGray && this.width === w && this.height === h) {
      const boxes = [...this.trackers.values()].map(t => t.bbox)
      const cam = estimateCameraMotion(this.prevGray, gray, w, h, boxes, this.bgPoints)
      camera = cam.estimate
      this.bgPoints = cam.nextPoints
    }

    const tracks: TrackUpdate[] = [...deferred]
    this.trackers.forEach(tracker => {
      if (deferred.some(d => d.id === tracker.id && !d.pendingInit)) return
      const update = tracker.update(gray, w, h, timestamp, { seekReset })
      update.cameraReliable = camera.reliable
      tracks.push(update)
    })

    if (tracks.length >= 2) {
      for (let i = 0; i < tracks.length; i++) {
        for (let j = i + 1; j < tracks.length; j++) {
          const a = tracks[i].bbox
          const b = tracks[j].bbox
          if (!a || !b) continue
          if (tracks[i].status === "PENDING" || tracks[j].status === "PENDING") continue
          if (iou(a, b) < 0.45) continue
          tracks[i].status = "UNCERTAIN"
          tracks[j].status = "UNCERTAIN"
          tracks[i].skipDisplacement = true
          tracks[j].skipDisplacement = true
          const ta = this.trackers.get(tracks[i].id)
          const tb = this.trackers.get(tracks[j].id)
          if (ta) ta.status = "UNCERTAIN"
          if (tb) tb.status = "UNCERTAIN"
        }
      }
    }

    this.prevGray = gray.slice()
    this.width = w
    this.height = h
    return { timestamp, width: w, height: h, camera, tracks, corrections: this.lastCorrections }
  }

  disposeBoxer(id: string): void {
    this.trackers.get(id)?.dispose()
    this.trackers.delete(id)
    this.pending.delete(id)
  }

  disposeAll(): void {
    this.trackers.forEach(t => t.dispose())
    this.trackers.clear()
    this.pending.clear()
    this.prevGray = null
    this.bgPoints = []
  }

  private pendingUpdate(id: string, timestamp: number): TrackUpdate {
    return {
      id,
      timestamp,
      bbox: null,
      cx: 0,
      cy: 0,
      status: "PENDING",
      confidence: 0,
      validPoints: 0,
      attemptedPoints: 0,
      medianFbError: 0,
      displacement: 0,
      skipDisplacement: true,
      inFrame: false,
      cameraReliable: false,
      pendingInit: true,
    }
  }

  private ensureFrame(gray: Float32Array, w: number, h: number) {
    this.prevGray = gray.slice()
    this.width = w
    this.height = h
  }
}
