import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function DevTeamCanvas() {
  const [canvases, setCanvases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('dev_team_canvas')
          .select('id, title, slug, pinned, updated_at, last_edited_by')
          .order('pinned', { ascending: false })
          .order('title')
        if (error) throw error
        setCanvases(data || [])
      } catch (err) {
        console.error('[DevTeam] canvas load failed:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-amber-500/15 text-amber-300 font-semibold">Wave E</span>
        <div className="text-sm text-white/70">
          Realtime collaborative editing + presence cursors ship in Wave E. For now, canvases render read-only from <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">dev_team_canvas</code>.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && (
          <div className="col-span-2 text-center text-white/40 py-8">Loading…</div>
        )}
        {!loading && canvases.length === 0 && (
          <div className="col-span-2 text-center text-white/40 italic py-8">No canvases yet.</div>
        )}
        {canvases.map(c => (
          <Link
            key={c.id}
            to={`/admin/dev-team/canvas/${c.slug}`}
            className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 p-5 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base text-white font-semibold group-hover:text-brand-blue transition-colors">{c.title}</h3>
                <div className="text-xs text-white/40 font-mono mt-1">/{c.slug}</div>
              </div>
              {c.pinned && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-brand-blue/10 text-brand-blue font-semibold">Pinned</span>
              )}
            </div>
            <div className="text-xs text-white/40 mt-3">
              Updated {new Date(c.updated_at).toLocaleDateString()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
