import type { Point } from "./types"
import { buildPyramid, sampleBilinear, type PyramidLevel } from "./image"
import { median } from "./geometry"

const WIN = 5
const MAX_ITER = 8
const EPS = 0.03
const PYR_LEVELS = 3
const FB_THRESH = 3.5
const MAX_POINTS = 48
const MIN_DISTANCE = 6
const QUALITY = 0.08

export function detectCorners(
  gray: Float32Array,
  w: number,
  h: number,
  roi: { x: number; y: number; w: number; h: number },
  maxPoints = MAX_POINTS,
): Point[] {
  const x0 = Math.max(2, Math.floor(roi.x))
  const y0 = Math.max(2, Math.floor(roi.y))
  const x1 = Math.min(w - 3, Math.floor(roi.x + roi.w))
  const y1 = Math.min(h - 3, Math.floor(roi.y + roi.h))
  if (x1 - x0 < 8 || y1 - y0 < 8) return []

  const rw = x1 - x0
  const rh = y1 - y0
  const lambda = new Float32Array(rw * rh)

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let a = 0, b = 0, c = 0
      for (let wy = -1; wy <= 1; wy++) {
        for (let wx = -1; wx <= 1; wx++) {
          const ix = 0.5 * (gray[y * w + (x + wx + 1)] - gray[y * w + (x + wx - 1)])
          const iy = 0.5 * (gray[(y + wy + 1) * w + x] - gray[(y + wy - 1) * w + x])
          a += ix * ix
          b += ix * iy
          c += iy * iy
        }
      }
      const disc = Math.sqrt(Math.max(0, (a - c) * (a - c) + 4 * b * b))
      lambda[(y - y0) * rw + (x - x0)] = 0.5 * (a + c - disc)
    }
  }

  let maxL = 0
  for (let i = 0; i < lambda.length; i++) if (lambda[i] > maxL) maxL = lambda[i]
  const thresh = maxL * QUALITY
  if (maxL <= 1e-6) return []

  const candidates: { x: number; y: number; s: number }[] = []
  for (let y = 1; y < rh - 1; y++) {
    for (let x = 1; x < rw - 1; x++) {
      const s = lambda[y * rw + x]
      if (s < thresh) continue
      let isMax = true
      for (let ny = -1; ny <= 1 && isMax; ny++) {
        for (let nx = -1; nx <= 1; nx++) {
          if (nx === 0 && ny === 0) continue
          if (lambda[(y + ny) * rw + (x + nx)] > s) { isMax = false; break }
        }
      }
      if (isMax) candidates.push({ x: x0 + x, y: y0 + y, s })
    }
  }
  candidates.sort((a, b) => b.s - a.s)

  const points: Point[] = []
  const minD2 = MIN_DISTANCE * MIN_DISTANCE
  for (const c of candidates) {
    if (points.length >= maxPoints) break
    let ok = true
    for (const p of points) {
      const dx = p.x - c.x
      const dy = p.y - c.y
      if (dx * dx + dy * dy < minD2) { ok = false; break }
    }
    if (ok) points.push({ x: c.x, y: c.y })
  }
  return points
}

function lkAtLevel(
  prev: PyramidLevel,
  curr: PyramidLevel,
  x: number,
  y: number,
  gdx: number,
  gdy: number,
): { dx: number; dy: number; ok: boolean } {
  const hw = WIN
  if (
    x < hw + 1 || y < hw + 1 || x >= prev.w - hw - 1 || y >= prev.h - hw - 1
  ) {
    return { dx: gdx, dy: gdy, ok: false }
  }

  let dx = gdx
  let dy = gdy
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0
    for (let wy = -hw; wy <= hw; wy++) {
      for (let wx = -hw; wx <= hw; wx++) {
        const px = x + wx
        const py = y + wy
        const cx = x + dx + wx
        const cy = y + dy + wy
        if (cx < 1 || cy < 1 || cx >= curr.w - 1 || cy >= curr.h - 1) {
          return { dx, dy, ok: false }
        }
        const ix = 0.5 * (sampleBilinear(prev.data, prev.w, prev.h, px + 1, py) - sampleBilinear(prev.data, prev.w, prev.h, px - 1, py))
        const iy = 0.5 * (sampleBilinear(prev.data, prev.w, prev.h, px, py + 1) - sampleBilinear(prev.data, prev.w, prev.h, px, py - 1))
        const it = sampleBilinear(curr.data, curr.w, curr.h, cx, cy) - sampleBilinear(prev.data, prev.w, prev.h, px, py)
        a11 += ix * ix
        a12 += ix * iy
        a22 += iy * iy
        b1 += ix * it
        b2 += iy * it
      }
    }
    const det = a11 * a22 - a12 * a12
    if (Math.abs(det) < 1e-3) return { dx, dy, ok: false }
    const ux = (a22 * -b1 - a12 * -b2) / det
    const uy = (a11 * -b2 - a12 * -b1) / det
    dx += ux
    dy += uy
    if (Math.abs(ux) + Math.abs(uy) < EPS) break
  }
  return { dx, dy, ok: true }
}

export function trackPointPyramidal(
  prevPyr: PyramidLevel[],
  currPyr: PyramidLevel[],
  pt: Point,
): { x: number; y: number; ok: boolean } {
  const levels = Math.min(prevPyr.length, currPyr.length, PYR_LEVELS)
  let dx = 0
  let dy = 0
  let finestOk = false
  for (let lvl = levels - 1; lvl >= 0; lvl--) {
    const scale = 2 ** lvl
    const x = pt.x / scale
    const y = pt.y / scale
    if (lvl < levels - 1) {
      dx *= 2
      dy *= 2
    }
    const r = lkAtLevel(prevPyr[lvl], currPyr[lvl], x, y, dx, dy)
    if (!r.ok) continue
    dx = r.dx
    dy = r.dy
    if (lvl === 0) finestOk = true
  }
  return { x: pt.x + dx, y: pt.y + dy, ok: finestOk }
}

export interface FlowResult {
  prev: Point
  curr: Point
  ok: boolean
  fbError: number
}

export function trackPointsFB(
  prevGray: Float32Array,
  currGray: Float32Array,
  w: number,
  h: number,
  points: Point[],
): FlowResult[] {
  const prevPyr = buildPyramid(prevGray, w, h, PYR_LEVELS)
  const currPyr = buildPyramid(currGray, w, h, PYR_LEVELS)
  const results: FlowResult[] = []
  for (const p of points) {
    const fwd = trackPointPyramidal(prevPyr, currPyr, p)
    if (!fwd.ok) {
      results.push({ prev: p, curr: p, ok: false, fbError: 1e6 })
      continue
    }
    const back = trackPointPyramidal(currPyr, prevPyr, fwd)
    const fb = back.ok ? Math.hypot(back.x - p.x, back.y - p.y) : 1e6
    const ok = back.ok && fb <= FB_THRESH
    results.push({ prev: p, curr: { x: fwd.x, y: fwd.y }, ok, fbError: fb })
  }
  return results
}

export function robustTranslation(flow: FlowResult[]): { dx: number; dy: number; inliers: FlowResult[]; medianFb: number } {
  const ok = flow.filter(f => f.ok)
  if (ok.length === 0) return { dx: 0, dy: 0, inliers: [], medianFb: 1e6 }
  const dxs = ok.map(f => f.curr.x - f.prev.x)
  const dys = ok.map(f => f.curr.y - f.prev.y)
  const mdx = median(dxs)
  const mdy = median(dys)
  const residuals = ok.map(f => Math.hypot(f.curr.x - f.prev.x - mdx, f.curr.y - f.prev.y - mdy))
  const mad = median(residuals) || 0.5
  const thresh = Math.max(1.5, 2.5 * mad)
  const inliers = ok.filter((_, i) => residuals[i] <= thresh)
  const used = inliers.length >= 3 ? inliers : ok
  const dx = median(used.map(f => f.curr.x - f.prev.x))
  const dy = median(used.map(f => f.curr.y - f.prev.y))
  const medianFb = median(used.map(f => f.fbError))
  return { dx, dy, inliers: used, medianFb }
}

export function robustScale(flow: FlowResult[], cx: number, cy: number): number {
  const ratios: number[] = []
  for (const f of flow) {
    if (!f.ok) continue
    const d0 = Math.hypot(f.prev.x - cx, f.prev.y - cy)
    const d1 = Math.hypot(f.curr.x - cx, f.curr.y - cy)
    if (d0 > 6) ratios.push(d1 / d0)
  }
  if (ratios.length < 4) return 1
  const s = median(ratios)
  if (!Number.isFinite(s)) return 1
  return Math.max(0.85, Math.min(1.15, s))
}

export function spatialSpread(points: Point[], boxPx: { x: number; y: number; w: number; h: number }): number {
  if (points.length < 2 || boxPx.w <= 1 || boxPx.h <= 1) return 0
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length
  const my = points.reduce((s, p) => s + p.y, 0) / points.length
  const sx = Math.sqrt(points.reduce((s, p) => s + (p.x - mx) ** 2, 0) / points.length)
  const sy = Math.sqrt(points.reduce((s, p) => s + (p.y - my) ** 2, 0) / points.length)
  return Math.min(1, (sx / boxPx.w + sy / boxPx.h) / 0.35)
}

export interface Affine2D {
  a: number
  b: number
  tx: number
  c: number
  d: number
  ty: number
}

export function applyAffine(aff: Affine2D, x: number, y: number): Point {
  return { x: aff.a * x + aff.b * y + aff.tx, y: aff.c * x + aff.d * y + aff.ty }
}

function solveLinear6(A: number[][], b: number[]): number[] | null {
  const n = 6
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    }
    if (Math.abs(M[pivot][col]) < 1e-8) return null
    if (pivot !== col) {
      const tmp = M[col]
      M[col] = M[pivot]
      M[pivot] = tmp
    }
    const div = M[col][col]
    for (let c = col; c <= n; c++) M[col][c] /= div
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map(row => row[n])
}

export function fitAffine(pairs: FlowResult[]): Affine2D | null {
  if (pairs.length < 3) return null
  const AtA = Array.from({ length: 6 }, () => Array(6).fill(0))
  const Atb = Array(6).fill(0)
  for (const f of pairs) {
    const x = f.prev.x
    const y = f.prev.y
    const rows = [
      [x, y, 1, 0, 0, 0, f.curr.x],
      [0, 0, 0, x, y, 1, f.curr.y],
    ]
    for (const row of rows) {
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) AtA[i][j] += row[i] * row[j]
        Atb[i] += row[i] * row[6]
      }
    }
  }
  const sol = solveLinear6(AtA, Atb)
  if (!sol) return null
  return { a: sol[0], b: sol[1], tx: sol[2], c: sol[3], d: sol[4], ty: sol[5] }
}

export function estimateAffineRansac(flow: FlowResult[]): { affine: Affine2D; inliers: FlowResult[]; ok: boolean } | null {
  const ok = flow.filter(f => f.ok)
  if (ok.length < 3) return null
  const thresh = 2.8
  let best: FlowResult[] = []
  const trials = Math.min(36, ok.length * 6)
  for (let t = 0; t < trials; t++) {
    const i0 = Math.floor(Math.random() * ok.length)
    let i1 = Math.floor(Math.random() * ok.length)
    let i2 = Math.floor(Math.random() * ok.length)
    if (i1 === i0) i1 = (i1 + 1) % ok.length
    if (i2 === i0 || i2 === i1) i2 = (i2 + 2) % ok.length
    const seed = fitAffine([ok[i0], ok[i1], ok[i2]])
    if (!seed) continue
    const inliers = ok.filter(f => {
      const p = applyAffine(seed, f.prev.x, f.prev.y)
      return Math.hypot(p.x - f.curr.x, p.y - f.curr.y) <= thresh
    })
    if (inliers.length > best.length) best = inliers
  }
  if (best.length < 3) return null
  const affine = fitAffine(best)
  if (!affine) return null
  const inliers = ok.filter(f => {
    const p = applyAffine(affine, f.prev.x, f.prev.y)
    return Math.hypot(p.x - f.curr.x, p.y - f.curr.y) <= thresh
  })
  const used = inliers.length >= 3 ? inliers : best
  const refined = fitAffine(used) ?? affine
  const scale = Math.sqrt(Math.abs(refined.a * refined.d - refined.b * refined.c))
  const okAff = used.length >= 6 && Number.isFinite(scale) && scale > 0.7 && scale < 1.4
  return { affine: refined, inliers: used, ok: okAff }
}

export function transformBoxAffine(
  boxPx: { x: number; y: number; w: number; h: number },
  aff: Affine2D,
): { x: number; y: number; w: number; h: number } {
  const corners = [
    applyAffine(aff, boxPx.x, boxPx.y),
    applyAffine(aff, boxPx.x + boxPx.w, boxPx.y),
    applyAffine(aff, boxPx.x, boxPx.y + boxPx.h),
    applyAffine(aff, boxPx.x + boxPx.w, boxPx.y + boxPx.h),
  ]
  const xs = corners.map(p => p.x)
  const ys = corners.map(p => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(4, Math.max(...xs) - x), h: Math.max(4, Math.max(...ys) - y) }
}

/** Prefer interior corners, then fill remaining by score with spatial separation. */
export function detectCornersDistributed(
  gray: Float32Array,
  w: number,
  h: number,
  roi: { x: number; y: number; w: number; h: number },
  maxPoints = MAX_POINTS,
): Point[] {
  const insetX = Math.max(2, roi.w * 0.08)
  const insetY = Math.max(2, roi.h * 0.08)
  const inner = {
    x: roi.x + insetX,
    y: roi.y + insetY,
    w: Math.max(8, roi.w - 2 * insetX),
    h: Math.max(8, roi.h - 2 * insetY),
  }
  const all = detectCorners(gray, w, h, inner, maxPoints * 3)
  if (all.length === 0) return detectCorners(gray, w, h, roi, maxPoints)
  const gx = 3
  const gy = 3
  const picked: Point[] = []
  for (let cy = 0; cy < gy; cy++) {
    for (let cx = 0; cx < gx; cx++) {
      const x0 = inner.x + (inner.w * cx) / gx
      const y0 = inner.y + (inner.h * cy) / gy
      const x1 = inner.x + (inner.w * (cx + 1)) / gx
      const y1 = inner.y + (inner.h * (cy + 1)) / gy
      const cell = all.filter(p => p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1)
      if (cell.length) picked.push(cell[0])
    }
  }
  return mergePoints(picked, all, MIN_DISTANCE, maxPoints)
}

export function mergePoints(a: Point[], b: Point[], minDist: number, max: number): Point[] {
  const out = [...a]
  const d2 = minDist * minDist
  for (const p of b) {
    if (out.length >= max) break
    if (out.every(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= d2)) out.push(p)
  }
  return out
}
