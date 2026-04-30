import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

const SESSION_KEY = 'liftori.welcomed_today'

export default function WelcomeBrief() {
  const { user, profile } = useAuth()
  const [ea, setEa] = useState(null)
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    const stamp = window.localStorage?.getItem(SESSION_KEY)
    if (!stamp) return false
    // Same calendar day = already welcomed
    const last = new Date(stamp)
    const now = new Date()
    return last.toDateString() === now.toDateString()
  })

  useEffect(() => {
    if (dismissed || !user) return
    let alive = true
    ;(async () => {
      try {
        // Find this user's personal EA via workforce_humans
        const { data: human } = await supabase
          .from('workforce_humans')
          .select('full_name, personal_ea_agent_slug, pairs_with_agent_slug')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!human) return // user not in workforce_humans roster

        // Prefer personal EA, fall back to strategic pairing
        const eaSlug = human.personal_ea_agent_slug || human.pairs_with_agent_slug
        if (!eaSlug) return

        const { data: agent } = await supabase
          .from('ai_agents')
          .select('id, name, slug, role, is_active')
          .eq('slug', eaSlug)
          .maybeSingle()
        if (!agent || !agent.is_active) return

        if (!alive) return
        setEa(agent)
        setLoading(true)

        const firstName = (human.full_name || '').split(' ')[0]
        const task = `${firstName} just logged in to the Liftori admin (${new Date().toLocaleString()}).
Greet them warmly by first name. Then check (use the tools available to you):
1. email_inbox for unread internal messages
2. query_table on notifications for unread notifications (filter by user_id eq ${user.id} if needed)
3. query_table on admin_calendar_events for events in the next 12 hours

Synthesize a short welcome brief - under 120 words total - structured as:
- One-line greeting
- Brief: messages waiting (count and 1-line snippets), notifications, upcoming calendar
- One closing line offering to take action

Match their preferred communication style (concise for Ryan, contextual for Mike, direct for Brian).
Write as if you are speaking directly to them. No preamble. No "I'll help you" filler. Lead with the substance.`

        const { data, error } = await supabase.functions.invoke('invoke-agent', {
          body: { agent_id: agent.id, task }
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        if (!alive) return

        setBrief(data.response || '')
      } catch (e) {
        console.warn('[WelcomeBrief] failed:', e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [user, dismissed])

  function dismiss() {
    try { window.localStorage?.setItem(SESSION_KEY, new Date().toISOString()) } catch {}
    setDismissed(true)
  }

  if (dismissed || !ea) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md bg-navy-900 border border-brand-blue/40 rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-2">
      <div className="px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-brand-blue/10 to-transparent flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-700/40 to-navy-800 flex items-center justify-center text-purple-300 font-bold ring-2 ring-purple-500/40 relative overflow-hidden">
          <img
            src={`/team/${ea.slug}.jpg`}
            alt={ea.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <span className="absolute">{ea.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{ea.name}</div>
          <div className="text-[10px] text-brand-blue uppercase tracking-wider">{ea.role}</div>
        </div>
        <button onClick={dismiss} className="text-slate-500 hover:text-slate-200 text-lg leading-none px-2">x</button>
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 italic">
            <div className="w-3 h-3 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            {ea.name} is checking your messages and calendar...
          </div>
        ) : brief ? (
          <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{brief}</div>
        ) : (
          <div className="text-sm text-slate-500 italic">No brief available right now.</div>
        )}
      </div>
      {brief && (
        <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between">
          <Link to={`/admin/workforce/agent/${ea.slug}`} className="text-xs text-brand-blue hover:underline">
            Talk to {ea.name} &rarr;
          </Link>
          <button onClick={dismiss} className="text-xs text-slate-500 hover:text-slate-300">dismiss</button>
        </div>
      )}
    </div>
  )
}
