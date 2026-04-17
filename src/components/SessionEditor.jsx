/**
 * SessionEditor — modal for adding/editing Pulse work sessions.
 *
 * Two modes:
 *   mode="offline"  — any user logs work done outside the platform (notes required)
 *   mode="edit"     — founder-only edit of an existing session (reason required)
 *
 * All changes are logged to pulse_adjustments by the RPCs, so the audit trail
 * is automatic. The modal never writes to work_sessions directly.
 */
import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  addOfflineSession,
  editSession,
  deleteSessionAdmin,
  deleteMyOfflineSession,
  toLocalInputValue,
  isFounderEmail,
  formatDuration,
} from '../lib/pulseService'
import { X, Save, Trash2, AlertTriangle, Plus } from 'lucide-react'

export default function SessionEditor({ mode = 'offline', session, onClose }) {
  const { user } = useAuth()
  const isFounder = isFounderEmail(user?.email)
  const isEdit = mode === 'edit' && session
  const isOwnSession = session && session.user_id === user?.id
  const canEdit = isEdit && (isFounder || (isOwnSession && session.is_offline))

  // Seed values
  const [startedAt, setStartedAt] = useState(
    isEdit ? toLocalInputValue(session.started_at) : toLocalInputValue(new Date().toISOString())
  )
  const [endedAt, setEndedAt] = useState(
    isEdit && session.ended_at ? toLocalInputValue(session.ended_at) : toLocalInputValue(new Date().toISOString())
  )
  const [notes, setNotes] = useState(isEdit ? (session.notes || '') : '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Compute delta for preview
  const previewSeconds = (() => {
    try {
      const s = new Date(startedAt).getTime()
      const e = new Date(endedAt).getTime()
      return Math.max(0, Math.floor((e - s) / 1000))
    } catch (_) { return 0 }
  })()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (busy) return

    try {
      if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
        setError('End time must be after start time.')
        return
      }
      if (previewSeconds > 12 * 3600) {
        setError('Sessions cannot exceed 12 hours. Split into multiple entries.')
        return
      }

      setBusy(true)

      if (isEdit) {
        if (!reason || reason.trim().length < 3) {
          setError('Reason (min 3 chars) is required to edit.')
          setBusy(false)
          return
        }
        await editSession({
          session_id: session.id,
          started_at: startedAt,
          ended_at: endedAt,
          reason,
        })
      } else {
        if (!notes || notes.trim().length < 3) {
          setError('Notes (min 3 chars) are required for offline entries.')
          setBusy(false)
          return
        }
        await addOfflineSession({
          started_at: startedAt,
          ended_at: endedAt,
          notes,
        })
      }
      onClose()
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    const confirmMsg = isFounder
      ? `Delete this session for ${session.full_name || 'user'}? This is permanent and logged.`
      : 'Delete your offline session? This cannot be undone.'
    if (!window.confirm(confirmMsg)) return

    if (isFounder && !isOwnSession) {
      const r = window.prompt('Reason for deletion (required):')
      if (!r || r.trim().length < 3) return
      setBusy(true)
      try {
        await deleteSessionAdmin({ session_id: session.id, reason: r })
        onClose()
      } catch (err) {
        setError(err?.message || 'Delete failed')
      } finally {
        setBusy(false)
      }
    } else if (isOwnSession && session.is_offline) {
      setBusy(true)
      try {
        await deleteMyOfflineSession(session.id)
        onClose()
      } catch (err) {
        setError(err?.message || 'Delete failed')
      } finally {
        setBusy(false)
      }
    }
  }

  const title = isEdit ? 'Edit Session' : 'Log Offline Work'
  const Icon = isEdit ? Save : Plus

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-navy-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-navy-700/60">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-navy-700 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Session meta readout when editing */}
          {isEdit && (
            <div className="p-3 rounded-lg bg-navy-800/60 border border-navy-700/60 text-xs space-y-1">
              <p className="text-gray-400">
                <span className="text-gray-500">User:</span>{' '}
                <span className="text-white font-semibold">{session.full_name || session.user_id}</span>
              </p>
              <p className="text-gray-400">
                <span className="text-gray-500">Source:</span>{' '}
                <span className="text-white">{session.source}{session.is_offline ? ' (offline)' : ''}</span>
              </p>
              {session.ended_reason && (
                <p className="text-gray-400">
                  <span className="text-gray-500">Ended reason:</span>{' '}
                  <span className="text-white">{session.ended_reason}</span>
                </p>
              )}
            </div>
          )}

          {!canEdit && isEdit && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                Only founders can edit this session. You can still view it here.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">Start</label>
              <input
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                disabled={isEdit && !canEdit}
                className="w-full mt-1 p-2 rounded-lg bg-navy-800 border border-navy-700 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                required
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">End</label>
              <input
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                disabled={isEdit && !canEdit}
                className="w-full mt-1 p-2 rounded-lg bg-navy-800 border border-navy-700 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                required
              />
            </div>
          </div>

          <div className="text-[11px] text-gray-500">
            Duration: <span className="text-emerald-300 font-semibold">{formatDuration(previewSeconds)}</span>
            {previewSeconds > 12 * 3600 && (
              <span className="ml-2 text-rose-400">— over 12h max</span>
            )}
          </div>

          {!isEdit && (
            <div>
              <label className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">Notes (what did you do?)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Offsite client meeting, phone support, planning session…"
                className="w-full mt-1 p-2 rounded-lg bg-navy-800 border border-navy-700 text-sm text-white focus:border-emerald-500 focus:outline-none resize-none"
                required
              />
            </div>
          )}

          {isEdit && canEdit && (
            <div>
              <label className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">Reason for edit (audit log)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. wrong time zone, corrected end time"
                className="w-full mt-1 p-2 rounded-lg bg-navy-800 border border-navy-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-navy-700/50">
            <div>
              {isEdit && (canEdit || (isOwnSession && session.is_offline)) && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-gray-300 hover:text-white text-sm font-semibold"
              >
                Cancel
              </button>
              {(!isEdit || canEdit) && (
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {busy ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
