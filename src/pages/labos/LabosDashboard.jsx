import { useEffect, useState } from 'react'
import { HubPage, StatCard, Section, useLabosClient } from './_shared'

export default function LabosDashboard() {
  const { client, orgSettings } = useLabosClient()
  const [stats, setStats] = useState({ products: 0, published: 0, orders: 0, revenue: 0, subscribers: 0, openTickets: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client) return
    async function load() {
      setLoading(true)
      const [{ count: products }, { count: published }, { data: orders }, { count: subscribers }, { count: openTickets }, { data: activity }] = await Promise.all([
        client.from('products').select('*', { count: 'exact', head: true }),
        client.from('products').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        client.from('orders').select('total,status,ordered_at'),
        client.from('email_subscribers').select('*', { count: 'exact', head: true }).is('unsubscribed_at', null),
        client.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open','in_progress','waiting']),
        client.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8),
      ])
      const revenue = (orders || []).filter(o => o.status !== 'cancelled' && o.status !== 'refunded').reduce((s, o) => s + Number(o.total || 0), 0)
      setStats({
        products: products || 0,
        published: published || 0,
        orders: (orders || []).length,
        revenue,
        subscribers: subscribers || 0,
        openTickets: openTickets || 0,
      })
      setRecent(activity || [])
      setLoading(false)
    }
    load()
  }, [client])

  return (
    <HubPage title="Dashboard" subtitle={`${orgSettings?.business_name || 'Your business'} at a glance`}>
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard label="Products" value={stats.products} />
            <StatCard label="Published" value={stats.published} accent="text-emerald-400" />
            <StatCard label="Orders" value={stats.orders} accent="text-brand-blue" />
            <StatCard label="Revenue" value={`$${stats.revenue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`} accent="text-brand-cyan" />
            <StatCard label="Subscribers" value={stats.subscribers} />
            <StatCard label="Open Tickets" value={stats.openTickets} accent={stats.openTickets ? 'text-amber-400' : 'text-white'} />
          </div>
          <Section title="Recent activity">
            {recent.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">No activity yet — this will populate as your team uses LABOS.</div>
            ) : (
              <ul className="divide-y divide-navy-700/50">
                {recent.map(r => (
                  <li key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white">{r.action}</div>
                      {r.actor_name && <div className="text-xs text-gray-500">by {r.actor_name}</div>}
                    </div>
                    <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </HubPage>
  )
}
