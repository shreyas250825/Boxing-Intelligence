import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../../components/Layout"
import { SkeletonBlock } from "../../components/SkeletonLoader"
import { listBoxers } from "../../api/boxers"
import { Users, PlusCircle, BarChart2, Activity, ArrowRight, Zap } from "lucide-react"

export default function Dashboard() {
  const nav = useNavigate()
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    listBoxers({ page_size: 1 }).then(r => setTotal(r.meta.total)).catch(() => setTotal(0))
  }, [])

  const stats = [
    { label: "Registered Athletes", value: total, icon: Users, color: "blue" },
    { label: "Analysis Sessions", value: null, icon: BarChart2, color: "indigo" },
    { label: "PDF Reports", value: null, icon: Activity, color: "violet" },
  ]

  return (
    <Layout>
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/15 text-white/90 text-xs font-medium px-3 py-1 rounded-full mb-4">
            <Zap size={11} />
            Valen Labs Product
          </div>
          <h1 className="text-3xl font-bold mb-2">Boxing Intelligence Platform</h1>
          <p className="text-blue-100 text-sm leading-relaxed max-w-xl">
            Register athletes, upload training footage, run local video analysis, annotate sessions, 
            track progress over time, and generate professional PDF reports — all in one place.
          </p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => nav("/app/boxers/new")}
              className="flex items-center gap-2 bg-white text-blue-700 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <PlusCircle size={15} />
              Register Athlete
            </button>
            <button
              onClick={() => nav("/app/boxers")}
              className="flex items-center gap-2 bg-white/15 text-white font-medium text-sm px-5 py-2.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              View Athletes
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
                color === "blue" ? "bg-blue-50" : color === "indigo" ? "bg-indigo-50" : "bg-violet-50"
              }`}>
                <Icon size={17} className={
                  color === "blue" ? "text-blue-600" : color === "indigo" ? "text-indigo-600" : "text-violet-600"
                } />
              </div>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              {value !== null
                ? <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
                : <SkeletonBlock className="h-7 w-10 mt-1" />
              }
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Quick Start</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              title: "Register an Athlete",
              desc: "Create a permanent athlete profile with unique BX-XXXXXX ID.",
              icon: PlusCircle,
              color: "blue",
              action: () => nav("/app/boxers/new"),
              cta: "Register now",
            },
            {
              title: "Browse Athletes",
              desc: "Search and manage your full athlete directory.",
              icon: Users,
              color: "indigo",
              action: () => nav("/app/boxers"),
              cta: "Open directory",
            },
          ].map(({ title, desc, icon: Icon, color, action, cta }) => (
            <button key={title} onClick={action}
              className="bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md rounded-xl p-5 text-left transition-all group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                color === "blue" ? "bg-blue-50" : "bg-indigo-50"
              }`}>
                <Icon size={20} className={color === "blue" ? "text-blue-600" : "text-indigo-600"} />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              <p className={`text-xs font-medium mt-3 flex items-center gap-1 ${
                color === "blue" ? "text-blue-600" : "text-indigo-600"
              }`}>
                {cta} <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </p>
            </button>
          ))}
        </div>

        {/* Workflow steps */}
        <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 text-sm mb-5">How it works</h3>
          <div className="grid grid-cols-5 gap-2">
            {[
              { step: "1", label: "Register", desc: "Create athlete profile" },
              { step: "2", label: "Upload", desc: "Add training footage" },
              { step: "3", label: "Analyse", desc: "Run local AI pipeline" },
              { step: "4", label: "Annotate", desc: "Add coach observations" },
              { step: "5", label: "Report", desc: "Download PDF report" },
            ].map(({ step, label, desc }, i) => (
              <div key={step} className="flex items-start gap-2 relative">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0">
                    {step}
                  </div>
                  {i < 4 && <div className="w-px h-full border-l border-dashed border-blue-200 mt-1 hidden lg:block" />}
                </div>
                <div className="pt-0.5">
                  <p className="text-xs font-semibold text-gray-800">{label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}