import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../components/common/AppShell'
import ChartRenderer from '../components/dashboard/ChartRenderer'
import { ChartSkeleton } from '../components/common/Skeleton'
import { supabase, executeQuery } from '../lib/supabase'
import { useSession } from '../lib/session'
import { generateView } from '../lib/claude'
import type { ChartSpec, ChatMessage, SavedView } from '../types'

const SITE_ID = import.meta.env.VITE_DEMO_SITE_ID as string

export default function ViewBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()

  const [spec, setSpec] = useState<ChartSpec | null>(null)
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [queryLoading, setQueryLoading] = useState(false)
  const [viewLoading, setViewLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load existing view
  useEffect(() => {
    if (!id || id === 'new') {
      setViewLoading(false)
      return
    }
    async function load() {
      const { data: row, error } = await supabase
        .from('saved_views')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !row) {
        setError('View not found')
        setViewLoading(false)
        return
      }
      const view = row as SavedView
      setSpec(view.chart_spec)
      setViewLoading(false)
      runQuery(view.chart_spec)
    }
    load()
  }, [id])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function runQuery(chartSpec: ChartSpec) {
    setQueryLoading(true)
    setError(null)
    try {
      const rows = await executeQuery(chartSpec.sql, user?.id)
      setData(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed')
      setData([])
    } finally {
      setQueryLoading(false)
    }
  }

  async function handleSendMessage() {
    if (!input.trim() || aiLoading || !user) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }
    setChatHistory((h) => [...h, userMsg])
    setInput('')
    setAiLoading(true)

    const result = await generateView(userMsg.content, chatHistory, user.id, SITE_ID)

    if ('error' in result && result.error) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.clarifying_question
          ? result.clarifying_question
          : `Sorry, I ran into an issue: ${result.error}`,
        timestamp: new Date(),
      }
      setChatHistory((h) => [...h, errMsg])
    } else if ('spec' in result) {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Here's "${result.spec.title}" — ${result.spec.description}`,
        chart_spec: result.spec,
        timestamp: new Date(),
      }
      setChatHistory((h) => [...h, assistantMsg])
      setSpec(result.spec)
      runQuery(result.spec)
    }

    setAiLoading(false)
  }

  async function handleSaveView() {
    if (!spec || !user) return

    const name = prompt('Name this view:', spec.title)
    if (!name) return

    const { data: row, error } = await supabase
      .from('saved_views')
      .insert({
        session_user_id: user.id,
        name,
        description: spec.description,
        chart_spec: spec,
        sql_query: spec.sql,
        is_suggested: false,
      })
      .select('id')
      .single()

    if (error) {
      alert('Failed to save: ' + error.message)
    } else {
      navigate(`/view/${(row as { id: string }).id}`)
    }
  }

  if (viewLoading) {
    return (
      <AppShell>
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <ChartSkeleton />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
      {/* Chart canvas */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!spec ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <span className="text-5xl">💬</span>
            <p className="text-center">
              Ask the AI to build a view for you,<br />or open a suggested view from the gallery.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{spec.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{spec.description}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={handleSaveView}
                  className="text-sm bg-primary-800 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {spec.filters_applied && spec.filters_applied.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {spec.filters_applied.map((f, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-primary-800 border border-blue-200 px-2 py-0.5 rounded-full">
                    {f.field}: {f.value}
                  </span>
                ))}
              </div>
            )}

            <ChartRenderer
              spec={spec}
              data={data}
              loading={queryLoading}
              onDrillDown={(row) => {
                // TODO Phase 4: implement drill-down filter
                console.log('Drill down into:', row)
              }}
            />

            {spec.drill_down_hint && (
              <p className="mt-3 text-xs text-gray-400">{spec.drill_down_hint}</p>
            )}
          </div>
        )}

        {/* Follow-up suggestions */}
        {spec?.follow_up_suggestions && spec.follow_up_suggestions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Follow-up ideas:</p>
            <div className="flex flex-wrap gap-2">
              {spec.follow_up_suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-primary-300 hover:text-primary-800 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat panel */}
      <div className="lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col bg-gray-50">
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <h3 className="font-semibold text-gray-900 text-sm">AI Chat</h3>
          <p className="text-xs text-gray-400">Describe a view in plain English</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {chatHistory.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-8">
              Try: "Show me revenue by month for the last year"
            </p>
          )}
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary-800 text-white rounded-br-md'
                    : 'bg-white text-gray-700 border border-gray-200 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Ask for a view..."
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-800 focus:border-transparent"
              disabled={aiLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || aiLoading}
              className="bg-primary-800 text-white px-3 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
