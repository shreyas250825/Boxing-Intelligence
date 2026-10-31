import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import Layout from "../../components/Layout"
import { registerBoxer } from "../../api/boxers"
import type { Boxer } from "../../types"
import { AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"

const WEIGHTS = ["Strawweight","Light Flyweight","Flyweight","Bantamweight","Featherweight","Lightweight","Welterweight","Middleweight","Light Heavyweight","Cruiserweight","Heavyweight"]

export default function RegisterBoxer() {
  const nav = useNavigate()
  const [form, setForm] = useState<Partial<Boxer> & { full_name: string }>({
    full_name: "", date_of_birth: "", weight_class: "", stance: "orthodox",
    experience_level: "amateur", primary_coach: "", training_goals: "", notes: ""
  })
  const [error, setError] = useState<{ message: string; existing_id?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null)
    try {
      const boxer = await registerBoxer(form)
      nav("/boxers/" + boxer.id)
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; details?: { existing_boxer_id?: string } }
      setError({ message: e.message || "Registration failed", existing_id: e.code === "BOXER_DUPLICATE" ? e.details?.existing_boxer_id : undefined })
    } finally { setSaving(false) }
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-2xl">
        <Link to="/app/boxers" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} />Back to directory
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Register Athlete</h1>
        <p className="text-sm text-gray-500 mb-6">A permanent BX-XXXXXX ID will be assigned automatically.</p>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Full Name <span className="text-red-500">*</span></label>
            <input required value={form.full_name} onChange={e => set("full_name", e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" value={form.date_of_birth ?? ""} onChange={e => set("date_of_birth", e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Weight Class</label>
              <select value={form.weight_class ?? ""} onChange={e => set("weight_class", e.target.value)} className="input">
                <option value="">Select…</option>
                {WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Stance</label>
              <select value={form.stance} onChange={e => set("stance", e.target.value)} className="input">
                <option value="orthodox">Orthodox</option>
                <option value="southpaw">Southpaw</option>
                <option value="switch">Switch</option>
              </select>
            </div>
            <div>
              <label className="label">Experience Level</label>
              <select value={form.experience_level} onChange={e => set("experience_level", e.target.value)} className="input">
                <option value="amateur">Amateur</option>
                <option value="semi-pro">Semi-Pro</option>
                <option value="professional">Professional</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Primary Coach</label>
            <input value={form.primary_coach ?? ""} onChange={e => set("primary_coach", e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Training Goals</label>
            <textarea rows={3} value={form.training_goals ?? ""} onChange={e => set("training_goals", e.target.value)} className="input resize-none" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-700 text-sm">{error.message}</p>
                {error.existing_id && (
                  <Link to={"/app/boxers/" + error.existing_id} className="text-blue-600 text-xs underline mt-1 block">
                    View existing profile
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => nav("/app/boxers")} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || !form.full_name}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
              {saving ? "Registering…" : <><CheckCircle2 size={14} />Register Athlete</>}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}