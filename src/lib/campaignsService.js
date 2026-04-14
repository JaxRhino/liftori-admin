import { supabase } from './supabase'

export const AUDIENCE_TYPES = [
  { key: 'all_testers',     label: 'All testers',         group: 'HR',       hint: 'Everyone enrolled in the Tester Program' },
  { key: 'all_affiliates',  label: 'All affiliates',      group: 'HR',       hint: 'Every active creator/affiliate' },
  { key: 'affiliate_tier',  label: 'Affiliates by tier',  group: 'HR',       hint: 'Filter by Starter / Creator / Pro / Diamond' },
  { key: 'all_team',        label: 'All team + admins',   group: 'HR',       hint: 'Admins, sales, consultants, testers, managers' },
  { key: 'all_admins',      label: 'Admins only',         group: 'HR',       hint: 'Admin / super_admin / dev roles only' },
  { key: 'all_customers',   label: 'All customers',       group: 'Platform', hint: 'Platform users with role = customer' },
  { key: 'all_users',       label: 'Everyone on platform',group: 'Platform', hint: 'Every user profile in the system' },
  { key: 'specific_users',  label: 'Specific users',      group: 'Advanced', hint: 'Pick users one by one' },
  { key: 'custom_filter',   label: 'Custom role filter',  group: 'Advanced', hint: 'Filter by arbitrary role set' },
]

export const TEMPLATE_CATEGORIES = [
  { key: 'hr_announcement',         label: 'HR · Announcement',      icon: '📣', group: 'HR'       },
  { key: 'hr_policy',               label: 'HR · Policy',            icon: '📜', group: 'HR'       },
  { key: 'hr_timesheet_reminder',   label: 'HR · Timesheet',         icon: '⏱',  group: 'HR'       },
  { key: 'hr_commission_statement', label: 'HR · Commissions',       icon: '💰', group: 'HR'       },
  { key: 'hr_performance_review',   label: 'HR · Performance review',icon: '⭐', group: 'HR'       },
  { key: 'hr_benefits',             label: 'HR · Benefits',          icon: '🎁', group: 'HR'       },
  { key: 'hr_compliance',           label: 'HR · Compliance',        icon: '🏛',  group: 'HR'       },
  { key: 'hr_offboarding',          label: 'HR · Offboarding',       icon: '👋', group: 'HR'       },
  { key: 'platform_announcement',   label: 'Platform · Announcement',icon: '📢', group: 'Platform' },
  { key: 'platform_feature_launch', label: 'Platform · Feature',     icon: '🚀', group: 'Platform' },
  { key: 'platform_maintenance',    label: 'Platform · Maintenance', icon: '🔧', group: 'Platform' },
  { key: 'platform_update',         label: 'Platform · Update',      icon: '✨', group: 'Platform' },
  { key: 'platform_digest',         label: 'Platform · Digest',      icon: '📰', group: 'Platform' },
  { key: 'platform_terms_change',   label: 'Platform · ToS change',  icon: '⚖️', group: 'Platform' },
  { key: 'announcement',            label: 'General announcement',   icon: '📣', group: 'General'  },
  { key: 'custom',                  label: 'Custom',                 icon: '✏️', group: 'General'  },
]

export async function listCampaigns({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('communication_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getCampaign(id) {
  const { data, error } = await supabase.from('communication_campaigns').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createCampaign(row) {
  const { data, error } = await supabase.from('communication_campaigns').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateCampaign(id, patch) {
  const { data, error } = await supabase.from('communication_campaigns').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteCampaign(id) {
  const { error } = await supabase.from('communication_campaigns').delete().eq('id', id)
  if (error) throw error
}

export async function sendCampaignNow(campaign_id) {
  const { data, error } = await supabase.functions.invoke('send-campaign', { body: { campaign_id } })
  if (error) throw error
  return data
}

export async function previewAudienceCount(audience_type, audience_filter = {}) {
  // Quick server-side count using the same resolution rules the edge function uses
  if (audience_type === 'all_testers') {
    const { count } = await supabase.from('tester_enrollments').select('*', { count: 'exact', head: true })
    return count || 0
  }
  if (audience_type === 'all_affiliates') {
    const { count } = await supabase.from('affiliate_enrollments').select('*', { count: 'exact', head: true })
    return count || 0
  }
  if (audience_type === 'affiliate_tier' && audience_filter.tier) {
    const { count } = await supabase.from('affiliate_enrollments').select('*', { count: 'exact', head: true }).eq('tier', audience_filter.tier)
    return count || 0
  }
  if (audience_type === 'all_customers') {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer')
    return count || 0
  }
  if (audience_type === 'all_admins') {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['admin', 'super_admin', 'dev'])
    return count || 0
  }
  if (audience_type === 'all_team') {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
      .in('role', ['admin', 'super_admin', 'dev', 'sales', 'consultant', 'tester', 'manager'])
    return count || 0
  }
  if (audience_type === 'all_users') {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    return count || 0
  }
  if (audience_type === 'specific_users' && Array.isArray(audience_filter.user_ids)) {
    return audience_filter.user_ids.length
  }
  if (audience_type === 'custom_filter' && Array.isArray(audience_filter.roles)) {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', audience_filter.roles)
    return count || 0
  }
  return 0
}

export async function listTemplates() {
  const { data, error } = await supabase
    .from('communication_templates')
    .select('*')
    .order('system_template', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createTemplate(row) {
  const { data, error } = await supabase.from('communication_templates').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateTemplate(id, patch) {
  const { data, error } = await supabase.from('communication_templates').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('communication_templates').delete().eq('id', id)
  if (error) throw error
}
