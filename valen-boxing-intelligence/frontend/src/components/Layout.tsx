import { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import {
  LayoutDashboard, Users, PlusCircle, Settings,
  Activity, ChevronRight
} from "lucide-react"

const navItems = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/boxers", icon: Users, label: "Athletes" },
  { to: "/app/boxers/new", icon: PlusCircle, label: "Register Athlete" },
  { to: "/app/settings", icon: Settings, label: "Settings" },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col fixed top-0 left-0 h-full z-10">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Activity size={14} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">Valen Boxing</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Intelligence Platform</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={13} className="text-blue-400" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-700 text-[10px] font-bold">VL</span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700">Valen Labs</p>
              <p className="text-[10px] text-gray-400">valen.live</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}