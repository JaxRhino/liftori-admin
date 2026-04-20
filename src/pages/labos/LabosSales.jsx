import { useEffect, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useLabosClient } from './_shared'

export default function LabosSales() {
  const { client } = useLabosClient()
  const [leads, setLeads] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client) return
    async function load() {
      setLoading(true)
      const [{ data: l }, { data: d }] = await Promise.all([
        client.from('leads').select('*').order('created_at', { ascending: false }).limit(50),
        client.from('deals').select('*').order('created_at', { ascending: false }).limit(50),
      ])
      setLeads(l || [])
      setDeals(d || [])
      setLoading(false)
    }
    load()
  }, [client])

  const pipelineValue = deals.filter(d => !['won','lost'].includes(d.stage)).reduce((s, d) => s + Number(d.value || 0), 0)
  const wonValue = deals.filter(d => d.stage === 'won').reduce((s, d) => s + Number(d.value || 0), 0)

  return (
    <HubPage title="Sales" subtitle="Leads, deals, and pipeline for your business">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Leads" value={leads.length} />
        <StatCard label="Active Deals" value={deals.filter(d => !['won','lost'].includes(d.stage)).length} accent="text-brand-blue" />
        <StatCard label="Pipeline Value" value={`$${pipelineValue.toLocaleString()}`} accent="text-brand-cyan" />
        <StatCard label="Closed-Won" value={`$${wonValue.toLocaleString()}`} accent="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Recent Leads" right={<span className="text-xs text-gray-500">{leads.length} total</span>}>
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading...</div>
          ) : leads.length === 0 ? (
            <EmptyState title="No leads yet" description="Leads captured from your storefront, contact form, or imports will appear here." />
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {leads.slice(0, 10).map(l => (
                <li key={l.id} className="px-5 py-3">
                  <div className="flex justify-between">
                    <div className="text-sm text-white font-medium">{l.name}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-navy-700/50 text-gray-300">{l.status}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{l.email || l.phone || '—'}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Deals Pipeline">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading...</div>
          ) : deals.length === 0 ? (
            <EmptyState title="No deals yet" description="Promote a lead to a deal to start tracking it through your pipeline." />
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {deals.slice(0, 10).map(d => (
                <li key={d.id} className="px-5 py-3">
                  <div className="flex justify-between">
                    <div className="text-sm text-white font-medium">{d.customer_name}</div>
                    <span className="text-xs text-brand-cyan">${Number(d.value || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 capitalize">{d.stage}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </HubPage>
  )
}
