import { useParams, Link } from "react-router-dom"
import Layout from "../components/Layout"
import AnalysisResultPanel from "../components/AnalysisResultPanel"
import { ArrowLeft } from "lucide-react"

export default function VideoAnalysis() {
  const { jobId } = useParams<{ jobId: string }>()
  if (!jobId) return null
  return (
    <Layout>
      <div className="px-8 py-8 max-w-3xl">
        <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} />Dashboard
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Video Analysis</h1>
        <p className="text-sm text-gray-500 mb-6">Local analysis running on your machine. No data sent externally.</p>
        <AnalysisResultPanel jobId={jobId} />
      </div>
    </Layout>
  )
}