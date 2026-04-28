import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wider text-white/40 font-semibold">{label}</div>
      <div className="text-3xl font-heading text-white mt-2">{value}</div>
      {hint && <div className="text-xs text-white/40 mt-1">{hint}</div>}
    </div>
  )
}

export default function DevTeamOverview() {
  const [stats, setStats] = useState({ members: 0, tasks: 0, activity: 0, files: 0 })
  const [members, setMembers] = useState([])
  const [pinned, setPinned] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [m, t, a, f, pc] = await Promise.all([
          supabase.from('dev_team_members').select('user_id, display_name, email, role_in_team, active').eq('active', true).order('display_name'),
          supabase.from('dev_team_tasks').select('id', { count: 'exact', head: true }),
          supabase.from('dev_team_activity').select('id', { count: 'exact', head: true }),
          supabase.from('dev_team_files_current').select('id', { count: 'exact', head: true }),
          supabase.from('dev_team_canvas').select('slug, title').eq('pinned', true).order('title'),
        ])
        if (cancelled) return
        setMembers(m.data || [])
        setPinned(pc.data || [])
        setStats({
          members: (m.data || []).length,
          tasks: t.count || 0,
          activity: a.count || 0,
          files: f.count || 0,
        })
      } catch (err) {
        console.error('[DevTeam] overview load failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Members" value={loading ? '—' : stats.members} hint="In dev_team_members allowlist" />
        <StatCard label="Open Tasks"     value={loading ? '—' : stats.tasks}   hint="Across all waves" />
        <StatCard label="Activity Events" value={loading ? '—' : stats.activity} hint="Lifetime" />
        <StatCard label="Synced Files"   value={loading ? '—' : stats.files}    hint="Skills + memory current" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Team</h2>
            <span className="text-xs text-white/40">{members.length} active</span>
          </div>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.user_id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5 border border-white/5">
                <div>
                  <div className="text-sm text-white font-medium">{m.display_name}</div>
                  <div className="text-xs text-white/40">{m.email}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-brand-blue/10 text-brand-blue font-semibold">
                  {m.role_in_team}
                </span>
              </div>
            ))}
            {!loading && members.length === 0 && (
              <div className="text-sm text-white/40 italic">No active members yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Pinned Canvases</h2>
            <Link to="/admin/dev-team/canvas" className="text-xs text-brand-blue hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {pinned.map(c => (
              <Link
                key={c.slug}
                to={`/admin/dev-team/canvas/${c.slug}`}
                className="block rounded-lg bg-white/5 hover:bg-white/10 px-3 py-2.5 border border-white/5 transition-colors"
              >
                <div className="text-sm text-white font-medium">{c.title}</div>
                <div className="text-xs text-white/40 font-mono">/{c.slug}</div>
              </Link>
            ))}
            {!loading && pinned.length === 0 && (
              <div className="text-sm text-white/40 italic">No pinned canvases yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Wave Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            { wave: 'A', title: 'Foundation',   status: 'shipping', desc: 'Schema, RLS, sidebar, route shell.' },
            { wave: 'B', title: 'Sync Skill',   status: 'next',     desc: 'Skills + memory propagation.' },
            { wave: 'C', title: 'Task Board',   status: 'queued',   desc: 'Pull-queue, lane discipline.' },
            { wave: 'D', title: 'Activity Feed', status: 'queued',  desc: 'Live cooperative reporting.' },
            { wave: 'E', title: 'Canvas',       status: 'queued',   desc: 'Realtime collab docs.' },
          ].map(w => (
            <div key={w.wave} className={`rounded-lg p-3 border ${w.status === 'shipping' ? 'border-brand-blue/40 bg-brand-blue/5' : 'border-white/5 bg-white/[0.02]'}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white/60">Wave {w.wave}</div>
                <div className={`text-[10px] uppercase tracking-wider font-semibold ${
                  w.status === 'shipping' ? 'text-brand-blue' :
                  w.status === 'next' ? 'text-amber-400' : 'text-white/30'
                }`}>{w.status}</div>
              </div>
              <div className="text-sm text-white font-medium mt-1">{w.title}</div>
              <div className="text-xs text-white/40 mt-1">{w.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
