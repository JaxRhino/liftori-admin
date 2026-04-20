import { useEffect, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useLabosClient } from './_shared'

export default function LabosCommunications() {
  const { client } = useLabosClient()
  const [comms, setComms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client) return
    async function load() {
      setLoading(true)
      const { data } = await client.from('communications').select('*').order('occurred_at', { ascending: false }).limit(50)
      setComms(data || [])
      setLoading(false)
    }
    load()
  }, [client])

  const counts = (ch, dir) => comms.filter(c => c.channel === ch && (!dir || c.direction === dir)).length

  return (
    <HubPage title="Communications" subtitle="Call log, SMS, and email history">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Calls" value={counts('call')} />
        <StatCard label="SMS" value={counts('sms')} accent="text-brand-blue" />
        <StatCard label="Email" value={counts('email')} accent="text-brand-cyan" />
        <StatCard label="Inbound (all)" value={comms.filter(c => c.direction === 'inbound').length} accent="text-emerald-400" />
      </div>

      <Section title="Recent Activity">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : comms.length === 0 ? (
          <EmptyState title="No communications logged" description="Calls, SMS, and emails will appear here as they're sent or received." />
        ) : (
          <ul className="divide-y divide-navy-700/50">
            {comms.map(c => (
              <li key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-navy-700/50 text-gray-300 capitalize">{c.channel}</span>
                    <span className="text-xs text-gray-500 capitalize">{c.direction}</span>
                    <span className="text-sm text-white">{c.contact_name || c.contact_email || c.contact_phone || '—'}</span>
                  </div>
                  {c.subject && <div className="text-xs text-gray-400 mt-1">{c.subject}</div>}
                </div>
                <div className="text-xs text-gray-500">{new Date(c.occurred_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </HubPage>
  )
}
