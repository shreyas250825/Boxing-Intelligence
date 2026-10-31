export function rgbaToGray(data: Uint8ClampedArray | Uint8Array, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height)
  const n = width * height
  for (let i = 0; i < n; i++) {
    const o = i * 4
    gray[i] = data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114
  }
  return gray
}

export function downsample2(src: Float32Array, w: number, h: number): { data: Float32Array; w: number; h: number } {
  const nw = Math.max(1, Math.floor(w / 2))
  const nh = Math.max(1, Math.floor(h / 2))
  const dst = new Float32Array(nw * nh)
  for (let y = 0; y < nh; y++) {
    const y0 = Math.min(h - 1, y * 2)
    const y1 = Math.min(h - 1, y0 + 1)
    for (let x = 0; x < nw; x++) {
      const x0 = Math.min(w - 1, x * 2)
      const x1 = Math.min(w - 1, x0 + 1)
      dst[y * nw + x] = 0.25 * (
        src[y0 * w + x0] + src[y0 * w + x1] + src[y1 * w + x0] + src[y1 * w + x1]
      )
    }
  }
  return { data: dst, w: nw, h: nh }
}

export interface PyramidLevel {
  data: Float32Array
  w: number
  h: number
}

export function buildPyramid(gray: Float32Array, w: number, h: number, levels: number): PyramidLevel[] {
  const pyr: PyramidLevel[] = [{ data: gray, w, h }]
  for (let i = 1; i < levels; i++) {
    const prev = pyr[i - 1]
    if (prev.w < 16 || prev.h < 16) break
    const next = downsample2(prev.data, prev.w, prev.h)
    pyr.push({ data: next.data, w: next.w, h: next.h })
  }
  return pyr
}

export function sampleBilinear(img: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) {
    const xi = Math.max(0, Math.min(w - 1, Math.round(x)))
    const yi = Math.max(0, Math.min(h - 1, Math.round(y)))
    return img[yi * w + xi]
  }
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const i00 = img[y0 * w + x0]
  const i10 = img[y0 * w + x0 + 1]
  const i01 = img[(y0 + 1) * w + x0]
  const i11 = img[(y0 + 1) * w + x0 + 1]
  return i00 * (1 - fx) * (1 - fy) + i10 * fx * (1 - fy) + i01 * (1 - fx) * fy + i11 * fx * fy
}
