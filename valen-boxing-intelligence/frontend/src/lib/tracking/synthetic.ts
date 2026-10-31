/** Reproducible synthetic frames for tracker tests. Not boxing footage. */

export function makeBlank(w: number, h: number, bg = 28): Float32Array {
  return new Float32Array(w * h).fill(bg)
}

export function paintTexturedRect(
  gray: Float32Array,
  w: number,
  h: number,
  x: number,
  y: number,
  bw: number,
  bh: number,
  seed = 1,
): void {
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const gx = x0 + px
      const gy = y0 + py
      if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue
      const checker = ((px >> 1) + (py >> 1)) % 2 === 0 ? 210 : 115
      const grain = ((px * 13 + py * 7 + seed * 17) % 11)
      gray[gy * w + gx] = checker + grain
    }
  }
}

export function frameWithSubject(
  w: number,
  h: number,
  subject: { x: number; y: number; w: number; h: number; seed?: number },
  bg = 28,
): Float32Array {
  const gray = makeBlank(w, h, bg)
  paintTexturedRect(gray, w, h, subject.x, subject.y, subject.w, subject.h, subject.seed ?? 1)
  return gray
}
