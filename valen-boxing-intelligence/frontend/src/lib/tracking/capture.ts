import { PROCESS_TARGET_HEIGHT, PROCESS_TARGET_WIDTH } from "./types"

export const PROCESS_MAX_WIDTH = PROCESS_TARGET_WIDTH
export const PROCESS_MAX_HEIGHT = PROCESS_TARGET_HEIGHT

export type GrabError = "not-ready" | "tainted" | "failed"

let budgetW = PROCESS_TARGET_WIDTH
let budgetH = PROCESS_TARGET_HEIGHT
let locked: { w: number; h: number } | null = null
let slowStreak = 0
let fastStreak = 0

export function processSize(
  videoWidth: number,
  videoHeight: number,
  maxW = budgetW,
  maxH = budgetH,
): { w: number; h: number } {
  if (locked) return locked
  if (videoWidth <= 0 || videoHeight <= 0) return { w: Math.min(320, maxW), h: Math.min(180, maxH) }
  const scale = Math.min(1, maxW / videoWidth, maxH / videoHeight)
  return {
    w: Math.max(32, Math.round(videoWidth * scale)),
    h: Math.max(32, Math.round(videoHeight * scale)),
  }
}

export function lockProcessSize(videoWidth: number, videoHeight: number): { w: number; h: number } {
  locked = null
  locked = processSize(videoWidth, videoHeight, budgetW, budgetH)
  return locked
}

export function unlockProcessSize(): void {
  locked = null
}

export function noteProcessTime(ms: number): { w: number; h: number; changed: boolean } {
  const before = { w: budgetW, h: budgetH }
  if (ms > 95) {
    slowStreak += 1
    fastStreak = 0
    if (slowStreak >= 4 && budgetW > 480) {
      budgetW = 480
      budgetH = 270
    } else if (slowStreak >= 8 && budgetW > 320) {
      budgetW = 320
      budgetH = 180
    }
  } else if (ms < 40) {
    fastStreak += 1
    slowStreak = 0
    if (fastStreak >= 12 && budgetW < PROCESS_TARGET_WIDTH) {
      budgetW = PROCESS_TARGET_WIDTH
      budgetH = PROCESS_TARGET_HEIGHT
    }
  } else {
    slowStreak = 0
    fastStreak = 0
  }
  return { w: budgetW, h: budgetH, changed: before.w !== budgetW }
}

export function currentProcessBudget(): { w: number; h: number } {
  return { w: budgetW, h: budgetH }
}

export function resetProcessBudget(): void {
  budgetW = PROCESS_TARGET_WIDTH
  budgetH = PROCESS_TARGET_HEIGHT
  locked = null
  slowStreak = 0
  fastStreak = 0
}

export function apiBaseUrl(): string {
  return ((import.meta.env.VITE_API_BASE_URL as string | undefined) || "").replace(/\/$/, "")
}

/**
 * Dev: same-origin `/api` through the Vite proxy (canvas-safe).
 * Production: stream directly from the API origin (Render) with CORS + crossOrigin,
 * because proxying Range video through Vercel is unreliable for large files.
 */
export function resolveVideoStream(
  videoId: string,
  opts?: { dev?: boolean; apiBase?: string; pageOrigin?: string },
): { url: string; useCors: boolean } {
  const path = `/api/v1/videos/${videoId}/stream`
  const dev = opts?.dev ?? Boolean(import.meta.env.DEV)
  const apiBase = opts?.apiBase ?? apiBaseUrl()
  const pageOrigin = opts?.pageOrigin ?? (typeof window !== "undefined" ? window.location.origin : "")
  if (dev || !apiBase) {
    const url = path
    const useCors = Boolean(pageOrigin) && new URL(url, pageOrigin || "http://localhost").origin !== (pageOrigin || "http://localhost")
    return { url, useCors }
  }
  const url = `${apiBase}${path}`
  let useCors = true
  try {
    if (pageOrigin) useCors = new URL(url).origin !== pageOrigin
  } catch {
    useCors = true
  }
  return { url, useCors }
}

export function videoStreamPath(videoId: string): string {
  return resolveVideoStream(videoId).url
}

export function videoUsesCors(videoId: string): boolean {
  return resolveVideoStream(videoId).useCors
}

export function grabRgba(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): { pixels: Uint8ClampedArray; width: number; height: number } | { error: GrabError } {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
    return { error: "not-ready" }
  }
  const { w, h } = processSize(video.videoWidth, video.videoHeight)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return { error: "failed" }
  try {
    ctx.drawImage(video, 0, 0, w, h)
    const image = ctx.getImageData(0, 0, w, h)
    return { pixels: image.data.slice(), width: w, height: h }
  } catch (err) {
    const tainted = err instanceof DOMException && (err.name === "SecurityError" || err.code === 18)
    return { error: tainted ? "tainted" : "failed" }
  }
}
