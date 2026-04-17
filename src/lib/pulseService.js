/**
 * pulseService — Team time-clock + leaderboard helpers.
 *
 * Backed by:
 *   work_sessions            — one row per clock-in session
 *   pulse_adjustments        — audit log for edits/deletes/offline creates
 *   RPC start_session()      — idempotent clock-in
 *   RPC end_session(reason)  — idempotent clock-out (enforces min/max)
 *   RPC add_offline_session(start, end, notes)
 *   RPC edit_session(id, start, end, reason)    — founder-only
 *   RPC delete_session_admin(id, reason)        — founder-only
 *   RPC reap_idle_sessions(minutes)             — housekeeping
 *   RPC pulse_heartbeat()                       — bumps updated_at on open session
 *   View v_pulse_live_now, v_pulse_weekly, v_pulse_week_daily, v_pulse_all_time
 *
 * Full team transparency: all internal team members can read all sessions
 * and the leaderboards (this is by design — peer accountability is the point).
 * Customers cannot read anything here.
 */
import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════════
// TIER CATALOG — gamified ranks keyed off TTD hours
// ═══════════════════════════════════════════════════════════════════════

export const PULSE_TIERS = [
  { key: 'rookie',   label: 'Rookie',   minHours:    0, color: 'slate',   hint: 'Just getting started' },
  { key: 'regular',  label: 'Regular',  minHours:   40, color: 'sky',     hint: 'Putting in the hours' },
  { key: 'operator', label: 'Operator', minHours:  200, color: 'emerald', hint: 'Real contributor' },
  { key: 'vet',      label: 'Vet',      minHours:  500, color: 'amber',   hint: 'Battle-tested' },
  { key: 'legend',   label: 'Legend',   minHours: 1000, color: 'rose',    hint: 'Carrying the team' },
]

export function tierFor(ttdSeconds) {
  const hours = (ttdSeconds || 0) / 3600
  return (
    [...PULSE_TIERS].reverse().find((t) => hours >= t.minHours) || PULSE_TIERS[0]
  )
}

export const TIER_STYLES = {
  rookie:   { bg: 'bg-slate-500/15',   text: 'text-slate-300',   border: 'border-slate-500/40',   ring: 'ring-slate-500/40' },
  regular:  { bg: 'bg-sky-500/15',     text: 'text-sky-300',     border: 'border-sky-500/40',     ring: 'ring-sky-500/40' },
  operator: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/40', ring: 'ring-emerald-500/40' },
  vet:      { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/40',   ring: 'ring-amber-500/40' },
  legend:   { bg: 'bg-rose-500/15',    text: 'text-rose-300',    border: 'border-rose-500/40',    ring: 'ring-rose-500/40' },
}

export function tierStyleFor(key) {
  return TIER_STYLES[key] || TIER_STYLES.rookie
}

// ═══════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════

/** "HH:MM:SS" for running clocks */
export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

/** "2h 14m" style for leaderboards */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  if (s < 60) return `${s}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

/** "3.5h" compact */
export function formatHours(seconds) {
  return `${((seconds || 0) / 3600).toFixed(1)}h`
}

/** datetime-local input value <-> ISO */
export function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ═══════════════════════════════════════════════════════════════════════
// CLOCK RPCs (via SECURITY DEFINER functions)
// ═══════════════════════════════════════════════════════════════════════

/** Clock in — idempotent. Returns the open session. */
export async function startSession() {
  const { data, error } = await supabase.rpc('start_session')
  if (error) throw error
  return data
}

/** Clock out — idempotent. Returns the closed session or null if nothing was open. */
export async function endSession(reason = 'manual') {
  const { data, error } = await supabase.rpc('end_session', { p_reason: reason })
  if (error) throw error
  return data
}

/** Get the current user's in-progress session, if any. */
export async function getMyOpenSession() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', user.id)
    .is('ended_at', null)
    .maybeSingle()
  if (error) throw error
  return data || null
}

/** Lightweight ping to prove activity — bumps updated_at on the open session. */
export async function heartbeat() {
  try {
    await supabase.rpc('pulse_heartbeat')
  } catch (err) {
    // Non-fatal — idle reaper tolerates occasional misses
    console.warn('[pulse] heartbeat failed:', err?.message)
  }
}

/** Client-triggered sweep of stale open sessions. Safe to call from any team member. */
export async function reapIdle(minutes = 15) {
  const { data, error } = await supabase.rpc('reap_idle_sessions', { p_idle_minutes: minutes })
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════════════════════
// OFFLINE ENTRIES + ADMIN EDITS
// ═══════════════════════════════════════════════════════════════════════

/** Current user logs work done outside the platform. Notes required. */
export async function addOfflineSession({ started_at, ended_at, notes }) {
  if (!started_at || !ended_at) throw new Error('Start and end required')
  if (!notes || notes.trim().length < 3) throw new Error('Notes required for offline entries')
  const { data, error } = await supabase.rpc('add_offline_session', {
    p_started_at: new Date(started_at).toISOString(),
    p_ended_at:   new Date(ended_at).toISOString(),
    p_notes:      notes.trim(),
  })
  if (error) throw error
  return data
}

/** Founder-only. Correct a session's in/out times. Reason required. */
export async function editSession({ session_id, started_at, ended_at, reason }) {
  if (!session_id) throw new Error('session_id required')
  if (!reason || reason.trim().length < 3) throw new Error('Reason required')
  const { data, error } = await supabase.rpc('edit_session', {
    p_session_id: session_id,
    p_started_at: new Date(started_at).toISOString(),
    p_ended_at:   new Date(ended_at).toISOString(),
    p_reason:     reason.trim(),
  })
  if (error) throw error
  return data
}

/** Founder-only. Hard-delete a session. Reason required. */
export async function deleteSessionAdmin({ session_id, reason }) {
  if (!session_id) throw new Error('session_id required')
  if (!reason || reason.trim().length < 3) throw new Error('Reason required')
  const { error } = await supabase.rpc('delete_session_admin', {
    p_session_id: session_id,
    p_reason:     reason.trim(),
  })
  if (error) throw error
}

/** User deletes their own offline entry (RLS enforces is_offline + own). */
export async function deleteMyOfflineSession(session_id) {
  const { error } = await supabase
    .from('work_sessions')
    .delete()
    .eq('id', session_id)
    .eq('is_offline', true)
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════════
// READS — Leaderboard + Live Now + History
// ═══════════════════════════════════════════════════════════════════════

export async function fetchLiveNow() {
  const { data, error } = await supabase
    .from('v_pulse_live_now')
    .select('*')
  if (error) throw error
  return data || []
}

export async function fetchWeeklyLeaderboard() {
  const { data, error } = await supabase
    .from('v_pulse_weekly')
    .select('*')
    .order('weekly_seconds', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchWeekDaily() {
  const { data, error } = await supabase
    .from('v_pulse_week_daily')
    .select('*')
  if (error) throw error
  return data || []
}

export async function fetchAllTimeLeaderboard() {
  const { data, error } = await supabase
    .from('v_pulse_all_time')
    .select('*')
    .order('ttd_seconds', { ascending: false })
  if (error) throw error
  return data || []
}

/** Sessions for a given user (self by default). */
export async function fetchUserSessions(userId, { limit = 50 } = {}) {
  let q = supabase
    .from('work_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

/** Audit log for a given user. */
export async function fetchAdjustmentsFor(userId, { limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('pulse_adjustments')
    .select('*')
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// ═══════════════════════════════════════════════════════════════════════
// DERIVED HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Take v_pulse_week_daily rows and group by user_id into [mon..sun] seconds arrays. */
export function groupWeekDailyByUser(rows) {
  const out = {}
  for (const r of rows || []) {
    if (!out[r.user_id]) out[r.user_id] = new Array(7).fill(0)
    if (r.day_index >= 0 && r.day_index <= 6) out[r.user_id][r.day_index] = r.day_seconds || 0
  }
  return out
}

/** True if a given email is in the LIFTORI_FOUNDERS allowlist (mirror of is_founder()). */
export const LIFTORI_FOUNDERS = [
  'ryan@liftori.ai',
  'mike@liftori.ai',
  'rhinomarch78@gmail.com',
  '4sherpanation@gmail.com',
]

export function isFounderEmail(email) {
  if (!email) return false
  return LIFTORI_FOUNDERS.includes(String(email).toLowerCase().trim())
}

/** CSV export for a user's session history. */
export function sessionsToCSV(sessions) {
  const rows = [
    ['Started', 'Ended', 'Duration (h)', 'Source', 'Offline', 'Reason', 'Notes'].join(','),
    ...(sessions || []).map((s) => [
      s.started_at,
      s.ended_at || '',
      ((s.duration_seconds || 0) / 3600).toFixed(2),
      s.source || '',
      s.is_offline ? 'yes' : 'no',
      s.ended_reason || '',
      JSON.stringify(s.notes || ''),
    ].join(',')),
  ]
  return rows.join('\n')
}

export function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
