import { useEffect, useMemo, useState } from 'react'
import { cscSupabase, fmtMoney, fmtDate, SEVERITY_TONES, QUOTE_STATUS_TONES } from '../../lib/cscClient'

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tone}`}>{children}</span>
}

export default function CscDeficiencies() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const { data } = await cscSupabase
      .from('csc_deficiencies')
      .select('*, restaurant:csc_restaurants(name, city, state), cleaning:csc_cleanings(scheduled_at, completed_at)')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => items.filter(d => {
    if (statusFilter !== 'all' && d.quote_status !== statusFilter) return false
    if (severityFilter !== 'all' && d.severity !== severityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${d.title || ''} ${d.restaurant?.name || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  }), [items, statusFilter, severityFilter, search])

  const stats = useMemo(() => {
    const open = items.filter(d => d.quote_status === 'open').length
    const quoted = items.filter(d => d.quote_status === 'quoted')
    const approved = items.filter(d => d.quote_status === 'approved')
    const declined = items.filter(d => d.quote_status === 'declined')
    const pipelineValue = quoted.reduce((s, d) => s + Number(d.quote_amount || 0), 0)
    const wonValue = approved.reduce((s, d) => s + Number(d.quote_amount || 0), 0)
    const lostValue = declined.reduce((s, d) => s + Number(d.quote_amount || 0), 0)
    return { open, quoted: quoted.length, approved: approved.length, pipelineValue, wonValue, lostValue }
  }, [items])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Open</div>
          <div className="text-2xl font-heading text-amber-300 mt-1">{stats.open}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">In Pipeline (quoted)</div>
          <div className="text-2xl font-heading text-blue-300 mt-1">{stats.quoted}</div>
          <div className="text-xs text-white/40 mt-1">{fmtMoney(stats.pipelineValue)}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Approved</div>
          <div className="text-2xl font-heading text-emerald-300 mt-1">{stats.approved}</div>
          <div className="text-xs text-white/40 mt-1">{fmtMoney(stats.wonValue)} won</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Declined value</div>
          <div className="text-2xl font-heading text-zinc-400 mt-1">{fmtMoney(stats.lostValue)}</div>
          <div className="text-xs text-white/40 mt-1">documented for liability</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-orange-400/50 w-72" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
          <option value="all">All statuses</option><option value="open">Open</option><option value="quoted">Quoted</option><option value="approved">Approved</option><option value="declined">Declined</option><option value="completed">Completed</option><option value="expired">Expired</option>
        </select>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
          <option value="all">All severities</option><option value="critical">Critical</option><option value="major">Major</option><option value="minor">Minor</option><option value="observation">Observation</option>
        </select>
        <div className="ml-auto text-xs text-white/50">{filtered.length} of {items.length}</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/40">
            <tr><th className="text-left px-5 py-3 font-semibold">Deficiency</th><th className="text-left px-3 py-3 font-semibold">Account</th><th className="text-left px-3 py-3 font-semibold">Severity</th><th className="text-left px-3 py-3 font-semibold">NFPA</th><th className="text-left px-3 py-3 font-semibold">Status</th><th className="text-left px-3 py-3 font-semibold">Logged</th><th className="text-right px-5 py-3 font-semibold">Quote</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && <tr><td colSpan="7" className="px-5 py-6 text-white/40">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="7" className="px-5 py-6 text-white/40">No deficiencies match.</td></tr>}
            {filtered.map(d => (
              <tr key={d.id} className="hover:bg-white/5">
                <td className="px-5 py-3 max-w-md">
                  <div className="text-white truncate">{d.title}</div>
                  {d.description && <div className="text-xs text-white/40 truncate">{d.description}</div>}
                </td>
                <td className="px-3 py-3">
                  <div className="text-white/80">{d.restaurant?.name || '—'}</div>
                  <div className="text-xs text-white/40">{d.restaurant?.city}, {d.restaurant?.state}</div>
                </td>
                <td className="px-3 py-3"><Pill tone={SEVERITY_TONES[d.severity]}>{d.severity}</Pill></td>
                <td className="px-3 py-3 text-xs text-white/60">{d.nfpa_code_ref || '—'}</td>
                <td className="px-3 py-3">
                  <Pill tone={QUOTE_STATUS_TONES[d.quote_status]}>{d.quote_status}</Pill>
                  {d.approved_by_name && <div className="text-[11px] text-white/40 mt-1">by {d.approved_by_name}</div>}
                </td>
                <td className="px-3 py-3 text-xs text-white/60">{fmtDate(d.created_at)}</td>
                <td className="px-5 py-3 text-right text-white/80">{fmtMoney(d.quote_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
