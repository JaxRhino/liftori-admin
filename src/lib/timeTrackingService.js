import { supabase } from './supabase'

// ─── HELPERS ─────────────────────────────────
function handleError(error, fn) {
  console.error(`[timeTrackingService.${fn}]`, error)
  throw error
}

// ═══════════════════════════════════════════════
// TIME ENTRIES (clock in / out)
// ═══════════════════════════════════════════════

/** Returns the user's currently active session (or null). */
export async function fetchActiveEntry(userId) {
  const { data, error } = await supabase
    .from('team_time_entries')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('clock_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') handleError(error, 'fetchActiveEntry')
  return data || null
}

/** Start a new clock session. Fails if user already has an active one. */
export async function clockIn({ userId, orgId = null, entryType = 'testing', notes = null, location = null }) {
  const payload = {
    user_id: userId,
    org_id: orgId,
    entry_type: entryType,
    notes,
    location,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }
  const { data, error } = await supabase
    .from('team_time_entries')
    .insert(payload)
    .select()
    .single()
  if (error) handleError(error, 'clockIn')
  return data
}

/** Close the active session. */
export async function clockOut(entryId, { notes = null } = {}) {
  const updates = {
    clock_out_at: new Date().toISOString(),
    status: 'completed',
  }
  if (notes !== null) updates.notes = notes
  const { data, error } = await supabase
    .from('team_time_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single()
  if (error) handleError(error, 'clockOut')
  return data
}

export async function pauseEntry(entryId) {
  const { data, error } = await supabase
    .from('team_time_entries')
    .update({ status: 'paused' })
    .eq('id', entryId)
    .select()
    .single()
  if (error) handleError(error, 'pauseEntry')
  return data
}

export async function resumeEntry(entryId) {
  const { data, error } = await supabase
    .from('team_time_entries')
    .update({ status: 'active' })
    .eq('id', entryId)
    .select()
    .single()
  if (error) handleError(error, 'resumeEntry')
  return data
}

/** List recent sessions (default: the user's own; super_admin can pass userId=null to fetch all). */
export async function fetchEntries({ userId = null, limit = 50, since = null } = {}) {
  let query = supabase.from('team_time_entries').select('*')
  if (userId) query = query.eq('user_id', userId)
  if (since) query = query.gte('clock_in_at', since)
  const { data, error } = await query.order('clock_in_at', { ascending: false }).limit(limit)
  if (error) handleError(error, 'fetchEntries')
  return data || []
}

/** Aggregate totals per user for a date range. */
export async function fetchUserTotals({ since }) {
  const { data, error } = await supabase
    .from('team_time_entries')
    .select('user_id, duration_minutes, status, entry_type')
    .gte('clock_in_at', since)
    .eq('status', 'completed')
  if (error) handleError(error, 'fetchUserTotals')
  const totals = {}
  for (const row of data || []) {
    if (!totals[row.user_id]) totals[row.user_id] = { minutes: 0, sessions: 0 }
    totals[row.user_id].minutes += Number(row.duration_minutes || 0)
    totals[row.user_id].sessions += 1
  }
  return totals
}

// ═══════════════════════════════════════════════
// WORK LOGS (structured bug tracker entries)
// ═══════════════════════════════════════════════

export const LOG_CATEGORIES = ['bug', 'enhancement', 'question', 'observation', 'task_complete', 'note']
export const LOG_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']
export const LOG_STATUSES = ['open', 'triaged', 'in_progress', 'fixed', 'wontfix', 'cannot_reproduce', 'duplicate', 'closed']

/**
 * Create a work log entry. Requires an active time_entry_id.
 */
export async function createLog({
  userId,
  orgId = null,
  timeEntryId,
  category,
  severity = 'medium',
  screenPath = null,
  title,
  description = null,
  stepsToReproduce = null,
  expectedResult = null,
  actualResult = null,
  screenshots = [],
  consoleErrors = null,
  tags = [],
}) {
  if (!timeEntryId) {
    throw new Error('createLog: timeEntryId is required — user must be clocked in')
  }
  const payload = {
    user_id: userId,
    org_id: orgId,
    time_entry_id: timeEntryId,
    category,
    severity,
    screen_path: screenPath,
    title,
    description,
    steps_to_reproduce: stepsToReproduce,
    expected_result: expectedResult,
    actual_result: actualResult,
    screenshots,
    console_errors: consoleErrors,
    tags,
    browser_info:
      typeof navigator !== 'undefined'
        ? {
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            viewport:
              typeof window !== 'undefined'
                ? { w: window.innerWidth, h: window.innerHeight }
                : null,
          }
        : null,
  }
  const { data, error } = await supabase
    .from('team_work_logs')
    .insert(payload)
    .select()
    .single()
  if (error) handleError(error, 'createLog')
  return data
}

export async function fetchLogs({ userId = null, status = null, severity = null, category = null, limit = 200 } = {}) {
  let query = supabase.from('team_work_logs').select('*')
  if (userId) query = query.eq('user_id', userId)
  if (status) query = query.eq('status', status)
  if (severity) query = query.eq('severity', severity)
  if (category) query = query.eq('category', category)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
  if (error) handleError(error, 'fetchLogs')
  return data || []
}

export async function updateLog(id, updates) {
  const payload = { ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('team_work_logs')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) handleError(error, 'updateLog')
  return data
}

export async function resolveLog(id, { resolvedBy, resolutionNotes = null, newStatus = 'fixed' }) {
  return updateLog(id, {
    status: newStatus,
    resolved_by: resolvedBy,
    resolved_at: new Date().toISOString(),
    resolution_notes: resolutionNotes,
  })
}

export async function deleteLog(id) {
  const { error } = await supabase.from('team_work_logs').delete().eq('id', id)
  if (error) handleError(error, 'deleteLog')
}

// ═══════════════════════════════════════════════
// FORMATTING HELPERS
// ═══════════════════════════════════════════════
export function formatDuration(minutes) {
  if (minutes == null) return '—'
  const m = Number(minutes)
  if (isNaN(m)) return '—'
  const h = Math.floor(m / 60)
  const mm = Math.round(m % 60)
  if (h === 0) return `${mm}m`
  return `${h}h ${mm}m`
}

export function liveDuration(clockInAt) {
  if (!clockInAt) return 0
  return (new Date() - new Date(clockInAt)) / 60000
}
