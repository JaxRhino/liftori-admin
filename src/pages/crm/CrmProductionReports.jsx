import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, useCrmClient } from './_shared'
import { toast } from 'sonner'

// Production & crew reports. Reads the tenant's OWN Supabase via
// useCrmClient(). Pure analytics from ops_work_orders + ops_crews: jobs
// completed, cycle time, crew productivity.

const PERIODS = [{ k: '30d', label: 'Last 30 days', days: 30 }, { k: '90d', label: 'Last 90 days', days: 90 }, { k: 'ytd', label: 'Year to date', days: null }, { k: 'all', label: 'All time', days: null }]
const norm = (s) => (s || '').toString().toLowerCase()
const days = (a, b) => (a && b) ? (new Date(b) - new Date(a)) / 86400000 : null

function Bar({ label, value, max, sub, tone = 'bg-brand-blue' }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3 px-5 py-2">
      <div className="w-40 shrink-0 text-sm text-gray-300 truncate">{label}</div>
      <div className="flex-1 bg-navy-900/60 rounded h-5 overflow-hidden"><div className={`h-5 ${tone} rounded`} style={{ width: w + '%' }} /></div>
      <div className="w-28 shrink-0 text-right text-sm text-gray-200">{sub}</div>
    </div>
  )
}

export default function CrmProductionReports() {
  const { client } = useCrmClient()
  const [jobs, setJobs] = useState([])
  const [crews, setCrews] = useState([])
  const [period, setPeriod] = useState('90d')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client])
  async function load() {
    try {
      setLoading(true)
      const [j, c] = await Promise.all([
        client.from('ops_work_orders').select('id, status, production_stage, assigned_crew_id, scheduled_start, actual_start, actual_end, created_at, updated_at'),
        client.from('ops_crews').select('id, name'),
      ])
      setJobs(j?.data || []); setCrews(c?.data || [])
    } catch (e) { console.error(e); toast.error('Failed to load production reports') } finally { setLoading(false) }
  }

  const crewById = useMemo(() => Object.fromEntries(crews.map((c) => [c.id, c.name])), [crews])
  const since = useMemo(() => {
    const p = PERIODS.find((x) => x.k === period)
    if (period === 'all') return null
    if (period === 'ytd') return new Date(new Date().getFullYear(), 0, 1)
    return new Date(Date.now() - p.days * 86400000)
  }, [period])
  const inPeriod = (d) => { if (!since) return true; if (!d) return false; return new Date(d) >= since }
  const cycleOf = (j) => { const d = days(j.actual_start, j.actual_end); if (d != null && d >= 0) return d; const f = days(j.created_at, j.updated_at); return (f != null && f >= 0) ? f : null }

  const r = useMemo(() => {
    const isDone = (j) => norm(j.status) === 'completed'
    const completed = jobs.filter((j) => isDone(j) && inPeriod(j.actual_end || j.updated_at))
    const open = jobs.filter((j) => !['completed', 'cancelled'].includes(norm(j.status)))
    const scheduled = jobs.filter((j) => inPeriod(j.scheduled_start))
    const cyc = completed.map(cycleOf).filter((n) => n != null)
    const avgCycle = cyc.length ? cyc.reduce((a, b) => a + b, 0) / cyc.length : null
    // completed by month (6)
    const months = []
    for (let i = 5; i >= 0; i--) { const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - i); months.push({ key: dt.getFullYear() + '-' + dt.getMonth(), label: dt.toLocaleDateString('en-US', { month: 'short' }), value: 0 }) }
    const mmap = Object.fromEntries(months.map((m) => [m.key, m]))
    for (const j of jobs.filter(isDone)) { const d = j.actual_end || j.updated_at; if (!d) continue; const dt = new Date(d); const k = dt.getFullYear() + '-' + dt.getMonth(); if (mmap[k]) mmap[k].value += 1 }
    // production stage distribution (current, non-done)
    const stageMap = {}
    for (const j of jobs) { const s = norm(j.production_stage) || 'unset'; (stageMap[s] = stageMap[s] || { stage: s, count: 0 }); stageMap[s].count += 1 }
    const stages = Object.values(stageMap).sort((a, b) => b.count - a.count)
    // crew productivity
    const crewMap = {}
    for (const j of jobs) {
      const key = j.assigned_crew_id || '__un'
      const cr = (crewMap[key] = crewMap[key] || { crew: crewById[j.assigned_crew_id] || 'Unassigned', assigned: 0, completed: 0, cyc: [] })
      cr.assigned += 1
      if (isDone(j)) { cr.completed += 1; const c = cycleOf(j); if (c != null) cr.cyc.push(c) }
    }
    const crewRows = Object.values(crewMap).map((c) => ({ ...c, avgCycle: c.cyc.length ? c.cyc.reduce((a, b) => a + b, 0) / c.cyc.length : null })).sort((a, b) => b.completed - a.completed)
    return { completedCount: completed.length, openCount: open.length, scheduledCount: scheduled.length, avgCycle, months, stages, crewRows }
  }, [jobs, crewById, since, period])

  const monthMax = Math.max(1, ...r.months.map((m) => m.value))
  const stageMax = Math.max(1, ...r.stages.map((s) => s.count))

  return (
    <HubPage title="Production & Crew Reports" subtitle="Jobs completed, cycle time, and crew productivity."
      actions={<select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm">{PERIODS.map((p) => <option key={p.k} value={p.k}>{p.label}</option>)}</select>}>
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Jobs Completed" value={r.completedCount} accent="text-emerald-400" hint="in period" />
            <StatCard label="Open Jobs" value={r.openCount} accent="text-brand-blue" />
            <StatCard label="Avg Cycle Time" value={r.avgCycle != null ? Math.round(r.avgCycle) + 'd' : '—'} accent="text-amber-400" />
            <StatCard label="Scheduled" value={r.scheduledCount} hint="in period" />
          </div>

          <Section title="Jobs completed by month">
            <div className="py-2">
              {r.months.map((m) => <Bar key={m.key} label={m.label} value={m.value} max={monthMax} sub={`${m.value} jobs`} tone="bg-emerald-500/70" />)}
            </div>
          </Section>

          <Section title="Production stage distribution">
            <div className="py-2">
              {r.stages.map((s) => <Bar key={s.stage} label={s.stage.replace('_', ' ')} value={s.count} max={stageMax} sub={`${s.count} jobs`} />)}
            </div>
          </Section>

          <Section title="Crew productivity">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 font-medium">Crew</th>
                  <th className="text-right px-4 py-3 font-medium">Assigned</th>
                  <th className="text-right px-4 py-3 font-medium">Completed</th>
                  <th className="text-right px-5 py-3 font-medium">Avg Cycle</th>
                </tr></thead>
                <tbody>
                  {r.crewRows.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">No jobs yet.</td></tr>}
                  {r.crewRows.map((c, i) => (
                    <tr key={i} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                      <td className="px-5 py-3 text-white font-medium">{c.crew}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{c.assigned}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{c.completed}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{c.avgCycle != null ? Math.round(c.avgCycle) + 'd' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </HubPage>
  )
}
