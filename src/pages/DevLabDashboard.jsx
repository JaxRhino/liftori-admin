// ============================================================
// DevLabDashboard.jsx -- /admin/dev-lab
// Consolidated view of dev work: dev team tasks, activity,
// support tickets, and testing/work-queue entry points.
// Access: super_admin, admin, dev, tester (gated at the route +
// the Operations nav). Reads the main Liftori DB.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const PRIORITY_COLOR = { urgent: '#ef4444', high: '#f59e0b', medium: '#06b6d4', low: '#94a3b8', p0: '#ef4444', p1: '#f59e0b', p2: '#06b6d4', p3: '#94a3b8' }
const STATUS_COLOR = { queued: '#94a3b8', in_progress: '#06b6d4', blocked: '#ef4444', review: '#a855f7', done: '#10b981' }
const TYPE_DOT = { file: 'bg-cyan-400', task: 'bg-violet-400', deployment: 'bg-emerald-400', memory: 'bg-amber-400', skill: 'bg-blue-400', canvas: 'bg-rose-400', note: 'bg-slate-400', commit: 'bg-orange-400', session: 'bg-pink-400' }
const OPEN_TICKET = ['open', 'pending', 'in_progress', 'new', 'waiting']

function relTime(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function StatCard({ label, value, hint, accent }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-wider text-white/40 font-semibold">{label}</div>
      <div className={`text-3xl font-heading mt-2 ${accent || 'text-white'}`}>{value}</div>
      {hint && <div className="text-xs text-white/40 mt-1">{hint}</div>}
    </div>
  )
}

function Pill({ children, color }) {
  return <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider" style={{ borderColor: (color || '#475569') + '66', color: color || '#94a3b8' }}>{children}</span>
}

export default function DevLabDashboard() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([])
  const [activity24h, setActivity24h] = useState(0)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const [t, m, ra, a24, tk] = await Promise.all([
      supabase.from('dev_team_tasks').select('id, title, status, priority, assignee_user_id, wave, blocked_by, completed_at, created_at').order('created_at', { ascending: false }),
      supabase.from('dev_team_members').select('user_id, display_name').eq('active', true),
      supabase.from('dev_team_activity').select('id, author_display_name, action, target, target_type, created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('dev_team_activity').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('support_tickets').select('id, ticket_number, subject, priority, status, created_at').order('created_at', { ascending: false }).limit(50),
    ])
    setTasks(t.data || [])
    setMembers(m.data || [])
    setActivity(ra.data || [])
    setActivity24h(a24.count || 0)
    setTickets(tk.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const ch = supabase.channel('dev_lab_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_team_tasks' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_team_activity' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const memberName = (id) => members.find(m => m.user_id === id)?.display_name
  const stats = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'done')
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
    return {
      open: open.length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      doneWeek: tasks.filter(t => t.status === 'done' && t.completed_at && new Date(t.completed_at).getTime() >= weekAgo).length,
      openTickets: tickets.filter(t => OPEN_TICKET.includes((t.status || '').toLowerCase())).length,
      mine: open.filter(t => t.assignee_user_id === user?.id).length,
    }
  }, [tasks, tickets, user])

  const openTasks = useMemo(() => {
    const rank = { urgent: 0, p0: 0, high: 1, p1: 1, medium: 2, p2: 2, low: 3, p3: 3 }
    return tasks.filter(t => t.status !== 'done')
      .sort((a, b) => (rank[(a.priority || '').toLowerCase()] ?? 9) - (rank[(b.priority || '').toLowerCase()] ?? 9))
      .slice(0, 12)
  }, [tasks])
  const openTickets = useMemo(() => tickets.filter(t => OPEN_TICKET.includes((t.status || '').toLowerCase())).slice(0, 8), [tickets])

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">Dev Lab</h1>
            <p className="mt-1 text-sm text-slate-400">All the dev work in one place — tasks, activity, and tickets across the team.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/dev-team/tasks" className="rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-brand-cyan/40 hover:text-brand-cyan">Task board →</Link>
            <Link to="/admin/testing" className="rounded-md border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-brand-cyan/40 hover:text-brand-cyan">Testing →</Link>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Open Tasks" value={loading ? '—' : stats.open} hint="queued + in-prog + blocked" />
          <StatCard label="In Progress" value={loading ? '—' : stats.inProgress} accent="text-brand-blue" />
          <StatCard label="Blocked" value={loading ? '—' : stats.blocked} accent="text-red-400" />
          <StatCard label="Done (7d)" value={loading ? '—' : stats.doneWeek} accent="text-emerald-400" />
          <StatCard label="Open Tickets" value={loading ? '—' : stats.openTickets} accent="text-amber-400" />
          <StatCard label="Assigned to Me" value={loading ? '—' : stats.mine} accent="text-brand-cyan" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Open tasks */}
          <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Open Dev Tasks</h2>
              <Link to="/admin/dev-team/tasks" className="text-xs text-brand-blue hover:underline">View board →</Link>
            </div>
            {loading ? <div className="text-sm text-white/40 py-4">Loading…</div>
              : openTasks.length === 0 ? <div className="text-sm text-white/40 italic py-4">No open tasks. All clear.</div>
              : (
                <div className="space-y-1.5">
                  {openTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-2 px-2 rounded hover:bg-white/5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white/90 truncate">{t.title}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Pill color={STATUS_COLOR[t.status]}>{(t.status || '').replace('_', ' ')}</Pill>
                          {t.priority && <Pill color={PRIORITY_COLOR[(t.priority || '').toLowerCase()]}>{t.priority}</Pill>}
                          {t.wave && <Pill>{t.wave}</Pill>}
                          {t.assignee_user_id && <span className="text-[10px] text-white/40">{memberName(t.assignee_user_id) || 'assigned'}</span>}
                          {t.blocked_by && <span className="text-[10px] text-red-300/80">blocked</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Activity
              </h2>
              <span className="text-[10px] text-white/40">{activity24h} in 24h</span>
            </div>
            {loading ? <div className="text-sm text-white/40 py-4">Loading…</div>
              : activity.length === 0 ? <div className="text-xs text-white/40 italic py-2">No recent activity.</div>
              : (
                <div className="space-y-1.5">
                  {activity.map(e => (
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
              )}
          </div>
        </div>

        {/* Open support tickets */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Open Support Tickets</h2>
            <Link to="/admin/support-tickets" className="text-xs text-brand-blue hover:underline">View all →</Link>
          </div>
          {loading ? <div className="text-sm text-white/40 py-4">Loading…</div>
            : openTickets.length === 0 ? <div className="text-sm text-white/40 italic py-4">No open tickets.</div>
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {openTickets.map(t => (
                  <div key={t.id} className="flex items-center gap-2 py-2 px-3 rounded-lg border border-white/10 bg-white/[0.02]">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white/90 truncate">{t.subject || t.ticket_number}</div>
                      <div className="text-[10px] text-white/40">{t.ticket_number} · {relTime(t.created_at)}</div>
                    </div>
                    {t.priority && <Pill color={PRIORITY_COLOR[(t.priority || '').toLowerCase()]}>{t.priority}</Pill>}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
