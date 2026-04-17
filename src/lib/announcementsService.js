/**
 * announcementsService — Platform Announcement Center helpers.
 *
 * Backed by:
 *   platform_announcements           — the announcements themselves
 *   announcement_acknowledgments     — one row per user who clicked "Understood"
 *   RPC get_active_announcements_for_me()   — unread + targeted for current user
 *   RPC get_announcement_recipients(uuid)   — founder-only, recipient list + ack status
 *
 * Write access (create/edit/delete) is restricted to founders (Ryan + Mike) via RLS.
 * Read access for the modal uses the RPC which enforces audience targeting server-side.
 */
import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════════
// CATALOGS — used by the composer UI
// ═══════════════════════════════════════════════════════════════════════

export const ANNOUNCEMENT_DEPARTMENTS = [
  { key: 'leadership',  label: 'Leadership',      color: 'purple' },
  { key: 'sales',       label: 'Sales',           color: 'emerald' },
  { key: 'dev',         label: 'Development',     color: 'sky' },
  { key: 'operations',  label: 'Operations',      color: 'amber' },
  { key: 'marketing',   label: 'Marketing',       color: 'pink' },
  { key: 'testing',     label: 'Testing / QA',    color: 'rose' },
  { key: 'hr',          label: 'HR',              color: 'teal' },
  { key: 'finance',     label: 'Finance',         color: 'yellow' },
  { key: 'consulting',  label: 'Consulting',      color: 'indigo' },
  { key: 'call_center', label: 'Call Center',     color: 'orange' },
]

export const ANNOUNCEMENT_PRIORITIES = [
  { key: 'normal',    label: 'Normal',    color: 'sky',   ring: 'ring-sky-500/30' },
  { key: 'important', label: 'Important', color: 'amber', ring: 'ring-amber-500/40' },
  { key: 'urgent',    label: 'Urgent',    color: 'rose',  ring: 'ring-rose-500/50' },
]

export const ANNOUNCEMENT_ACCENT_COLORS = [
  { key: 'sky',     label: 'Sky Blue' },
  { key: 'purple',  label: 'Purple' },
  { key: 'emerald', label: 'Emerald' },
  { key: 'pink',    label: 'Pink' },
  { key: 'amber',   label: 'Amber' },
  { key: 'rose',    label: 'Rose' },
  { key: 'indigo',  label: 'Indigo' },
  { key: 'teal',    label: 'Teal' },
]

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATES — seeded starter announcements the composer can pre-fill
// ═══════════════════════════════════════════════════════════════════════

export const ANNOUNCEMENT_TEMPLATES = [
  {
    key: 'new_hire',
    label: 'New Hire Welcome',
    icon: 'UserPlus',
    accent_color: 'emerald',
    priority: 'normal',
    defaults: {
      title: 'Welcome [Name] to the Liftori team!',
      body:
        'Please help me welcome [Name] to the Liftori team as our new [Role].\n\n' +
        'A quick intro: [one or two sentences on their background].\n\n' +
        'Say hi in the team channel when you get a chance — excited to have them on board.',
    },
  },
  {
    key: 'feature_launch',
    label: 'Feature Launch',
    icon: 'Rocket',
    accent_color: 'sky',
    priority: 'important',
    defaults: {
      title: '[Feature] is live — you can use it now',
      body:
        'We just shipped [Feature]. Here is what it does and where to find it:\n\n' +
        '• What it does: [one-line summary]\n' +
        '• Where to find it: [Admin nav path, e.g. Operations → Customer Ops]\n' +
        '• Who it is for: [audience]\n\n' +
        'If anything feels off, flag it in the tester dashboard or ping me directly.',
    },
  },
  {
    key: 'company_update',
    label: 'Company Update',
    icon: 'Megaphone',
    accent_color: 'purple',
    priority: 'important',
    defaults: {
      title: 'Liftori company update — [headline]',
      body:
        'Quick update for the team:\n\n' +
        '[What happened / what is new]\n\n' +
        'What this means for us: [impact on team, priorities, or workflow]\n\n' +
        'Proud of the work everyone is putting in.',
    },
  },
  {
    key: 'pump_up',
    label: 'Team Pump-Up',
    icon: 'Flame',
    accent_color: 'rose',
    priority: 'normal',
    defaults: {
      title: "Let's finish strong this week",
      body:
        'Team — quick check-in.\n\n' +
        'What we are going for this week: [goal]\n' +
        'Why it matters: [reason]\n\n' +
        'Every one of you is carrying real weight here. Keep pushing — we are building something that matters.\n\n' +
        '— Ryan',
    },
  },
]

export function getTemplate(key) {
  return ANNOUNCEMENT_TEMPLATES.find((t) => t.key === key) || null
}

export function getDepartment(key) {
  return ANNOUNCEMENT_DEPARTMENTS.find((d) => d.key === key) || null
}

// ═══════════════════════════════════════════════════════════════════════
// READS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Returns all announcements the CURRENT user can see and has NOT yet acked.
 * Used by the center-screen modal on login / periodically while signed in.
 */
export async function fetchActiveForMe() {
  const { data, error } = await supabase.rpc('get_active_announcements_for_me')
  if (error) throw error
  return data || []
}

/**
 * Founder-only. List all announcements (any status), with ack counts and
 * estimated recipient counts for the management table.
 */
export async function listAllAnnouncements({ limit = 50, includeInactive = true } = {}) {
  let q = supabase
    .from('platform_announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error

  // Batch fetch ack counts per announcement
  const ids = (data || []).map((a) => a.id)
  let ackCountByAnn = {}
  if (ids.length > 0) {
    const { data: acks } = await supabase
      .from('announcement_acknowledgments')
      .select('announcement_id')
      .in('announcement_id', ids)
    for (const a of acks || []) {
      ackCountByAnn[a.announcement_id] = (ackCountByAnn[a.announcement_id] || 0) + 1
    }
  }
  return (data || []).map((a) => ({ ...a, ack_count: ackCountByAnn[a.id] || 0 }))
}

/**
 * Founder-only. Returns the targeted-recipient list for a given announcement
 * with ack status per user. Calls the server RPC (SECURITY DEFINER).
 */
export async function fetchRecipients(announcementId) {
  const { data, error } = await supabase.rpc('get_announcement_recipients', {
    p_announcement_id: announcementId,
  })
  if (error) throw error
  return data || []
}

// ═══════════════════════════════════════════════════════════════════════
// WRITES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Create a new announcement. Founders only (enforced by RLS).
 * @param {Object} payload
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {string} [payload.template='custom']
 * @param {'all_team'|'department'|'individual'} [payload.audience_type='all_team']
 * @param {string[]} [payload.audience_departments]    — required if audience_type='department'
 * @param {string[]} [payload.audience_user_ids]       — required if audience_type='individual'
 * @param {'normal'|'important'|'urgent'} [payload.priority='normal']
 * @param {string} [payload.accent_color='sky']
 * @param {string} [payload.icon]
 * @param {string} [payload.expires_at]                — ISO timestamp
 * @param {string} payload.posted_by                   — auth.users.id
 */
export async function createAnnouncement(payload) {
  if (!payload?.title?.trim()) throw new Error('Title is required')
  if (!payload?.body?.trim()) throw new Error('Body is required')
  if (!payload?.posted_by) throw new Error('posted_by is required')

  const audience_type = payload.audience_type || 'all_team'
  if (audience_type === 'department' && (!payload.audience_departments || payload.audience_departments.length === 0)) {
    throw new Error('Select at least one department')
  }
  if (audience_type === 'individual' && (!payload.audience_user_ids || payload.audience_user_ids.length === 0)) {
    throw new Error('Select at least one user')
  }

  const row = {
    title: payload.title.trim(),
    body: payload.body.trim(),
    template: payload.template || 'custom',
    audience_type,
    audience_departments: audience_type === 'department' ? payload.audience_departments : null,
    audience_user_ids: audience_type === 'individual' ? payload.audience_user_ids : null,
    priority: payload.priority || 'normal',
    accent_color: payload.accent_color || 'sky',
    icon: payload.icon || null,
    posted_by: payload.posted_by,
    is_active: true,
    expires_at: payload.expires_at || null,
  }

  const { data, error } = await supabase
    .from('platform_announcements')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Founder-only. Deactivate (soft-delete) an announcement. */
export async function deactivateAnnouncement(id) {
  const { error } = await supabase
    .from('platform_announcements')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Founder-only. Permanently delete an announcement (also cascades acks). */
export async function deleteAnnouncement(id) {
  const { error } = await supabase.from('platform_announcements').delete().eq('id', id)
  if (error) throw error
}

/**
 * Current user acknowledges an announcement ("Understood" click).
 * Idempotent — unique constraint on (announcement_id, user_id) prevents dupes.
 */
export async function acknowledgeAnnouncement(announcementId, userId) {
  if (!announcementId || !userId) throw new Error('announcementId + userId required')
  const { error } = await supabase.from('announcement_acknowledgments').insert({
    announcement_id: announcementId,
    user_id: userId,
  })
  // Swallow unique-violation (already acked) — treat as success
  if (error && !/duplicate key|unique/i.test(error.message)) throw error
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS — used by UI components for styling
// ═══════════════════════════════════════════════════════════════════════

/** Tailwind class palette keyed by accent color. */
export const ACCENT_STYLES = {
  sky:     { border: 'border-sky-500/40',     bg: 'bg-sky-500/10',     text: 'text-sky-300',     btn: 'bg-sky-500 hover:bg-sky-600' },
  purple:  { border: 'border-purple-500/40',  bg: 'bg-purple-500/10',  text: 'text-purple-300',  btn: 'bg-purple-500 hover:bg-purple-600' },
  emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-300', btn: 'bg-emerald-500 hover:bg-emerald-600' },
  pink:    { border: 'border-pink-500/40',    bg: 'bg-pink-500/10',    text: 'text-pink-300',    btn: 'bg-pink-500 hover:bg-pink-600' },
  amber:   { border: 'border-amber-500/40',   bg: 'bg-amber-500/10',   text: 'text-amber-300',   btn: 'bg-amber-500 hover:bg-amber-600' },
  rose:    { border: 'border-rose-500/40',    bg: 'bg-rose-500/10',    text: 'text-rose-300',    btn: 'bg-rose-500 hover:bg-rose-600' },
  indigo:  { border: 'border-indigo-500/40',  bg: 'bg-indigo-500/10',  text: 'text-indigo-300',  btn: 'bg-indigo-500 hover:bg-indigo-600' },
  teal:    { border: 'border-teal-500/40',    bg: 'bg-teal-500/10',    text: 'text-teal-300',    btn: 'bg-teal-500 hover:bg-teal-600' },
  orange:  { border: 'border-orange-500/40',  bg: 'bg-orange-500/10',  text: 'text-orange-300',  btn: 'bg-orange-500 hover:bg-orange-600' },
  yellow:  { border: 'border-yellow-500/40',  bg: 'bg-yellow-500/10',  text: 'text-yellow-300',  btn: 'bg-yellow-500 hover:bg-yellow-600' },
}

export function accentFor(key) {
  return ACCENT_STYLES[key] || ACCENT_STYLES.sky
}
