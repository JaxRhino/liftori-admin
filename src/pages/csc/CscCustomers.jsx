import { useEffect, useMemo, useState } from 'react'
import { cscSupabase, fmtDate, fmtMoney, relTime, FREQUENCY_LABELS } from '../../lib/cscClient'

export default function CscCustomers() {
  const [restaurants, setRestaurants] = useState([])
  const [chains, setChains] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [tierFilter, setTierFilter] = useState('all')
  const [chainFilter, setChainFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const [r, c] = await Promise.all([
      cscSupabase.from('csc_restaurants').select('*, chain:csc_chain_groups(name), ahj:csc_ahj_jurisdictions(name, state)').order('name'),
      cscSupabase.from('csc_chain_groups').select('*').order('name'),
    ])
    setRestaurants(r.data || [])
    setChains(c.data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return restaurants.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (tierFilter !== 'all' && r.frequency_tier !== tierFilter) return false
      if (chainFilter !== 'all' && r.chain_group_id !== chainFilter) return false
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !(r.city || '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [restaurants, search, statusFilter, tierFilter, chainFilter])

  const overdueCount = filtered.filter(r => r.next_due_at && new Date(r.next_due_at) < new Date() && r.status === 'active').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or city…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-brand-cyan/40 w-72"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-white text-sm">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="lost">Lost</option>
          <option value="prospect">Prospect</option>
        </select>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-white text-sm">
          <option value="all">All frequencies</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="semi_annual">Semi-annual</option>
          <option value="annual">Annual</option>
        </select>
        <select value={chainFilter} onChange={e => setChainFilter(e.target.value)} className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-white text-sm">
          <option value="all">All chains + standalones</option>
          {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="ml-auto text-xs text-gray-400">
          {filtered.length} of {restaurants.length} accounts · <span className={overdueCount > 0 ? 'text-red-300' : 'text-emerald-300'}>{overdueCount} overdue</span>
        </div>
      </div>

      <div className="rounded-xl border border-navy-700/50 bg-navy-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy-800 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="text-left px-5 py-3 font-semibold">Account</th>
              <th className="text-left px-3 py-3 font-semibold">Chain</th>
              <th className="text-left px-3 py-3 font-semibold">Frequency</th>
              <th className="text-left px-3 py-3 font-semibold">Last cleaned</th>
              <th className="text-left px-3 py-3 font-semibold">Next due</th>
              <th className="text-left px-3 py-3 font-semibold">AHJ</th>
              <th className="text-right px-5 py-3 font-semibold">Per visit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {loading && <tr><td colSpan="7" className="px-5 py-6 text-gray-500">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="7" className="px-5 py-6 text-gray-500">No matching accounts.</td></tr>}
            {filtered.map(r => {
              const overdue = r.next_due_at && new Date(r.next_due_at) < new Date() && r.status === 'active'
              return (
                <tr key={r.id} className="hover:bg-navy-800">
                  <td className="px-5 py-3">
                    <div className="text-white">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.city}, {r.state} · {r.hood_count} hood{r.hood_count !== 1 ? 's' : ''}</div>
                  </td>
                  <td className="px-3 py-3 text-gray-300">{r.chain?.name || <span className="text-gray-500 italic">Standalone</span>}</td>
                  <td className="px-3 py-3 text-gray-300">{FREQUENCY_LABELS[r.frequency_tier] || '—'}</td>
                  <td className="px-3 py-3 text-gray-300">{fmtDate(r.last_cleaned_at)}</td>
                  <td className="px-3 py-3">
                    <div className={overdue ? 'text-red-300' : 'text-gray-300'}>{fmtDate(r.next_due_at)}</div>
                    <div className="text-xs text-gray-500">{relTime(r.next_due_at)}</div>
                  </td>
                  <td className="px-3 py-3 text-gray-300 text-xs">{r.ahj?.name || '—'}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{fmtMoney(r.base_price_per_visit)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
