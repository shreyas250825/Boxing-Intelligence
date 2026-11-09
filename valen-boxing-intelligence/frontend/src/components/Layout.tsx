/**
 * Layout — the authenticated application shell.
 *
 * Structure:
 *   <TopNav />          ← sticky, always visible
 *   <div.app-body>
 *     <aside.sidebar>   ← operational navigation only (no AI companion links)
 *     <main.main-panel> ← page content
 *   </div>
 *
 * The AI Corner is accessed exclusively from the TopNav dropdown.
 * The sidebar contains only operational and analytics workspace navigation.
 */
import { ReactNode, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PlayCircle,
  Target,
  CalendarDays,
  Dumbbell,
  Video,
  Upload,
  TrendingUp,
  Flame,
  Droplets,
  Scale,
  Moon,
  Activity,
  Trophy,
  NotebookPen,
  Sword,
  BookOpen,
  Shield,
  FileText,
  Layers,
  Cpu,
  Eye,
  AlignLeft,
  GitCompare,
  Zap,
} from 'lucide-react'
import TopNav from './TopNav'

import { type LucideIcon } from 'lucide-react'

// ─── Sidebar section configuration ───────────────────────────────────────────

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

interface NavSection {
  key: string
  title: string
  items: NavItem[]
  defaultOpen?: boolean
}

// NOTE: AI Corner is NOT in this sidebar. It lives in the TopNav dropdown.
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'workspace',
    title: 'Workspace',
    defaultOpen: true,
    items: [
      { to: '/app',              icon: LayoutDashboard,  label: 'Overview' },
      { to: '/app/boxers',       icon: Users,            label: 'Athletes' },
      { to: '/app/coach',        icon: Target,           label: 'Coach Center' },
      { to: '/app/coach/calendar',icon: CalendarDays,    label: 'Calendar' },
      { to: '/app/coach/planner', icon: Dumbbell,        label: 'Training Planner' },
      { to: '/app/boxers',       icon: Sword,            label: 'Fight Camps' },
    ],
  },
  {
    key: 'video',
    title: 'Video Intelligence',
    defaultOpen: true,
    items: [
      { to: '/app/analysis/demo', icon: PlayCircle,   label: 'Video Studio' },
      { to: '/app/boxers',        icon: Upload,        label: 'Upload Video' },
      { to: '/app/boxers',        icon: Video,         label: 'Video Library' },
      { to: '/app/boxers',        icon: Activity,      label: 'Movement Analysis' },
      { to: '/app/boxers',        icon: Cpu,           label: 'Pose & Tracking' },
      { to: '/app/boxers',        icon: AlignLeft,     label: 'Punch Timeline' },
      { to: '/app/boxers',        icon: Eye,           label: 'Technique Review' },
      { to: '/app/boxers',        icon: BookOpen,      label: 'Coach Observations' },
      { to: '/app/coach/compare', icon: GitCompare,    label: 'Video Comparison' },
    ],
  },
  {
    key: 'analytics',
    title: 'Performance Analytics',
    defaultOpen: false,
    items: [
      { to: '/app/coach',         icon: BarChart3,      label: 'Performance Dashboard' },
      { to: '/app/boxers',        icon: Zap,            label: 'Punch Analytics' },
      { to: '/app/boxers',        icon: TrendingUp,     label: 'Movement Trends' },
      { to: '/app/boxers',        icon: Layers,         label: 'Physical Assessments' },
      { to: '/app/boxers',        icon: Activity,       label: 'Training Load' },
      { to: '/app/boxers',        icon: Shield,         label: 'Conditioning' },
      { to: '/app/coach/compare', icon: GitCompare,     label: 'Progress Comparison' },
      { to: '/app/boxers',        icon: FileText,       label: 'Reports' },
    ],
  },
  {
    key: 'wellness',
    title: 'Athlete Wellness',
    defaultOpen: false,
    items: [
      { to: '/app/boxers',        icon: Flame,          label: 'Nutrition' },
      { to: '/app/boxers',        icon: BookOpen,       label: 'Food Diary' },
      { to: '/app/boxers',        icon: AlignLeft,      label: 'Meal Planner' },
      { to: '/app/boxers',        icon: Droplets,       label: 'Hydration' },
      { to: '/app/boxers',        icon: Scale,          label: 'Weight Tracking' },
      { to: '/app/boxers',        icon: Activity,       label: 'Recovery' },
      { to: '/app/boxers',        icon: Moon,           label: 'Sleep & Readiness' },
    ],
  },
  {
    key: 'management',
    title: 'Management',
    defaultOpen: false,
    items: [
      { to: '/app/boxers',        icon: Trophy,         label: 'Goals' },
      { to: '/app/boxers',        icon: NotebookPen,    label: 'Training Journal' },
      { to: '/app/boxers',        icon: Sword,          label: 'Competitions' },
      { to: '/app/boxers/new',    icon: PlusCircle,     label: 'Register Athlete' },
      { to: '/app/settings',      icon: Settings,       label: 'Settings' },
    ],
  },
]

// ─── Sidebar section component ────────────────────────────────────────────────

function SidebarSection({ section }: { section: NavSection }) {
  const location = useLocation()
  const [open, setOpen] = useState(
    section.defaultOpen ?? section.items.some((i) => location.pathname === i.to)
  )

  return (
    <div className="sidebar-section">
      <button
        className={`sidebar-section-toggle${open ? ' open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        {section.title}
        {open ? <ChevronUp size={11} className="chevron" /> : <ChevronDown size={11} className="chevron" />}
      </button>
      <div className={`sidebar-section-items${open ? ' open' : ''}`}>
        {section.items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            end={to === '/app'}
            className="nav-link"
          >
            {({ isActive }) => (
              <>
                <Icon size={14} className={isActive ? 'nav-icon active' : 'nav-icon'} />
                <span className="text-[13px]">{label}</span>
                {isActive && <ChevronRight size={10} className="nav-chevron" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

// ─── Main Layout ───────────────────────────────────────────────────────────────

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="app-shell-with-nav">
      <TopNav
        onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        mobileMenuOpen={mobileSidebarOpen}
      />

      <div className="app-body">
        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            style={{ top: 56 }}
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`sidebar-shell${mobileSidebarOpen ? ' mobile-open' : ''}`}>
          <div className="brand-block">
            <div className="brand-mark small">
              <Activity size={13} />
            </div>
            <div className="brand-copy-wrap">
              <p className="brand-title">Valen Boxing</p>
              <p className="brand-subtitle">Performance Intelligence</p>
            </div>
          </div>

          <nav className="sidebar-nav flex-1">
            {NAV_SECTIONS.map((section) => (
              <div key={section.key}>
                <SidebarSection section={section} />
                <div className="sidebar-section-divider" />
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="main-panel">{children}</main>
      </div>
    </div>
  )
}
