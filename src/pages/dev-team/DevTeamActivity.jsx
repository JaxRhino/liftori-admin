import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function DevTeamActivity() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('dev_team_activity')
          .select('id, author_display_name, action, target, target_type, details, session_id, created_at')
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw error
        setEvents(data || [])
      } catch (err) {
        console.error('[DevTeam] activity load failed:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-amber-500/15 text-amber-300 font-semibold">Wave D</span>
        <div className="text-sm text-white/70">
          Cooperative reporting + realtime stream ships in Wave D. Skills will post events as they work; this view will tail them live.
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
        {loading && (
          <div className="px-4 py-8 text-center text-white/40">Loading…</div>
        )}
        {!loading && events.length === 0 && (
          <div className="px-4 py-12 text-center text-white/40 italic">
            No activity events yet. The feed lights up once Wave D wires the skills to <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">logActivity()</code>.
          </div>
        )}
        {events.map(e => (
          <div key={e.id} className="px-4 py-3 hover:bg-white/5 transition-colors">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{e.author_display_name}</span>
                <span className="text-white/40">·</span>
                <span className="text-brand-blue font-mono text-xs">{e.action}</span>
                {e.target && (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="text-white/60 font-mono text-xs">{e.target}</span>
                  </>
                )}
              </div>
              <span className="text-xs text-white/40">{new Date(e.created_at).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
