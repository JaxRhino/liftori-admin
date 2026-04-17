/**
 * AnnouncementCenter — founder-facing management panel for the Super Admin dashboard.
 *
 * Surfaces:
 *   - List of active announcements with ack progress bars
 *   - "Generate Announcement" CTA that opens the composer modal
 *   - Click-through recipient drawer showing who acked vs. pending
 *   - Deactivate + delete actions
 *
 * Write access to platform_announcements is enforced by RLS (founders only).
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import {
  listAllAnnouncements,
  createAnnouncement,
  deactivateAnnouncement,
  deleteAnnouncement,
  fetchRecipients,
  ANNOUNCEMENT_TEMPLATES,
  ANNOUNCEMENT_DEPARTMENTS,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_ACCENT_COLORS,
  accentFor,
  getTemplate,
} from '../lib/announcementsService'
import {
  Megaphone, Plus, X, CheckCircle2, Clock, Users, Sparkles,
  Rocket, Flame, UserPlus, Trash2, EyeOff, Loader2, ChevronRight,
  Building2, User as UserIcon, AlertTriangle, Search,
} from 'lucide-react'

export default function AnnouncementCenter() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [recipientsFor, setRecipientsFor] = useState(null) // announcement id

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listAllAnnouncements({ limit: 25, includeInactive: false })
      setItems(list)
    } catch (err) {
      console.error('AnnouncementCenter load failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Re-poll every 30s to pick up acks from other sessions
    const t = setInterval(load, 30_000)
    // Instant refresh when someone acks in this tab (from AnnouncementModal)
    const onAck = () => load()
    window.addEventListener('liftori:announcement-acked', onAck)
    return () => {
      clearInterval(t)
      window.removeEventListener('liftori:announcement-acked', onAck)
    }
  }, [load])

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-bold text-white">Announcement Center</h2>
          <span className="text-xs text-gray-500">{items.length} active</span>
        </div>
        <button
          onClick={() => setShowComposer(true)}
          className="text-xs px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 rounded-md font-medium flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" /> Generate Announcement
        </button>
      </div>

      {loading ? (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState onCreate={() => setShowComposer(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              onViewRecipients={() => setRecipientsFor(a.id)}
              onDeactivate={async () => {
                if (!confirm('Deactivate this announcement? Users who have not acked will stop seeing it.')) return
                await deactivateAnnouncement(a.id)
                load()
              }}
              onDelete={async () => {
                if (!confirm('Permanently delete this announcement and all acknowledgment records?')) return
                await deleteAnnouncement(a.id)
                load()
              }}
            />
          ))}
        </div>
      )}

      {/* Composer */}
      {showComposer && (
        <ComposerModal
          postedBy={user?.id}
          onClose={() => setShowComposer(false)}
          onPosted={() => {
            setShowComposer(false)
            load()
          }}
        />
      )}

      {/* Recipients drawer */}
      {recipientsFor && (
        <RecipientsDrawer
          announcementId={recipientsFor}
          onClose={() => setRecipientsFor(null)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// CARD
// ═══════════════════════════════════════════════════════════════════════

function AnnouncementCard({ announcement: a, onViewRecipients, onDeactivate, onDelete }) {
  const accent = accentFor(a.accent_color)
  const priorityPill =
    a.priority === 'urgent'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      : a.priority === 'important'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-slate-700/40 text-gray-400 border-slate-600/40'

  const audienceLabel =
    a.audience_type === 'all_team'
      ? 'Full platform'
      : a.audience_type === 'department'
      ? `${a.audience_departments?.length || 0} dept${a.audience_departments?.length === 1 ? '' : 's'}`
      : `${a.audience_user_ids?.length || 0} individual${a.audience_user_ids?.length === 1 ? '' : 's'}`

  return (
    <div className={`bg-slate-800/40 border ${accent.border} rounded-xl p-4 flex flex-col gap-3`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${priorityPill}`}>
              {a.priority}
            </span>
            <span className="text-[10px] text-gray-500">{timeAgo(a.created_at)}</span>
          </div>
          <h3 className="text-sm font-bold text-white truncate">{a.title}</h3>
          <p className="text-xs text-gray-400 line-clamp-2 mt-1">{a.body}</p>
        </div>
      </div>

      {/* Audience + template */}
      <div className="flex items-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" /> {audienceLabel}
        </span>
        {a.template && a.template !== 'custom' && (
          <>
            <span>·</span>
            <span className="capitalize">{a.template.replace(/_/g, ' ')}</span>
          </>
        )}
        {a.expires_at && (
          <>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> exp {new Date(a.expires_at).toLocaleDateString()}
            </span>
          </>
        )}
      </div>

      {/* Ack count + actions */}
      <div className="flex items-center justify-between border-t border-slate-700/50 pt-3">
        <button
          onClick={onViewRecipients}
          className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="font-semibold">{a.ack_count || 0}</span>
          <span>acknowledged</span>
          <ChevronRight className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onDeactivate}
            title="Deactivate (soft-hide)"
            className="p-1.5 text-gray-500 hover:text-amber-300 rounded hover:bg-slate-700/30"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete permanently"
            className="p-1.5 text-gray-500 hover:text-rose-400 rounded hover:bg-slate-700/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════

function EmptyState({ onCreate }) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 border-dashed rounded-2xl p-8 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-500/10 border border-sky-500/30 mb-3">
        <Megaphone className="w-6 h-6 text-sky-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-300">No active announcements</h3>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        Post updates, new hire welcomes, feature drops, or pump-ups that appear center-screen for the team.
      </p>
      <button
        onClick={onCreate}
        className="text-xs px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-md font-medium inline-flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Create your first announcement
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSER MODAL
// ═══════════════════════════════════════════════════════════════════════

const TEMPLATE_ICONS = {
  new_hire: UserPlus, feature_launch: Rocket, company_update: Megaphone, pump_up: Flame,
}

function ComposerModal({ postedBy, onClose, onPosted }) {
  const [template, setTemplate] = useState('custom')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audienceType, setAudienceType] = useState('all_team')
  const [selectedDepts, setSelectedDepts] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [priority, setPriority] = useState('normal')
  const [accentColor, setAccentColor] = useState('sky')
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [teamMembers, setTeamMembers] = useState([])
  const [userSearch, setUserSearch] = useState('')

  // Load team members for individual targeting
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, department, avatar_url')
        .neq('role', 'customer')
        .order('full_name', { nullsFirst: false })
      setTeamMembers(data || [])
    })()
  }, [])

  function applyTemplate(key) {
    setTemplate(key)
    if (key === 'custom') return
    const t = getTemplate(key)
    if (!t) return
    setTitle(t.defaults.title)
    setBody(t.defaults.body)
    setPriority(t.priority || 'normal')
    setAccentColor(t.accent_color || 'sky')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.')
      return
    }
    if (audienceType === 'department' && selectedDepts.length === 0) {
      setError('Select at least one department.')
      return
    }
    if (audienceType === 'individual' && selectedUsers.length === 0) {
      setError('Select at least one team member.')
      return
    }
    setBusy(true)
    try {
      await createAnnouncement({
        title,
        body,
        template,
        audience_type: audienceType,
        audience_departments: audienceType === 'department' ? selectedDepts : null,
        audience_user_ids: audienceType === 'individual' ? selectedUsers : null,
        priority,
        accent_color: accentColor,
        icon: template !== 'custom' ? getTemplate(template)?.icon : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        posted_by: postedBy,
      })
      onPosted?.()
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Failed to post announcement')
    } finally {
      setBusy(false)
    }
  }

  const filteredUsers = teamMembers.filter((m) => {
    if (!userSearch.trim()) return true
    const s = userSearch.toLowerCase()
    return (
      (m.full_name || '').toLowerCase().includes(s) ||
      (m.email || '').toLowerCase().includes(s) ||
      (m.department || '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-auto py-8 px-4">
      <form
        onSubmit={submit}
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Generate Announcement</h2>
              <p className="text-xs text-gray-500 mt-0.5">Post center-screen to the team</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Template picker */}
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500 mb-2 block">
              Start from a template
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {ANNOUNCEMENT_TEMPLATES.map((t) => {
                const Icon = TEMPLATE_ICONS[t.key] || Sparkles
                const active = template === t.key
                const a = accentFor(t.accent_color)
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => applyTemplate(t.key)}
                    className={`p-3 rounded-lg border text-left transition ${
                      active
                        ? `${a.bg} ${a.border}`
                        : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-500/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1.5 ${active ? a.text : 'text-gray-500'}`} />
                    <div className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-300'}`}>
                      {t.label}
                    </div>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => applyTemplate('custom')}
                className={`p-3 rounded-lg border text-left transition ${
                  template === 'custom'
                    ? 'bg-slate-700/40 border-slate-500/60'
                    : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-500/60'
                }`}
              >
                <Sparkles className={`w-4 h-4 mb-1.5 ${template === 'custom' ? 'text-white' : 'text-gray-500'}`} />
                <div className={`text-xs font-medium ${template === 'custom' ? 'text-white' : 'text-gray-300'}`}>
                  Custom
                </div>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
              placeholder="e.g., Welcome Jeff to the team!"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500">Message *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={6}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white leading-relaxed"
              placeholder="Write the announcement — newlines are preserved."
            />
          </div>

          {/* Audience */}
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500 mb-2 block">
              Audience
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <AudienceTab
                active={audienceType === 'all_team'}
                onClick={() => setAudienceType('all_team')}
                icon={Users}
                label="Full Platform"
                hint="Everyone on the internal team"
              />
              <AudienceTab
                active={audienceType === 'department'}
                onClick={() => setAudienceType('department')}
                icon={Building2}
                label="Department"
                hint="One or more departments"
              />
              <AudienceTab
                active={audienceType === 'individual'}
                onClick={() => setAudienceType('individual')}
                icon={UserIcon}
                label="Individual"
                hint="Specific team members"
              />
            </div>

            {/* Department picker */}
            {audienceType === 'department' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                {ANNOUNCEMENT_DEPARTMENTS.map((d) => {
                  const sel = selectedDepts.includes(d.key)
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() =>
                        setSelectedDepts(
                          sel ? selectedDepts.filter((x) => x !== d.key) : [...selectedDepts, d.key]
                        )
                      }
                      className={`px-3 py-2 rounded-md text-xs font-medium text-left border transition ${
                        sel
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-200'
                          : 'bg-slate-800 border-slate-700 text-gray-400 hover:border-slate-500'
                      }`}
                    >
                      {sel && <CheckCircle2 className="w-3 h-3 inline mr-1.5" />}
                      {d.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Individual picker */}
            {audienceType === 'individual' && (
              <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search team members..."
                    className="w-full bg-slate-800 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-white"
                  />
                </div>
                {selectedUsers.length > 0 && (
                  <div className="text-[10px] text-sky-400 mb-2">
                    {selectedUsers.length} selected
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">No team members found</p>
                  ) : (
                    filteredUsers.map((m) => {
                      const sel = selectedUsers.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setSelectedUsers(
                              sel
                                ? selectedUsers.filter((x) => x !== m.id)
                                : [...selectedUsers, m.id]
                            )
                          }
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition ${
                            sel
                              ? 'bg-sky-500/15 border border-sky-500/30'
                              : 'bg-slate-800/30 border border-transparent hover:border-slate-600'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              sel ? 'bg-sky-500 text-white' : 'bg-slate-700 text-gray-400'
                            }`}
                          >
                            {(m.full_name || m.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white truncate">
                              {m.full_name || m.email}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">
                              {m.role}
                              {m.department ? ` · ${m.department}` : ''}
                            </div>
                          </div>
                          {sel && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Priority + accent + expires */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
              >
                {ANNOUNCEMENT_PRIORITIES.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500">Accent Color</label>
              <select
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
              >
                {ANNOUNCEMENT_ACCENT_COLORS.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500">Expires (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Posting...
              </>
            ) : (
              <>
                <Megaphone className="w-4 h-4" /> Post Announcement
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function AudienceTab({ active, onClick, icon: Icon, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-lg border text-left transition ${
        active
          ? 'bg-sky-500/15 border-sky-500/50'
          : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-500/60'
      }`}
    >
      <Icon className={`w-4 h-4 mb-1.5 ${active ? 'text-sky-300' : 'text-gray-500'}`} />
      <div className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-300'}`}>
        {label}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{hint}</div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// RECIPIENTS DRAWER
// ═══════════════════════════════════════════════════════════════════════

function RecipientsDrawer({ announcementId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [recipients, setRecipients] = useState([])

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const data = await fetchRecipients(announcementId)
        setRecipients(data || [])
      } catch (err) {
        console.error('fetchRecipients failed', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [announcementId])

  const acked = recipients.filter((r) => r.acknowledged_at)
  const pending = recipients.filter((r) => !r.acknowledged_at)
  const pct = recipients.length ? Math.round((acked.length / recipients.length) * 100) : 0

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-start justify-end">
      <div className="bg-slate-900 border-l border-slate-700 w-full max-w-md h-full overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-white">Recipients</h3>
            <p className="text-xs text-gray-500 mt-0.5">Who has seen this announcement</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="p-5 border-b border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">
                  {acked.length} of {recipients.length} acknowledged
                </span>
                <span className="text-xs font-bold text-sky-300">{pct}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Acked */}
            {acked.length > 0 && (
              <div className="p-5 border-b border-slate-800">
                <h4 className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-3">
                  Acknowledged ({acked.length})
                </h4>
                <div className="space-y-2">
                  {acked.map((r) => (
                    <RecipientRow key={r.user_id} r={r} acked />
                  ))}
                </div>
              </div>
            )}

            {/* Pending */}
            {pending.length > 0 && (
              <div className="p-5">
                <h4 className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-3">
                  Pending ({pending.length})
                </h4>
                <div className="space-y-2">
                  {pending.map((r) => (
                    <RecipientRow key={r.user_id} r={r} acked={false} />
                  ))}
                </div>
              </div>
            )}

            {recipients.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-8 px-4">
                No targeted recipients found. Check your audience settings.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RecipientRow({ r, acked }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          acked ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30' : 'bg-slate-700 text-gray-400'
        }`}
      >
        {(r.full_name || r.email || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">
          {r.full_name || r.email || 'Unknown'}
        </div>
        <div className="text-[10px] text-gray-500 truncate">
          {r.role}
          {r.department ? ` · ${r.department}` : ''}
        </div>
      </div>
      {acked ? (
        <div className="flex items-center gap-1 text-[10px] text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{timeAgo(r.acknowledged_at)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>pending</span>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}
