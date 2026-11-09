/**
 * TopNav — fixed top navigation bar visible on all authenticated pages.
 *
 * Left:   Logo + brand name (links to dashboard)
 * Centre: Overview · AI Corner (dropdown) · Training · Athletes · Video
 * Right:  Boxer selector · Theme toggle · User menu · Logout
 *
 * The AI Corner dropdown shows all 8 companions and key tools,
 * organised into two columns.
 */
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity,
  Brain,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
  Users,
  Video,
  Dumbbell,
  X,
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { getStoredAuth, clearStoredAuth } from '../api/auth'
import { listBoxers } from '../api/boxers'

// ─── AI Corner companion + tool list ──────────────────────────────────────────

const AI_COMPANIONS = [
  { slug: 'coach-valen',    icon: '🥊', name: 'Coach Valen',         desc: 'Technique & drills' },
  { slug: 'nutricoach',     icon: '🥗', name: 'NutriCoach',          desc: 'Food & macros' },
  { slug: 'recoverai',      icon: '😴', name: 'RecoverAI',           desc: 'Sleep & readiness' },
  { slug: 'corneriq',       icon: '🎯', name: 'CornerIQ',            desc: 'Fight strategy' },
  { slug: 'visionbox',      icon: '📹', name: 'VisionBox AI',        desc: 'Video analysis' },
  { slug: 'mindcorner',     icon: '🧠', name: 'MindCorner',          desc: 'Focus & confidence' },
  { slug: 'performancelab', icon: '💪', name: 'PerformanceLab AI',   desc: 'S&C coaching' },
  { slug: 'boxing-academy', icon: '🎓', name: 'Boxing Academy AI',   desc: 'Learn boxing' },
]

const AI_TOOLS = [
  { path: '/app/ai-corner',              icon: '🏠', name: 'AI Corner Home',  desc: 'Hub' },
  { path: '/app/ai-corner/ask-my-data',  icon: '🔍', name: 'Ask My Data',    desc: 'Query records' },
  { path: '/app/ai-corner/weekly-review',icon: '📊', name: 'Weekly Review',  desc: 'AI summary' },
  { path: '/app/ai-corner/goals',        icon: '🎯', name: 'AI Goals',       desc: 'Goal manager' },
  { path: '/app/ai-corner/challenges',   icon: '🏆', name: 'Challenges',     desc: 'Daily tasks' },
  { path: '/app/ai-corner/learning',     icon: '📚', name: 'Learning Centre',desc: 'Boxing lessons' },
  { path: '/app/ai-corner/simulator',    icon: '🥊', name: 'Simulator',      desc: 'Tactics training' },
  { path: '/app/ai-corner/memory',       icon: '🧩', name: 'AI Memory',      desc: 'Preferences' },
  { path: '/app/ai-corner/history',      icon: '💬', name: 'Conversations',  desc: 'Chat history' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoxerOption {
  id: string
  full_name: string
  permanent_id: string
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TopNavProps {
  onMobileMenuToggle?: () => void
  mobileMenuOpen?: boolean
}

export default function TopNav({ onMobileMenuToggle, mobileMenuOpen }: TopNavProps) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const session = getStoredAuth()

  const [aiOpen, setAiOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [boxerOpen, setBoxerOpen] = useState(false)
  const [boxers, setBoxers] = useState<BoxerOption[]>([])
  const [selectedBoxerName, setSelectedBoxerName] = useState<string>('')

  const aiRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const boxerRef = useRef<HTMLDivElement>(null)

  // Load boxer name for display
  useEffect(() => {
    const stored = localStorage.getItem('valen-selected-boxer')
    if (stored) {
      // Optimistically load from the list
      listBoxers({ page_size: 50 })
        .then((r) => {
          setBoxers(r.data.map((b) => ({ id: b.id, full_name: b.full_name, permanent_id: b.permanent_id })))
          const found = r.data.find((b) => b.id === stored)
          if (found) setSelectedBoxerName(found.full_name)
        })
        .catch(() => {})
    } else {
      listBoxers({ page_size: 50 })
        .then((r) => setBoxers(r.data.map((b) => ({ id: b.id, full_name: b.full_name, permanent_id: b.permanent_id }))))
        .catch(() => {})
    }
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (aiRef.current && !aiRef.current.contains(e.target as Node)) setAiOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (boxerRef.current && !boxerRef.current.contains(e.target as Node)) setBoxerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelectBoxer = (boxer: BoxerOption) => {
    localStorage.setItem('valen-selected-boxer', boxer.id)
    setSelectedBoxerName(boxer.full_name)
    setBoxerOpen(false)
  }

  const handleLogout = () => {
    clearStoredAuth()
    localStorage.removeItem('valen-selected-boxer')
    navigate('/login', { replace: true })
  }

  const selectedBoxerId = localStorage.getItem('valen-selected-boxer') || ''
  const initials = selectedBoxerName
    ? selectedBoxerName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  const userInitials = session?.user?.full_name
    ? session.user.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className="topnav">
      {/* Left: Brand */}
      <div className="topnav-left">
        {/* Mobile menu toggle */}
        <button
          className="topnav-icon-btn md:hidden"
          onClick={onMobileMenuToggle}
          aria-label="Toggle sidebar"
        >
          {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <button
          onClick={() => navigate('/app')}
          className="flex items-center gap-2 bg-transparent border-0 cursor-pointer group"
          aria-label="Go to dashboard"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center shadow-md">
            <Activity size={14} className="text-white" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span
              className="text-[13px] font-bold tracking-tight"
              style={{ color: 'var(--color-text-strong)' }}
            >
              Valen Boxing
            </span>
            <span
              className="text-[9px] uppercase tracking-[0.12em]"
              style={{ color: 'var(--color-text-faint)' }}
            >
              Intelligence
            </span>
          </div>
        </button>
      </div>

      {/* Centre: Primary nav */}
      <nav className="topnav-centre">
        <NavLink
          to="/app"
          end
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          <LayoutDashboard size={13} />
          Overview
        </NavLink>

        {/* AI Corner dropdown */}
        <div className="ai-corner-dropdown" ref={aiRef}>
          <button
            className={`topnav-link${aiOpen ? ' active' : ''}`}
            onClick={() => setAiOpen(!aiOpen)}
            aria-expanded={aiOpen}
          >
            <Brain size={13} />
            AI Corner
            {aiOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {aiOpen && (
            <div className="ai-corner-panel">
              <div className="flex items-center gap-2 mb-3 pb-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <Brain size={14} className="text-orange-400" />
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-strong)' }}>AI Corner</span>
                <button
                  onClick={() => { navigate('/app/ai-corner'); setAiOpen(false) }}
                  className="ml-auto text-xs"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Open Hub →
                </button>
              </div>

              {/* Companions */}
              <p
                className="text-[10px] uppercase tracking-[0.12em] mb-1.5 px-1"
                style={{ color: 'var(--color-text-faint)' }}
              >
                Companions
              </p>
              <div className="ai-corner-panel-grid mb-3">
                {AI_COMPANIONS.map((c) => {
                  const boxer = selectedBoxerId ? `?boxer=${selectedBoxerId}` : ''
                  return (
                    <button
                      key={c.slug}
                      className="ai-corner-panel-item"
                      onClick={() => {
                        navigate(`/app/ai-corner/${c.slug}${boxer}`)
                        setAiOpen(false)
                      }}
                    >
                      <span className="item-icon">{c.icon}</span>
                      <span className="item-name">{c.name}</span>
                      <span className="item-desc">{c.desc}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tools */}
              <p
                className="text-[10px] uppercase tracking-[0.12em] mb-1.5 px-1"
                style={{ color: 'var(--color-text-faint)', borderTop: '1px solid var(--color-border)', paddingTop: '10px', marginTop: '2px' }}
              >
                Tools
              </p>
              <div className="ai-corner-panel-grid">
                {AI_TOOLS.map((t) => {
                  const path = selectedBoxerId && t.path !== '/app/ai-corner'
                    ? `${t.path}?boxer=${selectedBoxerId}`
                    : t.path
                  return (
                    <button
                      key={t.path}
                      className="ai-corner-panel-item"
                      onClick={() => {
                        navigate(path)
                        setAiOpen(false)
                      }}
                    >
                      <span className="item-icon">{t.icon}</span>
                      <span className="item-name">{t.name}</span>
                      <span className="item-desc">{t.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <NavLink
          to="/app/coach"
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          <Dumbbell size={13} />
          Training
        </NavLink>

        <NavLink
          to="/app/boxers"
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          <Users size={13} />
          Athletes
        </NavLink>

        <NavLink
          to="/app/analysis/demo"
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          <Video size={13} />
          Video
        </NavLink>
      </nav>

      {/* Right: Controls */}
      <div className="topnav-right">
        {/* Boxer selector */}
        <div className="relative hidden sm:block" ref={boxerRef}>
          <button
            className="boxer-selector"
            onClick={() => setBoxerOpen(!boxerOpen)}
            title={selectedBoxerName || 'Select a boxer'}
          >
            <div className="avatar">{initials}</div>
            <span className="truncate text-[12px]">
              {selectedBoxerName || 'Select boxer'}
            </span>
            <ChevronDown size={11} className="shrink-0 opacity-60" />
          </button>

          {boxerOpen && (
            <div
              className="absolute right-0 mt-2 min-w-[200px] max-h-64 overflow-y-auto rounded-xl border shadow-xl py-1"
              style={{
                top: '100%',
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-strong)',
                zIndex: 'var(--z-dropdown)',
              }}
            >
              {boxers.length === 0 ? (
                <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  No athletes yet
                </div>
              ) : (
                boxers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBoxer(b)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition
                      ${b.id === selectedBoxerId ? 'font-semibold' : ''}`}
                    style={{
                      color: 'var(--color-text)',
                      background: b.id === selectedBoxerId ? 'var(--color-accent-soft)' : 'transparent',
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ background: 'var(--color-accent)' }}
                    >
                      {b.full_name[0]?.toUpperCase()}
                    </div>
                    <span className="truncate">{b.full_name}</span>
                    <span className="ml-auto font-mono text-[10px] shrink-0" style={{ color: 'var(--color-text-faint)' }}>
                      {b.permanent_id}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          className="topnav-icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* User profile menu */}
        <div className="relative" ref={profileRef}>
          <button
            className="topnav-icon-btn"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label="User menu"
            aria-expanded={profileOpen}
          >
            <span className="text-[11px] font-bold">{userInitials}</span>
          </button>

          {profileOpen && (
            <div className="profile-menu" style={{ minWidth: 190 }}>
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-strong)' }}>
                  {session?.user?.full_name || 'User'}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {session?.user?.email || ''}
                </p>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-faint)' }}>
                  {session?.user?.role || ''}
                </p>
              </div>
              <button
                className="profile-menu-item"
                onClick={() => { navigate('/app/settings'); setProfileOpen(false) }}
              >
                <User size={13} /> Settings
              </button>
              <button
                className="profile-menu-item danger"
                onClick={handleLogout}
              >
                <LogOut size={13} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
