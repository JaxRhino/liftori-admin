import { supabase } from './supabase';

// ─── HELPERS ─────────────────────────────────
function handleError(error, fn) {
  console.error(`[customerService.${fn}]`, error);
  throw error;
}

// ─── CONTACTS ────────────────────────────────
export async function fetchContacts(orgId, filters = {}) {
  let query = supabase.from('customer_contacts').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.contact_type) query = query.eq('contact_type', filters.contact_type);
  if (filters.search) query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchContacts');
  return data || [];
}

export async function createContact(contact) {
  const { data, error } = await supabase.from('customer_contacts').insert(contact).select().single();
  if (error) handleError(error, 'createContact');
  return data;
}

export async function updateContact(id, updates) {
  const { data, error } = await supabase.from('customer_contacts')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateContact');
  return data;
}

export async function deleteContact(id) {
  const { error } = await supabase.from('customer_contacts').delete().eq('id', id);
  if (error) handleError(error, 'deleteContact');
}

// ─── PROJECTS ────────────────────────────────
export async function fetchProjects(orgId, filters = {}) {
  let query = supabase.from('customer_projects').select('*, customer_contacts(first_name, last_name)');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.status) query = query.eq('status', filters.status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchProjects');
  return data || [];
}

export async function createProject(project) {
  const { data, error } = await supabase.from('customer_projects').insert(project).select().single();
  if (error) handleError(error, 'createProject');
  return data;
}

export async function updateProject(id, updates) {
  const { data, error } = await supabase.from('customer_projects')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateProject');
  return data;
}

export async function deleteProject(id) {
  const { error } = await supabase.from('customer_projects').delete().eq('id', id);
  if (error) handleError(error, 'deleteProject');
}

// ─── PIPELINE ────────────────────────────────
export async function fetchPipelineDeals(orgId, filters = {}) {
  let query = supabase.from('customer_pipeline').select('*, customer_contacts(first_name, last_name)');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
  const { data, error } = await query.order('last_activity_at', { ascending: false });
  if (error) handleError(error, 'fetchPipelineDeals');
  return data || [];
}

export async function createDeal(deal) {
  const { data, error } = await supabase.from('customer_pipeline').insert(deal).select().single();
  if (error) handleError(error, 'createDeal');
  return data;
}

export async function updateDeal(id, updates) {
  const { data, error } = await supabase.from('customer_pipeline')
    .update({ ...updates, updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) handleError(error, 'updateDeal');
  return data;
}

export async function deleteDeal(id) {
  const { error } = await supabase.from('customer_pipeline').delete().eq('id', id);
  if (error) handleError(error, 'deleteDeal');
}

// ─── ESTIMATES ───────────────────────────────
export async function fetchEstimates(orgId, filters = {}) {
  let query = supabase.from('customer_estimates').select('*, customer_contacts(first_name, last_name)');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.status) query = query.eq('status', filters.status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchEstimates');
  return data || [];
}

export async function createEstimate(estimate) {
  const { data, error } = await supabase.from('customer_estimates').insert(estimate).select().single();
  if (error) handleError(error, 'createEstimate');
  return data;
}

export async function updateEstimate(id, updates) {
  const { data, error } = await supabase.from('customer_estimates')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateEstimate');
  return data;
}

export async function deleteEstimate(id) {
  const { error } = await supabase.from('customer_estimates').delete().eq('id', id);
  if (error) handleError(error, 'deleteEstimate');
}

// ─── AGREEMENTS ──────────────────────────────
export async function fetchAgreements(orgId, filters = {}) {
  let query = supabase.from('customer_agreements').select('*, customer_contacts(first_name, last_name)');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.status) query = query.eq('status', filters.status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchAgreements');
  return data || [];
}

export async function createAgreement(agreement) {
  const { data, error } = await supabase.from('customer_agreements').insert(agreement).select().single();
  if (error) handleError(error, 'createAgreement');
  return data;
}

export async function updateAgreement(id, updates) {
  const { data, error } = await supabase.from('customer_agreements')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateAgreement');
  return data;
}

export async function deleteAgreement(id) {
  const { error } = await supabase.from('customer_agreements').delete().eq('id', id);
  if (error) handleError(error, 'deleteAgreement');
}

// ─── TEAM MEMBERS ────────────────────────────
export async function fetchTeamMembers(orgId) {
  let query = supabase.from('org_team_members').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query.order('role').order('last_name');
  if (error) handleError(error, 'fetchTeamMembers');
  return data || [];
}

export async function createTeamMember(member) {
  const { data, error } = await supabase.from('org_team_members').insert(member).select().single();
  if (error) handleError(error, 'createTeamMember');
  return data;
}

export async function updateTeamMember(id, updates) {
  const { data, error } = await supabase.from('org_team_members')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateTeamMember');
  return data;
}

export async function deleteTeamMember(id) {
  const { error } = await supabase.from('org_team_members').delete().eq('id', id);
  if (error) handleError(error, 'deleteTeamMember');
}

// ─── ORG SETTINGS ────────────────────────────
export async function fetchOrgSettings(orgId) {
  const { data, error } = await supabase.from('org_settings')
    .select('*').eq('org_id', orgId).single();
  if (error && error.code !== 'PGRST116') handleError(error, 'fetchOrgSettings');
  return data || null;
}

export async function upsertOrgSettings(orgId, settings) {
  const { data, error } = await supabase.from('org_settings')
    .upsert({ ...settings, org_id: orgId, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    .select().single();
  if (error) handleError(error, 'upsertOrgSettings');
  return data;
}

// ─── ORG DOCUMENTS ───────────────────────────
export async function fetchOrgDocuments(orgId, category) {
  let query = supabase.from('org_documents').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (category && category !== 'all') query = query.eq('category', category);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchOrgDocuments');
  return data || [];
}

export async function createOrgDocument(doc) {
  const { data, error } = await supabase.from('org_documents').insert(doc).select().single();
  if (error) handleError(error, 'createOrgDocument');
  return data;
}

export async function deleteOrgDocument(id) {
  const { error } = await supabase.from('org_documents').delete().eq('id', id);
  if (error) handleError(error, 'deleteOrgDocument');
}

// ─── AUDIT LOG ───────────────────────────────
export async function fetchAuditLog(orgId, limit = 50) {
  let query = supabase.from('org_audit_log').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) handleError(error, 'fetchAuditLog');
  return data || [];
}

export async function logAuditEvent(event) {
  const { error } = await supabase.from('org_audit_log').insert(event);
  if (error) console.error('[customerService.logAuditEvent]', error);
}
