// =====================================================================
// CrmMarketing - service business marketing command center
// Wave B.3: drops VJ retail tables (email_subscribers / products) and
// wires to marketing_campaigns / marketing_posts / marketing_ad_spend /
// marketing_goals / marketing_seo_keywords / marketing_utm_links.
// 5 tabs: Posts (default), Campaigns, Goals, SEO Keywords, UTM Links.
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from './_shared'
import { useCrm } from '../../contexts/CrmContext'

// ---------- formatters ----------
const fmtCents = (c) =>
  ((Number(c) || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`
function fmtDate(d) {
  if (!d) return '-'
  const date = new Date(d)
  const opts = { month: 'short', day: 'numeric' }
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return date.toLocaleDateString('en-US', opts)
}
function fmtDateTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function relTime(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}
function randCode(len = 6) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// ---------- platform list ----------
const POST_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', initials: 'Fb', limit: null, color: 'bg-[#1877F2]' },
  { key: 'instagram', label: 'Instagram', initials: 'Ig', limit: 2200, color: 'bg-gradient-to-br from-fuchsia-500 via-red-500 to-amber-500' },
  { key: 'twitter', label: 'X / Twitter', initials: 'X', limit: 280, color: 'bg-black border border-white/20' },
  { key: 'linkedin', label: 'LinkedIn', initials: 'In', limit: 3000, color: 'bg-[#0A66C2]' },
  { key: 'tiktok', label: 'TikTok', initials: 'Tt', limit: 2200, color: 'bg-black border border-white/20' },
  { key: 'youtube', label: 'YouTube Shorts', initials: 'Yt', limit: null, color: 'bg-[#FF0000]' },
  { key: 'pinterest', label: 'Pinterest', initials: 'Pn', limit: 500, color: 'bg-[#E60023]' },
]
const PLATFORM_BY_KEY = Object.fromEntries(POST_PLATFORMS.map((p) => [p.key, p]))

const CHANNELS = ['email', 'paid_social', 'seo', 'content', 'event', 'referral', 'direct_mail', 'other']
const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived']
const POST_STATUSES = ['draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'cancelled']
const GOAL_STATUSES = ['on_track', 'at_risk', 'off_track', 'achieved', 'missed']
const SEO_PRIORITIES = ['low', 'medium', 'high']

// ---------- local primitives ----------
function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`bg-navy-800 border border-navy-700/60 rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40">{footer}</div>}
      </div>
    </div>
  )
}

function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <div
        className="w-full sm:w-[520px] bg-navy-800 border-l border-navy-700/50 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between sticky top-0 bg-navy-800 z-10">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40 sticky bottom-0">{footer}</div>}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder, rows }) {
  const base = 'w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan'
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      {rows ? (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={base} />
      ) : (
        <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
      >
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition ${
        active
          ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan'
          : 'bg-navy-900/40 border-navy-700/60 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function TabBtn({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
        active
          ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40'
          : 'text-gray-400 hover:text-white border border-transparent'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy-700/60">{count}</span>
      )}
    </button>
  )
}

function PlatformBadge({ k, size = 'md' }) {
  const p = PLATFORM_BY_KEY[k]
  if (!p) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700/60 text-gray-300">{k}</span>
  }
  const sizing = size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-8 w-8 text-[10px]'
  return (
    <div className={`${sizing} ${p.color} rounded-lg flex items-center justify-center font-bold text-white`} title={p.label}>
      {p.initials}
    </div>
  )
}

function StatusBadge({ status }) {
  if (!status) return null
  const map = {
    draft: 'bg-navy-700/60 text-gray-300',
    pending_approval: 'bg-amber-500/20 text-amber-300',
    approved: 'bg-sky-500/20 text-sky-300',
    scheduled: 'bg-brand-cyan/20 text-brand-cyan',
    published: 'bg-emerald-500/20 text-emerald-300',
    failed: 'bg-rose-500/20 text-rose-300',
    cancelled: 'bg-navy-700/60 text-gray-500',
    active: 'bg-emerald-500/20 text-emerald-300',
    paused: 'bg-amber-500/20 text-amber-300',
    completed: 'bg-brand-blue/20 text-brand-blue',
    archived: 'bg-navy-700/60 text-gray-500',
    on_track: 'bg-emerald-500/20 text-emerald-300',
    at_risk: 'bg-amber-500/20 text-amber-300',
    off_track: 'bg-rose-500/20 text-rose-300',
    achieved: 'bg-brand-cyan/20 text-brand-cyan',
    missed: 'bg-navy-700/60 text-gray-500',
  }
  return (
    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${map[status] || 'bg-navy-700/60 text-gray-300'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export default function CrmMarketing() {
  const { client, platform } = useCrm()
  const { } = useCrmClient()
  const [tab, setTab] = useState('posts')

  // ---- data ----
  const [posts, setPosts] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [adSpend, setAdSpend] = useState([])
  const [goals, setGoals] = useState([])
  const [keywords, setKeywords] = useState([])
  const [utmLinks, setUtmLinks] = useState([])

  // ---- loading ----
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [loadingAdSpend, setLoadingAdSpend] = useState(true)
  const [loadingGoals, setLoadingGoals] = useState(true)
  const [loadingKeywords, setLoadingKeywords] = useState(true)
  const [loadingUtm, setLoadingUtm] = useState(true)

  // ---- modal/drawer ----
  const [composerOpen, setComposerOpen] = useState(false)
  const [postDrawer, setPostDrawer] = useState(null)
  const [newCampaignOpen, setNewCampaignOpen] = useState(false)
  const [campaignDrawer, setCampaignDrawer] = useState(null)
  const [newGoalOpen, setNewGoalOpen] = useState(false)
  const [goalDrawer, setGoalDrawer] = useState(null)
  const [newKeywordOpen, setNewKeywordOpen] = useState(false)
  const [bulkKeywordOpen, setBulkKeywordOpen] = useState(false)
  const [newUtmOpen, setNewUtmOpen] = useState(false)
  const [utmDrawer, setUtmDrawer] = useState(null)

  // ---- loaders ----
  async function loadPosts() {
    if (!client) return
    setLoadingPosts(true)
    try {
      const { data, error } = await client
        .from('marketing_posts')
        .select('*')
        .order('scheduled_for', { ascending: true, nullsFirst: false })
        .limit(200)
      if (error) throw error
      setPosts(data || [])
    } catch (e) {
      console.error('[CrmMarketing] loadPosts', e)
    } finally {
      setLoadingPosts(false)
    }
  }

  async function loadCampaigns() {
    if (!client) return
    setLoadingCampaigns(true)
    try {
      const { data, error } = await client
        .from('marketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setCampaigns(data || [])
    } catch (e) {
      console.error('[CrmMarketing] loadCampaigns', e)
    } finally {
      setLoadingCampaigns(false)
    }
  }

  async function loadAdSpend() {
    if (!client) return
    setLoadingAdSpend(true)
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const { data, error } = await client
        .from('marketing_ad_spend')
        .select('*')
        .gte('date', since)
        .order('date', { ascending: false })
        .limit(500)
      if (error) throw error
      setAdSpend(data || [])
    } catch (e) {
      console.error('[CrmMarketing] loadAdSpend', e)
    } finally {
      setLoadingAdSpend(false)
    }
  }

  async function loadGoals() {
    if (!client) return
    setLoadingGoals(true)
    try {
      const { data, error } = await client
        .from('marketing_goals')
        .select('*')
        .order('period_end', { ascending: true, nullsFirst: false })
        .limit(100)
      if (error) throw error
      setGoals(data || [])
    } catch (e) {
      console.error('[CrmMarketing] loadGoals', e)
    } finally {
      setLoadingGoals(false)
    }
  }

  async function loadKeywords() {
    if (!client) return
    setLoadingKeywords(true)
    try {
      const { data, error } = await client
        .from('marketing_seo_keywords')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setKeywords(data || [])
    } catch (e) {
      console.error('[CrmMarketing] loadKeywords', e)
    } finally {
      setLoadingKeywords(false)
    }
  }

  async function loadUtm() {
    if (!client) return
    setLoadingUtm(true)
    try {
      const { data, error } = await client
        .from('marketing_utm_links')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setUtmLinks(data || [])
    } catch (e) {
      console.error('[CrmMarketing] loadUtm', e)
    } finally {
      setLoadingUtm(false)
    }
  }

  useEffect(() => {
    if (!client) return
    loadPosts()
    loadCampaigns()
    loadAdSpend()
    loadGoals()
    loadKeywords()
    loadUtm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  // ---- stats ----
  const stats = useMemo(() => {
    const activeCampaigns = campaigns.filter((c) => c.status === 'active').length
    const now = new Date()
    const scheduledPosts = posts.filter((p) => p.status === 'scheduled' && p.scheduled_for && new Date(p.scheduled_for) > now).length
    const spend30d = adSpend.reduce((s, r) => s + Number(r.spend_cents || 0), 0)
    const rev30d = adSpend.reduce((s, r) => s + Number(r.revenue_cents || 0), 0)
    return { activeCampaigns, scheduledPosts, spend30d, rev30d }
  }, [campaigns, posts, adSpend])

  return (
    <HubPage
      title="Marketing"
      subtitle={`Run campaigns, post on social, hit growth goals${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
    >
      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Campaigns" value={stats.activeCampaigns} accent="text-brand-cyan" />
        <StatCard label="Scheduled Posts" value={stats.scheduledPosts} accent="text-brand-blue" />
        <StatCard label="30-Day Ad Spend" value={fmtCents(stats.spend30d)} accent="text-amber-400" />
        <StatCard label="30-Day Attributed Revenue" value={fmtCents(stats.rev30d)} accent="text-emerald-400" />
      </div>

      {/* tabs */}
      <div className="mb-5">
        <div className="md:hidden">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="posts">Posts</option>
            <option value="campaigns">Campaigns</option>
            <option value="goals">Goals</option>
            <option value="seo">SEO Keywords</option>
            <option value="utm">UTM Links</option>
          </select>
        </div>
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          <TabBtn active={tab === 'posts'} onClick={() => setTab('posts')} count={posts.length}>Posts</TabBtn>
          <TabBtn active={tab === 'campaigns'} onClick={() => setTab('campaigns')} count={campaigns.length}>Campaigns</TabBtn>
          <TabBtn active={tab === 'goals'} onClick={() => setTab('goals')} count={goals.length}>Goals</TabBtn>
          <TabBtn active={tab === 'seo'} onClick={() => setTab('seo')} count={keywords.length}>SEO Keywords</TabBtn>
          <TabBtn active={tab === 'utm'} onClick={() => setTab('utm')} count={utmLinks.length}>UTM Links</TabBtn>
        </div>
      </div>

      {tab === 'posts' && (
        <PostsTab
          posts={posts}
          loading={loadingPosts}
          onCompose={() => setComposerOpen(true)}
          onCard={(p) => setPostDrawer(p)}
        />
      )}
      {tab === 'campaigns' && (
        <CampaignsTab
          campaigns={campaigns}
          loading={loadingCampaigns}
          onOpenNew={() => setNewCampaignOpen(true)}
          onRow={(c) => setCampaignDrawer(c)}
        />
      )}
      {tab === 'goals' && (
        <GoalsTab
          goals={goals}
          loading={loadingGoals}
          onOpenNew={() => setNewGoalOpen(true)}
          onCard={(g) => setGoalDrawer(g)}
        />
      )}
      {tab === 'seo' && (
        <SeoTab
          keywords={keywords}
          loading={loadingKeywords}
          onOpenNew={() => setNewKeywordOpen(true)}
          onOpenBulk={() => setBulkKeywordOpen(true)}
          onChanged={loadKeywords}
          client={client}
        />
      )}
      {tab === 'utm' && (
        <UtmTab
          links={utmLinks}
          loading={loadingUtm}
          onOpenNew={() => setNewUtmOpen(true)}
          onRow={(u) => setUtmDrawer(u)}
        />
      )}

      <ComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        client={client}
        onSaved={() => { setComposerOpen(false); loadPosts() }}
      />
      <PostDrawer
        post={postDrawer}
        onClose={() => setPostDrawer(null)}
        client={client}
        onChanged={() => { setPostDrawer(null); loadPosts() }}
      />
      <NewCampaignModal
        open={newCampaignOpen}
        onClose={() => setNewCampaignOpen(false)}
        client={client}
        onSaved={() => { setNewCampaignOpen(false); loadCampaigns() }}
      />
      <CampaignDrawer
        campaign={campaignDrawer}
        onClose={() => setCampaignDrawer(null)}
        client={client}
        adSpend={adSpend}
        onChanged={() => { setCampaignDrawer(null); loadCampaigns(); loadAdSpend() }}
      />
      <NewGoalModal
        open={newGoalOpen}
        onClose={() => setNewGoalOpen(false)}
        client={client}
        onSaved={() => { setNewGoalOpen(false); loadGoals() }}
      />
      <GoalDrawer
        goal={goalDrawer}
        onClose={() => setGoalDrawer(null)}
        client={client}
        onChanged={() => { setGoalDrawer(null); loadGoals() }}
      />
      <NewKeywordModal
        open={newKeywordOpen}
        onClose={() => setNewKeywordOpen(false)}
        client={client}
        onSaved={() => { setNewKeywordOpen(false); loadKeywords() }}
      />
      <BulkKeywordModal
        open={bulkKeywordOpen}
        onClose={() => setBulkKeywordOpen(false)}
        client={client}
        onSaved={() => { setBulkKeywordOpen(false); loadKeywords() }}
      />
      <NewUtmModal
        open={newUtmOpen}
        onClose={() => setNewUtmOpen(false)}
        client={client}
        onSaved={() => { setNewUtmOpen(false); loadUtm() }}
      />
      <UtmDrawer
        link={utmDrawer}
        onClose={() => setUtmDrawer(null)}
      />
    </HubPage>
  )
}

// =====================================================================
// TAB: POSTS
// =====================================================================
function PostsTab({ posts, loading, onCompose, onCard }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [aiFilter, setAiFilter] = useState('all')

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (platformFilter !== 'all' && !(p.platforms || []).includes(platformFilter)) return false
      if (aiFilter === 'yes' && !p.ai_generated) return false
      if (aiFilter === 'no' && p.ai_generated) return false
      return true
    })
  }, [posts, statusFilter, platformFilter, aiFilter])

  const now = new Date()
  const upcoming = filtered.filter((p) => p.scheduled_for && new Date(p.scheduled_for) > now && p.status !== 'published')
  const recent = filtered.filter((p) => p.status === 'published').slice(0, 12)

  return (
    <div className="space-y-6">
      <Section
        title="Scheduled & Drafts"
        right={
          <button
            onClick={onCompose}
            className="bg-brand-cyan text-navy-900 text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-brand-cyan/90"
          >
            + New Post
          </button>
        }
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex flex-wrap items-center gap-2">
          <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
          {POST_STATUSES.map((s) => (
            <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s.replace(/_/g, ' ')}</Chip>
          ))}
          <span className="text-gray-600">|</span>
          <Chip active={platformFilter === 'all'} onClick={() => setPlatformFilter('all')}>All Platforms</Chip>
          {POST_PLATFORMS.map((p) => (
            <Chip key={p.key} active={platformFilter === p.key} onClick={() => setPlatformFilter(p.key)}>{p.label}</Chip>
          ))}
          <span className="text-gray-600">|</span>
          <Chip active={aiFilter === 'all'} onClick={() => setAiFilter('all')}>Any</Chip>
          <Chip active={aiFilter === 'yes'} onClick={() => setAiFilter('yes')}>AI</Chip>
          <Chip active={aiFilter === 'no'} onClick={() => setAiFilter('no')}>Human</Chip>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading posts...</div>
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="Nothing in the queue"
            description="Draft, schedule, and ship a post. Use AI Generate to get started fast, or write it yourself."
            cta={
              <button
                onClick={onCompose}
                className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium"
              >
                + Compose Post
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {upcoming.map((p) => (
              <PostCard key={p.id} post={p} onClick={() => onCard(p)} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent Published">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading posts...</div>
        ) : recent.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 text-center">
            No published posts yet. They will appear here once your queue starts shipping.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {recent.map((p) => (
              <PostCard key={p.id} post={p} onClick={() => onCard(p)} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function PostCard({ post, onClick }) {
  const media = post.media_urls || []
  const preview = (post.content || '').slice(0, 120)
  const platforms = post.platforms || []
  const when = post.scheduled_for || post.published_at
  return (
    <button
      onClick={onClick}
      className="text-left bg-navy-900/40 border border-navy-700/50 rounded-xl overflow-hidden hover:border-brand-cyan/40 transition flex flex-col"
    >
      {media.length > 0 && (
        <div className="aspect-video bg-navy-900 border-b border-navy-700/40 overflow-hidden">
          <img
            src={media[0]}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          {platforms.slice(0, 4).map((k) => (
            <PlatformBadge key={k} k={k} size="sm" />
          ))}
          {platforms.length > 4 && (
            <span className="text-[10px] text-gray-500">+{platforms.length - 4}</span>
          )}
        </div>
        <p className="text-sm text-gray-200 line-clamp-3 flex-1">{preview || <span className="text-gray-500 italic">(no content)</span>}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge status={post.status} />
            {post.ai_generated && (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-brand-blue/20 text-brand-blue">AI</span>
            )}
          </div>
          <span className="text-[11px] text-gray-500">{when ? fmtDateTime(when) : ''}</span>
        </div>
      </div>
    </button>
  )
}

// ---------- Composer Modal ----------
function ComposerModal({ open, onClose, client, onSaved }) {
  const [content, setContent] = useState('')
  const [platforms, setPlatforms] = useState([])
  const [mediaText, setMediaText] = useState('')
  const [scheduleMode, setScheduleMode] = useState('now')
  const [scheduledFor, setScheduledFor] = useState('')
  const [aiGenerated, setAiGenerated] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setContent('')
      setPlatforms([])
      setMediaText('')
      setScheduleMode('now')
      setScheduledFor('')
      setAiGenerated(false)
    }
  }, [open])

  function togglePlatform(k) {
    setPlatforms((arr) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]))
  }

  function aiGenerate() {
    setContent(`[AI DRAFT - Wave F replaces this with real generation]\n\nYour service business stands out for a reason. Tell people why - in your own words. Add a photo of a finished job, tag the platforms, and ship it.`)
    setAiGenerated(true)
  }

  const minLimit = useMemo(() => {
    const lims = platforms
      .map((k) => PLATFORM_BY_KEY[k]?.limit)
      .filter((n) => typeof n === 'number')
    return lims.length === 0 ? null : Math.min(...lims)
  }, [platforms])

  async function submit() {
    if (!client) return
    setSaving(true)
    try {
      const media = mediaText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const scheduled = scheduleMode === 'later' && scheduledFor ? new Date(scheduledFor).toISOString() : null
      const status = scheduled ? 'scheduled' : (content ? 'draft' : 'draft')
      const payload = {
        content: content || null,
        platforms: platforms.length ? platforms : null,
        media_urls: media.length ? media : null,
        scheduled_for: scheduled,
        status,
        ai_generated: aiGenerated,
      }
      const { error } = await client.from('marketing_posts').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[ComposerModal] submit', e)
      alert('Could not save post: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  const charCount = content.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Post"
      wide
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {charCount} char{charCount === 1 ? '' : 's'}
            {minLimit && (
              <span className={charCount > minLimit ? 'text-rose-400 ml-2' : 'ml-2'}>
                / {minLimit} (shortest platform limit)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
            <button
              onClick={submit}
              disabled={saving}
              className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : (scheduleMode === 'later' ? 'Schedule Post' : 'Save Draft')}
            </button>
          </div>
        </div>
      }
    >
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="block text-xs text-gray-400 uppercase tracking-wider">Content</span>
          <button
            onClick={aiGenerate}
            className="text-[11px] text-brand-blue hover:underline flex items-center gap-1"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-blue" />
            AI Generate
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); if (aiGenerated) setAiGenerated(false) }}
          rows={5}
          placeholder="What is the story? Lead with the customer outcome, not the feature."
          className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
        />
      </div>

      <div className="mb-3">
        <span className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Platforms</span>
        <div className="flex flex-wrap gap-2">
          {POST_PLATFORMS.map((p) => {
            const active = platforms.includes(p.key)
            return (
              <button
                key={p.key}
                onClick={() => togglePlatform(p.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition ${
                  active
                    ? 'bg-brand-cyan/15 border-brand-cyan/60 text-white'
                    : 'bg-navy-900/40 border-navy-700/60 text-gray-400 hover:text-white'
                }`}
              >
                <div className={`h-5 w-5 ${p.color} rounded flex items-center justify-center text-[9px] font-bold text-white`}>{p.initials}</div>
                <span>{p.label}</span>
                {p.limit && <span className="text-[10px] text-gray-500">{p.limit}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <Input
        label="Media URLs (one per line)"
        rows={3}
        value={mediaText}
        onChange={setMediaText}
        placeholder="https://..."
      />

      <div className="mb-3">
        <span className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Schedule</span>
        <div className="flex gap-2 mb-2">
          <Chip active={scheduleMode === 'now'} onClick={() => setScheduleMode('now')}>Save as Draft</Chip>
          <Chip active={scheduleMode === 'later'} onClick={() => setScheduleMode('later')}>Schedule for...</Chip>
        </div>
        {scheduleMode === 'later' && (
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
          />
        )}
      </div>
    </Modal>
  )
}

// ---------- Post Drawer ----------
function PostDrawer({ post, onClose, client, onChanged }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (post) setForm({
      content: post.content || '',
      status: post.status || 'draft',
      scheduled_for: post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : '',
    })
  }, [post])

  if (!post) return null

  async function save() {
    setSaving(true)
    try {
      const payload = {
        content: form.content || null,
        status: form.status,
        scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
      }
      const { error } = await client.from('marketing_posts').update(payload).eq('id', post.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[PostDrawer] save', e)
      alert('Could not save post: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function duplicate() {
    setSaving(true)
    try {
      const payload = {
        content: post.content,
        platforms: post.platforms,
        media_urls: post.media_urls,
        status: 'draft',
        ai_generated: post.ai_generated,
      }
      const { error } = await client.from('marketing_posts').insert(payload)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[PostDrawer] duplicate', e)
      alert('Could not duplicate post: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function cancelPost() {
    setSaving(true)
    try {
      const { error } = await client.from('marketing_posts').update({ status: 'cancelled' }).eq('id', post.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[PostDrawer] cancel', e)
    } finally {
      setSaving(false)
    }
  }

  async function markPublished() {
    setSaving(true)
    try {
      const { error } = await client.from('marketing_posts').update({
        status: 'published',
        published_at: new Date().toISOString(),
      }).eq('id', post.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[PostDrawer] markPublished', e)
    } finally {
      setSaving(false)
    }
  }

  async function approve() {
    setSaving(true)
    try {
      const { error } = await client.from('marketing_posts').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      }).eq('id', post.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[PostDrawer] approve', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={!!post}
      onClose={onClose}
      title="Edit Post"
      footer={
        <div className="flex flex-wrap gap-2 justify-end">
          {post.status === 'pending_approval' && (
            <button onClick={approve} disabled={saving} className="text-sm px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30">Approve</button>
          )}
          <button onClick={duplicate} disabled={saving} className="text-sm px-3 py-1.5 rounded-lg bg-navy-700/60 text-gray-300 hover:text-white">Duplicate</button>
          {post.status !== 'published' && post.status !== 'cancelled' && (
            <button onClick={cancelPost} disabled={saving} className="text-sm px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25">Cancel</button>
          )}
          {post.status !== 'published' && (
            <button onClick={markPublished} disabled={saving} className="text-sm px-3 py-1.5 rounded-lg bg-brand-blue/20 text-brand-blue border border-brand-blue/40 hover:bg-brand-blue/30">Mark Published</button>
          )}
          <button onClick={save} disabled={saving} className="text-sm px-4 py-1.5 rounded-lg bg-brand-cyan text-navy-900 font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={post.status} />
          {post.ai_generated && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-brand-blue/20 text-brand-blue">AI</span>}
          {(post.platforms || []).map((k) => <PlatformBadge key={k} k={k} size="sm" />)}
        </div>
        {(post.media_urls || []).length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {(post.media_urls || []).slice(0, 4).map((url, i) => (
              <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg border border-navy-700/50" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            ))}
          </div>
        )}
        <Input label="Content" rows={6} value={form.content} onChange={(v) => setForm({ ...form, content: v })} />
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => setForm({ ...form, status: v })}
          options={POST_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
        />
        <Input
          label="Scheduled For"
          type="datetime-local"
          value={form.scheduled_for}
          onChange={(v) => setForm({ ...form, scheduled_for: v })}
        />
        <div className="text-[11px] text-gray-500">
          Created {relTime(post.created_at)} - id <code className="text-gray-400">{post.id.slice(0, 8)}</code>
        </div>
      </div>
    </Drawer>
  )
}

// =====================================================================
// TAB: CAMPAIGNS
// =====================================================================
function CampaignsTab({ campaigns, loading, onOpenNew, onRow }) {
  return (
    <Section
      title="Campaigns"
      right={
        <button
          onClick={onOpenNew}
          className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg"
        >
          + New Campaign
        </button>
      }
    >
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns running"
          description="Pick a goal, set a budget, ship the first ad. Track every dollar back to a customer."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + New Campaign
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider bg-navy-900/30">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Channel</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Start</th>
                <th className="text-left px-4 py-2">End</th>
                <th className="text-right px-4 py-2">Spend</th>
                <th className="text-right px-4 py-2">Impr</th>
                <th className="text-right px-4 py-2">Clicks</th>
                <th className="text-right px-4 py-2">Conv</th>
                <th className="text-right px-4 py-2">Revenue</th>
                <th className="text-right px-4 py-2">CTR</th>
                <th className="text-right px-4 py-2">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {campaigns.map((c) => {
                const spend = Number(c.spend_cents || 0)
                const impressions = Number(c.impressions || 0)
                const clicks = Number(c.clicks || 0)
                const conv = Number(c.conversions || 0)
                const revenue = Number(c.revenue_cents || 0)
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
                const roas = spend > 0 ? revenue / spend : 0
                return (
                  <tr key={c.id} onClick={() => onRow(c)} className="cursor-pointer hover:bg-navy-700/30">
                    <td className="px-4 py-2 text-white">{c.name || '-'}</td>
                    <td className="px-4 py-2 text-gray-300 capitalize">{(c.channel || '-').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-2 text-gray-500">{fmtDate(c.start_date)}</td>
                    <td className="px-4 py-2 text-gray-500">{fmtDate(c.end_date)}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{fmtCents(spend)}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{impressions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{clicks.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{conv.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-emerald-400">{fmtCents(revenue)}</td>
                    <td className="px-4 py-2 text-right text-gray-300">{fmtPct(ctr)}</td>
                    <td className={`px-4 py-2 text-right ${roas >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>{roas.toFixed(2)}x</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function NewCampaignModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm({ status: 'draft', channel: 'paid_social' }) }, [open])

  async function submit() {
    if (!client) return
    setSaving(true)
    try {
      const payload = {
        name: form.name || null,
        channel: form.channel || null,
        status: form.status || 'draft',
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget_cents: form.budget ? Math.round(Number(form.budget) * 100) : null,
        goal: form.goal || null,
        notes: form.notes || null,
      }
      const { error } = await client.from('marketing_campaigns').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewCampaignModal] submit', e)
      alert('Could not save campaign: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Campaign"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Campaign'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Spring HVAC Push" />
        <Select label="Channel" value={form.channel} onChange={(v) => setForm({ ...form, channel: v })} options={CHANNELS.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }))} />
        <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: s }))} />
        <Input label="Budget (USD)" type="number" value={form.budget} onChange={(v) => setForm({ ...form, budget: v })} />
        <Input label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
        <Input label="End Date" type="date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
      </div>
      <Input label="Goal" value={form.goal} onChange={(v) => setForm({ ...form, goal: v })} placeholder="20 booked estimates" />
      <Input label="Notes" rows={3} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
    </Modal>
  )
}

function CampaignDrawer({ campaign, onClose, client, adSpend, onChanged }) {
  const [form, setForm] = useState({})
  const [drawerTab, setDrawerTab] = useState('overview')
  const [logSpendOpen, setLogSpendOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (campaign) setForm({
      name: campaign.name || '',
      channel: campaign.channel || '',
      status: campaign.status || 'draft',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
      budget: campaign.budget_cents ? (Number(campaign.budget_cents) / 100).toString() : '',
      goal: campaign.goal || '',
      notes: campaign.notes || '',
    })
  }, [campaign])

  const myRows = useMemo(() => {
    if (!campaign) return []
    return adSpend.filter((r) => r.campaign_id === campaign.id)
  }, [adSpend, campaign])

  if (!campaign) return null

  async function save() {
    setSaving(true)
    try {
      const payload = {
        name: form.name || null,
        channel: form.channel || null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget_cents: form.budget ? Math.round(Number(form.budget) * 100) : null,
        goal: form.goal || null,
        notes: form.notes || null,
      }
      const { error } = await client.from('marketing_campaigns').update(payload).eq('id', campaign.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[CampaignDrawer] save', e)
      alert('Could not save campaign: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Drawer
        open={!!campaign}
        onClose={onClose}
        title={campaign.name || 'Campaign'}
        footer={
          drawerTab === 'overview' ? (
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Close</button>
              <button onClick={save} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button onClick={() => setLogSpendOpen(true)} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
                + Log Ad Spend
              </button>
            </div>
          )
        }
      >
        <div className="flex gap-2 mb-4 border-b border-navy-700/50">
          <button
            onClick={() => setDrawerTab('overview')}
            className={`px-3 py-2 text-sm border-b-2 ${drawerTab === 'overview' ? 'border-brand-cyan text-brand-cyan' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setDrawerTab('spend')}
            className={`px-3 py-2 text-sm border-b-2 ${drawerTab === 'spend' ? 'border-brand-cyan text-brand-cyan' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            Ad Spend ({myRows.length})
          </button>
        </div>

        {drawerTab === 'overview' && (
          <div>
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Select label="Channel" value={form.channel} onChange={(v) => setForm({ ...form, channel: v })} options={CHANNELS.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }))} />
            <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: s }))} />
            <Input label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
            <Input label="End Date" type="date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
            <Input label="Budget (USD)" type="number" value={form.budget} onChange={(v) => setForm({ ...form, budget: v })} />
            <Input label="Goal" value={form.goal} onChange={(v) => setForm({ ...form, goal: v })} />
            <Input label="Notes" rows={3} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          </div>
        )}

        {drawerTab === 'spend' && (
          <div>
            <div className="bg-navy-900/40 border border-dashed border-navy-700/60 rounded-lg p-4 mb-3 text-center">
              <div className="text-sm text-gray-300 mb-1">Performance charts</div>
              <div className="text-[11px] text-gray-500">Trend lines and per-platform breakdowns ship in Wave F.</div>
            </div>
            {myRows.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-6">No ad spend logged yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] text-gray-500 uppercase tracking-wider bg-navy-900/30">
                    <tr>
                      <th className="text-left px-2 py-1">Date</th>
                      <th className="text-left px-2 py-1">Platform</th>
                      <th className="text-right px-2 py-1">Spend</th>
                      <th className="text-right px-2 py-1">Impr</th>
                      <th className="text-right px-2 py-1">Clicks</th>
                      <th className="text-right px-2 py-1">Conv</th>
                      <th className="text-right px-2 py-1">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {myRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-2 py-1 text-gray-300">{fmtDate(r.date)}</td>
                        <td className="px-2 py-1 text-gray-300">{r.platform || '-'}</td>
                        <td className="px-2 py-1 text-right text-gray-300">{fmtCents(r.spend_cents)}</td>
                        <td className="px-2 py-1 text-right text-gray-300">{Number(r.impressions || 0).toLocaleString()}</td>
                        <td className="px-2 py-1 text-right text-gray-300">{Number(r.clicks || 0).toLocaleString()}</td>
                        <td className="px-2 py-1 text-right text-gray-300">{Number(r.conversions || 0).toLocaleString()}</td>
                        <td className="px-2 py-1 text-right text-emerald-400">{fmtCents(r.revenue_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <LogAdSpendModal
        open={logSpendOpen}
        onClose={() => setLogSpendOpen(false)}
        client={client}
        campaignId={campaign.id}
        onSaved={() => { setLogSpendOpen(false); onChanged() }}
      />
    </>
  )
}

function LogAdSpendModal({ open, onClose, client, campaignId, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm({ date: new Date().toISOString().slice(0, 10) }) }, [open])

  async function submit() {
    if (!client) return
    setSaving(true)
    try {
      const payload = {
        campaign_id: campaignId,
        date: form.date || null,
        platform: form.platform || null,
        spend_cents: form.spend ? Math.round(Number(form.spend) * 100) : 0,
        impressions: form.impressions ? Number(form.impressions) : 0,
        clicks: form.clicks ? Number(form.clicks) : 0,
        conversions: form.conversions ? Number(form.conversions) : 0,
        revenue_cents: form.revenue ? Math.round(Number(form.revenue) * 100) : 0,
        notes: form.notes || null,
      }
      const { error } = await client.from('marketing_ad_spend').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[LogAdSpendModal] submit', e)
      alert('Could not log ad spend: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log Ad Spend"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Log Entry'}
          </button>
        </div>
      }
    >
      <Input label="Platform" value={form.platform} onChange={(v) => setForm({ ...form, platform: v })} placeholder="Facebook, Google, Instagram..." />
      <Input label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
      <Input label="Spend (USD)" type="number" value={form.spend} onChange={(v) => setForm({ ...form, spend: v })} />
      <Input label="Impressions" type="number" value={form.impressions} onChange={(v) => setForm({ ...form, impressions: v })} />
      <Input label="Clicks" type="number" value={form.clicks} onChange={(v) => setForm({ ...form, clicks: v })} />
      <Input label="Conversions" type="number" value={form.conversions} onChange={(v) => setForm({ ...form, conversions: v })} />
      <Input label="Revenue (USD)" type="number" value={form.revenue} onChange={(v) => setForm({ ...form, revenue: v })} />
      <Input label="Notes" rows={2} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
    </Modal>
  )
}

// =====================================================================
// TAB: GOALS
// =====================================================================
function GoalsTab({ goals, loading, onOpenNew, onCard }) {
  return (
    <Section
      title="Goals"
      right={
        <button
          onClick={onOpenNew}
          className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg"
        >
          + New Goal
        </button>
      }
    >
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading goals...</div>
      ) : goals.length === 0 ? (
        <EmptyState
          title="No goals set"
          description="Pick a number that matters - bookings, MRR, qualified leads - and ship to it."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + Set a Goal
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {goals.map((g) => {
            const current = Number(g.current_value || 0)
            const target = Number(g.target_value || 0)
            const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
            return (
              <button
                key={g.id}
                onClick={() => onCard(g)}
                className="text-left bg-navy-900/40 border border-navy-700/50 rounded-xl p-4 hover:border-brand-cyan/40 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-sm text-white font-medium">{g.name || '(unnamed)'}</div>
                  <StatusBadge status={g.status} />
                </div>
                <div className="text-[11px] text-gray-500 mb-2">
                  {fmtDate(g.period_start)} - {fmtDate(g.period_end)}
                </div>
                <div className="h-2 w-full bg-navy-900 rounded-full overflow-hidden mb-2">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-brand-cyan' : pct >= 50 ? 'bg-brand-blue' : pct >= 25 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-medium">{current.toLocaleString()} / {target.toLocaleString()} {g.unit || ''}</span>
                  <span className="text-brand-cyan">{pct.toFixed(0)}%</span>
                </div>
                {g.metric && (
                  <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{g.metric}</div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </Section>
  )
}

function NewGoalModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm({ status: 'on_track', current_value: 0 }) }, [open])

  async function submit() {
    setSaving(true)
    try {
      const payload = {
        name: form.name || null,
        metric: form.metric || null,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        target_value: form.target_value ? Number(form.target_value) : null,
        current_value: form.current_value ? Number(form.current_value) : 0,
        unit: form.unit || null,
        status: form.status || 'on_track',
        notes: form.notes || null,
      }
      const { error } = await client.from('marketing_goals').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewGoalModal] submit', e)
      alert('Could not save goal: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Goal"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Goal'}
          </button>
        </div>
      }
    >
      <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Q3 Booked Jobs" />
      <Input label="Metric" value={form.metric} onChange={(v) => setForm({ ...form, metric: v })} placeholder="booked_jobs, mrr, leads..." />
      <Input label="Target" type="number" value={form.target_value} onChange={(v) => setForm({ ...form, target_value: v })} />
      <Input label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="jobs, leads, dollars..." />
      <Input label="Period Start" type="date" value={form.period_start} onChange={(v) => setForm({ ...form, period_start: v })} />
      <Input label="Period End" type="date" value={form.period_end} onChange={(v) => setForm({ ...form, period_end: v })} />
      <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={GOAL_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
      <Input label="Notes" rows={3} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
    </Modal>
  )
}

function GoalDrawer({ goal, onClose, client, onChanged }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (goal) setForm({
      name: goal.name || '',
      metric: goal.metric || '',
      period_start: goal.period_start || '',
      period_end: goal.period_end || '',
      target_value: goal.target_value != null ? String(goal.target_value) : '',
      current_value: goal.current_value != null ? String(goal.current_value) : '',
      unit: goal.unit || '',
      status: goal.status || 'on_track',
      notes: goal.notes || '',
    })
  }, [goal])

  if (!goal) return null

  async function save() {
    setSaving(true)
    try {
      const payload = {
        name: form.name || null,
        metric: form.metric || null,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        target_value: form.target_value ? Number(form.target_value) : null,
        current_value: form.current_value ? Number(form.current_value) : 0,
        unit: form.unit || null,
        status: form.status,
        notes: form.notes || null,
      }
      const { error } = await client.from('marketing_goals').update(payload).eq('id', goal.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[GoalDrawer] save', e)
      alert('Could not save goal: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={!!goal}
      onClose={onClose}
      title={goal.name || 'Goal'}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Close</button>
          <button onClick={save} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <Input label="Metric" value={form.metric} onChange={(v) => setForm({ ...form, metric: v })} />
      <Input label="Current Value" type="number" value={form.current_value} onChange={(v) => setForm({ ...form, current_value: v })} />
      <Input label="Target" type="number" value={form.target_value} onChange={(v) => setForm({ ...form, target_value: v })} />
      <Input label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
      <Input label="Period Start" type="date" value={form.period_start} onChange={(v) => setForm({ ...form, period_start: v })} />
      <Input label="Period End" type="date" value={form.period_end} onChange={(v) => setForm({ ...form, period_end: v })} />
      <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={GOAL_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
      <Input label="Notes" rows={3} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
    </Drawer>
  )
}

// =====================================================================
// TAB: SEO KEYWORDS
// =====================================================================
function SeoTab({ keywords, loading, onOpenNew, onOpenBulk, onChanged, client }) {
  const [sortKey, setSortKey] = useState('priority')
  const [sortDir, setSortDir] = useState('desc')

  function setSort(k) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    const arr = keywords.slice()
    const order = { high: 3, medium: 2, low: 1 }
    arr.sort((a, b) => {
      let av = a[sortKey]
      let bv = b[sortKey]
      if (sortKey === 'priority') {
        av = order[av] || 0
        bv = order[bv] || 0
      }
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [keywords, sortKey, sortDir])

  function HeaderCell({ k, children, align = 'left' }) {
    return (
      <th className={`text-${align} px-4 py-2 cursor-pointer select-none`} onClick={() => setSort(k)}>
        {children}
        {sortKey === k && <span className="ml-1 text-brand-cyan">{sortDir === 'asc' ? '^' : 'v'}</span>}
      </th>
    )
  }

  return (
    <Section
      title="SEO Keywords"
      right={
        <div className="flex gap-2">
          <button
            onClick={onOpenBulk}
            className="bg-navy-700/60 hover:bg-navy-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg"
          >
            Bulk Import
          </button>
          <button
            onClick={onOpenNew}
            className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg"
          >
            + New Keyword
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading keywords...</div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No SEO keywords tracked"
          description="Drop in the search terms your customers actually type. Watch your rank climb."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + Add Keyword
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider bg-navy-900/30">
              <tr>
                <HeaderCell k="keyword">Keyword</HeaderCell>
                <HeaderCell k="target_url">Target URL</HeaderCell>
                <HeaderCell k="search_volume" align="right">Volume</HeaderCell>
                <HeaderCell k="difficulty" align="right">Difficulty</HeaderCell>
                <HeaderCell k="current_rank" align="right">Rank</HeaderCell>
                <HeaderCell k="best_rank" align="right">Best</HeaderCell>
                <HeaderCell k="priority">Priority</HeaderCell>
                <th className="text-left px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {sorted.map((k) => (
                <tr key={k.id} className="hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-white">{k.keyword || '-'}</td>
                  <td className="px-4 py-2 text-gray-300 truncate max-w-[260px]">{k.target_url || '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{k.search_volume != null ? Number(k.search_volume).toLocaleString() : '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{k.difficulty != null ? k.difficulty : '-'}</td>
                  <td className="px-4 py-2 text-right text-brand-cyan">{k.current_rank != null ? k.current_rank : '-'}</td>
                  <td className="px-4 py-2 text-right text-emerald-400">{k.best_rank != null ? k.best_rank : '-'}</td>
                  <td className="px-4 py-2 text-gray-300 capitalize">{k.priority || '-'}</td>
                  <td className="px-4 py-2 text-gray-500 truncate max-w-[200px]">{k.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function NewKeywordModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm({ priority: 'medium' }) }, [open])

  async function submit() {
    setSaving(true)
    try {
      const payload = {
        keyword: form.keyword || null,
        target_url: form.target_url || null,
        search_volume: form.search_volume ? Number(form.search_volume) : null,
        difficulty: form.difficulty ? Number(form.difficulty) : null,
        current_rank: form.current_rank ? Number(form.current_rank) : null,
        best_rank: form.best_rank ? Number(form.best_rank) : null,
        priority: form.priority || 'medium',
        notes: form.notes || null,
      }
      const { error } = await client.from('marketing_seo_keywords').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewKeywordModal] submit', e)
      alert('Could not save keyword: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New SEO Keyword"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Keyword'}
          </button>
        </div>
      }
    >
      <Input label="Keyword" value={form.keyword} onChange={(v) => setForm({ ...form, keyword: v })} placeholder="emergency plumbing jacksonville" />
      <Input label="Target URL" value={form.target_url} onChange={(v) => setForm({ ...form, target_url: v })} placeholder="https://yoursite.com/services/emergency" />
      <Input label="Search Volume" type="number" value={form.search_volume} onChange={(v) => setForm({ ...form, search_volume: v })} />
      <Input label="Difficulty (0-100)" type="number" value={form.difficulty} onChange={(v) => setForm({ ...form, difficulty: v })} />
      <Input label="Current Rank" type="number" value={form.current_rank} onChange={(v) => setForm({ ...form, current_rank: v })} />
      <Input label="Best Rank" type="number" value={form.best_rank} onChange={(v) => setForm({ ...form, best_rank: v })} />
      <Select label="Priority" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={SEO_PRIORITIES.map((s) => ({ value: s, label: s }))} />
      <Input label="Notes" rows={2} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
    </Modal>
  )
}

function BulkKeywordModal({ open, onClose, client, onSaved }) {
  const [text, setText] = useState('')
  const [priority, setPriority] = useState('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setText(''); setPriority('medium') } }, [open])

  const previewCount = useMemo(() => {
    return text.split('\n').map((l) => l.trim()).filter(Boolean).length
  }, [text])

  async function submit() {
    setSaving(true)
    try {
      const rows = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [keyword, target_url] = line.split('|').map((s) => s.trim())
          return {
            keyword: keyword || null,
            target_url: target_url || null,
            priority,
          }
        })
        .filter((r) => r.keyword)
      if (rows.length === 0) {
        alert('No keywords parsed.')
        setSaving(false)
        return
      }
      const { error } = await client.from('marketing_seo_keywords').insert(rows)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[BulkKeywordModal] submit', e)
      alert('Could not bulk import: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk Import Keywords"
      wide
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{previewCount} keyword{previewCount === 1 ? '' : 's'} ready</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
            <button onClick={submit} disabled={saving || previewCount === 0} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
              {saving ? 'Importing...' : `Import ${previewCount}`}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-xs text-gray-400 mb-2">
        One per line. Format: <code className="text-brand-cyan">keyword | target_url</code> (URL optional).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={'emergency plumbing jacksonville | https://yoursite.com/emergency\nhvac repair near me\nwater heater install duval county | https://yoursite.com/water-heater'}
        className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-brand-cyan"
      />
      <Select label="Default Priority" value={priority} onChange={setPriority} options={SEO_PRIORITIES.map((s) => ({ value: s, label: s }))} />
    </Modal>
  )
}

// =====================================================================
// TAB: UTM LINKS
// =====================================================================
function UtmTab({ links, loading, onOpenNew, onRow }) {
  const [copied, setCopied] = useState(null)

  function copyUrl(url, id) {
    navigator.clipboard?.writeText(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Section
      title="UTM Links"
      right={
        <button
          onClick={onOpenNew}
          className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg"
        >
          + Build UTM
        </button>
      }
    >
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading links...</div>
      ) : links.length === 0 ? (
        <EmptyState
          title="No tracked links yet"
          description="Build a UTM the right way once - reuse it everywhere. Every campaign gets attributed."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + Build UTM
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider bg-navy-900/30">
              <tr>
                <th className="text-left px-4 py-2">Label</th>
                <th className="text-left px-4 py-2">Destination</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2">Medium</th>
                <th className="text-left px-4 py-2">Campaign</th>
                <th className="text-left px-4 py-2">Short</th>
                <th className="text-right px-4 py-2">Clicks</th>
                <th className="text-left px-4 py-2">Created</th>
                <th className="text-right px-4 py-2">Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {links.map((u) => (
                <tr key={u.id} className="hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-white cursor-pointer" onClick={() => onRow(u)}>{u.label || '-'}</td>
                  <td className="px-4 py-2 text-gray-300 truncate max-w-[220px] cursor-pointer" onClick={() => onRow(u)}>{u.destination_url || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{u.utm_source || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{u.utm_medium || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{u.utm_campaign || '-'}</td>
                  <td className="px-4 py-2 text-brand-cyan font-mono text-xs">{u.short_code || '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{Number(u.click_count || 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-2 text-right">
                    {u.full_url && (
                      <button
                        onClick={() => copyUrl(u.full_url, u.id)}
                        className={`text-xs px-2 py-1 rounded ${copied === u.id ? 'bg-emerald-500/20 text-emerald-300' : 'bg-navy-700/60 text-gray-300 hover:text-white'}`}
                      >
                        {copied === u.id ? 'Copied!' : 'Copy'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function buildFullUrl(destination, params) {
  if (!destination) return ''
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  if (!qs) return destination
  return destination.includes('?') ? `${destination}&${qs}` : `${destination}?${qs}`
}

function NewUtmModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm({}) }, [open])

  const params = {
    utm_source: form.utm_source,
    utm_medium: form.utm_medium,
    utm_campaign: form.utm_campaign,
    utm_term: form.utm_term,
    utm_content: form.utm_content,
  }
  const preview = buildFullUrl(form.destination_url || '', params)

  async function submit() {
    setSaving(true)
    try {
      const short = randCode(6)
      const payload = {
        label: form.label || null,
        destination_url: form.destination_url || null,
        utm_source: form.utm_source || null,
        utm_medium: form.utm_medium || null,
        utm_campaign: form.utm_campaign || null,
        utm_term: form.utm_term || null,
        utm_content: form.utm_content || null,
        full_url: preview || null,
        short_code: short,
        click_count: 0,
      }
      const { error } = await client.from('marketing_utm_links').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewUtmModal] submit', e)
      alert('Could not save UTM link: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Build UTM Link"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving || !form.destination_url} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Link'}
          </button>
        </div>
      }
    >
      <Input label="Label" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Spring Mailer Card" />
      <Input label="Destination URL" value={form.destination_url} onChange={(v) => setForm({ ...form, destination_url: v })} placeholder="https://yoursite.com/landing" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="utm_source" value={form.utm_source} onChange={(v) => setForm({ ...form, utm_source: v })} placeholder="facebook, google, mailer" />
        <Input label="utm_medium" value={form.utm_medium} onChange={(v) => setForm({ ...form, utm_medium: v })} placeholder="cpc, email, qr" />
        <Input label="utm_campaign" value={form.utm_campaign} onChange={(v) => setForm({ ...form, utm_campaign: v })} placeholder="spring_hvac" />
        <Input label="utm_term" value={form.utm_term} onChange={(v) => setForm({ ...form, utm_term: v })} />
        <Input label="utm_content" value={form.utm_content} onChange={(v) => setForm({ ...form, utm_content: v })} placeholder="postcard_v1" />
      </div>

      {preview && (
        <div className="bg-navy-900/60 border border-navy-700/50 rounded-lg p-3 text-xs">
          <div className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Preview Full URL</div>
          <code className="text-brand-cyan break-all">{preview}</code>
        </div>
      )}
    </Modal>
  )
}

function UtmDrawer({ link, onClose }) {
  if (!link) return null
  return (
    <Drawer
      open={!!link}
      onClose={onClose}
      title={link.label || link.short_code || 'UTM Link'}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Close</button>
        </div>
      }
    >
      <DetailRow label="Label" value={link.label} />
      <DetailRow label="Destination" value={link.destination_url} mono />
      <DetailRow label="Full URL" value={link.full_url} mono />
      <DetailRow label="Short Code" value={link.short_code} mono />
      <DetailRow label="Source" value={link.utm_source} />
      <DetailRow label="Medium" value={link.utm_medium} />
      <DetailRow label="Campaign" value={link.utm_campaign} />
      <DetailRow label="Term" value={link.utm_term} />
      <DetailRow label="Content" value={link.utm_content} />
      <DetailRow label="Clicks" value={Number(link.click_count || 0).toLocaleString()} />
      <DetailRow label="Created" value={fmtDateTime(link.created_at)} />

      <div className="mt-6 bg-navy-900/40 border border-dashed border-navy-700/60 rounded-lg p-4 text-center">
        <div className="text-sm text-gray-300 mb-1">QR Code</div>
        <div className="text-[11px] text-gray-500">QR generation ships in Wave F.</div>
      </div>
    </Drawer>
  )
}

function DetailRow({ label, value, mono }) {
  if (value == null || value === '') return null
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b border-navy-700/40 last:border-b-0">
      <div className="text-xs text-gray-500 uppercase tracking-wider col-span-1">{label}</div>
      <div className={`text-sm col-span-2 break-all ${mono ? 'font-mono text-brand-cyan' : 'text-white'}`}>{value}</div>
    </div>
  )
}