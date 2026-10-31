import { useState, useEffect, useRef } from "react"
import { getAnalysisJob, getAnalysisResult } from "../api/analysis"
import type { AnalysisJob, AnalysisResult } from "../types"

const TERMINAL = ["completed", "failed", "cancelled"]

export function useAnalysisJob(jobId: string, intervalMs = 2000) {
  const [job, setJob] = useState<AnalysisJob | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState("")
  const [timedOut, setTimedOut] = useState(false)
  const attempts = useRef(0)
  const netRetries = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!jobId) return
    attempts.current = 0
    netRetries.current = 0

    const poll = async () => {
      if (attempts.current >= 60) { setTimedOut(true); return }
      attempts.current++
      try {
        const j = await getAnalysisJob(jobId)
        setJob(j)
        netRetries.current = 0
        if (TERMINAL.includes(j.status)) {
          if (j.status === "completed" && j.result_id) {
            const r = await getAnalysisResult(j.result_id)
            setResult(r)
          } else if (j.status !== "completed") {
            setError(j.error_message || "Analysis failed")
          }
          return
        }
        timerRef.current = setTimeout(poll, intervalMs)
      } catch {
        netRetries.current++
        if (netRetries.current >= 3) { setError("Connection lost. Please refresh."); return }
        timerRef.current = setTimeout(poll, intervalMs)
      }
    }

    poll()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [jobId, intervalMs])

  return { job, result, error, timedOut }
}
