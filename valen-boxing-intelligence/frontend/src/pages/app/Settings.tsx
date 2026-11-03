import { useEffect, useState } from "react"
import Layout from "../../components/Layout"
import apiClient from "../../api/client"
import { SkeletonBlock } from "../../components/SkeletonLoader"
import { CheckCircle2, XCircle, Info, ExternalLink, Activity } from "lucide-react"

interface HealthData { status: string; ffmpeg_available: boolean; version: string }

export default function Settings() {
  const [health, setHealth] = useState<HealthData | null>(null)

  useEffect(() => {
    apiClient.get<HealthData>("/health").then(r => setHealth(r.data)).catch(() => {})
  }, [])

  return (
    <Layout>
      <div className="px-8 py-8 max-w-2xl">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500 mb-6">System status and platform information.</p>

        {/* Status card */}
        <div className="card p-5 mb-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-4">System Status</h3>
          {!health ? (
            <div className="space-y-3">
              <SkeletonBlock className="h-5 w-48" />
              <SkeletonBlock className="h-5 w-64" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={16} className={"text-" + (health.status === "ok" ? "green" : "red") + "-500"} />
                <div>
                  <p className="text-sm font-medium text-gray-800">Backend API</p>
                  <p className="text-xs text-gray-400">{import.meta.env.VITE_API_BASE_URL || 'https://boxing-intelligence.onrender.com'} &bull; v{health.version}</p>
                </div>
                <span className={"ml-auto text-xs font-medium px-2 py-0.5 rounded-full " + (health.status === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                  {health.status === "ok" ? "Online" : "Error"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {health.ffmpeg_available
                  ? <CheckCircle2 size={16} className="text-green-500" />
                  : <XCircle size={16} className="text-yellow-500" />}
                <div>
                  <p className="text-sm font-medium text-gray-800">FFmpeg</p>
                  <p className="text-xs text-gray-400">Video metadata extraction</p>
                </div>
                <span className={"ml-auto text-xs font-medium px-2 py-0.5 rounded-full " + (health.ffmpeg_available ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700")}>
                  {health.ffmpeg_available ? "Available" : "Not installed"}
                </span>
              </div>

              {!health.ffmpeg_available && (
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-1">
                  <Info size={13} className="text-yellow-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-yellow-800">
                    FFmpeg improves metadata accuracy. Install via{" "}
                    <code className="bg-yellow-100 px-1 rounded font-mono">winget install ffmpeg</code>
                    {" "}or{" "}
                    <code className="bg-yellow-100 px-1 rounded font-mono">brew install ffmpeg</code>.
                    The app works without it using OpenCV fallback.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* About card */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Valen Boxing Intelligence</p>
              <p className="text-xs text-gray-400">Version 1.0.0</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            A product by <span className="font-semibold text-gray-900">Valen Labs</span>.
            All video analysis runs locally on your machine — no footage is sent to external services.
            Metrics are only reported when the underlying data exists. No synthetic data is ever fabricated.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <a href="https://valen.live" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:underline">
              valen.live <ExternalLink size={10} />
            </a>
            <a href="https://tasknexio.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:underline">
              tasknexio.com <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </Layout>
  )
}