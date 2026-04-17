import { useEffect, useMemo, useState } from 'react'
import {
  summarizeCampaignPerformance, listCampaigns, listAdSpend, rollupAdSpendByPlatform,
  listSeoKeywords, listMentions, listAbTests, listGoals, listEmailCampaigns,
  formatMoney, formatInt, formatPct, deriveKPIs,
} from '../../lib/marketingService'

function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const RANGES = [
  { key: '7',   label: '7 days' },
  { key: '30',  label: '30 days' },
  { key: '90',  label: '90 days' },
  { key: '365', label: '12 months' },
  { key: 'all', label: 'All time' },
]

export default function Analytics() {
  const [range, setRange] = useState('30')
  const [perf, setPerf] = useState({ total: {}, byChannel: [] })
  const [campaigns, setCampaigns] = useState([])
  const [adSpend, setAdSpend] = useState([])
  const [keywords, setKeywords] = useState([])
  const [mentions, setMentions] = useState([])
  const [tests, setTests] = useState([])
  const [goals, setGoals] = useState([])
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [range])

  async function load() {
    setLoading(true)
    try {
      const from = range === 'all' ? undefined : daysAgoISO(Number(range))
      const [p, cs, ads, kws, ms, ts, gs, es] = await Promise.all([
        summarizeCampaignPerformance({ from }).catch(() => ({ total: {}, byChannel: [] })),
        listCampaigns().catch(() => []),
        listAdSpend({ from }).catch(() => []),
        listSeoKeywords().catch(() => []),
        listMentions({ limit: 500 }).catch(() => []),
        listAbTests().catch(() => []),
        listGoals().catch(() => []),
        listEmailCampaigns().catch(() => []),
      ])
      setPerf(p); setCampaigns(cs); setAdSpend(ads); setKeywords(kws)
      setMentions(ms); setTests(ts); setGoals(gs); setEmails(es)
    } catch (err) { console.error('Analytics load failed:', err) }
    finally { setLoading(false) }
  }

  const total = perf.total || {}
  const byChannel = (perf.byChannel || []).slice().sort((a, b) => Number(b.spend_cents || 0) - Number(a.spend_cents || 0))
  const adByPlatform = useMemo(() => rollupAdSpendByPlatform(adSpend), [adSpend])

  const topCampaigns = useMemo(() => campaigns
    .map(c => ({ ...c, ...deriveKPIs(c) }))
    .sort((a, b) => Number(b.revenue_cents || 0) - Number(a.revenue_cents || 0))
    .slice(0, 8), [campaigns])

  const seoStats = useMemo(() => {
    const total = keywords.length
    const top10 = keywords.filter(k => Number(k.current_rank || 999) <= 10).length
    const top3 = keywords.filter(k => Number(k.current_rank || 999) <= 3).length
    const ranked = keywords.filter(k => k.current_rank != null)
    const avgRank = ranked.length > 0 ? ranked.reduce((a, k) => a + Number(k.current_rank || 0), 0) / ranked.length : null
    const totalVolume = keywords.reduce((a, k) => a + Number(k.search_volume || 0), 0)
    return { total, top10, top3, avgRank, totalVolume }
  }, [keywords])

  const mentionStats = useMemo(() => {
    const total = mentions.length
    const pos = mentions.filter(m => m.sentiment === 'positive').length
    const neg = mentions.filter(m => m.sentiment === 'negative').length
    const neu = total - pos - neg
    const needsReply = mentions.filter(m => m.needs_response && !m.responded_at).length
    const score = total > 0 ? ((pos - neg) / total) * 100 : 0
    return { total, pos, neg, neu, needsReply, score }
  }, [mentions])

  const testStats = useMemo(() => ({
    total: tests.length,
    running: tests.filter(t => t.status === 'running').length,
    completed: tests.filter(t => t.status === 'completed').length,
    withWinner: tests.filter(t => t.winner_variant_id).length,
  }), [tests])

  const goalStats = useMemo(() => ({
    total: goals.length,
    active: goals.filter(g => g.status === 'active').length,
    achieved: goals.filter(g => g.status === 'achieved').length,
    missed: goals.filter(g => g.status === 'missed').length,
  }), [goals])

  const emailStats = useMemo(() => ({
    total: emails.length,
    sent: emails.filter(e => e.status === 'sent').length,
    scheduled: emails.filter(e => e.status === 'scheduled').length,
    totalRecipients: emails.reduce((a, e) => a + Number(e.recipients_sent || 0), 0),
  }), [emails])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">Cross-channel performance, efficiency, and engagement signals.</p>
        </div>
        <div className="flex gap-1 bg-navy-900/50 border border-navy-700/50 rounded-lg p-1">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${range === r.key ? 'bg-sky-500/20 text-sky-300' : 'text-gray-400 hover:text-white'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Crunching numbers...</p>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold text-white mb-3">Paid Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi big label="Spend" value={formatMoney(total.spend_cents || 0)} tone="rose" />
              <Kpi big label="Revenue" value={formatMoney(total.revenue_cents || 0)} tone="emerald" />
              <Kpi big label="ROAS" value={total.roas != null ? `${Number(total.roas).toFixed(2)}x` : '-'} tone={Number(total.roas || 0) >= 3 ? 'emerald' : 'amber'} />
              <Kpi big label="Profit" value={formatMoney((total.revenue_cents || 0) - (total.spend_cents || 0))} tone={(total.revenue_cents || 0) >= (total.spend_cents || 0) ? 'emerald' : 'rose'} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
              <Kpi label="Impressions" value={formatInt(total.impressions || 0)} />
              <Kpi label="Clicks" value={formatInt(total.clicks || 0)} />
              <Kpi label="CTR" value={total.ctr != null ? formatPct(total.ctr) : '-'} />
              <Kpi label="Conversions" value={formatInt(total.conversions || 0)} />
              <Kpi label="Conv Rate" value={total.conversion_rate != null ? formatPct(total.conversion_rate) : '-'} />
              <Kpi label="CPA" value={total.cpa != null ? formatMoney(Math.round(total.cpa || 0)) : '-'} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white mb-3">By Channel</h2>
            <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-navy-900/60 text-[11px] uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="text-left px-3 py-2">Channel</th>
                    <th className="text-right px-3 py-2">Spend</th>
                    <th className="text-right px-3 py-2">Revenue</th>
                    <th className="text-right px-3 py-2">Profit</th>
                    <th className="text-right px-3 py-2">Clicks</th>
                    <th className="text-right px-3 py-2">Conv.</th>
                    <th className="text-right px-3 py-2">CPA</th>
                    <th className="text-right px-3 py-2">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {byChannel.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-500 text-sm">No spend data in this range.</td></tr>
                  ) : byChannel.map(c => {
                    const profit = (c.revenue_cents || 0) - (c.spend_cents || 0)
                    return (
                      <tr key={c.channel} className="border-t border-navy-700/40">
                        <td className="px-3 py-2 text-white capitalize">{c.channel?.replaceAll('_', ' ') || '-'}</td>
                        <td className="px-3 py-2 text-right text-rose-300">{formatMoney(c.spend_cents || 0)}</td>
                        <td className="px-3 py-2 text-right text-emerald-300">{formatMoney(c.revenue_cents || 0)}</td>
                        <td className={`px-3 py-2 text-right ${profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatMoney(profit)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{formatInt(c.clicks || 0)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{formatInt(c.conversions || 0)}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{c.cpa != null ? formatMoney(Math.round(c.cpa)) : '-'}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {c.roas != null ? (
                            <span className={Number(c.roas) >= 3 ? 'text-emerald-300' : Number(c.roas) >= 1 ? 'text-amber-300' : 'text-rose-300'}>
                              {Number(c.roas).toFixed(2)}x
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {adByPlatform.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white mb-3">Ad Spend by Platform</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {adByPlatform.map(p => (
                  <div key={p.platform} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{p.platform?.replaceAll('_', ' ')}</p>
                    <p className="text-xl font-bold text-white mt-1">{formatMoney(p.spend_cents || 0)}</p>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
                      <span>{formatInt(p.conversions || 0)} conv</span>
                      <span className={Number(p.roas || 0) >= 3 ? 'text-emerald-300' : 'text-amber-300'}>{p.roas != null ? `${Number(p.roas).toFixed(2)}x` : '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-white mb-3">Top Campaigns by Revenue</h2>
            <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 overflow-hidden">
              {topCampaigns.length === 0 ? (
                <p className="p-4 text-gray-500 text-sm">No campaigns logged yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-navy-900/60 text-[11px] uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="text-left px-3 py-2">Campaign</th>
                      <th className="text-left px-3 py-2">Channel</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-3 py-2">Spend</th>
                      <th className="text-right px-3 py-2">Revenue</th>
                      <th className="text-right px-3 py-2">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCampaigns.map(c => (
                      <tr key={c.id} className="border-t border-navy-700/40">
                        <td className="px-3 py-2 text-white">{c.name}</td>
                        <td className="px-3 py-2 text-gray-300 capitalize">{c.channel?.replaceAll('_', ' ') || '-'}</td>
                        <td className="px-3 py-2 text-gray-400 capitalize">{c.status || '-'}</td>
                        <td className="px-3 py-2 text-right text-rose-300">{formatMoney(c.spend_cents || 0)}</td>
                        <td className="px-3 py-2 text-right text-emerald-300">{formatMoney(c.revenue_cents || 0)}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {c.roas != null ? (
                            <span className={Number(c.roas) >= 3 ? 'text-emerald-300' : Number(c.roas) >= 1 ? 'text-amber-300' : 'text-rose-300'}>
                              {Number(c.roas).toFixed(2)}x
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <MiniCard title="SEO">
              <StatLine label="Keywords" value={formatInt(seoStats.total)} />
              <StatLine label="Top-3" value={formatInt(seoStats.top3)} tone="emerald" />
              <StatLine label="Top-10" value={formatInt(seoStats.top10)} tone="emerald" />
              <StatLine label="Avg Rank" value={seoStats.avgRank != null ? seoStats.avgRank.toFixed(1) : '-'} />
              <StatLine label="Volume" value={formatInt(seoStats.totalVolume)} />
            </MiniCard>
            <MiniCard title="Social">
              <StatLine label="Mentions" value={formatInt(mentionStats.total)} />
              <StatLine label="Positive" value={formatInt(mentionStats.pos)} tone="emerald" />
              <StatLine label="Negative" value={formatInt(mentionStats.neg)} tone="rose" />
              <StatLine label="Needs Reply" value={formatInt(mentionStats.needsReply)} tone={mentionStats.needsReply ? 'amber' : 'slate'} />
              <StatLine label="Sentiment" value={`${mentionStats.score.toFixed(0)}`} tone={mentionStats.score >= 0 ? 'emerald' : 'rose'} />
            </MiniCard>
            <MiniCard title="A/B Tests">
              <StatLine label="Total" value={formatInt(testStats.total)} />
              <StatLine label="Running" value={formatInt(testStats.running)} tone="sky" />
              <StatLine label="Completed" value={formatInt(testStats.completed)} tone="emerald" />
              <StatLine label="With Winner" value={formatInt(testStats.withWinner)} tone="emerald" />
            </MiniCard>
            <MiniCard title="Goals">
              <StatLine label="Total" value={formatInt(goalStats.total)} />
              <StatLine label="Active" value={formatInt(goalStats.active)} tone="sky" />
              <StatLine label="Achieved" value={formatInt(goalStats.achieved)} tone="emerald" />
              <StatLine label="Missed" value={formatInt(goalStats.missed)} tone="rose" />
            </MiniCard>
            <MiniCard title="Email">
              <StatLine label="Campaigns" value={formatInt(emailStats.total)} />
              <StatLine label="Sent" value={formatInt(emailStats.sent)} tone="emerald" />
              <StatLine label="Scheduled" value={formatInt(emailStats.scheduled)} tone="amber" />
              <StatLine label="Recipients" value={formatInt(emailStats.totalRecipients)} />
            </MiniCard>
          </section>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, tone = 'slate', big = false }) {
  const toneMap = { slate: 'text-white', sky: 'text-sky-300', emerald: 'text-emerald-300', rose: 'text-rose-300', amber: 'text-amber-300' }
  return (
    <div className={`rounded-${big ? 'xl' : 'lg'} bg-navy-800/50 border border-navy-700/50 p-3`}>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`${big ? 'text-2xl' : 'text-base'} font-bold mt-1 ${toneMap[tone] || toneMap.slate}`}>{value}</p>
    </div>
  )
}

function MiniCard({ title, children }) {
  return (
    <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function StatLine({ label, value, tone = 'slate' }) {
  const toneMap = { slate: 'text-white', sky: 'text-sky-300', emerald: 'text-emerald-300', rose: 'text-rose-300', amber: 'text-amber-300' }
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold ${toneMap[tone] || toneMap.slate}`}>{value}</span>
    </div>
  )
}
