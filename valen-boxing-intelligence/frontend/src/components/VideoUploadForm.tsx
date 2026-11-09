/**
 * VideoUploadForm — improved drag-and-drop video upload component.
 *
 * Improvements over original:
 * - Uses the upload-zone CSS class (theme-aware, no hardcoded colors)
 * - Shows upload speed and estimated time remaining
 * - Cancel upload support
 * - Clear error messages
 * - No base64 conversion — sends FormData directly via XHR
 * - File already validated before sending to avoid wasted bandwidth
 */
import { useState, useRef, useCallback } from "react"
import { Upload, AlertCircle, CheckCircle, X, Clock, Zap } from "lucide-react"
import { type FightCamp } from "../types"

const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv"]
const MAX_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB

interface Props {
  boxerId: string
  fightCamps: FightCamp[]
  sessionDate: string
  onSuccess: (videoId: string, sessionId: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatEta(remainingBytes: number, bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return '—'
  const secs = remainingBytes / bytesPerSecond
  if (secs < 60) return `${Math.round(secs)}s`
  return `${Math.round(secs / 60)}m ${Math.round(secs % 60)}s`
}

export default function VideoUploadForm({ boxerId, fightCamps, sessionDate, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState("")
  const [uploadError, setUploadError] = useState("")
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadedBytes, setUploadedBytes] = useState(0)
  const [speedBps, setSpeedBps] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [sessionType, setSessionType] = useState("other")
  const [fightCampId, setFightCampId] = useState("")

  const inputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const startTimeRef = useRef<number>(0)

  const validateAndSetFile = (f: File) => {
    setValidationError("")
    setUploadError("")
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setValidationError(`File type "${ext}" is not supported. Use: ${ALLOWED_EXTENSIONS.join(", ")}`)
      setFile(null)
      return
    }
    if (f.size > MAX_BYTES) {
      setValidationError(`File is ${formatBytes(f.size)}, which exceeds the 2 GB limit.`)
      setFile(null)
      return
    }
    setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) validateAndSetFile(dropped)
  }

  const handleCancelUpload = () => {
    xhrRef.current?.abort()
    setUploading(false)
    setProgress(0)
    setUploadedBytes(0)
    setSpeedBps(0)
    setUploadError("Upload cancelled.")
  }

  const handleSubmit = useCallback(async () => {
    if (!file || uploading) return
    setUploading(true)
    setProgress(0)
    setUploadedBytes(0)
    setSpeedBps(0)
    setUploadError("")
    startTimeRef.current = Date.now()

    const fd = new FormData()
    fd.append("file", file)
    fd.append("boxer_id", boxerId)
    fd.append("session_type", sessionType)
    fd.append("session_date", sessionDate)
    if (fightCampId) fd.append("fight_camp_id", fightCampId)

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
    xhr.open("POST", `${base}/api/v1/videos/upload`)

    // Auth header
    try {
      const stored = localStorage.getItem("valen-auth")
      if (stored) {
        const { token } = JSON.parse(stored)
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
      }
    } catch {}

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      const pct = Math.round((e.loaded / e.total) * 100)
      setProgress(pct)
      setUploadedBytes(e.loaded)
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      if (elapsed > 0.5) {
        setSpeedBps(e.loaded / elapsed)
      }
    }

    xhr.onload = () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText)
          onSuccess(json.data.video_id, json.data.session_id)
        } catch {
          setUploadError("Server returned an unreadable response. The file may have been saved — check Video Library.")
        }
      } else {
        try {
          const json = JSON.parse(xhr.responseText)
          setUploadError(json.error?.message || `Upload failed (HTTP ${xhr.status})`)
        } catch {
          setUploadError(`Upload failed with status ${xhr.status}.`)
        }
      }
    }

    xhr.onerror = () => {
      setUploading(false)
      setUploadError("Network error during upload. Check your connection and try again.")
    }

    xhr.onabort = () => {
      setUploading(false)
    }

    xhr.send(fd)
  }, [file, uploading, boxerId, sessionType, sessionDate, fightCampId, onSuccess])

  const remainingBytes = file ? file.size - uploadedBytes : 0

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`upload-zone${file ? " has-file" : ""}${dragOver ? " drag-over" : ""}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        style={{ cursor: uploading ? 'default' : 'pointer' }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f) }}
          disabled={uploading}
        />

        {file ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <CheckCircle size={22} style={{ color: 'var(--color-success)' }} />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-strong)' }}>
                {file.name}
              </span>
              {!uploading && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setUploadError("") }}
                  className="p-0.5 rounded transition"
                  style={{ color: 'var(--color-text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
                  title="Remove file"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {formatBytes(file.size)}
            </span>
          </div>
        ) : (
          <>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
              style={{ background: 'var(--color-accent-soft)' }}
            >
              <Upload size={20} style={{ color: 'var(--color-accent)' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-strong)' }}>
              Drop video here or{' '}
              <span style={{ color: 'var(--color-accent)' }}>browse</span>
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {ALLOWED_EXTENSIONS.join(", ")} · Max 2 GB
            </p>
          </>
        )}
      </div>

      {/* Session options */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Session Type</label>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            className="input"
            disabled={uploading}
          >
            {["shadowboxing", "heavy_bag", "pad_work", "sparring", "other"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fight Camp (optional)</label>
          <select
            value={fightCampId}
            onChange={(e) => setFightCampId(e.target.value)}
            className="input"
            disabled={uploading}
          >
            <option value="">None</option>
            {fightCamps.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-xl border"
          style={{ color: 'var(--color-danger)', borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(239,68,68,0.08)' }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          {validationError}
        </div>
      )}

      {/* Upload error */}
      {uploadError && !uploading && (
        <div className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-xl border"
          style={{ color: 'var(--color-danger)', borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(239,68,68,0.08)' }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          {uploadError}
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <Zap size={11} style={{ color: 'var(--color-accent)' }} />
              Uploading {formatBytes(uploadedBytes)} of {file ? formatBytes(file.size) : '?'}
              {speedBps > 0 && (
                <span style={{ color: 'var(--color-text-faint)' }}>
                  · {formatBytes(speedBps)}/s
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={11} />
              {speedBps > 0 ? formatEta(remainingBytes, speedBps) : '—'}
            </div>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
              {progress}%
            </span>
            <button
              onClick={handleCancelUpload}
              className="text-xs px-2.5 py-1 rounded-lg transition"
              style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upload button */}
      {!uploading && (
        <button
          onClick={handleSubmit}
          disabled={!file || !!validationError}
          className="btn-primary w-full"
          style={{ opacity: (!file || !!validationError) ? 0.4 : 1, cursor: (!file || !!validationError) ? 'not-allowed' : 'pointer' }}
        >
          <Upload size={14} />
          Upload Video
        </button>
      )}

      {/* Processing note */}
      <p className="text-xs text-center" style={{ color: 'var(--color-text-faint)' }}>
        Video analysis runs in the background after upload. You'll be taken to the analysis workspace immediately.
      </p>
    </div>
  )
}
