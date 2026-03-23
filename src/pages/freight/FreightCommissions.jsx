import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function FreightCommissions() {
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0 })
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('freight_commissions')
        .select('*, freight_sales_profiles(sales_rep_name, account_name), freight_loads(origin_city, origin_state, dest_city, dest_state, rate, status)')
        .order('created_at', { ascending: false })
      const all = data || []
      const paid = all.filter(c => c.status === 'paid').reduce((s, c) => s + (c.amount || 0), 0)
      const pending = all.filter(c => c.status === 'pending').reduce((s, c) => s + (c.amount || 0), 0)
      setCommissions(all)
      setStats({ total: paid + pending, paid, pending })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function markPaid(id) {
    try {
      await supabase.from('freight_commissions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
      await loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = commissions.filter(c => !statusFilter || c.status === statusFilter)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <h1 className="text-xl font-bold text-white">Commissions</h1>
          </div>
          <p className="text-sm text-gray-400">Sales rep commission tracking for BIH Freight</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Commissions', value: '$' + stats.total.toLocaleString(), color: 'text-white' },
          { label: 'Paid Out', value: '$' + stats.paid.toLocaleString(), color: 'text-emerald-400' },
          { label: 'Pending Payout', value: '$' + stats.pending.toLocaleString(), color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{s.label}</div>
            <div className={`font-display text-2xl tracking-wide ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {['', 'pending', 'paid'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === s ? 'bg-brand-blue text-white' : 'bg-navy-800 border border-navy-700/50 text-gray-400 hover:text-white'
            }`}>
            {s === '' ? 'All' : s === 'pending' ? 'Pending' : 'Paid'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <p className="text-gray-400 font-medium">No commissions yet</p>
          <p className="text-gray-600 text-sm mt-1">Commissions are calculated when loads are delivered</p>
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700/50">
                  {['Sales Rep', 'Account', 'Load Route', 'Load Rate', 'Commission', 'Status', 'Action'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                    <td className="px-4 py-3 text-sm font-medium text-white">{c.freight_sales_profiles?.sales_rep_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{c.freight_sales_profiles?.account_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {c.freight_loads?.origin_city || '?'}, {c.freight_loads?.origin_state || '?'}
                      <span className="text-gray-600 mx-1">→</span>
                      {c.freight_loads?.dest_city || '?'}, {c.freight_loads?.dest_state || '?'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{c.freight_loads?.rate ? '$' + Number(c.freight_loads.rate).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-400">{c.amount ? '$' + Number(c.amount).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        c.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'paid' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                        {c.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.status === 'pending' ? (
                        <button onClick={() => markPaid(c.id)} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition-colors">
                          Mark Paid
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : '—'}</span>
                      )}
                    </td>
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
