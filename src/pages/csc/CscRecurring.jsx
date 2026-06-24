import { useEffect, useMemo, useState } from 'react'
import { cscSupabase, CSC_URL, CSC_ANON, fmtDate, FREQUENCY_LABELS, COOKING_VOLUME_LABELS } from '../../lib/cscClient'

// NFPA 96 (Table 11.4) mandated cleaning frequency by cooking volume
const MONTHS_BY_VOLUME = { solid_fuel: 1, high_volume: 3, moderate_volume: 6, low_volume: 12 }
const TIER_BY_MONTHS = { 1: 'monthly', 3: 'quarterly', 6: 'semi_annual', 12: 'annual' }
function mandatedMonths(volume, tier) {
  if (volume && MONTHS_BY_VOLUME[volume]) return MONTHS_BY_VOLUME[volume]
  const byTier = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 }
  return (tier && byTier[tier]) || 3
}
function addMonths(d, m) { const r = new Date(d); r.setMonth(r.getMonth() + m); return r }

const STATUS_TONE = {
  overdue: 'bg-red-500/20 text-red-300 border-red-500/40',
  due_soon: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  current: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
}
const STATUS_LABEL = { overdue: 'Overdue', due_soon: 'Due soon', scheduled: 'Scheduled', current: 'Current' }

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tone}`}>{children}</span>
}
function StatCard({ label, value, hint, accent }) {
  return (
    <div className="rounded-xl border border-navy-700/50 bg-navy-800 p-4">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent || 'text-white'}`}>{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
    </div>
  )
}

export default function CscRecurring() {
  const [restaurants, setRestaurants] = useState([])
  const [futureByRest, setFutureByRest] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null) // restaurant id currently scheduling, or 'all' / 'enforce'
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const [{ data: rests }, { data: future }] = await Promise.all([
      cscSupabase.from('csc_restaurants').select('*').order('name'),
      cscSupabase.from('csc_cleanings').select('restaurant_id, scheduled_at, status').in('status', ['scheduled', 'in_progress']).gte('scheduled_at', new Date().toISOString()),
    ])
    const map = {}
    ;(future || []).forEach(c => {
      if (!map[c.restaurant_id] || c.scheduled_at < map[c.restaurant_id]) map[c.restaurant_id] = c.scheduled_at
    })
    setFutureByRest(map)
    setRestaurants(rests || [])
    setLoading(false)
  }

  const rows = useMemo(() => {
    const now = Date.now()
    return (restaurants || [])
      .filter(r => r.status === 'active')
      .map(r => {
        const months = mandatedMonths(r.cooking_volume, r.frequency_tier)
        const mandatedTier = TIER_BY_MONTHS[months] || r.frequency_tier
        const base = r.last_cleaned_at ? new Date(r.last_cleaned_at) : (r.contract_start_date ? new Date(r.contract_start_date) : new Date())
        const computedDue = addMonths(base, months)
        const effectiveDue = r.next_due_at ? new Date(r.next_due_at) : computedDue
        const futureAt = futureByRest[r.id]
        const daysUntil = Math.round((effectiveDue.getTime() - now) / 86400000)
        let status
        if (futureAt) status = 'scheduled'
        else if (daysUntil < 0) status = 'overdue'
        else if (daysUntil <= 14) status = 'due_soon'
        else status = 'current'
        const freqMismatch = mandatedTier !== r.frequency_tier
        return { r, months, mandatedTier, effectiveDue, futureAt, daysUntil, status, freqMismatch }
      })
      .sort((a, b) => a.effectiveDue - b.effectiveDue)
  }, [restaurants, futureByRest])

  const filtered = useMemo(() => rows.filter(row => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${row.r.name || ''} ${row.r.city || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  }), [rows, statusFilter, search])

  const stats = useMemo(() => ({
    total: rows.length,
    overdue: rows.filter(x => x.status === 'overdue').length,
    dueSoon: rows.filter(x => x.status === 'due_soon').length,
    scheduled: rows.filter(x => x.status === 'scheduled').length,
    mismatch: rows.filter(x => x.freqMismatch).length,
  }), [rows])

  async function callFn(payload) {
    const resp = await fetch(CSC_URL + '/functions/v1/csc-schedule-recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CSC_ANON}` },
      body: JSON.stringify(payload),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return resp.json()
  }

  async function scheduleOne(restaurantId) {
    setBusy(restaurantId); setMsg('')
    try { await callFn({ action: 'schedule_one', restaurant_id: restaurantId }); await fetchAll() }
    catch (e) { setMsg('Could not schedule: ' + (e.message || e)) }
    finally { setBusy(null) }
  }
  async function scheduleAllDue() {
    setBusy('all'); setMsg('')
    try { const r = await callFn({ action: 'schedule_all_due', horizon_days: 30 }); await fetchAll(); setMsg(`Scheduled ${r.created} visit${r.created === 1 ? '' : 's'}${r.skipped ? `, ${r.skipped} already booked` : ''}.`) }
    catch (e) { setMsg('Bulk schedule failed: ' + (e.message || e)) }
    finally { setBusy(null) }
  }
  async function enforceFrequency() {
    setBusy('enforce'); setMsg('')
    try { const r = await callFn({ action: 'enforce_frequency' }); await fetchAll(); setMsg(`Aligned ${r.updated} account${r.updated === 1 ? '' : 's'} to NFPA 96 frequency.`) }
    catch (e) { setMsg('Enforce failed: ' + (e.message || e)) }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Recurring Service</h1>
          <p className="text-sm text-gray-400 mt-0.5">NFPA 96 cleaning frequency by cooking volume — auto-schedule the next visit so no account lapses.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={enforceFrequency} disabled={!!busy}
            className="px-3 py-2 rounded-lg text-sm border border-navy-700/50 text-gray-300 hover:bg-navy-700 disabled:opacity-40">
            {busy === 'enforce' ? 'Aligning…' : 'Enforce NFPA 96 frequency'}
          </button>
          <button onClick={scheduleAllDue} disabled={!!busy}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-orange-500/90 hover:bg-orange-500 text-white disabled:opacity-40">
            {busy === 'all' ? 'Scheduling…' : 'Auto-schedule all due'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active accounts" value={loading ? '—' : stats.total} hint="under contract" />
        <StatCard label="Overdue" value={loading ? '—' : stats.overdue} hint="past NFPA 96 due date" accent={stats.overdue ? 'text-red-300' : 'text-white'} />
        <StatCard label="Due ≤ 14 days" value={loading ? '—' : stats.dueSoon} hint="needs a visit booked" accent={stats.dueSoon ? 'text-amber-300' : 'text-white'} />
        <StatCard label="Scheduled ahead" value={loading ? '—' : stats.scheduled} hint="next visit on the books" accent="text-blue-300" />
      </div>

      {msg && <div className="rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan text-sm px-4 py-2">{msg}</div>}
      {stats.mismatch > 0 && !loading && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm px-4 py-2">
          {stats.mismatch} account{stats.mismatch === 1 ? '' : 's'} have a frequency that doesn’t match the NFPA 96 minimum for their cooking volume. Use “Enforce NFPA 96 frequency” to align them.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search account or city…" value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-brand-cyan/40 w-72" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-white text-sm">
          <option value="all">All statuses</option>
          <option value="overdue">Overdue</option>
          <option value="due_soon">Due soon</option>
          <option value="current">Current</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <div className="ml-auto text-xs text-gray-400">{filtered.length} of {rows.length} accounts</div>
      </div>

      <div className="rounded-xl border border-navy-700/50 bg-navy-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy-800 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="text-left px-5 py-3 font-semibold">Account</th>
              <th className="text-left px-3 py-3 font-semibold">Cooking volume</th>
              <th className="text-left px-3 py-3 font-semibold">NFPA 96 frequency</th>
              <th className="text-left px-3 py-3 font-semibold">Last cleaned</th>
              <th className="text-left px-3 py-3 font-semibold">Next due</th>
              <th className="text-left px-3 py-3 font-semibold">Status</th>
              <th className="text-right px-5 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {loading && <tr><td colSpan="7" className="px-5 py-6 text-gray-500">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="7" className="px-5 py-6 text-gray-500">No accounts match.</td></tr>}
            {filtered.map(({ r, mandatedTier, effectiveDue, futureAt, daysUntil, status, freqMismatch }) => (
              <tr key={r.id} className="hover:bg-navy-700">
                <td className="px-5 py-3">
                  <div className="text-white">{r.name}</div>
                  <div className="text-xs text-gray-500">{[r.city, r.state].filter(Boolean).join(', ')}</div>
                </td>
                <td className="px-3 py-3 text-gray-300">{COOKING_VOLUME_LABELS[r.cooking_volume] || r.cooking_volume || '—'}</td>
                <td className="px-3 py-3">
                  <span className="text-gray-200">{FREQUENCY_LABELS[mandatedTier] || mandatedTier}</span>
                  {freqMismatch && <span className="ml-2 text-[10px] uppercase text-amber-300">set to {FREQUENCY_LABELS[r.frequency_tier] || r.frequency_tier}</span>}
                </td>
                <td className="px-3 py-3 text-gray-300">{r.last_cleaned_at ? fmtDate(r.last_cleaned_at) : <span className="text-gray-500 italic">never</span>}</td>
                <td className="px-3 py-3">
                  <div className="text-gray-200">{futureAt ? fmtDate(futureAt) : fmtDate(effectiveDue)}</div>
                  {!futureAt && (
                    <div className="text-xs text-gray-500">{daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'today' : `in ${daysUntil}d`}</div>
                  )}
                </td>
                <td className="px-3 py-3"><Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill></td>
                <td className="px-5 py-3 text-right">
                  {futureAt
                    ? <span className="text-xs text-gray-500">Booked</span>
                    : <button onClick={() => scheduleOne(r.id)} disabled={!!busy}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan disabled:opacity-40">
                        {busy === r.id ? 'Scheduling…' : 'Schedule next visit'}
                      </button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
