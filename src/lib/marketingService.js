/**
 * marketingService — Full CRUD + helpers for the Liftori Marketing Hub.
 *
 * Backed by 10 marketing_* tables:
 *   marketing_utm_links, marketing_campaigns, marketing_ad_spend,
 *   marketing_seo_keywords, marketing_seo_rank_history, marketing_mentions,
 *   marketing_goals, marketing_ab_tests, marketing_ab_variants, marketing_segments
 *
 * Access is gated by `has_marketing_access()` (admin/dev/marketer/sales_rep).
 */
import { supabase } from './supabase'

// ─── Catalogs ───────────────────────────────────────────────────────
export const CAMPAIGN_CHANNELS = [
  { key: 'google_ads',   label: 'Google Ads',   color: 'sky' },
  { key: 'meta_ads',     label: 'Meta Ads',     color: 'blue' },
  { key: 'tiktok_ads',   label: 'TikTok Ads',   color: 'rose' },
  { key: 'linkedin_ads', label: 'LinkedIn Ads', color: 'indigo' },
  { key: 'twitter_ads',  label: 'X / Twitter Ads', color: 'slate' },
  { key: 'youtube_ads',  label: 'YouTube Ads',  color: 'red' },
  { key: 'email',        label: 'Email',        color: 'violet' },
  { key: 'content',      label: 'Content / Blog', color: 'emerald' },
  { key: 'seo',          label: 'SEO',          color: 'teal' },
  { key: 'referral',     label: 'Referral',     color: 'amber' },
  { key: 'event',        label: 'Event',        color: 'orange' },
  { key: 'podcast',      label: 'Podcast',      color: 'purple' },
  { key: 'influencer',   label: 'Influencer',   color: 'pink' },
  { key: 'direct_mail',  label: 'Direct Mail',  color: 'stone' },
  { key: 'other',        label: 'Other',        color: 'gray' },
]

export const AD_PLATFORMS = [
  { key: 'google_ads',   label: 'Google Ads' },
  { key: 'meta_ads',     label: 'Meta Ads' },
  { key: 'tiktok_ads',   label: 'TikTok Ads' },
  { key: 'linkedin_ads', label: 'LinkedIn Ads' },
  { key: 'twitter_ads',  label: 'X / Twitter Ads' },
  { key: 'youtube_ads',  label: 'YouTube Ads' },
  { key: 'other',        label: 'Other' },
]

export const CAMPAIGN_STATUSES = [
  { key: 'draft',     label: 'Draft',     color: 'slate' },
  { key: 'active',    label: 'Active',    color: 'emerald' },
  { key: 'paused',    label: 'Paused',    color: 'amber' },
  { key: 'completed', label: 'Completed', color: 'sky' },
  { key: 'archived',  label: 'Archived',  color: 'gray' },
]

export const GOAL_METRICS = [
  { key: 'new_signups',           label: 'New Signups',          unit: 'count' },
  { key: 'new_customers',         label: 'New Customers',        unit: 'count' },
  { key: 'mrr_cents',             label: 'MRR',                  unit: 'cents' },
  { key: 'revenue_cents',         label: 'Revenue',              unit: 'cents' },
  { key: 'website_traffic',       label: 'Website Traffic',      unit: 'count' },
  { key: 'campaign_conversions',  label: 'Campaign Conversions', unit: 'count' },
  { key: 'email_opens',           label: 'Email Opens',          unit: 'count' },
  { key: 'email_clicks',          label: 'Email Clicks',         unit: 'count' },
  { key: 'social_followers',      label: 'Social Followers',     unit: 'count' },
  { key: 'content_published',     label: 'Content Published',    unit: 'count' },
  { key: 'leads',                 label: 'Leads',                unit: 'count' },
  { key: 'demos_booked',          label: 'Demos Booked',         unit: 'count' },
  { key: 'trials_started',        label: 'Trials Started',       unit: 'count' },
  { key: 'custom',                label: 'Custom',               unit: 'count' },
]

export const MENTION_PLATFORMS = [
  'x','reddit','linkedin','facebook','instagram','youtube','tiktok','blog','press','podcast','forum','other',
]

export const SENTIMENTS = [
  { key: 'positive', label: 'Positive', color: 'emerald' },
  { key: 'neutral',  label: 'Neutral',  color: 'slate' },
  { key: 'negative', label: 'Negative', color: 'rose' },
]

export const CONTENT_PLATFORMS = [
  'x','linkedin','instagram','tiktok','youtube','facebook','blog','email','podcast','threads',
]

export const CONTENT_STATUSES = [
  { key: 'idea',       label: 'Idea',       color: 'slate' },
  { key: 'draft',      label: 'Draft',      color: 'blue' },
  { key: 'in_review',  label: 'In Review',  color: 'amber' },
  { key: 'approved',   label: 'Approved',   color: 'indigo' },
  { key: 'scheduled',  label: 'Scheduled',  color: 'violet' },
  { key: 'published',  label: 'Published',  color: 'emerald' },
  { key: 'archived',   label: 'Archived',   color: 'gray' },
]

export const AB_METRICS = [
  { key: 'click_rate',          label: 'Click Rate' },
  { key: 'conversion_rate',     label: 'Conversion Rate' },
  { key: 'signup_rate',         label: 'Signup Rate' },
  { key: 'bounce_rate',         label: 'Bounce Rate' },
  { key: 'time_on_page',        label: 'Time on Page' },
  { key: 'revenue_per_visitor', label: 'Revenue / Visitor' },
]

export const SEGMENT_SOURCES = [
  { key: 'profiles',              label: 'All Users (profiles)' },
  { key: 'waitlist_signups',      label: 'Waitlist Signups' },
  { key: 'affiliate_enrollments', label: 'Affiliates' },
  { key: 'tester_enrollments',    label: 'Testers' },
  { key: 'customer_pipeline',     label: 'Customer Pipeline' },
  { key: 'labos_signups',         label: 'LABOS Signups' },
  { key: 'email_subscribers',     label: 'Email Subscribers' },
]

// ─── Money helpers ──────────────────────────────────────────────────
export function formatMoney(cents) {
  const n = Number(cents || 0) / 100
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function formatMoneyPrecise(cents) {
  const n = Number(cents || 0) / 100
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPct(value, decimals = 1) {
  if (value == null || isNaN(value)) return '—'
  return `${Number(value).toFixed(decimals)}%`
}

export function formatInt(n) {
  return Number(n || 0).toLocaleString('en-US')
}

// ─── KPI derivation ─────────────────────────────────────────────────
export function deriveKPIs({ spend_cents = 0, impressions = 0, clicks = 0, conversions = 0, revenue_cents = 0, budget_cents = 0 } = {}) {
  const spend = Number(spend_cents) || 0
  const rev = Number(revenue_cents) || 0
  const imp = Number(impressions) || 0
  const clk = Number(clicks) || 0
  const conv = Number(conversions) || 0
  const bud = Number(budget_cents) || 0
  return {
    cpl_cents:  conv > 0 ? Math.round(spend / conv) : null,
    cpc_cents:  clk  > 0 ? Math.round(spend / clk)  : null,
    cpm_cents:  imp  > 0 ? Math.round((spend / imp) * 1000) : null,
    ctr:        imp  > 0 ? (clk / imp) * 100 : null,            // percent
    conv_rate:  clk  > 0 ? (conv / clk) * 100 : null,           // percent
    roas:       spend > 0 ? rev / spend : null,                 // multiple
    profit_cents: rev - spend,
    budget_pct: bud  > 0 ? (spend / bud) * 100 : null,          // percent
  }
}

// ─── UTM Links ──────────────────────────────────────────────────────
export function buildUtmUrl({ destination_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content }) {
  if (!destination_url) return ''
  let url
  try { url = new URL(destination_url.trim()) } catch { return '' }
  const params = url.searchParams
  if (utm_source) params.set('utm_source', utm_source.trim())
  if (utm_medium) params.set('utm_medium', utm_medium.trim())
  if (utm_campaign) params.set('utm_campaign', utm_campaign.trim())
  if (utm_term) params.set('utm_term', utm_term.trim())
  if (utm_content) params.set('utm_content', utm_content.trim())
  return url.toString()
}

export function generateShortCode(len = 6) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export async function listUtmLinks() {
  const { data, error } = await supabase
    .from('marketing_utm_links')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createUtmLink(payload) {
  const full_url = buildUtmUrl(payload)
  const row = {
    label: payload.label,
    destination_url: payload.destination_url,
    utm_source: payload.utm_source,
    utm_medium: payload.utm_medium,
    utm_campaign: payload.utm_campaign,
    utm_term: payload.utm_term || null,
    utm_content: payload.utm_content || null,
    full_url,
    short_code: payload.short_code || generateShortCode(),
  }
  const { data, error } = await supabase
    .from('marketing_utm_links')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateUtmLink(id, patch) {
  if (patch.destination_url || patch.utm_source || patch.utm_medium || patch.utm_campaign || patch.utm_term || patch.utm_content) {
    const { data: existing } = await supabase.from('marketing_utm_links').select('*').eq('id', id).single()
    const merged = { ...existing, ...patch }
    patch.full_url = buildUtmUrl(merged)
  }
  const { data, error } = await supabase
    .from('marketing_utm_links').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteUtmLink(id) {
  const { error } = await supabase.from('marketing_utm_links').delete().eq('id', id)
  if (error) throw error
}

// ─── Marketing Campaigns ────────────────────────────────────────────
export async function listCampaigns({ channel, status } = {}) {
  let q = supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false })
  if (channel) q = q.eq('channel', channel)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getCampaign(id) {
  const { data, error } = await supabase.from('marketing_campaigns').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createCampaign(row) {
  const { data, error } = await supabase.from('marketing_campaigns').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateCampaign(id, patch) {
  const { data, error } = await supabase.from('marketing_campaigns').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteCampaign(id) {
  const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id)
  if (error) throw error
}

// ─── Ad Spend ───────────────────────────────────────────────────────
export async function listAdSpend({ campaign_id, platform, from, to } = {}) {
  let q = supabase.from('marketing_ad_spend').select('*').order('date', { ascending: false })
  if (campaign_id) q = q.eq('campaign_id', campaign_id)
  if (platform) q = q.eq('platform', platform)
  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createAdSpend(row) {
  const { data, error } = await supabase.from('marketing_ad_spend').insert(row).select().single()
  if (error) throw error
  return data
}

export async function deleteAdSpend(id) {
  const { error } = await supabase.from('marketing_ad_spend').delete().eq('id', id)
  if (error) throw error
}

// Roll ad_spend rows up by platform with derived KPIs
export function rollupAdSpendByPlatform(rows = []) {
  const map = new Map()
  for (const r of rows) {
    const k = r.platform
    const cur = map.get(k) || {
      platform: k, spend_cents: 0, impressions: 0, clicks: 0, conversions: 0, revenue_cents: 0,
    }
    cur.spend_cents += Number(r.spend_cents || 0)
    cur.impressions += Number(r.impressions || 0)
    cur.clicks += Number(r.clicks || 0)
    cur.conversions += Number(r.conversions || 0)
    cur.revenue_cents += Number(r.revenue_cents || 0)
    map.set(k, cur)
  }
  const arr = Array.from(map.values())
  return arr.map(r => ({ ...r, ...deriveKPIs(r) }))
}

// ─── SEO Keywords ───────────────────────────────────────────────────
export async function listSeoKeywords() {
  const { data, error } = await supabase
    .from('marketing_seo_keywords')
    .select('*')
    .order('priority', { ascending: false })
    .order('search_volume', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data || []
}

export async function createSeoKeyword(row) {
  const { data, error } = await supabase.from('marketing_seo_keywords').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateSeoKeyword(id, patch) {
  const { data, error } = await supabase.from('marketing_seo_keywords').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteSeoKeyword(id) {
  const { error } = await supabase.from('marketing_seo_keywords').delete().eq('id', id)
  if (error) throw error
}

export async function listRankHistory(keyword_id) {
  const { data, error } = await supabase
    .from('marketing_seo_rank_history')
    .select('*')
    .eq('keyword_id', keyword_id)
    .order('tracked_at', { ascending: true })
  if (error) throw error
  return data || []
}

// ─── Mentions / Social Listening ────────────────────────────────────
export async function listMentions({ sentiment, platform, needs_response, limit = 200 } = {}) {
  let q = supabase.from('marketing_mentions').select('*').order('mention_date', { ascending: false }).limit(limit)
  if (sentiment) q = q.eq('sentiment', sentiment)
  if (platform) q = q.eq('platform', platform)
  if (needs_response != null) q = q.eq('needs_response', needs_response)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createMention(row) {
  const { data, error } = await supabase.from('marketing_mentions').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateMention(id, patch) {
  const { data, error } = await supabase.from('marketing_mentions').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteMention(id) {
  const { error } = await supabase.from('marketing_mentions').delete().eq('id', id)
  if (error) throw error
}

// ─── Goals / On-Pace ────────────────────────────────────────────────
export async function listGoals({ status } = {}) {
  let q = supabase.from('marketing_goals').select('*').order('period_end', { ascending: true })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createGoal(row) {
  const { data, error } = await supabase.from('marketing_goals').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateGoal(id, patch) {
  const { data, error } = await supabase.from('marketing_goals').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteGoal(id) {
  const { error } = await supabase.from('marketing_goals').delete().eq('id', id)
  if (error) throw error
}

// On-pace math: given (period_start, period_end, target, current), return ideal-now and delta
export function onPaceProgress(goal) {
  const now = new Date()
  const start = new Date(goal.period_start)
  const end = new Date(goal.period_end)
  const totalDays = Math.max(1, (end - start) / 86400000)
  const daysElapsed = Math.min(totalDays, Math.max(0, (now - start) / 86400000))
  const timePct = (daysElapsed / totalDays) * 100
  const idealNow = Number(goal.target_value) * (daysElapsed / totalDays)
  const current = Number(goal.current_value || 0)
  const target = Number(goal.target_value || 0)
  const progressPct = target > 0 ? (current / target) * 100 : 0
  const onPace = current >= idealNow
  const paceDelta = current - idealNow
  return { timePct, progressPct, idealNow, onPace, paceDelta, daysElapsed, totalDays }
}

// ─── A/B Tests ──────────────────────────────────────────────────────
export async function listAbTests({ status } = {}) {
  let q = supabase.from('marketing_ab_tests').select('*, variants:marketing_ab_variants(*)').order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createAbTest(test, variants = []) {
  const { data: testRow, error: e1 } = await supabase.from('marketing_ab_tests').insert(test).select().single()
  if (e1) throw e1
  if (variants.length) {
    const rows = variants.map(v => ({ ...v, test_id: testRow.id }))
    const { error: e2 } = await supabase.from('marketing_ab_variants').insert(rows)
    if (e2) throw e2
  }
  return testRow
}

export async function updateAbTest(id, patch) {
  const { data, error } = await supabase.from('marketing_ab_tests').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteAbTest(id) {
  const { error } = await supabase.from('marketing_ab_tests').delete().eq('id', id)
  if (error) throw error
}

export async function updateAbVariant(id, patch) {
  const { data, error } = await supabase.from('marketing_ab_variants').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function addAbVariant(test_id, variant) {
  const { data, error } = await supabase.from('marketing_ab_variants').insert({ ...variant, test_id }).select().single()
  if (error) throw error
  return data
}

export async function deleteAbVariant(id) {
  const { error } = await supabase.from('marketing_ab_variants').delete().eq('id', id)
  if (error) throw error
}

// Pure stats helper (variant conv vs baseline)
export function variantStats(v) {
  const visitors = Number(v.visitors || 0)
  const conversions = Number(v.conversions || 0)
  const rate = visitors > 0 ? (conversions / visitors) * 100 : 0
  const revenue = Number(v.revenue_cents || 0)
  const rpv = visitors > 0 ? revenue / visitors : 0
  return { rate, rpv, visitors, conversions }
}

export function uplift(variant, baseline) {
  const a = variantStats(baseline)
  const b = variantStats(variant)
  if (!a.rate) return null
  return ((b.rate - a.rate) / a.rate) * 100
}

// ─── Audience Segments ──────────────────────────────────────────────
export async function listSegments() {
  const { data, error } = await supabase.from('marketing_segments').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createSegment(row) {
  const { data, error } = await supabase.from('marketing_segments').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateSegment(id, patch) {
  const { data, error } = await supabase.from('marketing_segments').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteSegment(id) {
  const { error } = await supabase.from('marketing_segments').delete().eq('id', id)
  if (error) throw error
}

// Refresh member count by running the filter against source_table
export async function refreshSegmentCount(segment) {
  let q = supabase.from(segment.source_table).select('*', { count: 'exact', head: true })
  const filters = Array.isArray(segment.filters) ? segment.filters : []
  for (const f of filters) {
    if (!f.field || !f.op) continue
    switch (f.op) {
      case 'eq':        q = q.eq(f.field, f.value); break
      case 'neq':       q = q.neq(f.field, f.value); break
      case 'gt':        q = q.gt(f.field, f.value); break
      case 'gte':       q = q.gte(f.field, f.value); break
      case 'lt':        q = q.lt(f.field, f.value); break
      case 'lte':       q = q.lte(f.field, f.value); break
      case 'ilike':     q = q.ilike(f.field, `%${f.value}%`); break
      case 'is_null':   q = q.is(f.field, null); break
      case 'is_not_null': q = q.not(f.field, 'is', null); break
      case 'in':        q = q.in(f.field, Array.isArray(f.value) ? f.value : String(f.value).split(',').map(s => s.trim())); break
      default: break
    }
  }
  const { count, error } = await q
  if (error) throw error
  await supabase
    .from('marketing_segments')
    .update({ member_count: count || 0, last_refreshed_at: new Date().toISOString() })
    .eq('id', segment.id)
  return count || 0
}

// ─── Hub Summary (for MarketingDashboard widget) ────────────────────
export async function getHubSummary() {
  const [
    { count: utmCount },
    { count: activeCampaigns },
    { count: keywords },
    { count: mentions },
    { count: openGoals },
    { count: runningTests },
    { count: segments },
  ] = await Promise.all([
    supabase.from('marketing_utm_links').select('*', { count: 'exact', head: true }),
    supabase.from('marketing_campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('marketing_seo_keywords').select('*', { count: 'exact', head: true }),
    supabase.from('marketing_mentions').select('*', { count: 'exact', head: true }),
    supabase.from('marketing_goals').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('marketing_ab_tests').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('marketing_segments').select('*', { count: 'exact', head: true }),
  ])
  return {
    utm_links: utmCount || 0,
    active_campaigns: activeCampaigns || 0,
    seo_keywords: keywords || 0,
    mentions: mentions || 0,
    open_goals: openGoals || 0,
    running_tests: runningTests || 0,
    segments: segments || 0,
  }
}

// ─── Content Drafts (creator_drafts) ────────────────────────────────
export async function listContentDrafts({ status, platform, q, scheduled } = {}) {
  let query = supabase.from('creator_drafts').select('*').order('updated_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (platform) query = query.eq('platform', platform)
  if (scheduled === true) query = query.not('scheduled_at', 'is', null)
  if (q) query = query.ilike('title', `%${q}%`)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createContentDraft(row) {
  const { data: { user } } = await supabase.auth.getUser()
  const payload = {
    user_id: user?.id,
    title: row.title || null,
    body: row.body || '',
    platform: row.platform || null,
    content_type: row.content_type || 'caption',
    template_key: row.template_key || null,
    hashtags: row.hashtags || [],
    tags: row.tags || [],
    status: row.status || 'draft',
    character_count: (row.body || '').length,
    scheduled_at: row.scheduled_at || null,
    scheduled_platform: row.scheduled_platform || null,
    notes: row.notes || null,
  }
  const { data, error } = await supabase.from('creator_drafts').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateContentDraft(id, patch) {
  if ('body' in patch) patch.character_count = (patch.body || '').length
  patch.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('creator_drafts').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteContentDraft(id) {
  const { error } = await supabase.from('creator_drafts').delete().eq('id', id)
  if (error) throw error
}

export async function listScheduledContent({ from, to } = {}) {
  let q = supabase.from('creator_drafts').select('*').not('scheduled_at', 'is', null).order('scheduled_at', { ascending: true })
  if (from) q = q.gte('scheduled_at', from)
  if (to) q = q.lte('scheduled_at', to)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// Aggregate all campaign KPIs
export async function summarizeCampaignPerformance({ from, to } = {}) {
  let q = supabase.from('marketing_campaigns').select('spend_cents, impressions, clicks, conversions, revenue_cents, budget_cents, channel, status')
  if (from) q = q.gte('start_date', from)
  if (to) q = q.lte('end_date', to)
  const { data, error } = await q
  if (error) throw error
  const rows = data || []
  const agg = rows.reduce((a, r) => ({
    spend_cents: a.spend_cents + Number(r.spend_cents || 0),
    impressions: a.impressions + Number(r.impressions || 0),
    clicks: a.clicks + Number(r.clicks || 0),
    conversions: a.conversions + Number(r.conversions || 0),
    revenue_cents: a.revenue_cents + Number(r.revenue_cents || 0),
    budget_cents: a.budget_cents + Number(r.budget_cents || 0),
    campaign_count: a.campaign_count + 1,
  }), { spend_cents: 0, impressions: 0, clicks: 0, conversions: 0, revenue_cents: 0, budget_cents: 0, campaign_count: 0 })
  const byChannel = new Map()
  for (const r of rows) {
    const cur = byChannel.get(r.channel) || { channel: r.channel, spend_cents: 0, clicks: 0, conversions: 0, revenue_cents: 0, impressions: 0, budget_cents: 0, count: 0 }
    cur.spend_cents += Number(r.spend_cents || 0)
    cur.clicks += Number(r.clicks || 0)
    cur.conversions += Number(r.conversions || 0)
    cur.revenue_cents += Number(r.revenue_cents || 0)
    cur.impressions += Number(r.impressions || 0)
    cur.budget_cents += Number(r.budget_cents || 0)
    cur.count += 1
    byChannel.set(r.channel, cur)
  }
  const channelRollup = Array.from(byChannel.values()).map(r => ({ ...r, ...deriveKPIs(r) }))
  return { total: { ...agg, ...deriveKPIs(agg) }, byChannel: channelRollup }
}

// ─── Email Campaigns ────────────────────────────────────────────────
// Backed by communication_campaigns + outbound_emails + email_subscribers
// communication_campaigns is the composer/campaign shell.
// outbound_emails is the send log (one row per recipient email).
// email_subscribers is the subscriber list for newsletter-style sends.

export const EMAIL_CATEGORIES = [
  { key: 'platform_announcement', label: 'Platform Announcement', color: 'sky' },
  { key: 'product_update',        label: 'Product Update',        color: 'indigo' },
  { key: 'newsletter',            label: 'Newsletter',            color: 'violet' },
  { key: 'promotional',           label: 'Promotional',           color: 'rose' },
  { key: 'onboarding',            label: 'Onboarding',            color: 'emerald' },
  { key: 'reengagement',          label: 'Re-engagement',         color: 'amber' },
  { key: 'event',                 label: 'Event Invite',          color: 'orange' },
  { key: 'transactional',         label: 'Transactional',         color: 'slate' },
]

export const EMAIL_STATUSES = [
  { key: 'draft',     label: 'Draft',     color: 'slate' },
  { key: 'scheduled', label: 'Scheduled', color: 'amber' },
  { key: 'sending',   label: 'Sending',   color: 'sky' },
  { key: 'sent',      label: 'Sent',      color: 'emerald' },
  { key: 'paused',    label: 'Paused',    color: 'amber' },
  { key: 'failed',    label: 'Failed',    color: 'rose' },
  { key: 'archived',  label: 'Archived',  color: 'gray' },
]

export const AUDIENCE_TYPES = [
  { key: 'all_subscribers',  label: 'All Newsletter Subscribers',  source: 'email_subscribers' },
  { key: 'active_customers', label: 'Active Customers',            source: 'profiles' },
  { key: 'waitlist',         label: 'Waitlist Signups',            source: 'waitlist_signups' },
  { key: 'segment',          label: 'Custom Segment',              source: 'marketing_segments' },
  { key: 'custom_list',      label: 'Custom Email List',           source: 'manual' },
]

// Merge-tag support. Body templates can use {{first_name}}, {{email}}, etc.
export const EMAIL_MERGE_TAGS = [
  { key: '{{first_name}}', hint: 'Recipient first name (fallback: "there")' },
  { key: '{{email}}',      hint: 'Recipient email address' },
  { key: '{{full_name}}',  hint: 'Full name if available' },
  { key: '{{company}}',    hint: 'Company name if available' },
  { key: '{{today}}',      hint: 'Current date (e.g., "April 17, 2026")' },
]

export function renderMergeTags(template = '', vars = {}) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const first = (vars.first_name || (vars.full_name || '').split(' ')[0] || 'there')
  return String(template)
    .replaceAll('{{first_name}}', first)
    .replaceAll('{{email}}', vars.email || '')
    .replaceAll('{{full_name}}', vars.full_name || first)
    .replaceAll('{{company}}', vars.company || '')
    .replaceAll('{{today}}', today)
}

export async function listEmailCampaigns({ status, category, q } = {}) {
  let query = supabase.from('communication_campaigns').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (q) query = query.or(`name.ilike.%${q}%,subject.ilike.%${q}%`)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getEmailCampaign(id) {
  const { data, error } = await supabase.from('communication_campaigns').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createEmailCampaign(row) {
  const { data: { user } } = await supabase.auth.getUser()
  const payload = {
    created_by: user?.id,
    name: row.name,
    subject: row.subject,
    body_html: row.body_html || '',
    body_preview: row.body_preview || (row.body_html || '').replace(/<[^>]+>/g, '').slice(0, 160),
    channel: 'email',
    category: row.category || 'platform_announcement',
    audience_type: row.audience_type || 'all_subscribers',
    audience_filter: row.audience_filter || {},
    audience_preview_count: row.audience_preview_count ?? null,
    status: row.status || 'draft',
    scheduled_at: row.scheduled_at || null,
    metadata: row.metadata || {},
  }
  const { data, error } = await supabase.from('communication_campaigns').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateEmailCampaign(id, patch) {
  patch.updated_at = new Date().toISOString()
  if ('body_html' in patch && !patch.body_preview) {
    patch.body_preview = String(patch.body_html || '').replace(/<[^>]+>/g, '').slice(0, 160)
  }
  const { data, error } = await supabase.from('communication_campaigns').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEmailCampaign(id) {
  const { error } = await supabase.from('communication_campaigns').delete().eq('id', id)
  if (error) throw error
}

// Build recipient list for the selected audience.
// Returns: [{ email, first_name, full_name, ... }]
export async function resolveCampaignAudience(campaign) {
  const type = campaign.audience_type
  if (type === 'all_subscribers') {
    const { data, error } = await supabase.from('email_subscribers').select('email, first_name, is_active').eq('is_active', true).limit(5000)
    if (error) throw error
    return (data || []).map(r => ({ email: r.email, first_name: r.first_name, full_name: r.first_name }))
  }
  if (type === 'active_customers') {
    const { data, error } = await supabase.from('profiles').select('email, full_name').not('email', 'is', null).limit(5000)
    if (error) throw error
    return (data || []).map(r => ({ email: r.email, first_name: (r.full_name || '').split(' ')[0], full_name: r.full_name }))
  }
  if (type === 'waitlist') {
    const { data, error } = await supabase.from('waitlist_signups').select('email, full_name').limit(5000)
    if (error) throw error
    return (data || []).map(r => ({ email: r.email, first_name: (r.full_name || '').split(' ')[0], full_name: r.full_name }))
  }
  if (type === 'segment') {
    const segId = campaign.audience_filter?.segment_id
    if (!segId) return []
    const { data: seg, error: segErr } = await supabase.from('marketing_segments').select('*').eq('id', segId).single()
    if (segErr) throw segErr
    // Source table + dynamic filter
    let query = supabase.from(seg.source_table).select('email, full_name, first_name').not('email', 'is', null)
    for (const f of (seg.filter_json?.filters || [])) {
      switch (f.op) {
        case 'eq':          query = query.eq(f.field, f.value); break
        case 'neq':         query = query.neq(f.field, f.value); break
        case 'gt':          query = query.gt(f.field, f.value); break
        case 'gte':         query = query.gte(f.field, f.value); break
        case 'lt':          query = query.lt(f.field, f.value); break
        case 'lte':         query = query.lte(f.field, f.value); break
        case 'ilike':       query = query.ilike(f.field, `%${f.value}%`); break
        case 'in':          query = query.in(f.field, String(f.value).split(',').map(s => s.trim())); break
        case 'is_null':     query = query.is(f.field, null); break
        case 'is_not_null': query = query.not(f.field, 'is', null); break
        default: break
      }
    }
    const { data, error } = await query.limit(5000)
    if (error) throw error
    return (data || []).map(r => ({ email: r.email, full_name: r.full_name, first_name: r.first_name || (r.full_name || '').split(' ')[0] }))
  }
  if (type === 'custom_list') {
    const list = campaign.audience_filter?.emails || []
    return list.map(e => ({ email: e, first_name: 'there', full_name: null }))
  }
  return []
}

export async function previewAudienceCount(campaign) {
  const recipients = await resolveCampaignAudience(campaign)
  const uniq = new Set(recipients.map(r => (r.email || '').toLowerCase()).filter(Boolean))
  return uniq.size
}

// Invokes the send-campaign edge function. Falls back to client-side
// logging only (not a real send) if the function is unavailable, so the
// UI can still demo the flow.
export async function sendEmailCampaign(campaignId, { testEmail, dryRun = false } = {}) {
  const { data, error } = await supabase.functions.invoke('send-campaign', {
    body: { campaign_id: campaignId, test_email: testEmail || null, dry_run: !!dryRun },
  })
  if (error) throw error
  return data
}

export async function listOutboundEmails({ campaign_id, status, limit = 100 } = {}) {
  let q = supabase.from('outbound_emails').select('*').order('sent_at', { ascending: false }).limit(limit)
  if (campaign_id) q = q.eq('campaign_id', campaign_id)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function listEmailSubscribers({ active, q, limit = 500 } = {}) {
  let query = supabase.from('email_subscribers').select('*').order('subscribed_at', { ascending: false }).limit(limit)
  if (active !== undefined) query = query.eq('is_active', active)
  if (q) query = query.ilike('email', `%${q}%`)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createEmailSubscriber({ email, first_name, source = 'admin_manual' }) {
  const { data, error } = await supabase.from('email_subscribers').insert({
    email: email.toLowerCase().trim(),
    first_name: first_name || null,
    source,
    is_active: true,
  }).select().single()
  if (error) throw error
  return data
}

export async function toggleSubscriberActive(id, is_active) {
  const patch = { is_active }
  if (!is_active) patch.unsubscribed_at = new Date().toISOString()
  else patch.unsubscribed_at = null
  const { data, error } = await supabase.from('email_subscribers').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEmailSubscriber(id) {
  const { error } = await supabase.from('email_subscribers').delete().eq('id', id)
  if (error) throw error
}

export function emailCampaignMetrics(campaign, outbound = []) {
  const queued = Number(campaign.recipients_queued || 0)
  const sent = Number(campaign.recipients_sent || outbound.filter(o => o.status === 'sent' || o.status === 'delivered').length)
  const failed = Number(campaign.recipients_failed || outbound.filter(o => o.status === 'failed' || o.status === 'bounced').length)
  const delivered = outbound.filter(o => !!o.delivered_at).length
  const opened = outbound.filter(o => !!o.opened_at).length
  const clicked = outbound.filter(o => !!o.clicked_at).length
  const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0
  const openRate = delivered > 0 ? (opened / delivered) * 100 : 0
  const clickRate = opened > 0 ? (clicked / opened) * 100 : 0
  const ctor = delivered > 0 ? (clicked / delivered) * 100 : 0
  return { queued, sent, failed, delivered, opened, clicked, deliveryRate, openRate, clickRate, ctor }
}
