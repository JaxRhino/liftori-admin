import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import {
  fetchActiveEntry,
  clockIn as apiClockIn,
  clockOut as apiClockOut,
  fetchEntries,
  fetchLogs,
  formatDuration,
  liveDuration,
} from '../lib/timeTrackingService'
import WorkLogTab, { NewLogModal } from '../components/testing/WorkLogTab'
import TimesheetTab from '../components/testing/TimesheetTab'
import CommissionsTab from '../components/testing/CommissionsTab'

export default function Testing() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const isSuperAdmin = !!profile?.is_super_admin

  const [active, setActive] = useState(null)
  const [entries, setEntries] = useState([])
  const [logs, setLogs] = useState([])
  const [userLookup, setUserLookup] = useState({})
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('mine') // 'mine' | 'all'
  const [tab, setTab] = useState('work_log') // work_log | timesheet | commissions
  const [showForm, setShowForm] = useState(false)
  const [, setTick] = useState(0)

  const loadAll = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [act, ent, lg] = await Promise.all([
        fetchActiveEntry(user.id),
        fetchEntries({ userId: scope === 'all' ? null : user.id, limit: 200 }),
        fetchLogs({ userId: scope === 'all' ? null : user.id, limit: 200 }),
      ])
      setActive(act)
      setEntries(ent)
      setLogs(lg)

      // Build a user lookup from any user_ids in entries+logs (only super_admin will see "all")
      if (scope === 'all') {
        const ids = new Set()
        ent.forEach((e) => e.user_id && ids.add(e.user_id))
        lg.forEach((l) => l.user_id && ids.add(l.user_id))
        if (ids.size > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', Array.from(ids))
          const lookup = {}
          for (const r of data || []) lookup[r.id] = r
          setUserLookup(lookup)
        }
      } else {
        setUserLookup({ [user.id]: { id: user.id, full_name: profile?.full_name, email: user.email } })
      }
    } catch (err) {
      console.error('[Testing] loadAll', err)
      toast.error('Failed to load testing data')
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.email, profile?.full_name, scope])

  useEffect(() => { loadAll() }, [loadAll])

  // Tick the clock when active
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [active])

  async function handleClockIn(entryType = 'testing') {
    try {
      const entry = await apiClockIn({
        userId: user.id,
        orgId: profile?.org_id || null,
        entryType,
      })
      setActive(entry)
      toast.success('Clocked in')
      loadAll()
    } catch (err) {
      toast.error(err?.message?.includes('duplicate') ? 'Already clocked in' : 'Clock-in failed')
    }
  }

  async function handleClockOut() {
    if (!active?.id) return
    try {
      await apiClockOut(active.id)
      setActive(null)
      toast.success('Clocked out')
      loadAll()
    } catch {
      toast.error('Clock-out failed')
    }
  }

  // Quick stats
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEntries = entries.filter((e) => new Date(e.clock_in_at) >= today)
    const todayMinutes = todayEntries.reduce((a, e) => a + Number(e.duration_minutes || 0), 0)
    const openBugs = logs.filter((l) => l.category === 'bug' && ['open', 'triaged'].includes(l.status)).length
    const criticalOpen = logs.filter((l) => l.severity === 'critical' && !['fixed', 'wontfix', 'closed'].includes(l.status)).length
    return { todayMinutes, openBugs, criticalOpen, totalLogs: logs.length, totalEntries: entries.length }
  }, [entries, logs])

  if (loading && entries.length === 0 && logs.length === 0) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Testing & Work Log</h1>
            <p className="text-sm text-gray-400">Clock in, log every bug, track payouts. Critical bugs auto-alert Sage in #critical-bugs.</p>
          </div>
          {isSuperAdmin && (
            <div className="flex items-center gap-2 p-1 rounded-lg bg-navy-800 border border-navy-700/50">
              {['mine', 'all'].map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    scope === s ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {s === 'mine' ? 'My activity' : 'All team'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Status" value={active ? 'Clocked in' : 'Off the clock'} color={active ? 'text-emerald-400' : 'text-gray-500'} />
          <StatCard label="Today" value={formatDuration(stats.todayMinutes)} color="text-white" />
          <StatCard label="Open bugs" value={stats.openBugs} color={stats.openBugs > 0 ? 'text-rose-400' : 'text-gray-500'} />
          <StatCard label="Critical open" value={stats.criticalOpen} color={stats.criticalOpen > 0 ? 'text-rose-500' : 'text-gray-500'} />
          <StatCard label="Total logs" value={stats.totalLogs} color="text-white" />
        </div>

        {/* Clock card */}
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5">
          {active ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wide text-rose-400/80 font-semibold">Active session</div>
                  <div className="text-3xl font-bold tabular-nums">{formatDuration(liveDuration(active.clock_in_at))}</div>
                  <div className="text-xs text-gray-500">
                    Started {new Date(active.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {active.entry_type}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium">
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
                <div className="text-lg font-semibold text-white">You are not clocked in</div>
                <div className="text-sm text-gray-400">Start a session before logging work.</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['testing', 'work', 'meeting', 'admin'].map((t) => (
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

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-navy-700/50">
          {[
            { key: 'work_log', label: 'Work Log' },
            { key: 'timesheet', label: 'Timesheet' },
            ...(isSuperAdmin ? [{ key: 'commissions', label: 'Commissions' }] : []),
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab body */}
        {tab === 'work_log' && (
          <WorkLogTab
            logs={logs}
            userId={user.id}
            orgId={profile?.org_id || null}
            activeEntry={active}
            isSuperAdmin={isSuperAdmin}
            onChanged={loadAll}
            onRequestNewLog={() => setShowForm(true)}
          />
        )}
        {tab === 'timesheet' && (
          <TimesheetTab entries={entries} userLookup={userLookup} scope={scope} />
        )}
        {tab === 'commissions' && (
          <CommissionsTab userId={user.id} userLookup={userLookup} isSuperAdmin={isSuperAdmin} />
        )}
      </div>

      {/* New Log Modal */}
      {showForm && active && (
        <NewLogModal
          userId={user.id}
          orgId={profile?.org_id || null}
          timeEntryId={active.id}
          currentPath={location.pathname}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); loadAll() }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  )
}
