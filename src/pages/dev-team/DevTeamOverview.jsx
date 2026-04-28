import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function StatCard({ label, value, hint, accent }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wider text-white/40 font-semibold">{label}</div>
      <div className={`text-3xl font-heading mt-2 ${accent || 'text-white'}`}>{value}</div>
      {hint && <div className="text-xs text-white/40 mt-1">{hint}</div>}
    </div>
  )
}

const TYPE_DOT = {
  file: 'bg-cyan-400', task: 'bg-violet-400', deployment: 'bg-emerald-400',
  memory: 'bg-amber-400', skill: 'bg-blue-400', canvas: 'bg-rose-400',
  note: 'bg-slate-400', commit: 'bg-orange-400', session: 'bg-pink-400',
}

function relTime(ts) {
  const d = new Date(ts)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

export default function DevTeamOverview() {
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [activity24h, setActivity24h] = useState(0)
  const [pinned, setPinned] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [m, t, ra, a24, pc] = await Promise.all([
      supabase.from('dev_team_members').select('user_id, display_name, email, role_in_team').eq('active', true).order('display_name'),
      supabase.from('dev_team_tasks').select('id, status, assignee_user_id, title, priority').neq('status', 'done'),
      supabase.from('dev_team_activity').select('id, author_display_name, action, target, target_type, created_at').order('created_at', { ascending: false }).limit(6),
      supabase.from('dev_team_activity').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('dev_team_canvas').select('slug, title, updated_at').eq('pinned', true).order('updated_at', { ascending: false }),
    ])
    setMembers(m.data || [])
    setTasks(t.data || [])
    setRecentActivity(ra.data || [])
    setActivity24h(a24.count || 0)
    setPinned(pc.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const ch = supabase
      .channel('dev_team_overview_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_team_activity' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_team_tasks' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_team_canvas' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Tasks by lane (open only)
  const byLane = useMemo(() => {
    const buckets = { __shared: [] }
    members.forEach(m => { buckets[m.user_id] = [] })
    tasks.forEach(t => {
      if (!t.assignee_user_id || !buckets[t.assignee_user_id]) buckets.__shared.push(t)
      else buckets[t.assignee_user_id].push(t)
    })
    return buckets
  }, [tasks, members])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Members" value={loading ? '—' : members.length} hint="In allowlist" />
        <StatCard label="Open Tasks"     value={loading ? '—' : tasks.length}   hint="queued + in-progress + blocked" />
        <StatCard label="Activity 24h"   value={loading ? '—' : activity24h}    hint="Events posted today" accent="text-brand-blue" />
        <StatCard label="Pinned Canvases" value={loading ? '—' : pinned.length} hint="Team docs" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Recent Activity
            </h2>
            <Link to="/admin/dev-team/activity" className="text-xs text-brand-blue hover:underline">View all →</Link>
          </div>
          <div className="space-y-1.5">
            {recentActivity.length === 0 && (
              <div className="text-xs text-white/40 italic py-2">No events yet. Push scripts auto-emit deploy events; use the activity tab to log manually.</div>
            )}
            {recentActivity.map(e => (
              <div key={e.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOT[e.target_type] || 'bg-slate-400'}`}></span>
                <span className="text-sm text-white/80 truncate flex-1 min-w-0">
                  <span className="font-medium">{e.author_display_name}</span>
                  <span className="text-white/40"> · </span>
                  <span className="text-brand-blue font-mono text-xs">{e.action}</span>
                  {e.target && <><span className="text-white/40"> · </span><span className="text-white/50 font-mono text-xs">{e.target}</span></>}
                </span>
                <span className="text-[10px] text-white/40 whitespace-nowrap">{relTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Task lanes */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Open Tasks by Lane</h2>
            <Link to="/admin/dev-team/tasks" className="text-xs text-brand-blue hover:underline">View board →</Link>
          </div>
          <div className="space-y-2">
            {members.map(m => {
              const open = byLane[m.user_id] || []
              const inProg = open.filter(t => t.status === 'in_progress').length
              const queued = open.filter(t => t.status === 'queued').length
              const blocked = open.filter(t => t.status === 'blocked').length
              return (
                <Link key={m.user_id} to="/admin/dev-team/tasks" className="block rounded-lg bg-white/5 hover:bg-white/10 px-3 py-2.5 border border-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium">{m.display_name}</span>
                    <span className="text-xs text-white/60">{open.length} open</span>
                  </div>
                  <div className="flex gap-3 text-[10px] uppercase tracking-wider mt-1.5">
                    {inProg > 0 && <span className="text-blue-300">{inProg} in progress</span>}
                    {queued > 0 && <span className="text-slate-400">{queued} queued</span>}
                    {blocked > 0 && <span className="text-amber-300">{blocked} blocked</span>}
                    {open.length === 0 && <span className="text-white/30">clear</span>}
                  </div>
                </Link>
              )
            })}
            <Link to="/admin/dev-team/tasks" className="block rounded-lg bg-white/[0.02] hover:bg-white/5 px-3 py-2.5 border border-white/5 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70 font-medium">Shared / Unassigned</span>
                <span className="text-xs text-white/50">{(byLane.__shared || []).length} open</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Team */}
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
          </div>
        </div>

        {/* Pinned canvases */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Pinned Canvases</h2>
            <Link to="/admin/dev-team/canvas" className="text-xs text-brand-blue hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {pinned.length === 0 && <div className="text-xs text-white/40 italic">None pinned yet.</div>}
            {pinned.map(c => (
              <Link
                key={c.slug}
                to={`/admin/dev-team/canvas/${c.slug}`}
                className="block rounded-lg bg-white/5 hover:bg-white/10 px-3 py-2.5 border border-white/5 transition-colors"
              >
                <div className="text-sm text-white font-medium">{c.title}</div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-white/40 font-mono">/{c.slug}</span>
                  <span className="text-xs text-white/40">updated {relTime(c.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
