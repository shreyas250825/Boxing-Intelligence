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
      .then(([b, c]) => { setBoxer(b); setCamps(c) }).catch(() => {})
  }, [id])

  // After upload: navigate directly to the analysis workspace with the video_id
  const handleSuccess = (videoId: string) => {
    nav(`/app/analysis/${videoId}`)
  }

  return (
    <Layout>
      <div className="px-8 py-8 max-w-2xl">
        <Link to={`/app/boxers/${id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} />{boxer?.full_name ?? "Profile"}
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Video size={16} className="text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Upload Video</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6 ml-12">
          Upload boxing footage. The analysis workspace will open automatically.
        </p>
        <div className="card p-6">
          {boxer ? (
            <VideoUploadForm
              boxerId={id!}
              fightCamps={camps}
              sessionDate={today}
              onSuccess={handleSuccess}
            />
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Loading…</p>
          )}
        </div>
      </div>
    </Layout>
  )
}