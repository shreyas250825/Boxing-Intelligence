import { useEffect, useState } from "react"
import Layout from "../../components/Layout"
import apiClient from "../../api/client"
import { SkeletonBlock } from "../../components/SkeletonLoader"
import { CheckCircle2, XCircle, Info, ExternalLink, Activity, WifiOff } from "lucide-react"

interface HealthData {
  status: string
  ffmpeg_available: boolean
  version: string
  ai?: { available: boolean; model: string; model_installed: boolean; error: string | null }
}

export default function Settings() {
  const [health, setHealth] = useState<HealthData | null>(null)

  useEffect(() => {
    apiClient.get<HealthData>("/health").then((r) => setHealth(r.data)).catch(() => {})
  }, [])

  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

  return (
    <Layout>
      <div className="px-6 py-6 max-w-2xl mx-auto">
        <div className="page-header">
          <div>
            <h1>Settings</h1>
            <p>System status and platform information.</p>
          </div>
        </div>

        {/* System Status */}
        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-strong)' }}>
            System Status
          </h3>

          {!health ? (
            <div className="space-y-3">
              <SkeletonBlock className="h-5 w-48" />
              <SkeletonBlock className="h-5 w-64" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Backend API */}
              <StatusRow
                ok={health.status === "ok"}
                title="Backend API"
                detail={`${apiBase} · v${health.version}`}
                badge={health.status === "ok" ? "Online" : "Error"}
              />

              {/* FFmpeg */}
              <StatusRow
                ok={health.ffmpeg_available}
                warn={!health.ffmpeg_available}
                title="FFmpeg"
                detail="Video metadata extraction"
                badge={health.ffmpeg_available ? "Available" : "Not installed"}
              />

              {!health.ffmpeg_available && (
                <div
                  className="flex items-start gap-2 rounded-xl border px-3 py-2.5"
                  style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.2)', color: 'var(--color-warning)' }}
                >
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    FFmpeg improves metadata accuracy. Install via{" "}
                    <code className="px-1 rounded font-mono" style={{ background: 'rgba(251,191,36,0.15)' }}>winget install ffmpeg</code>
                    {" "}or{" "}
                    <code className="px-1 rounded font-mono" style={{ background: 'rgba(251,191,36,0.15)' }}>brew install ffmpeg</code>.
                    The app uses OpenCV as a fallback.
                  </p>
                </div>
              )}

              {/* Ollama / AI */}
              {health.ai && (
                <StatusRow
                  ok={health.ai.available && health.ai.model_installed}
                  warn={health.ai.available && !health.ai.model_installed}
                  title={`AI Corner (Ollama · ${health.ai.model})`}
                  detail={health.ai.error || "Local AI service"}
                  badge={
                    !health.ai.available
                      ? "Offline"
                      : !health.ai.model_installed
                      ? "Model not installed"
                      : "Ready"
                  }
                />
              )}

              {health.ai && !health.ai.available && (
                <div
                  className="flex items-start gap-2 rounded-xl border px-3 py-2.5"
                  style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--color-danger)' }}
                >
                  <WifiOff size={13} className="shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold">Ollama is not running</p>
                    <p>1. Install Ollama: <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="underline">ollama.com/download</a></p>
                    <p>2. Pull a model: <code className="font-mono">ollama pull llama3:latest</code></p>
                    <p>3. Start it: <code className="font-mono">ollama serve</code></p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* About */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}
            >
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold" style={{ color: 'var(--color-text-strong)' }}>
                Valen Boxing Intelligence
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Version 2.0.0
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-text-muted)' }}>
            A product by{" "}
            <span className="font-semibold" style={{ color: 'var(--color-text-strong)' }}>Valen Labs</span>.
            All video analysis and AI processing runs locally — no footage or athlete data is sent to
            external services. Metrics are only reported when underlying data exists.
            No synthetic data is ever fabricated.
          </p>

          <div className="flex items-center gap-4 text-xs">
            <a
              href="https://valen.live"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition"
              style={{ color: 'var(--color-accent)' }}
            >
              valen.live <ExternalLink size={10} />
            </a>
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition"
              style={{ color: 'var(--color-accent)' }}
            >
              Powered by Ollama <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function StatusRow({
  ok, warn, title, detail, badge,
}: {
  ok: boolean
  warn?: boolean
  title: string
  detail: string
  badge: string
}) {
  const iconColor = ok
    ? 'var(--color-success)'
    : warn
    ? 'var(--color-warning)'
    : 'var(--color-danger)'
  const badgeBg = ok
    ? 'rgba(52,211,153,0.10)'
    : warn
    ? 'rgba(251,191,36,0.10)'
    : 'rgba(248,113,113,0.10)'
  const badgeColor = ok
    ? 'var(--color-success)'
    : warn
    ? 'var(--color-warning)'
    : 'var(--color-danger)'

  return (
    <div className="flex items-center gap-3">
      {ok
        ? <CheckCircle2 size={15} style={{ color: iconColor, flexShrink: 0 }} />
        : <XCircle size={15} style={{ color: iconColor, flexShrink: 0 }} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-strong)' }}>{title}</p>
        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{detail}</p>
      </div>
      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{ background: badgeBg, color: badgeColor }}
      >
        {badge}
      </span>
    </div>
  )
}
