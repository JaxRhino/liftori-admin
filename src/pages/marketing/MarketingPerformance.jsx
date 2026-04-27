// MarketingPerformance â€” at-a-glance "is this working?" dashboard.
// Aggregates marketing_posts (publishing volume), waitlist_signups (intent capture),
// email_sends (nurture activity), and shows per-product funnel.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const PRODUCTS = [
  { key: 'bolo_go', label: 'BOLO Go', tone: 'emerald' },
  { key: 'crm',     label: 'CRM',     tone: 'blue' },
  { key: 'general', label: 'General', tone: 'slate' },
]

const TONE_BG = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  blue:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  slate:   'bg-slate-700/30 text-slate-300 border-slate-500/30',
  rose:    'bg-rose-500/10 text-rose-400 border-rose-500/30',
  amber:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  sky:     'bg-sky-500/10 text-sky-400 border-sky-500/30',
}

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function daysAgo(n) { const d = startOfDay(); d.setDate(d.getDate() - n); return d }

export default function MarketingPerformance() {
  const [posts, setPosts] = useState([])
  const [signups, setSignups] = useState([])
  const [sends, setSends] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [{ data: p }, { data: s }, { data: e }] = await Promise.all([
        supabase.from('marketing_posts')
          .select('id, content, status, platform_post_ids, content_type, published_at, scheduled_for, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('waitlist_signups')
          .select('id, full_name, email, product_interest, utm_source, utm_campaign, created_at')
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase.from('email_sends')
          .select('id, status, sent_at')
          .order('sent_at', { ascending: false })
          .limit(2000),
      ])
      setPosts(p || [])
      setSignups(s || [])
      setSends(e || [])
    } catch (err) {
      console.error('performance load:', err)
    } finally {
      setLoading(false)
    }
  }

  // Top stats
  const stats = useMemo(() => {
    const today = startOfDay()
    const week = daysAgo(7)
    return {
      published: posts.filter(p => p.status === 'published').length,
      scheduled: posts.filter(p => p.status === 'scheduled').length,
      pending:   posts.filter(p => p.status === 'pending_approval').length,
      failed:    posts.filter(p => p.status === 'failed').length,
      totalSignups:   signups.length,
      signupsToday:   signups.filter(s => new Date(s.created_at) >= today).length,
      signupsWeek:    signups.filter(s => new Date(s.created_at) >= week).length,
      emailsSent:     sends.filter(e => e.status === 'sent').length,
      emailsFailed:   sends.filter(e => e.status === 'failed').length,
    }
  }, [posts, signups, sends])

  // 7-day trend bars (signups + posts published per day)
  const trend = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const start = daysAgo(i)
      const end = daysAgo(i - 1)
      const dayLabel = start.toLocaleDateString('en-US', { weekday: 'short' })
      const dateLabel = start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
      const sCount = signups.filter(s => {
        const d = new Date(s.created_at); return d >= start && d < end
      }).length
      const pCount = posts.filter(p => p.published_at && new Date(p.published_at) >= start && new Date(p.published_at) < end).length
      days.push({ dayLabel, dateLabel, signups: sCount, posts: pCount, isToday: i === 0 })
    }
    return days
  }, [signups, posts])

  const maxBar = Math.max(...trend.flatMap(d => [d.signups, d.posts]), 1)

  // Per-product funnel
  const productFunnels = useMemo(() => {
    return PRODUCTS.map(prod => ({
      ...prod,
      signups: signups.filter(s => (s.product_interest || 'general') === prod.key).length,
      signupsThisWeek: signups.filter(s => (s.product_interest || 'general') === prod.key && new Date(s.created_at) >= daysAgo(7)).length,
    }))
  }, [signups])
  // Signups grouped by utm_source for attribution
  const signupsBySource = useMemo(() => {
    const map = {}
    for (const s of signups) {
      const src = s.utm_source || 'direct'
      map[src] = (map[src] || 0) + 1
    }
    const total = signups.length || 1
    return Object.entries(map)
      .map(([source, count]) => ({ source, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
  }, [signups])

  // Top campaigns (utm_campaign) - shows which posts drove signups
  const topCampaigns = useMemo(() => {
    const map = {}
    for (const s of signups) {
      if (!s.utm_campaign) continue
      map[s.utm_campaign] = (map[s.utm_campaign] || 0) + 1
    }
    return Object.entries(map)
      .map(([campaign, count]) => ({ campaign, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [signups])

  // Recent published posts
  const recentPublished = useMemo(() => {
    return posts
      .filter(p => p.status === 'published')
      .slice(0, 8)
  }, [posts])

  function fbPostUrl(platformIds) {
    const fbId = platformIds?.facebook
    if (!fbId) return null
    const parts = String(fbId).split('_')
    if (parts.length !== 2) return `https://www.facebook.com/${fbId}`
    return `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Marketing Performance</h1>
        <p className="text-slate-400 text-sm mt-1">At-a-glance health of the marketing engine. Posts published, signups captured, drip emails sent â€” across the last 7 days.</p>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loadingâ€¦</div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <BigStat label="Posts published" value={stats.published} tone="emerald" />
            <BigStat label="Total signups" value={stats.totalSignups} tone="sky" />
            <BigStat label="Signups today" value={stats.signupsToday} tone={stats.signupsToday > 0 ? 'amber' : 'slate'} />
            <BigStat label="Drip emails sent" value={stats.emailsSent} tone="blue" />
          </div>

          {/* Pipeline state */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SmallStat label="Scheduled" value={stats.scheduled} />
            <SmallStat label="Pending approval" value={stats.pending} />
            <SmallStat label="Failed publishes" value={stats.failed} tone={stats.failed > 0 ? 'rose' : 'slate'} />
            <SmallStat label="Failed emails" value={stats.emailsFailed} tone={stats.emailsFailed > 0 ? 'rose' : 'slate'} />
          </div>

          {/* 7-day trend */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Last 7 days</h2>
              <div className="flex gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>Signups</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>Posts</span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {trend.map((d, i) => (
                <div key={i} className={`flex flex-col items-center ${d.isToday ? 'text-white' : 'text-slate-400'}`}>
                  <div className="flex items-end gap-1 h-32 mb-2">
                    <div
                      className="w-3 bg-sky-500 rounded-t transition-all"
                      style={{ height: `${(d.signups / maxBar) * 100}%`, minHeight: d.signups > 0 ? '4px' : '2px' }}
                      title={`${d.signups} signups`}
                    />
                    <div
                      className="w-3 bg-emerald-500 rounded-t transition-all"
                      style={{ height: `${(d.posts / maxBar) * 100}%`, minHeight: d.posts > 0 ? '4px' : '2px' }}
                      title={`${d.posts} posts`}
                    />
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wide">{d.dayLabel}</div>
                  <div className="text-[10px] text-slate-500">{d.dateLabel}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-product funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
            {productFunnels.map(p => (
              <div key={p.key} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${TONE_BG[p.tone]}`}>{p.label}</span>
                  <Link to="/admin/marketing/waitlist" className="text-xs text-slate-500 hover:text-sky-400">View â†’</Link>
                </div>
                <div className="text-3xl font-bold text-white">{p.signups.toLocaleString()}</div>
                <div className="text-xs text-slate-400 mt-1">total signups</div>
                {p.signupsThisWeek > 0 && (
                  <div className="text-xs text-emerald-400 mt-2">+{p.signupsThisWeek} this week</div>
                )}
              </div>
            ))}
          </div>

          {/* Signups by source */}
          {signupsBySource.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 mb-6">
              <h2 className="text-sm font-semibold text-white mb-3">Signups by source</h2>
              <div className="space-y-2">
                {signupsBySource.map(s => (
                  <div key={s.source} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-300 w-24 truncate capitalize">{s.source}</span>
                    <div className="flex-1 h-2 bg-slate-900/60 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-sm text-white font-medium w-10 text-right">{s.count}</span>
                    <span className="text-xs text-slate-500 w-10 text-right">{s.pct}%</span>
                  </div>
                ))}
              </div>
              {topCampaigns.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-700/40">
                  <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-3">Top campaigns</h3>
                  <div className="space-y-1.5">
                    {topCampaigns.map(c => (
                      <div key={c.campaign} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-300 truncate">{c.campaign}</span>
                        <span className="text-emerald-400 font-medium">{c.count}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3">Campaigns are post IDs. Cross-reference with the Composer queue to see which post drove signups.</p>
                </div>
              )}
            </div>
          )}

          {/* Recent published posts */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden mb-6">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Recent published posts</h2>
              <Link to="/admin/marketing/social-composer" className="text-xs text-sky-400 hover:underline">Open Composer â†’</Link>
            </div>
            {recentPublished.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">No published posts yet.</div>
            ) : (
              <div className="divide-y divide-slate-700/40">
                {recentPublished.map(p => {
                  const url = fbPostUrl(p.platform_post_ids)
                  return (
                    <div key={p.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[10px] uppercase tracking-wide bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{p.content_type}</span>
                          <span className="text-xs text-slate-500">{p.published_at ? new Date(p.published_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                        </div>
                        <p className="text-sm text-slate-200 line-clamp-2">{p.content}</p>
                      </div>
                      {url && (
                        <a href={url} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0">
                          View on FB â†—
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Health hint */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-xs text-slate-400">
            <div className="font-semibold text-slate-300 mb-1">What this dashboard tells you</div>
            <ul className="list-disc pl-4 space-y-1">
              <li><span className="text-emerald-400">Posts up + signups up</span> = the engine is working. Keep posting.</li>
              <li><span className="text-amber-400">Posts up but signups flat</span> = posts aren't converting. Try different content types or update product page copy.</li>
              <li><span className="text-rose-400">Posts down</span> = scheduler dry. Open Composer or Plan Week to refill the queue.</li>
              <li><span className="text-rose-400">Failed publishes/emails &gt; 0</span> = check the queue or sequences page for errors.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function BigStat({ label, value, tone = 'slate' }) {
  const toneMap = { slate: 'text-white', sky: 'text-sky-400', emerald: 'text-emerald-400', amber: 'text-amber-400', blue: 'text-blue-400', rose: 'text-rose-400' }
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${toneMap[tone] || toneMap.slate}`}>{value.toLocaleString()}</div>
    </div>
  )
}

function SmallStat({ label, value, tone = 'slate' }) {
  const toneMap = { slate: 'text-white', sky: 'text-sky-400', emerald: 'text-emerald-400', rose: 'text-rose-400' }
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
      <div className="text-[11px] text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${toneMap[tone] || toneMap.slate}`}>{value.toLocaleString()}</div>
    </div>
  )
}
