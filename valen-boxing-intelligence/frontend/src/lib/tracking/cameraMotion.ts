import type { NormBox, Point } from "./types"
import { detectCorners, robustTranslation, trackPointsFB } from "./lucasKanade"

export interface CameraEstimate {
  dx: number
  dy: number
  reliable: boolean
  points: number
}

export function estimateCameraMotion(
  prevGray: Float32Array,
  currGray: Float32Array,
  w: number,
  h: number,
  boxes: (NormBox | null)[],
  prevBgPoints: Point[],
): { estimate: CameraEstimate; nextPoints: Point[] } {
  const forbidden = boxes.filter((b): b is NormBox => !!b)
  let points = prevBgPoints.filter(p => !insideAny(p, forbidden, w, h, 1.15))
  if (points.length < 20) {
    points = detectCorners(currGray, w, h, { x: 4, y: 4, w: w - 8, h: h - 8 }, 48)
      .filter(p => !insideAny(p, forbidden, w, h, 1.15))
  }
  if (points.length < 12) {
    return {
      estimate: { dx: 0, dy: 0, reliable: false, points: points.length },
      nextPoints: points,
    }
  }
  const flow = trackPointsFB(prevGray, currGray, w, h, points)
  const { dx, dy, inliers } = robustTranslation(flow)
  const reliable = inliers.length >= 10 && Math.hypot(dx / w, dy / h) < 0.12
  return {
    estimate: { dx, dy, reliable, points: inliers.length },
    nextPoints: inliers.map(f => f.curr).filter(p => !insideAny(p, forbidden, w, h, 1.1)),
  }
}

function insideAny(p: Point, boxes: NormBox[], w: number, h: number, expand: number): boolean {
  const nx = p.x / w
  const ny = p.y / h
  for (const b of boxes) {
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    const hw = (b.w * expand) / 2
    const hh = (b.h * expand) / 2
    if (Math.abs(nx - cx) <= hw && Math.abs(ny - cy) <= hh) return true
  }
  return false
}
