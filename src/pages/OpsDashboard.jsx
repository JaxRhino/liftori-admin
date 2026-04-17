/**
 * OpsDashboard — Internal Liftori operations command center
 *
 * Replaces the previous "Coming Soon" stub with live KPIs powered by
 * existing Supabase tables. No new tables needed for v1.
 *
 * Widgets:
 *  1. 4 top KPI tiles (runway, MRR, active builds, currently clocked in)
 *  2. Cash Runway Clock (cash on hand + burn + inflow + days-to-zero)
 *  3. Daily Standup (signups today, active builds, open urgent tickets, pool depth)
 *  4. Revenue Pipeline funnel (count by project status)
 *  5. Team Utilization (hours this week per user)
 *  6. Project Health Scorecard (active projects, days-active, progress)
 *  7. Support Heat Map (tickets by priority + oldest open)
 */

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ─── CONFIG ───────────────────────────────────────
const ACTIVE_BUILD_STATUSES = ['Brief Review', 'Under Contract', 'In Build', 'QA']
const WEEK_HOURS_TARGET = 40

const PIPELINE_ORDER = [
  'New Lead',
  'Acct Created',
  'Wizard Started',
  'Wizard Complete',
  'Brief Review',
  'Estimate Sent',
  'Under Contract',
  'In Build',
  'Payment Hold',
  'Launched',
]

const PIPELINE_COLOR = {
  'New Lead':        'bg-sky-500',
  'Acct Created':    'bg-indigo-500',
  'Wizard Started':  'bg-violet-500',
  'Wizard Complete': 'bg-slate-500',
  'Brief Review':    'bg-yellow-500',
  'Estimate Sent':   'bg-amber-500',
  'Under Contract':  'bg-purple-500',
  'In Build':        'bg-brand-blue',
  'Payment Hold':    'bg-rose-500',
  'Launched':        'bg-emerald-500',
}

const TICKET_PRIORITY_COLOR = {
  urgent: 'bg-red-500/15 text-red-300 border-red-500/30',
  high:   'bg-orange-500/15 text-orange-300 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low:    'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

// ─── HELPERS ──────────────────────────────────────
const fmtMoney = (dollars) => {
  const n = Number(dollars || 0)
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

const fmtHours = (minutes) => {
  const h = (minutes || 0) / 60
  return h >= 10 ? `${h.toFixed(0)}h` : `${h.toFixed(1)}h`
}

const daysSince = (iso) => {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// ─── PAGE ─────────────────────────────────────────
export default function OpsDashboard() {
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [error, setError] = useState(null)

  // Core stats
  const [cashOnHand, setCashOnHand] = useState(0)
  const [monthlyBurn, setMonthlyBurn] = useState(0)
  const [monthlyInflow, setMonthlyInflow] = useState(0)
  const [totalMRR, setTotalMRR] = useState(0)
  const [activeBuildCount, setActiveBuildCount] = useState(0)
  const [clockedInCount, setClockedInCount] = useState(0)

  // Widget data
  const [signupsToday, setSignupsToday] = useState(0)
  const [poolDepth, setPoolDepth] = useState(0)
  const [pipelineCounts, setPipelineCounts] = useState({})
  const [teamHours, setTeamHours] = useState([])     // [{user_id, full_name, minutes}]
  const [activeBuilds, setActiveBuilds] = useState([])
  const [supportByPriority, setSupportByPriority] = useState({ urgent: 0, high: 0, medium: 0, low: 0 })
  const [oldestTickets, setOldestTickets] = useState([])
  const [urgentTicketCount, setUrgentTicketCount] = useState(0)
  const [recurringBurn, setRecurringBurn] = useState(0)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
      const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30)

      const [
        { data: cashAccounts },
        { data: expenses30d },
        { data: recurring },
        { data: payments30d },
        { data: mrrProjects },
        { count: activeBuilds },
        { count: activeTimers },
        { count: todaySignups },
        { count: poolOpen },
        { data: allStatuses },
        { data: teamEntries },
        { data: recentBuilds },
        { data: openTickets },
      ] = await Promise.all([
        supabase.from('finance_accounts').select('current_balance, account_type, is_active').eq('is_active', true).in('account_type', ['asset', 'bank', 'cash']),
        supabase.from('finance_expenses').select('amount, expense_date').gte('expense_date', monthAgo.toISOString().slice(0, 10)),
        supabase.from('finance_recurring').select('amount, frequency, transaction_type, is_active').eq('is_active', true),
        supabase.from('finance_payments').select('amount, payment_date, status').gte('payment_date', monthAgo.toISOString().slice(0, 10)).eq('status', 'completed'),
        supabase.from('projects').select('mrr').not('mrr', 'is', null).gt('mrr', 0),
        supabase.from('projects').select('*', { count: 'exact', head: true }).in('status', ACTIVE_BUILD_STATUSES),
        supabase.from('team_time_entries').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('waitlist_signups').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('tester_assignments').select('*', { count: 'exact', head: true }).is('assigned_to', null).in('status', ['assigned']),
        supabase.from('projects').select('status'),
        supabase.from('team_time_entries').select('user_id, duration_minutes, clock_in_at, clock_out_at, status, profiles:user_id(full_name)').gte('clock_in_at', weekAgo.toISOString()),
        supabase.from('projects').select('id, name, status, created_at, progress, profiles!projects_customer_id_fkey(full_name)').in('status', ACTIVE_BUILD_STATUSES).order('created_at', { ascending: false }).limit(10),
        supabase.from('support_tickets').select('id, subject, priority, status, created_at, customer_id').in('status', ['open', 'in_progress', 'waiting_on_client']).order('created_at', { ascending: true }),
      ])

      // Cash on hand — sum of active asset accounts
      const cash = (cashAccounts || []).reduce((s, a) => s + Number(a.current_balance || 0), 0)
      setCashOnHand(cash)

      // Monthly burn — use expenses in last 30 days as actual + recurring expense amount (monthly equivalent)
      const actualBurn = (expenses30d || []).reduce((s, e) => s + Number(e.amount || 0), 0)
      const recurMonthly = (recurring || [])
        .filter(r => r.transaction_type === 'expense' || r.transaction_type === 'bill' || r.transaction_type === 'payment')
        .reduce((s, r) => {
          const amt = Number(r.amount || 0)
          const freq = (r.frequency || '').toLowerCase()
          if (freq === 'monthly') return s + amt
          if (freq === 'yearly' || freq === 'annually') return s + amt / 12
          if (freq === 'weekly') return s + amt * 4.33
          if (freq === 'daily') return s + amt * 30
          return s + amt
        }, 0)
      const burn = actualBurn > 0 ? actualBurn : recurMonthly
      setMonthlyBurn(burn)
      setRecurringBurn(recurMonthly)

      // Monthly inflow — sum of completed payments last 30d
      const inflow = (payments30d || []).reduce((s, p) => s + Number(p.amount || 0), 0)
      setMonthlyInflow(inflow)

      // MRR — projects.mrr is in cents; convert to dollars for display
      const mrrDollars = (mrrProjects || []).reduce((s, p) => s + (p.mrr || 0) / 100, 0)
      setTotalMRR(mrrDollars)

      setActiveBuildCount(activeBuilds || 0)
      setClockedInCount(activeTimers || 0)
      setSignupsToday(todaySignups || 0)
      setPoolDepth(poolOpen || 0)

      // Pipeline counts
      const pipeline = {}
      PIPELINE_ORDER.forEach(s => { pipeline[s] = 0 })
      ;(allStatuses || []).forEach(p => {
        if (p.status && pipeline[p.status] !== undefined) pipeline[p.status]++
      })
      setPipelineCounts(pipeline)

      // Team hours this week, by user
      const perUser = {}
      ;(teamEntries || []).forEach(e => {
        if (!e.user_id) return
        const name = e.profiles?.full_name || 'Unknown'
        let mins = Number(e.duration_minutes || 0)
        // If still active/paused and no duration yet, compute from clock_in_at
        if ((!mins || mins === 0) && e.clock_in_at && (e.status === 'active' || e.status === 'paused')) {
          mins = Math.floor((Date.now() - new Date(e.clock_in_at).getTime()) / 60000)
        }
        if (!perUser[e.user_id]) perUser[e.user_id] = { user_id: e.user_id, full_name: name, minutes: 0 }
        perUser[e.user_id].minutes += mins
      })
      setTeamHours(Object.values(perUser).sort((a, b) => b.minutes - a.minutes).slice(0, 10))

      setActiveBuilds(recentBuilds || [])

      // Support — bucket by priority
      const byP = { urgent: 0, high: 0, medium: 0, low: 0 }
      ;(openTickets || []).forEach(t => {
        const p = (t.priority || 'medium').toLowerCase()
        if (byP[p] !== undefined) byP[p]++
      })
      setSupportByPriority(byP)
      setUrgentTicketCount(byP.urgent)
      setOldestTickets((openTickets || []).slice(0, 5))

      setLastRefresh(new Date())
    } catch (err) {
      console.error('[OpsDashboard] fetchAll failed:', err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  // ─── DERIVED ───
  const netMonthly = monthlyInflow - monthlyBurn
  const daysToZero = useMemo(() => {
    if (cashOnHand <= 0) return 0
    if (netMonthly >= 0) return null // runway is infinite (or positive)
    const dailyBurn = Math.abs(netMonthly) / 30
    if (dailyBurn <= 0) return null
    return Math.floor(cashOnHand / dailyBurn)
  }, [cashOnHand, netMonthly])

  const runwayColor =
    daysToZero === null ? 'text-emerald-400'
    : daysToZero < 30 ? 'text-red-400'
    : daysToZero < 60 ? 'text-orange-400'
    : daysToZero < 120 ? 'text-amber-400'
    : 'text-emerald-400'

  const pipelineTotal = Object.values(pipelineCounts).reduce((s, n) => s + n, 0)
  const pipelineMax = Math.max(1, ...Object.values(pipelineCounts))

  return (
    <div className="min-h-screen bg-navy-800">
      {/* Header */}
      <div className="relative px-6 py-10 overflow-hidden border-b border-navy-700/50">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 via-amber-600/10 to-orange-600/10 opacity-40" />
        <div className="relative max-w-7xl mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Ops Dashboard</h1>
              <p className="text-slate-400 text-sm">Live health of Liftori's internal operations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-slate-500">
                Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchAll}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand-blue/15 border border-brand-blue/30 text-brand-blue text-sm font-medium hover:bg-brand-blue/25 transition disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
            Failed to load dashboard data: {error}
          </div>
        )}

        {/* ─── ROW 1: 4 TOP KPI TILES ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label="Runway"
            value={daysToZero === null ? '∞' : `${daysToZero}d`}
            hint={daysToZero === null ? 'Net monthly positive' : `at ${fmtMoney(Math.abs(netMonthly))}/mo net burn`}
            valueClass={runwayColor}
          />
          <KpiTile
            label="Monthly MRR"
            value={fmtMoney(totalMRR)}
            hint={`${activeBuildCount} active build${activeBuildCount === 1 ? '' : 's'}`}
            valueClass="text-emerald-400"
          />
          <KpiTile
            label="Active Builds"
            value={activeBuildCount}
            hint={`${pipelineCounts['In Build'] || 0} in build, ${pipelineCounts['QA'] || 0} in QA`}
            valueClass="text-brand-blue"
          />
          <KpiTile
            label="Clocked In"
            value={clockedInCount}
            hint="team members on the clock now"
            valueClass={clockedInCount > 0 ? 'text-emerald-400' : 'text-slate-400'}
          />
        </div>

        {/* ─── ROW 2: CASH RUNWAY CLOCK ─── */}
        <section className="bg-navy-700/30 border border-navy-600/50 rounded-xl p-6">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-white font-semibold text-lg">Cash Runway Clock</h2>
              <p className="text-slate-400 text-xs">Cash on hand · 30-day inflow vs. burn · days to zero</p>
            </div>
            <Link to="/finance" className="text-brand-blue text-sm hover:underline">Open Finance Hub →</Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <RunwayCell label="Cash on Hand" value={fmtMoney(cashOnHand)} valueClass="text-white" />
            <RunwayCell label="Inflow (30d)" value={fmtMoney(monthlyInflow)} valueClass="text-emerald-400" sub="completed payments" />
            <RunwayCell label="Burn (30d)" value={fmtMoney(monthlyBurn)} valueClass="text-red-400" sub={monthlyBurn === 0 ? 'no expenses yet' : 'recorded expenses'} />
            <RunwayCell label="Net / mo" value={`${netMonthly >= 0 ? '+' : '-'}${fmtMoney(Math.abs(netMonthly))}`} valueClass={netMonthly >= 0 ? 'text-emerald-400' : 'text-red-400'} />
          </div>

          {/* Runway bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Days of runway</span>
              <span className={runwayColor}>
                {daysToZero === null ? 'Cash-flow positive' : `${daysToZero} days remaining`}
              </span>
            </div>
            <div className="h-3 bg-navy-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  daysToZero === null ? 'bg-emerald-500'
                  : daysToZero < 30 ? 'bg-red-500'
                  : daysToZero < 60 ? 'bg-orange-500'
                  : daysToZero < 120 ? 'bg-amber-500'
                  : 'bg-emerald-500'
                }`}
                style={{ width: `${daysToZero === null ? 100 : Math.min(100, (daysToZero / 180) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              Scale: 0–180 days. Green ≥ 120 days. Target: cash-flow positive by end of May.
              {recurringBurn > 0 && monthlyBurn === 0 && (
                <span className="ml-2 text-slate-400">(Est. recurring burn {fmtMoney(recurringBurn)}/mo — record expenses for real data.)</span>
              )}
            </p>
          </div>
        </section>

        {/* ─── ROW 3: DAILY STANDUP + PIPELINE ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Standup */}
          <section className="bg-navy-700/30 border border-navy-600/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Daily Standup</h2>
              <span className="text-xs text-slate-500">{new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="space-y-3">
              <StandupRow label="New signups today" value={signupsToday} link="/waitlist" accent={signupsToday > 0 ? 'text-emerald-400' : 'text-slate-400'} />
              <StandupRow label="Active builds" value={activeBuildCount} link="/projects" accent="text-brand-blue" />
              <StandupRow label="Urgent tickets" value={urgentTicketCount} link="/support-tickets" accent={urgentTicketCount > 0 ? 'text-red-400' : 'text-slate-400'} />
              <StandupRow label="Tester pool depth" value={poolDepth} link="/testing" accent="text-amber-400" />
              <StandupRow label="Team on the clock" value={clockedInCount} link="/team" accent={clockedInCount > 0 ? 'text-emerald-400' : 'text-slate-400'} />
            </div>
          </section>

          {/* Revenue Pipeline Funnel */}
          <section className="lg:col-span-2 bg-navy-700/30 border border-navy-600/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold">Revenue Pipeline</h2>
                <p className="text-slate-400 text-xs">{pipelineTotal} total projects across all stages</p>
              </div>
              <Link to="/pipeline" className="text-brand-blue text-sm hover:underline">Open Pipeline →</Link>
            </div>
            <div className="space-y-2">
              {PIPELINE_ORDER.map(stage => {
                const count = pipelineCounts[stage] || 0
                const pct = Math.max(2, (count / pipelineMax) * 100)
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs text-slate-300 w-32 truncate">{stage}</span>
                    <div className="flex-1 bg-navy-800 rounded-full h-5 overflow-hidden relative">
                      <div
                        className={`${PIPELINE_COLOR[stage]} h-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-white w-8 text-right font-medium">{count}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* ─── ROW 4: TEAM UTILIZATION + ACTIVE BUILDS ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Utilization */}
          <section className="bg-navy-700/30 border border-navy-600/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold">Team Utilization (last 7 days)</h2>
                <p className="text-slate-400 text-xs">Target {WEEK_HOURS_TARGET}h · logged via Time Clock bar</p>
              </div>
              <Link to="/team" className="text-brand-blue text-sm hover:underline">All team →</Link>
            </div>
            {teamHours.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No time logged this week yet.</p>
            ) : (
              <div className="space-y-3">
                {teamHours.map(u => {
                  const hours = (u.minutes / 60)
                  const pct = Math.min(100, (hours / WEEK_HOURS_TARGET) * 100)
                  const over = hours > WEEK_HOURS_TARGET * 1.1
                  const under = hours < WEEK_HOURS_TARGET * 0.5
                  return (
                    <div key={u.user_id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-white truncate max-w-[240px]">{u.full_name || 'Unknown'}</span>
                        <span className={`font-medium ${over ? 'text-red-400' : under ? 'text-slate-400' : 'text-emerald-400'}`}>
                          {fmtHours(u.minutes)}
                        </span>
                      </div>
                      <div className="h-2 bg-navy-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${over ? 'bg-red-500' : under ? 'bg-slate-500' : 'bg-emerald-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Active Builds Scorecard */}
          <section className="bg-navy-700/30 border border-navy-600/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold">Active Builds</h2>
                <p className="text-slate-400 text-xs">Live projects in Brief Review → QA</p>
              </div>
              <Link to="/projects" className="text-brand-blue text-sm hover:underline">All builds →</Link>
            </div>
            {activeBuilds.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No active builds right now.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {activeBuilds.map(b => {
                  const age = daysSince(b.created_at)
                  const stale = age > 30
                  return (
                    <Link
                      key={b.id}
                      to={`/projects/${b.id}`}
                      className="block p-3 rounded-lg bg-navy-800/40 border border-navy-700/40 hover:border-brand-blue/30 transition"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <span className="text-sm text-white font-medium truncate">{b.name || 'Untitled'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${PIPELINE_COLOR[b.status] || 'bg-slate-500'} text-white whitespace-nowrap`}>
                          {b.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="truncate max-w-[180px]">{b.profiles?.full_name || 'Unassigned'}</span>
                        <span className={stale ? 'text-orange-400' : ''}>{age ?? 0}d old</span>
                      </div>
                      {b.progress != null && (
                        <div className="mt-2 h-1 bg-navy-900 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-blue" style={{ width: `${b.progress || 0}%` }} />
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* ─── ROW 5: SUPPORT HEAT MAP ─── */}
        <section className="bg-navy-700/30 border border-navy-600/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-white font-semibold">Support Heat Map</h2>
              <p className="text-slate-400 text-xs">Open tickets by priority + oldest in queue</p>
            </div>
            <Link to="/support-tickets" className="text-brand-blue text-sm hover:underline">All tickets →</Link>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-5">
            {(['urgent', 'high', 'medium', 'low']).map(p => (
              <div key={p} className={`border rounded-lg p-4 ${TICKET_PRIORITY_COLOR[p]}`}>
                <p className="text-xs uppercase tracking-wider opacity-80 mb-1">{p}</p>
                <p className="text-2xl font-bold">{supportByPriority[p] || 0}</p>
              </div>
            ))}
          </div>
          {oldestTickets.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No open tickets. Inbox zero achieved.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Oldest open tickets</p>
              {oldestTickets.map(t => {
                const age = daysSince(t.created_at)
                return (
                  <Link
                    key={t.id}
                    to={`/support-tickets`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-navy-800/40 border border-navy-700/40 hover:border-brand-blue/30 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded border ${TICKET_PRIORITY_COLOR[(t.priority || 'medium').toLowerCase()]}`}>
                        {t.priority || 'medium'}
                      </span>
                      <span className="text-sm text-white truncate">{t.subject || '(no subject)'}</span>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{age ?? 0}d old</span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ─── FOOTER NOTE ─── */}
        <div className="text-center pt-4 pb-2 text-xs text-slate-500">
          Ops Dashboard v1 · Runway clock, standup, pipeline funnel, team utilization, active builds, support heat map · Built 2026-04-17
        </div>
      </div>
    </div>
  )
}

// ─── SUB-COMPONENTS ──────────────────────────────
function KpiTile({ label, value, hint, valueClass = 'text-white' }) {
  return (
    <div className="bg-navy-700/30 border border-navy-600/50 rounded-xl p-5">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold mb-1 ${valueClass}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function RunwayCell({ label, value, valueClass = 'text-white', sub }) {
  return (
    <div className="bg-navy-800/40 border border-navy-700/40 rounded-lg p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function StandupRow({ label, value, link, accent = 'text-slate-400' }) {
  const content = (
    <div className="flex items-center justify-between py-2 border-b border-navy-700/40 last:border-b-0">
      <span className="text-sm text-slate-300">{label}</span>
      <span className={`text-lg font-bold ${accent}`}>{value}</span>
    </div>
  )
  return link ? <Link to={link} className="block hover:bg-navy-800/30 -mx-2 px-2 rounded transition">{content}</Link> : content
}
