import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_COLORS = {
  posted: 'bg-sky-500/10 text-sky-300',
  bid_placed: 'bg-orange-500/10 text-orange-300',
  accepted: 'bg-emerald-500/10 text-emerald-300',
  in_transit: 'bg-indigo-500/10 text-indigo-300',
  delivered: 'bg-emerald-500/15 text-emerald-200',
  cancelled: 'bg-red-500/10 text-red-300',
}

export default function FreightLoads() {
  const [loads, setLoads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('freight_loads')
        .select('*, freight_shippers(name), freight_brokers(name)')
        .order('created_at', { ascending: false })
      setLoads(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = loads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      l.origin_city?.toLowerCase().includes(q) ||
      l.dest_city?.toLowerCase().includes(q) ||
      l.equipment_type?.toLowerCase().includes(q) ||
      l.freight_shippers?.name?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || l.status === statusFilter
    return matchSearch && matchStatus
  })

  const statusCounts = loads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            <h1 className="text-xl font-bold text-white">All Loads</h1>
          </div>
          <p className="text-sm text-gray-400">Every freight load across the platform</p>
        </div>
      </div>

      {/* Status quick-filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { key: '', label: 'All' },
          { key: 'posted', label: 'Posted' },
          { key: 'bid_placed', label: 'Bid Placed' },
          { key: 'accepted', label: 'Accepted' },
          { key: 'in_transit', label: 'In Transit' },
          { key: 'delivered', label: 'Delivered' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setStatusFilter(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === opt.key
                ? 'bg-brand-blue text-white'
                : 'bg-navy-800 border border-navy-700/50 text-gray-400 hover:text-white'
            }`}
          >
            {opt.label}
            {opt.key && statusCounts[opt.key] ? (
              <span className="ml-1.5 opacity-70">({statusCounts[opt.key]})</span>
            ) : null}
          </button>
        ))}
        <div className="relative ml-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search loads…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <p className="text-gray-400 font-medium">{search || statusFilter ? 'No matching loads' : 'No loads yet'}</p>
          <p className="text-gray-600 text-sm mt-1">Loads will appear here once shippers post them</p>
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-navy-700/50 text-xs text-gray-500">
            {filtered.length} load{filtered.length !== 1 ? 's' : ''}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700/50">
                  {['Route', 'Shipper', 'Equipment', 'Weight', 'Pickup', 'Rate', 'Status', 'Posted'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(load => (
                  <tr key={load.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                    <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap">
                      {load.origin_city || '?'}, {load.origin_state || '?'}
                      <span className="text-gray-500 mx-1.5">→</span>
                      {load.dest_city || '?'}, {load.dest_state || '?'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{load.freight_shippers?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{load.equipment_type || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{load.weight ? Number(load.weight).toLocaleString() + ' lbs' : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{load.pickup_date ? new Date(load.pickup_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">{load.rate ? '$' + Number(load.rate).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[load.status] || 'bg-gray-500/10 text-gray-400'}`}>
                        {(load.status || '?').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{load.created_at ? new Date(load.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
