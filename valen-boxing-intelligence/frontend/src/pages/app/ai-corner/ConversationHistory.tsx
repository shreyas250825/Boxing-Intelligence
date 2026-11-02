import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MessageSquare, Trash2, Loader2, AlertTriangle, Bot } from 'lucide-react'
import Layout from '../../../components/Layout'
import { fetchConversations, deleteConversation, type Conversation } from '../../../api/aiCorner'

const COMPANION_NAMES: Record<string, string> = {
  'coach-valen': 'Coach Valen',
  'nutricoach': 'NutriCoach',
  'recoverai': 'RecoverAI',
  'corneriq': 'CornerIQ',
  'visionbox': 'VisionBox AI',
  'mindcorner': 'MindCorner',
  'performancelab': 'PerformanceLab AI',
  'boxing-academy': 'Boxing Academy AI',
}

export default function ConversationHistory() {
  const [searchParams] = useSearchParams()
  const boxerId = searchParams.get('boxer') || ''
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!boxerId) return
    setLoading(true)
    fetchConversations(boxerId)
      .then(setConversations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [boxerId])

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const grouped: Record<string, Conversation[]> = {}
  conversations.forEach((c) => {
    grouped[c.companion_slug] = [...(grouped[c.companion_slug] || []), c]
  })

  if (!boxerId) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
          <p className="text-slate-300">Select a boxer to view conversation history.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-orange-400" />
          <h1 className="text-lg font-bold text-white">Conversation History</h1>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-orange-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Bot size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No conversations yet.</p>
            <p className="text-xs mt-1">Start chatting with a companion to see history here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([slug, convs]) => (
              <div key={slug}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {COMPANION_NAMES[slug] || slug}
                </p>
                <div className="space-y-1.5">
                  {convs.map((conv) => (
                    <div
                      key={conv.id}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-700/40 bg-slate-900/50 hover:border-slate-600 transition"
                    >
                      <MessageSquare size={13} className="text-orange-400 shrink-0" />
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => navigate(`/app/ai-corner/${slug}?boxer=${boxerId}&conversation=${conv.id}`)}
                      >
                        <p className="text-sm text-slate-200 truncate">{conv.title}</p>
                        <p className="text-xs text-slate-600">
                          {new Date(conv.updated_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </button>
                      <button
                        onClick={() => handleDelete(conv.id)}
                        className="shrink-0 p-1.5 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
