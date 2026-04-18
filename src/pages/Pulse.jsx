/**
 * Pulse — Liftori team time-clock + leaderboard.
 *
 * Three sections:
 *   1. Live Now     — who's currently clocked in, how long, a tiny pulse
 *   2. This Week    — Monday-Sunday leaderboard with daily micro-bars
 *   3. All Time     — TTD rankings + gamified tier badges
 *
 * All team members can see all sessions (full transparency is the point).
 * Row actions open the SessionEditor modal for editing/adding offline time.
 *
 * Route: /admin/pulse (Operations → Pulse)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  fetchLiveNow,
  fetchWeeklyLeaderboard,
  fetchWeekDaily,
  fetchAllTimeLeaderboard,
  fetchUserSessions,
  groupWeekDailyByUser,
  formatDuration,
  formatHours,
  formatClock,
  tierFor,
  tierStyleFor,
  DAY_LABELS,
  isFounderEmail,
  sessionsToCSV,
  downloadCSV,
  reapIdle,
  resetAllPulseData,
} from '../lib/pulseService'
import SessionEditor from '../components/SessionEditor'
import {
  Activity, Clock, Calendar, Trophy, Crown, Flame, Sparkles,
  ChevronRight, Plus, Download, RefreshCw, Users, TrendingUp,
  Edit3, UserPlus, AlertOctagon,
} from 'lucide-react'

const TABS = [
  { key: 'live',    label: 'Live Now', icon: Activity },
  { key: 'week',    label: 'This Week', icon: Calendar },
  { key: 'allTime', label: 'All Time', icon: Trophy },
]

export default function Pulse() {
  const { user } = useAuth()
  const isFounder = isFounderEmail(user?.email)
  const [tab, setTab] = useState('live')
  const [loading, setLoading] = useState(true)
  const [liveNow, setLiveNow] = useState([])
  const [weekly, setWeekly] = useState([])
  const [weekDaily, setWeekDaily] = useState([])
  const [allTime, setAllTime] = useState([])
  const [, setTick] = useState(0)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSession, setEditorSession] = useState(null)   // session row or null
  const [editorMode, setEditorMode] = useState('offline')    // 'offline' | 'edit' | 'add_for_user'
  const [editorTargetUser, setEditorTargetUser] = useState(null)
  const [editorDefaultDate, setEditorDefaultDate] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [live, wk, wkd, all] = await Promise.all([
        fetchLiveNow(),
        fetchWeeklyLeaderboard(),
        fetchWeekDaily(),
        fetchAllTimeLeaderboard(),
      ])
      setLiveNow(live)
      setWeekly(wk)
      setWeekDaily(wkd)
      setAllTime(all)
    } catch (err) {
      console.error('[Pulse] load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Refresh every 30s so Live Now stays honest + durations update
  useEffect(() => {
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  // Tick once a second for the live-now running durations
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const weekByUser = useMemo(() => groupWeekDailyByUser(weekDaily), [weekDaily])

  const totals = useMemo(() => {
    const weekSec = weekly.reduce((acc, r) => acc + (r.weekly_seconds || 0), 0)
    const ttdSec  = allTime.reduce((acc, r) => acc + (r.ttd_seconds || 0), 0)
    return { weekSec, ttdSec, active: liveNow.length, team: allTime.length }
  }, [weekly, allTime, liveNow])

  function openOfflineEditor() {
    setEditorMode('offline')
    setEditorSession(null)
    setEditorTargetUser(null)
    setEditorDefaultDate(null)
    setEditorOpen(true)
  }

  function openEditExisting(sess) {
    setEditorMode('edit')
    setEditorSession(sess)
    setEditorTargetUser(null)
    setEditorDefaultDate(null)
    setEditorOpen(true)
  }

  function openAddForUser(targetUser, date = null) {
    setEditorMode('add_for_user')
    setEditorSession(null)
    setEditorTargetUser(targetUser)
    setEditorDefaultDate(date)
    setEditorOpen(true)
  }

  async function handleResetAll() {
    if (!isFounder) return
    const ok = window.confirm(
      'RESET all Pulse data?\n\n' +
      'This wipes every work_session and audit row.\n' +
      'Your own session from today will be preserved.\n\n' +
      'This cannot be undone. Continue?'
    )
    if (!ok) return
    const reason = window.prompt('Reason for reset (audit log):', 'Manual data reset')
    if (!reason || reason.trim().length < 3) return
    try {
      const deleted = await resetAllPulseData({ preserve_today: true, reason })
      await load()
      alert(`Pulse data reset. Deleted ${deleted} session(s). Your today session preserved.`)
    } catch (err) {
      alert('Reset failed: ' + err.message)
    }
  }

  async function handleReap() {
    try {
      const killed = await reapIdle(15)
      await load()
      alert(killed > 0 ? `Swept ${killed} idle session(s).` : 'No idle sessions to sweep.')
    } catch (err) {
      alert('Sweep failed: ' + err.message)
    }
  }

  async function handleExportMine() {
    if (!user?.id) return
    const sessions = await fetchUserSessions(user.id, { limit: 500 })
    downloadCSV(`pulse-${user.email}-${new Date().toISOString().slice(0, 10)}.csv`, sessionsToCSV(sessions))
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-400" />
            Pulse
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Team time clocks, daily rhythm, and hours leaderboard. Full transparency.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openOfflineEditor}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Log Offline Work
          </button>
          <button
            onClick={handleExportMine}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy-700 border border-navy-600 text-gray-300 hover:text-white text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            My CSV
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy-700 border border-navy-600 text-gray-300 hover:text-white text-xs font-semibold"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isFounder && (
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 text-xs font-semibold"
              title="Founder only — wipe Pulse data (preserves your today session)"
            >
              <AlertOctagon className="w-4 h-4" />
              Reset Pulse
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Activity} color="emerald" label="Active Now" value={totals.active} sub={`of ${totals.team} team`} />
        <StatCard icon={Calendar} color="sky" label="Hours This Week" value={formatHours(totals.weekSec)} sub="Mon → Sun" />
        <StatCard icon={Trophy} color="amber" label="Hours TTD" value={formatHours(totals.ttdSec)} sub="Team total" />
        <StatCard icon={Users} color="rose" label="Roster" value={totals.team} sub="Team members" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-navy-700/50">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                active
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'live'    && <LiveNow rows={liveNow} loading={loading} />}
      {tab === 'week'    && (
        <WeeklyLeaderboard
          rows={weekly}
          byUser={weekByUser}
          loading={loading}
          onEdit={openEditExisting}
          onAddForUser={openAddForUser}
          currentUserId={user?.id}
          isFounder={isFounder}
        />
      )}
      {tab === 'allTime' && (
        <AllTimeLeaderboard
          rows={allTime}
          loading={loading}
          onReap={handleReap}
          onAddForUser={openAddForUser}
          isFounder={isFounder}
        />
      )}

      {editorOpen && (
        <SessionEditor
          mode={editorMode}
          session={editorSession}
          targetUser={editorTargetUser}
          defaultDate={editorDefaultDate}
          onClose={() => {
            setEditorOpen(false)
            setEditorSession(null)
            setEditorTargetUser(null)
            setEditorDefaultDate(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Stat card
// ═══════════════════════════════════════════════════════════════════════
function StatCard({ icon: Icon, color, label, value, sub }) {
  const styles = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    sky:     'bg-sky-500/10 border-sky-500/30 text-sky-300',
    amber:   'bg-amber-500/10 border-amber-500/30 text-amber-300',
    rose:    'bg-rose-500/10 border-rose-500/30 text-rose-300',
  }[color]
  return (
    <div className={`p-4 rounded-xl border ${styles}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-80" />
        <p className="text-[11px] uppercase tracking-widest font-semibold opacity-80">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// LIVE NOW
// ═══════════════════════════════════════════════════════════════════════
function LiveNow({ rows, loading }) {
  if (loading && !rows.length) {
    return <div className="py-12 text-center text-gray-500 text-sm">Loading…</div>
  }
  if (!rows.length) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex w-14 h-14 rounded-full bg-navy-800 border border-navy-700 items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-gray-500" />
        </div>
        <p className="text-sm text-gray-400 font-semibold">No one is currently on the clock.</p>
        <p className="text-xs text-gray-600 mt-1">When a teammate clocks in, they'll show up here in real time.</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {rows.map((r) => (
        <LiveCard key={r.user_id} row={r} />
      ))}
    </div>
  )
}

function LiveCard({ row }) {
  // Live elapsed time since started_at
  const startedMs = row.started_at ? new Date(row.started_at).getTime() : Date.now()
  const elapsed = Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
  const founder = isFounderEmail(row.email)

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 hover:border-emerald-500/60 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={row.full_name || row.email} url={row.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white truncate">{row.full_name || row.email}</p>
            {founder && <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
          </div>
          <p className="text-[11px] text-gray-500 truncate">{row.role || 'team'}</p>
        </div>
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-xl font-bold text-emerald-300 tabular-nums">{formatClock(elapsed)}</span>
        <span className="text-[11px] text-gray-500">
          Since {new Date(startedMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// WEEKLY
// ═══════════════════════════════════════════════════════════════════════
function WeeklyLeaderboard({ rows, byUser, loading, onEdit, onAddForUser, currentUserId, isFounder }) {
  const [expanded, setExpanded] = useState(null)

  // Compute start-of-week (Monday) so day cells can be converted to dates.
  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay() // 0 = Sun
    const diff = (day === 0 ? -6 : 1 - day)
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  })()

  if (loading && !rows.length) {
    return <div className="py-12 text-center text-gray-500 text-sm">Loading…</div>
  }
  if (!rows.length) {
    return <div className="py-12 text-center text-gray-500 text-sm">No sessions this week yet.</div>
  }

  const max = Math.max(...rows.map((r) => r.weekly_seconds || 0), 1)

  return (
    <div className="space-y-1.5">
      {rows.map((r, idx) => {
        const isMe = r.user_id === currentUserId
        const isOpen = expanded === r.user_id
        const days = byUser[r.user_id] || new Array(7).fill(0)
        const dayMax = Math.max(...days, 1)
        const pct = ((r.weekly_seconds || 0) / max) * 100
        const founder = isFounderEmail(r.email)

        return (
          <div
            key={r.user_id}
            className={`rounded-xl border transition-colors ${
              isMe ? 'bg-sky-500/5 border-sky-500/30' : 'bg-navy-800/50 border-navy-700/50 hover:border-navy-600'
            }`}
          >
            <button
              className="w-full p-3 flex items-center gap-3 text-left"
              onClick={() => setExpanded(isOpen ? null : r.user_id)}
            >
              <RankBadge rank={idx + 1} />
              <Avatar name={r.full_name || r.email} url={r.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-white truncate">{r.full_name || r.email}</p>
                  {founder && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                  {isMe && <span className="text-[9px] uppercase tracking-widest text-sky-400 font-bold">You</span>}
                </div>
                <div className="mt-1 h-1.5 w-full bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-bold text-white tabular-nums">{formatDuration(r.weekly_seconds || 0)}</p>
                <p className="text-[10px] text-gray-500">this week</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-navy-700/50">
                <div className="grid grid-cols-7 gap-1 mt-2">
                  {DAY_LABELS.map((label, i) => {
                    const sec = days[i] || 0
                    const hPct = (sec / dayMax) * 100
                    const dayDate = new Date(weekStart.getTime() + i * 86400000)
                    const dayClickable = isFounder
                    return (
                      <div key={label} className="text-center">
                        <button
                          type="button"
                          onClick={dayClickable
                            ? () => onAddForUser({ id: r.user_id, full_name: r.full_name, email: r.email }, dayDate.toISOString())
                            : undefined}
                          disabled={!dayClickable}
                          className={`h-12 w-full flex items-end justify-center ${dayClickable ? 'hover:bg-amber-500/10 rounded cursor-pointer' : ''}`}
                          title={dayClickable
                            ? `Add session for ${r.full_name || r.email} on ${dayDate.toLocaleDateString()}`
                            : `${label}: ${formatDuration(sec)}`}
                        >
                          <div
                            className="w-full rounded-t bg-emerald-500/40 hover:bg-emerald-500/70 transition-colors"
                            style={{ height: `${Math.max(hPct, sec > 0 ? 6 : 0)}%` }}
                          />
                        </button>
                        <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-wider">{label}</p>
                        <p className="text-[10px] text-gray-400 font-semibold">{formatHours(sec)}</p>
                      </div>
                    )
                  })}
                </div>
                {isFounder && (
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      onClick={() => onAddForUser({ id: r.user_id, full_name: r.full_name, email: r.email }, null)}
                      className="text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 px-2 py-1 rounded flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      Add session for {r.full_name?.split(' ')[0] || 'user'}
                    </button>
                  </div>
                )}
                {(isMe || isFounder) && (
                  <div className="mt-3 pt-3 border-t border-navy-700/50">
                    <SessionRowsForUser userId={r.user_id} userName={r.full_name || r.email} onEdit={onEdit} isFounder={isFounder} />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SessionRowsForUser({ userId, userName, onEdit, isFounder }) {
  const [sessions, setSessions] = useState(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchUserSessions(userId, { limit: 10 })
        if (!cancelled) setSessions(data)
      } catch (err) {
        console.error(err)
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  if (!sessions) return <p className="text-xs text-gray-500">Loading sessions…</p>
  if (!sessions.length) return <p className="text-xs text-gray-500">No recent sessions.</p>

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-1">
        {userName ? `${userName}'s recent sessions` : 'Recent sessions'}
      </p>
      {sessions.slice(0, 5).map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-white hover:bg-navy-700/30 p-1.5 rounded cursor-pointer"
          onClick={() => onEdit(s)}
        >
          <Clock className="w-3 h-3 text-gray-600" />
          <span className="flex-1 tabular-nums">
            {new Date(s.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {' → '}
            {s.ended_at ? new Date(s.ended_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '…'}
          </span>
          {s.is_offline && (
            <span className="text-[9px] uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Offline</span>
          )}
          <span className="tabular-nums text-white font-semibold">{formatDuration(s.duration_seconds || 0)}</span>
          {isFounder && <Edit3 className="w-3 h-3 text-amber-400/70" />}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// ALL TIME
// ═══════════════════════════════════════════════════════════════════════
function AllTimeLeaderboard({ rows, loading, onReap, onAddForUser, isFounder }) {
  if (loading && !rows.length) {
    return <div className="py-12 text-center text-gray-500 text-sm">Loading…</div>
  }
  if (!rows.length) {
    return <div className="py-12 text-center text-gray-500 text-sm">No TTD hours yet. Clock in to be first!</div>
  }

  return (
    <div className="space-y-4">
      {/* Tier legend */}
      <TierLegend />

      {/* Rankings */}
      <div className="space-y-1.5">
        {rows.map((r, idx) => {
          const tier = tierFor(r.ttd_seconds || 0)
          const t = tierStyleFor(tier.key)
          const founder = isFounderEmail(r.email)
          return (
            <div
              key={r.user_id}
              className={`p-3 rounded-xl flex items-center gap-3 border ${
                idx === 0
                  ? 'bg-gradient-to-r from-amber-500/10 via-transparent to-transparent border-amber-500/40'
                  : 'bg-navy-800/50 border-navy-700/50'
              }`}
            >
              <RankBadge rank={idx + 1} big={idx < 3} />
              <Avatar name={r.full_name || r.email} url={r.avatar_url} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-white truncate">{r.full_name || r.email}</p>
                  {founder && <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${t.bg} ${t.text} border ${t.border}`}>
                    <TierIcon tier={tier.key} />
                    {tier.label}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {formatHours(r.mtd_seconds || 0)} MTD
                    {r.current_streak > 0 && (
                      <>{' · '}<Flame className="inline w-3 h-3 text-orange-400" /> {r.current_streak}-day streak</>
                    )}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-white tabular-nums">{formatHours(r.ttd_seconds || 0)}</p>
                <p className="text-[10px] text-gray-500">TTD</p>
              </div>
              {isFounder && (
                <button
                  onClick={() => onAddForUser({ id: r.user_id, full_name: r.full_name, email: r.email }, null)}
                  className="flex-shrink-0 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                  title={`Add a retroactive session for ${r.full_name || r.email}`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Founder admin action */}
      <div className="pt-4 border-t border-navy-700/50">
        <button
          onClick={onReap}
          className="text-[11px] text-gray-500 hover:text-amber-400 flex items-center gap-1.5"
          title="Sweep abandoned sessions older than 15 min (admin)"
        >
          <TrendingUp className="w-3 h-3" />
          Sweep stale sessions (15 min idle)
        </button>
      </div>
    </div>
  )
}

function TierLegend() {
  const TIERS = [
    { key: 'rookie',   label: 'Rookie',   hours: '0+' },
    { key: 'regular',  label: 'Regular',  hours: '40+' },
    { key: 'operator', label: 'Operator', hours: '200+' },
    { key: 'vet',      label: 'Vet',      hours: '500+' },
    { key: 'legend',   label: 'Legend',   hours: '1000+' },
  ]
  return (
    <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-navy-800/30 border border-navy-700/40">
      <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold self-center mr-1">Tiers</span>
      {TIERS.map((t) => {
        const s = tierStyleFor(t.key)
        return (
          <span
            key={t.key}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${s.bg} ${s.text} border ${s.border}`}
          >
            <TierIcon tier={t.key} />
            {t.label}
            <span className="opacity-60">{t.hours}h</span>
          </span>
        )
      })}
    </div>
  )
}

function TierIcon({ tier }) {
  switch (tier) {
    case 'legend':   return <Crown className="w-2.5 h-2.5" />
    case 'vet':      return <Trophy className="w-2.5 h-2.5" />
    case 'operator': return <Flame className="w-2.5 h-2.5" />
    case 'regular':  return <TrendingUp className="w-2.5 h-2.5" />
    default:         return <Sparkles className="w-2.5 h-2.5" />
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Shared bits
// ═══════════════════════════════════════════════════════════════════════
function RankBadge({ rank, big = false }) {
  const isTop3 = rank <= 3
  const styles = isTop3
    ? rank === 1
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
      : rank === 2
      ? 'bg-slate-400/20 text-slate-200 border-slate-400/50'
      : 'bg-orange-500/20 text-orange-300 border-orange-500/50'
    : 'bg-navy-700 text-gray-400 border-navy-600'
  const size = big ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs'
  return (
    <div className={`${size} flex-shrink-0 rounded-lg border flex items-center justify-center font-bold tabular-nums ${styles}`}>
      {rank}
    </div>
  )
}

function Avatar({ name, url, size = 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm'
  if (url) {
    return <img src={url} alt={name} className={`${dim} rounded-full object-cover flex-shrink-0`} />
  }
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
  return (
    <div className={`${dim} rounded-full bg-brand-blue/20 text-brand-blue font-bold flex items-center justify-center flex-shrink-0`}>
      {initials || '?'}
    </div>
  )
}
