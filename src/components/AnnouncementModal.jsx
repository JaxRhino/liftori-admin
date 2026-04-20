/**
 * AnnouncementModal — center-screen platform announcement popup.
 *
 * Mounts once globally in AdminLayout. On login/mount it polls the
 * get_active_announcements_for_me() RPC to find announcements the current
 * user is targeted by AND hasn't acknowledged yet. Stacks them back-to-back
 * ordered by priority (urgent → important → normal, then newest first).
 * Each "Understood" click permanently dismisses (logs to DB) and advances
 * to the next announcement — the user clears the entire stack in one sitting.
 *
 * Visibility rules are enforced server-side by RLS + the RPC — this component
 * just renders whatever the server returns, plus merges new incoming items
 * without jumping the user mid-view.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  fetchActiveForMe,
  acknowledgeAnnouncement,
  accentFor,
} from '../lib/announcementsService'
import {
  CheckCircle2, Sparkles, Rocket, Megaphone, Flame, UserPlus,
  AlertTriangle, Loader2, ChevronRight, X,
} from 'lucide-react'

const ICON_MAP = {
  Sparkles, Rocket, Megaphone, Flame, UserPlus, AlertTriangle,
}

// Poll frequency while the user is logged in
const POLL_INTERVAL_MS = 60_000

// Stable priority rank used for merging/sort-stability on the client too
const PRIORITY_RANK = { urgent: 0, important: 1, normal: 2 }
function rankOf(a) { return PRIORITY_RANK[a?.priority] ?? 2 }

export default function AnnouncementModal() {
  const { user, profile } = useAuth()
  const [queue, setQueue] = useState([])
  const [totalForSession, setTotalForSession] = useState(0) // max queue length seen this session (for "X of N")
  const [busy, setBusy] = useState(false)
  const ackedIdsRef = useRef(new Set()) // ids the user has acked locally — never re-surface

  const load = useCallback(async () => {
    if (!user) return
    // Skip entirely for customers — this surface is internal-only.
    if (profile?.role === 'customer') return
    try {
      const list = (await fetchActiveForMe()) || []
      // Drop anything the user has already acked locally (defensive — server
      // should filter these, but the ack write may not have flushed yet).
      const filtered = list.filter((a) => !ackedIdsRef.current.has(a.id))

      setQueue((prev) => {
        // Preserve the current head (the card the user is reading) so a poll
        // tick doesn't yank the content out from under them. Re-sort the
        // remainder by priority/recency. New items land in the right spot.
        const head = prev[0]
        const byId = new Map()
        filtered.forEach((a) => byId.set(a.id, a))
        // If the head is still a valid active announcement, keep it first
        const keepHead = head && byId.has(head.id) ? byId.get(head.id) : null
        if (keepHead) byId.delete(head.id)
        const rest = Array.from(byId.values()).sort((a, b) => {
          const r = rankOf(a) - rankOf(b)
          if (r !== 0) return r
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        const next = keepHead ? [keepHead, ...rest] : rest
        setTotalForSession((t) => Math.max(t, next.length))
        return next
      })
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
  const remaining = queue.length
  const total = Math.max(totalForSession, remaining)
  const positionIndex = total - remaining + 1 // 1-indexed "X of N"
  const hasMore = remaining > 1

  const priorityStyle =
    current.priority === 'urgent'
      ? 'border-rose-500/60 shadow-rose-500/20'
      : current.priority === 'important'
      ? 'border-amber-500/50 shadow-amber-500/10'
      : `${accent.border} shadow-black/40`

  const priorityBadgeClass =
    current.priority === 'urgent'
      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      : current.priority === 'important'
      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      : 'bg-slate-700/60 text-slate-300 border border-slate-600/60'

  async function handleAcknowledge() {
    if (busy) return
    setBusy(true)
    try {
      // Track locally so polling can't resurrect it
      ackedIdsRef.current.add(current.id)
      await acknowledgeAnnouncement(current.id, user.id)
      // Drop this one from the queue and advance
      setQueue((q) => q.slice(1))
      // Signal to any open AnnouncementCenter to refresh its ack counts immediately
      try {
        window.dispatchEvent(
          new CustomEvent('liftori:announcement-acked', {
            detail: { announcementId: current.id, userId: user.id },
          })
        )
      } catch (_) { /* no-op */ }
    } catch (err) {
      console.error('[AnnouncementModal] ack failed:', err)
      // If ack failed, un-track so a retry can happen
      ackedIdsRef.current.delete(current.id)
      alert('Could not record acknowledgment: ' + (err?.message || 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      {/* Stacked-card visual: shows ghost cards behind the active one when queue > 1 */}
      <div className="relative w-full max-w-lg">
        {/* Back-2 ghost */}
        {remaining > 2 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-6 top-4 h-6 rounded-2xl bg-slate-800/70 border border-slate-700/60 shadow-lg"
            style={{ transform: 'translateY(-12px)' }}
          />
        )}
        {/* Back-1 ghost */}
        {remaining > 1 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-3 top-2 h-6 rounded-2xl bg-slate-850 bg-slate-800 border border-slate-700/70 shadow-lg"
            style={{ transform: 'translateY(-6px)' }}
          />
        )}

        <div
          className={`relative w-full bg-slate-900 border-2 ${priorityStyle} rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-title"
        >
          {/* Top accent strip */}
          <div className={`h-1 w-full ${accent.btn.split(' ')[0]}`} />

          {/* Progress bar — segmented, one tick per announcement in session */}
          {total > 1 && (
            <div className="flex gap-1 px-4 pt-3" aria-hidden="true">
              {Array.from({ length: total }).map((_, i) => {
                const done = i < positionIndex - 1
                const active = i === positionIndex - 1
                return (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      done ? 'bg-emerald-500/80' : active ? accent.btn.split(' ')[0] : 'bg-slate-700/60'
                    }`}
                  />
                )
              })}
            </div>
          )}

          {/* Priority badge (always visible now — communicates importance every time) */}
          <div className="absolute top-4 right-4">
            <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${priorityBadgeClass}`}>
              {current.priority}
            </span>
          </div>

          {/* Header — stays fixed at top (icon + label + title) */}
          <div className="px-6 sm:px-8 pt-5 pb-3 flex-shrink-0">
            {/* Icon + label + stack counter */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${accent.bg} border ${accent.border} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${accent.text}`} />
              </div>
              <div className="min-w-0 pr-20">
                <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                  Liftori Platform Announcement
                </p>
                <p className="text-[10px] text-gray-500">
                  {total > 1
                    ? `${positionIndex} of ${total} · highest priority first`
                    : 'New for you'}
                </p>
              </div>
            </div>

            {/* Title */}
            <h2
              id="announcement-title"
              className="text-xl sm:text-2xl font-bold text-white leading-tight"
            >
              {current.title}
            </h2>
          </div>

          {/* Body — scrollable when content is tall or viewport is short */}
          <div className="px-6 sm:px-8 pb-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap overflow-y-auto flex-1 min-h-0">
            {current.body}
          </div>

          {/* Footer — stays fixed at bottom (Understood button always visible) */}
          <div className="px-6 sm:px-8 py-4 flex items-center justify-between gap-3 flex-shrink-0 border-t border-slate-800/80 bg-slate-900">
            <div className="text-[11px] text-gray-500">
              {new Date(current.created_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </div>
            <button
              onClick={handleAcknowledge}
              disabled={busy}
              className={`px-5 sm:px-6 py-2.5 ${accent.btn} text-white rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition`}
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : hasMore ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Got it · Next
                  <ChevronRight className="w-4 h-4 -ml-1" />
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
