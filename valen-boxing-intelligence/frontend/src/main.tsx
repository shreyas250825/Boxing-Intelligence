import React, { Component, ReactNode } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom"
import "./index.css"

import { getStoredAuth } from "./api/auth"
import LandingPage from "./pages/LandingPage"
import LoginPage from "./pages/auth/LoginPage"
import RegisterPage from "./pages/auth/RegisterPage"
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage"
import ResetPasswordPage from "./pages/auth/ResetPasswordPage"
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
import DevelopmentWorkspace from "./pages/app/DevelopmentWorkspace"
import NutritionWorkspace from "./pages/app/NutritionWorkspace"
import CoachCommandCenter from "./pages/app/CoachCommandCenter"
import PerformanceComparison from "./pages/app/PerformanceComparison"
import TrainingCalendar from "./pages/app/TrainingCalendar"
import CampPlanner from "./pages/app/CampPlanner"

// AI Corner pages
import AICornerHome from "./pages/app/ai-corner/AICornerHome"
import CompanionChat from "./pages/app/ai-corner/CompanionChat"
import AIGoals from "./pages/app/ai-corner/AIGoals"
import AIMemoryPage from "./pages/app/ai-corner/AIMemory"
import LearningCentre from "./pages/app/ai-corner/LearningCentre"
import AskMyData from "./pages/app/ai-corner/AskMyData"
import BoxingSimulator from "./pages/app/ai-corner/BoxingSimulator"
import WeeklyReview from "./pages/app/ai-corner/WeeklyReview"
import AIChallenges from "./pages/app/ai-corner/AIChallenges"
import ConversationHistory from "./pages/app/ai-corner/ConversationHistory"

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const session = getStoredAuth()

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

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
          <Route path="/" element={getStoredAuth() ? <Navigate to="/app" replace /> : <LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/app" element={<RequireAuth><AppDashboard /></RequireAuth>} />
          <Route path="/app/boxers" element={<RequireAuth><BoxerDirectory /></RequireAuth>} />
          <Route path="/app/boxers/new" element={<RequireAuth><RegisterBoxer /></RequireAuth>} />
          <Route path="/app/boxers/:id" element={<RequireAuth><AthleteProfile /></RequireAuth>} />
          <Route path="/app/coach" element={<RequireAuth><CoachCommandCenter /></RequireAuth>} />
          <Route path="/app/coach/compare" element={<RequireAuth><PerformanceComparison /></RequireAuth>} />
          <Route path="/app/coach/calendar" element={<RequireAuth><TrainingCalendar /></RequireAuth>} />
          <Route path="/app/coach/planner" element={<RequireAuth><CampPlanner /></RequireAuth>} />
          <Route path="/app/boxers/:id/camps" element={<RequireAuth><FightCampManagement /></RequireAuth>} />
          <Route path="/app/boxers/:id/nutrition" element={<RequireAuth><NutritionWorkspace /></RequireAuth>} />
          <Route path="/app/boxers/:id/development" element={<RequireAuth><DevelopmentWorkspace /></RequireAuth>} />
          <Route path="/app/boxers/:id/upload" element={<RequireAuth><VideoUpload /></RequireAuth>} />
          <Route path="/app/analysis/:videoId" element={<RequireAuth><VideoAnalysisWorkspace /></RequireAuth>} />
          <Route path="/app/boxers/:id/progress" element={<RequireAuth><ProgressTracking /></RequireAuth>} />
          <Route path="/app/boxers/:id/reports" element={<RequireAuth><Reports /></RequireAuth>} />
          <Route path="/app/settings" element={<RequireAuth><AppSettings /></RequireAuth>} />

          {/* AI Corner — specific routes MUST come before the :slug catch-all */}
          <Route path="/app/ai-corner" element={<RequireAuth><AICornerHome /></RequireAuth>} />
          <Route path="/app/ai-corner/goals" element={<RequireAuth><AIGoals /></RequireAuth>} />
          <Route path="/app/ai-corner/memory" element={<RequireAuth><AIMemoryPage /></RequireAuth>} />
          <Route path="/app/ai-corner/learning" element={<RequireAuth><LearningCentre /></RequireAuth>} />
          <Route path="/app/ai-corner/ask-my-data" element={<RequireAuth><AskMyData /></RequireAuth>} />
          <Route path="/app/ai-corner/simulator" element={<RequireAuth><BoxingSimulator /></RequireAuth>} />
          <Route path="/app/ai-corner/weekly-review" element={<RequireAuth><WeeklyReview /></RequireAuth>} />
          <Route path="/app/ai-corner/challenges" element={<RequireAuth><AIChallenges /></RequireAuth>} />
          <Route path="/app/ai-corner/history" element={<RequireAuth><ConversationHistory /></RequireAuth>} />
          {/* Companion chat — :slug must come LAST among /app/ai-corner/* routes */}
          <Route path="/app/ai-corner/:slug" element={<RequireAuth><CompanionChat /></RequireAuth>} />
          <Route path="/app/ai-corner/challenges" element={<RequireAuth><AIChallenges /></RequireAuth>} />
          <Route path="/app/ai-corner/history" element={<RequireAuth><ConversationHistory /></RequireAuth>} />
          <Route path="/boxers" element={<Navigate to="/app/boxers" replace />} />
          <Route path="/boxers/new" element={<Navigate to="/app/boxers/new" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
          <Route path="/boxers/:id/upload" element={<BoxerSubRedirect sub="upload" />} />
          <Route path="/boxers/:id/camps" element={<BoxerSubRedirect sub="camps" />} />
          <Route path="/boxers/:id/nutrition" element={<BoxerSubRedirect sub="nutrition" />} />
          <Route path="/boxers/:id/development" element={<BoxerSubRedirect sub="development" />} />
          <Route path="/boxers/:id/fight-camps" element={<BoxerSubRedirect sub="camps" />} />
          <Route path="/boxers/:id/progress" element={<BoxerSubRedirect sub="progress" />} />
          <Route path="/boxers/:id/reports" element={<BoxerSubRedirect sub="reports" />} />
          <Route path="/boxers/:id" element={<BoxerRedirect />} />

          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)