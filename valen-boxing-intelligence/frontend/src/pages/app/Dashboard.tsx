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
      <div className="dashboard-page">
        <section className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <span className="dashboard-badge">
              <Zap size={11} />
              Valen Labs Product
            </span>
            <h1>Boxing Intelligence Platform</h1>
            <p>
              Register athletes, upload training footage, run local video analysis, annotate sessions,
              track progress over time, and generate professional PDF reports — all in one place.
            </p>
            <div className="dashboard-actions">
              <button onClick={() => nav("/app/boxers/new")} className="btn btn-primary large">
                <PlusCircle size={15} />
                Register Athlete
              </button>
              <button onClick={() => nav("/app/boxers")} className="btn btn-secondary large">
                View Athletes
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="dashboard-hero-panel">
            <div className="panel-header-mini">
              <span className="dot red" />
              <span className="dot amber" />
              <span className="dot green" />
              <span>Session summary</span>
            </div>
            <div className="mini-summary">
              <div>
                <span>Active athletes</span>
                <strong>{total ?? 0}</strong>
              </div>
              <div>
                <span>Round review</span>
                <strong>4</strong>
              </div>
              <div>
                <span>Coach notes</span>
                <strong>11</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="stat-grid">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card">
              <div className={`stat-icon ${color}`}>
                <Icon size={17} />
              </div>
              <p>{label}</p>
              {value !== null ? <strong>{value}</strong> : <SkeletonBlock className="h-7 w-10 mt-1" />}
            </div>
          ))}
        </section>

        <section className="quick-grid">
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
            {
              title: "Nutrition & Recovery",
              desc: "Track intake, hydration and weight targets for each athlete in one practical workspace.",
              icon: Activity,
              color: "violet",
              action: () => nav("/app/boxers"),
              cta: "Open athlete workspace",
            },
            {
              title: "Coach Command Center",
              desc: "Review athlete readiness, training load and priorities across the full boxing roster.",
              icon: Activity,
              color: "violet",
              action: () => nav("/app/coach"),
              cta: "Open coach view",
            },
          ].map(({ title, desc, icon: Icon, color, action, cta }) => (
            <button key={title} onClick={action} className="quick-card">
              <div className={`quick-icon ${color}`}>
                <Icon size={20} />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <span>
                {cta}
                <ArrowRight size={12} />
              </span>
            </button>
          ))}
        </section>

        <section className="workflow-card">
          <h3>How it works</h3>
          <div className="workflow-grid">
            {[
              { step: "1", label: "Register", desc: "Create athlete profile" },
              { step: "2", label: "Upload", desc: "Add training footage" },
              { step: "3", label: "Analyse", desc: "Run local AI pipeline" },
              { step: "4", label: "Annotate", desc: "Add coach observations" },
              { step: "5", label: "Report", desc: "Download PDF report" },
            ].map(({ step, label, desc }, i) => (
              <div key={step} className="workflow-step">
                <div className="workflow-step-badge">{step}</div>
                <div>
                  <p className="workflow-label">{label}</p>
                  <p className="workflow-desc">{desc}</p>
                </div>
                {i < 4 && <div className="workflow-divider" />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  )
}