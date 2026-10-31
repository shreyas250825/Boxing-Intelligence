import type { DisplayRect, NormBox, TrackStatus } from "./types"

export function drawTracks(
  ctx: CanvasRenderingContext2D,
  rect: DisplayRect,
  tracks: {
    label: string
    color: string
    status: TrackStatus
    bbox: NormBox | null
    lastKnown: NormBox | null
    confidence: number
    validPoints: number
  }[],
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (const t of tracks) {
    const live = t.status === "TRACKING" || t.status === "UNCERTAIN"
    const box = live ? t.bbox : t.lastKnown
    if (!box) continue
    const px = rect.offsetX + box.x * rect.drawWidth
    const py = rect.offsetY + box.y * rect.drawHeight
    const pw = box.w * rect.drawWidth
    const ph = box.h * rect.drawHeight
    const lost = t.status === "LOST"
    const uncertain = t.status === "UNCERTAIN"
    ctx.strokeStyle = lost ? "#ef4444" : uncertain ? "#f59e0b" : t.color
    ctx.lineWidth = 2
    ctx.setLineDash(lost || uncertain ? [5, 4] : [])
    ctx.globalAlpha = lost ? 0.55 : 1
    ctx.strokeRect(px, py, pw, ph)
    ctx.fillStyle = (lost ? "#ef4444" : t.color) + "18"
    ctx.fillRect(px, py, pw, ph)
    ctx.globalAlpha = 1
    ctx.setLineDash([])
    ctx.font = "bold 12px Inter,sans-serif"
    ctx.fillStyle = lost ? "#ef4444" : uncertain ? "#f59e0b" : t.color
    const tag = lost
      ? `Boxer ${t.label} — LAST KNOWN (LOST)`
      : uncertain
        ? `Boxer ${t.label} — UNCERTAIN`
        : `Boxer ${t.label}  ${Math.round(t.confidence * 100)}%  ${t.validPoints} pts`
    ctx.fillText(tag, px + 4, Math.max(12, py - 6))
  }
}
