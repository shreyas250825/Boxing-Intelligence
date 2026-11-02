import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronRight, CheckCircle, Clock, Star, Loader2, Trophy } from 'lucide-react'
import Layout from '../../../components/Layout'
import {
  fetchLessons,
  fetchLesson,
  fetchLearningProgress,
  updateLessonProgress,
  type LearningLesson,
} from '../../../api/aiCorner'

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'text-green-400 border-green-500/30 bg-green-500/10',
  intermediate: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  advanced: 'text-red-400 border-red-500/30 bg-red-500/10',
}

export default function LearningCentre() {
  const [searchParams] = useSearchParams()
  const boxerId = searchParams.get('boxer') || ''
  const [lessons, setLessons] = useState<LearningLesson[]>([])
  const [progress, setProgress] = useState<Record<string, { status: string; quiz_score?: number }>>({})
  const [selectedLesson, setSelectedLesson] = useState<LearningLesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [lessonLoading, setLessonLoading] = useState(false)
  const [filterDifficulty, setFilterDifficulty] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')

  // Quiz state
  const [quizMode, setQuizMode] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizSubmitted, setQuizSubmitted] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchLessons(filterCategory || undefined, filterDifficulty || undefined),
      boxerId ? fetchLearningProgress(boxerId) : Promise.resolve([]),
    ])
      .then(([ls, prog]) => {
        setLessons(ls)
        const map: Record<string, { status: string; quiz_score?: number }> = {}
        prog.forEach((p) => { map[p.lesson_id] = { status: p.status, quiz_score: p.quiz_score } })
        setProgress(map)
      })
      .finally(() => setLoading(false))
  }, [filterDifficulty, filterCategory, boxerId])

  const openLesson = async (lesson: LearningLesson) => {
    setLessonLoading(true)
    setQuizMode(false)
    setQuizAnswers([])
    setQuizSubmitted(false)
    const full = await fetchLesson(lesson.id)
    setSelectedLesson(full)
    setLessonLoading(false)
    // Mark as in-progress
    if (boxerId && progress[lesson.id]?.status !== 'completed') {
      updateLessonProgress(boxerId, lesson.id, 'in_progress').catch(() => {})
      setProgress((prev) => ({ ...prev, [lesson.id]: { status: 'in_progress' } }))
    }
  }

  const handleCompleteLesson = async () => {
    if (!selectedLesson || !boxerId) return
    await updateLessonProgress(boxerId, selectedLesson.id, 'completed')
    setProgress((prev) => ({ ...prev, [selectedLesson.id]: { status: 'completed' } }))
  }

  const handleQuizSubmit = async () => {
    if (!selectedLesson?.quiz || !boxerId) return
    setQuizSubmitted(true)
    const correct = quizAnswers.filter((ans, i) => ans === selectedLesson.quiz![i].correct_index).length
    const score = Math.round((correct / selectedLesson.quiz.length) * 100)
    await updateLessonProgress(boxerId, selectedLesson.id, 'completed', score)
    setProgress((prev) => ({ ...prev, [selectedLesson.id]: { status: 'completed', quiz_score: score } }))
  }

  const categories = [...new Set(lessons.map((l) => l.category))]
  const completedCount = Object.values(progress).filter((p) => p.status === 'completed').length

  if (selectedLesson) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <button
            onClick={() => setSelectedLesson(null)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-4"
          >
            ← Back to lessons
          </button>

          {lessonLoading ? (
            <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-orange-400" /></div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[selectedLesson.difficulty] || ''}`}>
                    {selectedLesson.difficulty}
                  </span>
                  <span className="text-xs text-slate-500">{selectedLesson.category}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock size={10} /> {selectedLesson.estimated_minutes} min
                  </span>
                  {progress[selectedLesson.id]?.status === 'completed' && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle size={10} /> Completed
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-white">{selectedLesson.title}</h1>
              </div>

              {/* Lesson content */}
              {!quizMode && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-6 prose-boxing">
                  <LessonContent content={selectedLesson.content ?? ''} />
                </div>
              )}

              {/* Quiz */}
              {quizMode && selectedLesson.quiz && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-white">Knowledge Check</h2>
                  {selectedLesson.quiz.map((q, qi) => (
                    <div key={qi} className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 space-y-3">
                      <p className="text-sm font-semibold text-white">{qi + 1}. {q.question}</p>
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => {
                          const selected = quizAnswers[qi] === oi
                          const isCorrect = oi === q.correct_index
                          const showResult = quizSubmitted

                          return (
                            <button
                              key={oi}
                              disabled={quizSubmitted}
                              onClick={() => setQuizAnswers((prev) => { const n = [...prev]; n[qi] = oi; return n })}
                              className={`
                                w-full text-left px-3 py-2.5 rounded-lg border text-sm transition
                                ${showResult
                                  ? isCorrect
                                    ? 'border-green-500/50 bg-green-500/10 text-green-300'
                                    : selected
                                    ? 'border-red-500/50 bg-red-500/10 text-red-300'
                                    : 'border-slate-700/50 text-slate-400'
                                  : selected
                                  ? 'border-orange-500/50 bg-orange-500/10 text-white'
                                  : 'border-slate-700/50 text-slate-300 hover:border-slate-600'}
                              `}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                      {quizSubmitted && (
                        <p className="text-xs text-slate-400 italic">{q.explanation}</p>
                      )}
                    </div>
                  ))}

                  {!quizSubmitted ? (
                    <button
                      onClick={handleQuizSubmit}
                      disabled={quizAnswers.length < selectedLesson.quiz.length}
                      className="btn-primary text-sm"
                    >
                      Submit Answers
                    </button>
                  ) : (
                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 text-center">
                      <Trophy size={24} className="mx-auto text-orange-400 mb-2" />
                      <p className="text-white font-bold text-lg">
                        {quizAnswers.filter((a, i) => a === selectedLesson.quiz![i].correct_index).length} / {selectedLesson.quiz.length} correct
                      </p>
                      <p className="text-sm text-slate-400">Score: {progress[selectedLesson.id]?.quiz_score ?? 0}%</p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                {!quizMode && (
                  <>
                    {progress[selectedLesson.id]?.status !== 'completed' && (
                      <button onClick={handleCompleteLesson} className="btn-primary text-sm">
                        <CheckCircle size={14} /> Mark as Complete
                      </button>
                    )}
                    {selectedLesson.quiz && (
                      <button onClick={() => setQuizMode(true)} className="btn-secondary text-sm">
                        <Star size={14} /> Take Quiz
                      </button>
                    )}
                  </>
                )}
                {quizMode && (
                  <button onClick={() => { setQuizMode(false); setQuizAnswers([]); setQuizSubmitted(false) }} className="btn-secondary text-sm">
                    ← Back to Lesson
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-orange-400" />
            <h1 className="text-lg font-bold text-white">Boxing Learning Centre</h1>
          </div>
          {boxerId && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Trophy size={12} className="text-orange-400" />
              {completedCount} / {lessons.length} completed
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <select
            className="input text-sm py-2 w-auto"
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
          >
            <option value="">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select
            className="input text-sm py-2 w-auto"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-orange-400" /></div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No lessons found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lessons.map((lesson) => {
              const prog = progress[lesson.id]
              const done = prog?.status === 'completed'
              return (
                <button
                  key={lesson.id}
                  onClick={() => openLesson(lesson)}
                  className="text-left rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 hover:border-orange-500/30 hover:bg-slate-800/50 transition group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[lesson.difficulty] || ''}`}>
                        {lesson.difficulty}
                      </span>
                      <span className="text-xs text-slate-500">{lesson.category}</span>
                    </div>
                    {done && <CheckCircle size={14} className="text-green-400 shrink-0" />}
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">{lesson.title}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={10} />
                    {lesson.estimated_minutes} min
                    {lesson.has_quiz && (
                      <span className="flex items-center gap-0.5"><Star size={10} className="text-orange-400" /> Quiz</span>
                    )}
                    {prog?.quiz_score !== undefined && (
                      <span className="text-orange-400">{prog.quiz_score}%</span>
                    )}
                  </div>
                  <ChevronRight size={12} className="text-slate-600 group-hover:text-orange-400 transition mt-2" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}

function LessonContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold text-orange-300 mt-3 mb-1">{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-slate-200 mt-2">{line.slice(4)}</h3>
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-orange-400 mt-1 text-xs shrink-0">•</span>
              <span className="text-sm text-slate-200">{line.slice(2)}</span>
            </div>
          )
        }
        if (/^\d+\. /.test(line)) {
          const num = line.match(/^(\d+)\. /)?.[1]
          const rest = line.replace(/^\d+\. /, '')
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-orange-400 text-xs font-mono mt-1 shrink-0">{num}.</span>
              <span className="text-sm text-slate-200">{rest}</span>
            </div>
          )
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="text-sm font-semibold text-white">{line.slice(2, -2)}</p>
        }
        if (line.trim() === '') return <div key={i} className="h-1.5" />
        return <p key={i} className="text-sm text-slate-200 leading-relaxed">{line}</p>
      })}
    </div>
  )
}
