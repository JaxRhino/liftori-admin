// ===========================================
// EOS Service Layer — Supabase backend
// Replaces all FastAPI/MongoDB endpoints from Rhino-1
// ===========================================
import { supabase } from './supabase';

// ─── Helpers ────────────────────────────────
function handleError(error, context) {
  console.error(`[EOS] ${context}:`, error);
  throw error;
}

// ─── ORG SCOPE HELPER ──────────────────────
// Adds .eq('org_id', orgId) to a query when orgId is provided
function scopeOrg(query, orgId) {
  return orgId ? query.eq('org_id', orgId) : query;
}

// ─── DASHBOARD ──────────────────────────────
export async function fetchDashboardStats(userId, orgId) {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());

    // Parallel fetches — all scoped to org
    const [meetingsRes, scorecardRes, rocksRes, issuesRes, todosRes, headlinesRes] = await Promise.all([
      scopeOrg(supabase.from('eos_meetings').select('id, title, scheduled_date, status')
        .gte('scheduled_date', now.toISOString())
        .in('status', ['scheduled', 'in_progress']), orgId)
        .order('scheduled_date', { ascending: true }).limit(1),
      scopeOrg(supabase.from('eos_scorecard_metrics').select('id, weekly_data, goal, thresholds, is_active')
        .eq('is_active', true), orgId),
      scopeOrg(supabase.from('eos_rocks').select('id, status, owner_id')
        .neq('status', 'complete'), orgId),
      scopeOrg(supabase.from('eos_issues').select('id, status')
        .in('status', ['identified', 'in_discussion']), orgId),
      scopeOrg(supabase.from('eos_todos').select('id, status, due_date, owner_id')
        .eq('status', 'open'), orgId),
      scopeOrg(supabase.from('eos_headlines').select('id, message, category, created_at, author_user_id'), orgId)
        .order('created_at', { ascending: false }).limit(5),
    ]);

    const scorecard = scorecardRes.data || [];
    const greenCount = scorecard.filter(m => {
      const latest = m.weekly_data?.[m.weekly_data.length - 1];
      return latest?.status === 'green';
    }).length;

    const rocks = rocksRes.data || [];
    const myRocks = userId ? rocks.filter(r => r.owner_id === userId) : rocks;
    const onTrack = myRocks.filter(r => r.status === 'on_track').length;

    const todos = todosRes.data || [];
    const myTodos = userId ? todos.filter(t => t.owner_id === userId) : todos;
    const dueThisWeek = myTodos.filter(t => {
      const d = new Date(t.due_date);
      return d <= new Date(weekStart.getTime() + 7 * 86400000);
    }).length;

    return {
      next_meeting: meetingsRes.data?.[0] || null,
      scorecard: { green_count: greenCount, total_metrics: scorecard.length },
      rocks: { on_track: onTrack, total: myRocks.length },
      issues: { open_count: (issuesRes.data || []).length },
      todos: { count: myTodos.length, due_this_week: dueThisWeek },
      headlines: headlinesRes.data || [],
    };
  } catch (e) { handleError(e, 'fetchDashboardStats'); }
}

// ─── SCORECARD ──────────────────────────────
export async function fetchScorecardMetrics(orgId) {
  let query = supabase.from('eos_scorecard_metrics')
    .select('*, owner:profiles!eos_scorecard_metrics_owner_id_fkey(id, full_name, avatar_url)')
    .eq('is_active', true);
  query = scopeOrg(query, orgId);
  const { data, error } = await query.order('display_order');
  if (error) handleError(error, 'fetchScorecardMetrics');
  return data || [];
}

export async function createScorecardMetric(metric) {
  const { data, error } = await supabase.from('eos_scorecard_metrics').insert(metric).select().single();
  if (error) handleError(error, 'createScorecardMetric');
  return data;
}

export async function updateScorecardMetric(id, updates) {
  const { data, error } = await supabase.from('eos_scorecard_metrics')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateScorecardMetric');
  return data;
}

export async function updateMetricValue(metricId, weekData) {
  // Fetch current, append new week data
  const { data: current } = await supabase.from('eos_scorecard_metrics')
    .select('weekly_data').eq('id', metricId).single();
  const existingData = current?.weekly_data || [];
  // Replace if same week, otherwise append
  const idx = existingData.findIndex(w => w.week_start_date === weekData.week_start_date);
  if (idx >= 0) existingData[idx] = weekData;
  else existingData.push(weekData);

  const { data, error } = await supabase.from('eos_scorecard_metrics')
    .update({ weekly_data: existingData, updated_at: new Date().toISOString() })
    .eq('id', metricId).select().single();
  if (error) handleError(error, 'updateMetricValue');
  return data;
}

export async function deleteScorecardMetric(id) {
  const { error } = await supabase.from('eos_scorecard_metrics').delete().eq('id', id);
  if (error) handleError(error, 'deleteScorecardMetric');
}

// ─── ROCKS ──────────────────────────────────
export async function fetchRocks(quarter, orgId) {
  let query = supabase.from('eos_rocks')
    .select('*, owner:profiles!eos_rocks_owner_id_fkey(id, full_name, avatar_url)');
  if (quarter) query = query.eq('quarter', quarter);
  query = scopeOrg(query, orgId);
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) handleError(error, 'fetchRocks');
  return data || [];
}

export async function createRock(rock) {
  const { data, error } = await supabase.from('eos_rocks').insert(rock).select().single();
  if (error) handleError(error, 'createRock');
  return data;
}

export async function updateRock(id, updates) {
  const { data, error } = await supabase.from('eos_rocks')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateRock');
  return data;
}

export async function updateRockProgress(id, progress, status, notes, userId) {
  const { data: current } = await supabase.from('eos_rocks')
    .select('progress_percentage, status, update_history').eq('id', id).single();
  const history = current?.update_history || [];
  history.push({
    timestamp: new Date().toISOString(),
    progress_before: current?.progress_percentage || 0,
    progress_after: progress,
    status,
    notes: notes || '',
    updated_by: userId,
  });
  const isComplete = status === 'complete' || progress >= 100;
  const { data, error } = await supabase.from('eos_rocks').update({
    progress_percentage: progress,
    status,
    update_history: history,
    is_complete: isComplete,
    completed_at: isComplete ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single();
  if (error) handleError(error, 'updateRockProgress');
  return data;
}

export async function deleteRock(id) {
  const { error } = await supabase.from('eos_rocks').delete().eq('id', id);
  if (error) handleError(error, 'deleteRock');
}

// ─── ISSUES ─────────────────────────────────
export async function fetchIssues(status, orgId) {
  let query = supabase.from('eos_issues')
    .select('*, owner:profiles!eos_issues_owner_id_fkey(id, full_name, avatar_url), reporter:profiles!eos_issues_reporter_id_fkey(id, full_name)');
  if (status && status !== 'all') query = query.eq('status', status);
  query = scopeOrg(query, orgId);
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) handleError(error, 'fetchIssues');
  return data || [];
}

export async function createIssue(issue) {
  const { data, error } = await supabase.from('eos_issues').insert(issue).select().single();
  if (error) handleError(error, 'createIssue');
  return data;
}

export async function updateIssue(id, updates) {
  const { data, error } = await supabase.from('eos_issues')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateIssue');
  return data;
}

export async function deleteIssue(id) {
  const { error } = await supabase.from('eos_issues').delete().eq('id', id);
  if (error) handleError(error, 'deleteIssue');
}

// ─── TODOS ──────────────────────────────────
export async function fetchTodos(status, orgId) {
  let query = supabase.from('eos_todos')
    .select('*, owner:profiles!eos_todos_owner_id_fkey(id, full_name, avatar_url)');
  if (status && status !== 'all') query = query.eq('status', status);
  query = scopeOrg(query, orgId);
  query = query.order('due_date', { ascending: true });
  const { data, error } = await query;
  if (error) handleError(error, 'fetchTodos');
  return data || [];
}

export async function createTodo(todo) {
  const { data, error } = await supabase.from('eos_todos').insert(todo).select().single();
  if (error) handleError(error, 'createTodo');
  return data;
}

export async function updateTodo(id, updates) {
  const { data, error } = await supabase.from('eos_todos')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateTodo');
  return data;
}

export async function completeTodo(id, userId) {
  const { data, error } = await supabase.from('eos_todos').update({
    status: 'complete', completed_at: new Date().toISOString(), completed_by: userId,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single();
  if (error) handleError(error, 'completeTodo');
  return data;
}

export async function reopenTodo(id) {
  const { data, error } = await supabase.from('eos_todos').update({
    status: 'open', completed_at: null, completed_by: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single();
  if (error) handleError(error, 'reopenTodo');
  return data;
}

export async function deleteTodo(id) {
  const { error } = await supabase.from('eos_todos').delete().eq('id', id);
  if (error) handleError(error, 'deleteTodo');
}

// ─── HEADLINES ──────────────────────────────
export async function fetchHeadlines(category, orgId) {
  let query = supabase.from('eos_headlines')
    .select('*, author:profiles!eos_headlines_author_user_id_fkey(id, full_name, avatar_url)');
  if (category && category !== 'all') query = query.eq('category', category);
  query = scopeOrg(query, orgId);
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) handleError(error, 'fetchHeadlines');
  return data || [];
}

export async function createHeadline(headline) {
  const { data, error } = await supabase.from('eos_headlines').insert(headline).select().single();
  if (error) handleError(error, 'createHeadline');
  return data;
}

export async function updateHeadline(id, updates) {
  const { data, error } = await supabase.from('eos_headlines')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateHeadline');
  return data;
}

export async function addHeadlineReaction(id, userId, emoji) {
  const { data: headline } = await supabase.from('eos_headlines').select('reactions').eq('id', id).single();
  const reactions = headline?.reactions || [];
  const existing = reactions.findIndex(r => r.user_id === userId && r.emoji === emoji);
  if (existing >= 0) reactions.splice(existing, 1);
  else reactions.push({ user_id: userId, emoji, timestamp: new Date().toISOString() });
  const { data, error } = await supabase.from('eos_headlines')
    .update({ reactions, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'addHeadlineReaction');
  return data;
}

export async function addHeadlineComment(id, userId, text) {
  const { data: headline } = await supabase.from('eos_headlines').select('comments').eq('id', id).single();
  const comments = headline?.comments || [];
  comments.push({ id: crypto.randomUUID(), user_id: userId, text, timestamp: new Date().toISOString() });
  const { data, error } = await supabase.from('eos_headlines')
    .update({ comments, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'addHeadlineComment');
  return data;
}

export async function deleteHeadline(id) {
  const { error } = await supabase.from('eos_headlines').delete().eq('id', id);
  if (error) handleError(error, 'deleteHeadline');
}

// ─── L10 MEETINGS ───────────────────────────
export async function fetchMeetings(orgId) {
  let query = supabase.from('eos_meetings')
    .select('*, facilitator:profiles!eos_meetings_facilitator_id_fkey(id, full_name, avatar_url)');
  query = scopeOrg(query, orgId);
  const { data, error } = await query.order('scheduled_date', { ascending: false });
  if (error) handleError(error, 'fetchMeetings');
  return data || [];
}

export async function fetchMeeting(id) {
  const { data, error } = await supabase.from('eos_meetings')
    .select('*, facilitator:profiles!eos_meetings_facilitator_id_fkey(id, full_name, avatar_url)')
    .eq('id', id).single();
  if (error) handleError(error, 'fetchMeeting');
  return data;
}

export async function createMeeting(meeting) {
  // Auto-generate meeting number
  const { count } = await supabase.from('eos_meetings').select('id', { count: 'exact', head: true });
  const { data, error } = await supabase.from('eos_meetings')
    .insert({ ...meeting, meeting_number: (count || 0) + 1 }).select().single();
  if (error) handleError(error, 'createMeeting');
  return data;
}

export async function updateMeeting(id, updates) {
  const { data, error } = await supabase.from('eos_meetings')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateMeeting');
  return data;
}

export async function startMeeting(id) {
  return updateMeeting(id, { status: 'in_progress', start_time: new Date().toISOString() });
}

export async function completeMeeting(id) {
  return updateMeeting(id, {
    status: 'complete', end_time: new Date().toISOString(), completed_at: new Date().toISOString(),
  });
}

export async function deleteMeeting(id) {
  const { error } = await supabase.from('eos_meetings').delete().eq('id', id);
  if (error) handleError(error, 'deleteMeeting');
}

// ─── ACCOUNTABILITY CHART ───────────────────
export async function fetchAccountabilityChart(orgId) {
  let query = supabase.from('eos_accountability_charts')
    .select('*').eq('is_active', true);
  query = scopeOrg(query, orgId);
  const { data, error } = await query.order('version', { ascending: false }).limit(1).single();
  if (error && error.code !== 'PGRST116') handleError(error, 'fetchAccountabilityChart');
  return data || { seats: [] };
}

export async function saveAccountabilityChart(chart) {
  if (chart.id) {
    const { data, error } = await supabase.from('eos_accountability_charts')
      .update({ ...chart, updated_at: new Date().toISOString() }).eq('id', chart.id).select().single();
    if (error) handleError(error, 'saveAccountabilityChart');
    return data;
  } else {
    const { data, error } = await supabase.from('eos_accountability_charts')
      .insert(chart).select().single();
    if (error) handleError(error, 'saveAccountabilityChart');
    return data;
  }
}

// ─── V/TO ───────────────────────────────────
export async function fetchVTO(orgId) {
  let query = supabase.from('eos_vto')
    .select('*').eq('is_active', true);
  query = scopeOrg(query, orgId);
  const { data, error } = await query.order('version', { ascending: false }).limit(1).single();
  if (error && error.code !== 'PGRST116') handleError(error, 'fetchVTO');
  return data || null;
}

export async function saveVTO(vto) {
  if (vto.id) {
    const { data, error } = await supabase.from('eos_vto')
      .update({ ...vto, updated_at: new Date().toISOString() }).eq('id', vto.id).select().single();
    if (error) handleError(error, 'saveVTO');
    return data;
  } else {
    const { data, error } = await supabase.from('eos_vto').insert(vto).select().single();
    if (error) handleError(error, 'saveVTO');
    return data;
  }
}

// ─── SCORECARD SNAPSHOTS ────────────────────
export async function createScorecardSnapshot(snapshot) {
  const { data, error } = await supabase.from('eos_scorecard_snapshots')
    .insert(snapshot).select().single();
  if (error) handleError(error, 'createScorecardSnapshot');
  return data;
}

// ─── USERS (for dropdowns) ──────────────────
export async function fetchTeamUsers() {
  const { data, error } = await supabase.from('profiles')
    .select('id, full_name, avatar_url, email, role')
    .eq('role', 'admin')
    .order('full_name');
  if (error) handleError(error, 'fetchTeamUsers');
  return data || [];
}

// ─── LEADERSHIP DASHBOARD ───────────────────
export async function fetchLeadershipDashboard(orgId) {
  const [rocks, issues, todos, meetings, scorecard] = await Promise.all([
    scopeOrg(supabase.from('eos_rocks').select('id, status, owner_id, progress_percentage, quarter'), orgId),
    scopeOrg(supabase.from('eos_issues').select('id, status, priority, created_at'), orgId),
    scopeOrg(supabase.from('eos_todos').select('id, status, due_date, owner_id'), orgId),
    scopeOrg(supabase.from('eos_meetings').select('id, status, scheduled_date, completed_at'), orgId).order('scheduled_date', { ascending: false }).limit(20),
    scopeOrg(supabase.from('eos_scorecard_metrics').select('id, weekly_data, goal, thresholds, is_active, category').eq('is_active', true), orgId),
  ]);

  const allRocks = rocks.data || [];
  const allIssues = issues.data || [];
  const allTodos = todos.data || [];
  const allMeetings = meetings.data || [];
  const allMetrics = scorecard.data || [];

  const completedMeetings = allMeetings.filter(m => m.status === 'complete').length;
  const totalMeetings = allMeetings.length;

  return {
    summary: { total_teams: 1 },
    meetings: { l10_completion_rate: totalMeetings ? Math.round((completedMeetings / totalMeetings) * 100) : 0, total: totalMeetings, completed: completedMeetings },
    rocks: {
      on_track: allRocks.filter(r => r.status === 'on_track').length,
      at_risk: allRocks.filter(r => r.status === 'at_risk').length,
      off_track: allRocks.filter(r => r.status === 'off_track').length,
      complete: allRocks.filter(r => r.status === 'complete').length,
      total: allRocks.length,
    },
    scorecard: {
      green: allMetrics.filter(m => m.weekly_data?.[m.weekly_data?.length - 1]?.status === 'green').length,
      yellow: allMetrics.filter(m => m.weekly_data?.[m.weekly_data?.length - 1]?.status === 'yellow').length,
      red: allMetrics.filter(m => m.weekly_data?.[m.weekly_data?.length - 1]?.status === 'red').length,
      total: allMetrics.length,
    },
    issues: {
      open: allIssues.filter(i => i.status === 'identified').length,
      discussing: allIssues.filter(i => i.status === 'in_discussion').length,
      solved: allIssues.filter(i => i.status === 'solved').length,
      total: allIssues.length,
    },
    todos: {
      open: allTodos.filter(t => t.status === 'open').length,
      complete: allTodos.filter(t => t.status === 'complete').length,
      overdue: allTodos.filter(t => t.status === 'open' && new Date(t.due_date) < new Date()).length,
      total: allTodos.length,
    },
    recent_meetings: allMeetings.slice(0, 10),
  };
}
