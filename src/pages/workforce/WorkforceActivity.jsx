import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function WorkforceActivity() {
  const [messages, setMessages] = useState([])
  const [agents, setAgents] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function loadInitial() {
      try {
        setLoading(true)
        const [chatRes, agentRes] = await Promise.all([
          supabase
            .from('dev_team_agent_chat')
            .select('id, body, sender_display, sender_role, created_at, context, reply_to_id')
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('ai_agents')
            .select('name, slug, role')
            .eq('category', 'executive')
            .order('sort_order', { ascending: true })
        ])
        if (chatRes.error) throw chatRes.error
        if (!alive) return
        setMessages(chatRes.data || [])
        setAgents(agentRes.data || [])
      } catch (e) {
        if (alive) setError(e.message || String(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    loadInitial()

    // realtime subscription
    const channel = supabase
      .channel('workforce_activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dev_team_agent_chat' },
        (payload) => {
          if (!alive) return
          setMessages((prev) => [payload.new, ...prev].slice(0, 200))
        }
      )
      .subscribe()

    return () => { alive = false; try { supabase.removeChannel(channel) } catch {} }
  }, [])

  const filtered = filter === 'all'
    ? messages
    : messages.filter((m) => (m.sender_display || '').toLowerCase() === filter.toLowerCase())

  const senderColor = (name) => {
    const n = (name || '').toLowerCase()
    const map = {
      sage: 'text-purple-300',
      atlas: 'text-amber-300',
      nova: 'text-pink-300',
      vega: 'text-emerald-300',
      echo: 'text-sky-300',
      onyx: 'text-slate-300',
      iris: 'text-rose-300',
    }
    return map[n] || 'text-slate-200'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-800/50 text-red-200 rounded-lg px-4 py-3 text-sm">
        Failed to load Activity: {error}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
            filter === 'all'
              ? 'bg-brand-blue/20 border-brand-blue text-white'
              : 'bg-navy-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          All ({messages.length})
        </button>
        {agents.map((a) => (
          <button
            key={a.slug}
            onClick={() => setFilter(a.name)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              filter === a.name
                ? 'bg-brand-blue/20 border-brand-blue text-white'
                : 'bg-navy-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {a.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-navy-900 border border-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-400">No activity to show.</p>
          <p className="text-xs text-slate-600 mt-2">When agents post to dev_team_agent_chat, it streams here in real time.</p>
        </div>
      ) : (
        <div className="bg-navy-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
          {filtered.map((m) => (
            <div key={m.id} className="p-4 hover:bg-navy-800/40 transition-colors">
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`font-semibold text-sm ${senderColor(m.sender_display)}`}>{m.sender_display || 'unknown'}</span>
                {m.sender_role && (
                  <span className="text-xs text-slate-600 uppercase tracking-wider">{m.sender_role}</span>
                )}
                <span className="text-xs text-slate-600 ml-auto">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
