import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, CalendarDays, Clock3, Target, Users } from "lucide-react"

import { listBoxers } from "../../api/boxers"
import { getSessions } from "../../api/progress"
import Layout from "../../components/Layout"
import type { BoxerListItem } from "../../types"

interface CalendarEntry {
  date: string
  athleteName: string
  athleteId: string
  sessionType: string
  sessionDate: string
  rounds: number | null
  objective: string
}

export default function TrainingCalendar() {
  const [athletes, setAthletes] = useState<BoxerListItem[]>([])
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    listBoxers({ page_size: 50 })
      .then(async (result) => {
        if (!active) return
        setAthletes(result.data)

        const sessionCollections = await Promise.all(
          result.data.map(async (athlete) => {
            const sessions = await getSessions(athlete.id, { page_size: 20 })
            return sessions.data.map((session) => ({
              date: session.session_date,
              athleteName: athlete.full_name,
              athleteId: athlete.id,
              sessionType: session.session_type,
              sessionDate: session.session_date,
              rounds: session.rounds,
              objective: session.objectives || "Coach plan in progress",
            }))
          }),
        )

        const combined = sessionCollections.flat().sort((a, b) => a.date.localeCompare(b.date))
        setEntries(combined)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const summary = useMemo(() => {
    const uniqueDates = new Set(entries.map((entry) => entry.date))
    const uniqueAthletes = new Set(entries.map((entry) => entry.athleteId)).size
    return {
      totalSessions: entries.length,
      totalDates: uniqueDates.size,
      activeAthletes: athletes.length > 0 ? uniqueAthletes || athletes.length : 0,
    }
  }, [athletes.length, entries])

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    entries.forEach((entry) => {
      const list = map.get(entry.date) ?? []
      list.push(entry)
      map.set(entry.date, list)
    })

    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => ({
      date,
      items: items.sort((a, b) => a.athleteName.localeCompare(b.athleteName)),
    }))
  }, [entries])

  return (
    <Layout>
      <div className="px-8 py-8 max-w-6xl">
        <Link to="/app/coach" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
          <ArrowLeft size={14} /> Back to coach center
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-orange-300">Training calendar</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Academy session plan</h1>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Sessions", value: summary.totalSessions, icon: Target },
            { label: "Days planned", value: summary.totalDates, icon: CalendarDays },
            { label: "Athletes active", value: summary.activeAthletes, icon: Users },
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

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock3 size={14} className="text-orange-300" />
            <h2 className="text-base font-semibold text-white">Session timeline</h2>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading training schedule…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-slate-400">No session data is available yet. Upload and analyse footage to build the academy timeline.</p>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ date, items }) => (
                <div key={date} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{items.length} session{items.length === 1 ? "" : "s"}</span>
                  </div>

                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={`${item.athleteId}-${item.sessionDate}-${item.sessionType}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{item.athleteName}</p>
                            <p className="text-xs text-slate-400">{item.sessionType}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-orange-300 uppercase tracking-[0.12em]">{item.rounds ?? "—"} rounds</p>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">{item.objective}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
