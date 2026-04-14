import { supabase } from './supabase';

// ─── HELPERS ─────────────────────────────────
function handleError(error, fn) {
  console.error(`[customerOpsService.${fn}]`, error);
  throw error;
}

// ═══════════════════════════════════════════════
// WORK ORDERS
// ═══════════════════════════════════════════════
export async function fetchWorkOrders(orgId, filters = {}) {
  let query = supabase.from('ops_work_orders').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.assigned_crew_id) query = query.eq('assigned_crew_id', filters.assigned_crew_id);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,work_order_number.ilike.%${filters.search}%,address.ilike.%${filters.search}%`);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchWorkOrders');
  return data || [];
}

export async function createWorkOrder(wo) {
  const { data, error } = await supabase.from('ops_work_orders').insert(wo).select().single();
  if (error) handleError(error, 'createWorkOrder');
  return data;
}

export async function updateWorkOrder(id, updates) {
  const { data, error } = await supabase.from('ops_work_orders')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateWorkOrder');
  return data;
}

export async function deleteWorkOrder(id) {
  const { error } = await supabase.from('ops_work_orders').delete().eq('id', id);
  if (error) handleError(error, 'deleteWorkOrder');
}

// Generate next WO number
export async function getNextWONumber(orgId) {
  const { data } = await supabase.from('ops_work_orders')
    .select('work_order_number')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (data && data.length > 0 && data[0].work_order_number) {
    const num = parseInt(data[0].work_order_number.replace('WO-', ''), 10) || 0;
    return `WO-${String(num + 1).padStart(4, '0')}`;
  }
  return 'WO-0001';
}

// ═══════════════════════════════════════════════
// CREWS
// ═══════════════════════════════════════════════
export async function fetchCrews(orgId) {
  let query = supabase.from('ops_crews').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query.order('name');
  if (error) handleError(error, 'fetchCrews');
  return data || [];
}

export async function createCrew(crew) {
  const { data, error } = await supabase.from('ops_crews').insert(crew).select().single();
  if (error) handleError(error, 'createCrew');
  return data;
}

export async function updateCrew(id, updates) {
  const { data, error } = await supabase.from('ops_crews')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateCrew');
  return data;
}

export async function deleteCrew(id) {
  const { error } = await supabase.from('ops_crews').delete().eq('id', id);
  if (error) handleError(error, 'deleteCrew');
}

// ═══════════════════════════════════════════════
// CREW MEMBERS
// ═══════════════════════════════════════════════
export async function fetchCrewMembers(orgId, crewId = null) {
  let query = supabase.from('ops_crew_members').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (crewId) query = query.eq('crew_id', crewId);
  const { data, error } = await query.order('name');
  if (error) handleError(error, 'fetchCrewMembers');
  return data || [];
}

export async function createCrewMember(member) {
  const { data, error } = await supabase.from('ops_crew_members').insert(member).select().single();
  if (error) handleError(error, 'createCrewMember');
  return data;
}

export async function updateCrewMember(id, updates) {
  const { data, error } = await supabase.from('ops_crew_members')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateCrewMember');
  return data;
}

export async function deleteCrewMember(id) {
  const { error } = await supabase.from('ops_crew_members').delete().eq('id', id);
  if (error) handleError(error, 'deleteCrewMember');
}

// ═══════════════════════════════════════════════
// SCHEDULE
// ═══════════════════════════════════════════════
export async function fetchSchedule(orgId, filters = {}) {
  let query = supabase.from('ops_schedule').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.crew_id) query = query.eq('crew_id', filters.crew_id);
  if (filters.event_type) query = query.eq('event_type', filters.event_type);
  if (filters.start_after) query = query.gte('start_time', filters.start_after);
  if (filters.end_before) query = query.lte('end_time', filters.end_before);
  const { data, error } = await query.order('start_time', { ascending: true });
  if (error) handleError(error, 'fetchSchedule');
  return data || [];
}

export async function createScheduleEvent(event) {
  const { data, error } = await supabase.from('ops_schedule').insert(event).select().single();
  if (error) handleError(error, 'createScheduleEvent');
  return data;
}

export async function updateScheduleEvent(id, updates) {
  const { data, error } = await supabase.from('ops_schedule')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateScheduleEvent');
  return data;
}

export async function deleteScheduleEvent(id) {
  const { error } = await supabase.from('ops_schedule').delete().eq('id', id);
  if (error) handleError(error, 'deleteScheduleEvent');
}

// ═══════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════
export async function fetchInventory(orgId, filters = {}) {
  let query = supabase.from('ops_inventory').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.low_stock) query = query.lte('quantity', supabase.rpc ? 0 : filters.low_stock);
  if (filters.search) query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
  else query = query.eq('is_active', true);
  const { data, error } = await query.order('name');
  if (error) handleError(error, 'fetchInventory');
  return data || [];
}

export async function createInventoryItem(item) {
  const { data, error } = await supabase.from('ops_inventory').insert(item).select().single();
  if (error) handleError(error, 'createInventoryItem');
  return data;
}

export async function updateInventoryItem(id, updates) {
  const { data, error } = await supabase.from('ops_inventory')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateInventoryItem');
  return data;
}

export async function deleteInventoryItem(id) {
  const { error } = await supabase.from('ops_inventory').update({ is_active: false }).eq('id', id);
  if (error) handleError(error, 'deleteInventoryItem');
}

// Inventory transactions
export async function fetchInventoryTransactions(orgId, inventoryId = null) {
  let query = supabase.from('ops_inventory_transactions').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (inventoryId) query = query.eq('inventory_id', inventoryId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
  if (error) handleError(error, 'fetchInventoryTransactions');
  return data || [];
}

export async function createInventoryTransaction(tx) {
  const { data, error } = await supabase.from('ops_inventory_transactions').insert(tx).select().single();
  if (error) handleError(error, 'createInventoryTransaction');
  // Update inventory quantity
  if (data) {
    const { data: item } = await supabase.from('ops_inventory').select('quantity').eq('id', tx.inventory_id).single();
    if (item) {
      await supabase.from('ops_inventory').update({
        quantity: item.quantity + tx.quantity,
        updated_at: new Date().toISOString()
      }).eq('id', tx.inventory_id);
    }
  }
  return data;
}

// ═══════════════════════════════════════════════
// MEASUREMENTS
// ═══════════════════════════════════════════════
export async function fetchMeasurements(orgId, filters = {}) {
  let query = supabase.from('ops_measurements').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.project_id) query = query.eq('project_id', filters.project_id);
  if (filters.template_type) query = query.eq('template_type', filters.template_type);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,address.ilike.%${filters.search}%`);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchMeasurements');
  return data || [];
}

export async function createMeasurement(m) {
  const { data, error } = await supabase.from('ops_measurements').insert(m).select().single();
  if (error) handleError(error, 'createMeasurement');
  return data;
}

export async function updateMeasurement(id, updates) {
  const { data, error } = await supabase.from('ops_measurements')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateMeasurement');
  return data;
}

export async function deleteMeasurement(id) {
  const { error } = await supabase.from('ops_measurements').delete().eq('id', id);
  if (error) handleError(error, 'deleteMeasurement');
}

// ═══════════════════════════════════════════════
// APPLICANTS (Tenant HR Hub)
// ═══════════════════════════════════════════════
export async function fetchApplicants(orgId, filters = {}) {
  let query = supabase.from('ops_applicants').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.position) query = query.eq('position', filters.position);
  if (filters.search) query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,position.ilike.%${filters.search}%`);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchApplicants');
  return data || [];
}

export async function createApplicant(app) {
  const { data, error } = await supabase.from('ops_applicants').insert(app).select().single();
  if (error) handleError(error, 'createApplicant');
  return data;
}

export async function updateApplicant(id, updates) {
  const { data, error } = await supabase.from('ops_applicants')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateApplicant');
  return data;
}

export async function deleteApplicant(id) {
  const { error } = await supabase.from('ops_applicants').delete().eq('id', id);
  if (error) handleError(error, 'deleteApplicant');
}

// ═══════════════════════════════════════════════
// OPS DOCUMENTS (uses existing org_documents table)
// ═══════════════════════════════════════════════
export async function fetchOpsDocs(orgId, filters = {}) {
  let query = supabase.from('org_documents').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.search) query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) handleError(error, 'fetchOpsDocs');
  return data || [];
}

// ═══════════════════════════════════════════════
// OPS DASHBOARD STATS — aggregated queries
// ═══════════════════════════════════════════════
export async function fetchOpsDashboardStats(orgId) {
  const results = {};

  try {
  // Work order stats
  const { data: wos } = await supabase.from('ops_work_orders').select('status, priority, estimated_cost, actual_cost').eq('org_id', orgId);
  results.workOrders = {
    total: wos?.length || 0,
    pending: wos?.filter(w => w.status === 'pending').length || 0,
    inProgress: wos?.filter(w => w.status === 'in_progress').length || 0,
    completed: wos?.filter(w => w.status === 'completed').length || 0,
    urgent: wos?.filter(w => w.priority === 'urgent').length || 0,
    revenue: wos?.reduce((s, w) => s + (w.actual_cost || w.estimated_cost || 0), 0) || 0,
  };

  // Crew stats
  const { data: crews } = await supabase.from('ops_crews').select('status').eq('org_id', orgId);
  results.crews = {
    total: crews?.length || 0,
    active: crews?.filter(c => c.status === 'active').length || 0,
    onJob: crews?.filter(c => c.status === 'on_job').length || 0,
  };

  // Inventory alerts — fetch all active inventory and filter client-side
  const { data: invItems } = await supabase.from('ops_inventory')
    .select('id, quantity, min_quantity').eq('org_id', orgId).eq('is_active', true);
  results.inventory = {
    lowStockCount: invItems?.filter(i => i.quantity <= (i.min_quantity || 0)).length || 0,
  };

  // Today's schedule
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { data: todayEvents } = await supabase.from('ops_schedule')
    .select('id, status').eq('org_id', orgId)
    .gte('start_time', today.toISOString())
    .lt('start_time', tomorrow.toISOString());
  results.schedule = {
    todayJobs: todayEvents?.length || 0,
  };

  // Applicants
  const { data: apps } = await supabase.from('ops_applicants').select('stage').eq('org_id', orgId);
  results.hiring = {
    total: apps?.length || 0,
    active: apps?.filter(a => !['hired', 'rejected', 'withdrawn'].includes(a.stage)).length || 0,
  };
  } catch (err) {
    console.error('[customerOpsService.fetchOpsDashboardStats]', err);
    // Return safe defaults so the dashboard still renders
    if (!results.workOrders) results.workOrders = { total: 0, pending: 0, inProgress: 0, completed: 0, urgent: 0, revenue: 0 };
    if (!results.crews) results.crews = { total: 0, active: 0, onJob: 0 };
    if (!results.inventory) results.inventory = { lowStockCount: 0 };
    if (!results.schedule) results.schedule = { todayJobs: 0 };
    if (!results.hiring) results.hiring = { total: 0, active: 0 };
  }

  return results;
}
