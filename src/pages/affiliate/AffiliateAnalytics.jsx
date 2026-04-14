import { useEffect, useMemo, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { CONTENT_PILLARS } from '../../lib/creatorIdeaFrameworks'
import { PLATFORMS } from '../../lib/creatorTemplates'

function startOfWeek(d = new Date()) {
  const x = new Date(d)
  const day = x.getDay() // 0 Sunday
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - day)
  return x
}
function startOfMonth(d = new Date()) {
  const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x
}
function daysAgo(n) {
  const x = new Date(); x.setDate(x.getDate() - n); x.setHours(0, 0, 0, 0); return x
}

export default function AffiliateAnalytics() {
  const { user } = useAuth()
  const [drafts, setDrafts] = useState([])
  const [ideas, setIdeas] = useState([])
  const [enrollment, setEnrollment] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [{ data: d }, { data: i }, { data: e }] = await Promise.all([
        supabase.from('creator_drafts').select('*').eq('user_id', user.id).limit(1000),
        supabase.from('creator_ideas').select('*').eq('user_id', user.id).limit(1000),
        supabase.from('affiliate_enrollments').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      setDrafts(d || [])
      setIdeas(i || [])
      setEnrollment(e || null)
    } catch (err) { console.error(err); toast.error('Failed to load analytics') }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const metrics = useMemo(() => {
    const weekStart = startOfWeek()
    const monthStart = startOfMonth()
    const thirtyDaysAgo = daysAgo(30)

    const draftCountsByStatus = drafts.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1
      return acc
    }, {})

    const scheduledThisWeek = drafts.filter((d) =>
      d.status === 'scheduled' && d.scheduled_at && new Date(d.scheduled_at) >= weekStart
    ).length

    const publishedThisMonth = drafts.filter((d) =>
      d.status === 'published' && d.published_at && new Date(d.published_at) >= monthStart
    ).length

    const publishedLast30 = drafts.filter((d) =>
      d.status === 'published' && d.published_at && new Date(d.published_at) >= thirtyDaysAgo
    ).length

    const draftsByPlatform = drafts.reduce((acc, d) => {
      if (!d.platform) return acc
      acc[d.platform] = (acc[d.platform] || 0) + 1
      return acc
    }, {})

    const ideasByPillar = ideas.reduce((acc, i) => {
      if (!i.pillar) return acc
      acc[i.pillar] = (acc[i.pillar] || 0) + 1
      return acc
    }, {})

    const ideasByStatus = ideas.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1
      return acc
    }, {})

    // Daily published posts — last 30 days for spark chart
    const daily = []
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i)
      const next = daysAgo(i - 1)
      const count = drafts.filter((x) =>
        x.status === 'published' && x.published_at &&
        new Date(x.published_at) >= d && new Date(x.published_at) < next
      ).length
      daily.push({ day: d.toISOString().slice(5, 10), count })
    }
    const maxDaily = Math.max(1, ...daily.map((x) => x.count))

    // Pipeline: ideas → drafts → scheduled → published
    const pipeline = {
      ideas: ideas.length,
      drafts: (draftCountsByStatus.draft || 0) + (draftCountsByStatus.ready || 0),
      scheduled: draftCountsByStatus.scheduled || 0,
      published: draftCountsByStatus.published || 0,
    }

    return {
      draftCountsByStatus, scheduledThisWeek, publishedThisMonth, publishedLast30,
      draftsByPlatform, ideasByPillar, ideasByStatus, daily, maxDaily, pipeline,
    }
  }, [drafts, ideas])

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><span>📊</span><span>Analytics</span></h1>
        <p className="text-sm text-gray-400">Your creator pipeline at a glance. Referral revenue lands here once clicks are tracked.</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : (
        <>
          {/* Top-line stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <HeadlineStat label="Ideas banked" value={ideas.length} accent="bg-sky-500/10 text-sky-300" />
            <HeadlineStat label="Drafts in progress" value={metrics.pipeline.drafts} accent="bg-emerald-500/10 text-emerald-300" />
            <HeadlineStat label="Scheduled" value={metrics.pipeline.scheduled} accent="bg-amber-500/10 text-amber-300" />
            <HeadlineStat label="Published (30d)" value={metrics.publishedLast30} accent="bg-violet-500/10 text-violet-300" />
          </div>

          {/* Revenue card (pre-launch) */}
          <div className="bg-gradient-to-br from-pink-500/10 to-violet-500/10 border border-pink-500/30 rounded-xl p-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="text-[10px] uppercase font-bold text-pink-300">Affiliate earnings</div>
                <div className="text-3xl font-bold text-white mt-1">$0.00</div>
                <div className="text-xs text-gray-400 mt-1">Tier: <span className="text-white font-semibold">{enrollment?.tier || 'Starter'}</span> · Commission rate: <span className="text-white">{commissionLabel(enrollment?.tier)}</span></div>
              </div>
              <div className="text-xs text-gray-400 max-w-sm">
                <div className="font-semibold text-white mb-1">Pre-launch mode</div>
                Click tracking + commission calc go live with the Liftori AI Payment Center (coming soon). Your referral link still works — earnings will backfill once tracking activates.
              </div>
            </div>
          </div>

          {/* Pipeline funnel */}
          <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-4">
            <div className="text-xs uppercase font-bold text-gray-500 mb-3">Content pipeline</div>
            <div className="space-y-2">
              <PipelineBar label="💡 Ideas"      count={metrics.pipeline.ideas}     total={metrics.pipeline.ideas || 1} color="bg-sky-500" />
              <PipelineBar label="✍️ Drafts"     count={metrics.pipeline.drafts}    total={metrics.pipeline.ideas || 1} color="bg-emerald-500" />
              <PipelineBar label="🗓 Scheduled"  count={metrics.pipeline.scheduled} total={metrics.pipeline.ideas || 1} color="bg-amber-500" />
              <PipelineBar label="🚀 Published"  count={metrics.pipeline.published} total={metrics.pipeline.ideas || 1} color="bg-violet-500" />
            </div>
            <div className="text-[10px] text-gray-500 mt-3">
              Each bar is scaled against ideas banked — conversion rate at a glance. Published / Ideas = {metrics.pipeline.ideas > 0 ? Math.round((metrics.pipeline.published / metrics.pipeline.ideas) * 100) : 0}%
            </div>
          </div>

          {/* Publishing cadence */}
          <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs uppercase font-bold text-gray-500">Publishing cadence</div>
                <div className="text-sm text-white">Last 30 days · {metrics.publishedLast30} post{metrics.publishedLast30 === 1 ? '' : 's'}</div>
              </div>
              <div className="text-[10px] text-gray-500">
                This month: <span className="text-white font-semibold">{metrics.publishedThisMonth}</span>
              </div>
            </div>
            <div className="flex items-end gap-[2px] h-24">
              {metrics.daily.map((d, idx) => (
                <div key={idx} className="flex-1 flex flex-col justify-end items-center group relative" title={`${d.day}: ${d.count}`}>
                  <div
                    className={`w-full rounded-t ${d.count > 0 ? 'bg-pink-500' : 'bg-navy-700/40'}`}
                    style={{ height: `${(d.count / metrics.maxDaily) * 100}%`, minHeight: d.count > 0 ? '3px' : '2px' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-500 mt-1">
              <span>{metrics.daily[0]?.day}</span>
              <span>Today</span>
            </div>
          </div>

          {/* Pillar + Platform breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-4">
              <div className="text-xs uppercase font-bold text-gray-500 mb-3">Ideas by content pillar</div>
              {ideas.length === 0 ? (
                <div className="text-xs text-gray-500 italic">No ideas yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {CONTENT_PILLARS.map((p) => {
                    const count = metrics.ideasByPillar[p.key] || 0
                    const pct = ideas.length > 0 ? (count / ideas.length) * 100 : 0
                    return (
                      <div key={p.key} className="flex items-center gap-2">
                        <div className="text-xs w-24 flex-shrink-0">{p.icon} {p.label}</div>
                        <div className="flex-1 bg-navy-900/70 rounded-full h-2 overflow-hidden">
                          <div className="bg-pink-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-gray-400 w-8 text-right flex-shrink-0">{count}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-4">
              <div className="text-xs uppercase font-bold text-gray-500 mb-3">Drafts by platform</div>
              {drafts.length === 0 ? (
                <div className="text-xs text-gray-500 italic">No drafts yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {PLATFORMS.map((p) => {
                    const count = metrics.draftsByPlatform[p.key] || 0
                    if (count === 0) return null
                    const pct = drafts.length > 0 ? (count / drafts.length) * 100 : 0
                    return (
                      <div key={p.key} className="flex items-center gap-2">
                        <div className="text-xs w-24 flex-shrink-0">{p.label}</div>
                        <div className="flex-1 bg-navy-900/70 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-gray-400 w-8 text-right flex-shrink-0">{count}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Referral info */}
          <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-4">
            <div className="text-xs uppercase font-bold text-gray-500 mb-2">Your referral link</div>
            {enrollment?.referral_code ? (
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-sm text-pink-300 bg-navy-900 px-3 py-1.5 rounded border border-navy-700/50 font-mono break-all">
                  liftori.ai/?ref={enrollment.referral_code}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(`https://liftori.ai/?ref=${enrollment.referral_code}`).then(() => toast.success('Copied'))}
                  className="text-xs px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded"
                >Copy</button>
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic">No referral code on file — complete onboarding to activate.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function commissionLabel(tier) {
  switch (tier) {
    case 'creator': return '15%'
    case 'pro':     return '20%'
    case 'diamond': return '25%'
    default:        return '10%'
  }
}

function HeadlineStat({ label, value, accent }) {
  return (
    <div className={`${accent} border border-white/5 rounded-xl p-4`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-[10px] uppercase mt-1 opacity-80">{label}</div>
    </div>
  )
}

function PipelineBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="text-xs w-28 flex-shrink-0">{label}</div>
      <div className="flex-1 bg-navy-900/70 rounded-full h-3 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }} />
      </div>
      <div className="text-sm text-white w-8 text-right font-semibold flex-shrink-0">{count}</div>
    </div>
  )
}
