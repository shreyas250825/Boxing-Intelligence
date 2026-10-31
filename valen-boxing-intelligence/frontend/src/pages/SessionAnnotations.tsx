import { useEffect, useRef, useState } from "react"
import { useParams, Link } from "react-router-dom"
import Layout from "../components/Layout"
import ObservationTimeline from "../components/ObservationTimeline"
import { listObservations, createObservation, deleteObservation } from "../api/observations"
import { getVideo } from "../api/videos"
import type { Observation, Video } from "../types"
import { ArrowLeft, AlertCircle } from "lucide-react"

export default function SessionAnnotations() {
  const { id } = useParams<{ id: string }>()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [duration, setDuration] = useState(0)
  const [videoError, setVideoError] = useState("")
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

  useEffect(() => {
    if (!id) return
    getVideo(id).then(setVideo).catch(() => {})
    listObservations(id).then(setObservations).catch(() => {})
  }, [id])

  const handleSeek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = Math.min(t, Math.max(0, duration))
  }
  const handleAdd = async (data: Partial<Observation>) => {
    const obs = await createObservation(data)
    setObservations(o => [...o, obs])
  }
  const handleDelete = async (obsId: string) => {
    await deleteObservation(obsId)
    setObservations(o => o.filter(x => x.id !== obsId))
  }

  return (
    <Layout>
      <div className="px-8 py-8">
        <Link to={video?.boxer_id ? "/boxers/" + video.boxer_id : "/"} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} />Back to profile
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Session Annotations</h1>
        {video && (
          <p className="text-sm text-gray-500 mb-6">
            {video.original_filename_safe} &bull; {(video.file_size_bytes / 1024 / 1024).toFixed(1)} MB
          </p>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div className="card overflow-hidden">
            {video ? (
              <>
                <video
                  ref={videoRef}
                  controls
                  className="w-full bg-black"
                  style={{ maxHeight: 360 }}
                  onLoadedMetadata={e => setDuration((e.target as HTMLVideoElement).duration)}
                  onError={() => setVideoError("Video could not be loaded in this browser. The format may not be supported.")}
                  src={apiBase + "/api/v1/videos/" + id + "/stream"}
                />
                {videoError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border-t border-red-100">
                    <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">{videoError}</p>
                  </div>
                )}
                {duration > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                    Duration: {duration.toFixed(1)}s &bull; Click an observation timestamp to seek
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-56 bg-gray-50 text-gray-400 text-sm">
                Loading video…
              </div>
            )}
          </div>

          <div className="card p-5">
            {video ? (
              <ObservationTimeline
                videoId={id!}
                boxerId={video.boxer_id}
                observations={observations}
                videoDuration={duration}
                onSeek={handleSeek}
                onAdd={handleAdd}
                onDelete={handleDelete}
              />
            ) : (
              <p className="text-gray-400 text-sm">Loading…</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}