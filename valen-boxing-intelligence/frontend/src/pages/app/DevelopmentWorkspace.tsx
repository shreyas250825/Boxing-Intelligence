import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  Gauge,
  HeartPulse,
  NotebookPen,
  PlusCircle,
  Target,
  Trophy,
} from "lucide-react"

import { getBoxer } from "../../api/boxers"
import {
  createCompetitionPlan,
  createDevelopmentGoal,
  createJournalEntry,
  createRecoveryCheckin,
  createSkillAssessment,
  getDevelopmentDashboard,
} from "../../api/development"
import Layout from "../../components/Layout"
import { SkeletonBlock } from "../../components/SkeletonLoader"
import type {
  Boxer,
  DevelopmentDashboard,
  DevelopmentGoal,
  RecoveryCheckin,
  TrainingJournalEntry,
} from "../../types"

type TabKey = "goals" | "journal" | "recovery" | "skills" | "competition"

const tabs: Array<{ key: TabKey; label: string; icon: typeof Target }> = [
  { key: "goals", label: "Goals", icon: Target },
  { key: "journal", label: "Journal", icon: NotebookPen },
  { key: "recovery", label: "Recovery", icon: HeartPulse },
  { key: "skills", label: "Skills", icon: Gauge },
  { key: "competition", label: "Competition", icon: Trophy },
]

const defaultGoalForm = {
  title: "",
  description: "",
  start_date: new Date().toISOString().slice(0, 10),
  target_date: "",
  success_criteria: "",
  assigned_coach: "",
  is_primary: false,
}

const defaultJournalForm = {
  session_date: new Date().toISOString().slice(0, 10),
  session_type: "training",
  duration_minutes: 60,
  focus: "",
  what_went_well: "",
  needs_improvement: "",
  questions_for_coach: "",
  notes: "",
  coach_visible: true,
}

const defaultRecoveryForm = {
  entry_date: new Date().toISOString().slice(0, 10),
  energy_level: 7,
  sleep_hours: 7,
  recovery_score: 80,
  stress_level: 4,
  readiness_rating: 8,
  notes: "",
}

const defaultSkillForm = {
  skill_name: "",
  current_level: "developing",
  development_goal: "",
  coach_notes: "",
  video_reference: "",
  assigned_drill: "",
  coach_assessed: true,
}

const defaultCompetitionForm = {
  competition_name: "",
  competition_date: "",
  weight_category: "",
  timeline: "",
  milestones: "",
  coach_checklist: "",
  equipment_checklist: "",
  travel_notes: "",
  status: "planned",
}

export default function DevelopmentWorkspace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [boxer, setBoxer] = useState<Boxer | null>(null)
  const [dashboard, setDashboard] = useState<DevelopmentDashboard | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("goals")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [goalForm, setGoalForm] = useState(defaultGoalForm)
  const [journalForm, setJournalForm] = useState(defaultJournalForm)
  const [recoveryForm, setRecoveryForm] = useState(defaultRecoveryForm)
  const [skillForm, setSkillForm] = useState(defaultSkillForm)
  const [competitionForm, setCompetitionForm] = useState(defaultCompetitionForm)

  const refresh = async () => {
    if (!id) return
    const [nextBoxer, nextDashboard] = await Promise.all([getBoxer(id), getDevelopmentDashboard(id)])
    setBoxer(nextBoxer)
    setDashboard(nextDashboard)
  }

  useEffect(() => {
    if (!id) return

    refresh()
      .catch(() => navigate("/app/boxers"))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const summaryCards = useMemo(() => {
    if (!dashboard) {
      return []
    }

    return [
      { label: "Primary goal", value: dashboard.primary_goal?.title ?? "Not set", tone: "orange" },
      { label: "Journal entries", value: String(dashboard.journal_entries.length), tone: "blue" },
      { label: "Recovery score", value: dashboard.recovery_checkins[0]?.recovery_score ? `${dashboard.recovery_checkins[0].recovery_score}/100` : "—", tone: "green" },
      { label: "Competition plans", value: String(dashboard.goals.length), tone: "violet" },
    ]
  }, [dashboard])

  const handleSubmit = async (type: TabKey) => {
    if (!id) return

    setSubmitting(true)

    try {
      if (type === "goals") {
        await createDevelopmentGoal(id, goalForm)
        setGoalForm(defaultGoalForm)
      }
      if (type === "journal") {
        await createJournalEntry(id, journalForm)
        setJournalForm(defaultJournalForm)
      }
      if (type === "recovery") {
        await createRecoveryCheckin(id, recoveryForm)
        setRecoveryForm(defaultRecoveryForm)
      }
      if (type === "skills") {
        await createSkillAssessment(id, skillForm)
        setSkillForm(defaultSkillForm)
      }
      if (type === "competition") {
        await createCompetitionPlan(id, competitionForm)
        setCompetitionForm(defaultCompetitionForm)
      }

      await refresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="px-8 py-8 max-w-6xl space-y-4">
          <SkeletonBlock className="h-8 w-52" />
          <SkeletonBlock className="h-28 w-full" />
          <SkeletonBlock className="h-72 w-full" />
        </div>
      </Layout>
    )
  }

  if (!boxer) {
    return null
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl">
        <Link to={`/app/boxers/${id}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white mb-6">
          <ArrowLeft size={14} />
          Back to athlete profile
        </Link>

        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-orange-300">Athlete development workspace</p>
              <h1 className="text-2xl font-bold text-white mt-2">{boxer.full_name}</h1>
              <p className="mt-2 text-sm text-slate-300">
                Turn observations, recovery, and training notes into a coachable development plan.
              </p>
            </div>
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-orange-200">Coach focus</p>
              <p className="mt-1 text-sm font-semibold text-orange-100">{boxer.primary_coach ?? "Unassigned"}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {summaryCards.map(({ label, value, tone }) => (
            <div key={label} className="card p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
              <p className={`mt-3 text-lg font-semibold ${tone === "orange" ? "text-orange-200" : tone === "blue" ? "text-blue-200" : tone === "green" ? "text-emerald-200" : "text-violet-200"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="card p-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  activeTab === key ? "bg-orange-500 text-white" : "bg-slate-900/70 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {activeTab === "goals" && (
            <>
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-white">Add development goal</h3>
                  <span className="inline-flex items-center gap-1 text-xs text-orange-300"><PlusCircle size={12} /> Coach note</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="label">Goal title</label>
                    <input value={goalForm.title} onChange={(e) => setGoalForm((prev) => ({ ...prev, title: e.target.value }))} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Description</label>
                    <textarea value={goalForm.description} onChange={(e) => setGoalForm((prev) => ({ ...prev, description: e.target.value }))} className="input resize-none" rows={3} />
                  </div>
                  <div>
                    <label className="label">Start date</label>
                    <input type="date" value={goalForm.start_date} onChange={(e) => setGoalForm((prev) => ({ ...prev, start_date: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Target date</label>
                    <input type="date" value={goalForm.target_date} onChange={(e) => setGoalForm((prev) => ({ ...prev, target_date: e.target.value }))} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Success criteria</label>
                    <textarea value={goalForm.success_criteria} onChange={(e) => setGoalForm((prev) => ({ ...prev, success_criteria: e.target.value }))} className="input resize-none" rows={2} />
                  </div>
                  <div>
                    <label className="label">Assigned coach</label>
                    <input value={goalForm.assigned_coach} onChange={(e) => setGoalForm((prev) => ({ ...prev, assigned_coach: e.target.value }))} className="input" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={goalForm.is_primary} onChange={(e) => setGoalForm((prev) => ({ ...prev, is_primary: e.target.checked }))} />
                      Primary goal
                    </label>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => handleSubmit("goals")} disabled={submitting || !goalForm.title} className="btn-primary">
                    {submitting ? "Saving…" : "Save goal"}
                  </button>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-base font-semibold text-white mb-4">Current goals</h3>
                {dashboard?.goals.length ? (
                  <div className="space-y-3">
                    {dashboard.goals.map((goal: DevelopmentGoal) => (
                      <div key={goal.id} className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-white">{goal.title}</p>
                            <p className="text-xs text-slate-400">{goal.start_date} → {goal.target_date ?? "Open ended"}</p>
                          </div>
                          {goal.is_primary && <span className="rounded-full bg-orange-500/15 text-orange-200 px-2 py-1 text-[10px] uppercase tracking-[0.14em]">Primary</span>}
                        </div>
                        <p className="text-sm text-slate-300">{goal.description ?? "No description"}</p>
                        {goal.success_criteria && <p className="mt-2 text-xs text-slate-400">Criteria: {goal.success_criteria}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No goals saved yet.</p>
                )}
              </div>
            </>
          )}

          {activeTab === "journal" && (
            <>
              <div className="card p-5">
                <h3 className="text-base font-semibold text-white mb-4">Training journal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Session date</label>
                    <input type="date" value={journalForm.session_date} onChange={(e) => setJournalForm((prev) => ({ ...prev, session_date: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Session type</label>
                    <select value={journalForm.session_type} onChange={(e) => setJournalForm((prev) => ({ ...prev, session_type: e.target.value }))} className="input">
                      <option value="training">Training</option>
                      <option value="sparring">Sparring</option>
                      <option value="pad_work">Pad work</option>
                      <option value="conditioning">Conditioning</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Duration (minutes)</label>
                    <input type="number" value={journalForm.duration_minutes} onChange={(e) => setJournalForm((prev) => ({ ...prev, duration_minutes: Number(e.target.value) }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Focus</label>
                    <input value={journalForm.focus} onChange={(e) => setJournalForm((prev) => ({ ...prev, focus: e.target.value }))} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">What went well</label>
                    <textarea value={journalForm.what_went_well} onChange={(e) => setJournalForm((prev) => ({ ...prev, what_went_well: e.target.value }))} className="input resize-none" rows={3} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Needs improvement</label>
                    <textarea value={journalForm.needs_improvement} onChange={(e) => setJournalForm((prev) => ({ ...prev, needs_improvement: e.target.value }))} className="input resize-none" rows={3} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Questions for coach</label>
                    <textarea value={journalForm.questions_for_coach} onChange={(e) => setJournalForm((prev) => ({ ...prev, questions_for_coach: e.target.value }))} className="input resize-none" rows={2} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Coach-visible notes</label>
                    <textarea value={journalForm.notes} onChange={(e) => setJournalForm((prev) => ({ ...prev, notes: e.target.value }))} className="input resize-none" rows={2} />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => handleSubmit("journal")} disabled={submitting} className="btn-primary">
                    {submitting ? "Saving…" : "Save journal entry"}
                  </button>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-base font-semibold text-white mb-4">Recent entries</h3>
                {dashboard?.journal_entries.length ? (
                  <div className="space-y-3">
                    {dashboard.journal_entries.map((entry: TrainingJournalEntry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-white">{entry.session_date}</p>
                          <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{entry.session_type}</span>
                        </div>
                        <p className="text-sm text-slate-300">Focus: {entry.focus ?? "General training"}</p>
                        {entry.what_went_well && <p className="mt-2 text-sm text-slate-300">What went well: {entry.what_went_well}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No journal entries yet.</p>
                )}
              </div>
            </>
          )}

          {activeTab === "recovery" && (
            <>
              <div className="card p-5">
                <h3 className="text-base font-semibold text-white mb-4">Recovery check-in</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Entry date</label>
                    <input type="date" value={recoveryForm.entry_date} onChange={(e) => setRecoveryForm((prev) => ({ ...prev, entry_date: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Recovery score</label>
                    <input type="number" min={0} max={100} value={recoveryForm.recovery_score} onChange={(e) => setRecoveryForm((prev) => ({ ...prev, recovery_score: Number(e.target.value) }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Energy level</label>
                    <input type="number" min={1} max={10} value={recoveryForm.energy_level} onChange={(e) => setRecoveryForm((prev) => ({ ...prev, energy_level: Number(e.target.value) }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Sleep hours</label>
                    <input type="number" step={0.5} value={recoveryForm.sleep_hours} onChange={(e) => setRecoveryForm((prev) => ({ ...prev, sleep_hours: Number(e.target.value) }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Stress level</label>
                    <input type="number" min={1} max={10} value={recoveryForm.stress_level} onChange={(e) => setRecoveryForm((prev) => ({ ...prev, stress_level: Number(e.target.value) }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Readiness rating</label>
                    <input type="number" min={1} max={10} value={recoveryForm.readiness_rating} onChange={(e) => setRecoveryForm((prev) => ({ ...prev, readiness_rating: Number(e.target.value) }))} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Notes</label>
                    <textarea value={recoveryForm.notes} onChange={(e) => setRecoveryForm((prev) => ({ ...prev, notes: e.target.value }))} className="input resize-none" rows={3} />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => handleSubmit("recovery")} disabled={submitting} className="btn-primary">
                    {submitting ? "Saving…" : "Log recovery"}
                  </button>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-base font-semibold text-white mb-4">Recovery history</h3>
                {dashboard?.recovery_checkins.length ? (
                  <div className="space-y-3">
                    {dashboard.recovery_checkins.map((entry: RecoveryCheckin) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-white">{entry.entry_date}</p>
                          <span className="text-sm text-emerald-300">Recovery {entry.recovery_score ?? "—"}/100</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">Energy {entry.energy_level ?? "—"} • Sleep {entry.sleep_hours ?? "—"}h • Readiness {entry.readiness_rating ?? "—"}/10</p>
                        {entry.notes && <p className="mt-2 text-sm text-slate-300">{entry.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No recovery logs yet.</p>
                )}
              </div>
            </>
          )}

          {activeTab === "skills" && (
            <>
              <div className="card p-5">
                <h3 className="text-base font-semibold text-white mb-4">Skill assessment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Skill</label>
                    <input value={skillForm.skill_name} onChange={(e) => setSkillForm((prev) => ({ ...prev, skill_name: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Current level</label>
                    <select value={skillForm.current_level} onChange={(e) => setSkillForm((prev) => ({ ...prev, current_level: e.target.value }))} className="input">
                      <option value="developing">Developing</option>
                      <option value="functional">Functional</option>
                      <option value="proficient">Proficient</option>
                      <option value="elite">Elite</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label">Development goal</label>
                    <input value={skillForm.development_goal} onChange={(e) => setSkillForm((prev) => ({ ...prev, development_goal: e.target.value }))} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Coach notes</label>
                    <textarea value={skillForm.coach_notes} onChange={(e) => setSkillForm((prev) => ({ ...prev, coach_notes: e.target.value }))} className="input resize-none" rows={3} />
                  </div>
                  <div>
                    <label className="label">Video reference</label>
                    <input value={skillForm.video_reference} onChange={(e) => setSkillForm((prev) => ({ ...prev, video_reference: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Assigned drill</label>
                    <input value={skillForm.assigned_drill} onChange={(e) => setSkillForm((prev) => ({ ...prev, assigned_drill: e.target.value }))} className="input" />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => handleSubmit("skills")} disabled={submitting || !skillForm.skill_name} className="btn-primary">
                    {submitting ? "Saving…" : "Save assessment"}
                  </button>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-base font-semibold text-white mb-4">Skill tracking</h3>
                <div className="space-y-3">
                  {dashboard ? (
                    <>
                      <p className="text-sm text-slate-400">No skill assessments saved yet.</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">No skill assessments saved yet.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "competition" && (
            <>
              <div className="card p-5">
                <h3 className="text-base font-semibold text-white mb-4">Competition plan</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="label">Competition name</label>
                    <input value={competitionForm.competition_name} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, competition_name: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Competition date</label>
                    <input type="date" value={competitionForm.competition_date} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, competition_date: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Weight category</label>
                    <input value={competitionForm.weight_category} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, weight_category: e.target.value }))} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Timeline</label>
                    <textarea value={competitionForm.timeline} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, timeline: e.target.value }))} className="input resize-none" rows={3} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Milestones</label>
                    <textarea value={competitionForm.milestones} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, milestones: e.target.value }))} className="input resize-none" rows={2} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Coach checklist</label>
                    <textarea value={competitionForm.coach_checklist} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, coach_checklist: e.target.value }))} className="input resize-none" rows={2} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Equipment checklist</label>
                    <textarea value={competitionForm.equipment_checklist} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, equipment_checklist: e.target.value }))} className="input resize-none" rows={2} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Travel notes</label>
                    <textarea value={competitionForm.travel_notes} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, travel_notes: e.target.value }))} className="input resize-none" rows={2} />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => handleSubmit("competition")} disabled={submitting || !competitionForm.competition_name} className="btn-primary">
                    {submitting ? "Saving…" : "Save competition plan"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-emerald-300" />
          <p className="text-sm text-slate-300">Coach workflow is visible and organized around the athlete’s actual development plan.</p>
        </div>
      </div>
    </Layout>
  )
}
