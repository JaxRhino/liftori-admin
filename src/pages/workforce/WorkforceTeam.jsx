import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function WorkforceTeam() {
  const [agents, setAgents] = useState([])
  const [activityCounts, setActivityCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        const { data: ags, error: aErr } = await supabase
          .from('ai_agents')
          .select('id, name, role, slug, tier, tagline, description, is_active, sort_order, pairs_with')
          .eq('category', 'executive')
          .order('sort_order', { ascending: true })
        if (aErr) throw aErr

        // last 24h chat count per sender_display
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: chat } = await supabase
          .from('dev_team_agent_chat')
          .select('sender_display')
          .gte('created_at', since)
        const counts = {}
        ;(chat || []).forEach((row) => {
          const k = (row.sender_display || '').toLowerCase()
          counts[k] = (counts[k] || 0) + 1
        })

        if (!alive) return
        setAgents(ags || [])
        setActivityCounts(counts)
      } catch (e) {
        if (alive) setError(e.message || String(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

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
        Failed to load Workforce: {error}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((a) => {
        const slugLower = (a.slug || '').toLowerCase()
        const photoUrl = `/team/${slugLower}.jpg`
        const recent = activityCounts[(a.name || '').toLowerCase()] || 0
        return (
          <Link
            key={a.id}
            to={`/admin/workforce/agent/${a.slug}`}
            className="bg-navy-900 border border-slate-800 hover:border-slate-700 hover:bg-navy-800 rounded-xl p-5 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-brand-blue font-bold text-xl flex-shrink-0 overflow-hidden ring-1 ring-slate-700">
                <img
                  src={photoUrl}
                  alt={a.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
                <span className="absolute">{(a.name || '?')[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white truncate">{a.name}</h3>
                  {a.is_active && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-brand-blue uppercase tracking-wider mt-0.5">{a.role}</p>
              </div>
            </div>

            {a.tagline && (
              <blockquote className="mt-4 text-sm text-slate-400 italic border-l-2 border-slate-700 pl-3 leading-relaxed">
                {a.tagline}
              </blockquote>
            )}

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="text-slate-500">
                {a.pairs_with ? <>paired with <span className="text-slate-300">{a.pairs_with}</span></> : 'autonomous'}
              </div>
              <div className="text-slate-500">
                {recent > 0 ? (
                  <span className="text-emerald-400">{recent} actions / 24h</span>
                ) : (
                  <span>idle</span>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
