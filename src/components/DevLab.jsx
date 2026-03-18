import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const SUPABASE_URL = 'https://qlerfkdyslndjbaltkwo.supabase.co'

export default function DevLab({ project }) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)

  // Load sessions for this project
  useEffect(() => {
    if (!project?.id) return
    loadSessions()
  }, [project?.id])

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSession) return
    loadMessages(activeSession.id)
  }, [activeSession?.id])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  async function loadSessions() {
    try {
      const { data, error } = await supabase
        .from('dev_lab_sessions')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setSessions(data || [])
      if (data?.length > 0 && !activeSession) {
        setActiveSession(data[0])
      }
    } catch (err) {
      console.error('Error loading sessions:', err)
    }
  }

  async function loadMessages(sessionId) {
    try {
      const { data, error } = await supabase
        .from('dev_lab_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setMessages(data || [])
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  async function startNewSession() {
    try {
      const { data, error } = await supabase
        .from('dev_lab_sessions')
        .insert({
          project_id: project.id,
          started_by: user.id,
          status: 'running',
        })
        .select()
        .single()
      if (error) throw error
      setSessions(prev => [data, ...prev])
      setActiveSession(data)
      setMessages([])
      return data
    } catch (err) {
      console.error('Error creating session:', err)
      return null
    }
  }

  async function startBuild() {
    let session = activeSession
    if (!session || session.status !== 'running') {
      session = await startNewSession()
      if (!session) return
    }

    const buildPrompt = `Build this project now. Here's what I need:

Project: ${project.name}
Type: ${project.project_type}
Brief: ${project.brief || 'No brief yet'}
Build Prompt: ${project.build_prompt || 'No specific build prompt'}
Features: ${project.features?.join(', ') || 'None specified'}
Vibe: ${project.vibe || 'Modern, clean'}

Start with the project structure, then build each file. Go.`

    await sendMessage(buildPrompt, session)
  }

  async function sendMessage(text, session = activeSession) {
    if (!text.trim() || streaming) return
    if (!session) {
      session = await startNewSession()
      if (!session) return
    }

    const userMessage = { role: 'user', content: text.trim() }

    // Save user message to DB
    await supabase.from('dev_lab_messages').insert({
      session_id: session.id,
      role: 'user',
      content: text.trim(),
      message_type: 'chat',
    })

    setMessages(prev => [...prev, { ...userMessage, id: Date.now(), message_type: 'chat', created_at: new Date().toISOString() }])
    setInput('')
    setStreaming(true)
    setStreamText('')

    // Build message history for Claude
    const history = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const token = authSession?.access_token

      abortRef.current = new AbortController()

      const response = await fetch(`${SUPABASE_URL}/functions/v1/dev-lab-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: history,
          sessionId: session.id,
          projectId: project.id,
          projectContext: {
            name: project.name,
            project_type: project.project_type,
            tier: project.tier,
            brief: project.brief,
            build_prompt: project.build_prompt,
            ai_brief: project.ai_brief,
            features: project.features,
            vibe: project.vibe,
          },
        }),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to get response')
      }

      // Stream the response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullText += parsed.delta.text
                setStreamText(fullText)
              }
            } catch {}
          }
        }
      }

      // Add the complete message
      if (fullText) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          content: fullText,
          message_type: fullText.includes('```') ? 'code' : 'chat',
          created_at: new Date().toISOString(),
        }])
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Stream error:', err)
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'system',
          content: `Error: ${err.message}`,
          message_type: 'error',
          created_at: new Date().toISOString(),
        }])
      }
    } finally {
      setStreaming(false)
      setStreamText('')
      abortRef.current = null
    }
  }

  function stopBuild() {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    setStreaming(false)
    setStreamText('')
  }

  function renderContent(content) {
    // Split content into code blocks and text
    const parts = content.split(/(```[\s\S]*?```)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const lines = part.slice(3, -3).split('\n')
        const lang = lines[0]?.trim() || ''
        const code = lines.slice(1).join('\n')
        return (
          <div key={i} className="my-3 rounded-lg overflow-hidden border border-white/10">
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10">
              <span className="text-xs text-white/40 font-mono">{lang || 'code'}</span>
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-sm font-mono leading-relaxed">
              <code className="text-emerald-400/90">{code}</code>
            </pre>
          </div>
        )
      }
      return part.split('\n').map((line, j) => (
        <span key={`${i}-${j}`}>
          {line}
          {j < part.split('\n').length - 1 && <br />}
        </span>
      ))
    })
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Sessions sidebar */}
      <div className="w-56 flex-shrink-0 bg-white/[0.02] rounded-xl border border-white/10 flex flex-col">
        <div className="p-3 border-b border-white/10">
          <button
            onClick={startNewSession}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-brand-blue/20 text-brand-blue text-sm font-medium hover:bg-brand-blue/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => { setActiveSession(s); setMessages([]) }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSession?.id === s.id
                  ? 'bg-brand-blue/20 text-brand-blue'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/70'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  s.status === 'running' ? 'bg-emerald-400' :
                  s.status === 'completed' ? 'bg-brand-blue' :
                  s.status === 'failed' ? 'bg-red-400' : 'bg-white/30'
                }`} />
                <span className="truncate">
                  {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </button>
          ))}
          {sessions.length === 0 && (
            <p className="text-white/30 text-xs text-center py-4">No sessions yet</p>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white/[0.02] rounded-xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-blue/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Dev Lab</h3>
              <p className="text-xs text-white/40">
                {streaming ? 'Building...' : activeSession ? `Session ${sessions.findIndex(s => s.id === activeSession.id) + 1}` : 'No active session'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!streaming ? (
              <button
                onClick={startBuild}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                Start Build
              </button>
            ) : (
              <button
                onClick={stopBuild}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Dev Lab Ready</h3>
              <p className="text-white/40 text-sm max-w-md mb-6">
                Press <strong className="text-emerald-400">Start Build</strong> to generate the full project, or type a message to chat with the AI developer.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  onClick={() => setInput('Show me the project structure first')}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 hover:text-white/70 transition-colors text-left"
                >
                  Show project structure
                </button>
                <button
                  onClick={() => setInput('What tech stack should we use?')}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 hover:text-white/70 transition-colors text-left"
                >
                  Suggest tech stack
                </button>
                <button
                  onClick={() => setInput('Build the landing page first')}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 hover:text-white/70 transition-colors text-left"
                >
                  Build landing page
                </button>
                <button
                  onClick={() => setInput('Create the database schema')}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 hover:text-white/70 transition-colors text-left"
                >
                  Create DB schema
                </button>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-brand-blue/20 text-white'
                  : msg.message_type === 'error'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                    : 'bg-white/[0.04] text-white/80'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    {renderContent(msg.content)}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
                <p className="text-[10px] text-white/20 mt-2">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {streaming && streamText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-4 py-3 bg-white/[0.04] text-white/80">
                <div className="prose prose-invert prose-sm max-w-none">
                  {renderContent(streamText)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-[10px] text-white/30">Generating...</span>
                </div>
              </div>
            </div>
          )}

          {streaming && !streamText && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-3 bg-white/[0.04]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-sm text-white/40">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
            className="flex items-end gap-3"
          >
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(input)
                  }
                }}
                placeholder="Type a message or press Start Build..."
                rows={1}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/30 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="px-4 py-3 rounded-xl bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
