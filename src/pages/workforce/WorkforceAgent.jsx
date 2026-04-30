import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function WorkforceAgent() {
  const { slug } = useParams()
  const [agent, setAgent] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        const { data: a, error: aErr } = await supabase
          .from('ai_agents')
          .select('*')
          .eq('slug', slug)
          .maybeSingle()
        if (aErr) throw aErr
        if (!a) {
          if (alive) { setError(`Agent "${slug}" not found.`); setLoading(false) }
          return
        }

        const { data: chat } = await supabase
          .from('dev_team_agent_chat')
          .select('id, body, sender_display, sender_role, created_at, context')
          .ilike('sender_display', a.name)
          .order('created_at', { ascending: false })
          .limit(20)

        if (!alive) return
        setAgent(a)
        setActivity(chat || [])
      } catch (e) {
        if (alive) setError(e.message || String(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [slug])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="bg-red-900/30 border border-red-800/50 text-red-200 rounded-lg px-4 py-3 text-sm">
        {error || 'Agent not found.'}
        <div className="mt-3"><Link to="/admin/workforce" className="text-brand-blue underline">Back to Workforce</Link></div>
      </div>
    )
  }

  const photoUrl = `/team/${(agent.slug || '').toLowerCase()}.jpg`

  return (
    <div>
      <div className="mb-6">
        <Link to="/admin/workforce" className="text-sm text-slate-400 hover:text-slate-200">&larr; Back to team</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-navy-900 border border-slate-800 rounded-xl p-6">
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-brand-blue font-bold text-4xl overflow-hidden ring-1 ring-slate-700 relative">
              <img
                src={photoUrl}
                alt={agent.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span className="absolute">{(agent.name || '?')[0]}</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white text-center">{agent.name}</h2>
            <p className="text-sm text-brand-blue uppercase tracking-wider text-center mt-1">{agent.role}</p>
            {agent.tagline && (
              <blockquote className="mt-5 text-sm text-slate-300 italic border-l-2 border-brand-blue pl-3 leading-relaxed">
                {agent.tagline}
              </blockquote>
            )}

            <dl className="mt-6 space-y-3 text-sm">
              {agent.pairs_with && (
                <div className="flex justify-between"><dt className="text-slate-500">Pairs with</dt><dd className="text-slate-200">{agent.pairs_with}</dd></div>
              )}
              {agent.tier && (
                <div className="flex justify-between"><dt className="text-slate-500">Tier</dt><dd className="text-slate-200 capitalize">{agent.tier}</dd></div>
              )}
              {agent.llm_model && (
                <div className="flex justify-between"><dt className="text-slate-500">Model</dt><dd className="text-slate-200 font-mono text-xs">{agent.llm_model}</dd></div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className="text-slate-200">{agent.is_active ? 'active' : 'inactive'}</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-2">
          {agent.description && (
            <div className="bg-navy-900 border border-slate-800 rounded-xl p-6 mb-6">
              <h3 className="text-sm uppercase tracking-wider text-brand-blue mb-3">About</h3>
              <p className="text-slate-300 leading-relaxed">{agent.description}</p>
            </div>
          )}

          <div className="bg-navy-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm uppercase tracking-wider text-brand-blue mb-4">Recent activity</h3>
            {activity.length === 0 ? (
              <div className="text-sm text-slate-500 italic">No recent activity logged.</div>
            ) : (
              <ul className="space-y-4">
                {activity.map((m) => (
                  <li key={m.id} className="text-sm">
                    <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">{m.body}</div>
                    <div className="text-xs text-slate-600 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
