import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const INPUT_STYLE = { backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }

export default function WorkforceTalkPanel({ agent }) {
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [messages, setMessages] = useState([])
  const [task, setTask] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  const loadThreads = useCallback(async () => {
    const { data } = await supabase
      .from('ai_agent_threads')
      .select('id, title, message_count, total_cost_usd, total_tokens_in, total_tokens_out, archived, created_at, updated_at')
      .eq('agent_id', agent.id)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(25)
    setThreads(data || [])
    return data || []
  }, [agent.id])

  const loadMessages = useCallback(async (threadId) => {
    if (!threadId) { setMessages([]); return }
    const { data } = await supabase
      .from('ai_agent_messages')
      .select('id, role, content, tool_call, tool_result, tokens_in, tokens_out, cost_usd, latency_ms, sequence, created_at')
      .eq('thread_id', threadId)
      .order('sequence', { ascending: true })
    setMessages(data || [])
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50)
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const t = await loadThreads()
      if (!alive) return
      if (t.length > 0) {
        setActiveThreadId(t[0].id)
        await loadMessages(t[0].id)
      }
    })()
    return () => { alive = false }
  }, [loadThreads, loadMessages, agent.id])

  async function send() {
    if (!task.trim()) return
    if (!agent.is_active) { alert(`${agent.name} is paused. Activate first.`); return }
    setRunning(true); setError(null)
    const taskText = task
    setTask('')

    // Optimistic user bubble
    const tempUser = { id: `tmp-${Date.now()}`, role: 'user', content: taskText, sequence: -1, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, tempUser])
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50)

    try {
      const { data, error: invErr } = await supabase.functions.invoke('invoke-agent', {
        body: { agent_id: agent.id, task: taskText, thread_id: activeThreadId },
      })
      if (invErr) throw invErr
      if (data?.error) throw new Error(data.error + (data.detail ? ': ' + JSON.stringify(data.detail) : ''))
      const newThreadId = data.thread_id
      setActiveThreadId(newThreadId)
      await loadMessages(newThreadId)
      await loadThreads()
    } catch (e) {
      setError(e.message || String(e))
      // Roll back optimistic bubble
      setMessages((prev) => prev.filter((m) => m.id !== tempUser.id))
    } finally {
      setRunning(false)
    }
  }

  function newChat() {
    setActiveThreadId(null)
    setMessages([])
    setError(null)
    setTask('')
  }

  async function archiveThread(id) {
    if (!confirm('Archive this thread?')) return
    await supabase.from('ai_agent_threads').update({ archived: true }).eq('id', id)
    if (activeThreadId === id) { setActiveThreadId(null); setMessages([]) }
    await loadThreads()
  }

  const activeThread = threads.find((t) => t.id === activeThreadId)
  const totalCost = threads.reduce((sum, t) => sum + (t.total_cost_usd || 0), 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Thread list */}
      <div className="lg:col-span-1">
        <div className="bg-navy-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wider text-brand-blue">Threads</h3>
            <button onClick={newChat} className="text-xs text-slate-400 hover:text-white">+ new</button>
          </div>
          {threads.length === 0 ? (
            <div className="text-xs text-slate-500 italic">No threads yet. Start one below.</div>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => { setActiveThreadId(t.id); loadMessages(t.id) }}
                    className={`w-full text-left px-2 py-2 rounded-md text-xs leading-tight transition-colors group ${
                      activeThreadId === t.id ? 'bg-brand-blue/15 border border-brand-blue/50 text-white' : 'border border-transparent hover:bg-navy-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2">{t.title}</span>
                      <button onClick={(e) => { e.stopPropagation(); archiveThread(t.id) }}
                        className="text-slate-600 hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100"
                        title="archive">x</button>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {t.message_count} msg - ${(t.total_cost_usd || 0).toFixed(4)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {threads.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
              Total spent on {agent.name}: ${totalCost.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="lg:col-span-3">
        <div className="bg-navy-900 border border-slate-800 rounded-xl flex flex-col" style={{ minHeight: '60vh' }}>
          {/* Thread header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="text-sm text-slate-300 truncate flex-1">
              {activeThread ? activeThread.title : <span className="text-slate-500 italic">New conversation with {agent.name}</span>}
            </div>
            {activeThread && (
              <div className="text-[10px] text-slate-500 ml-2 whitespace-nowrap">
                {activeThread.message_count} msgs - {activeThread.total_tokens_in + activeThread.total_tokens_out} tokens - ${(activeThread.total_cost_usd || 0).toFixed(4)}
              </div>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '55vh' }}>
            {messages.length === 0 && !running && (
              <div className="text-center text-sm text-slate-500 italic py-12">
                Ask {agent.name} something. She has access to live Liftori state via the query_table tool.
              </div>
            )}
            {messages.map((m) => <MessageBubble key={m.id} m={m} agentName={agent.name} />)}
            {running && (
              <div className="flex items-center gap-2 text-sm text-slate-400 italic px-2">
                <div className="w-3 h-3 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                {agent.name} is thinking...
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-2 bg-rose-900/30 border-t border-rose-800/40 text-xs text-rose-300 font-mono">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-800 p-3 flex items-end gap-2">
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() }
              }}
              rows={2}
              style={INPUT_STYLE}
              className="flex-1 border focus:border-brand-blue rounded-md px-3 py-2 text-sm leading-relaxed resize-none"
              placeholder={`Message ${agent.name} - Cmd/Ctrl+Enter to send`}
              disabled={running}
            />
            <button
              onClick={send}
              disabled={running || !task.trim() || !agent.is_active}
              className="px-4 py-2 bg-brand-blue/20 border border-brand-blue text-white text-sm rounded-md hover:bg-brand-blue/30 disabled:opacity-50 disabled:cursor-not-allowed self-stretch"
            >
              {running ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ m, agentName }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-brand-blue/15 border border-brand-blue/40 rounded-lg px-3 py-2 text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
          {m.content}
        </div>
      </div>
    )
  }
  if (m.role === 'assistant') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <div className="text-[10px] text-brand-blue uppercase tracking-wider mb-1">{agentName}</div>
          <div className="bg-navy-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
            {m.content}
          </div>
          {(m.tokens_in > 0 || m.tokens_out > 0) && (
            <div className="text-[10px] text-slate-600 mt-1 ml-1">
              {m.tokens_in}/{m.tokens_out} tok - ${(m.cost_usd || 0).toFixed(6)} - {m.latency_ms}ms
            </div>
          )}
        </div>
      </div>
    )
  }
  if (m.role === 'tool_use' && m.tool_call) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2 text-xs">
          <div className="text-amber-300 font-mono font-semibold">tool_use: {m.tool_call.name}</div>
          <pre className="mt-1 text-amber-200/80 whitespace-pre-wrap font-mono text-[11px]">{JSON.stringify(m.tool_call.input, null, 2)}</pre>
        </div>
      </div>
    )
  }
  if (m.role === 'tool_result' && m.tool_result) {
    const content = String(m.tool_result.content || '')
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] bg-emerald-900/15 border border-emerald-800/30 rounded-lg px-3 py-2 text-xs">
          <details>
            <summary className="text-emerald-300 font-mono cursor-pointer">tool_result ({content.length} chars)</summary>
            <pre className="mt-2 text-emerald-200/70 whitespace-pre-wrap font-mono text-[11px] max-h-64 overflow-y-auto">{content}</pre>
          </details>
        </div>
      </div>
    )
  }
  return null
}
