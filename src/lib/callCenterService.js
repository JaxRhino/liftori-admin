// ===========================================
// Call Center Service Layer — Supabase backend
// Replaces FastAPI/MongoDB endpoints from Rhino-1
// ===========================================
import { supabase } from './supabase';

function handleError(error, context) {
  console.error(`[CallCenter] ${context}:`, error);
  throw error;
}

// ─── AGENT STATUS ───────────────────────────
export async function fetchAgents() {
  const { data, error } = await supabase.from('cc_agents')
    .select('*, profile:profiles!cc_agents_user_id_fkey(id, full_name, avatar_url, email)')
    .order('display_name');
  if (error) handleError(error, 'fetchAgents');
  return data || [];
}

export async function fetchAgent(userId) {
  const { data, error } = await supabase.from('cc_agents')
    .select('*').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') handleError(error, 'fetchAgent');
  return data;
}

export async function upsertAgent(userId, updates) {
  const { data: existing } = await supabase.from('cc_agents').select('id').eq('user_id', userId).single();
  if (existing) {
    const { data, error } = await supabase.from('cc_agents')
      .update({ ...updates, updated_at: new Date().toISOString() }).eq('user_id', userId).select().single();
    if (error) handleError(error, 'updateAgent');
    return data;
  } else {
    const { data, error } = await supabase.from('cc_agents')
      .insert({ user_id: userId, ...updates }).select().single();
    if (error) handleError(error, 'createAgent');
    return data;
  }
}

export async function setAgentStatus(userId, status) {
  const updates = { status, updated_at: new Date().toISOString() };
  if (status === 'available') updates.went_active_at = new Date().toISOString();
  if (status === 'offline') updates.went_offline_at = new Date().toISOString();
  return upsertAgent(userId, updates);
}

// ─── CALLS ──────────────────────────────────
export async function fetchActiveCalls() {
  const { data, error } = await supabase.from('cc_calls')
    .select('*')
    .in('status', ['ringing', 'in_progress', 'on_hold'])
    .order('started_at', { ascending: false });
  if (error) handleError(error, 'fetchActiveCalls');
  return data || [];
}

export async function fetchCallHistory({ limit = 50, offset = 0, status } = {}) {
  let query = supabase.from('cc_calls')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error, count } = await query;
  if (error) handleError(error, 'fetchCallHistory');
  return { data: data || [], count: count || 0 };
}

export async function fetchTodayCallStats(agentUserId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let query = supabase.from('cc_calls')
    .select('id, status, duration_seconds, direction, started_at')
    .gte('started_at', todayStart.toISOString());

  const { data, error } = await query;
  if (error) handleError(error, 'fetchTodayCallStats');

  const calls = data || [];
  const completed = calls.filter(c => c.status === 'completed');
  const missed = calls.filter(c => c.status === 'missed');
  const inbound = calls.filter(c => c.direction === 'inbound');
  const outbound = calls.filter(c => c.direction === 'outbound');
  const totalDuration = completed.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

  return {
    total_calls: calls.length,
    completed_calls: completed.length,
    missed_calls: missed.length,
    inbound_calls: inbound.length,
    outbound_calls: outbound.length,
    avg_duration: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
    total_duration: totalDuration,
  };
}

export async function createCall(call) {
  const { data, error } = await supabase.from('cc_calls').insert(call).select().single();
  if (error) handleError(error, 'createCall');
  return data;
}

export async function updateCall(id, updates) {
  const { data, error } = await supabase.from('cc_calls')
    .update(updates).eq('id', id).select().single();
  if (error) handleError(error, 'updateCall');
  return data;
}

export async function endCall(id, disposition, notes) {
  return updateCall(id, {
    status: 'completed',
    ended_at: new Date().toISOString(),
    disposition: disposition || '',
    notes: notes || '',
  });
}

// ─── CALL QUEUE ─────────────────────────────
export async function fetchCallQueue(filters = {}) {
  let query = supabase.from('cc_queue').select('*')
    .in('status', ['pending', 'in_progress', 'rescheduled'])
    .order('priority', { ascending: false })
    .order('scheduled_at', { ascending: true });
  if (filters.queue_type) query = query.eq('queue_type', filters.queue_type);
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
  const { data, error } = await query;
  if (error) handleError(error, 'fetchCallQueue');
  return data || [];
}

export async function createQueueItem(item) {
  const { data, error } = await supabase.from('cc_queue').insert(item).select().single();
  if (error) handleError(error, 'createQueueItem');
  return data;
}

export async function updateQueueItem(id, updates) {
  const { data, error } = await supabase.from('cc_queue')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateQueueItem');
  return data;
}

export async function completeQueueItem(id, userId) {
  return updateQueueItem(id, {
    status: 'completed', completed_at: new Date().toISOString(), completed_by: userId,
  });
}

export async function rescheduleQueueItem(id, newScheduledAt) {
  return updateQueueItem(id, {
    status: 'rescheduled', scheduled_at: newScheduledAt,
    attempt_count: supabase.rpc ? undefined : undefined, // increment handled separately
  });
}

// ─── SPEED TO LEAD ──────────────────────────
export async function fetchSpeedToLead(status) {
  let query = supabase.from('cc_speed_to_lead').select('*')
    .order('received_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) handleError(error, 'fetchSpeedToLead');
  return data || [];
}

export async function createSpeedToLead(lead) {
  const { data, error } = await supabase.from('cc_speed_to_lead')
    .insert({ ...lead, received_at: new Date().toISOString() }).select().single();
  if (error) handleError(error, 'createSpeedToLead');
  return data;
}

export async function updateSpeedToLead(id, updates) {
  const { data, error } = await supabase.from('cc_speed_to_lead')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateSpeedToLead');
  return data;
}

export async function contactLead(id, userId) {
  return updateSpeedToLead(id, {
    status: 'contacted',
    first_contact_at: new Date().toISOString(),
    assigned_to: userId,
  });
}

// ─── SCRIPTS ────────────────────────────────
export async function fetchScripts() {
  const { data, error } = await supabase.from('cc_scripts')
    .select('*').eq('is_active', true).order('name');
  if (error) handleError(error, 'fetchScripts');
  return data || [];
}

export async function createScript(script) {
  const { data, error } = await supabase.from('cc_scripts').insert(script).select().single();
  if (error) handleError(error, 'createScript');
  return data;
}

export async function updateScript(id, updates) {
  const { data, error } = await supabase.from('cc_scripts')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateScript');
  return data;
}

export async function deleteScript(id) {
  const { error } = await supabase.from('cc_scripts').delete().eq('id', id);
  if (error) handleError(error, 'deleteScript');
}

// ─── SETTINGS ───────────────────────────────
export async function fetchSettings() {
  const { data, error } = await supabase.from('cc_settings').select('*');
  if (error) handleError(error, 'fetchSettings');
  const settings = {};
  (data || []).forEach(s => { settings[s.setting_key] = s.setting_value; });
  return settings;
}

export async function saveSetting(key, value, userId) {
  const { data, error } = await supabase.from('cc_settings')
    .upsert({ setting_key: key, setting_value: value, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'setting_key' }).select().single();
  if (error) handleError(error, 'saveSetting');
  return data;
}

// ─── DASHBOARD STATS ────────────────────────
export async function fetchCallCenterDashboard() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [agentsRes, callsRes, queueRes, stlRes] = await Promise.all([
    supabase.from('cc_agents').select('id, status, calls_today, avg_call_duration'),
    supabase.from('cc_calls').select('id, status, direction, duration_seconds')
      .gte('started_at', todayStart.toISOString()),
    supabase.from('cc_queue').select('id, status, priority, queue_type')
      .in('status', ['pending', 'in_progress', 'rescheduled']),
    supabase.from('cc_speed_to_lead').select('id, status, response_time_seconds')
      .in('status', ['new', 'attempting']),
  ]);

  const agents = agentsRes.data || [];
  const calls = callsRes.data || [];
  const queue = queueRes.data || [];
  const stl = stlRes.data || [];

  return {
    agents: {
      total: agents.length,
      available: agents.filter(a => a.status === 'available').length,
      on_call: agents.filter(a => a.status === 'on_call').length,
      offline: agents.filter(a => a.status === 'offline').length,
    },
    calls_today: {
      total: calls.length,
      completed: calls.filter(c => c.status === 'completed').length,
      missed: calls.filter(c => c.status === 'missed').length,
      active: calls.filter(c => ['ringing', 'in_progress'].includes(c.status)).length,
    },
    queue: {
      total: queue.length,
      urgent: queue.filter(q => q.priority === 'urgent' || q.priority === 'high').length,
      callbacks: queue.filter(q => q.queue_type === 'callback').length,
    },
    speed_to_lead: {
      pending: stl.length,
      avg_response: stl.length > 0
        ? Math.round(stl.reduce((s, l) => s + (l.response_time_seconds || 0), 0) / stl.length)
        : 0,
    },
  };
}

// ─── SCHEDULED CALLS ───────────────────────
export async function fetchScheduledCalls({ agentId, status, dateFrom, dateTo } = {}) {
  let query = supabase.from('cc_scheduled_calls')
    .select('*, assigned_to_profile:profiles!cc_scheduled_calls_assigned_to_fkey(id, full_name, avatar_url, role), assigned_by_profile:profiles!cc_scheduled_calls_assigned_by_fkey(id, full_name)')
    .order('scheduled_at', { ascending: true });
  if (agentId) query = query.eq('assigned_to', agentId);
  if (status && status !== 'all') query = query.eq('status', status);
  else query = query.in('status', ['scheduled', 'confirmed', 'in_progress', 'rescheduled']);
  if (dateFrom) query = query.gte('scheduled_at', dateFrom);
  if (dateTo) query = query.lte('scheduled_at', dateTo);
  const { data, error } = await query;
  if (error) handleError(error, 'fetchScheduledCalls');
  return data || [];
}

export async function createScheduledCall(call) {
  const { data, error } = await supabase.from('cc_scheduled_calls')
    .insert(call).select().single();
  if (error) handleError(error, 'createScheduledCall');
  return data;
}

export async function updateScheduledCall(id, updates) {
  const { data, error } = await supabase.from('cc_scheduled_calls')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) handleError(error, 'updateScheduledCall');
  return data;
}

export async function cancelScheduledCall(id) {
  return updateScheduledCall(id, { status: 'cancelled' });
}

export async function completeScheduledCall(id, outcome) {
  return updateScheduledCall(id, {
    status: 'completed',
    outcome: outcome || '',
    completed_at: new Date().toISOString(),
  });
}

export async function checkAgentAvailability(agentId, scheduledAt, durationMinutes = 30) {
  const { data, error } = await supabase.rpc('check_agent_available', {
    p_agent_id: agentId,
    p_scheduled_at: scheduledAt,
    p_duration_minutes: durationMinutes,
  });
  if (error) handleError(error, 'checkAgentAvailability');
  return data;
}

// ─── AGENT AVAILABILITY ────────────────────
export async function fetchAgentAvailability(agentId) {
  const { data, error } = await supabase.from('cc_agent_availability')
    .select('*')
    .eq('agent_user_id', agentId)
    .order('day_of_week');
  if (error) handleError(error, 'fetchAgentAvailability');
  return data || [];
}

export async function fetchAllAgentAvailability() {
  const { data, error } = await supabase.from('cc_agent_availability')
    .select('*, profile:profiles!cc_agent_availability_agent_user_id_fkey(id, full_name, avatar_url, role)')
    .order('agent_user_id')
    .order('day_of_week');
  if (error) handleError(error, 'fetchAllAgentAvailability');
  return data || [];
}

export async function upsertAgentAvailability(agentId, dayOfWeek, startTime, endTime, isAvailable) {
  const { data, error } = await supabase.from('cc_agent_availability')
    .upsert({
      agent_user_id: agentId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_available: isAvailable,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_user_id,day_of_week' })
    .select().single();
  if (error) handleError(error, 'upsertAgentAvailability');
  return data;
}

export async function fetchAgentBlockedTimes(agentId, dateFrom, dateTo) {
  let query = supabase.from('cc_agent_blocked_times')
    .select('*')
    .eq('agent_user_id', agentId)
    .order('blocked_date');
  if (dateFrom) query = query.gte('blocked_date', dateFrom);
  if (dateTo) query = query.lte('blocked_date', dateTo);
  const { data, error } = await query;
  if (error) handleError(error, 'fetchAgentBlockedTimes');
  return data || [];
}

export async function createBlockedTime(agentId, blockedDate, startTime, endTime, reason) {
  const { data, error } = await supabase.from('cc_agent_blocked_times')
    .insert({
      agent_user_id: agentId,
      blocked_date: blockedDate,
      start_time: startTime || null,
      end_time: endTime || null,
      reason: reason || '',
    }).select().single();
  if (error) handleError(error, 'createBlockedTime');
  return data;
}

export async function deleteBlockedTime(id) {
  const { error } = await supabase.from('cc_agent_blocked_times').delete().eq('id', id);
  if (error) handleError(error, 'deleteBlockedTime');
}

// ─── VOICEMAILS ────────────────────────────
export async function fetchVoicemails({ targetType, targetAgentId, status } = {}) {
  let query = supabase.from('cc_voicemails')
    .select('*')
    .order('created_at', { ascending: false });
  if (targetType) query = query.eq('target_type', targetType);
  if (targetAgentId) query = query.eq('target_agent_id', targetAgentId);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) handleError(error, 'fetchVoicemails');
  return data || [];
}

export async function markVoicemailRead(id, userId) {
  const { data, error } = await supabase.from('cc_voicemails')
    .update({
      is_read: true,
      read_by: userId,
      read_at: new Date().toISOString(),
      status: 'read',
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
  if (error) handleError(error, 'markVoicemailRead');
  return data;
}

export async function updateVoicemailStatus(id, newStatus) {
  const { data, error } = await supabase.from('cc_voicemails')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) handleError(error, 'updateVoicemailStatus');
  return data;
}

export async function archiveVoicemail(id) {
  return updateVoicemailStatus(id, 'archived');
}
