import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../lib/AuthContext'
import {
  fetchActiveEntry,
  clockIn as apiClockIn,
  clockOut as apiClockOut,
  fetchEntries,
  fetchLogs,
  createLog,
  updateLog,
  resolveLog,
  LOG_CATEGORIES,
  LOG_SEVERITIES,
  LOG_STATUSES,
  formatDuration,
  liveDuration,
} from '../lib/timeTrackingService'

const CATEGORY_COLORS = {
  bug: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  enhancement: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  question: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  observation: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  task_complete: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  note: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

const SEVERITY_COLORS = {
  critical: 'bg-rose-600/20 text-rose-300',
  high: 'bg-orange-500/20 text-orange-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-sky-500/20 text-sky-300',
  info: 'bg-slate-500/20 text-slate-300',
}

const STATUS_COLORS = {
  open: 'bg-rose-500/15 text-rose-300',
  triaged: 'bg-amber-500/15 text-amber-300',
  in_progress: 'bg-sky-500/15 text-sky-300',
  fixed: 'bg-emerald-500/15 text-emerald-300',
  wontfix: 'bg-slate-500/15 text-slate-400',
  cannot_reproduce: 'bg-slate-500/15 text-slate-400',
  duplicate: 'bg-slate-500/15 text-slate-400',
  closed: 'bg-slate-500/15 text-slate-400',
}

export default function Testing() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const isSuperAdmin = !!profile?.is_super_admin

  const [active, setActive] = useState(null)
  const [entries, setEntries] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [scope, setScope] = useState('mine') // 'mine' | 'all' (super_admin only)
  const [showForm, setShowForm] = useState(false)
  const [tick, setTick] = useState(0)

  const loadAll = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [act, ent, lg] = await Promise.all([
        fetchActiveEntry(user.id),
        fetchEntries({ userId: scope === 'all' ? null : user.id, limit: 50 }),
        fetchLogs({
          userId: scope === 'all' ? null : user.id,
          limit: 200,
        }),
      ])
      setActive(act)
      setEntries(ent)
      setLogs(lg)
    } catch (err) {
      console.error('[Testing] loadAll', err)
      toast.error('Failed to load testing data')
    } finally {
      setLoading(false)
    }
  }, [user?.id, scope])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [active])

  // ─── Clock actions ───────────────────────────────────
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

  // ─── Filters ─────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (filterStatus !== 'all' && l.status !== filterStatus) return false
      if (filterSeverity !== 'all' && l.severity !== filterSeverity) return false
      if (filterCategory !== 'all' && l.category !== filterCategory) return false
      return true
    })
  }, [logs, filterStatus, filterSeverity, filterCategory])

  // ─── Stats ───────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEntries = entries.filter((e) => new Date(e.clock_in_at) >= today)
    const todayMinutes = todayEntries.reduce((a, e) => a + Number(e.duration_minutes || 0), 0)
    const openBugs = logs.filter((l) => l.category === 'bug' && ['open', 'triaged'].includes(l.status)).length
    const criticalOpen = logs.filter((l) => l.severity === 'critical' && !['fixed', 'wontfix', 'closed'].includes(l.status)).length
    return { todayMinutes, openBugs, criticalOpen, totalLogs: logs.length, totalEntries: entries.length }
  }, [entries, logs])

  void tick // force re-render for live timer

  if (loading) {
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
            <p className="text-sm text-gray-400">Clock in, test, and log every bug or note you find. Everything ties to a time entry.</p>
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

        {/* Clock Card */}
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5">
          {active ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                  </span>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-rose-400/80 font-semibold">Active session</div>
                  <div className="text-3xl font-bold tabular-nums">{formatDuration(liveDuration(active.clock_in_at))}</div>
                  <div className="text-xs text-gray-500">
                    Started {new Date(active.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {active.entry_type}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  + Log entry
                </button>
                <button
                  onClick={handleClockOut}
                  className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-lg text-sm font-medium transition-colors"
                >
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
                    className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm font-medium capitalize transition-colors"
                  >
                    Clock in: {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect label="Category" value={filterCategory} onChange={setFilterCategory} options={['all', ...LOG_CATEGORIES]} />
          <FilterSelect label="Severity" value={filterSeverity} onChange={setFilterSeverity} options={['all', ...LOG_SEVERITIES]} />
          <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={['all', ...LOG_STATUSES]} />
          <div className="ml-auto text-xs text-gray-500">
            Showing {filteredLogs.length} of {logs.length}
          </div>
        </div>

        {/* Logs */}
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-navy-800 border-b border-navy-700/50">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Screen</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/40">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    No entries yet. Clock in and start logging.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <LogRow
                    key={l.id}
                    log={l}
                    isSuperAdmin={isSuperAdmin}
                    userId={user.id}
                    onChanged={loadAll}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Recent sessions */}
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Recent sessions</h2>
            <div className="text-xs text-gray-500">{entries.length} total</div>
          </div>
          <div className="space-y-1">
            {entries.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-navy-800 text-sm">
                <span
                  className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                    e.status === 'active' ? 'bg-emerald-400 animate-pulse' :
                    e.status === 'completed' ? 'bg-slate-500' :
                    'bg-amber-400'
                  }`}
                />
                <span className="text-xs text-gray-400 w-32 flex-shrink-0">
                  {new Date(e.clock_in_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} {' '}
                  {new Date(e.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs uppercase text-gray-500 w-20 flex-shrink-0">{e.entry_type}</span>
                <span className="tabular-nums font-medium text-gray-200 w-16 flex-shrink-0">
                  {e.status === 'active' ? formatDuration(liveDuration(e.clock_in_at)) : formatDuration(e.duration_minutes)}
                </span>
                <span className="text-xs text-gray-500 truncate">{e.notes || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Log Modal */}
      {showForm && active && (
        <NewLogModal
          userId={user.id}
          orgId={profile?.org_id || null}
          timeEntryId={active.id}
          currentPath={location.pathname}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            loadAll()
          }}
        />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════
// SUBCOMPONENTS
// ═════════════════════════════════════════════════
function StatCard({ label, value, color }) {
  return (
    <div className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-400">
      <span>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-navy-800 border border-navy-700/50 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-brand-blue"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === 'all' ? 'All' : o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </label>
  )
}

function LogRow({ log, isSuperAdmin, userId, onChanged }) {
  const [expanded, setExpanded] = useState(false)

  async function markFixed() {
    try {
      await resolveLog(log.id, { resolvedBy: userId, newStatus: 'fixed' })
      toast.success('Marked fixed')
      onChanged()
    } catch {
      toast.error('Update failed')
    }
  }

  async function changeStatus(newStatus) {
    try {
      await updateLog(log.id, { status: newStatus })
      onChanged()
    } catch {
      toast.error('Update failed')
    }
  }

  return (
    <>
      <tr className="hover:bg-navy-800/50 cursor-pointer" onClick={() => setExpanded((x) => !x)}>
        <td className="px-4 py-2.5">
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${CATEGORY_COLORS[log.category] || ''}`}>
            {log.category.replace('_', ' ')}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${SEVERITY_COLORS[log.severity] || ''}`}>
            {log.severity}
          </span>
        </td>
        <td className="px-4 py-2.5 text-sm text-white max-w-md truncate">{log.title}</td>
        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{log.screen_path || '—'}</td>
        <td className="px-4 py-2.5">
          <select
            value={log.status}
            onChange={(e) => { e.stopPropagation(); changeStatus(e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 border-0 focus:outline-none ${STATUS_COLORS[log.status] || ''}`}
          >
            {LOG_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-navy-900 text-white">
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-500">
          {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </td>
        <td className="px-4 py-2.5 text-right">
          {!['fixed', 'closed'].includes(log.status) && isSuperAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); markFixed() }}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              Mark fixed
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-navy-900/60">
          <td colSpan={7} className="px-6 py-4 text-sm text-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {log.description && (
                <div>
                  <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">Description</div>
                  <div className="whitespace-pre-wrap">{log.description}</div>
                </div>
              )}
              {log.steps_to_reproduce && (
                <div>
                  <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">Steps to reproduce</div>
                  <div className="whitespace-pre-wrap font-mono text-xs">{log.steps_to_reproduce}</div>
                </div>
              )}
              {log.expected_result && (
                <div>
                  <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">Expected</div>
                  <div className="whitespace-pre-wrap">{log.expected_result}</div>
                </div>
              )}
              {log.actual_result && (
                <div>
                  <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">Actual</div>
                  <div className="whitespace-pre-wrap">{log.actual_result}</div>
                </div>
              )}
              {log.resolution_notes && (
                <div className="md:col-span-2">
                  <div className="text-[10px] uppercase font-semibold text-emerald-400 mb-1">Resolution</div>
                  <div className="whitespace-pre-wrap">{log.resolution_notes}</div>
                </div>
              )}
            </div>
            {log.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {log.tags.map((t) => (
                  <span key={t} className="text-[10px] text-gray-400 bg-navy-800 border border-navy-700/50 rounded px-2 py-0.5">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function NewLogModal({ userId, orgId, timeEntryId, currentPath, onClose, onCreated }) {
  const [category, setCategory] = useState('bug')
  const [severity, setSeverity] = useState('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')
  const [screenPath, setScreenPath] = useState(currentPath || '')
  const [tagsText, setTagsText] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      await createLog({
        userId,
        orgId,
        timeEntryId,
        category,
        severity,
        title: title.trim(),
        description: description.trim() || null,
        stepsToReproduce: steps.trim() || null,
        expectedResult: expected.trim() || null,
        actualResult: actual.trim() || null,
        screenPath: screenPath.trim() || null,
        tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      })
      toast.success('Log saved')
      onCreated()
    } catch (err) {
      console.error(err)
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-auto py-10 px-4">
      <form
        onSubmit={submit}
        className="bg-navy-900 border border-navy-700/50 rounded-xl shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <h2 className="text-lg font-semibold">New work log entry</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-semibold text-gray-500">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm">
                {LOG_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-gray-500">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm">
                {LOG_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-gray-500">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary"
              required
              className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-gray-500">Screen path</label>
            <input
              value={screenPath}
              onChange={(e) => setScreenPath(e.target.value)}
              placeholder="/admin/..."
              className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-gray-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm"
            />
          </div>
          {category === 'bug' && (
            <>
              <div>
                <label className="text-[10px] uppercase font-semibold text-gray-500">Steps to reproduce</label>
                <textarea
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  rows={3}
                  placeholder={'1. Go to ...\n2. Click ...\n3. Observe ...'}
                  className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-semibold text-gray-500">Expected</label>
                  <textarea
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    rows={2}
                    className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-semibold text-gray-500">Actual</label>
                  <textarea
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    rows={2}
                    className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="text-[10px] uppercase font-semibold text-gray-500">Tags (comma-separated)</label>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="e.g. mobile, chrome, regression"
              className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-navy-700/50 bg-navy-950/40 rounded-b-xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save log'}
          </button>
        </div>
      </form>
    </div>
  )
}
