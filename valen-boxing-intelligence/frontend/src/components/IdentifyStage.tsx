import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import { ChevronLeft, Pause, Play } from "lucide-react"
import { clientToNorm, displayedVideoRect, normBoxFromDrag } from "../lib/tracking/geometry"
import { grabRgba } from "../lib/tracking/capture"
import { detectCornersDistributed } from "../lib/tracking/lucasKanade"
import { rgbaToGray } from "../lib/tracking/image"
import { MIN_FEATURE_POINTS, type NormBox } from "../lib/tracking/types"
import { CHECKPOINT_SLOTS, coverageLabel, firstCheckpoint, type CheckpointSlot, type IdentificationCheckpoint } from "../lib/tracking/checkpoints"
import type { PersistedBoxerTrack } from "../lib/tracking/persist"
import { fmtHms } from "../lib/tracking/time"

const btn: CSSProperties = {
  background: "#1f2937",
  border: "1px solid #374151",
  color: "#e5e7eb",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 44,
  minWidth: 44,
  touchAction: "manipulation",
}

function probeBox(video: HTMLVideoElement, box: NormBox): { ok: boolean; count: number } {
  const canvas = document.createElement("canvas")
  const grab = grabRgba(video, canvas)
  if ("error" in grab) return { ok: false, count: 0 }
  const gray = rgbaToGray(grab.pixels, grab.width, grab.height)
  const points = detectCornersDistributed(gray, grab.width, grab.height, {
    x: box.x * grab.width, y: box.y * grab.height, w: box.w * grab.width, h: box.h * grab.height,
  })
  return { ok: points.length >= MIN_FEATURE_POINTS, count: points.length }
}

function thumb(video: HTMLVideoElement): string | undefined {
  try {
    const c = document.createElement("canvas")
    const scale = 160 / Math.max(1, video.videoWidth)
    c.width = 160
    c.height = Math.max(1, Math.round(video.videoHeight * scale))
    const ctx = c.getContext("2d")
    if (!ctx) return undefined
    ctx.drawImage(video, 0, 0, c.width, c.height)
    return c.toDataURL("image/jpeg", 0.55)
  } catch {
    return undefined
  }
}

export default function IdentifyStage(props: {
  tracks: PersistedBoxerTrack[]
  streamUrl: string
  streamCors: boolean
  onBack: () => void
  onTracks: (next: PersistedBoxerTrack[]) => void
  onReview: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const drawStart = useRef({ x: 0, y: 0 })
  const [idx, setIdx] = useState(0)
  const [slot, setSlot] = useState<CheckpointSlot>("early")
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [drawMode, setDrawMode] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [box, setBox] = useState<NormBox | null>(null)
  const [error, setError] = useState("")
  const [skipWarn, setSkipWarn] = useState("")

  const track = props.tracks[idx]
  const sync = useCallback((v: HTMLVideoElement) => {
    setTime(v.currentTime)
    if (Number.isFinite(v.duration)) setDuration(v.duration)
  }, [])

  const paint = useCallback(() => {
    const video = videoRef.current
    const canvas = overlayRef.current
    if (!video || !canvas) return
    const rect = displayedVideoRect(video)
    canvas.width = Math.max(1, Math.round(rect.clientWidth))
    canvas.height = Math.max(1, Math.round(rect.clientHeight))
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const saved = track?.checkpoints[slot]
    const show = box || saved?.bbox
    if (!show) return
    const px = rect.offsetX + show.x * rect.drawWidth
    const py = rect.offsetY + show.y * rect.drawHeight
    const pw = show.w * rect.drawWidth
    const ph = show.h * rect.drawHeight
    const color = track?.color || "#3b82f6"
    ctx.setLineDash(box ? [] : [6, 4])
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(px, py, pw, ph)
    ctx.fillStyle = color + "22"
    ctx.fillRect(px, py, pw, ph)
    ctx.setLineDash([])
    ctx.fillStyle = color
    ctx.font = "bold 13px Inter,sans-serif"
    ctx.fillText(`Boxer ${track?.label} · ${slot}`, px + 4, Math.max(14, py - 6))
  }, [box, slot, track])

  useEffect(() => { paint() }, [paint, time])

  const seekTo = (t: number) => {
    const v = videoRef.current
    if (!v) return
    const dur = Number.isFinite(v.duration) ? v.duration : duration
    v.currentTime = Math.max(0, Math.min(t, dur || t))
    sync(v)
    paint()
  }

  const stepFrame = (dir: 1 | -1) => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    setPlaying(false)
    seekTo(v.currentTime + dir * (1 / 30))
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      setDrawMode(false)
      void v.play().catch(() => undefined)
    } else v.pause()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement
      if (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.tagName === "SELECT") return
      if (e.key === " ") { e.preventDefault(); togglePlay() }
      if (e.key === "ArrowLeft") { e.preventDefault(); seekTo(time - (e.shiftKey ? 5 : 1)) }
      if (e.key === "ArrowRight") { e.preventDefault(); seekTo(time + (e.shiftKey ? 5 : 1)) }
      if (e.key === ",") { e.preventDefault(); stepFrame(-1) }
      if (e.key === ".") { e.preventDefault(); stepFrame(1) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [time])

  const normFromPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const video = videoRef.current
    const canvas = overlayRef.current
    if (!video || !canvas) return { x: 0, y: 0 }
    return clientToNorm(e.clientX, e.clientY, canvas.getBoundingClientRect(), displayedVideoRect(video))
  }

  const confirm = () => {
    if (!box || box.w < 0.02 || box.h < 0.02 || !track) return
    const video = videoRef.current
    if (!video) return
    const probe = probeBox(video, box)
    if (!probe.ok) {
      setError(`Not enough interior corners (${probe.count}, need ${MIN_FEATURE_POINTS}). Draw a tighter box on the boxer, avoiding ropes.`)
      return
    }
    const cp: IdentificationCheckpoint = {
      slot, t: video.currentTime, bbox: box,
      videoWidth: video.videoWidth, videoHeight: video.videoHeight,
      thumbnail: thumb(video),
    }
    const next = props.tracks.map((t, i) => {
      if (i !== idx) return t
      const checkpoints = { ...t.checkpoints, [slot]: cp }
      const first = firstCheckpoint(checkpoints)
      return {
        ...t,
        checkpoints,
        identified: !!first,
        identifyTime: first?.t ?? t.identifyTime,
        bbox: first?.bbox ?? box,
        identifyVideoWidth: first?.videoWidth ?? video.videoWidth,
        identifyVideoHeight: first?.videoHeight ?? video.videoHeight,
        tracked: first?.bbox ?? box,
        lastKnown: first?.bbox ?? box,
      }
    })
    props.onTracks(next)
    setBox(null)
    setDrawMode(false)
    setError("")
    setSkipWarn("")
  }

  const skipSlot = () => {
    setSkipWarn(`Skipped ${slot} for Boxer ${track?.label}. Three checkpoints are recommended for reliable assisted tracking.`)
    setDrawMode(false)
    setBox(null)
  }

  const canReview = props.tracks.every(t => firstCheckpoint(t.checkpoints))
  const dur = duration || 1

  return (
    <div style={{ minHeight: "100vh", background: "#030712", color: "#f1f5f9", fontFamily: "Inter,system-ui,sans-serif" }}>
      <header style={{ background: "#111827", borderBottom: "1px solid #1f2937", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 8 }}>
        <button onClick={props.onBack} style={{ ...btn, minWidth: "auto" }}><ChevronLeft size={16} /> Back</button>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Identify boxers</span>
      </header>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "12px 12px 40px", width: "100%" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {props.tracks.map((t, i) => (
            <button key={t.label} onClick={() => { setIdx(i); setBox(null); setDrawMode(false); setError("") }}
              style={{ flex: "1 1 140px", ...btn, textAlign: "left", border: `2px solid ${idx === i ? t.color : "#1f2937"}`, background: idx === i ? t.color + "22" : "#111827" }}>
              <div style={{ color: t.color }}>Boxer {t.label} · {t.name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{coverageLabel(CHECKPOINT_SLOTS.filter(s => t.checkpoints[s]).length)}</div>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {CHECKPOINT_SLOTS.map(s => (
            <button key={s} onClick={() => { setSlot(s); setBox(null); setDrawMode(false) }}
              style={{ flex: "1 1 90px", ...btn, textTransform: "capitalize", borderColor: slot === s ? (track?.color || "#3b82f6") : "#374151" }}>
              {s}{track?.checkpoints[s] ? ` · ${fmtHms(track.checkpoints[s]!.t)}` : ""}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "#93c5fd", marginBottom: 10, lineHeight: 1.5 }}>
          Use the controls under the video to move. Drawing is off until you tap Draw box. Switching Boxer A/B does not erase the other boxer’s checkpoints.
        </p>
        <div style={{ position: "relative", background: "#000", border: `2px solid ${track?.color || "#3b82f6"}`, borderBottom: "1px solid transparent", borderRadius: "12px 12px 0 0", overflow: "hidden" }}>
          <video ref={videoRef} src={props.streamUrl} crossOrigin={props.streamCors ? "anonymous" : undefined} playsInline
            style={{ width: "100%", display: "block", maxHeight: "46vh", background: "#000" }}
            onTimeUpdate={e => sync(e.currentTarget)}
            onSeeking={e => sync(e.currentTarget)}
            onSeeked={e => { sync(e.currentTarget); paint() }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={e => { sync(e.currentTarget); paint() }}
          />
          <canvas ref={overlayRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: drawMode ? "none" : "auto", pointerEvents: drawMode ? "auto" : "none", cursor: drawMode ? "crosshair" : "default" }}
            onPointerDown={e => {
              if (!drawMode) return
              e.currentTarget.setPointerCapture(e.pointerId)
              const p = normFromPointer(e)
              drawStart.current = p
              setDrawing(true)
              setBox(null)
            }}
            onPointerMove={e => { if (!drawing || !drawMode) return; setBox(normBoxFromDrag(drawStart.current, normFromPointer(e))) }}
            onPointerUp={() => setDrawing(false)}
            onPointerCancel={() => setDrawing(false)}
          />
        </div>
        <div className="identify-controls" style={{ background: "#111827", border: `2px solid ${track?.color || "#3b82f6"}`, borderRadius: "0 0 12px 12px", padding: 12 }}>
          <input type="range" min={0} max={dur} step={0.04} value={Math.min(time, dur)}
            onChange={e => seekTo(parseFloat(e.target.value))}
            style={{ width: "100%", height: 28, accentColor: track?.color || "#2563eb" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}>
            <button style={btn} onClick={togglePlay}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
            {[-10, -5, -1, 1, 5, 10].map(s => (
              <button key={s} style={btn} onClick={() => seekTo(time + s)}>{s > 0 ? `+${s}s` : `${s}s`}</button>
            ))}
            <button style={btn} onClick={() => stepFrame(-1)}>Prev frame</button>
            <button style={btn} onClick={() => stepFrame(1)}>Next frame</button>
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{fmtHms(time)} / {fmtHms(duration)}</span>
            <select value={rate} onChange={e => {
              const r = parseFloat(e.target.value)
              setRate(r)
              if (videoRef.current) videoRef.current.playbackRate = r
            }} style={{ ...btn, minWidth: 80 }}>
              {[0.25, 0.5, 1, 2].map(r => <option key={r} value={r}>{r}x</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <button style={{ ...btn, background: drawMode ? (track?.color || "#2563eb") : "#1f2937", flex: "1 1 160px" }}
              onClick={() => {
                videoRef.current?.pause()
                setPlaying(false)
                setDrawMode(d => !d)
                setBox(null)
              }}>
              {drawMode ? "Cancel drawing / resume navigation" : `Draw box · ${slot}`}
            </button>
            <button style={{ ...btn, flex: "1 1 120px" }} onClick={skipSlot}>Skip this checkpoint</button>
          </div>
        </div>
        {error && <p style={{ color: "#f87171", marginTop: 10 }}>{error}</p>}
        {skipWarn && <p style={{ color: "#fbbf24", marginTop: 10 }}>{skipWarn}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button style={{ ...btn, flex: 1 }} onClick={() => { setBox(null); setDrawMode(false) }}>Clear box</button>
          <button style={{ ...btn, flex: 2, background: box ? (track?.color || "#2563eb") : "#374151" }} disabled={!box} onClick={confirm}>
            Confirm {track?.label} {slot} at {fmtHms(time)}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 16 }}>
          {props.tracks.flatMap(t => CHECKPOINT_SLOTS.map(s => {
            const c = t.checkpoints[s]
            return (
              <div key={`${t.label}-${s}`} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: 8 }}>
                <p style={{ fontSize: 11, color: t.color, fontWeight: 700 }}>Boxer {t.label} · {s}</p>
                {c ? (
                  <>
                    {c.thumbnail && <img src={c.thumbnail} alt="" style={{ width: "100%", borderRadius: 6, margin: "6px 0" }} />}
                    <p style={{ fontSize: 11 }}>{fmtHms(c.t)}</p>
                  </>
                ) : <p style={{ fontSize: 11, color: "#6b7280" }}>Empty</p>}
              </div>
            )
          }))}
        </div>
        {canReview && (
          <button onClick={props.onReview} style={{ ...btn, width: "100%", marginTop: 16, background: "#16a34a", borderColor: "#16a34a" }}>
            Review checkpoints
          </button>
        )}
      </div>
    </div>
  )
}
