/**
 * AnnouncementModal — center-screen platform announcement popup.
 *
 * Mounts once globally in AdminLayout. On login/mount it polls the
 * get_active_announcements_for_me() RPC to find announcements the current
 * user is targeted by AND hasn't acknowledged yet. Shows them one at a time,
 * highest priority first. "Understood" permanently dismisses (logs to DB).
 *
 * Visibility rules are enforced server-side by RLS + the RPC — this component
 * just renders whatever the server returns.
 */
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  fetchActiveForMe,
  acknowledgeAnnouncement,
  accentFor,
} from '../lib/announcementsService'
import {
  CheckCircle2, Sparkles, Rocket, Megaphone, Flame, UserPlus,
  AlertTriangle, Loader2, X,
} from 'lucide-react'

const ICON_MAP = {
  Sparkles, Rocket, Megaphone, Flame, UserPlus, AlertTriangle,
}

// Poll frequency while the user is logged in
const POLL_INTERVAL_MS = 60_000

export default function AnnouncementModal() {
  const { user, profile } = useAuth()
  const [queue, setQueue] = useState([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    // Skip entirely for customers — this surface is internal-only.
    if (profile?.role === 'customer') return
    try {
      const list = await fetchActiveForMe()
      setQueue(list || [])
    } catch (err) {
      // Silent — a missing RPC or RLS blip shouldn't spam the user.
      console.warn('[AnnouncementModal] load failed:', err?.message)
    }
  }, [user, profile?.role])

  // Initial load + polling
  useEffect(() => {
    load()
    const t = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [load])

  if (!user || !queue.length || profile?.role === 'customer') return null

  const current = queue[0]
  const accent = accentFor(current.accent_color || 'sky')
  const Icon = ICON_MAP[current.icon] || templateIcon(current.template) || Sparkles

  const priorityStyle =
    current.priority === 'urgent'
      ? 'border-rose-500/60 shadow-rose-500/20'
      : current.priority === 'important'
      ? 'border-amber-500/50 shadow-amber-500/10'
      : `${accent.border} shadow-black/40`

  async function handleAcknowledge() {
    if (busy) return
    setBusy(true)
    try {
      await acknowledgeAnnouncement(current.id, user.id)
      // Drop this one from the queue and advance
      setQueue((q) => q.slice(1))
    } catch (err) {
      console.error('[AnnouncementModal] ack failed:', err)
      alert('Could not record acknowledgment: ' + (err?.message || 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className={`relative w-full max-w-lg bg-slate-900 border-2 ${priorityStyle} rounded-2xl shadow-2xl overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
      >
        {/* Top accent strip */}
        <div className={`h-1 w-full ${accent.btn.split(' ')[0]}`} />

        {/* Priority badge */}
        {current.priority !== 'normal' && (
          <div className="absolute top-4 right-4">
            <span
              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${
                current.priority === 'urgent'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {current.priority}
            </span>
          </div>
        )}

        <div className="p-8">
          {/* Icon + label */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-xl ${accent.bg} border ${accent.border} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-6 h-6 ${accent.text}`} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                Liftori Platform Announcement
              </p>
              <p className="text-[10px] text-gray-600">
                {queue.length > 1 ? `${queue.length} pending` : 'New for you'}
              </p>
            </div>
          </div>

          {/* Title */}
          <h2
            id="announcement-title"
            className="text-2xl font-bold text-white mb-3 leading-tight"
          >
            {current.title}
          </h2>

          {/* Body — preserves newlines */}
          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-6">
            {current.body}
          </div>

          {/* Understood button */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-gray-500">
              {new Date(current.created_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </div>
            <button
              onClick={handleAcknowledge}
              disabled={busy}
              className={`px-6 py-2.5 ${accent.btn} text-white rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition`}
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Understood
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function templateIcon(template) {
  switch (template) {
    case 'new_hire': return UserPlus
    case 'feature_launch': return Rocket
    case 'company_update': return Megaphone
    case 'pump_up': return Flame
    default: return null
  }
}
