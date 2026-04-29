import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const ROLE_META = {
  user_ryan:   { label: 'Ryan',         tone: 'bg-blue-500/15 text-blue-300 border-blue-500/30',         dot: 'bg-blue-400' },
  user_mike:   { label: 'Mike',         tone: 'bg-violet-500/15 text-violet-300 border-violet-500/30',   dot: 'bg-violet-400' },
  agent_ryan:  { label: "Ryan's agent", tone: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',         dot: 'bg-cyan-400' },
  agent_mike:  { label: "Mike's agent", tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',dot: 'bg-emerald-400' },
  system:      { label: 'System',       tone: 'bg-slate-500/15 text-slate-300 border-slate-500/30',      dot: 'bg-slate-400' },
}

function relTime(ts) {
  const d = new Date(ts), diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayBucket(ts) {
  const d = new Date(ts), now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  if (d >= startOfToday) return 'Today'
  if (d >= startOfYesterday) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function RolePill({ role }) {
  const m = ROLE_META[role] || ROLE_META.system
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${m.tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

function MessageRow({ msg }) {
  const meta = ROLE_META[msg.sender_role] || ROLE_META.system
  const ctx = msg.context || {}
  return (
    <div className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-baseline gap-2 mb-1">
        <RolePill role={msg.sender_role} />
        {msg.sender_display && <span className="text-xs text-white/40">{msg.sender_display}</span>}
        <span className="text-xs text-white/30 ml-auto">{relTime(msg.created_at)}</span>
      </div>
      <div className="text-sm text-white whitespace-pre-wrap break-words pl-1">{msg.body}</div>
      {Object.keys(ctx).length > 0 && (
        <div className="mt-2 pl-1 flex flex-wrap gap-1">
          {ctx.commit && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20">commit {String(ctx.commit).slice(0, 7)}</span>}
          {ctx.wave && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">{ctx.wave}</span>}
          {ctx.repo && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">{ctx.repo}</span>}
          {ctx.files && Array.isArray(ctx.files) && ctx.files.slice(0, 3).map((f, i) => (
            <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/60 border border-white/10">{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DevTeamAgentChat() {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  // Determine which "user_*" role this human is
  const senderRole = useMemo(() => {
    if (!profile) return null
    if (profile.email === 'ryan@liftori.ai' || profile.email === 'rhinomarch78@gmail.com') return 'user_ryan'
    if (profile.email === 'mike@liftori.ai') return 'user_mike'
    return null
  }, [profile])

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('dev_team_agent_chat')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(500)
    if (error) { setError(error.message); setLoading(false); return }
    setMessages(data || [])
    setLoading(false)
    setError(null)
  }

  useEffect(() => {
    fetchMessages()
    const ch = supabase
      .channel('dev_team_agent_chat_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_team_agent_chat' }, payload => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  async function send() {
    if (!composer.trim() || !senderRole || sending) return
    setSending(true)
    try {
      const { error } = await supabase.from('dev_team_agent_chat').insert({
        sender_role: senderRole,
        sender_user_id: user?.id || null,
        sender_display: profile?.display_name || profile?.email || null,
        body: composer.trim(),
      })
      if (error) throw error
      setComposer('')
    } catch (e) {
      alert('Send failed: ' + (e.message || e))
    } finally {
      setSending(false)
    }
  }

  const grouped = useMemo(() => {
    const groups = []
    let currentBucket = null
    for (const m of messages) {
      const b = dayBucket(m.created_at)
      if (b !== currentBucket) {
        groups.push({ bucket: b, items: [] })
        currentBucket = b
      }
      groups[groups.length - 1].items.push(m)
    }
    return groups
  }, [messages])

  const canPost = !!senderRole

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-300/80 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Agent Coordination
            </div>
            <h2 className="text-base font-semibold text-white mt-1">Cross-agent build channel</h2>
            <p className="text-xs text-white/50 mt-1 max-w-xl">
              Shared feed where Ryan's agent and Mike's agent coordinate without copy-paste through email.
              Both humans see every message; both agents read this thread at the start of every conversation
              and post updates whenever they have something for the other side.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ROLE_META).map(([role, m]) => (
              <span key={role} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${m.tone}`}>
                <span className={`w-1 h-1 rounded-full ${m.dot}`} /> {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 360px)', minHeight: '480px' }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto divide-y divide-white/5">
          {loading && <div className="text-white/40 text-sm p-6 text-center">Loading…</div>}
          {error && <div className="text-red-300 text-sm p-6 text-center">Error: {error}</div>}
          {!loading && messages.length === 0 && (
            <div className="text-white/40 text-sm p-12 text-center">
              No messages yet. Start the thread.
            </div>
          )}
          {grouped.map(group => (
            <div key={group.bucket}>
              <div className="px-5 py-2 bg-black/30 text-[10px] uppercase tracking-wider text-white/40 font-semibold sticky top-0 backdrop-blur z-10">
                {group.bucket}
              </div>
              {group.items.map(m => <MessageRow key={m.id} msg={m} />)}
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 bg-black/20 p-3">
          {canPost ? (
            <div className="flex gap-2">
              <textarea
                value={composer}
                onChange={e => setComposer(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={`Message as ${ROLE_META[senderRole]?.label || 'you'}… (Cmd/Ctrl + Enter to send)`}
                rows={2}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 resize-none focus:outline-none focus:border-cyan-400/50"
              />
              <button
                onClick={send}
                disabled={!composer.trim() || sending}
                className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 self-end"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          ) : (
            <div className="text-xs text-white/40 text-center py-2">
              Read-only — your account isn't mapped to a sender role yet (expected: ryan@liftori.ai or mike@liftori.ai).
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
