import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import Layout from "../../components/Layout"
import { SkeletonBlock } from "../../components/SkeletonLoader"
import { getBoxer, archiveBoxer, updateBoxer } from "../../api/boxers"
import { getSessions } from "../../api/progress"
import apiClient from "../../api/client"
import type { Boxer, TrainingSession, Video } from "../../types"
import {
  Upload, TrendingUp, FileText, Sword, Archive,
  Video as VideoIcon, PlusCircle, ArrowLeft, PlayCircle,
  Edit3, Check, X, Trash2, AlertTriangle
} from "lucide-react"

const WEIGHTS = ["Strawweight","Light Flyweight","Flyweight","Bantamweight","Featherweight","Lightweight","Welterweight","Middleweight","Light Heavyweight","Cruiserweight","Heavyweight"]

export default function AthleteProfile() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [boxer, setBoxer] = useState<Boxer | null>(null)
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [sessionVideos, setSessionVideos] = useState<Record<string, Video>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Boxer>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [saveOk, setSaveOk] = useState(false)

  // Delete state
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    if (!id) return
    Promise.all([getBoxer(id), getSessions(id)])
      .then(([b, s]) => {
        setBoxer(b)
        setEditForm(b)
        setSessions(s.data)
        // Load first video per session
        s.data.slice(0, 10).forEach(session => {
          apiClient.get(`/api/v1/boxers/${id}/sessions/${session.id}/videos`)
            .then(r => {
              const vids = ((r.data as { data?: Video[] })?.data) ?? []
              if (vids.length > 0) setSessionVideos(prev => ({ ...prev, [session.id]: vids[0] }))
            }).catch(() => {})
        })
      })
      .catch((e: unknown) => {
        if ((e as { code?: string }).code === "BOXER_NOT_FOUND") setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (!id) return
    setSaving(true); setSaveError("")
    try {
      const updated = await updateBoxer(id, editForm)
      setBoxer(updated)
      setEditing(false)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2500)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed")
    } finally { setSaving(false) }
  }

  const handleArchive = async () => {
    if (!id || !confirm("Archive this athlete? They will be hidden from search but their records are preserved.")) return
    await archiveBoxer(id)
    setBoxer(b => b ? { ...b, status: "archived" } : b)
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true); setDeleteError("")
    try {
      await apiClient.delete(`/api/v1/boxers/${id}`)
      nav("/app/boxers")
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string; details?: { session_count?: number; video_count?: number } }
      if (err.code === "BOXER_HAS_RECORDS") {
        setDeleteError(`Cannot delete: boxer has ${err.details?.session_count || 0} session(s) and ${err.details?.video_count || 0} video(s). Archive instead, or delete associated records first.`)
      } else {
        setDeleteError(err.message || "Delete failed")
      }
    } finally { setDeleting(false) }
  }

  if (loading) return (
    <Layout>
      <div className="p-8 space-y-4">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-32 w-full" />
      </div>
    </Layout>
  )
  if (notFound) return (
    <Layout>
      <div className="p-8 text-center py-16 text-gray-500">
        Athlete not found. <Link to="/app/boxers" className="text-blue-600 underline">Return to directory</Link>
      </div>
    </Layout>
  )
  if (!boxer) return null

  const actions = [
    { icon: Upload,     label: "Upload Video", to: `/app/boxers/${id}/upload` },
    { icon: Sword,      label: "Fight Camps",  to: `/app/boxers/${id}/camps` },
    { icon: TrendingUp, label: "Progress",     to: `/app/boxers/${id}/progress` },
    { icon: FileText,   label: "Reports",      to: `/app/boxers/${id}/reports` },
  ]

  const set = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }))

  return (
    <Layout>
      <div className="px-8 py-8 max-w-5xl">
        <Link to="/app/boxers" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} />Directory
        </Link>

        {/* Header card */}
        <div className="card p-6 mb-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-blue-700 font-bold text-xl">{boxer.full_name[0]}</span>
              </div>
              <div>
                <span className="inline-block text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mb-1">
                  {boxer.permanent_id}
                </span>
                <h1 className="text-xl font-bold text-gray-900">{boxer.full_name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${boxer.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {boxer.status}
                  </span>
                  <span className="text-xs text-gray-400 capitalize">{boxer.experience_level}</span>
                  {boxer.weight_class && <span className="text-xs text-gray-400">{boxer.weight_class}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {saveOk && <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} />Saved</span>}
              <button onClick={() => { setEditing(e => !e); setSaveError("") }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors">
                <Edit3 size={13} />{editing ? "Cancel" : "Edit"}
              </button>
              <button onClick={handleArchive} disabled={boxer.status === "archived"}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-500 disabled:opacity-30 transition-colors">
                <Archive size={13} />Archive
              </button>
              <button onClick={() => setShowDelete(true)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 size={13} />Delete
              </button>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        {showDelete && (
          <div className="card p-5 mb-5 border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-700 text-sm mb-1">Permanently delete this athlete?</p>
                <p className="text-red-600 text-xs mb-3 leading-relaxed">
                  This is irreversible. If the boxer has sessions or videos, you must delete those first or use Archive instead.
                  The permanent ID <strong>{boxer.permanent_id}</strong> cannot be recovered.
                </p>
                {deleteError && <p className="text-red-700 text-xs bg-red-100 rounded px-3 py-2 mb-3">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowDelete(false); setDeleteError("") }} className="btn-secondary text-xs px-3 py-1.5">
                    Cancel — use Archive instead
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors">
                    <Trash2 size={12} />{deleting ? "Deleting…" : "Yes, permanently delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="card p-5 mb-5 border-blue-200">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Edit Athlete Details</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Full Name</label>
                <input value={editForm.full_name || ""} onChange={e => set("full_name", e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input type="date" value={editForm.date_of_birth || ""} onChange={e => set("date_of_birth", e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Weight Class</label>
                <select value={editForm.weight_class || ""} onChange={e => set("weight_class", e.target.value)} className="input">
                  <option value="">Select…</option>
                  {WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Stance</label>
                <select value={editForm.stance || "orthodox"} onChange={e => set("stance", e.target.value)} className="input">
                  <option value="orthodox">Orthodox</option>
                  <option value="southpaw">Southpaw</option>
                  <option value="switch">Switch</option>
                </select>
              </div>
              <div>
                <label className="label">Experience Level</label>
                <select value={editForm.experience_level || "amateur"} onChange={e => set("experience_level", e.target.value)} className="input">
                  <option value="amateur">Amateur</option>
                  <option value="semi-pro">Semi-Pro</option>
                  <option value="professional">Professional</option>
                </select>
              </div>
              <div>
                <label className="label">Primary Coach</label>
                <input value={editForm.primary_coach || ""} onChange={e => set("primary_coach", e.target.value)} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Training Goals</label>
                <textarea rows={2} value={editForm.training_goals || ""} onChange={e => set("training_goals", e.target.value)} className="input resize-none" />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea rows={2} value={editForm.notes || ""} onChange={e => set("notes", e.target.value)} className="input resize-none" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400 flex-1">Permanent ID <span className="font-mono text-blue-600">{boxer.permanent_id}</span> never changes.</p>
              {saveError && <p className="text-xs text-red-600">{saveError}</p>}
              <button onClick={() => setEditing(false)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                <X size={12} />Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-40">
                <Check size={12} />{saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {actions.map(({ icon: Icon, label, to }) => (
            <button key={label} onClick={() => nav(to)}
              className="card p-4 text-center hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer">
              <Icon size={20} className="mx-auto text-gray-400 group-hover:text-blue-600 transition-colors mb-2" />
              <p className="text-xs font-medium text-gray-600 group-hover:text-gray-900">{label}</p>
            </button>
          ))}
        </div>

        {/* Details + sessions */}
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-2 card p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Athlete Details</h3>
            <dl className="space-y-3">
              {[
                ["DOB", boxer.date_of_birth ?? "—"],
                ["Stance", boxer.stance],
                ["Coach", boxer.primary_coach ?? "—"],
                ["Weight", boxer.weight_class ?? "—"],
                ["Level", boxer.experience_level],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-gray-400 font-medium">{k}</dt>
                  <dd className="text-sm text-gray-800 mt-0.5 capitalize">{v}</dd>
                </div>
              ))}
            </dl>
            {boxer.training_goals && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1">Goals</p>
                <p className="text-sm text-gray-700 leading-relaxed">{boxer.training_goals}</p>
              </div>
            )}
            {boxer.notes && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1">Notes</p>
                <p className="text-sm text-gray-600 leading-relaxed">{boxer.notes}</p>
              </div>
            )}
          </div>

          <div className="col-span-3 card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Sessions ({sessions.length})</h3>
              <Link to={`/app/boxers/${id}/upload`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <PlusCircle size={12} />New session
              </Link>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <VideoIcon size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No sessions yet.</p>
                <button onClick={() => nav(`/app/boxers/${id}/upload`)} className="mt-3 btn-primary text-xs px-3 py-1.5">
                  Upload first video
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sessions.slice(0, 10).map(s => {
                  const video = sessionVideos[s.id]
                  return (
                    <div key={s.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                          <VideoIcon size={12} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{s.session_date}</p>
                          <p className="text-xs text-gray-400 capitalize">{s.session_type.replace("_", " ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.rounds && <span className="text-xs text-gray-400">{s.rounds} rds</span>}
                        {video ? (
                          <button onClick={() => nav(`/app/analysis/${video.id}`)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                            <PlayCircle size={13} />Analyse
                          </button>
                        ) : (
                          <button onClick={() => nav(`/app/boxers/${id}/upload`)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                            <Upload size={12} />Add video
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}