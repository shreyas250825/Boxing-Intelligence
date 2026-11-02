import { ReactNode, useState } from "react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  Settings,
  Activity,
  ChevronRight,
  LogOut,
  BarChart3,
  PlayCircle,
  Target,
  CalendarDays,
  Dumbbell,
  Brain,
  BookOpen,
  Trophy,
  Search,
  Zap,
  ChevronDown,
  ChevronUp,
  Salad,
  Moon,
  Camera,
  Heart,
  GraduationCap,
  MessageSquare,
} from "lucide-react"

const mainNavItems = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/coach", icon: Target, label: "Coach Center" },
  { to: "/app/coach/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/app/coach/planner", icon: Dumbbell, label: "Planner" },
  { to: "/app/coach/compare", icon: BarChart3, label: "Compare" },
  { to: "/app/boxers", icon: Users, label: "Athletes" },
  { to: "/app/analysis/demo", icon: PlayCircle, label: "Video Analysis" },
  { to: "/app/boxers/new", icon: PlusCircle, label: "Register Athlete" },
  { to: "/app/settings", icon: Settings, label: "Settings" },
]

const aiCompanionItems = [
  { to: "/app/ai-corner/coach-valen", icon: Dumbbell, label: "Coach Valen" },
  { to: "/app/ai-corner/nutricoach", icon: Salad, label: "NutriCoach" },
  { to: "/app/ai-corner/recoverai", icon: Moon, label: "RecoverAI" },
  { to: "/app/ai-corner/corneriq", icon: Target, label: "CornerIQ" },
  { to: "/app/ai-corner/visionbox", icon: Camera, label: "VisionBox AI" },
  { to: "/app/ai-corner/mindcorner", icon: Heart, label: "MindCorner" },
  { to: "/app/ai-corner/performancelab", icon: Zap, label: "PerformanceLab AI" },
  { to: "/app/ai-corner/boxing-academy", icon: GraduationCap, label: "Boxing Academy AI" },
]

const aiToolItems = [
  { to: "/app/ai-corner/ask-my-data", icon: Search, label: "Ask My Data" },
  { to: "/app/ai-corner/weekly-review", icon: BarChart3, label: "AI Weekly Review" },
  { to: "/app/ai-corner/memory", icon: Brain, label: "AI Memory" },
  { to: "/app/ai-corner/goals", icon: Trophy, label: "AI Goals" },
  { to: "/app/ai-corner/challenges", icon: Zap, label: "AI Challenges" },
  { to: "/app/ai-corner/learning", icon: BookOpen, label: "Learning Centre" },
  { to: "/app/ai-corner/simulator", icon: Zap, label: "Boxing Simulator" },
  { to: "/app/ai-corner/history", icon: MessageSquare, label: "Conversation History" },
]

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [aiExpanded, setAiExpanded] = useState(location.pathname.startsWith("/app/ai-corner"))

  const handleLogout = () => {
    localStorage.removeItem("valen-auth")
    navigate("/login", { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar-shell">
        <div className="brand-block">
          <div className="brand-mark small">
            <Activity size={14} />
          </div>
          <div className="brand-copy-wrap">
            <p className="brand-title">Valen Boxing</p>
            <p className="brand-subtitle">Performance Intelligence</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* Main nav items */}
          {mainNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/app"} className="nav-link">
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? "nav-icon active" : "nav-icon"} />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={12} className="nav-chevron" />}
                </>
              )}
            </NavLink>
          ))}

          {/* AI Corner section */}
          <div className="mt-3 mb-1">
            <button
              onClick={() => setAiExpanded(!aiExpanded)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition"
            >
              <Brain size={14} className="text-orange-400" />
              <span className="flex-1 text-left uppercase tracking-wider">AI Corner</span>
              {aiExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {aiExpanded && (
            <>
              <NavLink to="/app/ai-corner" end className="nav-link">
                {({ isActive }) => (
                  <>
                    <Brain size={16} className={isActive ? "nav-icon active" : "nav-icon"} />
                    <span>AI Corner Home</span>
                    {isActive && <ChevronRight size={12} className="nav-chevron" />}
                  </>
                )}
              </NavLink>

              <div className="px-3 py-1">
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Companions</p>
              </div>

              {aiCompanionItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className="nav-link pl-5">
                  {({ isActive }) => (
                    <>
                      <Icon size={14} className={isActive ? "nav-icon active" : "nav-icon"} />
                      <span className="text-[13px]">{label}</span>
                      {isActive && <ChevronRight size={11} className="nav-chevron" />}
                    </>
                  )}
                </NavLink>
              ))}

              <div className="px-3 py-1 mt-1">
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Tools</p>
              </div>

              {aiToolItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className="nav-link pl-5">
                  {({ isActive }) => (
                    <>
                      <Icon size={14} className={isActive ? "nav-icon active" : "nav-icon"} />
                      <span className="text-[13px]">{label}</span>
                      {isActive && <ChevronRight size={11} className="nav-chevron" />}
                    </>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-metrics">
            <div className="metric-badge">
              <BarChart3 size={12} />
            </div>
            <div>
              <p className="metric-title">Valen Labs</p>
              <p className="metric-subtitle">Operational analytics</p>
            </div>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      <main className="main-panel">{children}</main>
    </div>
  )
}
