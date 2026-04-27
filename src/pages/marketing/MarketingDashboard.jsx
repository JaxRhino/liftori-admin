import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// Marketing Hub - visual hierarchy: Engine featured, funnel sections compact, paid deferred.
// Built tools get full treatment with icons + status; coming-soon tiles dim out.

const ICONS = {
  composer:  'M12 5v14m7-7H5',                                                                         // plus
  chart:     'M3 17l6-6 4 4 8-8M21 7v6h-6',                                                            // chart up-right
  users:     'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-3.13a4 4 0 110-8 4 4 0 010 8z',     // users
  mail:      'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', // mail
  pen:       'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.41-9.41a2 2 0 112.83 2.83L11.83 15H9v-2.83l8.59-8.58z', // pen
  calendar:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',  // calendar
  search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',                                            // search
  ear:       'M9 9a3 3 0 016 0v2a3 3 0 11-6 0V9zm-2 6c0 3.866 3.134 7 7 7s7-3.134 7-7v-3a7 7 0 10-14 0v3z', // listening
  layers:    'M19 11H5m14-7H5m14 14H5',                                                                // segments
  globe:     'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z', // globe
  flask:     'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', // beaker
  pulse:     'M3 12h4l3-9 4 18 3-9h4',                                                                 // pulse
  trophy:    'M5 3a2 2 0 00-2 2v3a2 2 0 002 2h.5a2.5 2.5 0 002.5-2.5V5a2 2 0 00-2-2H5zm14 0a2 2 0 012 2v3a2 2 0 01-2 2h-.5A2.5 2.5 0 0116 7.5V5a2 2 0 012-2h1zM12 15a4 4 0 100-8 4 4 0 000 8zm0 0v6m-3 0h6', // trophy
  target:    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',                                            // target
  megaphone: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z', // megaphone
  link:      'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', // link
}

function Icon({ path, className = 'w-5 h-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  )
}

export default function MarketingDashboard() {
  const [posts, setPosts] = useState([])
  const [signups, setSignups] = useState([])
  const [sends, setSends] = useState([])
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [{ data: p }, { data: s }, { data: e }, { data: st }] = await Promise.all([
        supabase.from('marketing_posts').select('id, status, published_at, created_at, scheduled_for').order('created_at', { ascending: false }).limit(500),
        supabase.from('waitlist_signups').select('id, product_interest, created_at').order('created_at', { ascending: false }).limit(2000),
        supabase.from('email_sends').select('id, status, sent_at').order('sent_at', { ascending: false }).limit(2000),
        supabase.from('email_sequence_steps').select('id, active').eq('active', true),
      ])
      setPosts(p || [])
      setSignups(s || [])
      setSends(e || [])
      setSteps(st || [])
    } catch (err) {
      console.error('Marketing dashboard load:', err)
    } finally { setLoading(false) }
  }

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const week = new Date(today); week.setDate(week.getDate() - 7)
    return {
      published: posts.filter(p => p.status === 'published').length,
      scheduled: posts.filter(p => p.status === 'scheduled').length,
      pending:   posts.filter(p => p.status === 'pending_approval').length,
      failed:    posts.filter(p => p.status === 'failed').length,
      signups:   signups.length,
      signupsToday: signups.filter(s => new Date(s.created_at) >= today).length,
      signupsWeek:  signups.filter(s => new Date(s.created_at) >= week).length,
      sends:        sends.filter(e => e.status === 'sent').length,
      sendsFailed:  sends.filter(e => e.status === 'failed').length,
      activeSteps:  steps.length,
      boloGo:       signups.filter(s => s.product_interest === 'bolo_go').length,
      crm:          signups.filter(s => s.product_interest === 'crm').length,
    }
  }, [posts, signups, sends, steps])

  return (
    <div className="p-6 max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Marketing Hub</h1>
        <p className="text-sm text-slate-400 mt-1">Compose, queue, publish, capture, nurture, measure. The Liftori marketing engine.</p>
      </div>

      {/* TOP-LEVEL KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Posts published" value={stats.published} sub={`${stats.scheduled} scheduled`} tone="emerald" link="/admin/marketing/social-composer" />
        <Kpi label="Total signups"    value={stats.signups}   sub={stats.signupsWeek > 0 ? `+${stats.signupsWeek} this week` : 'none yet this week'} tone="sky" link="/admin/marketing/waitlist" />
        <Kpi label="Drip emails sent" value={stats.sends}     sub={stats.sendsFailed > 0 ? `${stats.sendsFailed} failed` : 'no failures'} tone="violet" link="/admin/marketing/sequences" />
        <Kpi label="Pending approval" value={stats.pending}   sub={stats.failed > 0 ? `${stats.failed} failed publishes` : 'queue healthy'} tone={stats.pending > 0 ? 'amber' : 'slate'} link="/admin/marketing/social-composer" />
      </div>

      {/* PRODUCT FUNNEL CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ProductCard product="BOLO Go" tagline="Reseller platform" url="/admin/marketing/waitlist?product=bolo_go" signups={stats.boloGo} tone="emerald" />
        <ProductCard product="CRM"     tagline="Service-business AI CRM" url="/admin/marketing/waitlist?product=crm" signups={stats.crm} tone="blue" />
      </div>

      {/* ============ ENGINE - FEATURED ============ */}
      <FeaturedSection
        eyebrow="Engine"
        title="Your built tools"
        subtitle="What you use daily. Compose, schedule, capture, nurture, measure."
      >
        <FeaturedTile to="/admin/marketing/social-composer" iconPath={ICONS.composer} title="Social Composer" hint="Compose, AI-draft, branded image, approve" badge={`${stats.pending + stats.scheduled} in queue`} tone="emerald" />
        <FeaturedTile to="/admin/marketing/performance"     iconPath={ICONS.chart}    title="Performance"     hint="Posts, signups, drips - 7-day trend" badge="live data" tone="sky" />
        <FeaturedTile to="/admin/marketing/waitlist"        iconPath={ICONS.users}    title="Waitlist Signups" hint="Per-product list + CSV export" badge={`${stats.signups} captured`} tone="blue" />
        <FeaturedTile to="/admin/marketing/sequences"       iconPath={ICONS.mail}     title="Email Sequences"  hint="Drip emails + send stats" badge={`${stats.activeSteps} active steps`} tone="violet" />
      </FeaturedSection>

      {/* ============ FUNNEL: AWARENESS ============ */}
      <FunnelSection
        stage="01"
        stageLabel="Top of funnel"
        title="Awareness & Reach"
        subtitle="How prospects discover Liftori"
        accent="amber"
      >
        <CompactTile to="/marketing/content"           iconPath={ICONS.pen}      title="Content Creator"   hint="Long-form: blog, email, landing" />
        <CompactTile to="/marketing/scheduler"         iconPath={ICONS.calendar} title="Content Scheduler" hint="Calendar across channels" />
        <CompactTile to="/marketing/seo"               iconPath={ICONS.search}   title="SEO Manager"       hint="Ranks, keywords, on-page" />
        <CompactTile to="/marketing/social-listening"  iconPath={ICONS.ear}      title="Social Listening"  hint="Mentions and replies" />
      </FunnelSection>

      {/* ============ FUNNEL: AUDIENCE & NURTURE ============ */}
      <FunnelSection
        stage="02"
        stageLabel="Middle of funnel"
        title="Audience & Nurture"
        subtitle="Capture intent, segment, warm up"
        accent="sky"
      >
        <CompactTile to="/marketing/email"             iconPath={ICONS.megaphone} title="Email Campaigns"   hint="One-shot broadcasts" />
        <CompactTile to="/marketing/audience-segments" iconPath={ICONS.layers}   title="Audience Segments" hint="Cohorts and lookalikes" />
        <CompactTile to="/marketing/customer-map"      iconPath={ICONS.globe}    title="Customer Map"      hint="Geographic distribution" />
        <CompactTile to="/marketing/ab-testing"        iconPath={ICONS.flask}    title="A/B Testing"       hint="Subject lines, CTAs, pages" />
      </FunnelSection>

      {/* ============ FUNNEL: MEASURE ============ */}
      <FunnelSection
        stage="03"
        stageLabel="Bottom of funnel"
        title="Measurement & Goals"
        subtitle="Did it work? Are we on pace?"
        accent="violet"
      >
        <CompactTile to="/marketing/analytics" iconPath={ICONS.pulse}  title="Analytics"          hint="Deep drilldown across campaigns" />
        <CompactTile to="/marketing/on-pace"   iconPath={ICONS.target} title="On-Pace Tracking"   hint="Goal pacing per period" />
      </FunnelSection>

      {/* ============ PAID - DEFERRED ============ */}
      <DeferredSection
        title="Paid Acquisition"
        subtitle="Separate track - light usage until LLC + Stripe finalize"
      >
        <CompactTile to="/marketing/tracker"     iconPath={ICONS.trophy} title="Campaign Tracker" hint="Spend, revenue, ROAS" deferred />
        <CompactTile to="/marketing/ads"         iconPath={ICONS.megaphone} title="Ad Manager"    hint="Creative + targeting registry" deferred />
        <CompactTile to="/marketing/utm-builder" iconPath={ICONS.link}   title="UTM Builder"      hint="Tagged links for attribution" deferred />
      </DeferredSection>

      {loading && <p className="text-xs text-slate-500">Refreshing metrics...</p>}
    </div>
  )
}

// ===================== COMPONENTS =====================

function Kpi({ label, value, sub, tone = 'slate', link }) {
  const toneMap = {
    slate:   'text-white',
    sky:     'text-sky-400',
    emerald: 'text-emerald-400',
    amber:   'text-amber-400',
    violet:  'text-violet-400',
    blue:    'text-blue-400',
    rose:    'text-rose-400',
  }
  const ring = {
    slate:   'hover:border-slate-500/60',
    sky:     'hover:border-sky-500/60',
    emerald: 'hover:border-emerald-500/60',
    amber:   'hover:border-amber-500/60',
    violet:  'hover:border-violet-500/60',
    blue:    'hover:border-blue-500/60',
    rose:    'hover:border-rose-500/60',
  }
  const inner = (
    <>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-mono">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${toneMap[tone] || toneMap.slate}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </>
  )
  const cls = `block rounded-xl bg-navy-800/40 border border-navy-700/40 p-4 transition-all ${ring[tone] || ring.slate}`
  return link ? <Link to={link} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>
}

function ProductCard({ product, tagline, url, signups, tone }) {
  const toneMap = {
    emerald: { bg: 'bg-gradient-to-br from-emerald-500/10 to-transparent', border: 'border-emerald-500/30 hover:border-emerald-500/60', value: 'text-emerald-400', label: 'text-emerald-400' },
    blue:    { bg: 'bg-gradient-to-br from-blue-500/10 to-transparent',    border: 'border-blue-500/30 hover:border-blue-500/60',       value: 'text-blue-400',    label: 'text-blue-400' },
    slate:   { bg: 'bg-navy-800/40',                                      border: 'border-navy-700/50',                                value: 'text-white',       label: 'text-slate-400' },
  }
  const t = toneMap[tone] || toneMap.slate
  return (
    <Link to={url} className={`block rounded-xl ${t.bg} border ${t.border} p-5 transition-all`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[11px] uppercase tracking-wide ${t.label} font-mono`}>{product} waitlist</p>
          <p className="text-xs text-slate-500 mt-0.5">{tagline}</p>
          <p className={`text-3xl font-bold mt-3 ${t.value}`}>{signups.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-0.5">{signups === 1 ? 'signup' : 'signups'}</p>
        </div>
        <span className="text-xs text-slate-400 mt-1">View list →</span>
      </div>
    </Link>
  )
}

function FeaturedSection({ eyebrow, title, subtitle, children }) {
  return (
    <section className="relative">
      <div className="absolute -inset-x-4 -inset-y-2 rounded-2xl bg-gradient-to-r from-emerald-500/[0.04] via-sky-500/[0.04] to-violet-500/[0.04] -z-10" />
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[3px] text-emerald-400 font-mono mb-1">{eyebrow}</p>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">live</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
    </section>
  )
}

function FeaturedTile({ to, iconPath, title, hint, badge, tone = 'slate' }) {
  const toneMap = {
    emerald: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400',
    sky:     'border-sky-500/40 bg-sky-500/5 text-sky-400',
    blue:    'border-blue-500/40 bg-blue-500/5 text-blue-400',
    violet:  'border-violet-500/40 bg-violet-500/5 text-violet-400',
    slate:   'border-navy-700/60 bg-navy-800/40 text-slate-300',
  }
  const t = toneMap[tone] || toneMap.slate
  return (
    <Link to={to} className={`group relative block rounded-xl border ${t} p-4 transition-all hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.replace('text-', 'text-').split(' ').slice(2).join(' ')}`}>
          <Icon path={iconPath} className="w-5 h-5" />
        </div>
        {badge && <span className="text-[10px] uppercase tracking-wide bg-black/30 px-2 py-0.5 rounded-full font-mono">{badge}</span>}
      </div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-xs text-slate-400 mt-1 leading-snug">{hint}</p>
    </Link>
  )
}

function FunnelSection({ stage, stageLabel, title, subtitle, accent, children }) {
  const accentMap = {
    amber:  'border-amber-500/40 text-amber-400 bg-amber-500/5',
    sky:    'border-sky-500/40 text-sky-400 bg-sky-500/5',
    violet: 'border-violet-500/40 text-violet-400 bg-violet-500/5',
    slate:  'border-slate-500/30 text-slate-400 bg-slate-700/20',
  }
  const a = accentMap[accent] || accentMap.slate
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg border ${a} font-mono text-xs font-bold`}>
          {stage}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] uppercase tracking-[2px] font-mono ${a.match(/text-\w+-400/)?.[0] || 'text-slate-400'}`}>{stageLabel}</p>
          <h2 className="text-base font-bold text-white leading-tight">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{children}</div>
    </section>
  )
}

function DeferredSection({ title, subtitle, children }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-400">{title}</h2>
          <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide bg-slate-800 text-slate-500 px-2 py-1 rounded-full font-mono">deferred</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 opacity-60">{children}</div>
    </section>
  )
}

function CompactTile({ to, iconPath, title, hint, deferred = false }) {
  const cls = deferred
    ? 'border-slate-700/40 bg-navy-900/30 text-slate-500 hover:text-slate-400 hover:border-slate-600/60'
    : 'border-navy-700/50 bg-navy-800/40 text-slate-300 hover:text-white hover:border-sky-500/40 hover:bg-navy-800/70'
  return (
    <Link to={to} className={`block rounded-lg border ${cls} px-3 py-2.5 transition-all`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon path={iconPath} className="w-4 h-4 shrink-0" />
        <p className="text-sm font-medium truncate">{title}</p>
      </div>
      <p className="text-[11px] text-slate-500 leading-snug truncate">{hint}</p>
    </Link>
  )
}
