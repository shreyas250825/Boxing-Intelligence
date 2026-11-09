/**
 * CompanionChat — the universal chat interface for all 8 AI companions.
 *
 * Features:
 * - Message history with DB persistence
 * - Streaming responses (SSE)
 * - Retry failed request
 * - Copy response
 * - Thumbs up/down feedback
 * - Save useful response
 * - New conversation / load existing
 * - Suggested prompts
 * - Quick actions sidebar
 * - Voice input (Web Speech API with graceful fallback)
 * - Structured markdown rendering
 * - Loading, error, and empty states
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Send,
  Plus,
  Mic,
  MicOff,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  RefreshCw,
  Trash2,
  ChevronLeft,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Volume2,
  VolumeX,
  MessageSquare,
  Zap,
} from 'lucide-react'
import Layout from '../../../components/Layout'
import {
  fetchCompanion,
  fetchConversations,
  fetchConversationMessages,
  sendMessage,
  streamMessage,
  deleteConversation,
  submitFeedback,
  toggleSaveMessage,
  type Companion,
  type Message,
  type Conversation,
} from '../../../api/aiCorner'

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayMessage = Message & { streaming?: false }

interface StreamingMessage {
  id: string
  role: 'assistant'
  content: string
  streaming: true
  content_type: string
  feedback: null
  is_saved: false
  created_at: string
}

type AnyMessage = DisplayMessage | StreamingMessage

// ─── Voice hook ───────────────────────────────────────────────────────────────

// Extend window type for non-standard Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const start = useCallback(() => {
    if (!supported) return
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition: SpeechRecognitionInstance = new SpeechRecognitionClass()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      onResult(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.start()
    setListening(true)
    recognitionRef.current = recognition
  }, [supported, onResult])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}

// ─── Text-to-speech hook ──────────────────────────────────────────────────────

function useTTS() {
  const [speaking, setSpeaking] = useState(false)

  const speak = (text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text.slice(0, 800))
    utter.onstart = () => setSpeaking(true)
    utter.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(utter)
  }

  const stop = () => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  return { speaking, speak, stop, supported: 'speechSynthesis' in window }
}

// ─── Markdown-ish renderer ────────────────────────────────────────────────────

function RenderContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-base font-bold text-white mt-4 mb-1">{line.slice(2)}</h2>)
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-sm font-semibold text-orange-300 mt-3 mb-1">{line.slice(3)}</h3>)
    } else if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-sm font-semibold text-slate-200 mt-2 mb-0.5">{line.slice(4)}</h4>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-orange-400 mt-1 text-xs">•</span>
          <span className="text-sm text-slate-200 flex-1">{renderInline(line.slice(2))}</span>
        </div>
      )
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)?.[1]
      const rest = line.replace(/^\d+\. /, '')
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-orange-400 text-xs font-mono mt-1">{num}.</span>
          <span className="text-sm text-slate-200 flex-1">{renderInline(rest)}</span>
        </div>
      )
    } else if (line.startsWith('---') || line.startsWith('===')) {
      elements.push(<hr key={i} className="border-slate-700 my-3" />)
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(
        <p key={i} className="text-sm text-slate-200 leading-relaxed my-0.5">
          {renderInline(line)}
        </p>
      )
    }
    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-slate-300">{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="text-xs font-mono bg-slate-700 px-1 py-0.5 rounded text-orange-300">{part.slice(1, -1)}</code>
    }
    return part
  })
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CompanionChat() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const boxerId = searchParams.get('boxer') || ''
  const initialConversationId = searchParams.get('conversation') || undefined
  const navigate = useNavigate()

  const [companion, setCompanion] = useState<Companion | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId)
  const [messages, setMessages] = useState<AnyMessage[]>([])
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companionLoading, setCompanionLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [useStreaming, setUseStreaming] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamAbortRef = useRef<boolean>(false)

  const { listening, supported: voiceSupported, start: startVoice, stop: stopVoice } = useVoiceInput(
    (text) => setInput((prev) => prev + text)
  )
  const tts = useTTS()

  // Load companion definition
  useEffect(() => {
    if (!slug) return
    setCompanionLoading(true)
    fetchCompanion(slug)
      .then(setCompanion)
      .catch(() => setError('Companion not found.'))
      .finally(() => setCompanionLoading(false))
  }, [slug])

  // Load conversations list
  const refreshConversations = useCallback(() => {
    if (!boxerId || !slug) return
    fetchConversations(boxerId, slug).then(setConversations).catch(() => {})
  }, [boxerId, slug])

  useEffect(() => { refreshConversations() }, [refreshConversations])

  // Load messages for current conversation
  useEffect(() => {
    if (!conversationId) return
    fetchConversationMessages(conversationId)
      .then((data) => setMessages(data.messages as DisplayMessage[]))
      .catch(() => {})
  }, [conversationId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleNewConversation = () => {
    setConversationId(undefined)
    setMessages([])
    setError(null)
  }

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim()
    if (!text || loading || !slug || !boxerId) return

    setInput('')
    setError(null)
    setLoading(true)

    // Optimistically add user message
    const optimisticUser: DisplayMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      content_type: 'text',
      feedback: null,
      is_saved: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    try {
      if (useStreaming) {
        // Streaming path
        setStreamingContent('')
        streamAbortRef.current = false
        let fullContent = ''
        let newConvId = conversationId

        try {
          for await (const chunk of streamMessage(slug, boxerId, text, conversationId)) {
            if (streamAbortRef.current) break
            fullContent += chunk
            setStreamingContent(fullContent)
          }
        } catch (streamErr: any) {
          if (streamErr.message?.includes('AI_NOT_CONFIGURED') || streamErr.message?.includes('AI_PACKAGE_MISSING')) {
            setError(streamErr.message)
            setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
            return
          }
          // Fall back to non-streaming
          const result = await sendMessage(slug, boxerId, text, conversationId)
          fullContent = result.content
          newConvId = result.conversation_id
        }

        setStreamingContent(null)
        if (fullContent) {
          const assistantMsg: DisplayMessage = {
            id: `streamed-${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            content_type: 'text',
            feedback: null,
            is_saved: false,
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev.filter((m) => m.id !== optimisticUser.id), optimisticUser, assistantMsg])
          if (!conversationId && newConvId) {
            setConversationId(newConvId)
            refreshConversations()
          }
        }
      } else {
        // Non-streaming
        const result = await sendMessage(slug, boxerId, text, conversationId)
        const assistantMsg: DisplayMessage = {
          id: result.message_id,
          role: 'assistant',
          content: result.content,
          content_type: 'text',
          feedback: null,
          is_saved: false,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev.filter((m) => m.id !== optimisticUser.id), optimisticUser, assistantMsg])
        if (!conversationId) {
          setConversationId(result.conversation_id)
          refreshConversations()
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message.')
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
    } finally {
      setLoading(false)
      setStreamingContent(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handleFeedback = async (messageId: string, feedback: 'thumbs_up' | 'thumbs_down') => {
    try {
      await submitFeedback(messageId, feedback)
      setMessages((prev) =>
        prev.map((m): AnyMessage => m.id === messageId ? { ...m, feedback } as DisplayMessage : m)
      )
    } catch {}
  }

  const handleToggleSave = async (messageId: string) => {
    try {
      const result = await toggleSaveMessage(messageId)
      setMessages((prev) =>
        prev.map((m): AnyMessage => m.id === messageId ? { ...m, is_saved: result.is_saved } as DisplayMessage : m)
      )
    } catch {}
  }

  const handleDeleteConversation = async (convId: string) => {
    try {
      await deleteConversation(convId)
      if (convId === conversationId) {
        setConversationId(undefined)
        setMessages([])
      }
      refreshConversations()
    } catch {}
  }

  if (companionLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-orange-400" />
        </div>
      </Layout>
    )
  }

  if (!companion) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto mt-20 text-center">
          <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
          <p className="text-slate-300">Companion not found.</p>
          <button onClick={() => navigate('/app/ai-corner')} className="btn-secondary mt-4">Back to AI Corner</button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar — conversation list */}
        <div
          className={`
            shrink-0 w-64 border-r border-slate-700/50 bg-slate-950/80 flex flex-col
            transition-all duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            absolute md:relative z-20 h-full
          `}
        >
          <div className="p-3 border-b border-slate-700/50">
            <button
              onClick={handleNewConversation}
              className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-2"
            >
              <Plus size={13} /> New Conversation
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map((conv) => (
              <div key={conv.id} className="group flex items-center gap-1">
                <button
                  onClick={() => {
                    setConversationId(conv.id)
                    setSidebarOpen(false)
                  }}
                  className={`
                    flex-1 text-left px-3 py-2 rounded-lg text-xs transition truncate
                    ${conv.id === conversationId
                      ? 'bg-orange-500/20 text-white border border-orange-500/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                  `}
                >
                  <MessageSquare size={11} className="inline mr-1.5 opacity-60" />
                  {conv.title}
                </button>
                <button
                  onClick={() => handleDeleteConversation(conv.id)}
                  className="shrink-0 p-1 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-slate-600 px-2 pt-2">No conversations yet</p>
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950/30">
          {/* Chat header */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-700/50 bg-slate-950/60">
            <button
              onClick={() => navigate('/app/ai-corner')}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition md:hidden"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition md:hidden"
            >
              <MessageSquare size={16} />
            </button>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: `${companion.color_accent}25` }}
            >
              {companion.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{companion.name}</p>
              <p className="text-xs text-slate-400 truncate">{companion.role}</p>
            </div>
            {!boxerId && (
              <div className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
                <AlertTriangle size={11} />
                No boxer selected
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Welcome state */}
            {messages.length === 0 && !loading && (
              <div className="max-w-2xl mx-auto space-y-6 py-8">
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3"
                    style={{ background: `${companion.color_accent}20` }}
                  >
                    {companion.icon}
                  </div>
                  <h2 className="text-lg font-bold text-white">{companion.name}</h2>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">{companion.description}</p>
                </div>

                {companion.suggested_prompts.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 text-center">Suggested questions</p>
                    <div className="grid grid-cols-1 gap-2">
                      {companion.suggested_prompts.slice(0, 4).map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSend(prompt)}
                          className="text-left px-4 py-3 rounded-xl border border-slate-700/50 bg-slate-900/60 hover:border-orange-500/40 hover:bg-slate-800/60 text-sm text-slate-300 transition"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!boxerId && (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
                    <AlertTriangle size={16} className="text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-300">
                      No boxer profile selected. Your conversations will not include personalised athlete data.{' '}
                      <button onClick={() => navigate('/app/boxers')} className="text-orange-400 underline">
                        Select a boxer
                      </button>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              const msgId = msg.id
              const isSaved = 'is_saved' in msg ? msg.is_saved : false
              const feedback = 'feedback' in msg ? msg.feedback : null

              return (
                <div key={msgId} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${isUser ? 'ml-12' : 'mr-4'}`}>
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center text-xs"
                          style={{ background: `${companion.color_accent}25` }}
                        >
                          {companion.icon}
                        </span>
                        <span className="text-xs text-slate-500">{companion.name}</span>
                      </div>
                    )}
                    <div
                      className={`
                        rounded-2xl px-4 py-3
                        ${isUser
                          ? 'bg-orange-500 text-white rounded-tr-sm'
                          : 'bg-slate-800/80 border border-slate-700/50 rounded-tl-sm'}
                      `}
                    >
                      {isUser ? (
                        <p className="text-sm">{msg.content}</p>
                      ) : (
                        <RenderContent text={msg.content} />
                      )}
                    </div>

                    {/* Assistant message actions */}
                    {!isUser && !('streaming' in msg) && (
                      <div className="flex items-center gap-1 mt-1.5 px-1">
                        <ActionBtn
                          onClick={() => handleCopy(msg.content, msgId)}
                          title="Copy"
                          active={copiedId === msgId}
                        >
                          {copiedId === msgId ? <CheckCircle size={11} className="text-green-400" /> : <Copy size={11} />}
                        </ActionBtn>
                        <ActionBtn
                          onClick={() => tts.speaking ? tts.stop() : tts.speak(msg.content)}
                          title={tts.speaking ? 'Stop' : 'Read aloud'}
                          active={false}
                        >
                          {tts.speaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
                        </ActionBtn>
                        <ActionBtn
                          onClick={() => handleFeedback(msg.id, 'thumbs_up')}
                          title="Helpful"
                          active={feedback === 'thumbs_up'}
                        >
                          <ThumbsUp size={11} className={feedback === 'thumbs_up' ? 'text-green-400' : ''} />
                        </ActionBtn>
                        <ActionBtn
                          onClick={() => handleFeedback(msg.id, 'thumbs_down')}
                          title="Not helpful"
                          active={feedback === 'thumbs_down'}
                        >
                          <ThumbsDown size={11} className={feedback === 'thumbs_down' ? 'text-red-400' : ''} />
                        </ActionBtn>
                        <ActionBtn
                          onClick={() => handleToggleSave(msg.id)}
                          title={isSaved ? 'Unsave' : 'Save'}
                          active={isSaved}
                        >
                          <Bookmark size={11} className={isSaved ? 'text-orange-400' : ''} />
                        </ActionBtn>
                        <ActionBtn onClick={() => handleSend(messages[idx - 1]?.content)} title="Retry">
                          <RefreshCw size={11} />
                        </ActionBtn>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Streaming response */}
            {streamingContent !== null && (
              <div className="flex justify-start">
                <div className="max-w-[85%] mr-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-xs"
                      style={{ background: `${companion.color_accent}25` }}
                    >
                      {companion.icon}
                    </span>
                    <span className="text-xs text-slate-500">{companion.name}</span>
                    <Loader2 size={10} className="animate-spin text-slate-500 ml-1" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-slate-800/80 border border-slate-700/50">
                    <RenderContent text={streamingContent || '▋'} />
                  </div>
                </div>
              </div>
            )}

            {/* Loading indicator (non-streaming) */}
            {loading && streamingContent === null && (
              <div className="flex justify-start">
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5 max-w-2xl">
                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-300">{error}</p>
                  {(error.includes('AI_NOT_CONFIGURED') || error.includes('AI_MODEL_NOT_FOUND') || error.includes('Ollama')) && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-slate-400 font-semibold">To fix this:</p>
                      <ol className="text-xs text-slate-400 space-y-0.5 list-decimal pl-4">
                        <li>Install Ollama: <span className="text-orange-300">https://ollama.com/download</span></li>
                        <li>Pull a model: <code className="text-orange-300">ollama pull llama3:latest</code></li>
                        <li>Start Ollama: <code className="text-orange-300">ollama serve</code></li>
                        <li>Restart the backend server</li>
                      </ol>
                    </div>
                  )}
                  {error.includes('AI_TIMEOUT') && (
                    <p className="text-xs text-slate-400 mt-1">
                      The model took too long to respond. Try a shorter message, or increase{' '}
                      <code className="text-orange-300">OLLAMA_TIMEOUT_SECONDS</code> in{' '}
                      <code className="text-orange-300">backend/.env</code>.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick actions bar */}
          {companion.quick_actions.length > 0 && messages.length === 0 && (
            <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto border-t border-slate-700/30">
              <Zap size={11} className="text-slate-500 shrink-0" />
              {companion.quick_actions.map((qa) => (
                <button
                  key={qa.id}
                  onClick={() => handleSend(`Help me ${qa.label.toLowerCase()}`)}
                  className="shrink-0 px-3 py-1.5 rounded-full border border-slate-700/60 bg-slate-900/70 text-xs text-slate-300 hover:border-orange-500/40 hover:text-white transition"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="shrink-0 px-4 pb-4 pt-2 border-t border-slate-700/50 bg-slate-950/60">
            <div className="flex items-end gap-2">
              {/* Voice input */}
              {voiceSupported && (
                <button
                  onClick={listening ? stopVoice : startVoice}
                  className={`
                    shrink-0 p-2.5 rounded-xl border transition
                    ${listening
                      ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}
                  `}
                  title={listening ? 'Stop listening' : 'Voice input'}
                >
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}

              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask ${companion.name}…`}
                  rows={1}
                  style={{ minHeight: 42, maxHeight: 160, resize: 'none', overflow: 'auto' }}
                  className="input w-full rounded-xl pr-3 py-2.5 text-sm"
                  disabled={loading}
                />
              </div>

              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading || !boxerId}
                className="shrink-0 p-2.5 rounded-xl bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>

            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-xs text-slate-600">
                Enter to send · Shift+Enter for new line
              </p>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-xs text-slate-600">Streaming</span>
                <input
                  type="checkbox"
                  checked={useStreaming}
                  onChange={(e) => setUseStreaming(e.target.checked)}
                  className="w-3 h-3 accent-orange-500"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function ActionBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        p-1 rounded-md transition
        ${active ? 'text-white' : 'text-slate-500 hover:text-slate-300'}
      `}
    >
      {children}
    </button>
  )
}
