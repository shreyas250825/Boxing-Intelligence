import React, { Component, ReactNode } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom"
import "./index.css"

import LandingPage from "./pages/LandingPage"
import AppDashboard from "./pages/app/Dashboard"
import BoxerDirectory from "./pages/app/BoxerDirectory"
import RegisterBoxer from "./pages/app/RegisterBoxer"
import AthleteProfile from "./pages/app/AthleteProfile"
import FightCampManagement from "./pages/app/FightCampManagement"
import VideoUpload from "./pages/app/VideoUpload"
import VideoAnalysisWorkspace from "./pages/app/VideoAnalysisWorkspace"
import ProgressTracking from "./pages/app/ProgressTracking"
import Reports from "./pages/app/Reports"
import AppSettings from "./pages/app/Settings"

// Dynamic redirect: /boxers/:id -> /app/boxers/:id
function BoxerRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/app/boxers/${id}`} replace />
}

// Dynamic redirect: /boxers/:id/:sub -> /app/boxers/:id/:sub
function BoxerSubRedirect({ sub }: { sub: string }) {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/app/boxers/${id}/${sub}`} replace />
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, background: "#fff", color: "#dc2626", fontFamily: "Inter, sans-serif", minHeight: "100vh" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Something went wrong</h2>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#fef2f2", padding: 16, borderRadius: 8 }}>
          {this.state.error}
        </pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: 16, background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Reload
        </button>
      </div>
    )
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* ── Public ──────────────────────────────────────── */}
          <Route path="/" element={<LandingPage />} />

          {/* ── App ─────────────────────────────────────────── */}
          <Route path="/app" element={<AppDashboard />} />
          <Route path="/app/boxers" element={<BoxerDirectory />} />
          <Route path="/app/boxers/new" element={<RegisterBoxer />} />
          <Route path="/app/boxers/:id" element={<AthleteProfile />} />
          <Route path="/app/boxers/:id/camps" element={<FightCampManagement />} />
          <Route path="/app/boxers/:id/upload" element={<VideoUpload />} />
          <Route path="/app/analysis/:videoId" element={<VideoAnalysisWorkspace />} />
          <Route path="/app/boxers/:id/progress" element={<ProgressTracking />} />
          <Route path="/app/boxers/:id/reports" element={<Reports />} />
          <Route path="/app/settings" element={<AppSettings />} />

          {/* ── Backwards-compat redirects ───────────────────── */}
          {/* Static redirects */}
          <Route path="/boxers" element={<Navigate to="/app/boxers" replace />} />
          <Route path="/boxers/new" element={<Navigate to="/app/boxers/new" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

          {/* Dynamic redirects — old /boxers/:id/* routes */}
          <Route path="/boxers/:id/upload" element={<BoxerSubRedirect sub="upload" />} />
          <Route path="/boxers/:id/camps" element={<BoxerSubRedirect sub="camps" />} />
          <Route path="/boxers/:id/fight-camps" element={<BoxerSubRedirect sub="camps" />} />
          <Route path="/boxers/:id/progress" element={<BoxerSubRedirect sub="progress" />} />
          <Route path="/boxers/:id/reports" element={<BoxerSubRedirect sub="reports" />} />
          <Route path="/boxers/:id" element={<BoxerRedirect />} />

          {/* Catch-all → app dashboard (not landing page) */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)