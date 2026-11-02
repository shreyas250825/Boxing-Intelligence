import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Target, Plus, Trash2, CheckCircle, ChevronDown, ChevronUp, Loader2, AlertTriangle, Zap } from 'lucide-react'
import Layout from '../../../components/Layout'
import {
  fetchAIGoals,
  createAIGoal,
  updateAIGoal,
  deleteAIGoal,
  type AIGoal,
} from '../../../api/aiCorner'

const CATEGORIES = ['general', 'technical', 'conditioning', 'nutrition', 'mindset', 'competition']

export default function AIGoals() {
  const [searchParams] = useSearchParams()
  const boxerId = searchParams.get('boxer') || ''
  const [goals, setGoals] = useState<AIGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'general', target_date: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!boxerId) return
    setLoading(true)
    fetchAIGoals(boxerId)
      .then(setGoals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [boxerId])

  const handleCreate = async () => {
    if (!form.title.trim() || !boxerId) return
    setFormLoading(true)
    try {
      await createAIGoal({ boxer_id: boxerId, ...form })
      setShowForm(false)
      setForm({ title: '', description: '', category: 'general', target_date: '' })
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAIGoal(id)
      setGoals((prev) => prev.filter((g) => g.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleMilestoneToggle = async (goal: AIGoal, milestoneIdx: number) => {
    const milestones = goal.milestones.map((m, i) => i === milestoneIdx ? { ...m, completed: !m.completed } : m)
    const completed = milestones.filter((m) => m.completed).length
    const pct = Math.round((completed / milestones.length) * 100)
    await updateAIGoal(goal.id, { milestones, completion_percent: pct })
    setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, milestones, completion_percent: pct } : g))
  }

  const handleStatusChange = async (goal: AIGoal, status: string) => {
    await updateAIGoal(goal.id, { status })
    setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, status } : g))
  }

  if (!boxerId) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
          <p className="text-slate-300">Select a boxer to manage AI Goals.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={20} className="text-orange-400" />
            <h1 className="text-lg font-bold text-white">AI Goal Manager</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs py-2">
            <Plus size={13} /> New Goal
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
            <AlertTriangle size={13} />
            {error}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="rounded-xl border border-orange-500/30 bg-slate-900/70 p-4 space-y-3">
            <p className="text-sm font-semibold text-white">New Goal</p>
            <input
              className="input text-sm"
              placeholder="Goal title (e.g. Improve jab technique)"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="input text-sm"
              placeholder="Description (optional)"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select
                  className="input text-sm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Target Date</label>
                <input
                  type="date"
                  className="input text-sm"
                  value={form.target_date}
                  onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={formLoading || !form.title.trim()} className="btn-primary text-xs py-2">
                {formLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                {formLoading ? 'Creating with AI…' : 'Create & Generate Milestones'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary text-xs py-2">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-orange-400" />
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Target size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No goals yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="rounded-xl border border-slate-700/60 bg-slate-900/60 overflow-hidden"
              >
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpanded(expanded === goal.id ? null : goal.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white truncate">{goal.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                        goal.status === 'active' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                        goal.status === 'completed' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                        'text-slate-400 border-slate-600 bg-slate-800'
                      }`}>
                        {goal.status}
                      </span>
                    </div>
                    {goal.description && <p className="text-xs text-slate-400 mb-2 line-clamp-1">{goal.description}</p>}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-700">
                        <div
                          className="h-full rounded-full bg-orange-500 transition-all"
                          style={{ width: `${goal.completion_percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{goal.completion_percent}%</span>
                      {goal.target_date && (
                        <span className="text-xs text-slate-500 shrink-0">by {goal.target_date}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(goal.id) }}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                    {expanded === goal.id ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                  </div>
                </div>

                {expanded === goal.id && (
                  <div className="px-4 pb-4 border-t border-slate-700/40 pt-3 space-y-3">
                    {goal.milestones.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Milestones</p>
                        {goal.milestones.map((m, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <button
                              onClick={() => handleMilestoneToggle(goal, i)}
                              className={`w-4 h-4 rounded border transition shrink-0 flex items-center justify-center
                                ${m.completed ? 'bg-orange-500 border-orange-500' : 'border-slate-600 hover:border-orange-500'}`}
                            >
                              {m.completed && <CheckCircle size={10} className="text-white" />}
                            </button>
                            <span className={`text-sm flex-1 ${m.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                              {m.title}
                            </span>
                            {m.target_date && <span className="text-xs text-slate-500 shrink-0">{m.target_date}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No milestones generated.</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      {goal.status === 'active' && (
                        <button
                          onClick={() => handleStatusChange(goal, 'completed')}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition"
                        >
                          Mark Completed
                        </button>
                      )}
                      {goal.status === 'completed' && (
                        <button
                          onClick={() => handleStatusChange(goal, 'active')}
                          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
