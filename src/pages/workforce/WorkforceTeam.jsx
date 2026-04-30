import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function todayStartIso() {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
function timeAgo(iso) {
  if (!iso) return null
  const now = Date.now()
  const t = new Date(iso).getTime()
  const sec = Math.floor((now - t) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function WorkforceTeam() {
  const [agents, setAgents] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        const todayIso = todayStartIso()

        const [agentsRes, invsRes, threadsRes, memoriesRes, chatRes, lastInvRes] = await Promise.all([
          supabase
            .from('ai_agents')
            .select('id, name, role, slug, tier, tagline, description, is_active, sort_order, pairs_with')
            .eq('category', 'executive')
            .order('sort_order', { ascending: true }),
          // Today invocations (for count + cost)
          supabase
            .from('ai_agent_invocations')
            .select('agent_id, cost_usd, tokens_in, tokens_out, status, created_at')
            .gte('created_at', todayIso),
          // Active (non-archived) threads
          supabase
            .from('ai_agent_threads')
            .select('agent_id, message_count, total_cost_usd')
            .eq('archived', false),
          // All memories
          supabase
            .from('ai_agent_memories')
            .select('agent_id'),
          // Latest agent chat snippets (most recent first, take 1 per agent)
          supabase
            .from('dev_team_agent_chat')
            .select('sender_display, body, created_at')
            .order('created_at', { ascending: false })
            .limit(80),
          // Most recent invocation per agent (for "active Xm ago")
          supabase
            .from('ai_agent_invocations')
            .select('agent_id, created_at, status')
            .order('created_at', { ascending: false })
            .limit(80),
        ])
        if (agentsRes.error) throw agentsRes.error

        const ags = agentsRes.data || []
        const stat = {}
        for (const a of ags) {
          stat[a.id] = {
            invocationsToday: 0, costToday: 0, errorsToday: 0,
            activeThreads: 0, memoriesCount: 0,
            latestSnippet: null, latestSnippetAt: null,
            lastInvocationAt: null, lastInvocationStatus: null,
          }
        }

        ;(invsRes.data || []).forEach((r) => {
          const s = stat[r.agent_id]; if (!s) return
          s.invocationsToday += 1
          s.costToday += Number(r.cost_usd) || 0
          if (r.status === 'error') s.errorsToday += 1
        })
        ;(threadsRes.data || []).forEach((r) => {
          const s = stat[r.agent_id]; if (!s) return
          s.activeThreads += 1
        })
        ;(memoriesRes.data || []).forEach((r) => {
          const s = stat[r.agent_id]; if (!s) return
          s.memoriesCount += 1
        })

        // First-seen per sender_display = latest because ordered desc
        const byName = {}
        for (const a of ags) byName[(a.name || '').toLowerCase()] = a.id
        const seenSnippet = new Set()
        ;(chatRes.data || []).forEach((m) => {
          const aid = byName[(m.sender_display || '').toLowerCase()]
          if (!aid || seenSnippet.has(aid)) return
          seenSnippet.add(aid)
          stat[aid].latestSnippet = m.body
          stat[aid].latestSnippetAt = m.created_at
        })

        // First-seen per agent_id = latest invocation
        const seenInv = new Set()
        ;(lastInvRes.data || []).forEach((r) => {
          if (seenInv.has(r.agent_id)) return
          seenInv.add(r.agent_id)
          if (stat[r.agent_id]) {
            stat[r.agent_id].lastInvocationAt = r.created_at
            stat[r.agent_id].lastInvocationStatus = r.status
          }
        })

        if (!alive) return
        setAgents(ags)
        setStats(stat)
      } catch (e) {
        if (alive) setError(e.message || String(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000) // refresh every 30s
    return () => { alive = false; clearInterval(interval) }
  }, [])

  if (loading && agents.length === 0) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
  }
  if (error) {
    return <div className="bg-red-900/30 border border-red-800/50 text-red-200 rounded-lg px-4 py-3 text-sm">Failed to load Workforce: {error}</div>
  }

  // Aggregate top-line stats
  const totals = Object.values(stats).reduce(
    (acc, s) => {
      acc.invocations += s.invocationsToday
      acc.cost += s.costToday
      acc.threads += s.activeThreads
      acc.memories += s.memoriesCount
      acc.errors += s.errorsToday
      return acc
    },
    { invocations: 0, cost: 0, threads: 0, memories: 0, errors: 0 }
  )

  return (
    <div>
      {/* Top stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        <TotalCard label="Invocations today" value={totals.invocations} />
        <TotalCard label="Spend today" value={`$${totals.cost.toFixed(4)}`} accent={totals.cost > 1 ? 'amber' : null} />
        <TotalCard label="Open threads" value={totals.threads} />
        <TotalCard label="Memories indexed" value={totals.memories} />
        <TotalCard label="Errors today" value={totals.errors} accent={totals.errors > 0 ? 'rose' : null} />
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map((a) => <AgentCard key={a.id} agent={a} stats={stats[a.id] || {}} />)}
      </div>
    </div>
  )
}

function TotalCard({ label, value, accent }) {
  const accentClasses = accent === 'amber' ? 'border-amber-700/40 bg-amber-900/15'
    : accent === 'rose' ? 'border-rose-700/40 bg-rose-900/15'
    : 'border-slate-800 bg-navy-900'
  return (
    <div className={`border rounded-lg p-3 ${accentClasses}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
    </div>
  )
}

function AgentCard({ agent, stats }) {
  const slugLower = (agent.slug || '').toLowerCase()
  const photoUrl = `/team/${slugLower}.jpg`

  // Pulse the avatar ring if the agent was invoked in the last 90s
  const recentlyActive = stats.lastInvocationAt
    ? (Date.now() - new Date(stats.lastInvocationAt).getTime()) < 90000
    : false

  // Tier badge color
  const tierClasses = {
    principal: 'bg-purple-900/30 text-purple-300 border-purple-800/40',
    senior:    'bg-sky-900/30 text-sky-300 border-sky-800/40',
    junior:    'bg-slate-800 text-slate-300 border-slate-700',
  }[agent.tier] || 'bg-slate-800 text-slate-400 border-slate-700'

  // Latest snippet truncation
  const snippet = stats.latestSnippet
    ? (stats.latestSnippet.length > 180 ? stats.latestSnippet.slice(0, 177) + '...' : stats.latestSnippet)
    : null

  return (
    <Link
      to={`/admin/workforce/agent/${agent.slug}`}
      className="bg-navy-900 border border-slate-800 hover:border-slate-700 hover:bg-navy-800/60 rounded-xl p-4 transition-all group flex flex-col"
    >
      {/* Header: avatar + name */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`relative w-14 h-14 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-brand-blue font-bold text-xl overflow-hidden flex-shrink-0 ring-2 ${
          recentlyActive ? 'ring-emerald-400/60 shadow-[0_0_10px_rgba(52,211,153,0.4)]' :
          agent.is_active ? 'ring-slate-700' : 'ring-slate-800 opacity-60'
        }`}>
          <img src={photoUrl} alt={agent.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <span className="absolute">{(agent.name || '?')[0]}</span>
          {recentlyActive && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-navy-900 animate-pulse" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-base font-bold text-white truncate">{agent.name}</h3>
            {!agent.is_active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">paused</span>}
            {agent.tier && <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${tierClasses}`}>{agent.tier}</span>}
          </div>
          <p className="text-[11px] text-brand-blue uppercase tracking-wider truncate mt-0.5">{agent.role}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {agent.pairs_with ? <>paired with <span className="text-slate-300">{agent.pairs_with}</span></> : 'autonomous'}
            {stats.lastInvocationAt && <> &middot; active <span className="text-slate-300">{timeAgo(stats.lastInvocationAt)}</span></>}
          </p>
        </div>
      </div>

      {/* Latest snippet */}
      <div className="bg-navy-950 border border-slate-800 rounded-md p-3 mb-3 flex-1 min-h-[68px]">
        {snippet ? (
          <>
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{snippet}</p>
            <p className="text-[10px] text-slate-600 mt-1.5">{timeAgo(stats.latestSnippetAt)}</p>
          </>
        ) : (
          <p className="text-xs text-slate-500 italic">No recent activity. Click to talk.</p>
        )}
      </div>

      {/* Mini stats row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <MiniStat label="Today" value={stats.invocationsToday || 0} highlight={stats.invocationsToday > 0} />
        <MiniStat label="Threads" value={stats.activeThreads || 0} />
        <MiniStat label="Memory" value={stats.memoriesCount || 0} />
        <MiniStat label="Spend" value={`$${(stats.costToday || 0).toFixed(stats.costToday > 0.01 ? 3 : 4)}`} highlight={stats.costToday > 1} />
      </div>

      {/* Errors callout if any */}
      {stats.errorsToday > 0 && (
        <div className="mt-2 text-[10px] text-rose-300 bg-rose-900/20 border border-rose-800/30 rounded px-2 py-1 text-center">
          {stats.errorsToday} error{stats.errorsToday > 1 ? 's' : ''} today
        </div>
      )}
    </Link>
  )
}

function MiniStat({ label, value, highlight }) {
  return (
    <div className={`rounded border ${highlight ? 'border-brand-blue/40 bg-brand-blue/10' : 'border-slate-800 bg-navy-950'} px-1.5 py-1`}>
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xs font-mono mt-0.5 ${highlight ? 'text-white font-bold' : 'text-slate-300'}`}>{value}</div>
    </div>
  )
}
