/**
 * Boxer Dashboard — the main entry point for athletes.
 *
 * Answers immediately:
 *   - What should I do today?
 *   - Which feature should I use?
 *   - What can AI help me with?
 *   - How am I progressing?
 *   - What should I do next?
 *
 * Shows real data only. No placeholder charts or invented numbers.
 */
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "../../components/Layout"
import { listBoxers } from "../../api/boxers"
import { fetchAIHealth, type AIHealth } from "../../api/aiCorner"
import {
  Users, PlusCircle, ArrowRight, Brain, Upload,
  Target, CheckCircle, AlertCircle, Wifi, WifiOff, Settings,
} from "lucide-react"

// ─── Feature chooser data ───────────────────────────────────────────────────

const FEATURES = [
  {
    category: "Technical Development",
    icon: "🥊",
    color: "#f97316",
    title: "Improve my boxing technique",
    desc: "Get drill suggestions, combination coaching, and skill-gap analysis from Coach Valen.",
    aiSlug: "coach-valen",
    ctaLabel: "Open Coach Valen",
    tags: ["techniques", "combinations", "footwork", "drills"],
  },
  {
    category: "Nutrition",
    icon: "🥗",
    color: "#22c55e",
    title: "Understand my nutrition",
    desc: "Analyse your food diary, plan meals for training days, and track macros with NutriCoach.",
    aiSlug: "nutricoach",
    ctaLabel: "Open NutriCoach",
    tags: ["meals", "macros", "hydration", "weight"],
  },
  {
    category: "Recovery",
    icon: "😴",
    color: "#6366f1",
    title: "Check my recovery",
    desc: "Review sleep, fatigue and readiness trends — RecoverAI reads your actual logged check-ins.",
    aiSlug: "recoverai",
    ctaLabel: "Open RecoverAI",
    tags: ["sleep", "fatigue", "readiness", "load"],
  },
  {
    category: "Competition Prep",
    icon: "🎯",
    color: "#ef4444",
    title: "Prepare for a fight",
    desc: "Build fight preparation notebooks, set round objectives, and organise camp goals with CornerIQ.",
    aiSlug: "corneriq",
    ctaLabel: "Open CornerIQ",
    tags: ["fight", "camp", "tactics", "checklist"],
  },
  {
    category: "Video Analysis",
    icon: "📹",
    color: "#0ea5e9",
    title: "Analyse a boxing video",
    desc: "Upload footage, run the local analysis pipeline, and review results with VisionBox AI.",
    directPath: "/app/boxers",
    ctaLabel: "Select Athlete → Upload",
    tags: ["video", "punch detection", "coach notes"],
  },
  {
    category: "Strength & Conditioning",
    icon: "💪",
    color: "#f59e0b",
    title: "Build strength and conditioning",
    desc: "Review your fitness assessments and get programme draft support from PerformanceLab AI.",
    aiSlug: "performancelab",
    ctaLabel: "Open PerformanceLab AI",
    tags: ["strength", "conditioning", "fitness", "assessments"],
  },
  {
    category: "Mental Performance",
    icon: "🧠",
    color: "#a855f7",
    title: "Improve focus and confidence",
    desc: "Daily mindset check-ins, competition visualisation and confidence journaling with MindCorner.",
    aiSlug: "mindcorner",
    ctaLabel: "Open MindCorner",
    tags: ["mindset", "confidence", "focus", "routine"],
  },
  {
    category: "Learning",
    icon: "🎓",
    color: "#14b8a6",
    title: "Learn boxing",
    desc: "Structured lessons from fundamentals to ring craft, with quizzes and personalised learning paths.",
    directPath: "/app/ai-corner/learning",
    ctaLabel: "Open Learning Centre",
    tags: ["rules", "scoring", "history", "fundamentals"],
  },
  {
    category: "Progress",
    icon: "📊",
    color: "#64748b",
    title: "Review my progress",
    desc: "Track sessions, metrics, goals and achievements — Ask My Data for plain-language insights.",
    directPath: "/app/ai-corner/ask-my-data",
    ctaLabel: "Ask My Data",
    tags: ["sessions", "trends", "goals", "history"],
  },
  {
    category: "Planning",
    icon: "📅",
    color: "#84cc16",
    title: "Plan my training",
    desc: "Set AI-managed goals with milestones, track challenges, and review your weekly performance.",
    directPath: "/app/ai-corner/goals",
    ctaLabel: "Manage Goals",
    tags: ["goals", "weekly review", "challenges", "schedule"],
  },
]

// ─── Quick action data ──────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Register Athlete", icon: PlusCircle, path: "/app/boxers/new", color: "blue" },
  { label: "Browse Athletes", icon: Users, path: "/app/boxers", color: "slate" },
  { label: "Upload Video", icon: Upload, path: "/app/boxers", color: "slate" },
  { label: "AI Corner", icon: Brain, path: "/app/ai-corner", color: "orange" },
  { label: "Coach Center", icon: Target, path: "/app/coach", color: "slate" },
  { label: "Settings", icon: Settings, path: "/app/settings", color: "slate" },
]

// ─── AI Status banner ───────────────────────────────────────────────────────

function AIStatusBanner({ health }: { health: AIHealth | null }) {
  if (!health) return null

  if (health.available && health.model_installed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-green-500/20 bg-green-500/5 text-xs text-green-400">
        <Wifi size={12} />
        <span>
          AI ready — Ollama running · Model:{" "}
          <span className="font-mono">{health.model}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-orange-500/20 bg-orange-500/5 text-xs text-orange-300">
      <WifiOff size={12} className="shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold">AI offline — </span>
        {health.error || "Ollama is not reachable."}
        <div className="mt-1 text-orange-400/70 space-y-0.5">
          <div>1. Start Ollama: <code className="font-mono">ollama serve</code></div>
          {!health.model_installed && (
            <div>2. Pull model: <code className="font-mono">ollama pull {health.model}</code></div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const nav = useNavigate()
  const [totalAthletes, setTotalAthletes] = useState<number | null>(null)
  const [aiHealth, setAiHealth] = useState<AIHealth | null>(null)
  const selectedBoxer = localStorage.getItem("valen-selected-boxer")

  useEffect(() => {
    listBoxers({ page_size: 1 })
      .then((r) => setTotalAthletes(r.meta.total))
      .catch(() => setTotalAthletes(0))

    fetchAIHealth()
      .then(setAiHealth)
      .catch(() => setAiHealth({
        available: false,
        model: "unknown",
        model_installed: false,
        error: "Could not reach Ollama. Make sure it is running: ollama serve",
      }))
  }, [])

  const handleFeatureClick = (feature: typeof FEATURES[0]) => {
    if (feature.aiSlug) {
      const boxer = selectedBoxer ? `?boxer=${selectedBoxer}` : ""
      nav(`/app/ai-corner/${feature.aiSlug}${boxer}`)
    } else if (feature.directPath) {
      const boxer = selectedBoxer && feature.directPath.includes("ai-corner")
        ? `${feature.directPath}?boxer=${selectedBoxer}`
        : feature.directPath
      nav(boxer)
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-5 py-6 space-y-7">

        {/* ── Top bar: title + AI status ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Valen Boxing Intelligence</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {totalAthletes === null
                ? "Loading…"
                : totalAthletes === 0
                ? "No athletes registered yet."
                : `${totalAthletes} athlete${totalAthletes !== 1 ? "s" : ""} registered`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {aiHealth === null && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
                Checking AI…
              </div>
            )}
            {aiHealth && <AIStatusBanner health={aiHealth} />}
          </div>
        </div>

        {/* ── Quick actions ── */}
        <section>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {QUICK_ACTIONS.map(({ label, icon: Icon, path, color }) => (
              <button
                key={label}
                onClick={() => nav(path)}
                className={`
                  flex flex-col items-center gap-1.5 p-3 rounded-xl border transition text-center
                  ${color === "orange"
                    ? "border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/50"
                    : "border-slate-700/50 bg-slate-900/60 hover:bg-slate-800/60 hover:border-slate-600"}
                `}
              >
                <Icon
                  size={18}
                  className={color === "orange" ? "text-orange-400" : "text-slate-400"}
                />
                <span className={`text-[11px] font-medium leading-tight ${color === "orange" ? "text-orange-300" : "text-slate-400"}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── "What do you want to work on?" ── */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            What do you want to work on?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((feature) => {
              const aiReady = aiHealth?.available && aiHealth?.model_installed
              const needsAI = Boolean(feature.aiSlug)

              return (
                <button
                  key={feature.title}
                  onClick={() => handleFeatureClick(feature)}
                  className="group text-left rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 hover:border-slate-600 hover:bg-slate-800/60 transition-all duration-150"
                  style={{
                    borderLeftColor: `${feature.color}50`,
                    borderLeftWidth: 3,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 mt-0.5"
                      style={{ background: `${feature.color}18` }}
                    >
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-white leading-tight">
                          {feature.title}
                        </p>
                        {needsAI && !aiReady && (
                          <span className="shrink-0 text-[10px] text-orange-400 border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                            AI offline
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{feature.desc}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {feature.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] text-slate-600 px-1.5 py-0.5 rounded bg-slate-800">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-slate-600 group-hover:text-slate-300 transition mt-1"
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── AI Companions compact row ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              AI Companion Team
            </h2>
            <button
              onClick={() => nav("/app/ai-corner")}
              className="text-xs text-orange-400 hover:text-orange-300 transition flex items-center gap-1"
            >
              Open AI Corner <ArrowRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {COMPANIONS_MINI.map((c) => {
              const boxer = selectedBoxer ? `?boxer=${selectedBoxer}` : ""
              return (
                <button
                  key={c.slug}
                  onClick={() => nav(`/app/ai-corner/${c.slug}${boxer}`)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-700/40 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50 transition text-center group"
                  title={c.role}
                >
                  <span className="text-xl">{c.icon}</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-slate-200 leading-tight transition">
                    {c.shortName}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── No boxer selected notice ── */}
        {!selectedBoxer && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <AlertCircle size={15} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-200 font-medium">Select an athlete to personalise AI Corner</p>
              <p className="text-xs text-slate-400 mt-1">
                Open any athlete profile and click "AI Corner" to unlock personalised coaching, nutrition
                analysis, recovery review and more.
              </p>
              <button
                onClick={() => nav("/app/boxers")}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
              >
                Browse athletes <ArrowRight size={10} />
              </button>
            </div>
          </div>
        )}

        {/* ── Bottom row: Register + How it works ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Getting started</p>
            <div className="space-y-2">
              {[
                { label: "Register an athlete", done: (totalAthletes ?? 0) > 0, path: "/app/boxers/new" },
                { label: "Open an athlete profile → AI Corner", done: Boolean(selectedBoxer), path: "/app/boxers" },
                { label: "Chat with a companion", done: false, path: "/app/ai-corner" },
                { label: "Log your first training session", done: false, path: "/app/boxers" },
              ].map(({ label, done, path }) => (
                <button
                  key={label}
                  onClick={() => nav(path)}
                  className="w-full flex items-center gap-2.5 text-left hover:bg-slate-800/40 px-2 py-1 rounded-lg transition"
                >
                  {done
                    ? <CheckCircle size={13} className="text-green-400 shrink-0" />
                    : <div className="w-3 h-3 rounded-full border border-slate-600 shrink-0" />}
                  <span className={`text-xs ${done ? "text-slate-400 line-through" : "text-slate-200"}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">How it works</p>
            <div className="space-y-2">
              {[
                { n: "1", label: "Register athlete", sub: "Permanent VB-XXXXXX profile" },
                { n: "2", label: "Upload footage", sub: "Training or sparring video" },
                { n: "3", label: "Run analysis", sub: "Local pose estimation pipeline" },
                { n: "4", label: "Chat with AI", sub: "Context-aware companions" },
                { n: "5", label: "Review reports", sub: "PDF exports, progress charts" },
              ].map(({ n, label, sub }) => (
                <div key={n} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {n}
                  </span>
                  <div>
                    <p className="text-xs text-slate-200 leading-tight">{label}</p>
                    <p className="text-[10px] text-slate-600">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}

// ─── Static companion list for the mini grid ────────────────────────────────

const COMPANIONS_MINI = [
  { slug: "coach-valen",      icon: "🥊", shortName: "Coach",      role: "AI Boxing Coach" },
  { slug: "nutricoach",       icon: "🥗", shortName: "Nutrition",  role: "AI Nutritionist" },
  { slug: "recoverai",        icon: "😴", shortName: "Recovery",   role: "Recovery Coach" },
  { slug: "corneriq",         icon: "🎯", shortName: "Strategy",   role: "Fight Strategist" },
  { slug: "visionbox",        icon: "📹", shortName: "Video",      role: "Video Analyst" },
  { slug: "mindcorner",       icon: "🧠", shortName: "Mindset",    role: "Mental Performance" },
  { slug: "performancelab",   icon: "💪", shortName: "S&C",        role: "Strength & Conditioning" },
  { slug: "boxing-academy",   icon: "🎓", shortName: "Learning",   role: "Boxing Mentor" },
]
