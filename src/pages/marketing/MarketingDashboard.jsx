import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getHubSummary, summarizeCampaignPerformance,
  formatMoney, formatInt, formatPct,
  listEmailCampaigns, listGoals, listAbTests, listMentions, listSegments,
} from '../../lib/marketingService'

// Single hub overview â€” aggregates every corner of the Marketing Hub
// and routes operators straight to the right sub-tool.
export default function MarketingDashboard() {
  const [summary, setSummary] = useState(null)
  const [perf, setPerf] = useState(null)
  const [emailCount, setEmailCount] = useState(0)
  const [goalCount, setGoalCount] = useState(0)
  const [activeAbTests, setActiveAbTests] = useState(0)
  const [pendingMentions, setPendingMentions] = useState(0)
  const [segmentCount, setSegmentCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [s, p, emails, goals, tests, mentions, segs] = await Promise.all([
        getHubSummary().catch(() => null),
        summarizeCampaignPerformance().catch(() => null),
        listEmailCampaigns().catch(() => []),
        listGoals({ status: 'active' }).catch(() => []),
        listAbTests({ status: 'running' }).catch(() => []),
        listMentions({ needs_response: true, limit: 500 }).catch(() => []),
        listSegments().catch(() => []),
      ])
      setSummary(s)
      setPerf(p)
      setEmailCount(emails.length)
      setGoalCount(goals.length)
      setActiveAbTests(tests.length)
      setPendingMentions(mentions.length)
      setSegmentCount(segs.length)
    } catch (err) {
      console.error('Marketing dashboard load failed:', err)
    } finally { setLoading(false) }
  }

  const total = perf?.total || {}
  const byChannel = (perf?.byChannel || []).sort((a, b) => Number(b.revenue_cents || 0) - Number(a.revenue_cents || 0)).slice(0, 6)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Marketing Hub</h1>
        <p className="text-sm text-gray-400 mt-1">Unified command center for campaigns, content, SEO, email, segmentation, and analytics.</p>
      </div>

      {/* Top metrics â€” spend & revenue */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigKpi label="Total Spend" value={formatMoney(total.spend_cents || 0)} tone="rose" />
        <BigKpi label="Total Revenue" value={formatMoney(total.revenue_cents || 0)} tone="emerald" />
        <BigKpi label="ROAS" value={total.roas != null ? `${(total.roas).toFixed(2)}x` : 'â€”'} tone={Number(total.roas || 0) >= 3 ? 'emerald' : 'amber'} />
        <BigKpi label="Conversions" value={formatInt(total.conversions || 0)} tone="sky" />
      </div>

      {/* Sub-metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="Impressions" value={formatInt(total.impressions || 0)} />
        <Kpi label="Clicks" value={formatInt(total.clicks || 0)} />
        <Kpi label="CTR" value={total.ctr != null ? formatPct(total.ctr) : 'â€”'} />
        <Kpi label="CPC" value={total.cpc != null ? formatMoney(Math.round(total.cpc || 0)) : 'â€”'} />
        <Kpi label="Conversion Rate" value={total.conversion_rate != null ? formatPct(total.conversion_rate) : 'â€”'} />
        <Kpi label="CPA" value={total.cpa != null ? formatMoney(Math.round(total.cpa || 0)) : 'â€”'} />
      </div>

      {/* Tool grid */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Tools</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ToolTile to="/marketing/tracker"          title="Campaign Tracker"    hint={`${formatInt(summary?.active_campaigns || 0)} active campaigns`} emoji="â€¢" />
          <ToolTile to="/marketing/ads"              title="Ad Manager"          hint="Spend & ROAS by platform" emoji="â€¢" />
          <ToolTile to="/marketing/utm-builder"      title="UTM Builder"         hint={`${formatInt(summary?.utm_links || 0)} links`} emoji="â€¢" />
          <ToolTile to="/marketing/content"          title="Content Creator"     hint="Draft & publish" emoji="â€¢" />
          <ToolTile to="/admin/marketing/social-composer"  title="Social Composer"     hint="Compose, approve, publish to FB" emoji="•" accent="emerald" />
          <ToolTile to="/marketing/scheduler"        title="Content Scheduler"   hint="Calendar view" emoji="â€¢" />
          <ToolTile to="/marketing/seo"              title="SEO Manager"         hint={`${formatInt(summary?.seo_keywords || 0)} keywords`} emoji="â€¢" />
          <ToolTile to="/marketing/email"            title="Email Campaigns"     hint={`${formatInt(emailCount)} campaigns`} emoji="â€¢" />
          <ToolTile to="/marketing/social-listening" title="Social Listening"    hint={pendingMentions ? `${formatInt(pendingMentions)} need reply` : 'All caught up'} emoji="â€¢" accent={pendingMentions > 0 ? 'amber' : 'slate'} />
          <ToolTile to="/marketing/on-pace"          title="On-Pace Tracking"    hint={`${formatInt(goalCount)} active goals`} emoji="â€¢" />
          <ToolTile to="/marketing/ab-testing"       title="A/B Testing"         hint={`${formatInt(activeAbTests)} running`} emoji="â€¢" />
          <ToolTile to="/marketing/audience-segments" title="Audience Segments"  hint={`${formatInt(segmentCount)} segments`} emoji="â€¢" />
          <ToolTile to="/marketing/customer-map"     title="Customer Map"        hint="Geographic distribution" emoji="â€¢" />
          <ToolTile to="/marketing/analytics"        title="Analytics"           hint="Deep performance view" emoji="â€¢" />
        </div>
      </div>

      {/* Channel performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Channel Performance</h3>
            <Link to="/marketing/tracker" className="text-xs text-sky-400 hover:underline">View all â†’</Link>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm">Loadingâ€¦</p>
          ) : byChannel.length === 0 ? (
            <p className="text-gray-500 text-sm">No campaign data yet. Start by logging a campaign in the tracker.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="text-left py-2">Channel</th>
                  <th className="text-right py-2">Spend</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">Conv.</th>
                  <th className="text-right py-2">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {byChannel.map(c => (
                  <tr key={c.channel} className="border-t border-navy-700/40">
                    <td className="py-2 text-white capitalize">{c.channel?.replaceAll('_', ' ') || 'â€”'}</td>
                    <td className="py-2 text-right text-rose-300">{formatMoney(c.spend_cents || 0)}</td>
                    <td className="py-2 text-right text-emerald-300">{formatMoney(c.revenue_cents || 0)}</td>
                    <td className="py-2 text-right text-gray-300">{formatInt(c.conversions || 0)}</td>
                    <td className="py-2 text-right font-semibold">
                      {c.roas != null ? (
                        <span className={Number(c.roas) >= 3 ? 'text-emerald-300' : Number(c.roas) >= 1 ? 'text-amber-300' : 'text-rose-300'}>
                          {Number(c.roas).toFixed(2)}x
                        </span>
                      ) : 'â€”'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Marketing Health</h3>
          <HealthRow label="Active Campaigns" value={formatInt(summary?.active_campaigns || 0)} tone="emerald" />
          <HealthRow label="Open A/B Tests" value={formatInt(activeAbTests)} tone="sky" />
          <HealthRow label="Active Goals" value={formatInt(goalCount)} tone="violet" />
          <HealthRow label="Segments" value={formatInt(segmentCount)} tone="amber" />
          <HealthRow label="Email Campaigns" value={formatInt(emailCount)} tone="sky" />
          <HealthRow label="Mentions to Reply" value={formatInt(pendingMentions)} tone={pendingMentions ? 'rose' : 'emerald'} />
        </div>
      </div>
    </div>
  )
}

function BigKpi({ label, value, tone = 'slate' }) {
  const toneMap = { slate: 'text-white', sky: 'text-sky-300', emerald: 'text-emerald-300', rose: 'text-rose-300', amber: 'text-amber-300' }
  return (
    <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneMap[tone] || toneMap.slate}`}>{value}</p>
    </div>
  )
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-lg bg-navy-900/40 border border-navy-700/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-base font-semibold text-white mt-1">{value}</p>
    </div>
  )
}

function ToolTile({ to, title, hint, accent = 'slate' }) {
  const accentMap = { slate: 'border-navy-700/60', amber: 'border-amber-500/40', emerald: 'border-emerald-500/40', rose: 'border-rose-500/40' }
  return (
    <Link to={to} className={`block rounded-xl bg-navy-800/50 border ${accentMap[accent] || accentMap.slate} p-3 hover:border-sky-500/40 hover:bg-navy-800/70 transition-colors`}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-gray-400 mt-1 truncate">{hint}</p>
    </Link>
  )
}

function HealthRow({ label, value, tone = 'slate' }) {
  const toneMap = {
    slate: 'text-white', sky: 'text-sky-300', emerald: 'text-emerald-300',
    rose: 'text-rose-300', amber: 'text-amber-300', violet: 'text-violet-300',
  }
  return (
    <div className="flex items-center justify-between text-sm border-b border-navy-700/40 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold ${toneMap[tone] || toneMap.slate}`}>{value}</span>
    </div>
  )
}
