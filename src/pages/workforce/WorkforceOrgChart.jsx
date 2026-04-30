import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const LAYERS = [
  { label: 'Founders', items: [
    { name: 'Ryan March', role: 'Founder · CEO', kind: 'human' },
    { name: 'Mike Lydon', role: 'Co-Founder · Product', kind: 'human' },
  ]},
  { label: 'Executive Team', match: ['Sage', 'Atlas'] },
  { label: 'Department Leads', match: ['Nova', 'Vega', 'Echo', 'Onyx', 'Iris'] },
]

export default function WorkforceOrgChart() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const { data, error: e } = await supabase
          .from('ai_agents')
          .select('name, role, slug, pairs_with')
          .eq('category', 'executive')
          .order('sort_order', { ascending: true })
        if (e) throw e
        if (!alive) return
        setAgents(data || [])
      } catch (err) {
        if (alive) setError(err.message || String(err))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
  if (error) return <div className="bg-red-900/30 border border-red-800/50 text-red-200 rounded-lg px-4 py-3 text-sm">{error}</div>

  const byName = Object.fromEntries(agents.map((a) => [a.name, a]))

  function AgentTile({ agent }) {
    const slugLower = (agent.slug || '').toLowerCase()
    return (
      <Link
        to={`/admin/workforce/agent/${agent.slug}`}
        className="block bg-navy-900 border border-slate-800 hover:border-brand-blue/50 rounded-lg p-3 text-center min-w-[140px] transition-colors"
      >
        <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-brand-blue font-bold text-base overflow-hidden ring-1 ring-slate-700 relative">
          <img
            src={`/team/${slugLower}.jpg`}
            alt={agent.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <span className="absolute">{agent.name[0]}</span>
        </div>
        <div className="mt-2 text-sm font-semibold text-white truncate">{agent.name}</div>
        <div className="text-[10px] text-brand-blue uppercase tracking-wider truncate mt-0.5">{agent.role}</div>
        {agent.pairs_with && (
          <div className="text-[10px] text-slate-500 mt-1">paired w/ {agent.pairs_with}</div>
        )}
      </Link>
    )
  }

  function HumanTile({ person }) {
    const initials = person.name.split(' ').map((p) => p[0]).join('').slice(0, 2)
    return (
      <div className="bg-navy-900 border-2 border-brand-blue/40 rounded-lg p-3 text-center min-w-[140px]">
        <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-brand-blue/30 to-navy-800 flex items-center justify-center text-white font-bold text-sm">
          {initials}
        </div>
        <div className="mt-2 text-sm font-semibold text-white truncate">{person.name}</div>
        <div className="text-[10px] text-brand-blue uppercase tracking-wider truncate mt-0.5">{person.role}</div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {LAYERS.map((layer, idx) => {
        const items = layer.items
          ? layer.items
          : (layer.match || []).map((n) => byName[n]).filter(Boolean)
        if (!items.length) return null
        return (
          <div key={layer.label}>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-3 text-center">{layer.label}</div>
            <div className="flex flex-wrap items-stretch justify-center gap-3">
              {items.map((it, i) =>
                it.kind === 'human'
                  ? <HumanTile key={i} person={it} />
                  : <AgentTile key={i} agent={it} />
              )}
            </div>
            {idx < LAYERS.length - 1 && (
              <div className="flex justify-center my-2">
                <div className="w-px h-6 bg-slate-700" />
              </div>
            )}
          </div>
        )
      })}

      <div className="text-center text-xs text-slate-600 mt-8">
        Org chart sources from <code className="text-slate-500">ai_agents</code> where <code className="text-slate-500">category = 'executive'</code>.
        Editing roster: update the table.
      </div>
    </div>
  )
}
