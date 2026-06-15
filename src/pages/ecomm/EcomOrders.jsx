// =====================================================================
// EcomOrders - order list with status filters + detail drawer with
// items, customer, shipping address, and status-advance buttons.
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { supabase as mainDb } from '../../lib/supabase'
import { HubPage } from '../crm/_shared'
import {
  useCrmClient, fmtMoney, fmtDate, relTime, StatusChip,
  ORDER_STATUS, ORDER_FLOW, ListingThumb, Drawer, logActivity,
} from './_ecomShared'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'refunded', label: 'Refunded' },
]

export default function EcomOrders() {
  useCrmClient()
  const client = mainDb
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null) // order row
  const [detail, setDetail] = useState({ items: [], address: null, loading: false })
  const [advancing, setAdvancing] = useState(false)

  async function load() {
    try {
      setLoading(true)
      const { data, error } = await client
        .from('orders')
        .select('*, customer:customers(id,first_name,last_name,email,phone)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setOrders(data || [])
    } catch (e) {
      console.error('Error loading orders:', e)
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (client) load() /* eslint-disable-next-line */ }, [client])

  async function openOrder(order) {
    setSelected(order)
    setDetail({ items: [], address: null, loading: true })
    try {
      const [items, addr] = await Promise.all([
        client.from('order_items')
          .select('*, product:products(id,title,main_image_url,sku)')
          .eq('order_id', order.id),
        order.shipping_address_id
          ? client.from('shipping_addresses').select('*').eq('id', order.shipping_address_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      setDetail({ items: items.data || [], address: addr.data || null, loading: false })
    } catch (e) {
      console.error('Error loading order detail:', e)
      setDetail({ items: [], address: null, loading: false })
      toast.error('Failed to load order details')
    }
  }

  async function advanceStatus(order, nextStatus) {
    if (advancing) return
    setAdvancing(true)
    try {
      const { error } = await client.from('orders').update({ status: nextStatus }).eq('id', order.id)
      if (error) throw error
      logActivity(client, 'order_status_changed', 'order', order.id, {
        order_number: order.order_number, from: order.status, to: nextStatus,
      })
      toast.success(`Order moved to ${ORDER_STATUS[nextStatus]?.label || nextStatus}`)
      setSelected(s => (s && s.id === order.id ? { ...s, status: nextStatus } : s))
      setOrders(list => list.map(o => (o.id === order.id ? { ...o, status: nextStatus } : o)))
    } catch (e) {
      console.error('Error advancing order:', e)
      toast.error('Failed to update order status')
    } finally {
      setAdvancing(false)
    }
  }

  const counts = useMemo(() => {
    const c = { all: orders.length }
    FILTERS.slice(1).forEach(f => { c[f.key] = orders.filter(o => o.status === f.key).length })
    return c
  }, [orders])

  const custName = (o) => {
    const c = o.customer
    if (!c) return 'Guest'
    return `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Guest'
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter(o => {
      if (filter !== 'all' && o.status !== filter) return false
      if (!q) return true
      return [o.order_number, custName(o), o.customer?.email].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    })
  }, [orders, filter, search])

  const nextStatus = selected ? ORDER_FLOW[ORDER_FLOW.indexOf(selected.status) + 1] : null

  if (loading) return <div className="p-6 text-gray-400">Loading orders...</div>

  return (
    <HubPage title="Orders" subtitle={`${counts.paid || 0} to pack · ${counts.packaging || 0} to ship`}>
      {/* FILTERS */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition ${
              filter === f.key ? 'border-brand-blue text-brand-blue bg-brand-blue/10' : 'border-navy-700 text-gray-400 hover:text-white'
            }`}>
            {f.label} ({counts[f.key] || 0})
          </button>
        ))}
      </div>
      <div className="relative max-w-md mb-4">
        {Search ? <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /> : null}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order #, customer..."
          className="w-full bg-navy-900 border border-navy-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder-gray-500" />
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-12 text-center">
          <h3 className="text-white font-semibold mb-1">No orders {filter !== 'all' ? `in ${filter}` : 'yet'}</h3>
          <p className="text-gray-400 text-sm">Website checkouts will land here automatically.</p>
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden divide-y divide-navy-700/40">
          {filtered.map(o => (
            <button key={o.id} onClick={() => openOrder(o)} className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-navy-900/50 transition-colors text-left">
              <div className="min-w-0">
                <div className="text-sm text-white font-medium">#{o.order_number || String(o.id).slice(0, 8)}</div>
                <div className="text-xs text-gray-500 truncate">{custName(o)} · {relTime(o.created_at)}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm text-white font-semibold">{fmtMoney(o.total)}</span>
                <StatusChip map={ORDER_STATUS} value={o.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* DETAIL DRAWER */}
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `Order #${selected.order_number || String(selected.id).slice(0, 8)}` : ''} wide>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <StatusChip map={ORDER_STATUS} value={selected.status} />
              <span className="text-xs text-gray-500">{fmtDate(selected.created_at)}</span>
            </div>

            {/* STATUS ADVANCE */}
            {nextStatus && (
              <button
                onClick={() => advanceStatus(selected, nextStatus)}
                disabled={advancing}
                className="w-full px-4 py-3 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {advancing ? 'Updating...' : `Mark ${ORDER_STATUS[nextStatus]?.label || nextStatus}`}
              </button>
            )}

            {/* ITEMS */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Items</h3>
              {detail.loading ? (
                <div className="text-sm text-gray-500">Loading items...</div>
              ) : detail.items.length === 0 ? (
                <div className="text-sm text-gray-500">No line items found.</div>
              ) : (
                <div className="space-y-2">
                  {detail.items.map(it => (
                    <div key={it.id} className="flex items-center gap-3 bg-navy-800 border border-navy-700/50 rounded-lg p-2.5">
                      <ListingThumb src={it.product?.main_image_url} alt={it.product?.title} className="w-12 h-12" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{it.product?.title || 'Listing removed'}</div>
                        <div className="text-xs text-gray-500">{it.product?.sku ? `${it.product.sku} · ` : ''}Qty {it.quantity}</div>
                      </div>
                      <div className="text-sm text-white font-semibold shrink-0">{fmtMoney(it.price)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TOTALS */}
            <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{fmtMoney(selected.subtotal)}</span></div>
              <div className="flex justify-between text-gray-400"><span>Shipping</span><span>{fmtMoney(selected.shipping_cost)}</span></div>
              <div className="flex justify-between text-gray-400"><span>Tax</span><span>{fmtMoney(selected.tax)}</span></div>
              <div className="flex justify-between text-white font-semibold pt-1.5 border-t border-navy-700/50"><span>Total</span><span>{fmtMoney(selected.total)}</span></div>
            </div>

            {/* CUSTOMER */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Customer</h3>
              <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-3 text-sm">
                <div className="text-white">{custName(selected)}</div>
                {selected.customer?.email && <div className="text-gray-400 text-xs mt-0.5">{selected.customer.email}</div>}
                {selected.customer?.phone && <div className="text-gray-400 text-xs mt-0.5">{selected.customer.phone}</div>}
              </div>
            </div>

            {/* SHIPPING ADDRESS */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Ship to</h3>
              {detail.address ? (
                <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-3 text-sm text-gray-300 leading-relaxed">
                  <div className="text-white">{detail.address.name}</div>
                  <div>{detail.address.line1}</div>
                  {detail.address.line2 && <div>{detail.address.line2}</div>}
                  <div>{[detail.address.city, detail.address.state].filter(Boolean).join(', ')} {detail.address.postal_code}</div>
                  <div>{detail.address.country}</div>
                  {detail.address.phone && <div className="text-gray-500 text-xs mt-1">{detail.address.phone}</div>}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No shipping address on file.</div>
              )}
              {selected.label_url && (
                <a href={selected.label_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-brand-blue hover:text-brand-light">
                  View shipping label
                </a>
              )}
            </div>

            {selected.notes && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Notes</h3>
                <p className="text-sm text-gray-300 bg-navy-800 border border-navy-700/50 rounded-lg p-3">{selected.notes}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </HubPage>
  )
}
