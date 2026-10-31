import type { DisplayRect, NormBox, Point } from "./types"

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function boxCenter(box: NormBox): { cx: number; cy: number } {
  return { cx: box.x + box.w / 2, cy: box.y + box.h / 2 }
}

export function frameDisplacement(
  prev: { cx: number; cy: number },
  curr: { cx: number; cy: number },
  videoWidth: number,
  videoHeight: number,
): number {
  const diag = Math.hypot(videoWidth, videoHeight)
  if (!(diag > 0) || !Number.isFinite(diag)) return 0
  const dx = (curr.cx - prev.cx) * videoWidth
  const dy = (curr.cy - prev.cy) * videoHeight
  return Math.hypot(dx, dy) / diag
}

export function iou(a: NormBox, b: NormBox): number {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  const iw = Math.max(0, x1 - x0)
  const ih = Math.max(0, y1 - y0)
  const inter = iw * ih
  const union = a.w * a.h + b.w * b.h - inter
  return union > 0 ? inter / union : 0
}

export function boxInFrame(box: NormBox, margin = 0.02): boolean {
  const { cx, cy } = boxCenter(box)
  if (cx < -margin || cx > 1 + margin || cy < -margin || cy > 1 + margin) return false
  const visible = Math.max(0, Math.min(1, box.x + box.w) - Math.max(0, box.x))
    * Math.max(0, Math.min(1, box.y + box.h) - Math.max(0, box.y))
  return visible >= 0.15 * box.w * box.h
}

export function clampBox(box: NormBox): NormBox {
  const w = clamp(box.w, 0.02, 1)
  const h = clamp(box.h, 0.02, 1)
  return {
    x: clamp(box.x, 0, 1 - w),
    y: clamp(box.y, 0, 1 - h),
    w,
    h,
  }
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function displayedVideoRect(video: HTMLVideoElement): DisplayRect {
  const videoWidth = video.videoWidth || 0
  const videoHeight = video.videoHeight || 0
  const clientWidth = video.clientWidth || 0
  const clientHeight = video.clientHeight || 0
  if (videoWidth <= 0 || videoHeight <= 0 || clientWidth <= 0 || clientHeight <= 0) {
    return {
      offsetX: 0, offsetY: 0,
      drawWidth: clientWidth, drawHeight: clientHeight,
      videoWidth, videoHeight, clientWidth, clientHeight,
    }
  }
  const scale = Math.min(clientWidth / videoWidth, clientHeight / videoHeight)
  const drawWidth = videoWidth * scale
  const drawHeight = videoHeight * scale
  return {
    offsetX: (clientWidth - drawWidth) / 2,
    offsetY: (clientHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
    videoWidth,
    videoHeight,
    clientWidth,
    clientHeight,
  }
}

export function clientToNorm(
  clientX: number,
  clientY: number,
  container: DOMRect,
  rect: DisplayRect,
): Point {
  const x = (clientX - container.left - rect.offsetX) / rect.drawWidth
  const y = (clientY - container.top - rect.offsetY) / rect.drawHeight
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) }
}

export function normBoxFromDrag(a: Point, b: Point): NormBox {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}
