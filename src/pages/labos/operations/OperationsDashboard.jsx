// =====================================================================
// OperationsDashboard — the pulse of the customer's business.
// Stats up top, today's priorities, recent orders, active tasks.
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Truck, DollarSign, ClipboardList, TrendingUp, AlertCircle, Plus } from 'lucide-react'
import { HubPage, useLabosClient } from '../_shared'

export default function OperationsDashboard() {
  const { client, platform } = useLabosClient()
  const [tasks, setTasks] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const isThrift = platform?.industry === 'thrift_retail'

  useEffect(() => {
    if (!client) return
    async function load() {
      setLoading(true)
      const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      const [t, p, o] = await Promise.all([
        client.from('operations_tasks').select('*').order('created_at', { ascending: false }).limit(50),
        isThrift ? client.from('products').select('id,title,price,status,main_image_url,stock_quantity,created_at').order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
        isThrift ? client.from('orders').select('*').gte('ordered_at', since30).order('ordered_at', { ascending: false }) : Promise.resolve({ data: [] }),
      ])
      setTasks(t.data || [])
      setProducts(p.data || [])
      setOrders(o.data || [])
      setLoading(false)
    }
    load()
  }, [client, isThrift])

  const stats = useMemo(() => {
    const toShip = orders.filter(o => ['pending', 'processing', 'paid'].includes(o.status)).length
    const shippedToday = orders.filter(o => {
      if (!o.shipped_at) return false
      const d = new Date(o.shipped_at)
      return d.toDateString() === new Date().toDateString()
    }).length
    const revenueMonth = orders.reduce((s, o) => s + Number(o.total || 0), 0)
    const activeListings = products.filter(p => p.status === 'published' || p.status === 'active').length
    return { toShip, shippedToday, revenueMonth, activeListings }
  }, [orders, products])

  const urgentTasks = useMemo(() => tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').slice(0, 5), [tasks])
  const recentOrders = useMemo(() => orders.slice(0, 6), [orders])

  return (
    <HubPage
      title="Today's Operations"
      subtitle={isThrift ? 'Your storefront pulse at a glance' : 'Task queue + daily workflow'}
    >
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <BigStat
          icon={<Package className="w-5 h-5" />}
          label="Active Listings"
          value={stats.activeListings}
          tone="blue"
          link="../inventory"
        />
        <BigStat
          icon={<Truck className="w-5 h-5" />}
          label="Orders to Ship"
          value={stats.toShip}
          tone={stats.toShip > 0 ? 'amber' : 'emerald'}
          hint={stats.shippedToday > 0 ? `${stats.shippedToday} shipped today` : null}
          link="../fulfillment"
        />
        <BigStat
          icon={<DollarSign className="w-5 h-5" />}
          label="Revenue (30d)"
          value={`$${stats.revenueMonth.toFixed(0)}`}
          tone="emerald"
          hint={`${orders.length} orders`}
        />
        <BigStat
          icon={<ClipboardList className="w-5 h-5" />}
          label="Open Tasks"
          value={urgentTasks.length}
          tone={urgentTasks.length > 5 ? 'amber' : 'gray'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-brand-blue/15 via-brand-blue/5 to-transparent border border-brand-blue/20 rounded-xl p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-brand-blue" />
            <h3 className="text-white font-semibold">Quick Actions</h3>
          </div>
          <div className="space-y-2">
            <Link to="../inventory" className="block w-full text-left px-4 py-3 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition-colors">
              <Plus className="w-4 h-4 inline mr-2" />
              Add New Listing
            </Link>
            <Link to="../fulfillment" className="block w-full text-left px-4 py-3 bg-navy-800 text-white rounded-lg text-sm hover:bg-navy-700 transition-colors">
              <Truck className="w-4 h-4 inline mr-2" />
              Pack & Ship Orders
            </Link>
            <Link to="../team" className="block w-full text-left px-4 py-3 bg-navy-800 text-white rounded-lg text-sm hover:bg-navy-700 transition-colors">
              <Plus className="w-4 h-4 inline mr-2" />
              Invite Teammate
            </Link>
            <Link to="../../marketing" className="block w-full text-left px-4 py-3 bg-navy-800 text-white rounded-lg text-sm hover:bg-navy-700 transition-colors">
              <Plus className="w-4 h-4 inline mr-2" />
              Share a Post
            </Link>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden lg:col-span-2">
          <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
            <h3 className="text-white font-semibold">Recent Orders</h3>
            <Link to="../fulfillment" className="text-xs text-brand-blue hover:text-brand-cyan">View all →</Link>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading...</div>
          ) : recentOrders.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-10 h-10 mx-auto text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">No orders in the last 30 days yet.</p>
              <p className="text-xs text-gray-500 mt-1">Share your shop to bring in the first sale.</p>
            </div>
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {recentOrders.map(o => (
                <li key={o.id} className="px-5 py-3 hover:bg-navy-900/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">{o.order_number}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {o.customer_name || o.customer_email || 'Guest'} · {new Date(o.ordered_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-sm text-brand-cyan font-medium">${Number(o.total).toFixed(2)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Task Queue */}
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden lg:col-span-3">
          <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Active Tasks
            </h3>
            <span className="text-xs text-gray-500">{urgentTasks.length} open</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading...</div>
          ) : urgentTasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">All caught up — no active tasks.</div>
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {urgentTasks.map(t => (
                <li key={t.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${t.status === 'in_progress' ? 'bg-brand-blue' : 'bg-amber-400'}`} />
                    <div>
                      <div className="text-sm text-white">{t.title}</div>
                      {t.due_date && <div className="text-xs text-gray-500 mt-0.5">Due {new Date(t.due_date).toLocaleDateString()}</div>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{t.status.replace('_',' ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </HubPage>
  )
}

function BigStat({ icon, label, value, tone = 'gray', hint, link }) {
  const tones = {
    blue: 'text-brand-blue bg-brand-blue/10 border-brand-blue/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    gray: 'text-gray-300 bg-navy-700/40 border-navy-700/50',
  }
  const Card = link ? Link : 'div'
  const cardProps = link ? { to: link } : {}
  return (
    <Card
      {...cardProps}
      className={`block bg-navy-800 border border-navy-700/50 rounded-xl p-4 transition-all ${link ? 'hover:border-brand-blue/40 cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${tones[tone]}`}>{icon}</div>
        {link && <span className="text-xs text-gray-500">→</span>}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-gray-400 uppercase tracking-wide mt-1">{label}</div>
        {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
      </div>
    </Card>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    paid: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
    processing: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
    shipped: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    delivered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    cancelled: 'bg-red-500/15 text-red-300 border-red-500/30',
    refunded: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  }
  const cls = map[status] || 'bg-navy-700 text-gray-300 border-navy-600'
  return <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls} font-medium`}>{status}</span>
}
