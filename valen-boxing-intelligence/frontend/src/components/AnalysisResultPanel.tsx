import { useAnalysisJob } from "../hooks/useAnalysisJob"
import { SkeletonCard } from "./SkeletonLoader"
import { AlertTriangle, CheckCircle2, Loader2, Info } from "lucide-react"

export default function AnalysisResultPanel({ jobId }: { jobId: string }) {
  const { job, result, error, timedOut } = useAnalysisJob(jobId)

  if (timedOut) return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm text-yellow-800">
      Analysis is taking longer than expected.{" "}
      <button onClick={() => window.location.reload()} className="font-medium underline">Refresh</button>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
      <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-red-700 text-sm">Analysis Failed</p>
        <p className="text-red-600 text-xs mt-1">{error}</p>
      </div>
    </div>
  )

  if (!result) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Loader2 size={16} className="text-blue-600 animate-spin shrink-0" />
        <p className="text-sm text-blue-700 font-medium">
          {job ? "Status: " + job.status + "…" : "Initialising analysis…"}
        </p>
      </div>
      <SkeletonCard /><SkeletonCard />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <CheckCircle2 size={16} className="text-green-600" />
        <span className="text-sm font-medium">Analysis complete</span>
        <span className="text-xs text-green-600 ml-auto">{new Date(result.analysed_at).toLocaleString()}</span>
      </div>

      {!result.pose_available && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Pose analysis unavailable — install MediaPipe to enable skeleton-based metrics.
          </p>
        </div>
      )}

      {/* Video metadata */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">Video Metadata</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Duration", value: result.duration_seconds.toFixed(1) + "s" },
            { label: "Resolution", value: result.width_px + "x" + result.height_px },
            { label: "Frame Rate", value: result.fps.toFixed(1) + " fps" },
            { label: "Total Frames", value: result.total_frames.toLocaleString() },
            { label: "Sampled Frames", value: result.sampled_frames.toLocaleString() },
            { label: "Pose Detected", value: result.pose_available ? result.pose_detected_frames + " frames" : "Unavailable" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      {result.metrics && result.metrics.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-4">Computed Metrics</h3>
          <div className="divide-y divide-gray-100">
            {result.metrics.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800 capitalize">{m.metric_key.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-400">{m.calculation_method} &bull;{" "}
                    <span className="text-blue-600 font-medium">{m.source}</span>
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900 font-mono">
                  {m.value} <span className="text-xs font-normal text-gray-400">{m.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}