import { useEffect, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useLabosClient } from './_shared'

export default function LabosOperations() {
  const { client, platform } = useLabosClient()
  const [tasks, setTasks] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const isThrift = platform?.industry === 'thrift_retail'

  useEffect(() => {
    if (!client) return
    async function load() {
      setLoading(true)
      const results = await Promise.all([
        client.from('operations_tasks').select('*').order('created_at', { ascending: false }).limit(50),
        isThrift ? client.from('orders').select('*').order('ordered_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
      ])
      setTasks(results[0].data || [])
      setOrders(results[1].data || [])
      setLoading(false)
    }
    load()
  }, [client, isThrift])

  const statusCount = s => tasks.filter(t => t.status === s).length

  return (
    <HubPage title="Operations" subtitle={isThrift ? 'Task queue + order fulfillment' : 'Task queue + daily workflow'}>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="To Do" value={statusCount('todo')} />
        <StatCard label="In Progress" value={statusCount('in_progress')} accent="text-brand-blue" />
        <StatCard label="Blocked" value={statusCount('blocked')} accent="text-amber-400" />
        <StatCard label="Completed" value={statusCount('done')} accent="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Task Queue">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading...</div>
          ) : tasks.length === 0 ? (
            <EmptyState title="No tasks yet" description="Create tasks to track work across your team." />
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {tasks.slice(0, 10).map(t => (
                <li key={t.id} className="px-5 py-3">
                  <div className="flex justify-between">
                    <div className="text-sm text-white">{t.title}</div>
                    <span className="text-xs text-gray-400 capitalize">{t.status.replace('_',' ')}</span>
                  </div>
                  {t.due_date && <div className="text-xs text-gray-500 mt-1">Due {new Date(t.due_date).toLocaleDateString()}</div>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {isThrift && (
          <Section title="Order Fulfillment" right={<span className="text-xs text-gray-500">{orders.length} recent</span>}>
            {loading ? (
              <div className="p-6 text-sm text-gray-500">Loading...</div>
            ) : orders.length === 0 ? (
              <EmptyState title="No orders yet" description="Orders from your storefront will appear here ready to pack and ship." />
            ) : (
              <ul className="divide-y divide-navy-700/50">
                {orders.slice(0, 10).map(o => (
                  <li key={o.id} className="px-5 py-3">
                    <div className="flex justify-between">
                      <div className="text-sm text-white font-medium">{o.order_number}</div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-navy-700/50 text-gray-300 capitalize">{o.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{o.customer_name || o.customer_email} · ${Number(o.total).toFixed(2)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>
    </HubPage>
  )
}
