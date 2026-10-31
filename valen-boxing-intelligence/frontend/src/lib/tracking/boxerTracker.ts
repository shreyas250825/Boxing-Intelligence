import type { NormBox, Point, TrackStatus, TrackUpdate } from "./types"
import { MIN_FEATURE_POINTS } from "./types"
import { boxCenter, boxInFrame, clamp, clampBox } from "./geometry"
import {
  detectCorners,
  detectCornersDistributed,
  estimateAffineRansac,
  mergePoints,
  robustScale,
  robustTranslation,
  spatialSpread,
  trackPointsFB,
  transformBoxAffine,
} from "./lucasKanade"

const LOST_CONFIDENCE = 0.18
const UNCERTAIN_CONFIDENCE = 0.38
const MAX_STEP = 0.16
const REPLENISH_MIN = 14
const REPLENISH_MAX = 48

export class BoxerTracker {
  readonly id: string
  bbox: NormBox | null = null
  status: TrackStatus = "PENDING"
  confidence = 0
  points: Point[] = []
  prevGray: Float32Array | null = null
  width = 0
  height = 0
  lastTimestamp: number | null = null
  identifyTime: number | null = null
  validPointCount = 0
  attemptedPoints = 0
  medianFbError = 0
  skipNextDisplacement = true
  usedAffine = false
  initFailed = false
  initReason = ""

  constructor(id: string) {
    this.id = id
  }

  initialize(gray: Float32Array, w: number, h: number, bbox: NormBox, timestamp: number): TrackUpdate {
    this.dispose()
    this.width = w
    this.height = h
    this.bbox = clampBox(bbox)
    this.prevGray = gray.slice()
    this.lastTimestamp = timestamp
    this.identifyTime = timestamp
    this.points = this.detectInBox(gray, w, h, this.bbox, true)
    this.validPointCount = this.points.length
    this.attemptedPoints = this.points.length
    this.skipNextDisplacement = true
    this.usedAffine = false
    if (this.points.length < MIN_FEATURE_POINTS) {
      this.status = "LOST"
      this.confidence = 0.05
      this.initFailed = true
      this.initReason = `Only ${this.points.length} interior corners found (need ${MIN_FEATURE_POINTS}). Draw a tighter box on the boxer's body, avoiding ropes and the crowd.`
      return this.snapshot(timestamp, 0, true)
    }
    this.initFailed = false
    this.initReason = ""
    this.status = "TRACKING"
    this.confidence = clamp(this.points.length / 24, 0.45, 0.85)
    return this.snapshot(timestamp, 0, true)
  }

  reidentify(gray: Float32Array, w: number, h: number, bbox: NormBox, timestamp: number): TrackUpdate {
    return this.initialize(gray, w, h, bbox, timestamp)
  }

  markSeek(): void {
    this.skipNextDisplacement = true
  }

  update(
    gray: Float32Array,
    w: number,
    h: number,
    timestamp: number,
    opts?: { seekReset?: boolean },
  ): TrackUpdate {
    if (opts?.seekReset) this.skipNextDisplacement = true
    if (this.lastTimestamp !== null && timestamp === this.lastTimestamp) {
      return this.snapshot(timestamp, 0, true)
    }
    if (!this.bbox || !this.prevGray || this.width !== w || this.height !== h) {
      this.status = "LOST"
      this.confidence = 0
      this.prevGray = gray.slice()
      this.width = w
      this.height = h
      this.lastTimestamp = timestamp
      return this.snapshot(timestamp, 0, true)
    }
    if (this.status === "LOST" && this.points.length < MIN_FEATURE_POINTS) {
      this.prevGray = gray.slice()
      this.lastTimestamp = timestamp
      return this.snapshot(timestamp, 0, true)
    }

    const flow = trackPointsFB(this.prevGray, gray, w, h, this.points)
    this.attemptedPoints = flow.length
    const { dx, dy, inliers, medianFb } = robustTranslation(flow)
    this.medianFbError = medianFb
    const survived = inliers.map(f => f.curr)
    this.validPointCount = survived.length

    const prevBox = this.bbox
    const px = prevBox.x * w
    const py = prevBox.y * h
    const pw = prevBox.w * w
    const ph = prevBox.h * h
    const spread = spatialSpread(survived, { x: px, y: py, w: pw, h: ph })
    const { cx, cy } = boxCenter(prevBox)

    const affineEst = inliers.length >= 8 ? estimateAffineRansac(inliers) : null
    let proposed: NormBox | null = null
    this.usedAffine = false
    if (affineEst?.ok) {
      const nextPx = transformBoxAffine({ x: px, y: py, w: pw, h: ph }, affineEst.affine)
      const scaleW = nextPx.w / Math.max(1, pw)
      const scaleH = nextPx.h / Math.max(1, ph)
      const scale = clamp((scaleW + scaleH) / 2, 0.92, 1.08)
      const affineBox = clampBox({
        x: nextPx.x / w,
        y: nextPx.y / h,
        w: clamp(prevBox.w * scale, 0.03, 0.95),
        h: clamp(prevBox.h * scale, 0.03, 0.95),
      })
      const ac = boxCenter(affineBox)
      if (Math.hypot(ac.cx - cx, ac.cy - cy) <= MAX_STEP) {
        proposed = affineBox
        this.usedAffine = true
      }
    }
    if (!proposed) {
      const scale = survived.length >= 8 ? robustScale(inliers, cx * w, cy * h) : 1
      let ndx = dx / w
      let ndy = dy / h
      const step = Math.hypot(ndx, ndy)
      if (step > MAX_STEP) {
        const s = MAX_STEP / step
        ndx *= s
        ndy *= s
      }
      proposed = clampBox({
        x: cx + ndx - prevBox.w * scale / 2,
        y: cy + ndy - prevBox.h * scale / 2,
        w: clamp(prevBox.w * scale, 0.03, 0.95),
        h: clamp(prevBox.h * scale, 0.03, 0.95),
      })
    }

    const ratio = this.attemptedPoints > 0 ? this.validPointCount / this.attemptedPoints : 0
    const pointScore = clamp(this.validPointCount / 20, 0, 1)
    const fbScore = clamp(1 - medianFb / 4, 0, 1)
    const inFrame = boxInFrame(proposed)
    this.confidence = clamp(
      0.3 * pointScore + 0.22 * ratio + 0.2 * fbScore + 0.16 * spread + 0.12 * (inFrame ? 1 : 0),
      0,
      1,
    )

    const lost = this.validPointCount < MIN_FEATURE_POINTS || this.confidence < LOST_CONFIDENCE || !inFrame
    const uncertain = !lost && (this.confidence < UNCERTAIN_CONFIDENCE || ratio < 0.35)

    if (lost) {
      this.status = "LOST"
      this.points = survived
      this.prevGray = gray.slice()
      this.lastTimestamp = timestamp
      return this.snapshot(timestamp, 0, true)
    }

    this.bbox = proposed
    this.status = uncertain ? "UNCERTAIN" : "TRACKING"
    this.points = survived
    if (this.status === "TRACKING" && this.confidence >= 0.45 && this.points.length < REPLENISH_MIN) {
      const extra = this.detectInBox(gray, w, h, this.bbox, true)
      this.points = mergePoints(this.points, extra, 4, REPLENISH_MAX)
    } else if (this.status === "TRACKING" && this.points.length < 28) {
      const extra = this.detectInBox(gray, w, h, this.bbox, false)
      this.points = mergePoints(this.points, extra, 5, REPLENISH_MAX)
    }
    this.validPointCount = Math.max(this.validPointCount, this.points.length)

    const skip = this.skipNextDisplacement || this.status !== "TRACKING"
    this.skipNextDisplacement = false
    this.prevGray = gray.slice()
    this.lastTimestamp = timestamp
    return this.snapshot(timestamp, 0, skip)
  }

  dispose(): void {
    this.prevGray = null
    this.points = []
    this.bbox = null
    this.status = "PENDING"
    this.confidence = 0
    this.lastTimestamp = null
    this.initFailed = false
    this.initReason = ""
    this.usedAffine = false
  }

  private detectInBox(gray: Float32Array, w: number, h: number, box: NormBox, distributed: boolean): Point[] {
    const insetX = box.w * 0.04
    const insetY = box.h * 0.04
    const roi = {
      x: (box.x + insetX) * w,
      y: (box.y + insetY) * h,
      w: Math.max(8, (box.w - 2 * insetX) * w),
      h: Math.max(8, (box.h - 2 * insetY) * h),
    }
    const pts = distributed ? detectCornersDistributed(gray, w, h, roi) : detectCorners(gray, w, h, roi)
    return pts.length ? pts : detectCorners(gray, w, h, { x: box.x * w, y: box.y * h, w: box.w * w, h: box.h * h })
  }

  private snapshot(timestamp: number, displacement: number, skipDisplacement: boolean): TrackUpdate {
    const bbox = this.bbox
    const c = bbox ? boxCenter(bbox) : { cx: 0, cy: 0 }
    return {
      id: this.id,
      timestamp,
      bbox,
      cx: c.cx,
      cy: c.cy,
      status: this.status,
      confidence: this.confidence,
      validPoints: this.validPointCount,
      attemptedPoints: this.attemptedPoints,
      medianFbError: this.medianFbError,
      displacement,
      skipDisplacement,
      inFrame: bbox ? boxInFrame(bbox) : false,
      cameraReliable: false,
      initFailed: this.initFailed,
      initReason: this.initReason,
      usedAffine: this.usedAffine,
    }
  }
}
