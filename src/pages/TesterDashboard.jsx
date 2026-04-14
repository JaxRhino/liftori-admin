/**
 * TesterDashboard — landing page for users with an active tester_enrollment.
 *
 * Shows:
 *  - Welcome + clock state (large)
 *  - My assigned work (from founders)
 *  - This week's progress toward min-hours target
 *  - My recent submissions (work logs)
 *  - Current commission period accrual
 *  - Quick actions
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import {
  fetchActiveEntry,
  clockIn as apiClockIn,
  clockOut as apiClockOut,
  fetchEntries,
  fetchLogs,
  fetchMyEnrollment,
  fetchPeriods,
  fetchMyAllocations,
  countActiveTesters,
  countQualifyingTesters,
  formatDuration,
  formatCurrency,
  liveDuration,
} from '../lib/timeTrackingService'
import { listAssignments, updateAssignment } from '../lib/testerProgramService'

const PRIORITY_COLORS = {
  urgent: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  high: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
}
const STATUS_COLORS = {
  assigned: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  in_progress: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  blocked: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  cancelled: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
}

export default function TesterDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [active, setActive] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [entries, setEntries] = useState([])
  const [logs, setLogs] = useState([])
  const [assignments, setAssignments] = useState([])
  const [periods, setPeriods] = useState([])
  const [allocations, setAllocations] = useState([])
  const [activeTesterCount, setActiveTesterCount] = useState(1)
  const [periodQualifierCounts, setPeriodQualifierCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const [act, enr, ent, lg, asg, pds, allocs] = await Promise.all([
        fetchActiveEntry(user.id),
        fetchMyEnrollment(user.id),
        fetchEntries({ userId: user.id, limit: 100 }),
        fetchLogs({ userId: user.id, limit: 30 }),
        listAssignments({ assignedTo: user.id, limit: 50 }),
        fetchPeriods({ limit: 6 }),
        fetchMyAllocations(user.id),
      ])
      setActive(act)
      setEnrollment(enr)
      setEntries(ent)
      setLogs(lg)
      setAssignments(asg)
      setPeriods(pds)
      setAllocations(allocs)

      // Active testers + per-closed-period qualifier counts (privacy-safe RPCs)
      const activeCount = await countActiveTesters()
      setActiveTesterCount(Math.max(1, activeCount))
      const closedPeriodIds = pds.filter((p) => ['closed', 'paid'].includes(p.status)).map((p) => p.id)
      if (closedPeriodIds.length > 0) {
        const counts = {}
        await Promise.all(closedPeriodIds.map(async (pid) => {
          counts[pid] = await countQualifyingTesters(pid)
        }))
        setPeriodQualifierCounts(counts)
      }
    } catch (e) {
      console.error('[TesterDashboard]', e)
      toast.error('Failed to load')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [active])

  async function handleClockIn(entryType = 'testing') {
    try {
      const e = await apiClockIn({ userId: user.id, orgId: profile?.org_id || null, entryType })
      setActive(e)
      toast.success('Clocked in')
    } catch {
      toast.error('Clock-in failed')
    }
  }

  async function handleClockOut() {
    try {
      await apiClockOut(active.id)
      setActive(null)
      toast.success('Clocked out')
      load()
    } catch {
      toast.error('Clock-out failed')
    }
  }

  async function changeAssignmentStatus(id, status) {
    try {
      await updateAssignment(id, { status })
      load()
    } catch {
      toast.error('Update failed')
    }
  }

  // Week progress
  const weekProgress = useMemo(() => {
    const target = Number(enrollment?.min_hours_per_week || 10)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const weekMinutes = entries
      .filter((e) => new Date(e.clock_in_at) >= monday && e.duration_minutes != null)
      .reduce((a, e) => a + Number(e.duration_minutes || 0), 0)
    const weekHours = weekMinutes / 60
    const pct = target > 0 ? Math.min(100, Math.round((weekHours / target) * 100)) : 0
    return { weekHours, target, pct, qualifies: weekHours >= target }
  }, [entries, enrollment])

  const todayMinutes = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return entries
      .filter((e) => new Date(e.clock_in_at) >= today)
      .reduce((a, e) => a + Number(e.duration_minutes || 0), 0)
  }, [entries])

  const openAssignments = assignments.filter((a) => ['assigned', 'in_progress'].includes(a.status))
  const recentLogs = logs.slice(0, 8)
  const currentPeriod = periods.find((p) => p.status === 'open') || periods[0]
  const myCurrentAllocation = currentPeriod ? allocations.find((a) => a.period_id === currentPeriod.id) : null

  // Commission projection — divides current pool by active tester count (best estimate)
  const projectedShare = useMemo(() => {
    if (!currentPeriod) return 0
    if (currentPeriod.per_tester_amount && Number(currentPeriod.per_tester_amount) > 0) {
      return Number(currentPeriod.per_tester_amount)
    }
    return Number(currentPeriod.pool_amount || 0) / activeTesterCount
  }, [currentPeriod, activeTesterCount])

  // Past period history with my allocations + qualifier counts
  const periodHistory = useMemo(() => {
    return periods
      .filter((p) => ['closed', 'paid'].includes(p.status))
      .map((p) => {
        const myAlloc = allocations.find((a) => a.period_id === p.id)
        return {
          ...p,
          my_share: Number(myAlloc?.share_amount || 0),
          my_qualified: !!myAlloc?.qualified,
          my_paid: !!myAlloc?.paid,
          qualifier_count: periodQualifierCounts[p.id] || 0,
        }
      })
  }, [periods, allocations, periodQualifierCounts])

  const maxPool = Math.max(1, ...periodHistory.map((p) => Number(p.pool_amount || 0)))

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!enrollment) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🧪</div>
          <h1 className="text-2xl font-bold text-white mb-2">No active tester enrollment</h1>
          <p className="text-gray-400">Your enrollment isn't active. Reach out to Ryan or Mike.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Hi {(profile?.full_name || profile?.first_name || user.email).split(' ')[0]} 👋</h1>
            <p className="text-sm text-gray-400">Your tester command center.</p>
          </div>
          <button
            onClick={() => navigate('/admin/testing')}
            className="text-sm px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-navy-700/50 rounded-lg text-gray-300"
          >
            Full Testing dashboard →
          </button>
        </div>

        {/* Top row: Clock + Week progress + Commission */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Clock card */}
          <div className="lg:col-span-2 bg-navy-800/60 border border-navy-700/50 rounded-xl p-5">
            {active ? (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                  </span>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-rose-400/80 font-bold">Active session</div>
                    <div className="text-4xl font-bold tabular-nums">{formatDuration(liveDuration(active.clock_in_at))}</div>
                    <div className="text-xs text-gray-500">
                      Started {new Date(active.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {active.entry_type}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigate('/admin/testing')} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium">
                    + Log entry
                  </button>
                  <button onClick={handleClockOut} className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-lg text-sm font-medium">
                    Clock out
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-lg font-semibold text-white">Ready to test?</div>
                  <div className="text-sm text-gray-400">Clock in to start tracking your time.</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {['testing', 'work', 'meeting'].map((t) => (
                    <button
                      key={t}
                      onClick={() => handleClockIn(t)}
                      className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm font-medium capitalize"
                    >
                      Clock in: {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick projected share card — bigger detail in Commission Tracker section below */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-xl p-5">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Projected this period</div>
            {currentPeriod ? (
              <>
                <div className="text-3xl font-bold text-emerald-400 mt-2 tabular-nums">{formatCurrency(projectedShare)}</div>
                <div className="text-xs text-gray-400 mt-1">
                  if you {weekProgress.qualifies ? 'maintain' : 'hit'} {enrollment.min_hours_per_week} hr/wk
                </div>
                <div className="text-[10px] text-gray-600 mt-2">
                  Pool: {formatCurrency(currentPeriod.pool_amount)} ÷ {activeTesterCount} active
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 mt-2">No period open yet</div>
            )}
          </div>
        </div>

        {/* Week progress strip */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">This week's hours</div>
              <div className="text-2xl font-bold text-white tabular-nums">
                {weekProgress.weekHours.toFixed(1)} <span className="text-base text-gray-500">/ {weekProgress.target} hr</span>
              </div>
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${weekProgress.qualifies ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
              {weekProgress.qualifies ? '✓ Min met' : `${(weekProgress.target - weekProgress.weekHours).toFixed(1)} hr to go`}
            </div>
          </div>
          <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
            <div className={`h-2 rounded-full transition-all ${weekProgress.qualifies ? 'bg-emerald-500' : 'bg-brand-blue'}`} style={{ width: `${weekProgress.pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>Today: {formatDuration(todayMinutes)}</span>
            <span>{weekProgress.pct}% to weekly minimum</span>
          </div>
        </div>

        {/* ═══════════════════════════════════ */}
        {/* Commission Tracker — pool + share + history */}
        {/* ═══════════════════════════════════ */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Commission Tracker</h2>
              <p className="text-[11px] text-gray-500">Your share of the monthly pool · {(Number(enrollment.commission_rate) * 100).toFixed(1)}% rate · {enrollment.min_hours_per_week} hr/wk minimum to qualify</p>
            </div>
          </div>

          {/* Current period */}
          <div className="px-5 py-4 border-b border-navy-700/50 bg-navy-900/30">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-3">
              Current period {currentPeriod && `(${currentPeriod.period_start} → ${currentPeriod.period_end})`}
            </div>
            {currentPeriod ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <CommMetric
                  label="Period pool"
                  value={formatCurrency(currentPeriod.pool_amount)}
                  hint={currentPeriod.status === 'open' ? 'live, updates at close' : 'finalized'}
                  color="text-white"
                />
                <CommMetric
                  label="Active testers"
                  value={activeTesterCount}
                  hint="enrolled in program"
                  color="text-sky-400"
                />
                <CommMetric
                  label="Your projected share"
                  value={formatCurrency(projectedShare)}
                  hint="if all active testers qualify"
                  color="text-emerald-400"
                />
                <CommMetric
                  label="Your status"
                  value={weekProgress.qualifies ? 'On track' : 'Need more hours'}
                  hint={weekProgress.qualifies
                    ? `${weekProgress.weekHours.toFixed(1)} / ${weekProgress.target} hr this week ✓`
                    : `${(weekProgress.target - weekProgress.weekHours).toFixed(1)} hr to qualify`}
                  color={weekProgress.qualifies ? 'text-emerald-400' : 'text-amber-400'}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">No commission period is open yet. Ryan opens the next one at the end of the month.</p>
            )}
            <div className="mt-3 text-[11px] text-gray-500 italic flex items-start gap-2">
              <span className="text-amber-400">●</span>
              <span>
                Your projected share is an estimate. The exact split is calculated when Ryan closes the period — pool ÷ testers who hit the {enrollment.min_hours_per_week} hr/wk minimum that period.
              </span>
            </div>
          </div>

          {/* History */}
          <div className="px-5 py-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-3">
              Recent periods
            </div>
            {periodHistory.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-2">No closed periods yet — your commission history will appear here.</p>
            ) : (
              <div className="space-y-2">
                {periodHistory.map((p) => {
                  const pctOfMax = Math.round((Number(p.pool_amount) / maxPool) * 100)
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-400 w-32 flex-shrink-0">{p.period_start} → {p.period_end}</span>
                        <span className="text-gray-500 hidden sm:inline">Pool {formatCurrency(p.pool_amount)} ÷ {p.qualifier_count || 0}</span>
                        <span className="ml-auto flex items-center gap-2">
                          <span className={`tabular-nums font-semibold ${p.my_qualified ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {p.my_qualified ? formatCurrency(p.my_share) : '—'}
                          </span>
                          {p.my_paid && <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">Paid</span>}
                          {p.my_qualified && !p.my_paid && <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">Pending</span>}
                          {!p.my_qualified && <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400">Not qual.</span>}
                        </span>
                      </div>
                      <div className="h-1.5 bg-navy-900 rounded-full overflow-hidden">
                        <div className="h-1.5 bg-gradient-to-r from-emerald-500/40 to-emerald-500 rounded-full" style={{ width: `${pctOfMax}%` }} />
                      </div>
                    </div>
                  )
                })}
                {/* Lifetime totals footer */}
                <div className="mt-4 pt-3 border-t border-navy-700/50 flex items-center justify-between text-xs">
                  <span className="text-gray-400">Lifetime earned (qualified periods)</span>
                  <span className="text-emerald-400 font-bold tabular-nums text-base">
                    {formatCurrency(periodHistory.filter((p) => p.my_qualified).reduce((s, p) => s + p.my_share, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* My Assignments */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">My Assignments</h2>
              <p className="text-[11px] text-gray-500">{openAssignments.length} open · {assignments.filter(a => a.status === 'completed').length} completed</p>
            </div>
          </div>
          {openAssignments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              No open assignments. You're free to test wherever you see fit.
            </div>
          ) : (
            <div className="divide-y divide-navy-700/40">
              {openAssignments.map((a) => (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  onChangeStatus={(s) => changeAssignmentStatus(a.id, s)}
                  onOpen={() => a.screen_path && navigate(a.screen_path)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent submissions */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">My Recent Submissions</h2>
            <button onClick={() => navigate('/admin/testing')} className="text-xs text-brand-blue hover:underline">View all →</button>
          </div>
          {recentLogs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">No submissions yet. Find your first bug.</div>
          ) : (
            <div className="divide-y divide-navy-700/40">
              {recentLogs.map((l) => (
                <div key={l.id} className="px-5 py-3 flex items-center gap-3">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${PRIORITY_COLORS[l.severity === 'critical' ? 'urgent' : l.severity] || PRIORITY_COLORS.medium}`}>
                    {l.severity}
                  </span>
                  <span className="text-[10px] uppercase text-gray-500 w-24 flex-shrink-0">{l.category.replace('_', ' ')}</span>
                  <span className="flex-1 text-sm text-white truncate">{l.title}</span>
                  <span className="text-[10px] text-gray-500 font-mono hidden md:inline">{l.screen_path || ''}</span>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                    l.status === 'fixed' ? 'bg-emerald-500/15 text-emerald-300' :
                    l.status === 'open' ? 'bg-rose-500/15 text-rose-300' :
                    'bg-slate-500/15 text-slate-400'
                  }`}>{l.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CommMetric({ label, value, hint, color = 'text-white' }) {
  return (
    <div className="bg-navy-900/40 border border-navy-700/40 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">{label}</div>
      <div className={`text-xl font-bold mt-0.5 tabular-nums ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-gray-500 mt-0.5">{hint}</div>}
    </div>
  )
}

function AssignmentRow({ assignment: a, onChangeStatus, onOpen }) {
  const [expanded, setExpanded] = useState(false)
  const overdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'completed'
  return (
    <>
      <div className="px-5 py-3 hover:bg-navy-800 transition cursor-pointer" onClick={() => setExpanded((x) => !x)}>
        <div className="flex items-start gap-3">
          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border whitespace-nowrap ${PRIORITY_COLORS[a.priority]}`}>{a.priority}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white">{a.title}</div>
            {a.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{a.description}</div>}
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
              {a.screen_path && <span className="font-mono">{a.screen_path}</span>}
              {a.due_date && <span className={overdue ? 'text-rose-400 font-semibold' : ''}>
                Due {new Date(a.due_date).toLocaleDateString()}{overdue ? ' (overdue)' : ''}
              </span>}
              {a.estimated_minutes && <span>~{a.estimated_minutes}min</span>}
            </div>
          </div>
          <select
            value={a.status}
            onChange={(e) => { e.stopPropagation(); onChangeStatus(e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 border-0 focus:outline-none ${STATUS_COLORS[a.status]}`}
          >
            {['assigned', 'in_progress', 'completed', 'blocked'].map((s) => (
              <option key={s} value={s} className="bg-navy-900 text-white">{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>
      {expanded && (
        <div className="px-5 py-4 bg-navy-900/60 border-t border-navy-700/30 space-y-3">
          {a.instructions && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">Instructions from founder</div>
              <div className="text-sm text-gray-200 whitespace-pre-wrap">{a.instructions}</div>
            </div>
          )}
          {a.tags?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {a.tags.map((t) => (
                <span key={t} className="text-[10px] text-gray-400 bg-navy-800 border border-navy-700/50 rounded px-2 py-0.5">#{t}</span>
              ))}
            </div>
          )}
          {a.screen_path && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpen() }}
              className="text-xs px-3 py-1.5 bg-brand-blue/15 hover:bg-brand-blue/25 border border-brand-blue/40 text-brand-blue rounded-md font-medium"
            >
              Open {a.screen_path} →
            </button>
          )}
        </div>
      )}
    </>
  )
}
