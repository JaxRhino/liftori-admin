import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function FreightDashboard() {
  const [stats, setStats] = useState({ brokers: 0, shippers: 0, loads: 0, activeLoads: 0, pendingBids: 0, revenue: 0, pendingCommissions: 0, salesProfiles: 0 })
  const [recentLoads, setRecentLoads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [brokersRes, shippersRes, loadsRes, bidsRes, salesRes, invoicesRes] = await Promise.all([
        supabase.from('freight_brokers').select('id', { count: 'exact', head: true }),
        supabase.from('freight_shippers').select('id', { count: 'exact', head: true }),
        supabase.from('freight_loads').select('id,status,rate').order('created_at', { ascending: false }),
        supabase.from('freight_bids').select('id,status').eq('status', 'pending'),
        supabase.from('freight_sales_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('freight_commissions').select('amount,status').eq('status', 'pending'),
      ])

      const loads = loadsRes.data || []
      const activeLoads = loads.filter(l => ['accepted', 'in_transit'].includes(l.status)).length
      const deliveredRevenue = loads.filter(l => l.status === 'delivered').reduce((s, l) => s + (l.rate || 0), 0)
      const pendingComm = (invoicesRes.data || []).reduce((s, c) => s + (c.amount || 0), 0)

      setStats({
        brokers: brokersRes.count || 0,
        shippers: shippersRes.count || 0,
        loads: loads.length,
        activeLoads,
        pendingBids: bidsRes.data?.length || 0,
        revenue: deliveredRevenue,
        pendingCommissions: pendingComm,
        salesProfiles: salesRes.count || 0,
      })
      setRecentLoads(loads.slice(0, 8))
    } catch (e) {
      console.error('Freight dashboard error:', e)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'Brokers', value: stats.brokers, color: 'text-brand-blue', link: '/admin/freight/brokers' },
    { label: 'Shippers', value: stats.shippers, color: 'text-brand-blue', link: '/admin/freight/shippers' },
    { label: 'Sales Profiles', value: stats.salesProfiles, color: 'text-purple-400', link: '/admin/freight/sales-profiles' },
    { label: 'Total Loads', value: stats.loads, color: 'text-white', link: '/admin/freight/loads' },
    { label: 'Active Shipments', value: stats.activeLoads, color: 'text-yellow-400', link: '/admin/freight/loads' },
    { label: 'Pending Bids', value: stats.pendingBids, color: 'text-orange-400', link: '/admin/freight/loads' },
    { label: 'Total Revenue', value: stats.revenue > 0 ? '$' + stats.revenue.toLocaleString() : '$0', color: 'text-emerald-400', link: '/admin/freight/commissions' },
    { label: 'Pending Commissions', value: stats.pendingCommissions > 0 ? '$' + stats.pendingCommissions.toLocaleString() : '$0', color: 'text-orange-300', link: '/admin/freight/commissions' },
  ]

  const statusColors = {
    posted: 'bg-sky-500/10 text-sky-300',
    bid_placed: 'bg-orange-500/10 text-orange-300',
    accepted: 'bg-emerald-500/10 text-emerald-300',
    in_transit: 'bg-indigo-500/10 text-indigo-300',
    delivered: 'bg-emerald-500/15 text-emerald-200',
    cancelled: 'bg-red-500/10 text-red-300',
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-brand-blue/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Freight AI — BIH Freight</h1>
          </div>
          <p className="text-sm text-gray-400">BHF Logistics platform overview</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/freight/sales-profiles" className="px-3 py-2 bg-brand-blue/10 border border-brand-blue/20 rounded-lg text-sm font-medium text-brand-blue hover:bg-brand-blue/20 transition-colors">
            Sales Profiles
          </Link>
          <Link to="/admin/freight/shippers" className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
            Shippers
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {statCards.map(card => (
              <Link key={card.label} to={card.link} className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 hover:border-brand-blue/30 transition-colors">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{card.label}</div>
                <div className={`font-display text-2xl tracking-wide ${card.color}`}>{card.value}</div>
              </Link>
            ))}
          </div>

          {/* Recent Loads */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-navy-700/50">
              <h2 className="text-sm font-semibold text-white">Recent Loads</h2>
              <Link to="/admin/freight/loads" className="text-xs text-brand-blue hover:underline">View all →</Link>
            </div>
            {recentLoads.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">No loads found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-navy-700/50">
                      {['Route', 'Equipment', 'Pickup', 'Rate', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentLoads.map(load => (
                      <tr key={load.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                        <td className="px-4 py-3 text-sm text-white font-medium">
                          {load.origin_city || '?'}, {load.origin_state || '?'} <span className="text-gray-500 mx-1">→</span> {load.dest_city || '?'}, {load.dest_state || '?'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">{load.equipment_type || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{load.pickup_date ? new Date(load.pickup_date).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 text-sm text-white">{load.rate ? '$' + Number(load.rate).toLocaleString() : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[load.status] || 'bg-gray-500/10 text-gray-400'}`}>
                            {(load.status || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
