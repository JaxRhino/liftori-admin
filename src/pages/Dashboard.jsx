import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fetchDashboardStats } from '../lib/eosService'

const PIPELINE_STATUSES = [
  'Wizard Complete',
  'Brief Review',
  'Design Approval',
  'In Build',
  'QA',
  'Launched',
]

const PIPELINE_COLORS = {
  'Wizard Complete': { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  'Brief Review':   { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'Design Approval':{ bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'In Build':       { bg: 'bg-brand-blue/20', text: 'text-brand-blue' },
  'QA':             { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  'Launched':       { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
}

const ACTIVITY_DOT = {
  blue:   'bg-sky-400',
  purple: 'bg-purple-400',
  green:  'bg-emerald-400',
  orange: 'bg-orange-400',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [eosStats, setEosStats] = useState(null)
  const [stats, setStats] = useState({
    totalSignups: 0,
    todaySignups: 0,
    totalProjects: 0,
    activeProjects: 0,
    activeAffiliates: 0,
    totalCustomers: 0,
    totalMRR: 0,
    totalRevenue: 0,
  })
  const [recentSignups, setRecentSignups] = useState([])
  const [recentProjects, setRecentProjects] = useState([])
  const [weeklySignups, setWeeklySignups] = useState({ labels: [], counts: [], dayNames: [] })
  const [activityFeed, setActivityFeed] = useState([])
  const [pipelineCounts, setPipelineCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    if (user?.id) {
      fetchDashboardStats(user.id).then(setEosStats).catch(err => console.error('EOS stats:', err))
    }
  }, [user?.id])

  async function fetchDashboardData() {
    try {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      const days7ago = new Date(today)
      days7ago.setDate(days7ago.getDate() - 6)
      days7ago.setHours(0, 0, 0, 0)

      const [
        { count: totalSignups },
        { count: todaySignups },
        { count: totalProjects },
        { count: activeProjects },
        { count: activeAffiliates },
        { count: totalCustomers },
        { data: signups },
        { data: projects },
        { data: last7signups },
        { data: mrrProjects },
        { data: allStatuses },
        { data: paidInvoices },
        { data: recentUpdates },
        { data: recentMessages },
      ] = await Promise.all([
        supabase.from('waitlist_signups').select('*', { count: 'exact', head: true }),
        supabase.from('waitlist_signups').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }).in('status', ['In Build', 'QA']),
        supabase.from('affiliates').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('waitlist_signups').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('projects').select('*, profiles!projects_customer_id_fkey(full_name, email)').order('created_at', { ascending: false }).limit(5),
        supabase.from('waitlist_signups').select('created_at').gte('created_at', days7ago.toISOString()).order('created_at', { ascending: true }),
        supabase.from('projects').select('mrr').not('mrr', 'is', null).gt('mrr', 0),
        supabase.from('projects').select('status'),
        supabase.from('invoices').select('amount_cents').eq('status', 'paid'),
        supabase.from('project_updates').select('id, title, body, project_id, created_at, projects(id, name)').order('created_at', { ascending: false }).limit(10),
        supabase.from('chat_messages').select('id, content, created_at, profiles!chat_messages_sender_id_fkey(full_name)').order('created_at', { ascending: false }).limit(10),
      ])

      // 7-day sparkline
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const labels = []
      const counts = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        labels.push(dateStr)
        const count = (last7signups || []).filter(s => s.created_at.startsWith(dateStr)).length
        counts.push(count)
      }
      setWeeklySignups({ labels, counts, dayNames })

      // Financials
      const totalMRR = (mrrProjects || []).reduce((sum, p) => sum + (p.mrr || 0), 0)
      const totalRevenue = (paidInvoices || []).reduce((sum, i) => sum + (i.amount_cents || 0), 0)

      // Pipeline counts by status
      const pipeline = {}
      PIPELINE_STATUSES.forEach(s => { pipeline[s] = 0 })
      ;(allStatuses || []).forEach(p => {
        if (p.status && pipeline[p.status] !== undefined) pipeline[p.status]++
      })
      setPipelineCounts(pipeline)

      // Activity feed — merge 4 sources, sort desc, cap at 20
      const feed = [
        ...(signups || []).map(s => ({
          type: 'signup',
          text: `${s.full_name || 'Anonymous'} joined the waitlist`,
          sub: s.email,
          time: s.created_at,
          color: 'blue',
          link: '/waitlist',
        })),
        ...(projects || []).map(p => ({
          type: 'project',
          text: `"${p.name}" project created`,
          sub: p.profiles?.full_name || 'Unassigned customer',
          time: p.created_at,
          color: 'purple',
          link: `/projects/${p.id}`,
        })),
        ...(recentUpdates || []).map(u => ({
          type: 'update',
          text: u.title || (u.body ? u.body.slice(0, 70) : 'Project update posted'),
          sub: u.projects?.name || 'Unknown project',
          time: u.created_at,
          color: 'green',
          link: u.project_id ? `/projects/${u.project_id}` : '/projects',
        })),
        ...(recentMessages || []).map(m => ({
          type: 'chat',
          text: m.content ? m.content.slice(0, 80) : 'New message',
          sub: m.profiles?.full_name || 'Team member',
          time: m.created_at,
          color: 'orange',
          link: '/chat',
        })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20)

      setActivityFeed(feed)
      setStats({
        totalSignups: totalSignups || 0,
        todaySignups: todaySignups || 0,
        totalProjects: totalProjects || 0,
        activeProjects: activeProjects || 0,
        activeAffiliates: activeAffiliates || 0,
        totalCustomers: totalCustomers || 0,
        totalMRR,
        totalRevenue,
      })
      setRecentSignups(signups || [])
      setRecentProjects(projects || [])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header + Quick Actions */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Overview of your Liftori operations</p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <Link to="/projects" className="btn-primary text-sm">+ New Project</Link>
          <Link to="/waitlist" className="btn-secondary text-sm">View Waitlist</Link>
          <Link to="/chat" className="btn-secondary text-sm">Open Chat</Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Waitlist" value={stats.totalSignups} color="blue" />
        <StatCard label="Today" value={stats.todaySignups} color="cyan" />
        <StatCard label="Projects" value={stats.totalProjects} color="purple" />
        <StatCard label="Active Builds" value={stats.activeProjects} color="green" />
        <StatCard label="Active Affiliates" value={stats.activeAffiliates} color="orange" />
        <StatCard label="Customers" value={stats.totalCustomers} color="pink" />
      </div>

      {/* Financial Row + Sparkline */}
      <div className="grid lg:grid-cols-4 gap-6 mb-6">
        {/* Revenue */}
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-emerald-400">
              ${(stats.totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-600 mt-1">from paid invoices</p>
          </div>
          <div className="text-5xl font-bold text-emerald-400/10 select-none">$</div>
        </div>

        {/* MRR */}
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Monthly Recurring</p>
            <p className="text-3xl font-bold text-sky-400">
              ${(stats.totalMRR / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-600 mt-1">across active projects</p>
          </div>
          <div className="text-5xl font-bold text-sky-400/10 select-none">↑</div>
        </div>

        {/* 7-Day Sparkline */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Signups — Last 7 Days</p>
            <p className="text-sm font-semibold text-white">
              {weeklySignups.counts.reduce((a, b) => a + b, 0)} total
            </p>
          </div>
          <Sparkline
            counts={weeklySignups.counts}
            labels={weeklySignups.labels}
            dayNames={weeklySignups.dayNames}
          />
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Project Pipeline</h2>
          <Link to="/projects" className="text-brand-blue text-sm hover:underline">Manage →</Link>
        </div>
        <div className="flex flex-wrap gap-3">
          {PIPELINE_STATUSES.map(status => {
            const count = pipelineCounts[status] || 0
            const colors = PIPELINE_COLORS[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
            return (
              <Link
                key={status}
                to={`/projects?status=${encodeURIComponent(status)}`}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg ${colors.bg} hover:opacity-80 transition-opacity`}
              >
                <span className={`text-2xl font-bold leading-none ${colors.text}`}>{count}</span>
                <span className={`text-xs font-medium ${colors.text} opacity-80`}>{status}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* EOS Widget */}
      {eosStats && <EOSWidget stats={eosStats} />}

      {/* Bottom Row: Signups | Projects | Activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Signups */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Signups</h2>
            <Link to="/waitlist" className="text-brand-blue text-sm hover:underline">View all</Link>
          </div>
          {recentSignups.length === 0 ? (
            <p className="text-gray-500 text-sm">No signups yet</p>
          ) : (
            <div className="space-y-3">
              {recentSignups.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-navy-700/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{s.full_name || 'Anonymous'}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString()}</p>
                    {s.referral_code && (
                      <span className="badge bg-brand-blue/10 text-brand-blue mt-1">ref: {s.referral_code}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Projects */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Projects</h2>
            <Link to="/projects" className="text-brand-blue text-sm hover:underline">View all</Link>
          </div>
          {recentProjects.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No projects yet.{' '}
              <Link to="/waitlist" className="text-brand-blue hover:underline">Convert a waitlist signup</Link> to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map(p => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="flex items-center justify-between py-2 border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.profiles?.full_name || 'Unassigned'}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Activity</h2>
            <span className="text-xs text-gray-600">Live feed</span>
          </div>
          {activityFeed.length === 0 ? (
            <p className="text-gray-500 text-sm">No activity yet</p>
          ) : (
            <div className="space-y-0 max-h-96 overflow-y-auto pr-1">
              {activityFeed.map((item, i) => {
                const dot = ACTIVITY_DOT[item.color] || 'bg-gray-400'
                const inner = (
                  <>
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white leading-snug line-clamp-2">{item.text}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{item.sub} · {formatTimeAgo(item.time)}</p>
                    </div>
                  </>
                )
                if (item.link) {
                  return (
                    <Link
                      key={i}
                      to={item.link}
                      className="flex gap-3 py-2.5 border-b border-navy-700/20 last:border-0 hover:bg-navy-700/20 -mx-2 px-2 rounded transition-colors"
                    >
                      {inner}
                    </Link>
                  )
                }
                return (
                  <div key={i} className="flex gap-3 py-2.5 border-b border-navy-700/20 last:border-0">
                    {inner}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EOSWidget({ stats }) {
  const nextMeeting = stats.next_meeting
  const rockPct = stats.rocks?.total > 0
    ? Math.round((stats.rocks.on_track / stats.rocks.total) * 100)
    : null
  const scorecardPct = stats.scorecard?.total_metrics > 0
    ? Math.round((stats.scorecard.green_count / stats.scorecard.total_metrics) * 100)
    : null

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
          EOS Pulse
        </h2>
        <Link to="/admin/eos" className="text-brand-blue text-sm hover:underline">Open EOS →</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Next L10 */}
        <Link to="/admin/eos/meetings" className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-4 hover:border-brand-blue/30 transition-colors">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Next L10</p>
          {nextMeeting ? (
            <>
              <p className="text-sm font-semibold text-white truncate">{nextMeeting.title}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(nextMeeting.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600">No meetings scheduled</p>
          )}
        </Link>

        {/* Scorecard Health */}
        <Link to="/admin/eos/scorecard" className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-4 hover:border-brand-blue/30 transition-colors">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Scorecard</p>
          {scorecardPct !== null ? (
            <>
              <p className={`text-2xl font-bold ${scorecardPct >= 80 ? 'text-emerald-400' : scorecardPct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {scorecardPct}%
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats.scorecard.green_count}/{stats.scorecard.total_metrics} green</p>
            </>
          ) : (
            <p className="text-sm text-gray-600">No metrics yet</p>
          )}
        </Link>

        {/* Rocks */}
        <Link to="/admin/eos/rocks" className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-4 hover:border-brand-blue/30 transition-colors">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Rocks</p>
          {stats.rocks?.total > 0 ? (
            <>
              <p className={`text-2xl font-bold ${rockPct >= 80 ? 'text-emerald-400' : rockPct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {stats.rocks.on_track}/{stats.rocks.total}
              </p>
              <p className="text-xs text-gray-400 mt-1">on track</p>
            </>
          ) : (
            <p className="text-sm text-gray-600">No rocks set</p>
          )}
        </Link>

        {/* To-Dos + Issues */}
        <Link to="/admin/eos/todos" className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-4 hover:border-brand-blue/30 transition-colors">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">To-Dos</p>
          <p className="text-2xl font-bold text-white">{stats.todos?.count || 0}</p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.todos?.due_this_week || 0} due this week · {stats.issues?.open_count || 0} open issues
          </p>
        </Link>
      </div>

      {/* Recent Headlines */}
      {stats.headlines?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-navy-700/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Recent Headlines</p>
            <Link to="/admin/eos/headlines" className="text-xs text-brand-blue hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {stats.headlines.slice(0, 3).map(h => (
              <div key={h.id} className="flex items-start gap-2">
                <span className="text-xs mt-0.5">
                  {h.category === 'good_news' ? '🟢' : h.category === 'fyi' ? '🔵' : h.category === 'issue' ? '🔴' : '⚪'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{h.message}</p>
                  <p className="text-xs text-gray-500">{formatTimeAgo(h.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Sparkline({ counts, labels, dayNames }) {
  if (!counts || counts.length === 0) {
    return <div className="h-16 flex items-center justify-center text-gray-600 text-xs">No data</div>
  }
  const max = Math.max(...counts, 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {counts.map((count, i) => {
        const label = labels[i] ? (dayNames || [])[new Date(labels[i] + 'T12:00:00').getDay()] || '' : ''
        const barH = max === 0 ? 4 : Math.max(4, Math.round((count / max) * 48))
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
            <div
              className={`w-full rounded-sm transition-all ${count > 0 ? 'bg-brand-blue' : 'bg-navy-700/40'}`}
              style={{ height: `${barH}px` }}
              title={`${label}: ${count} signup${count !== 1 ? 's' : ''}`}
            />
            <span className="text-[9px] text-gray-600 leading-none">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function StatCard({ label, value, color }) {
  const colorMap = {
    blue:   'text-brand-blue',
    cyan:   'text-brand-cyan',
    purple: 'text-purple-400',
    green:  'text-emerald-400',
    orange: 'text-orange-400',
    pink:   'text-pink-400',
  }
  return (
    <div className="stat-card">
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] || 'text-white'}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const statusColors = {
    'Wizard Complete': 'bg-gray-500/20 text-gray-400',
    'Brief Review':    'bg-yellow-500/20 text-yellow-400',
    'Design Approval': 'bg-purple-500/20 text-purple-400',
    'In Build':        'bg-brand-blue/20 text-brand-blue',
    'QA':              'bg-orange-500/20 text-orange-400',
    'Launched':        'bg-emerald-500/20 text-emerald-400',
    'On Hold':         'bg-gray-500/20 text-gray-500',
    'Cancelled':       'bg-red-500/20 text-red-400',
  }
  return (
    <span className={`badge ${statusColors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status}
    </span>
  )
}
