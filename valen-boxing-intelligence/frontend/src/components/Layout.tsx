import { ReactNode } from "react"
import { NavLink, useNavigate } from "react-router-dom"
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
} from "lucide-react"

const navItems = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/boxers", icon: Users, label: "Athletes" },
  { to: "/app/analysis/demo", icon: PlayCircle, label: "Video Analysis" },
  { to: "/app/boxers/new", icon: PlusCircle, label: "Register Athlete" },
  { to: "/app/settings", icon: Settings, label: "Settings" },
]

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

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
          {navItems.map(({ to, icon: Icon, label }) => (
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