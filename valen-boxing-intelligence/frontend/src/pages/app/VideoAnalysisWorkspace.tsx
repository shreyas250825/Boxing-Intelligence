import {
  useEffect, useRef, useState, useCallback, useMemo
} from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts"
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize, Save, ChevronLeft, Zap, Activity,
  AlertTriangle, CheckCircle2, Square, Settings, Tag,
  UserCheck, Users, Crosshair, Info
} from "lucide-react"
import apiClient from "../../api/client"
import type { Video, Boxer } from "../../types"
import {
  saveBrowserAnalysis, getBrowserAnalysis,
  type ActionEvent, type RoundConfig,
  type CoachSummary, type BrowserAnalysis, type TrackingPayload
} from "../../api/analysis"
import { clientToNorm, displayedVideoRect } from "../../lib/tracking/geometry"
import { grabRgba, lockProcessSize, resetProcessBudget, videoStreamPath, videoUsesCors } from "../../lib/tracking/capture"
import { appendSample, createMovementState, resetBaseline, type MovementState } from "../../lib/tracking/movement"
import { drawTracks } from "../../lib/tracking/drawOverlay"
import { MEASUREMENT_LABEL, type NormBox, type TrackingSample, type TrackUpdate } from "../../lib/tracking/types"
import {
  cumulativeSeries, tracksFromPayload, tracksToPayload, type PersistedBoxerTrack
} from "../../lib/tracking/persist"
import { buildPerformanceReport, type PerformanceReportData } from "../../lib/tracking/buildReport"
import { fmtHms } from "../../lib/tracking/time"
import PerformanceReport from "../../components/PerformanceReport"
import IdentifyStage from "../../components/IdentifyStage"
import { emptyCheckpoints, firstCheckpoint, sortedCheckpoints, type TrackingCorrection } from "../../lib/tracking/checkpoints"


const ACTION_TYPES = [
  { id: "jab",        label: "Jab",       key: "j", color: "#3b82f6" },
  { id: "cross",      label: "Cross",     key: "c", color: "#8b5cf6" },
  { id: "lead_hook",  label: "L.Hook",    key: "h", color: "#06b6d4" },
  { id: "rear_hook",  label: "R.Hook",    key: "r", color: "#0ea5e9" },
  { id: "uppercut",   label: "Uppercut",  key: "u", color: "#f59e0b" },
  { id: "block",      label: "Block",     key: "b", color: "#14b8a6" },
  { id: "slip",       label: "Slip",      key: "s", color: "#a3e635" },
  { id: "duck",       label: "Duck",      key: "q", color: "#eab308" },
  { id: "defensive",  label: "Defense",   key: "d", color: "#10b981" },
  { id: "head_move",  label: "Head Mvt",  key: "m", color: "#22c55e" },
  { id: "footwork",   label: "Footwork",  key: "f", color: "#84cc16" },
  { id: "guard",      label: "Guard",     key: "g", color: "#6366f1" },
  { id: "combo",      label: "Combo",     key: "k", color: "#ec4899" },
  { id: "other",      label: "Other",     key: "o", color: "#94a3b8" },
]

type BoxerTrack = PersistedBoxerTrack
type Stage = "setup" | "identify" | "review" | "workspace" | "report"

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function emptyTrack(partial: Pick<BoxerTrack, "boxerId" | "label" | "name" | "color">): BoxerTrack {
  return {
    ...partial,
    bbox: null,
    identified: false,
    identifyTime: 0,
    identifyVideoWidth: 0,
    identifyVideoHeight: 0,
    tracked: null,
    status: "PENDING",
    confidence: 0,
    validPoints: 0,
    samples: [],
    totalMovement: 0,
    validSampleCount: 0,
    lossIntervals: [],
    lastKnown: null,
    lastKnownTime: null,
    checkpoints: emptyCheckpoints(),
    corrections: [],
  }
}

export default function VideoAnalysisWorkspace() {
  const { videoId } = useParams<{ videoId: string }>()
  const nav = useNavigate()

  const [videoMeta, setVideoMeta] = useState<Video | null>(null)
  const [boxerMeta, setBoxerMeta] = useState<Boxer | null>(null)
  const [allBoxers, setAllBoxers] = useState<Boxer[]>([])
  const [opponentId, setOpponentId] = useState("")

  const [stage, setStage] = useState<Stage>("setup")
  const [analyseMode, setAnalyseMode] = useState<"single" | "both">("single")
  const [tracks, setTracks] = useState<BoxerTrack[]>([])
  const [currentIdentifyIdx, setCurrentIdentifyIdx] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const identifyVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const identifyOverlayRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const analysisIdRef = useRef<string | null>(null)
  const tracksRef = useRef<BoxerTrack[]>([])
  const movementRef = useRef<Record<string, MovementState>>({})
  const activeRef = useRef(false)
  const processingRef = useRef(false)
  const lastMediaTimeRef = useRef(-1)
  const seekResetRef = useRef(false)
  const initedRef = useRef(false)
  const rvfcRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const decodeFailsRef = useRef(0)
  const uiTickRef = useRef(0)
  const cameraReliableRef = useRef(false)
  const endedOnceRef = useRef(false)
  const finishingRef = useRef(false)
  const startWhenReadyRef = useRef(false)

  const [playing, setPlaying] = useState(false)
  const [curTime, setCurTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [pbRate, setPbRate] = useState(1)
  const [vError, setVError] = useState("")
  const [trackError, setTrackError] = useState("")

  const [active, setActive] = useState(false)
  const [frames, setFrames] = useState(0)
  const [events, setEvents] = useState<ActionEvent[]>([])
  const [saved, setSaved] = useState<BrowserAnalysis | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [saveError, setSaveError] = useState("")

  const [rightTab, setRightTab] = useState<"metrics" | "events" | "rounds">("metrics")
  const [roundCfg, setRoundCfg] = useState<RoundConfig>({ num_rounds: 3, round_duration: 180, rest_duration: 60, start_offset: 0 })
  const [showRndCfg, setShowRndCfg] = useState(false)
  const [coach, setCoach] = useState<CoachSummary>({})
  const [showCoach, setShowCoach] = useState(false)
  const [activeBoxerIdx, setActiveBoxerIdx] = useState(0)

  const [drawnBox, setDrawnBox] = useState<NormBox | null>(null)
  const [hasSavedTracking, setHasSavedTracking] = useState(false)
  const [report, setReport] = useState<PerformanceReportData | null>(null)
  const [punchPlace, setPunchPlace] = useState(false)
  const [punchMeta, setPunchMeta] = useState<{
    target_area?: ActionEvent["target_area"]
    target_side?: ActionEvent["target_side"]
    outcome?: ActionEvent["outcome"]
    hand?: ActionEvent["hand"]
    nx?: number
    ny?: number
  }>({})

  useEffect(() => { tracksRef.current = tracks }, [tracks])
  useEffect(() => { activeRef.current = active }, [active])

  const streamUrl = videoId ? videoStreamPath(videoId) : ""
  const streamCors = Boolean(videoId && videoUsesCors(videoId))

  useEffect(() => {
    if (!videoId) return
    apiClient.get(`/api/v1/videos/${videoId}`)
      .then(r => {
        const vid = (r.data as { data: Video }).data
        setVideoMeta(vid)
        return apiClient.get(`/api/v1/boxers/${vid.boxer_id}`)
      })
      .then(r => setBoxerMeta((r.data as { data: Boxer }).data))
      .catch(() => {})

    apiClient.get(`/api/v1/boxers?page_size=50`)
      .then(r => setAllBoxers((r.data as { data: Boxer[] }).data))
      .catch(() => {})

    getBrowserAnalysis(videoId).then(a => {
      if (!a) return
      setSaved(a); analysisIdRef.current = a.id
      if (a.action_events_json) try { setEvents(JSON.parse(a.action_events_json)) } catch { /* ignore */ }
      if (a.round_config_json) try { setRoundCfg(JSON.parse(a.round_config_json)) } catch { /* ignore */ }
      if (a.coach_summary_json) try { setCoach(JSON.parse(a.coach_summary_json)) } catch { /* ignore */ }
      if (a.tracking_json) {
        try {
          const payload = JSON.parse(a.tracking_json) as TrackingPayload
          const restored = tracksFromPayload(payload)
          restored.forEach(t => {
            const trackedSamples = t.samples.filter(s => s.status === "TRACKING")
            const last = trackedSamples.length ? trackedSamples[trackedSamples.length - 1] : null
            movementRef.current[t.label] = {
              samples: t.samples,
              totalMovement: t.totalMovement,
              validSampleCount: t.validSampleCount,
              lastValid: last,
              lossIntervals: t.lossIntervals,
              openLoss: t.lossIntervals.some(l => l.end === null)
                ? t.lossIntervals.find(l => l.end === null) ?? null
                : null,
            }
          })
          setTracks(restored)
          setHasSavedTracking(true)
          if (payload.report) setReport(payload.report as PerformanceReportData)
        } catch { /* ignore */ }
      }
      if (a.report_json) {
        try { setReport(JSON.parse(a.report_json) as PerformanceReportData) } catch { /* ignore */ }
      }
    }).catch(() => {})
  }, [videoId])

  const paintOverlay = useCallback(() => {
    const video = videoRef.current
    const ov = overlayRef.current
    if (!video || !ov) return
    const rect = displayedVideoRect(video)
    if (ov.width !== Math.round(rect.clientWidth) || ov.height !== Math.round(rect.clientHeight)) {
      ov.width = Math.max(1, Math.round(rect.clientWidth))
      ov.height = Math.max(1, Math.round(rect.clientHeight))
    }
    const ctx = ov.getContext("2d")
    if (!ctx) return
    drawTracks(ctx, rect, tracksRef.current.map(t => ({
      label: t.label,
      color: t.color,
      status: t.status,
      bbox: t.tracked,
      lastKnown: t.lastKnown,
      confidence: t.confidence,
      validPoints: t.validPoints,
    })))
  }, [])

  const applyUpdates = useCallback((updates: TrackUpdate[], cameraReliable: boolean) => {
    cameraReliableRef.current = cameraReliable
    const video = videoRef.current
    const vw = video?.videoWidth || 1
    const vh = video?.videoHeight || 1
    const next = tracksRef.current.map(t => {
      const u = updates.find(x => x.id === t.label)
      if (!u) return t
      if (u.initFailed && u.initReason) setTrackError(`Boxer ${t.label}: ${u.initReason}`)
      if (u.pendingInit || u.status === "PENDING" || u.timestamp + 0.001 < t.identifyTime) {
        return { ...t, status: "PENDING" as const, tracked: t.bbox }
      }
      const box = u.bbox
      const sample: TrackingSample = {
        t: u.timestamp,
        cx: u.cx,
        cy: u.cy,
        x: box?.x ?? t.tracked?.x ?? t.bbox?.x ?? 0,
        y: box?.y ?? t.tracked?.y ?? t.bbox?.y ?? 0,
        w: box?.w ?? t.tracked?.w ?? t.bbox?.w ?? 0,
        h: box?.h ?? t.tracked?.h ?? t.bbox?.h ?? 0,
        confidence: u.confidence,
        status: u.status,
        displacement: 0,
        valid_points: u.validPoints,
        camera_reliable: cameraReliable,
      }
      let mv = movementRef.current[t.label] ?? createMovementState()
      mv = appendSample(mv, sample, vw, vh, u.skipDisplacement)
      movementRef.current[t.label] = mv
      const correction: TrackingCorrection | null = u.checkpointCorrection
        ? {
            t: u.timestamp,
            slot: (u.checkpointCorrection.slot === "middle" || u.checkpointCorrection.slot === "late")
              ? u.checkpointCorrection.slot
              : "early",
            predictedCx: u.checkpointCorrection.predictedCx,
            predictedCy: u.checkpointCorrection.predictedCy,
            confirmedCx: u.checkpointCorrection.confirmedCx,
            confirmedCy: u.checkpointCorrection.confirmedCy,
            drift: u.checkpointCorrection.drift,
          }
        : null
      return {
        ...t,
        tracked: u.status === "TRACKING" || u.status === "UNCERTAIN" ? box : t.tracked,
        status: u.status,
        confidence: u.confidence,
        validPoints: u.validPoints,
        samples: mv.samples,
        totalMovement: mv.totalMovement,
        validSampleCount: mv.validSampleCount,
        lossIntervals: mv.openLoss ? [...mv.lossIntervals, mv.openLoss] : mv.lossIntervals,
        lastKnown: box ?? t.lastKnown,
        lastKnownTime: u.timestamp,
        corrections: correction ? [...t.corrections, correction] : t.corrections,
      }
    })
    tracksRef.current = next
    paintOverlay()
    const now = performance.now()
    if (now - uiTickRef.current > 80) {
      uiTickRef.current = now
      setTracks(next)
      setFrames(n => n + 1)
    }
  }, [paintOverlay])

  useEffect(() => {
    let worker: Worker | null = null
    try {
      worker = new Worker(new URL("../../workers/frameAnalysis.worker.ts", import.meta.url), { type: "module" })
    } catch {
      setTrackError("This browser could not start the tracking worker.")
      return
    }
    worker.onmessage = (e: MessageEvent) => {
      processingRef.current = false
      const msg = e.data as { type: string; tracks?: TrackUpdate[]; results?: TrackUpdate[]; camera?: { reliable: boolean } }
      if (msg.type === "FRAME_TRACKED" && msg.tracks) {
        applyUpdates(msg.tracks, !!msg.camera?.reliable)
      }
      if (msg.type === "TRACK_RESULT" && msg.results) {
        applyUpdates(msg.results, false)
      }
    }
    worker.onerror = () => {
      setTrackError("Tracking worker failed. Video tracking is unavailable in this browser.")
    }
    workerRef.current = worker
    return () => {
      worker?.postMessage({ type: "DISPOSE" })
      worker?.terminate()
      workerRef.current = null
    }
  }, [applyUpdates])

  const postCurrentFrame = useCallback((kind: "TRACK_FRAME" | "INIT_ALL" | "REIDENTIFY", id?: string, bbox?: NormBox) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const worker = workerRef.current
    if (!video || !canvas || !worker) return
    const grab = grabRgba(video, canvas)
    if ("error" in grab) {
      if (grab.error === "tainted") {
        setTrackError("This browser blocked frame capture (cross-origin video). In production set CORS_ORIGINS to your Vercel URL and VITE_API_BASE_URL to the Render API origin, then reload.")
      } else if (grab.error === "not-ready") {
        processingRef.current = false
        return
      } else {
        decodeFailsRef.current += 1
        if (decodeFailsRef.current > 24) {
          setTrackError("The browser could not decode video frames for tracking.")
        }
      }
      processingRef.current = false
      return
    }
    decodeFailsRef.current = 0
    const timestamp = video.currentTime
    if (kind === "TRACK_FRAME") {
      worker.postMessage({
        type: "TRACK_FRAME",
        pixels: grab.pixels,
        width: grab.width,
        height: grab.height,
        timestamp,
        seekReset: seekResetRef.current,
      })
      seekResetRef.current = false
      return
    }
    if (kind === "REIDENTIFY" && id && bbox) {
      worker.postMessage({
        type: "REIDENTIFY",
        id,
        pixels: grab.pixels,
        width: grab.width,
        height: grab.height,
        bbox,
        timestamp,
      })
      return
    }
    worker.postMessage({
      type: "INIT_ALL",
      pixels: grab.pixels,
      width: grab.width,
      height: grab.height,
      timestamp,
      boxers: tracksRef.current
        .filter((t): t is BoxerTrack & { bbox: NormBox } => !!t.bbox)
        .map(t => ({ id: t.label, bbox: t.bbox })),
    })
    initedRef.current = true
  }, [])

  const registerTrackers = useCallback(() => {
    const worker = workerRef.current
    if (!worker) return
    worker.postMessage({
      type: "REGISTER",
      boxers: tracksRef.current
        .filter(t => t.identified && sortedCheckpoints(t.checkpoints).length > 0)
        .map(t => ({ id: t.label, checkpoints: sortedCheckpoints(t.checkpoints) })),
    })
    initedRef.current = true
  }, [])

  const stopLoop = useCallback(() => {
    const v = videoRef.current as (HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void }) | null
    if (rvfcRef.current != null && v?.cancelVideoFrameCallback) {
      v.cancelVideoFrameCallback(rvfcRef.current)
    }
    rvfcRef.current = null
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  const processVideoFrame = useCallback((mediaTime: number) => {
    const video = videoRef.current
    if (!video || !activeRef.current) return
    if (video.seeking) return
    if (processingRef.current) return
    if (mediaTime === lastMediaTimeRef.current) return
    if (lastMediaTimeRef.current >= 0 && Math.abs(mediaTime - lastMediaTimeRef.current) < 0.04 && !seekResetRef.current) return
    lastMediaTimeRef.current = mediaTime
    if (!initedRef.current) registerTrackers()
    processingRef.current = true
    postCurrentFrame("TRACK_FRAME")
  }, [postCurrentFrame, registerTrackers])

  const startLoop = useCallback(() => {
    const video = videoRef.current as (HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number
    }) | null
    if (!video) return
    const onFrame = (_now: number, meta: { mediaTime: number }) => {
      if (!activeRef.current) return
      processVideoFrame(meta?.mediaTime ?? video.currentTime)
      if (video.requestVideoFrameCallback) {
        rvfcRef.current = video.requestVideoFrameCallback(onFrame)
      } else {
        rafRef.current = requestAnimationFrame(now => onFrame(now, { mediaTime: video.currentTime }))
      }
    }
    stopLoop()
    if (video.requestVideoFrameCallback) {
      rvfcRef.current = video.requestVideoFrameCallback(onFrame)
    } else {
      rafRef.current = requestAnimationFrame(now => onFrame(now, { mediaTime: video.currentTime }))
    }
  }, [processVideoFrame, stopLoop])

  useEffect(() => {
    if (stage !== "workspace") {
      stopLoop()
      return
    }
    if (active && playing) startLoop()
    else stopLoop()
    return () => stopLoop()
  }, [active, playing, stage, startLoop, stopLoop])

  useEffect(() => {
    const v = videoRef.current
    if (!v || stage !== "workspace") return
    const onSeeking = () => {
      seekResetRef.current = true
      lastMediaTimeRef.current = -1
      Object.keys(movementRef.current).forEach(k => {
        movementRef.current[k] = resetBaseline(movementRef.current[k])
      })
      workerRef.current?.postMessage({ type: "SEEK_RESET" })
    }
    const onSeeked = () => {
      seekResetRef.current = true
      if (activeRef.current && !processingRef.current) {
        processingRef.current = true
        postCurrentFrame("TRACK_FRAME")
      }
      paintOverlay()
    }
    v.addEventListener("seeking", onSeeking)
    v.addEventListener("seeked", onSeeked)
    const onResize = () => paintOverlay()
    window.addEventListener("resize", onResize)
    return () => {
      v.removeEventListener("seeking", onSeeking)
      v.removeEventListener("seeked", onSeeked)
      window.removeEventListener("resize", onResize)
    }
  }, [stage, postCurrentFrame, paintOverlay])

  useEffect(() => { paintOverlay() }, [tracks, paintOverlay, stage])

  const handleStartIdentify = () => {
    if (!boxerMeta) return
    const trackA = emptyTrack({ boxerId: boxerMeta.id, label: "A", name: boxerMeta.full_name, color: "#3b82f6" })
    if (analyseMode === "both") {
      const opponent = allBoxers.find(b => b.id === opponentId)
      const trackB = emptyTrack({
        boxerId: opponent?.id || "opponent",
        label: "B",
        name: opponent?.full_name || "Opponent (B)",
        color: "#f59e0b",
      })
      setTracks([trackA, trackB])
    } else {
      setTracks([trackA])
    }
    setCurrentIdentifyIdx(0)
    setDrawnBox(null)
    setStage("identify")
  }

  const openSavedWorkspace = () => {
    if (!tracks.length) return
    setStage("workspace")
  }

  const paintIdentify = useCallback(() => {
    const video = identifyVideoRef.current
    const canvas = identifyOverlayRef.current
    if (!video || !canvas) return
    const rect = displayedVideoRect(video)
    canvas.width = Math.max(1, Math.round(rect.clientWidth))
    canvas.height = Math.max(1, Math.round(rect.clientHeight))
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!drawnBox) return
    const px = rect.offsetX + drawnBox.x * rect.drawWidth
    const py = rect.offsetY + drawnBox.y * rect.drawHeight
    const pw = drawnBox.w * rect.drawWidth
    const ph = drawnBox.h * rect.drawHeight
    const color = tracks[currentIdentifyIdx]?.color || "#3b82f6"
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(px, py, pw, ph)
    ctx.fillStyle = color + "22"
    ctx.fillRect(px, py, pw, ph)
    ctx.fillStyle = color
    ctx.font = "bold 13px Inter,sans-serif"
    ctx.fillText(`Boxer ${tracks[currentIdentifyIdx]?.label || "A"}`, px + 4, Math.max(14, py - 6))
  }, [drawnBox, tracks, currentIdentifyIdx])

  useEffect(() => { paintIdentify() }, [paintIdentify, stage])

  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return
    if (v.paused) { void v.play(); setPlaying(true) } else { v.pause(); setPlaying(false) }
  }, [])

  const seek = useCallback((t: number) => {
    const v = videoRef.current; if (!v) return
    v.currentTime = Math.max(0, Math.min(t, duration))
    setCurTime(v.currentTime)
  }, [duration])

  const stepFrame = useCallback((dir: 1 | -1) => {
    const v = videoRef.current; if (!v) return
    v.pause(); setPlaying(false)
    v.currentTime = Math.max(0, Math.min(v.currentTime + dir * (1 / 30), duration))
  }, [duration])

  const getRound = useCallback((ts: number): number | undefined => {
    const tot = roundCfg.round_duration + roundCfg.rest_duration
    if (ts < roundCfg.start_offset) return undefined
    const r = Math.floor((ts - roundCfg.start_offset) / tot) + 1
    return r <= roundCfg.num_rounds ? r : undefined
  }, [roundCfg])

  const tagAction = useCallback((actionType: string, label: string) => {
    const ts = videoRef.current?.currentTime ?? 0
    const activeTrack = tracks[activeBoxerIdx]
    const evt: ActionEvent = {
      id: Math.random().toString(36).slice(2),
      timestamp: Math.round(ts * 100) / 100,
      action_type: actionType, label,
      round_num: getRound(ts),
      boxer_label: activeTrack?.label,
      note: activeTrack ? `Boxer ${activeTrack.label}: ${activeTrack.name}` : undefined,
      confirmed: true,
      target_area: punchMeta.target_area,
      target_side: punchMeta.target_side,
      outcome: punchMeta.outcome,
      hand: punchMeta.hand,
      nx: punchMeta.nx,
      ny: punchMeta.ny,
    }
    setEvents(prev => [...prev, evt].sort((a, b) => a.timestamp - b.timestamp))
    setPunchPlace(false)
  }, [tracks, activeBoxerIdx, getRound, punchMeta])

  useEffect(() => {
    if (stage !== "workspace") return
    // Keyboard shortcuts read live player state; listing every helper would retrigger the listener.
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement
      if (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA") return
      if (e.key === " ") { e.preventDefault(); togglePlay(); return }
      if (e.key === "ArrowLeft") { e.preventDefault(); seek(curTime - 5); return }
      if (e.key === "ArrowRight") { e.preventDefault(); seek(curTime + 5); return }
      if (e.key === ",") { e.preventDefault(); stepFrame(-1); return }
      if (e.key === ".") { e.preventDefault(); stepFrame(1); return }
      ACTION_TYPES.forEach(at => { if (e.key.toLowerCase() === at.key) tagAction(at.id, at.label) })
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [stage, curTime, seek, tagAction, togglePlay, stepFrame])

  const reidentifyBoxer = (idx: number) => {
    setActive(false)
    initedRef.current = false
    setCurrentIdentifyIdx(idx)
    setDrawnBox(null)
    setStage("identify")
  }

  const persistAnalysis = useCallback(async (status: "draft" | "complete", built?: PerformanceReportData | null) => {
    if (!videoId || !videoMeta) return
    const all = tracksRef.current
    const vw = videoRef.current?.videoWidth || 1
    const vh = videoRef.current?.videoHeight || 1
    const reportData = built ?? report ?? buildPerformanceReport({
      tracks: all,
      events,
      coach,
      roundCfg,
      videoName: videoMeta.original_filename_safe || videoId,
      videoId,
      videoDuration: duration,
      status,
    })
    const tracking = tracksToPayload(all, vw, vh, {
      report: reportData,
      status,
      completedAt: reportData.completedAt,
    })
    const series = all.flatMap(t => cumulativeSeries(t.samples).map(p => ({ t: p.t, v: p.v, boxer: t.label })))
    const result = await saveBrowserAnalysis(videoId, {
      video_id: videoId,
      boxer_id: videoMeta.boxer_id,
      processed_frames: all.reduce((s, t) => s + t.samples.length, 0),
      duration_seconds: duration,
      activity_series: series.slice(-500),
      action_events: events,
      roi_config: all[0]?.bbox
        ? { x: all[0].bbox.x, y: all[0].bbox.y, width: all[0].bbox.w, height: all[0].bbox.h, enabled: true }
        : undefined,
      round_config: roundCfg,
      coach_summary: coach,
      tracking,
      report: reportData,
      report_status: status,
      completed_at: reportData.completedAt,
    })
    setSaved(result)
    analysisIdRef.current = result.id
    setReport(reportData)
    return reportData
  }, [videoId, videoMeta, report, events, coach, roundCfg, duration])

  const startAnalyse = () => {
    if (!tracksRef.current.every(t => firstCheckpoint(t.checkpoints))) {
      setTrackError("Identify at least one checkpoint for every selected boxer before analysing.")
      return
    }
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) {
      setTrackError("Wait for the video to load, then click Start Analysis again.")
      return
    }
    setTrackError("")
    endedOnceRef.current = false
    finishingRef.current = false
    resetProcessBudget()
    lockProcessSize(video.videoWidth, video.videoHeight)
    const earliest = Math.min(...tracksRef.current.map(t => firstCheckpoint(t.checkpoints)?.t ?? t.identifyTime))
    initedRef.current = false
    lastMediaTimeRef.current = -1
    seekResetRef.current = true
    tracksRef.current.forEach(t => { movementRef.current[t.label] = createMovementState() })
    setTracks(prev => prev.map(t => ({
      ...t,
      fromSave: false,
      samples: [],
      totalMovement: 0,
      validSampleCount: 0,
      lossIntervals: [],
      status: "PENDING",
      tracked: t.bbox,
    })))
    video.currentTime = Math.max(0, earliest)
    registerTrackers()
    setActive(true)
    void video.play()
  }

  useEffect(() => {
    if (stage !== "workspace" || !startWhenReadyRef.current) return
    let n = 0
    const id = window.setInterval(() => {
      n += 1
      const v = videoRef.current
      if (v && v.readyState >= HTMLMediaElement.HAVE_METADATA) {
        window.clearInterval(id)
        startWhenReadyRef.current = false
        startAnalyse()
      }
      if (n > 80) {
        window.clearInterval(id)
        startWhenReadyRef.current = false
      }
    }, 50)
    return () => window.clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- startAnalyse uses live refs after the video element mounts
  }, [stage])

  const finalizeReport = useCallback(async () => {
    if (finishingRef.current) return
    finishingRef.current = true
    endedOnceRef.current = true
    setActive(false)
    stopLoop()
    const all = tracksRef.current
    setTracks(all)
    if (!videoId || !videoMeta) return
    const built = buildPerformanceReport({
      tracks: all,
      events,
      coach,
      roundCfg,
      videoName: videoMeta.original_filename_safe || videoId,
      videoId,
      videoDuration: duration,
      status: "complete",
    })
    setReport(built)
    setStage("report")
    try {
      await persistAnalysis("complete", built)
      setSaveOk(true)
    } catch {
      setSaveError("The report was generated locally but could not be saved. Use Export PDF or try Save again.")
    }
  }, [coach, duration, events, persistAnalysis, roundCfg, stopLoop, videoId, videoMeta])

  const handleEnded = useCallback(() => {
    setPlaying(false)
    if (endedOnceRef.current) return
    const ran = activeRef.current || tracksRef.current.some(t => t.validSampleCount > 0 && !t.fromSave)
    if (!ran) return
    if (activeRef.current && !processingRef.current) {
      processingRef.current = true
      postCurrentFrame("TRACK_FRAME")
    }
    window.setTimeout(() => { void finalizeReport() }, 120)
  }, [finalizeReport, postCurrentFrame])

  const handleSave = async () => {
    setSaving(true)
    setSaveError("")
    try {
      await persistAnalysis(report?.status === "complete" ? "complete" : "draft", report)
      setSaveOk(true); setTimeout(() => setSaveOk(false), 3000)
    } catch (err) {
      console.error("Save failed", err)
      setSaveError("Save failed. Check that tracking samples are valid, then try again.")
    } finally { setSaving(false) }
  }

  const activeTrack = tracks[activeBoxerIdx]
  const chartData = useMemo(() => {
    const series = cumulativeSeries(activeTrack?.samples || [])
    if (series.length <= 400) return series
    const step = Math.ceil(series.length / 400)
    return series.filter((_, i) => i % step === 0)
  }, [activeTrack])

  const roundSums = useMemo(() => {
    return Array.from({ length: roundCfg.num_rounds }, (_, r) => {
      const rNum = r + 1
      const tot = roundCfg.round_duration + roundCfg.rest_duration
      const rs = roundCfg.start_offset + r * tot
      const re = rs + roundCfg.round_duration
      const pts = (activeTrack?.samples || []).filter(p => p.t >= rs && p.t < re)
      const acts = events.filter(e => e.round_num === rNum && (!e.boxer_label || e.boxer_label === activeTrack?.label))
      const mov = pts.reduce((s, p) => s + p.displacement, 0)
      return {
        round: rNum, start: rs,
        movement: Math.round(mov * 10000) / 10000,
        punches: acts.filter(e => ["jab", "cross", "lead_hook", "rear_hook", "uppercut", "combo"].includes(e.action_type)).length,
        defensive: acts.filter(e => ["defensive", "head_move", "footwork", "guard", "block", "slip", "duck"].includes(e.action_type)).length,
      }
    })
  }, [activeTrack, events, roundCfg])

  const curRound = useMemo(() => getRound(curTime), [curTime, getRound])
  const lastSample = activeTrack?.samples.length
    ? activeTrack.samples[activeTrack.samples.length - 1]
    : undefined

  if (stage === "setup") return (
    <div style={{ minHeight: "100vh", background: "#030712", color: "#f1f5f9", fontFamily: "Inter,system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#111827", borderBottom: "1px solid #1f2937", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <ChevronLeft size={15} />Back
        </button>
        <span style={{ color: "#374151", fontSize: 14 }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Analysis Setup</span>
      </header>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px", width: "100%" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Who should we analyse?</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32, lineHeight: 1.6 }}>
          Choose how many boxers to track. You will identify each boxer on a real video frame, then optical-flow tracking follows them during playback.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          <button onClick={() => setAnalyseMode("single")}
            style={{ background: analyseMode === "single" ? "rgba(37,99,235,0.15)" : "#111827", border: analyseMode === "single" ? "2px solid #3b82f6" : "2px solid #1f2937", borderRadius: 12, padding: "20px 16px", cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 40, height: 40, background: "rgba(37,99,235,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <UserCheck size={20} color="#3b82f6" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>One Boxer</p>
            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Track and measure one registered boxer.</p>
          </button>
          <button onClick={() => setAnalyseMode("both")}
            style={{ background: analyseMode === "both" ? "rgba(245,158,11,0.1)" : "#111827", border: analyseMode === "both" ? "2px solid #f59e0b" : "2px solid #1f2937", borderRadius: 12, padding: "20px 16px", cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 40, height: 40, background: "rgba(245,158,11,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Users size={20} color="#f59e0b" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Both Boxers</p>
            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Independent trackers for Boxer A and Boxer B.</p>
          </button>
        </div>
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Boxer A — Registered Athlete</p>
          {boxerMeta ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, background: "rgba(37,99,235,0.2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontWeight: 800, color: "#3b82f6" }}>{boxerMeta.full_name[0]}</span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{boxerMeta.full_name}</p>
                <p style={{ fontSize: 11, color: "#6b7280" }}>{boxerMeta.permanent_id} · {boxerMeta.stance}</p>
              </div>
            </div>
          ) : <p style={{ fontSize: 13, color: "#6b7280" }}>Loading…</p>}
        </div>
        {analyseMode === "both" && (
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Boxer B — Opponent</p>
            <select value={opponentId} onChange={e => setOpponentId(e.target.value)}
              style={{ background: "#0f172a", border: "1px solid #374151", color: "#f1f5f9", fontSize: 13, borderRadius: 6, padding: "6px 10px", width: "100%", outline: "none" }}>
              <option value="">Unknown / Unnamed Opponent</option>
              {allBoxers.filter(b => b.id !== boxerMeta?.id).map(b => (
                <option key={b.id} value={b.id}>{b.full_name} ({b.permanent_id})</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 24, display: "flex", gap: 8 }}>
          <Info size={14} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: "#93c5fd", lineHeight: 1.6 }}>
            Tracking uses pyramidal Lucas–Kanade optical flow on this device. Movement is normalized image-plane displacement, not metres. Punches are coach tags only.
          </p>
        </div>
        {hasSavedTracking && (
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: "#22c55e", marginBottom: 8 }}>Saved tracking measurements were restored. Open the workspace to see the same graph and totals.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={openSavedWorkspace} style={{ background: "#14532d", border: "none", borderRadius: 8, padding: "8px 12px", color: "#bbf7d0", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                Open saved analysis
              </button>
              {report && (
                <button onClick={() => setStage("report")} style={{ background: "#1e3a8a", border: "none", borderRadius: 8, padding: "8px 12px", color: "#bfdbfe", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                  Open saved report
                </button>
              )}
            </div>
          </div>
        )}
        <button onClick={handleStartIdentify} disabled={!boxerMeta}
          style={{ width: "100%", background: "#2563eb", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 700, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: boxerMeta ? 1 : 0.4 }}>
          <Crosshair size={17} />Continue to Boxer Identification
        </button>
      </div>
    </div>
  )

  if (stage === "identify") {
    return (
      <IdentifyStage
        tracks={tracks}
        streamUrl={streamUrl}
        streamCors={streamCors}
        onBack={() => setStage("setup")}
        onTracks={next => { tracksRef.current = next; setTracks(next) }}
        onReview={() => setStage("review")}
      />
    )
  }

  if (stage === "review") {
    const earliest = tracks.filter(t => firstCheckpoint(t.checkpoints)).reduce((m, t) => Math.min(m, firstCheckpoint(t.checkpoints)!.t), Infinity)
    return (
      <div style={{ minHeight: "100vh", background: "#030712", color: "#f1f5f9", fontFamily: "Inter,system-ui,sans-serif" }}>
        <header style={{ background: "#111827", borderBottom: "1px solid #1f2937", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setStage("identify")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 13 }}>Back</button>
          <span style={{ fontWeight: 700 }}>Confirm identification</span>
        </header>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: 28 }}>
          <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>
            Analysis starts at the earliest checkpoint ({Number.isFinite(earliest) ? fmtHms(earliest) : "—"}). Middle and late boxes correct the tracker at those timestamps. Skipped checkpoints lower identity-verification coverage.
          </p>
          {tracks.map((t, i) => (
            <div key={t.label} style={{ background: "#111827", border: `1px solid ${t.color}55`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <p style={{ fontWeight: 800, color: t.color }}>Boxer {t.label} — {t.name}</p>
              {(["early", "middle", "late"] as const).map(slot => {
                const c = t.checkpoints[slot]
                return (
                  <p key={slot} style={{ fontSize: 13, color: c ? "#d1d5db" : "#fbbf24" }}>
                    {slot}: {c ? fmtHms(c.t) : "skipped"}
                  </p>
                )
              })}
              <button onClick={() => { setCurrentIdentifyIdx(i); setDrawnBox(null); setStage("identify") }}
                style={{ marginTop: 8, background: "none", border: "1px solid #374151", color: "#9ca3af", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>
                Change Boxer {t.label}
              </button>
            </div>
          ))}
          <div style={{ background: "#111827", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Rounds (optional)</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {([["Rounds", "num_rounds"], ["Round seconds", "round_duration"], ["Rest seconds", "rest_duration"], ["Start offset", "start_offset"]] as [string, keyof RoundConfig][]).map(([label, key]) => (
                <label key={key} style={{ fontSize: 11, color: "#9ca3af" }}>
                  {label}
                  <input type="number" value={roundCfg[key] as number} onChange={e => setRoundCfg(r => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))}
                    style={{ display: "block", width: "100%", marginTop: 4, background: "#0f172a", border: "1px solid #374151", color: "#e5e7eb", borderRadius: 6, padding: "6px 8px" }} />
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>If round times do not match the video, the report uses labelled time segments instead of inventing boxing rounds.</p>
          </div>
          <button onClick={() => { startWhenReadyRef.current = true; setStage("workspace") }}
            style={{ width: "100%", background: "#2563eb", border: "none", color: "white", borderRadius: 10, padding: 14, fontWeight: 800, cursor: "pointer" }}>
            Start Analysis
          </button>
        </div>
      </div>
    )
  }

  if (stage === "report" && report) {
    return (
      <PerformanceReport
        report={{ ...report, coach }}
        coach={coach}
        onCoachChange={setCoach}
        onSaveNotes={() => { void handleSave() }}
        onBack={() => setStage("workspace")}
        saving={saving}
        saveOk={saveOk}
      />
    )
  }

  return (
    <div className="analysis-workspace h-screen flex flex-col overflow-hidden" style={{ background: "#030712", fontFamily: "Inter,system-ui,sans-serif", color: "#f1f5f9" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <header style={{ background: "#111827", borderBottom: "1px solid #1f2937", height: 48 }} className="flex items-center px-4 gap-3 shrink-0">
        <button onClick={() => nav(-1)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={15} />Back
        </button>
        <div style={{ width: 1, height: 20, background: "#1f2937" }} />
        <Activity size={14} color="#3b82f6" />
        <span className="text-sm font-semibold">Analysis Workspace</span>
        {videoMeta && <span className="text-xs text-gray-500 truncate max-w-xs">{videoMeta.original_filename_safe}</span>}
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {tracks.map((t, i) => (
            <button key={t.label} onClick={() => setActiveBoxerIdx(i)}
              style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", background: activeBoxerIdx === i ? t.color + "20" : "transparent", border: `1px solid ${activeBoxerIdx === i ? t.color : "#374151"}`, color: activeBoxerIdx === i ? t.color : "#6b7280" }}>
              {t.status === "LOST" ? <AlertTriangle size={10} style={{ display: "inline", marginRight: 3 }} /> : null}
              Boxer {t.label}
              {t.status === "LOST" && <span style={{ fontSize: 9 }}> LOST</span>}
              {t.status === "UNCERTAIN" && <span style={{ fontSize: 9 }}> ?</span>}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {tracks.map((t, i) => (
            <button key={`re-${t.label}`} onClick={() => reidentifyBoxer(i)}
              style={{ background: "transparent", border: "1px solid #374151", borderRadius: 8, padding: "4px 8px", fontSize: 10, color: t.color, cursor: "pointer" }}>
              Re-id {t.label}
            </button>
          ))}
          {report && (
            <button onClick={() => setStage("report")}
              style={{ background: "transparent", border: "1px solid #1d4ed8", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#93c5fd", cursor: "pointer" }}>
              Report
            </button>
          )}
          <button onClick={() => setPunchPlace(p => !p)}
            style={{ background: punchPlace ? "#7c2d12" : "transparent", border: "1px solid #374151", borderRadius: 8, padding: "4px 8px", fontSize: 10, color: "#fbbf24", cursor: "pointer" }}>
            {punchPlace ? "Tap video for punch point" : "Mark punch point"}
          </button>
          {active ? (
            <button onClick={() => setActive(false)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#f87171", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <Square size={9} />Stop
            </button>
          ) : (
            <button onClick={startAnalyse} style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#60a5fa", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <Zap size={9} />Analyse
            </button>
          )}
          <button onClick={handleSave} disabled={saving} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#d1d5db", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", opacity: saving ? 0.5 : 1 }}>
            {saveOk ? <CheckCircle2 size={11} color="#22c55e" /> : <Save size={11} />}
            {saving ? "Saving…" : saveOk ? "Saved!" : "Save"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <aside style={{ width: 148, background: "#111827", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ padding: "8px 10px 4px", borderBottom: "1px solid #1f2937" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>Tag Actions</p>
            {activeTrack && <p style={{ fontSize: 9, color: activeTrack.color, marginTop: 2 }}>for Boxer {activeTrack.label}</p>}
          </div>
          <div style={{ padding: 6, flex: 1 }}>
            {ACTION_TYPES.map(at => (
              <button key={at.id} onClick={() => tagAction(at.id, at.label)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: "#d1d5db", cursor: "pointer", background: "transparent", border: "none", borderLeft: `3px solid ${at.color}`, marginBottom: 2, textAlign: "left" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#1f2937")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span>{at.label}</span>
                <kbd style={{ fontSize: 9, background: "#1f2937", padding: "1px 4px", borderRadius: 3, color: "#6b7280", fontFamily: "monospace" }}>{at.key.toUpperCase()}</kbd>
              </button>
            ))}
          </div>
          <div style={{ padding: "8px 10px", borderTop: "1px solid #1f2937" }}>
            <p style={{ fontSize: 9, color: "#6b7280" }}>Events: <span style={{ color: "#9ca3af", fontWeight: 700 }}>{events.length}</span></p>
            {curRound && <p style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>Round: <span style={{ color: "#60a5fa", fontWeight: 700 }}>{curRound}</span></p>}
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div style={{ position: "relative", background: "#000", flex: 1, maxHeight: "52vh" }}>
            <video ref={videoRef}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              crossOrigin={streamCors ? "anonymous" : undefined}
              src={streamUrl}
              onTimeUpdate={() => { if (videoRef.current) setCurTime(videoRef.current.currentTime) }}
              onLoadedMetadata={() => { if (videoRef.current) { setDuration(videoRef.current.duration); paintOverlay() } }}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
              onEnded={handleEnded}
              onError={() => setVError("Video could not be loaded.")}
            />
            <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: punchPlace ? "auto" : "none", cursor: punchPlace ? "crosshair" : "default" }}
              onClick={e => {
                if (!punchPlace || !videoRef.current) return
                const p = clientToNorm(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), displayedVideoRect(videoRef.current))
                setPunchMeta(m => ({ ...m, nx: p.x, ny: p.y }))
                setPunchPlace(false)
              }}
            />
            {active && (
              <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.8)", borderRadius: 8, padding: "4px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, background: "#ef4444", borderRadius: "50%" }} />
                <span style={{ fontSize: 10, color: "white", fontWeight: 600 }}>LIVE · {frames}f</span>
              </div>
            )}
            {tracks.some(t => t.fromSave) && !active && (
              <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(15,23,42,0.9)", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#cbd5e1", maxWidth: 280 }}>
                Showing saved measurements, not live tracking. Click Analyse to track this playback.
              </div>
            )}
            {tracks.filter(t => t.status === "LOST").map(t => (
              <div key={t.label} style={{ position: "absolute", top: active ? 40 : 8, right: 8, background: "rgba(239,68,68,0.9)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "white", fontWeight: 600 }}>
                Boxer {t.label} tracking lost — click Re-identify
              </div>
            ))}
            {active && activeTrack && (
              <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.8)", borderRadius: 8, padding: "6px 10px" }}>
                <p style={{ fontSize: 9, color: "#9ca3af" }}>Boxer {activeTrack.label} · {activeTrack.status}</p>
                <p style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: activeTrack.color }}>{activeTrack.totalMovement.toFixed(4)}</p>
                <p style={{ fontSize: 9, color: "#6b7280" }}>normalized image-plane</p>
              </div>
            )}
            {(vError || trackError) && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)" }}>
                <div style={{ textAlign: "center" }}>
                  <AlertTriangle size={24} color="#f87171" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 13, color: "#f87171" }}>{vError || trackError}</p>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: "#111827", borderTop: "1px solid #1f2937", padding: "6px 14px 8px", flexShrink: 0 }}>
            <div style={{ position: "relative", height: 6, background: "#374151", borderRadius: 3, marginBottom: 8, cursor: "pointer" }}
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * duration) }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: "#2563eb", borderRadius: 3, width: duration > 0 ? `${(curTime / duration) * 100}%` : "0%" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => stepFrame(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><SkipBack size={14} /></button>
              <button onClick={togglePlay} style={{ width: 28, height: 28, background: "#2563eb", border: "none", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {playing ? <Pause size={12} fill="white" color="white" /> : <Play size={12} fill="white" color="white" />}
              </button>
              <button onClick={() => stepFrame(1)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><SkipForward size={14} /></button>
              <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{fmtTime(curTime)} / {fmtTime(duration)}</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                <select value={pbRate} onChange={e => { const r = parseFloat(e.target.value); setPbRate(r); if (videoRef.current) videoRef.current.playbackRate = r }}
                  style={{ background: "#1f2937", color: "#d1d5db", fontSize: 11, border: "none", borderRadius: 4, padding: "2px 6px", outline: "none" }}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => <option key={r} value={r}>{r}x</option>)}
                </select>
                <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !muted; setMuted(m => !m) } }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button onClick={() => videoRef.current?.requestFullscreen()} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><Maximize size={14} /></button>
              </div>
            </div>
          </div>

          <div style={{ background: "#111827", borderTop: "1px solid #1f2937", padding: "10px 14px 8px", flexShrink: 0, height: 130 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Boxer {activeTrack?.label} · Cumulative {MEASUREMENT_LABEL.replace(/_/g, " ")}
              </p>
              <div style={{ display: "flex", gap: 10, fontSize: 9, color: "#6b7280" }}>
                <span>samples <span style={{ color: "#60a5fa" }}>{activeTrack?.validSampleCount || 0}</span></span>
                <span>total <span style={{ color: "#22c55e" }}>{(activeTrack?.totalMovement || 0).toFixed(4)}</span></span>
                {active && <span style={{ color: "#22c55e" }}>Live</span>}
              </div>
            </div>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={88}>
                <LineChart data={chartData} onClick={(d) => {
                  const t = (d as { activePayload?: { payload: { t: number } }[] })?.activePayload?.[0]?.payload?.t
                  if (typeof t === "number") seek(t)
                }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip content={({ active: a, payload }) => {
                    if (!a || !payload?.[0]) return null
                    const d = payload[0].payload as { t: number; v: number; d: number }
                    return <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 6, padding: "4px 8px", fontSize: 10 }}>
                      <p style={{ color: "#9ca3af" }}>{fmtTime(d.t)}</p>
                      <p style={{ color: activeTrack?.color || "#3b82f6", fontWeight: 700 }}>cum {d.v.toFixed(4)}</p>
                    </div>
                  }} />
                  <Line type="monotone" dataKey="v" stroke={activeTrack?.color || "#3b82f6"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 60, fontSize: 11, color: "#6b7280" }}>
                {active ? "Waiting for tracked samples…" : "Identify a boxer, click Analyse, then play the video"}
              </div>
            )}
          </div>
        </div>

        <aside style={{ width: 220, background: "#111827", borderLeft: "1px solid #1f2937", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1f2937" }}>
            {(["metrics", "events", "rounds"] as const).map(tab => (
              <button key={tab} onClick={() => setRightTab(tab)}
                style={{ flex: 1, padding: "8px 0", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", background: "none", border: "none", borderBottom: rightTab === tab ? "2px solid #3b82f6" : "2px solid transparent", color: rightTab === tab ? "#60a5fa" : "#6b7280" }}>
                {tab}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {rightTab === "metrics" && (
              <div style={{ padding: 10 }}>
                {tracks.map(t => (
                  <div key={t.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color }} />
                      <p style={{ fontSize: 10, fontWeight: 700, color: t.color }}>Boxer {t.label}</p>
                      <span style={{ fontSize: 9, marginLeft: "auto", color: t.status === "LOST" ? "#ef4444" : t.status === "UNCERTAIN" ? "#f59e0b" : "#22c55e" }}>{t.status}</span>
                    </div>
                    {[
                      { label: "Confidence", value: `${Math.round(t.confidence * 100)}%` },
                      { label: "Centre", value: lastSample && t.label === activeTrack?.label ? `${lastSample.cx.toFixed(3)}, ${lastSample.cy.toFixed(3)}` : t.tracked ? `${(t.tracked.x + t.tracked.w / 2).toFixed(3)}, ${(t.tracked.y + t.tracked.h / 2).toFixed(3)}` : "—" },
                      { label: "Feature points", value: String(t.validPoints) },
                      { label: "Valid samples", value: String(t.validSampleCount) },
                      { label: "Cumulative movement", value: t.totalMovement.toFixed(4) },
                      { label: "Corrections", value: String(t.corrections.length) },
                      { label: "Timestamp", value: fmtTime(curTime) },
                    ].map(row => (
                      <div key={row.label} style={{ background: "rgba(31,41,55,0.5)", borderRadius: 6, padding: "5px 8px", marginBottom: 4, display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 9, color: "#6b7280" }}>{row.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#e5e7eb" }}>{row.value}</span>
                      </div>
                    ))}
                    {t.lossIntervals.length > 0 && (
                      <p style={{ fontSize: 9, color: "#f87171", marginTop: 4 }}>
                        Loss: {t.lossIntervals.map(l => `${fmtTime(l.start)}–${l.end == null ? "now" : fmtTime(l.end)}`).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
                <div style={{ background: "rgba(31,41,55,0.3)", borderRadius: 8, padding: "6px 8px" }}>
                  <p style={{ fontSize: 9, color: "#4b5563", lineHeight: 1.5 }}>
                    Measurement: normalized image-plane movement. Not metres. Camera compensation {cameraReliableRef.current ? "was estimated for diagnostics and is not applied to the total." : "is not claimed."} Punches are coach annotations only.
                  </p>
                </div>
                {saveError && <p style={{ fontSize: 10, color: "#f87171", marginTop: 8 }}>{saveError}</p>}
                {saved && (
                  <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "6px 8px", marginTop: 6 }}>
                    <p style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>Saved {new Date(saved.updated_at).toLocaleTimeString()}</p>
                  </div>
                )}
              </div>
            )}
            {rightTab === "events" && (
              <div style={{ padding: 8 }}>
                <p style={{ fontSize: 9, color: "#6b7280", marginBottom: 6 }}>Confirmed coach tags only. Automatic punch detection is not enabled.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                  {([["target_area", ["head", "body", "unclear"]], ["target_side", ["left", "right", "center", "unclear"]], ["outcome", ["landed", "blocked", "missed", "unclear"]], ["hand", ["left", "right", "unclear"]]] as const).map(([key, opts]) => (
                    <select key={key} value={(punchMeta[key] as string) || ""} onChange={e => setPunchMeta(m => ({ ...m, [key]: e.target.value || undefined }))}
                      style={{ background: "#0f172a", color: "#e5e7eb", border: "1px solid #374151", borderRadius: 4, fontSize: 10, padding: 4 }}>
                      <option value="">{key}</option>
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ))}
                </div>
                {punchMeta.nx != null && <p style={{ fontSize: 9, color: "#93c5fd", marginBottom: 6 }}>Point {punchMeta.nx.toFixed(2)}, {punchMeta.ny?.toFixed(2)}</p>}
                {events.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 8px" }}>
                    <Tag size={18} color="#374151" style={{ margin: "0 auto 8px" }} />
                    <p style={{ fontSize: 11, color: "#6b7280" }}>No events tagged</p>
                  </div>
                ) : events.map(ev => {
                  const def = ACTION_TYPES.find(a => a.id === ev.action_type)
                  return (
                    <button key={ev.id} onClick={() => seek(ev.timestamp)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "5px 6px", borderRadius: 6, cursor: "pointer", background: "transparent", border: "none", textAlign: "left", marginBottom: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#1f2937")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: def?.color || "#6b7280", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, color: "#e5e7eb", fontWeight: 600 }}>{ev.label}{ev.boxer_label ? ` · ${ev.boxer_label}` : ""}</p>
                        <p style={{ fontSize: 9, color: "#6b7280" }}>{fmtTime(ev.timestamp)}{ev.round_num ? ` · R${ev.round_num}` : ""}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setEvents(prev => prev.filter(x => x.id !== ev.id)) }}
                        style={{ fontSize: 10, color: "#4b5563", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    </button>
                  )
                })}
              </div>
            )}
            {rightTab === "rounds" && (
              <div style={{ padding: 10 }}>
                <button onClick={() => setShowRndCfg(s => !s)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", marginBottom: 8 }}>
                  <Settings size={11} />{showRndCfg ? "Hide" : "Configure"} Rounds
                </button>
                {showRndCfg && (
                  <div style={{ background: "rgba(31,41,55,0.5)", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    {([["Rounds", "num_rounds", 1, 20], ["Round (s)", "round_duration", 30, 600], ["Rest (s)", "rest_duration", 0, 300], ["Offset (s)", "start_offset", 0, 300]] as [string, keyof RoundConfig, number, number][]).map(([label, key, min, max]) => (
                      <div key={key} style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 9, color: "#6b7280", marginBottom: 3 }}>{label}</p>
                        <input type="number" min={min} max={max} value={roundCfg[key] as number}
                          onChange={e => setRoundCfg(r => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))}
                          style={{ width: "100%", background: "#0f172a", border: "1px solid #374151", color: "#e5e7eb", fontSize: 11, borderRadius: 4, padding: "3px 6px", outline: "none" }} />
                      </div>
                    ))}
                  </div>
                )}
                {roundSums.map(r => (
                  <div key={r.round} style={{ background: "rgba(31,41,55,0.5)", borderRadius: 8, padding: 10, marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>Round {r.round}</p>
                      <button onClick={() => seek(r.start)} style={{ fontSize: 9, color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>{fmtTime(r.start)}</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {[["Movement", r.movement, "#9ca3af"], ["Punches (tagged)", r.punches, "#60a5fa"], ["Defense (tagged)", r.defensive, "#22c55e"]].map(([label, val, color]) => (
                        <div key={String(label)}>
                          <p style={{ fontSize: 8, color: "#6b7280" }}>{label}</p>
                          <p style={{ fontSize: 12, fontWeight: 700, color: String(color) }}>{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ borderTop: "1px solid #1f2937", padding: 8 }}>
            <button onClick={() => setShowCoach(s => !s)}
              style={{ width: "100%", fontSize: 10, padding: "5px 8px", borderRadius: 6, background: "#1f2937", border: "1px solid #374151", color: "#9ca3af", cursor: "pointer" }}>
              {showCoach ? "Hide" : "Coach Summary"}
            </button>
          </div>
        </aside>
      </div>

      {showCoach && (
        <div style={{ background: "#111827", borderTop: "1px solid #1f2937", padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb", marginBottom: 10 }}>Coach Assessment</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {([["went_well", "What went well"], ["needs_improvement", "Needs improvement"], ["technical_issues", "Technical issues"], ["recommended_drills", "Recommended drills"]] as [keyof CoachSummary, string][]).map(([key, label]) => (
                <div key={key}>
                  <p style={{ fontSize: 9, color: "#6b7280", marginBottom: 3 }}>{label}</p>
                  <textarea rows={2} value={coach[key] || ""} onChange={e => setCoach(s => ({ ...s, [key]: e.target.value }))}
                    style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", color: "#e5e7eb", fontSize: 11, borderRadius: 6, padding: "6px 8px", resize: "none", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
