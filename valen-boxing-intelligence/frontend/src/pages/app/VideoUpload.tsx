import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import Layout from "../../components/Layout"
import VideoUploadForm from "../../components/VideoUploadForm"
import { getBoxer } from "../../api/boxers"
import { listFightCamps } from "../../api/fightCamps"
import type { Boxer, FightCamp } from "../../types"
import { ArrowLeft, Video } from "lucide-react"

export default function VideoUpload() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [boxer, setBoxer] = useState<Boxer | null>(null)
  const [camps, setCamps] = useState<FightCamp[]>([])
  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    if (!id) return
    Promise.all([getBoxer(id), listFightCamps(id)])
      .then(([b, c]) => { setBoxer(b); setCamps(c) })
      .catch(() => {})
  }, [id])

  const handleSuccess = (videoId: string) => {
    nav(`/app/analysis/${videoId}`)
  }

  return (
    <Layout>
      <div className="px-6 py-6 max-w-2xl mx-auto">
        <Link
          to={`/app/boxers/${id}`}
          className="inline-flex items-center gap-1.5 text-sm mb-5 transition"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft size={14} />
          {boxer?.full_name ?? "Profile"}
        </Link>

        <div className="page-header">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}
            >
              <Video size={16} />
            </div>
            <div>
              <h1>Upload Video</h1>
              <p>Footage is streamed to disk and processed asynchronously.</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          {boxer ? (
            <VideoUploadForm
              boxerId={id!}
              fightCamps={camps}
              sessionDate={today}
              onSuccess={handleSuccess}
            />
          ) : (
            <div className="empty-state">
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Loading athlete profile…
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
