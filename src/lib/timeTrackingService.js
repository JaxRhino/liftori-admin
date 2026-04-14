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

// ═══════════════════════════════════════════════
// TIMESHEET AGGREGATES
// ═══════════════════════════════════════════════

/**
 * Group completed entries by day (YYYY-MM-DD). Returns a map.
 */
export function groupByDay(entries) {
  const out = {}
  for (const e of entries) {
    if (!e.clock_in_at) continue
    const d = new Date(e.clock_in_at).toISOString().slice(0, 10)
    if (!out[d]) out[d] = { date: d, minutes: 0, sessions: 0, user_id: e.user_id }
    out[d].minutes += Number(e.duration_minutes || 0)
    out[d].sessions += 1
  }
  return Object.values(out).sort((a, b) => (a.date > b.date ? -1 : 1))
}

/**
 * Group by ISO week (YYYY-Www).
 */
export function groupByWeek(entries) {
  const out = {}
  for (const e of entries) {
    if (!e.clock_in_at) continue
    const d = new Date(e.clock_in_at)
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dow = tmp.getUTCDay() || 7
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dow)
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
    const weekNum = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7)
    const key = `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
    if (!out[key]) out[key] = { week: key, minutes: 0, sessions: 0 }
    out[key].minutes += Number(e.duration_minutes || 0)
    out[key].sessions += 1
  }
  return Object.values(out).sort((a, b) => (a.week > b.week ? -1 : 1))
}

export function groupByMonth(entries) {
  const out = {}
  for (const e of entries) {
    if (!e.clock_in_at) continue
    const key = new Date(e.clock_in_at).toISOString().slice(0, 7) // YYYY-MM
    if (!out[key]) out[key] = { month: key, minutes: 0, sessions: 0 }
    out[key].minutes += Number(e.duration_minutes || 0)
    out[key].sessions += 1
  }
  return Object.values(out).sort((a, b) => (a.month > b.month ? -1 : 1))
}

/**
 * Build a CSV string from entries. Columns: date, user, entry_type, hours, notes.
 */
export function entriesToCSV(entries, userLookup = {}) {
  const header = ['date', 'start_time', 'end_time', 'user', 'entry_type', 'duration_hours', 'status', 'notes']
  const rows = entries.map((e) => {
    const start = e.clock_in_at ? new Date(e.clock_in_at) : null
    const end = e.clock_out_at ? new Date(e.clock_out_at) : null
    const userName = userLookup[e.user_id]?.full_name || userLookup[e.user_id]?.email || e.user_id
    const hours = e.duration_minutes ? (Number(e.duration_minutes) / 60).toFixed(2) : ''
    return [
      start ? start.toISOString().slice(0, 10) : '',
      start ? start.toISOString().slice(11, 19) : '',
      end ? end.toISOString().slice(11, 19) : '',
      userName,
      e.entry_type || '',
      hours,
      e.status || '',
      (e.notes || '').replace(/"/g, '""'),
    ]
  })
  const lines = [header, ...rows].map((r) => r.map((v) => `"${v ?? ''}"`).join(','))
  return lines.join('\n')
}

export function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ═══════════════════════════════════════════════
// TESTER ENROLLMENT
// ═══════════════════════════════════════════════
export async function fetchEnrollments({ activeOnly = true } = {}) {
  let query = supabase.from('tester_enrollments').select('*')
  if (activeOnly) query = query.is('ended_at', null)
  const { data, error } = await query.order('enrolled_at', { ascending: false })
  if (error) handleError(error, 'fetchEnrollments')
  return data || []
}

export async function fetchMyEnrollment(userId) {
  const { data, error } = await supabase
    .from('tester_enrollments')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') handleError(error, 'fetchMyEnrollment')
  return data || null
}

export async function enrollTester({ userId, commissionRate = 0.05, minHoursPerPeriod = 10, notes = null, enrolledBy }) {
  const { data, error } = await supabase
    .from('tester_enrollments')
    .insert({
      user_id: userId,
      commission_rate: commissionRate,
      min_hours_per_period: minHoursPerPeriod,
      enrolled_by: enrolledBy,
      notes,
    })
    .select()
    .single()
  if (error) handleError(error, 'enrollTester')
  return data
}

export async function endEnrollment(enrollmentId) {
  const { data, error } = await supabase
    .from('tester_enrollments')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', enrollmentId)
    .select()
    .single()
  if (error) handleError(error, 'endEnrollment')
  return data
}

// ═══════════════════════════════════════════════
// COMMISSION PERIODS + ALLOCATIONS
// ═══════════════════════════════════════════════
export async function fetchPeriods({ limit = 24 } = {}) {
  const { data, error } = await supabase
    .from('tester_commission_periods')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(limit)
  if (error) handleError(error, 'fetchPeriods')
  return data || []
}

export async function fetchMyAllocations(userId) {
  const { data, error } = await supabase
    .from('tester_commission_allocations')
    .select('*, tester_commission_periods(period_start, period_end, status, net_profit, pool_amount)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) handleError(error, 'fetchMyAllocations')
  return data || []
}

export async function fetchPeriodAllocations(periodId) {
  const { data, error } = await supabase
    .from('tester_commission_allocations')
    .select('*')
    .eq('period_id', periodId)
    .order('share_amount', { ascending: false })
  if (error) handleError(error, 'fetchPeriodAllocations')
  return data || []
}

export async function createPeriod({ periodType = 'monthly', periodStart, periodEnd, netProfit, commissionRate = 0.05, minHoursToQualify = 10, notes = null, createdBy }) {
  const { data, error } = await supabase
    .from('tester_commission_periods')
    .insert({
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      net_profit: netProfit,
      commission_rate: commissionRate,
      min_hours_to_qualify: minHoursToQualify,
      notes,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) handleError(error, 'createPeriod')
  return data
}

export async function updatePeriod(id, updates) {
  const { data, error } = await supabase
    .from('tester_commission_periods')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) handleError(error, 'updatePeriod')
  return data
}

/** Calls the DB function that computes hours-by-user, qualifies them, and splits the pool. */
export async function closePeriod(periodId, closedBy) {
  const { data, error } = await supabase.rpc('close_commission_period', {
    p_period_id: periodId,
    p_closed_by: closedBy,
  })
  if (error) handleError(error, 'closePeriod')
  return data
}

export async function markPeriodPaid(periodId) {
  return updatePeriod(periodId, { status: 'paid', paid_at: new Date().toISOString() })
}

export async function markAllocationPaid(allocationId, { paymentMethod, paymentReference }) {
  const { data, error } = await supabase
    .from('tester_commission_allocations')
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod,
      payment_reference: paymentReference,
    })
    .eq('id', allocationId)
    .select()
    .single()
  if (error) handleError(error, 'markAllocationPaid')
  return data
}

export function formatCurrency(n) {
  if (n == null || isNaN(Number(n))) return '$0.00'
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
