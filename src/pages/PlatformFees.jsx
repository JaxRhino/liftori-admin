import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUS_COLORS = {
  paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  packaging: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  shipped: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  refunded: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function PlatformFees() {
  const [orders, setOrders] = useState([])
  const [feePct, setFeePct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setFetchError(null)
    const [ordersRes, settingsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, subtotal, total, platform_fee, platform_fee_pct, seller_net, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('platform_settings').select('sale_fee_pct').eq('id', 1).maybeSingle(),
    ])
    if (ordersRes.error) {
      console.error('[PlatformFees] fetch failed:', ordersRes.error)
      setFetchError(ordersRes.error.message || String(ordersRes.error))
      setOrders([])
    } else {
      setOrders(ordersRes.data || [])
    }
    if (!settingsRes.error && settingsRes.data) setFeePct(settingsRes.data.sale_fee_pct)
    setLoading(false)
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const totalFees = orders.reduce((s, o) => s + Number(o.platform_fee || 0), 0)
  const feesThisMonth = orders
    .filter((o) => o.created_at >= monthStart)
    .reduce((s, o) => s + Number(o.platform_fee || 0), 0)
  const numSales = orders.length
  const avgFee = numSales ? totalFees / numSales : 0
  const totalGmv = orders.reduce((s, o) => s + Number(o.total || 0), 0)

  const cards = [
    { label: 'Total Fees Collected', value: money(totalFees), color: 'text-emerald-400' },
    { label: 'Fees This Month', value: money(feesThisMonth), color: 'text-brand-cyan' },
    { label: 'Total Sales', value: numSales.toLocaleString(), color: 'text-white' },
    { label: 'Avg Fee / Sale', value: money(avgFee), color: 'text-brand-blue' },
    { label: 'Total GMV', value: money(totalGmv), color: 'text-sky-400' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-900 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Fees</h1>
          <p className="text-gray-400 text-sm mt-1">
            Liftori&rsquo;s commission on every marketplace sale
            {feePct != null && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-brand-blue/30 bg-brand-blue/10 text-brand-blue">
                {Number(feePct)}% per sale
              </span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-navy-700/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-.001 5.002l-.643-.642a8.25 8.25 0 10.642 9.78" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
          <div className="font-semibold mb-1">Couldn&rsquo;t load orders</div>
          <div className="text-xs text-red-300/80 font-mono break-all">{fetchError}</div>
          <button onClick={load} className="mt-2 text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-100">Retry</button>
        </div>
      )}

      <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-navy-700/50">
          <h2 className="text-sm font-semibold text-white">Recent Orders</h2>
        </div>
        {orders.length === 0 ? (
          <div className="text-center py-16"><p className="text-gray-500">No orders yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs uppercase tracking-wider border-b border-navy-700/50">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Sale Total</th>
                  <th className="px-5 py-3 font-medium text-right">Fee %</th>
                  <th className="px-5 py-3 font-medium text-right">Platform Fee</th>
                  <th className="px-5 py-3 font-medium text-right">Seller Net</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-navy-700/30 hover:bg-navy-700/20 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{o.order_number || o.id?.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-gray-400">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[o.status] || 'text-gray-400 border-gray-600'}`}>
                        {o.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-200">{money(o.total)}</td>
                    <td className="px-5 py-3 text-right text-gray-400">{o.platform_fee_pct != null ? `${Number(o.platform_fee_pct)}%` : '—'}</td>
                    <td className="px-5 py-3 text-right text-emerald-400 font-semibold">{money(o.platform_fee)}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{money(o.seller_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
