import { useEffect, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useLabosClient } from './_shared'

export default function LabosSupport() {
  const { client } = useLabosClient()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ subject: '', description: '', priority: 'normal' })

  useEffect(() => {
    if (!client) return
    async function load() {
      setLoading(true)
      const { data } = await client.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(50)
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [client])

  async function createTicket(e) {
    e.preventDefault()
    if (!form.subject.trim()) return
    const { data, error } = await client.from('support_tickets').insert(form).select('*').single()
    if (!error && data) {
      setTickets([data, ...tickets])
      setForm({ subject: '', description: '', priority: 'normal' })
      setShowNew(false)
    }
  }

  const open = tickets.filter(t => ['open','in_progress','waiting'].includes(t.status)).length
  const resolved = tickets.filter(t => t.status === 'resolved').length

  return (
    <HubPage
      title="Support"
      subtitle="Customer tickets + help requests"
      actions={
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white text-sm rounded-lg">
          + New Ticket
        </button>
      }
    >
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Open" value={open} accent={open ? 'text-amber-400' : 'text-white'} />
        <StatCard label="Resolved" value={resolved} accent="text-emerald-400" />
        <StatCard label="Total Tickets" value={tickets.length} />
        <StatCard label="Urgent" value={tickets.filter(t => t.priority === 'urgent').length} accent="text-red-400" />
      </div>

      <Section title="Tickets">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : tickets.length === 0 ? (
          <EmptyState title="No tickets yet" description="Track customer help requests and internal issues here." />
        ) : (
          <ul className="divide-y divide-navy-700/50">
            {tickets.map(t => (
              <li key={t.id} className="px-5 py-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm text-white font-medium">{t.ticket_number} — {t.subject}</div>
                    {t.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</div>}
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-navy-700/50 text-gray-300 capitalize">{t.status.replace('_',' ')}</span>
                    {t.priority !== 'normal' && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 capitalize">{t.priority}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {showNew && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-navy-700/50 flex justify-between items-center">
              <h3 className="text-white font-semibold">New Ticket</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-white text-sm">Close</button>
            </div>
            <form onSubmit={createTicket} className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400">Subject *</label>
                <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required className="w-full mt-1 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Description</label>
                <textarea rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full mt-1 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Priority</label>
                <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full mt-1 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white text-sm rounded-lg">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </HubPage>
  )
}
