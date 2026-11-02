import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Brain, Trash2, Edit2, Plus, Loader2, AlertTriangle, Check, X } from 'lucide-react'
import Layout from '../../../components/Layout'
import {
  fetchMemories,
  createMemory,
  deleteMemory,
  updateMemory,
  fetchCompanions,
  type AIMemory,
  type Companion,
} from '../../../api/aiCorner'

export default function AIMemoryPage() {
  const [searchParams] = useSearchParams()
  const boxerId = searchParams.get('boxer') || ''
  const [memories, setMemories] = useState<AIMemory[]>([])
  const [companions, setCompanions] = useState<Companion[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSlug, setFilterSlug] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ companion_slug: '', memory_key: '', memory_value: '' })
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!boxerId) return
    setLoading(true)
    Promise.all([
      fetchMemories(boxerId, filterSlug || undefined),
      fetchCompanions(),
    ])
      .then(([mems, comps]) => {
        setMemories(mems)
        setCompanions(comps)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [boxerId, filterSlug])

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id)
      setMemories((prev) => prev.filter((m) => m.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleEditSave = async (id: string) => {
    try {
      await updateMemory(id, editValue)
      setMemories((prev) => prev.map((m) => m.id === id ? { ...m, memory_value: editValue } : m))
      setEditingId(null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleCreate = async () => {
    if (!form.companion_slug || !form.memory_key.trim() || !form.memory_value.trim() || !boxerId) return
    try {
      await createMemory({ boxer_id: boxerId, ...form, origin: 'user_explicit' })
      setShowForm(false)
      setForm({ companion_slug: '', memory_key: '', memory_value: '' })
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (!boxerId) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
          <p className="text-slate-300">Select a boxer to view AI Memory.</p>
        </div>
      </Layout>
    )
  }

  const byCompanion: Record<string, AIMemory[]> = {}
  memories.forEach((m) => {
    byCompanion[m.companion_slug] = [...(byCompanion[m.companion_slug] || []), m]
  })

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-orange-400" />
            <h1 className="text-lg font-bold text-white">AI Memory</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-secondary text-xs py-2">
            <Plus size={12} /> Add Memory
          </button>
        </div>

        <p className="text-sm text-slate-400">
          Companions remember important information between sessions. You can view, edit, or delete any stored memory here.
          Memories are specific to you and are never shared with other athletes.
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-3">
          <select
            className="input text-sm py-2 w-auto"
            value={filterSlug}
            onChange={(e) => setFilterSlug(e.target.value)}
          >
            <option value="">All companions</option>
            {companions.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="rounded-xl border border-orange-500/20 bg-slate-900/70 p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Add Memory</p>
            <select
              className="input text-sm"
              value={form.companion_slug}
              onChange={(e) => setForm((f) => ({ ...f, companion_slug: e.target.value }))}
            >
              <option value="">Select companion</option>
              {companions.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <input
              className="input text-sm"
              placeholder="Memory key (e.g. fighting_style, food_preference)"
              value={form.memory_key}
              onChange={(e) => setForm((f) => ({ ...f, memory_key: e.target.value }))}
            />
            <textarea
              className="input text-sm"
              rows={2}
              placeholder="Memory value"
              value={form.memory_value}
              onChange={(e) => setForm((f) => ({ ...f, memory_value: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!form.companion_slug || !form.memory_key || !form.memory_value}
                className="btn-primary text-xs py-2"
              >
                Save Memory
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary text-xs py-2">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-orange-400" /></div>
        ) : memories.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Brain size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No memories stored yet.</p>
            <p className="text-xs mt-1">Chat with a companion — it will remember important details automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byCompanion).map(([slug, mems]) => {
              const comp = companions.find((c) => c.slug === slug)
              return (
                <div key={slug}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{comp?.icon || '🤖'}</span>
                    <p className="text-xs font-semibold text-slate-300">{comp?.name || slug}</p>
                    <span className="text-xs text-slate-500">({mems.length})</span>
                  </div>
                  <div className="space-y-2 ml-5">
                    {mems.map((mem) => (
                      <div key={mem.id} className="rounded-xl border border-slate-700/40 bg-slate-900/50 p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{mem.memory_key}</p>
                            {editingId === mem.id ? (
                              <div className="flex gap-2 items-center">
                                <input
                                  className="input text-sm flex-1"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  autoFocus
                                />
                                <button onClick={() => handleEditSave(mem.id)} className="p-1 text-green-400 hover:text-green-300">
                                  <Check size={13} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1 text-slate-500 hover:text-white">
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-200">{mem.memory_value}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-slate-600 mr-1">{mem.origin}</span>
                            <button
                              onClick={() => { setEditingId(mem.id); setEditValue(mem.memory_value) }}
                              className="p-1 text-slate-600 hover:text-slate-300 transition"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              onClick={() => handleDelete(mem.id)}
                              className="p-1 text-slate-600 hover:text-red-400 transition"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
