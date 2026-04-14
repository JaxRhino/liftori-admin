import { useMemo, useState } from 'react'
import {
  formatDuration,
  groupByDay,
  groupByWeek,
  groupByMonth,
  entriesToCSV,
  downloadCSV,
} from '../../lib/timeTrackingService'

export default function TimesheetTab({ entries, userLookup = {}, scope = 'mine' }) {
  const [grouping, setGrouping] = useState('day') // 'day' | 'week' | 'month'

  const completed = useMemo(
    () => entries.filter((e) => e.status === 'completed' && e.duration_minutes != null),
    [entries]
  )

  const grouped = useMemo(() => {
    if (grouping === 'week') return groupByWeek(completed)
    if (grouping === 'month') return groupByMonth(completed)
    return groupByDay(completed)
  }, [completed, grouping])

  const totals = useMemo(() => {
    const totalMin = completed.reduce((a, e) => a + Number(e.duration_minutes || 0), 0)
    const totalSessions = completed.length
    const avgSession = totalSessions ? totalMin / totalSessions : 0
    // pace: distinct days with logged time
    const distinctDays = new Set(completed.map((e) => new Date(e.clock_in_at).toISOString().slice(0, 10))).size
    const avgPerActiveDay = distinctDays ? totalMin / distinctDays : 0
    return { totalMin, totalSessions, avgSession, distinctDays, avgPerActiveDay }
  }, [completed])

  function exportCSV() {
    const csv = entriesToCSV(completed, userLookup)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCSV(`timesheet_${scope}_${stamp}.csv`, csv)
  }

  return (
    <div className="space-y-4">
      {/* Totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total time" value={formatDuration(totals.totalMin)} />
        <Stat label="Sessions" value={totals.totalSessions} />
        <Stat label="Active days" value={totals.distinctDays} />
        <Stat label="Avg / active day" value={formatDuration(totals.avgPerActiveDay)} />
        <Stat label="Avg session" value={formatDuration(totals.avgSession)} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-navy-800 border border-navy-700/50 rounded-lg">
          {['day', 'week', 'month'].map((g) => (
            <button
              key={g}
              onClick={() => setGrouping(g)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                grouping === g ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button
            onClick={exportCSV}
            disabled={completed.length === 0}
            className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Grouped table */}
      <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-navy-800 border-b border-navy-700/50">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-semibold">Period</th>
              <th className="px-4 py-3 font-semibold">Sessions</th>
              <th className="px-4 py-3 font-semibold">Hours</th>
              <th className="px-4 py-3 font-semibold">Bar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/40">
            {grouped.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No completed sessions yet.</td></tr>
            ) : (
              grouped.map((row) => {
                const max = Math.max(...grouped.map((g) => g.minutes))
                const pct = max ? (row.minutes / max) * 100 : 0
                return (
                  <tr key={row.date || row.week || row.month}>
                    <td className="px-4 py-2.5 text-sm font-medium text-white">{row.date || row.week || row.month}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-300">{row.sessions}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-white">{(row.minutes / 60).toFixed(2)}</td>
                    <td className="px-4 py-2.5">
                      <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                        <div className="h-2 bg-brand-blue rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Raw entries */}
      <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
        <div className="text-xs uppercase font-semibold text-gray-500 mb-3">Recent completed sessions</div>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {completed.slice(0, 50).map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-navy-800 text-sm">
              <span className="text-xs text-gray-400 w-32 flex-shrink-0">
                {new Date(e.clock_in_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} {' '}
                {new Date(e.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs uppercase text-gray-500 w-20 flex-shrink-0">{e.entry_type}</span>
              <span className="tabular-nums font-medium text-gray-200 w-20 flex-shrink-0">
                {formatDuration(e.duration_minutes)}
              </span>
              {scope === 'all' && (
                <span className="text-xs text-gray-400 w-32 flex-shrink-0 truncate">
                  {userLookup[e.user_id]?.full_name || userLookup[e.user_id]?.email || '—'}
                </span>
              )}
              <span className="text-xs text-gray-500 truncate">{e.notes || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className="text-xl font-bold mt-0.5 text-white">{value}</div>
    </div>
  )
}
