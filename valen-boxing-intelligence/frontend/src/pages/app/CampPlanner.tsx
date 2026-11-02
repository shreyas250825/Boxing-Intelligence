import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Dumbbell, Plus, ShieldCheck, Sparkles, Target } from "lucide-react"

import { listBoxers } from "../../api/boxers"
import { listFightCamps } from "../../api/fightCamps"
import Layout from "../../components/Layout"
import type { BoxerListItem, FightCamp } from "../../types"

type PlannerBlock = {
  id: string
  week: string
  focus: string
  goals: string
  recovery: string
}

export default function CampPlanner() {
  const [athletes, setAthletes] = useState<BoxerListItem[]>([])
  const [camps, setCamps] = useState<Array<{ boxer: BoxerListItem; camp: FightCamp }>>([])
  const [loading, setLoading] = useState(true)
  const [blocks, setBlocks] = useState<PlannerBlock[]>([
    { id: "block-1", week: "Week 1", focus: "Technical rhythm and guard integrity", goals: "2 round-robin technical blocks + 4 mitt work sessions", recovery: "Mobility before rounds and recovery walk after sessions" },
    { id: "block-2", week: "Week 2", focus: "Power delivery and timing", goals: "Explosive combinations with counters and counterpunch density", recovery: "Shorter volume, soft tissue work, and sleep priority" },
    { id: "block-3", week: "Week 3", focus: "Sparring and ring IQ", goals: "High-intensity rounds with decision-making under pressure", recovery: "Deload after hardest sparring day" },
  ])
  const [draft, setDraft] = useState({ week: "Week 4", focus: "Camp-specific finishing work", goals: "High-quality finishing sequences and ring management", recovery: "Recovery and taper emphasis" })

  useEffect(() => {
    let active = true

    listBoxers({ page_size: 50 })
      .then(async (result) => {
        if (!active) return
        setAthletes(result.data)

        const campEntries = await Promise.all(
          result.data.map(async (athlete) => {
            const boxerCamps = await listFightCamps(athlete.id)
            const activeCamp = boxerCamps.find((camp) => camp.status === "active") ?? boxerCamps[0]
            return activeCamp ? [{ boxer: athlete, camp: activeCamp }] : []
          }),
        )

        setCamps(campEntries.flat())
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const summary = useMemo(() => {
    const activeCamps = camps.length
    const focusAreas = new Set(blocks.map((block) => block.focus)).size
    return { activeCamps, focusAreas }
  }, [blocks, camps])

  const handleAddBlock = () => {
    const next: PlannerBlock = {
      id: `block-${Date.now()}`,
      week: draft.week,
      focus: draft.focus,
      goals: draft.goals,
      recovery: draft.recovery,
    }
    setBlocks((current) => [next, ...current])
    setDraft({ week: "Week 5", focus: "Conditioning and finishing", goals: "Targeted conditioning block with finishing actions", recovery: "Recovery emphasis and taper monitoring" })
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl">
        <Link to="/app/coach" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={14} /> Back to coach center
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-orange-300">Camp planner</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Weekly training block design</h1>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Live camps", value: summary.activeCamps, icon: ShieldCheck },
            { label: "Focus blocks", value: summary.focusAreas, icon: Target },
            { label: "Athletes tracked", value: athletes.length, icon: Dumbbell },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <Icon size={16} className="text-orange-300" />
              </div>
              <p className="mt-4 text-2xl font-semibold text-white">{loading ? "—" : value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={14} className="text-orange-300" />
              <h2 className="text-base font-semibold text-white">Current camp focus</h2>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading active camps…</p>
            ) : camps.length === 0 ? (
              <p className="text-sm text-slate-400">No active camps are available yet. Create or activate a camp from an athlete profile.</p>
            ) : (
              <div className="space-y-3">
                {camps.map(({ boxer, camp }) => (
                  <div key={camp.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{boxer.full_name}</p>
                        <p className="text-xs text-slate-400">{camp.name}</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                        {camp.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{camp.objectives || "No camp objectives have been captured yet."}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {camp.start_date} {camp.end_date ? `→ ${camp.end_date}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plus size={14} className="text-orange-300" />
              <h2 className="text-base font-semibold text-white">Add weekly block</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Week</label>
                <input value={draft.week} onChange={(e) => setDraft((prev) => ({ ...prev, week: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Primary focus</label>
                <input value={draft.focus} onChange={(e) => setDraft((prev) => ({ ...prev, focus: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Training goals</label>
                <textarea value={draft.goals} onChange={(e) => setDraft((prev) => ({ ...prev, goals: e.target.value }))} rows={3} className="input resize-none" />
              </div>
              <div>
                <label className="label">Recovery plan</label>
                <textarea value={draft.recovery} onChange={(e) => setDraft((prev) => ({ ...prev, recovery: e.target.value }))} rows={2} className="input resize-none" />
              </div>
              <button onClick={handleAddBlock} className="btn-primary w-full">Add camp block</button>
            </div>
          </div>
        </div>

        <div className="mt-6 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={14} className="text-orange-300" />
            <h2 className="text-base font-semibold text-white">Weekly microcycle plan</h2>
          </div>

          <div className="space-y-3">
            {blocks.map((block) => (
              <div key={block.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{block.week}</p>
                  <span className="rounded-full bg-orange-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-orange-300">{block.focus}</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{block.goals}</p>
                <p className="mt-2 text-xs text-slate-400">Recovery: {block.recovery}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
