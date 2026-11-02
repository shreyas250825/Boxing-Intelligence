import { useEffect, useMemo, useState } from "react"
import { ArrowRight, BarChart3, CalendarClock, Flame, ShieldCheck, Target, TrendingUp, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { listBoxers } from "../../api/boxers"
import { getSessions } from "../../api/progress"
import Layout from "../../components/Layout"
import type { BoxerListItem, TrainingSession } from "../../types"

export default function CoachCommandCenter() {
  const [athletes, setAthletes] = useState<BoxerListItem[]>([])
  const [sessionMap, setSessionMap] = useState<Record<string, TrainingSession[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listBoxers({ page_size: 50 })
      .then((result) => {
        setAthletes(result.data)
        return Promise.all(
          result.data.map(async (athlete) => {
            const sessions = await getSessions(athlete.id, { page_size: 5 })
            return [athlete.id, sessions.data] as const
          }),
        )
      })
      .then((entries) => {
        const nextMap = Object.fromEntries(entries)
        setSessionMap(nextMap)
      })
      .finally(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const totalAthletes = athletes.length
    const totalSessions = Object.values(sessionMap).reduce((sum, list) => sum + list.length, 0)
    const active = athletes.filter((athlete) => athlete.status === "active").length
    const priority = athletes.slice(0, 3)

    return {
      totalAthletes,
      totalSessions,
      active,
      priority,
    }
  }, [athletes, sessionMap])

  const roster = useMemo(() =>
    athletes.map((athlete) => {
      const latest = sessionMap[athlete.id]?.[0]
      const recentSessions = sessionMap[athlete.id]?.length ?? 0
      return {
        id: athlete.id,
        name: athlete.full_name,
        weightClass: athlete.weight_class ?? "Unassigned",
        coach: athlete.primary_coach ?? "Unassigned",
        sessions: recentSessions,
        lastSession: latest?.session_date ?? "No session yet",
        status: athlete.status,
      }
    }), [athletes, sessionMap])

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-orange-300">Coach command center</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Boxing performance workspace</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/app/coach/calendar" className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-white">
              Session calendar <ArrowRight size={14} />
            </Link>
            <Link to="/app/coach/planner" className="inline-flex items-center gap-2 text-sm text-emerald-200 hover:text-white">
              Camp planner <ArrowRight size={14} />
            </Link>
            <Link to="/app/coach/compare" className="inline-flex items-center gap-2 text-sm text-orange-200 hover:text-white">
              Performance compare <ArrowRight size={14} />
            </Link>
            <Link to="/app/boxers" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              Open athlete directory <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Athletes", value: summary.totalAthletes, icon: Users, tone: "blue" },
            { label: "Sessions logged", value: summary.totalSessions, icon: BarChart3, tone: "orange" },
            { label: "Active roster", value: summary.active, icon: ShieldCheck, tone: "green" },
            { label: "Priority list", value: summary.priority.length, icon: Target, tone: "violet" },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <Icon size={16} className={tone === "blue" ? "text-blue-300" : tone === "orange" ? "text-orange-300" : tone === "green" ? "text-emerald-300" : "text-violet-300"} />
              </div>
              <p className="mt-4 text-2xl font-semibold text-white">{loading ? "—" : value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Readiness board</h2>
              <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Live roster</span>
            </div>
            <div className="space-y-3">
              {roster.length === 0 ? (
                <p className="text-sm text-slate-400">No athletes in the roster yet.</p>
              ) : (
                roster.map((athlete) => (
                  <div key={athlete.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{athlete.name}</p>
                        <p className="text-xs text-slate-400">{athlete.weightClass} · {athlete.coach}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${athlete.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
                        {athlete.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                      <span>{athlete.sessions} recent sessions</span>
                      <span>{athlete.lastSession}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-base font-semibold text-white mb-4">Coach briefing</h2>
            <div className="space-y-3">
              {[
                { title: "Camp block review", detail: "Confirm training load, recovery and technical priorities for the next 7 days.", icon: CalendarClock },
                { title: "Nutrition adherence", detail: "Check bodyweight trend and meal timing consistency for the next fight block.", icon: Flame },
                { title: "Performance trend", detail: "Review technical markers, output, and readiness against the current camp goal.", icon: TrendingUp },
              ].map(({ title, detail, icon: Icon }) => (
                <div key={title} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-orange-500/10 p-2 text-orange-300">
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="font-medium text-white">{title}</p>
                      <p className="mt-1 text-sm text-slate-400">{detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
