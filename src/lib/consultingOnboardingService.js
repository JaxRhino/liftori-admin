/**
 * consultingOnboardingService — client-side helpers for the consulting
 * onboarding wizard + full-picture client overview.
 *
 * Owns everything that reads/writes:
 *   - public.consulting_engagements (extended fields)
 *   - public.industries
 *   - public.consulting_departments
 *   - public.consulting_org_members
 *   - public.consulting_websites
 *   - public.consulting_seo_snapshots
 *
 * EOS data (vto / rocks / scorecard / issues) continues to live in the
 * existing eos_* tables scoped by context_type='consulting_engagement',
 * context_id=<engagement_id>.
 */
import { supabase } from './supabase'

export const COMPANY_SIZE_BUCKETS = [
  { value: 'solopreneur', label: 'Solopreneur (1)' },
  { value: '2-10',        label: 'Small team (2–10)' },
  { value: '11-50',       label: 'Growing (11–50)' },
  { value: '51-200',      label: 'Mid-market (51–200)' },
  { value: '201-500',     label: 'Established (201–500)' },
  { value: '501-1000',    label: 'Large (501–1000)' },
  { value: '1000+',       label: 'Enterprise (1000+)' },
]

export const REVENUE_BUCKETS = [
  { value: 'pre_revenue', label: 'Pre-revenue' },
  { value: 'under_100k',  label: 'Under $100k' },
  { value: '100k_500k',   label: '$100k – $500k' },
  { value: '500k_1m',     label: '$500k – $1M' },
  { value: '1m_5m',       label: '$1M – $5M' },
  { value: '5m_10m',      label: '$5M – $10M' },
  { value: '10m_50m',     label: '$10M – $50M' },
  { value: '50m_plus',    label: '$50M+' },
]

export const WEBSITE_KINDS = [
  { value: 'main',      label: 'Main Site' },
  { value: 'blog',      label: 'Blog' },
  { value: 'shop',      label: 'Shop / Store' },
  { value: 'landing',   label: 'Landing Page' },
  { value: 'microsite', label: 'Microsite' },
  { value: 'subdomain', label: 'Subdomain' },
  { value: 'other',     label: 'Other' },
]

export const ONBOARDING_STEPS = [
  { id: 1, key: 'basics',        label: 'Basics' },
  { id: 2, key: 'company',       label: 'Company Details' },
  { id: 3, key: 'web_social',    label: 'Web & Social' },
  { id: 4, key: 'org',           label: 'Org & Departments' },
  { id: 5, key: 'offering',      label: 'Offering & Goals' },
  { id: 6, key: 'systems',       label: 'Current Systems' },
  { id: 7, key: 'eos_seed',      label: 'EOS Vision Seed' },
]

// ═══════════════════════════════════════════════════════════════════════
// Industries
// ═══════════════════════════════════════════════════════════════════════

export async function fetchIndustries() {
  const { data, error } = await supabase
    .from('industries')
    .select('id, name, is_global, usage_count')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

/** Add a new custom industry. Returns the new row. */
export async function addIndustry(name) {
  const clean = (name || '').trim()
  if (!clean) throw new Error('Industry name is required')
  const { data, error } = await supabase
    .from('industries')
    .insert({ name: clean, is_global: false })
    .select()
    .single()
  if (error) {
    // unique-conflict: return the existing row
    if (/duplicate|unique/i.test(error.message)) {
      const { data: existing } = await supabase
        .from('industries').select('*').ilike('name', clean).limit(1).maybeSingle()
      if (existing) return existing
    }
    throw error
  }
  return data
}

// ═══════════════════════════════════════════════════════════════════════
// Engagement (capture fields used by the wizard)
// ═══════════════════════════════════════════════════════════════════════

export async function fetchEngagement(id) {
  const { data, error } = await supabase
    .from('consulting_engagements')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/** Partial update — only send the fields passed. Auto-bumps updated_at. */
export async function updateEngagement(id, patch) {
  const { data, error } = await supabase
    .from('consulting_engagements')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Mark the wizard as completed. */
export async function finishOnboarding(id) {
  return updateEngagement(id, {
    onboarding_completed: true,
    onboarding_step: ONBOARDING_STEPS.length,
  })
}

/** Advance the onboarding_step marker (for "Save & continue" clicks). */
export async function advanceOnboardingStep(id, stepNumber) {
  return updateEngagement(id, { onboarding_step: stepNumber })
}

// ═══════════════════════════════════════════════════════════════════════
// Departments
// ═══════════════════════════════════════════════════════════════════════

export async function fetchDepartments(engagementId) {
  const { data, error } = await supabase
    .from('consulting_departments')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createDepartment(engagementId, payload) {
  const { data, error } = await supabase
    .from('consulting_departments')
    .insert({ engagement_id: engagementId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDepartment(id, patch) {
  const { data, error } = await supabase
    .from('consulting_departments')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDepartment(id) {
  const { error } = await supabase.from('consulting_departments').delete().eq('id', id)
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════════
// Org members (doubles as EOS Accountability Chart)
// ═══════════════════════════════════════════════════════════════════════

export async function fetchOrgMembers(engagementId) {
  const { data, error } = await supabase
    .from('consulting_org_members')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createOrgMember(engagementId, payload) {
  const { data, error } = await supabase
    .from('consulting_org_members')
    .insert({ engagement_id: engagementId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateOrgMember(id, patch) {
  const { data, error } = await supabase
    .from('consulting_org_members')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteOrgMember(id) {
  const { error } = await supabase.from('consulting_org_members').delete().eq('id', id)
  if (error) throw error
}

/** Build a hierarchical tree from a flat org-member list. */
export function buildOrgTree(members) {
  const byId = new Map(members.map(m => [m.id, { ...m, children: [] }]))
  const roots = []
  for (const m of byId.values()) {
    if (m.reports_to_id && byId.has(m.reports_to_id)) {
      byId.get(m.reports_to_id).children.push(m)
    } else {
      roots.push(m)
    }
  }
  return roots
}

// ═══════════════════════════════════════════════════════════════════════
// Websites
// ═══════════════════════════════════════════════════════════════════════

export async function fetchWebsites(engagementId) {
  const { data, error } = await supabase
    .from('consulting_websites')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('is_primary', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createWebsite(engagementId, payload) {
  const { data, error } = await supabase
    .from('consulting_websites')
    .insert({ engagement_id: engagementId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWebsite(id, patch) {
  const { data, error } = await supabase
    .from('consulting_websites')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteWebsite(id) {
  const { error } = await supabase.from('consulting_websites').delete().eq('id', id)
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════════
// SEO Snapshots
// ═══════════════════════════════════════════════════════════════════════

export async function fetchSeoSnapshots(engagementId) {
  const { data, error } = await supabase
    .from('consulting_seo_snapshots')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('generated_at', { ascending: false })
  if (error) throw error
  return data || []
}

/** Wave 3 invokes the edge function 'consulting-seo-inspector' and
 *  persists the result through this helper. */
export async function runSeoInspection({ engagementId, url, websiteId = null }) {
  const { data, error } = await supabase.functions.invoke('consulting-seo-inspector', {
    body: { engagement_id: engagementId, url, website_id: websiteId },
  })
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════════════════════
// Completeness score — how much of the profile is filled
// ═══════════════════════════════════════════════════════════════════════

export function computeProfileCompleteness(engagement, { departments = [], members = [], websites = [] } = {}) {
  const checks = [
    { key: 'basics',      ok: !!(engagement.client_name && engagement.client_email && engagement.company_name) },
    { key: 'industry',    ok: !!engagement.industry_id },
    { key: 'size',        ok: !!engagement.company_size_bucket },
    { key: 'revenue',     ok: !!engagement.annual_revenue_bucket },
    { key: 'founded',     ok: !!(engagement.years_in_business || engagement.founded_date) },
    { key: 'address',     ok: !!engagement.headquarters_address },
    { key: 'website',     ok: !!engagement.primary_website || websites.length > 0 },
    { key: 'social',      ok: !!(engagement.social_urls && Object.values(engagement.social_urls).some(Boolean)) },
    { key: 'departments', ok: departments.length > 0 },
    { key: 'org',         ok: members.length > 0 },
    { key: 'offering',    ok: !!engagement.offerings },
    { key: 'target',      ok: !!engagement.target_customer },
    { key: 'pain',        ok: !!engagement.pain_points },
    { key: 'goals',       ok: !!(engagement.goals_12mo || engagement.goals_3yr) },
    { key: 'tools',       ok: !!(engagement.current_tools && Object.keys(engagement.current_tools).length > 0) },
    { key: 'eos_core_values',  ok: !!(engagement.core_values && engagement.core_values.length > 0) },
    { key: 'eos_focus',        ok: !!(engagement.core_focus_purpose || engagement.core_focus_niche) },
    { key: 'eos_10yr',         ok: !!engagement.ten_year_target },
  ]
  const passed = checks.filter(c => c.ok).length
  return {
    percent: Math.round((passed / checks.length) * 100),
    passed,
    total: checks.length,
    missing: checks.filter(c => !c.ok).map(c => c.key),
  }
}
