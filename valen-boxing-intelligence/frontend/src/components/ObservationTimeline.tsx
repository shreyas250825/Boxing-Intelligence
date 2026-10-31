import { useState } from "react"
import { Clock, Plus, Trash2, AlertCircle } from "lucide-react"
import type { Observation, ObservationCategory } from "../types"

const CATS: ObservationCategory[] = ["guard_position","stance_and_balance","footwork","punch_execution",
  "return_to_guard","defensive_movement","timing_and_distance","conditioning_related","other"]

const sevStyle: Record<string,string> = {
  high: "bg-red-50 text-red-700 border border-red-100",
  medium: "bg-yellow-50 text-yellow-700 border border-yellow-100",
  low: "bg-green-50 text-green-700 border border-green-100",
}

interface Props {
  videoId: string; boxerId: string; observations: Observation[]
  videoDuration: number; onSeek: (t: number) => void
  onAdd: (o: Partial<Observation>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function ObservationTimeline({ videoId, boxerId, observations, videoDuration, onSeek, onAdd, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [ts, setTs] = useState("0")
  const [cat, setCat] = useState<ObservationCategory>("guard_position")
  const [desc, setDesc] = useState("")
  const [sev, setSev] = useState<"low"|"medium"|"high">("medium")
  const [saving, setSaving] = useState(false)

  const sorted = [...observations].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)

  const handleAdd = async () => {
    if (desc.length < 5) return
    setSaving(true)
    await onAdd({ video_id: videoId, boxer_id: boxerId, timestamp_seconds: Math.max(0, parseFloat(ts)||0), category: cat, description: desc, severity: sev })
    setDesc(""); setTs("0"); setSaving(false); setShowForm(false)
  }

  const handleSeek = (t: number) => onSeek(Math.min(t, Math.max(0, videoDuration)))

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm">Observations ({sorted.length})</h3>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
          <Plus size={12} />{showForm ? "Cancel" : "Add"}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 mb-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Timestamp (s)</label>
              <input type="number" min="0" step="0.1" value={ts} onChange={e => setTs(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Severity</label>
              <select value={sev} onChange={e => setSev(e.target.value as "low"|"medium"|"high")} className="input">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Category</label>
            <select value={cat} onChange={e => setCat(e.target.value as ObservationCategory)} className="input">
              {CATS.map(c => <option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(min 5 chars)</span></label>
            <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Describe what you observed…" className="input resize-none" />
          </div>
          <button onClick={handleAdd} disabled={saving || desc.length < 5} className="btn-primary w-full disabled:opacity-40">
            {saving ? "Saving…" : "Save Observation"}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-gray-400">
          <AlertCircle size={22} className="mb-2 opacity-50" />
          <p className="text-sm">No observations yet.</p>
          <p className="text-xs mt-1">Click Add to annotate a specific moment.</p>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {sorted.map(obs => (
            <div key={obs.id} className="border border-gray-200 rounded-xl p-3 bg-white hover:border-blue-200 transition-colors group">
              <div className="flex items-center justify-between mb-1.5">
                <button onClick={() => handleSeek(obs.timestamp_seconds)}
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-xs font-mono font-medium">
                  <Clock size={11} />{obs.timestamp_seconds.toFixed(1)}s
                </button>
                <div className="flex items-center gap-2">
                  <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded " + (sevStyle[obs.severity] ?? "bg-gray-100 text-gray-600")}>
                    {obs.severity}
                  </span>
                  <span className="text-[10px] text-gray-400">{obs.category.replace(/_/g," ")}</span>
                  <button onClick={() => onDelete(obs.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{obs.description}</p>
              {obs.review_status !== "pending" && (
                <span className={"inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded " +
                  (obs.review_status === "resolved" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700")}>
                  {obs.review_status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}