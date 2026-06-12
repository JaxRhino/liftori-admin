// =====================================================================
// EcomCustomers - shop customers list + detail drawer with order
// history and lifetime value. (The ecommerce tenant DB uses a
// `customers` table, not the service-CRM customer_contacts.)
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { HubPage, StatCard } from '../crm/_shared'
import {
  useCrmClient, fmtMoney, fmtMoney0, fmtDate, relTime,
  StatusChip, ORDER_STATUS, Drawer,
} from './_ecomShared'

const COUNTED_STATUSES = ['paid', 'packaging', 'shipped', 'delivered']

export default function EcomCustomers() {
  const { client } = useCrmClient()
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!client) return
    let active = true
    async function load() {
      try {
        setLoading(true)
        const [cust, ords] = await Promise.all([
          client.from('customers').select('*').order('created_at', { ascending: false }),
          client.from('orders').select('id,order_number,customer_id,status,total,created_at').order('created_at', { ascending: false }),
        ])
        if (!active) return
        if (cust.error) throw cust.error
        setCustomers(cust.data || [])
        setOrders(ords.data || [])
      } catch (e) {
        console.error('Error loading customers:', e)
        toast.error('Failed to load customers')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [client])

  const byCustomer = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      if (!o.customer_id) return
      if (!map[o.customer_id]) map[o.customer_id] = { orders: [], ltv: 0 }
      map[o.customer_id].orders.push(o)
      if (COUNTED_STATUSES.includes(o.status)) map[o.customer_id].ltv += Number(o.total || 0)
    })
    return map
  }, [orders])

  const name = (c) => `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unnamed'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c => [name(c), c.email, c.phone].filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
  }, [customers, search])

  const totals = useMemo(() => {
    const ltvAll = Object.values(byCustomer).reduce((s, v) => s + v.ltv, 0)
    const repeat = Object.values(byCustomer).filter(v => v.orders.length > 1).length
    return { count: customers.length, ltvAll, repeat }
  }, [customers, byCustomer])

  const selectedStats = selected ? byCustomer[selected.id] || { orders: [], ltv: 0 } : null

  if (loading) return <div className="p-6 text-gray-400">Loading customers...</div>

  return (
    <HubPage title="Customers" subtitle="Everyone who has bought from the shop">
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Customers" value={totals.count} />
        <StatCard label="Repeat Buyers" value={totals.repeat} accent="text-brand-cyan" />
        <StatCard label="Total Spent" value={fmtMoney0(totals.ltvAll)} accent="text-emerald-300" />
      </div>

      <div className="relative max-w-md mb-4">
        {Search ? <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /> : null}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone..."
          className="w-full bg-navy-900 border border-navy-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder-gray-500" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-12 text-center">
          <h3 className="text-white font-semibold mb-1">No customers yet</h3>
          <p className="text-gray-400 text-sm">Customers appear automatically when an order comes in.</p>
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden divide-y divide-navy-700/40">
          {filtered.map(c => {
            const s = byCustomer[c.id] || { orders: [], ltv: 0 }
            return (
              <button key={c.id} onClick={() => setSelected(c)} className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-navy-900/50 transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {name(c).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">{name(c)}</div>
                    <div className="text-xs text-gray-500 truncate">{c.email}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm text-white font-semibold">{fmtMoney0(s.ltv)}</div>
                  <div className="text-xs text-gray-500">{s.orders.length} order{s.orders.length === 1 ? '' : 's'}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* DETAIL DRAWER */}
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? name(selected) : ''}>
        {selected && selectedStats && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-3">
                <p className="text-gray-400 text-[11px] uppercase tracking-wider">Lifetime Value</p>
                <p className="text-xl font-bold text-emerald-300 mt-0.5">{fmtMoney(selectedStats.ltv)}</p>
              </div>
              <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-3">
                <p className="text-gray-400 text-[11px] uppercase tracking-wider">Orders</p>
                <p className="text-xl font-bold text-white mt-0.5">{selectedStats.orders.length}</p>
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Contact</h3>
              <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-3 text-sm space-y-1">
                {selected.email && <div className="text-gray-300">{selected.email}</div>}
                {selected.phone && <div className="text-gray-300">{selected.phone}</div>}
                <div className="text-xs text-gray-500">Customer since {fmtDate(selected.created_at)}</div>
              </div>
            </div>

            {selected.notes && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Notes</h3>
                <p className="text-sm text-gray-300 bg-navy-800 border border-navy-700/50 rounded-lg p-3">{selected.notes}</p>
              </div>
            )}

            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Order History</h3>
              {selectedStats.orders.length === 0 ? (
                <div className="text-sm text-gray-500">No orders yet.</div>
              ) : (
                <div className="space-y-2">
                  {selectedStats.orders.map(o => (
                    <div key={o.id} className="flex items-center justify-between bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2.5">
                      <div>
                        <div className="text-sm text-white">#{o.order_number || String(o.id).slice(0, 8)}</div>
                        <div className="text-xs text-gray-500">{relTime(o.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-semibold">{fmtMoney(o.total)}</span>
                        <StatusChip map={ORDER_STATUS} value={o.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </HubPage>
  )
}
