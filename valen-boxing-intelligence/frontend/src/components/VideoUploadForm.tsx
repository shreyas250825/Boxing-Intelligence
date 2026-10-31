import { useState, useRef, useCallback } from "react"
import { Upload, AlertCircle, CheckCircle, X } from "lucide-react"
import { uploadVideo } from "../api/videos"
import type { FightCamp } from "../types"

const ALLOWED = [".mp4", ".mov", ".avi", ".mkv"]

interface Props {
  boxerId: string; fightCamps: FightCamp[]; sessionDate: string
  onSuccess: (videoId: string, sessionId: string) => void
}

export default function VideoUploadForm({ boxerId, fightCamps, sessionDate, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [sessionType, setSessionType] = useState("other")
  const [fightCampId, setFightCampId] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    const ext = "." + (f.name.split(".").pop() || "").toLowerCase()
    if (!ALLOWED.includes(ext)) { setError("File type not supported. Use: " + ALLOWED.join(", ")); setFile(null); return }
    setError(""); setFile(f)
  }

  const handleSubmit = useCallback(async () => {
    if (!file) return
    setUploading(true); setProgress(0)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("boxer_id", boxerId)
    fd.append("session_type", sessionType)
    fd.append("session_date", sessionDate)
    if (fightCampId) fd.append("fight_camp_id", fightCampId)
    try {
      const result = await uploadVideo(fd, pct => setProgress(pct))
      onSuccess(result.video_id, result.session_id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally { setUploading(false) }
  }, [file, boxerId, sessionType, sessionDate, fightCampId, onSuccess])

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        className={"border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors " +
          (file ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-blue-300 bg-gray-50")}
      >
        <input ref={inputRef} type="file" accept={ALLOWED.join(",")} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {file ? (
          <div className="flex items-center justify-center gap-3 text-blue-700">
            <CheckCircle size={18} className="text-blue-500" />
            <span className="text-sm font-medium">{file.name}</span>
            <span className="text-xs text-gray-400">({(file.size/1024/1024).toFixed(1)} MB)</span>
            <button onClick={e => { e.stopPropagation(); setFile(null) }} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div>
            <Upload size={24} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-600">Drop video here or <span className="text-blue-600 font-medium">browse</span></p>
            <p className="text-xs text-gray-400 mt-1">{ALLOWED.join(", ")} &bull; Max 2 GB</p>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Session Type</label>
          <select value={sessionType} onChange={e => setSessionType(e.target.value)} className="input">
            {["shadowboxing","heavy_bag","pad_work","sparring","other"].map(t =>
              <option key={t} value={t}>{t.replace("_"," ")}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Fight Camp (optional)</label>
          <select value={fightCampId} onChange={e => setFightCampId(e.target.value)} className="input">
            <option value="">None</option>
            {fightCamps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="shrink-0" />{error}
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Uploading…</span><span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-200" style={{ width: progress + "%" }} />
          </div>
        </div>
      )}

      <button onClick={handleSubmit} disabled={!file || uploading}
        className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
        {uploading ? "Uploading " + progress + "%…" : "Upload & Analyse"}
      </button>
    </div>
  )
}