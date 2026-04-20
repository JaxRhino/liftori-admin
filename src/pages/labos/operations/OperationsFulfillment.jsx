// =====================================================================
// OperationsFulfillment — the order-packing workbench.
// Status filter chips, order cards with urgency, detail drawer with
// mark-shipped + tracking entry.
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { Truck, Search, X, Package, MapPin, Clock, Copy, Check, ExternalLink, AlertTriangle } from 'lucide-react'
import { HubPage, useLabosClient } from '../_shared'

const STATUS_ORDER = ['pending','paid','processing','shipped','delivered','cancelled','refunded']
const STATUS_LABELS = {
  pending: 'Awaiting Payment',
  paid: 'Ready to Pack',
  processing: 'Packing',
  shipped: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}
const STATUS_TONE = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  paid: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
  processing: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  shipped: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  delivered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/30',
  refunded: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
}

export default function OperationsFulfillment() {
  const { client } = useLabosClient()
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('needs_action')
  const [search, setSearch] = useState('')
  const [openOrder, setOpenOrder] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true)
    const { data: orderRows } = await client.from('orders').select('*').order('ordered_at', { ascending: false })
    const all = orderRows || []
    setOrders(all)
    // Fetch items for all orders in one go
    if (all.length > 0) {
      const ids = all.map(o => o.id)
      const { data: itemRows } = await client.from('order_items').select('*').in('order_id', ids)
      const map = {}
      ;(itemRows || []).forEach(i => {
        if (!map[i.order_id]) map[i.order_id] = []
        map[i.order_id].push(i)
      })
      setItems(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [client])

  const stats = useMemo(() => {
    const todayStr = new Date().toDateString()
    const toPack = orders.filter(o => o.status === 'paid' || o.status === 'pending').length
    const inTransit = orders.filter(o => o.status === 'shipped').length
    const deliveredToday = orders.filter(o => o.delivered_at && new Date(o.delivered_at).toDateString() === todayStr).length
    const revenueToday = orders
      .filter(o => new Date(o.ordered_at).toDateString() === todayStr)
      .reduce((s, o) => s + Number(o.total || 0), 0)
    return { toPack, inTransit, deliveredToday, revenueToday }
  }, [orders])

  const filtered = useMemo(() => {
    let list = orders
    if (filter === 'needs_action') list = list.filter(o => o.status === 'paid' || o.status === 'pending' || o.status === 'processing')
    else if (filter === 'shipped') list = list.filter(o => o.status === 'shipped')
    else if (filter === 'delivered') list = list.filter(o => o.status === 'delivered')
    else if (filter === 'cancelled') list = list.filter(o => o.status === 'cancelled' || o.status === 'refunded')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_email || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [orders, filter, search])

  const countsByFilter = useMemo(() => ({
    all: orders.length,
    needs_action: orders.filter(o => ['paid','pending','processing'].includes(o.status)).length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => ['cancelled','refunded'].includes(o.status)).length,
  }), [orders])

  return (
    <HubPage
      title="Order Fulfillment"
      subtitle="Pack, ship, and track every order from purchase to doorstep"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <FulfillStat icon={<Package className="w-4 h-4" />} label="To Pack" value={stats.toPack} tone="amber" urgent={stats.toPack > 0} />
        <FulfillStat icon={<Truck className="w-4 h-4" />} label="In Transit" value={stats.inTransit} tone="sky" />
        <FulfillStat icon={<Check className="w-4 h-4" />} label="Delivered Today" value={stats.deliveredToday} tone="emerald" />
        <FulfillStat icon={<Package className="w-4 h-4" />} label="Revenue Today" value={`$${stats.revenueToday.toFixed(0)}`} tone="blue" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order number, customer name or email..."
            className="w-full pl-10 pr-4 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        {[
          { key: 'needs_action', label: 'Needs Action' },
          { key: 'shipped', label: 'Shipped' },
          { key: 'delivered', label: 'Delivered' },
          { key: 'cancelled', label: 'Cancelled' },
          { key: 'all', label: 'All Orders' },
        ].map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-brand-blue text-white'
                  : 'bg-navy-800 text-gray-400 hover:bg-navy-700 hover:text-white border border-navy-700/50'
              }`}
            >
              {f.label} <span className={`ml-1 ${active ? 'opacity-80' : 'opacity-60'}`}>{countsByFilter[f.key]}</span>
            </button>
          )
        })}
      </div>

      {/* Order list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-navy-800 border border-navy-700/50 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gradient-to-br from-emerald-500/5 via-navy-800 to-navy-800 border border-dashed border-navy-700/60 rounded-2xl p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <Truck className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-1">
            {filter === 'needs_action' ? 'All caught up!' : 'No orders match'}
          </h3>
          <p className="text-gray-400 text-sm max-w-sm mx-auto">
            {filter === 'needs_action' ? 'Every paid order is packed and on its way. Nice work.' : 'Try another filter or clear your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <OrderCard
              key={o.id}
              order={o}
              items={items[o.id] || []}
              onOpen={() => setOpenOrder(o)}
            />
          ))}
        </div>
      )}

      {openOrder && (
        <OrderDrawer
          order={openOrder}
          items={items[openOrder.id] || []}
          onClose={() => setOpenOrder(null)}
          onSaved={() => { setOpenOrder(null); load() }}
          client={client}
        />
      )}
    </HubPage>
  )
}

function FulfillStat({ icon, label, value, tone = 'gray', urgent }) {
  const tones = {
    blue: 'text-brand-blue bg-brand-blue/10 border-brand-blue/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    gray: 'text-gray-300 bg-navy-700/40 border-navy-700/50',
  }
  return (
    <div className={`bg-navy-800 border rounded-xl p-4 ${urgent ? 'border-amber-500/40' : 'border-navy-700/50'}`}>
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${tones[tone]}`}>{icon}</div>
        {urgent && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{label}</div>
      </div>
    </div>
  )
}

function OrderCard({ order, items, onOpen }) {
  const hoursAgo = Math.floor((Date.now() - new Date(order.ordered_at).getTime()) / (1000 * 60 * 60))
  const urgency = order.status === 'paid' && hoursAgo > 48 ? 'overdue' : order.status === 'paid' && hoursAgo > 24 ? 'warning' : 'normal'
  const borderTone = urgency === 'overdue' ? 'border-red-500/40' : urgency === 'warning' ? 'border-amber-500/40' : 'border-navy-700/50'
  const itemCount = items.reduce((s, i) => s + Number(i.quantity || 1), 0)

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left bg-navy-800 border rounded-xl p-4 hover:border-brand-blue/50 transition-colors ${borderTone}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold">{order.order_number}</span>
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${STATUS_TONE[order.status] || STATUS_TONE.pending}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
            {urgency === 'overdue' && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {hoursAgo}h — ship ASAP
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400 mt-1.5">
            {order.customer_name || order.customer_email || 'Guest'}
            <span className="text-gray-600 mx-1.5">·</span>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
            <span className="text-gray-600 mx-1.5">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`}
            </span>
          </div>
          {order.shipping_address?.city && (
            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {order.shipping_address.city}, {order.shipping_address.state || order.shipping_address.country}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg text-white font-semibold">${Number(order.total || 0).toFixed(2)}</div>
          {order.tracking_number && (
            <div className="text-xs text-sky-400 mt-1 flex items-center gap-1 justify-end">
              <Truck className="w-3 h-3" />
              {order.tracking_carrier || 'Tracked'}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function OrderDrawer({ order, items, onClose, onSaved, client }) {
  const [tracking, setTracking] = useState(order.tracking_number || '')
  const [carrier, setCarrier] = useState(order.tracking_carrier || 'USPS')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function markShipped() {
    if (!tracking.trim()) { setError('Enter a tracking number first.'); return }
    setSaving(true)
    setError('')
    try {
      const { error: e } = await client.from('orders').update({
        status: 'shipped',
        tracking_number: tracking.trim(),
        tracking_carrier: carrier,
        shipped_at: new Date().toISOString(),
      }).eq('id', order.id)
      if (e) throw e
      onSaved()
    } catch (e) { setError(e.message || 'Failed to mark shipped') }
    finally { setSaving(false) }
  }

  async function markDelivered() {
    setSaving(true)
    try {
      const { error: e } = await client.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', order.id)
      if (e) throw e
      onSaved()
    } catch (e) { setError(e.message || 'Failed') }
    finally { setSaving(false) }
  }

  async function updateStatus(newStatus) {
    setSaving(true)
    try {
      const { error: e } = await client.from('orders').update({ status: newStatus }).eq('id', order.id)
      if (e) throw e
      onSaved()
    } catch (e) { setError(e.message || 'Failed') }
    finally { setSaving(false) }
  }

  function copyAddress() {
    const a = order.shipping_address || {}
    const text = [a.name || order.customer_name, a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(', '), a.country].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-xl bg-navy-900 border-l border-navy-700/50 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700/50 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">{order.order_number}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${STATUS_TONE[order.status] || STATUS_TONE.pending}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
              <span className="text-xs text-gray-500">{new Date(order.ordered_at).toLocaleString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-navy-800 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Customer */}
          <Section label="Customer">
            <div className="bg-navy-800/60 rounded-lg px-4 py-3">
              <div className="text-sm text-white font-medium">{order.customer_name || '—'}</div>
              <div className="text-xs text-gray-400 mt-0.5">{order.customer_email}</div>
            </div>
          </Section>

          {/* Shipping address */}
          {order.shipping_address && Object.keys(order.shipping_address).length > 0 && (
            <Section label="Shipping Address" action={
              <button onClick={copyAddress} className="text-xs text-brand-blue hover:text-brand-cyan flex items-center gap-1">
                {copied ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
              </button>
            }>
              <div className="bg-navy-800/60 rounded-lg px-4 py-3 text-sm text-gray-300 leading-relaxed">
                <div>{order.shipping_address.name || order.customer_name}</div>
                {order.shipping_address.line1 && <div>{order.shipping_address.line1}</div>}
                {order.shipping_address.line2 && <div>{order.shipping_address.line2}</div>}
                <div>
                  {[order.shipping_address.city, order.shipping_address.state, order.shipping_address.postal_code].filter(Boolean).join(', ')}
                </div>
                {order.shipping_address.country && <div>{order.shipping_address.country}</div>}
              </div>
            </Section>
          )}

          {/* Items */}
          <Section label={`Items (${items.length})`}>
            <div className="bg-navy-800/60 rounded-lg overflow-hidden">
              {items.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">No line items recorded.</div>
              ) : (
                <ul className="divide-y divide-navy-700/50">
                  {items.map(i => (
                    <li key={i.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white">{i.product_title || i.title || 'Item'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Qty {i.quantity || 1} × ${Number(i.price || 0).toFixed(2)}</div>
                      </div>
                      <div className="text-sm text-brand-cyan">${(Number(i.price || 0) * Number(i.quantity || 1)).toFixed(2)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          {/* Totals */}
          <Section label="Totals">
            <div className="bg-navy-800/60 rounded-lg px-4 py-3 space-y-1.5">
              <Row label="Subtotal" value={`$${Number(order.subtotal || 0).toFixed(2)}`} />
              <Row label="Shipping" value={`$${Number(order.shipping || 0).toFixed(2)}`} />
              <Row label="Tax" value={`$${Number(order.tax || 0).toFixed(2)}`} />
              <div className="h-px bg-navy-700/50 my-1.5" />
              <Row label="Total" value={`$${Number(order.total || 0).toFixed(2)}`} bold />
            </div>
          </Section>

          {/* Tracking + actions */}
          {(order.status === 'paid' || order.status === 'pending' || order.status === 'processing') && (
            <Section label="Mark as Shipped">
              <div className="bg-navy-800/60 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-[1fr_120px] gap-2">
                  <input
                    value={tracking}
                    onChange={e => setTracking(e.target.value)}
                    placeholder="Tracking number"
                    className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
                  />
                  <select
                    value={carrier}
                    onChange={e => setCarrier(e.target.value)}
                    className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
                  >
                    <option>USPS</option>
                    <option>UPS</option>
                    <option>FedEx</option>
                    <option>DHL</option>
                    <option>Other</option>
                  </select>
                </div>
                <button
                  onClick={markShipped}
                  disabled={saving || !tracking.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  <Truck className="w-4 h-4" />
                  Ship It
                </button>
              </div>
            </Section>
          )}

          {order.status === 'shipped' && (
            <Section label="Currently in Transit">
              <div className="bg-navy-800/60 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm text-white font-medium">{order.tracking_carrier} · {order.tracking_number}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Shipped {new Date(order.shipped_at).toLocaleDateString()}</div>
                  </div>
                  {order.tracking_carrier === 'USPS' && (
                    <a
                      href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.tracking_number}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-blue hover:text-brand-cyan flex items-center gap-1"
                    >
                      Track <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <button
                  onClick={markDelivered}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  <Check className="w-4 h-4" />
                  Mark Delivered
                </button>
              </div>
            </Section>
          )}

          {order.notes && (
            <Section label="Notes">
              <div className="bg-navy-800/60 rounded-lg px-4 py-3 text-sm text-gray-300 whitespace-pre-wrap">{order.notes}</div>
            </Section>
          )}

          {/* Status override */}
          {!['delivered','cancelled','refunded'].includes(order.status) && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-300">More actions</summary>
              <div className="mt-2 flex gap-2">
                <button onClick={() => updateStatus('cancelled')} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-500/30 rounded-lg">Cancel order</button>
                <button onClick={() => updateStatus('refunded')} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-navy-700/50 rounded-lg">Mark refunded</button>
              </div>
            </details>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, action, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        {action}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between">
      <span className={`text-sm ${bold ? 'text-white font-semibold' : 'text-gray-400'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'text-white font-semibold' : 'text-gray-300'}`}>{value}</span>
    </div>
  )
}
