import { useEffect, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useLabosClient } from './_shared'

export default function LabosMarketing() {
  const { client } = useLabosClient()
  const [campaigns, setCampaigns] = useState([])
  const [subs, setSubs] = useState({ total: 0, last30: 0 })
  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client) return
    async function load() {
      setLoading(true)
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      const [{ data: c }, { count: subTotal }, { count: subRecent }, { data: kpi }] = await Promise.all([
        client.from('marketing_campaigns').select('*').order('created_at', { ascending: false }).limit(20),
        client.from('email_subscribers').select('*', { count: 'exact', head: true }).is('unsubscribed_at', null),
        client.from('email_subscribers').select('*', { count: 'exact', head: true }).gte('subscribed_at', since).is('unsubscribed_at', null),
        client.from('marketing_kpis_daily').select('*').order('date', { ascending: false }).limit(30),
      ])
      setCampaigns(c || [])
      setSubs({ total: subTotal || 0, last30: subRecent || 0 })
      setKpis(kpi || [])
      setLoading(false)
    }
    load()
  }, [client])

  const totalSpend = kpis.reduce((s, k) => s + Number(k.spend || 0), 0)
  const totalRevenue = kpis.reduce((s, k) => s + Number(k.revenue || 0), 0)
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length

  return (
    <HubPage title="Marketing" subtitle="Campaigns, subscribers, and channel performance">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Subscribers" value={subs.total} hint={`+${subs.last30} last 30d`} />
        <StatCard label="Active Campaigns" value={activeCampaigns} accent="text-brand-blue" />
        <StatCard label="Spend (30d)" value={`$${totalSpend.toLocaleString()}`} accent="text-amber-400" />
        <StatCard label="Revenue Attributed" value={`$${totalRevenue.toLocaleString()}`} accent="text-emerald-400" />
      </div>

      <Section title="Campaigns">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" description="Launch your first campaign — email blast, social, paid ads, or a referral push." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-navy-700/50">
                <th className="text-left px-5 py-2 font-medium">Name</th>
                <th className="text-left px-5 py-2 font-medium">Channel</th>
                <th className="text-left px-5 py-2 font-medium">Status</th>
                <th className="text-right px-5 py-2 font-medium">Spend</th>
                <th className="text-right px-5 py-2 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td className="px-5 py-2 text-white">{c.name}</td>
                  <td className="px-5 py-2 text-gray-400 capitalize">{c.channel?.replace('_',' ')}</td>
                  <td className="px-5 py-2 text-gray-400 capitalize">{c.status}</td>
                  <td className="px-5 py-2 text-right text-gray-300">${Number(c.spend || 0).toLocaleString()}</td>
                  <td className="px-5 py-2 text-right text-brand-cyan">${Number(c.revenue_attributed || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </HubPage>
  )
}
