import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// Marketing Hub overview - rebuilt around what Liftori actually runs.
// Top: real engine KPIs from our own tables (posts, signups, drips).
// Tiles grouped by section: Engine (your built tools), Content, Paid, Insights.

export default function MarketingDashboard() {
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
          .select('id, status, published_at, created_at, scheduled_for')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('waitlist_signups')
          .select('id, product_interest, created_at')
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
      console.error('Marketing dashboard load failed:', err)
    } finally { setLoading(false) }
  }

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const week = new Date(today); week.setDate(week.getDate() - 7)
    return {
      published:    posts.filter(p => p.status === 'published').length,
      scheduled:    posts.filter(p => p.status === 'scheduled').length,
      pending:      posts.filter(p => p.status === 'pending_approval').length,
      failed:       posts.filter(p => p.status === 'failed').length,
      signups:      signups.length,
      signupsWeek:  signups.filter(s => new Date(s.created_at) >= week).length,
      sends:        sends.filter(e => e.status === 'sent').length,
      sendsFailed:  sends.filter(e => e.status === 'failed').length,
      boloGo:       signups.filter(s => s.product_interest === 'bolo_go').length,
      crm:          signups.filter(s => s.product_interest === 'crm').length,
    }
  }, [posts, signups, sends])

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Marketing Hub</h1>
        <p className="text-sm text-gray-400 mt-1">Liftori marketing engine. Compose, queue, publish, capture, nurture, measure.</p>
      </div>

      {/* Engine KPIs - real metrics from Liftori tables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigKpi label="Posts published" value={stats.published} sub={`${stats.scheduled} scheduled`} tone="emerald" link="/admin/marketing/social-composer" />
        <BigKpi label="Total signups" value={stats.signups} sub={`+${stats.signupsWeek} this week`} tone="sky" link="/admin/marketing/waitlist" />
        <BigKpi label="Drip emails sent" value={stats.sends} sub={stats.sendsFailed > 0 ? `${stats.sendsFailed} failed` : 'no failures'} tone="blue" link="/admin/marketing/sequences" />
        <BigKpi label="Pending approval" value={stats.pending} sub={stats.failed > 0 ? `${stats.failed} failed publishes` : 'queue healthy'} tone={stats.pending > 0 ? 'amber' : 'slate'} link="/admin/marketing/social-composer" />
      </div>

      {/* Per-product funnel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ProductCard product="BOLO Go" url="/admin/marketing/waitlist" signups={stats.boloGo} tone="emerald" />
        <ProductCard product="CRM"     url="/admin/marketing/waitlist" signups={stats.crm} tone="blue" />
      </div>

      {/* SECTION 1: Engine (Liftori-built, working) */}
      <Section title="Engine" subtitle="The Liftori-built marketing system. Use these daily.">
        <ToolTile to="/admin/marketing/social-composer"  title="Social Composer"     hint="Compose, AI-draft, branded image, approve" accent="emerald" />
        <ToolTile to="/admin/marketing/performance"      title="Performance"         hint="Posts, signups, drips - 7-day trend" accent="sky" />
        <ToolTile to="/admin/marketing/waitlist"         title="Waitlist Signups"    hint="Per-product signups + CSV export" accent="sky" />
        <ToolTile to="/admin/marketing/sequences"        title="Email Sequences"     hint="Drip emails + send stats" accent="violet" />
      </Section>

      {/* SECTION 2: Content & SEO */}
      <Section title="Content & SEO" subtitle="Long-form content and discoverability.">
        <ToolTile to="/marketing/content"          title="Content Creator"     hint="Drafts for blog, email, landing" />
        <ToolTile to="/marketing/scheduler"        title="Content Scheduler"   hint="Calendar view of publishing" />
        <ToolTile to="/marketing/seo"              title="SEO Manager"         hint="Keyword tracking + on-page" />
        <ToolTile to="/marketing/email"            title="Email Campaigns"     hint="One-shot broadcast emails" />
      </Section>

      {/* SECTION 3: Paid (when LLC + Stripe lands) */}
      <Section title="Paid Acquisition" subtitle="Tracking + budget. Light usage until LLC + Stripe lands.">
        <ToolTile to="/marketing/tracker"          title="Campaign Tracker"    hint="Spend, revenue, ROAS by campaign" />
        <ToolTile to="/marketing/ads"              title="Ad Manager"          hint="Creative + targeting registry" />
        <ToolTile to="/marketing/utm-builder"      title="UTM Builder"         hint="Tagged links for attribution" />
        <ToolTile to="/marketing/ab-testing"       title="A/B Testing"         hint="Experiments + variants" />
      </Section>

      {/* SECTION 4: Insights & audience */}
      <Section title="Insights & Audience" subtitle="Who they are, where they came from, what to send next.">
        <ToolTile to="/marketing/analytics"        title="Analytics"           hint="Deep performance drilldown" />
        <ToolTile to="/marketing/customer-map"     title="Customer Map"        hint="Geographic distribution" />
        <ToolTile to="/marketing/audience-segments" title="Audience Segments"  hint="Cohorts and lookalikes" />
        <ToolTile to="/marketing/social-listening" title="Social Listening"    hint="Mentions and replies" />
        <ToolTile to="/marketing/on-pace"          title="On-Pace Tracking"    hint="Goal pacing per period" />
      </Section>

      {loading && <p className="text-xs text-slate-500">Refreshing metrics...</p>}
    </div>
  )
}

function BigKpi({ label, value, sub, tone = 'slate', link }) {
  const toneMap = {
    slate: 'text-white',
    sky: 'text-sky-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    rose: 'text-rose-400',
  }
  const inner = (
    <>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${toneMap[tone] || toneMap.slate}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </>
  )
  const cls = "rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 transition-colors hover:border-sky-500/40"
  return link ? (
    <Link to={link} className={cls + " block"}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function ProductCard({ product, url, signups, tone }) {
  const toneMap = {
    emerald: 'border-emerald-500/30 hover:border-emerald-500/60',
    blue:    'border-blue-500/30 hover:border-blue-500/60',
    slate:   'border-navy-700/50',
  }
  const valueTone = {
    emerald: 'text-emerald-400',
    blue:    'text-blue-400',
    slate:   'text-white',
  }
  return (
    <Link to={url} className={`block rounded-xl bg-navy-800/40 border ${toneMap[tone] || toneMap.slate} p-4 transition-colors`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{product} waitlist</p>
          <p className={`text-2xl font-bold mt-1 ${valueTone[tone] || valueTone.slate}`}>{signups.toLocaleString()}</p>
        </div>
        <span className="text-xs text-gray-400">View list →</span>
      </div>
    </Link>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </div>
  )
}

function ToolTile({ to, title, hint, accent = 'slate' }) {
  const accentMap = {
    slate:   'border-navy-700/60',
    emerald: 'border-emerald-500/40 bg-emerald-500/5',
    sky:     'border-sky-500/40 bg-sky-500/5',
    violet:  'border-violet-500/40 bg-violet-500/5',
    amber:   'border-amber-500/40 bg-amber-500/5',
    rose:    'border-rose-500/40 bg-rose-500/5',
  }
  return (
    <Link to={to} className={`block rounded-xl bg-navy-800/50 border ${accentMap[accent] || accentMap.slate} p-3 hover:border-sky-500/40 hover:bg-navy-800/70 transition-colors`}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-gray-400 mt-1 truncate">{hint}</p>
    </Link>
  )
}
