import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Loader2, AlertTriangle, Database, ChevronRight } from 'lucide-react'
import Layout from '../../../components/Layout'
import { askMyData } from '../../../api/aiCorner'

const EXAMPLE_QUESTIONS = [
  'How has my training changed over the past four weeks?',
  'What was my highest recorded training load?',
  'How has my recorded weight changed recently?',
  'Which weeks had the most training sessions?',
  'How often did I log my food diary?',
  'What do my recovery scores show over the last month?',
  'What training goals have I completed?',
  'How is my hydration trending?',
]

interface DataAnswer {
  question: string
  answer: string
  data_sources: Record<string, number>
  query_date: string
}

export default function AskMyData() {
  const [searchParams] = useSearchParams()
  const boxerId = searchParams.get('boxer') || ''
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<DataAnswer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<DataAnswer[]>([])

  const handleAsk = async (q?: string) => {
    const text = (q ?? question).trim()
    if (!text || !boxerId || loading) return
    setQuestion(text)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await askMyData({ boxer_id: boxerId, question: text })
      setResult(data)
      setHistory((prev) => [data, ...prev].slice(0, 10))
    } catch (e: any) {
      setError(e.message || 'Failed to process question.')
    } finally {
      setLoading(false)
    }
  }

  if (!boxerId) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
          <p className="text-slate-300">Select a boxer to use Ask My Data.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-2">
          <Search size={20} className="text-orange-400" />
          <h1 className="text-lg font-bold text-white">Ask My Data</h1>
        </div>
        <p className="text-sm text-slate-400">
          Ask natural-language questions about your actual boxing records. All answers reference real data — no invented statistics.
        </p>

        {/* Input */}
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Ask a question about your training, nutrition, recovery…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAsk() }}
            disabled={loading}
          />
          <button
            onClick={() => handleAsk()}
            disabled={!question.trim() || loading}
            className="btn-primary shrink-0 px-4"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          </button>
        </div>

        {/* Example questions */}
        {!result && !loading && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Example questions</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleAsk(q)}
                  className="text-left flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-700/50 bg-slate-900/60 hover:border-orange-500/30 hover:bg-slate-800/50 transition text-sm text-slate-300"
                >
                  <ChevronRight size={12} className="text-orange-400 shrink-0" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-700/50 bg-slate-900/60">
            <Loader2 size={16} className="animate-spin text-orange-400" />
            <span className="text-sm text-slate-300">Analysing your records…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/40 bg-slate-800/40">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Your question</p>
              <p className="text-sm font-semibold text-white">{result.question}</p>
            </div>
            <div className="p-4">
              <div className="prose-sm space-y-2">
                {result.answer.split('\n').map((line, i) => {
                  if (!line.trim()) return <div key={i} className="h-1.5" />
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-orange-400 shrink-0 mt-1 text-xs">•</span>
                        <span className="text-sm text-slate-200">{line.slice(2)}</span>
                      </div>
                    )
                  }
                  return <p key={i} className="text-sm text-slate-200 leading-relaxed">{line}</p>
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-700/40 bg-slate-800/40">
              <div className="flex items-center gap-2 flex-wrap">
                <Database size={11} className="text-slate-500" />
                <span className="text-xs text-slate-500">Data sources:</span>
                {Object.entries(result.data_sources).map(([key, count]) => (
                  count > 0 && (
                    <span key={key} className="text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                      {key.replace(/_/g, ' ')}: {count}
                    </span>
                  )
                ))}
                <span className="text-xs text-slate-600 ml-auto">Query date: {result.query_date}</span>
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 1 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Recent questions</p>
            <div className="space-y-1">
              {history.slice(1, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setQuestion(h.question); setResult(h) }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  <Search size={10} className="shrink-0" />
                  {h.question}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
