import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import Layout from "../components/Layout"
import { SkeletonBlock } from "../components/SkeletonLoader"
import { getBoxer, archiveBoxer } from "../api/boxers"
import { getSessions } from "../api/progress"
import type { Boxer, TrainingSession } from "../types"
import { Upload, TrendingUp, FileText, Sword, Archive, Video, PlusCircle, ArrowLeft } from "lucide-react"

export default function AthleteProfile() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [boxer, setBoxer] = useState<Boxer | null>(null)
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([getBoxer(id), getSessions(id)])
      .then(([b, s]) => { setBoxer(b); setSessions(s.data) })
      .catch((e: unknown) => { if ((e as {code?:string}).code === "BOXER_NOT_FOUND") setNotFound(true) })
      .finally(() => setLoading(false))
  }, [id])

  const handleArchive = async () => {
    if (!id || !confirm("Archive this athlete?")) return
    await archiveBoxer(id)
    setBoxer(b => b ? { ...b, status: "archived" } : b)
  }

  if (loading) return <Layout><div className="p-8 space-y-4"><SkeletonBlock className="h-8 w-48" /><SkeletonBlock className="h-32 w-full" /></div></Layout>
  if (notFound) return <Layout><div className="p-8 text-center py-16 text-gray-500">Athlete not found. <Link to="/app/boxers" className="text-blue-600 underline">Return to directory</Link></div></Layout>
  if (!boxer) return null

  const actions = [
    { icon: Upload, label: "Upload Video", to: "/boxers/" + id + "/upload", color: "blue" },
    { icon: Sword, label: "Fight Camps", to: "/boxers/" + id + "/fight-camps", color: "indigo" },
    { icon: TrendingUp, label: "Progress", to: "/boxers/" + id + "/progress", color: "violet" },
    { icon: FileText, label: "Reports", to: "/boxers/" + id + "/reports", color: "orange" },
  ]

  return (
    <Layout>
      <div className="px-8 py-8 max-w-5xl">
        <Link to="/app/boxers" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} />Directory
        </Link>

        {/* Profile header */}
        <div className="card p-6 mb-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-blue-700 font-bold text-lg">{boxer.full_name[0]}</span>
              </div>
              <div>
                <span className="inline-block text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mb-1">
                  {boxer.permanent_id}
                </span>
                <h1 className="text-xl font-bold text-gray-900">{boxer.full_name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (boxer.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>
                    {boxer.status}
                  </span>
                  <span className="text-xs text-gray-400">{boxer.experience_level}</span>
                  {boxer.weight_class && <span className="text-xs text-gray-400">{boxer.weight_class}</span>}
                </div>
              </div>
            </div>
            <button onClick={handleArchive} disabled={boxer.status === "archived"}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors">
              <Archive size={13} />Archive
            </button>
          </div>
        </div>

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
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-gray-400 font-medium">{k}</dt>
                  <dd className="text-sm text-gray-800 mt-0.5 capitalize">{v}</dd>
                </div>
              ))}
            </dl>
            {boxer.training_goals && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <dt className="text-xs text-gray-400 font-medium mb-1">Goals</dt>
                <p className="text-sm text-gray-700 leading-relaxed">{boxer.training_goals}</p>
              </div>
            )}
          </div>

          <div className="col-span-3 card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Sessions ({sessions.length})</h3>
              <Link to={"/boxers/" + id + "/upload"} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <PlusCircle size={12} />New session
              </Link>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Video size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No sessions yet.</p>
                <button onClick={() => nav("/boxers/" + id + "/upload")} className="mt-3 btn-primary text-xs px-3 py-1.5">Upload first video</button>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.slice(0, 10).map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Video size={12} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{s.session_date}</p>
                        <p className="text-xs text-gray-400 capitalize">{s.session_type.replace("_", " ")}</p>
                      </div>
                    </div>
                    {s.rounds && <span className="text-xs text-gray-400">{s.rounds} rds</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}