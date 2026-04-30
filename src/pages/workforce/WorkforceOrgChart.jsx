import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function WorkforceOrgChart() {
  const [humans, setHumans] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [hRes, aRes] = await Promise.all([
          supabase.from('workforce_humans')
            .select('*')
            .eq('active', true)
            .order('layer', { ascending: true })
            .order('sort_order', { ascending: true }),
          supabase.from('ai_agents')
            .select('id, name, role, slug, category, tier, pairs_with, sort_order, is_active')
            .order('category', { ascending: true })
            .order('sort_order', { ascending: true }),
        ])
        if (hRes.error) throw hRes.error
        if (aRes.error) throw aRes.error
        if (!alive) return
        setHumans(hRes.data || [])
        setAgents(aRes.data || [])
      } catch (e) {
        if (alive) setError(e.message || String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  if (loading) return <Loading />
  if (error) return <ErrorBox msg={error} />

  // Group humans
  const leadership = humans.filter((h) => h.layer === 'leadership')
  const cofounders = humans.filter((h) => h.layer === 'cofounders')
  const testers    = humans.filter((h) => h.layer === 'testers')

  // Build agent slug -> agent map for cross-lookup
  const agentBySlug = Object.fromEntries(agents.map((a) => [a.slug, a]))

  // Group agents by sort_order: <10 = leadership pairings (strategic + EA), >=10 = dept leads
  const execAgents = agents.filter((a) => a.category === 'executive' && (a.sort_order || 99) < 10)
  const deptLeads  = agents.filter((a) => a.category === 'executive' && (a.sort_order || 99) >= 10)
  const fieldAgents = agents.filter((a) => a.category === 'call_center')

  return (
    <div className="space-y-8">
      {leadership.length > 0 && (
        <Layer label="Leadership">
          {leadership.map((h) => <HumanTile key={h.id} person={h} agentBySlug={agentBySlug} />)}
        </Layer>
      )}

      {cofounders.length > 0 && (
        <>
          <Connector />
          <Layer label="Co-Founders">
            {cofounders.map((h) => <HumanTile key={h.id} person={h} agentBySlug={agentBySlug} />)}
          </Layer>
        </>
      )}

      {execAgents.length > 0 && (
        <>
          <Connector />
          <Layer label="AI Executive Team & Personal EAs">
            {execAgents.map((a) => <AgentTile key={a.id} agent={a} />)}
          </Layer>
        </>
      )}

      {deptLeads.length > 0 && (
        <>
          <Connector />
          <Layer label="AI Department Leads">
            {deptLeads.map((a) => <AgentTile key={a.id} agent={a} />)}
          </Layer>
        </>
      )}

      {fieldAgents.length > 0 && (
        <>
          <Connector />
          <Layer label="AI Field Agents (Call Center)">
            {fieldAgents.map((a) => <AgentTile key={a.id} agent={a} muted />)}
          </Layer>
        </>
      )}

      {testers.length > 0 && (
        <>
          <Connector />
          <Layer label="Quality &amp; Testing">
            {testers.map((h) => <HumanTile key={h.id} person={h} agentBySlug={agentBySlug} />)}
          </Layer>
        </>
      )}

      <div className="text-center text-[10px] text-slate-600 mt-12 pt-6 border-t border-slate-800">
        Org sourced from <code className="text-slate-500">workforce_humans</code> + <code className="text-slate-500">ai_agents</code>.
        Each leader can pair with a strategic agent and a personal EA.
      </div>
    </div>
  )
}

function Layer({ label, children }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-3 text-center">{label}</div>
      <div className="flex flex-wrap items-stretch justify-center gap-3">
        {children}
      </div>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="w-px h-6 bg-slate-700" />
    </div>
  )
}

function HumanTile({ person, agentBySlug }) {
  const initials = (person.full_name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2)
  const isOpen = person.is_open_seat
  const isLeadership = person.layer === 'leadership'

  const ring = isLeadership ? 'ring-amber-400/60'
    : person.layer === 'cofounders' ? 'ring-brand-blue/60'
    : 'ring-slate-700'
  const initialsBg = isLeadership ? 'bg-gradient-to-br from-amber-700/40 to-navy-800'
    : person.layer === 'cofounders' ? 'bg-gradient-to-br from-brand-blue/30 to-navy-800'
    : 'bg-gradient-to-br from-slate-700 to-navy-800'

  const strategic = person.pairs_with_agent_slug && agentBySlug[person.pairs_with_agent_slug]
  const ea = person.personal_ea_agent_slug && agentBySlug[person.personal_ea_agent_slug]
  const sameAgent = strategic && ea && strategic.slug === ea.slug

  return (
    <div className={`bg-navy-900 border-2 ${isOpen ? 'border-dashed border-slate-700 opacity-60' : 'border-slate-800'} rounded-lg p-3 text-center min-w-[170px] max-w-[220px]`}>
      <div className={`w-12 h-12 mx-auto rounded-full ${initialsBg} flex items-center justify-center text-white font-bold text-sm ring-2 ${ring}`}>
        {isOpen ? '+' : initials}
      </div>
      <div className="mt-2 text-sm font-semibold text-white truncate">{person.full_name}</div>
      <div className="text-[10px] text-brand-blue uppercase tracking-wider truncate mt-0.5">{person.role_title}</div>

      {(strategic || ea) && !isOpen && (
        <div className="mt-2 pt-2 border-t border-slate-800 space-y-0.5">
          {sameAgent ? (
            <Link to={`/admin/workforce/agent/${strategic.slug}`} className="block text-[10px] text-slate-400 hover:text-white">
              <span className="text-slate-500">paired w/</span> <span className="text-slate-200 capitalize font-medium">{strategic.name}</span>
            </Link>
          ) : (
            <>
              {strategic && (
                <Link to={`/admin/workforce/agent/${strategic.slug}`} className="block text-[10px] text-slate-400 hover:text-white">
                  <span className="text-slate-500">strategic:</span> <span className="text-slate-200 font-medium">{strategic.name}</span>
                </Link>
              )}
              {ea && (
                <Link to={`/admin/workforce/agent/${ea.slug}`} className="block text-[10px] text-slate-400 hover:text-white">
                  <span className="text-slate-500">EA:</span> <span className="text-slate-200 font-medium">{ea.name}</span>
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {isOpen && <div className="text-[10px] text-amber-400 mt-1 italic">open seat</div>}
    </div>
  )
}

function AgentTile({ agent, muted }) {
  const slugLower = (agent.slug || '').toLowerCase()
  const tierColor = {
    principal: 'ring-purple-500/40',
    senior:    'ring-sky-500/40',
    junior:    'ring-slate-600',
  }[agent.tier] || 'ring-slate-600'

  // Detect EA-style role to show a subtle badge
  const isEA = (agent.role || '').toLowerCase().includes('ea ') || (agent.role || '').toLowerCase().includes('assistant')

  return (
    <Link
      to={`/admin/workforce/agent/${agent.slug}`}
      className={`bg-navy-900 border ${agent.is_active ? 'border-slate-800 hover:border-brand-blue/50' : 'border-slate-800 opacity-50'} rounded-lg p-3 text-center min-w-[140px] max-w-[180px] transition-colors`}
    >
      <div className={`w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-brand-blue font-bold text-base overflow-hidden ring-2 ${tierColor} relative`}>
        <img
          src={`/team/${slugLower}.jpg`}
          alt={agent.name}
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <span className="absolute">{agent.name[0]}</span>
        {agent.is_active && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-navy-900" />
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-white truncate">{agent.name}</div>
      <div className={`text-[10px] uppercase tracking-wider truncate mt-0.5 ${muted ? 'text-slate-500' : 'text-brand-blue'}`}>{agent.role}</div>
      {agent.pairs_with && (
        <div className="text-[10px] text-slate-500 mt-1">
          paired w/ <span className="text-slate-300">{agent.pairs_with}</span>
        </div>
      )}
      <div className="flex items-center justify-center gap-1 mt-1">
        {agent.tier && (
          <span className="text-[9px] uppercase tracking-wider text-slate-600">{agent.tier}</span>
        )}
        {isEA && (
          <span className="text-[9px] uppercase tracking-wider text-pink-400/70 px-1 rounded bg-pink-900/20 border border-pink-800/40">EA</span>
        )}
      </div>
    </Link>
  )
}

function Loading() {
  return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
}

function ErrorBox({ msg }) {
  return <div className="bg-red-900/30 border border-red-800/50 text-red-200 rounded-lg px-4 py-3 text-sm">{msg}</div>
}
