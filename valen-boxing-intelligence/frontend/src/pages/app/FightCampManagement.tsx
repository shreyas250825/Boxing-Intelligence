import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import Layout from "../../components/Layout"
import { SkeletonCard } from "../../components/SkeletonLoader"
import { listFightCamps, createFightCamp } from "../../api/fightCamps"
import { getBoxer } from "../../api/boxers"
import type { FightCamp, Boxer } from "../../types"
import { Plus, Calendar, ArrowLeft } from "lucide-react"

const STATUS_STYLE: Record<string, string> = {
  planned: "bg-yellow-50 text-yellow-700", active: "bg-green-50 text-green-700",
  completed: "bg-blue-50 text-blue-700", archived: "bg-gray-100 text-gray-500"
}

export default function FightCampManagement() {
  const { id } = useParams<{ id: string }>()
  const [boxer, setBoxer] = useState<Boxer | null>(null)
  const [camps, setCamps] = useState<FightCamp[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", status: "planned", objectives: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    Promise.all([getBoxer(id), listFightCamps(id)])
      .then(([b, c]) => { setBoxer(b); setCamps(c) })
      .finally(() => setLoading(false))
  }, [id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("")
    try {
      const camp = await createFightCamp({ ...form, boxer_id: id!, status: form.status as FightCamp["status"] })
      setCamps(c => [camp, ...c])
      setShowForm(false)
      setForm({ name: "", start_date: "", end_date: "", status: "planned", objectives: "" })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally { setSaving(false) }
  }

  if (loading) return <Layout><div className="p-8 space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div></Layout>

  return (
    <Layout>
      <div className="px-8 py-8 max-w-3xl">
        <Link to={"/app/boxers/" + id} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} />{boxer?.full_name}
        </Link>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Fight Camps</h1>
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-2">
            <Plus size={14} />{showForm ? "Cancel" : "New Camp"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="card p-5 mb-5 space-y-3 border-blue-200">
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Camp name *" className="input" />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Start Date *</label>
                <input type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input" />
              </div>
              <div><label className="label">End Date</label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input" />
              </div>
            </div>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input">
              {["planned","active","completed","archived"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea rows={2} value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))}
              placeholder="Objectives (optional)" className="input resize-none" />
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? "Creating…" : "Create Camp"}
            </button>
          </form>
        )}

        {camps.length === 0 ? (
          <div className="card p-10 text-center">
            <Calendar size={28} className="mx-auto mb-3 text-gray-300" />
            <h3 className="font-semibold text-gray-900 mb-1">No fight camps</h3>
            <p className="text-sm text-gray-500">Create a camp to organise training around a target bout.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {camps.map(c => (
              <div key={c.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900">{c.name}</h3>
                  <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-500")}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Calendar size={11} />{c.start_date}{c.end_date ? " to " + c.end_date : ""}
                </p>
                {c.objectives && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{c.objectives}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}