/**
 * ClockChip — persistent team time-clock in the global header.
 *
 * Backed by the Pulse system (work_sessions table). Every team member clocks
 * in and out here; hours roll up into the Operations → Pulse leaderboard.
 *
 * Behaviors:
 *   - Idle: small "Clock in" chip (emerald)
 *   - Active: live HH:MM:SS chip with red pulse dot + "Out" button
 *   - At 13 min of no activity: shows "Still working?" tooltip + confirm
 *   - At 15 min of no activity: auto clock-out with 'idle_timeout' reason
 *   - Clicking the chip body navigates to Operations → Pulse
 *
 * Not gated by role — founders, admins, devs, sales, testers all clock here.
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../lib/AuthContext'
import { useClock } from '../lib/useClock'
import { formatClock, isFounderEmail } from '../lib/pulseService'
import { Play, Square, Clock, AlertTriangle, Crown } from 'lucide-react'

export default function ClockChip() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    running,
    seconds,
    busy,
    idleWarning,
    revivedFlash,
    clockIn,
    clockOut,
    acknowledgeIdle,
  } = useClock()

  // Toast once per revive event
  const revivedToastedRef = useRef(false)
  useEffect(() => {
    if (revivedFlash && !revivedToastedRef.current) {
      revivedToastedRef.current = true
      toast.success('Welcome back — Pulse session resumed', {
        description: 'Picked up where you left off (within the 15-min window)',
      })
    }
    if (!revivedFlash) revivedToastedRef.current = false
  }, [revivedFlash])

  // Don't render for anonymous or not-logged-in states
  if (!user) return null

  const founder = isFounderEmail(user.email)

  async function onClockIn() {
    try {
      await clockIn()
      toast.success('Clocked in')
    } catch (err) {
      const msg = err?.message || 'Clock-in failed'
      toast.error(msg.includes('already') ? 'Already clocked in' : 'Clock-in failed')
    }
  }

  async function onClockOut(e) {
    e?.stopPropagation()
    try {
      await clockOut('manual')
      toast.success('Clocked out')
    } catch (err) {
      toast.error('Clock-out failed')
    }
  }

  // ─── Idle: small "Clock in" chip ──────────────────────────────────
  if (!running) {
    return (
      <button
        onClick={onClockIn}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors disabled:opacity-50"
        title="Clock in to start a Pulse work session"
      >
        {founder ? (
          <Crown className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        <span className="text-xs font-semibold">Clock in</span>
      </button>
    )
  }

  // ─── Active: live timer chip ──────────────────────────────────────
  return (
    <div className="relative flex items-center">
      {/* Idle warning tooltip */}
      {idleWarning && (
        <div className="absolute top-full right-0 mt-2 w-64 z-50 bg-amber-500/10 border border-amber-500/50 rounded-lg p-3 shadow-xl backdrop-blur-sm">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Still working?</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                Auto clock-out in 2 min if no activity.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={acknowledgeIdle}
              className="flex-1 px-2 py-1 text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded"
            >
              Yes, still here
            </button>
            <button
              onClick={onClockOut}
              className="px-2 py-1 text-[11px] font-semibold bg-navy-700 hover:bg-navy-600 text-gray-300 rounded"
            >
              Clock out
            </button>
          </div>
        </div>
      )}

      <div
        onClick={() => navigate('/admin/pulse')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
          idleWarning
            ? 'bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
            : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50'
        }`}
        title="View Pulse leaderboard"
      >
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            idleWarning ? 'bg-amber-400' : 'bg-emerald-400'
          }`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${
            idleWarning ? 'bg-amber-500' : 'bg-emerald-500'
          }`} />
        </span>
        {founder && <Crown className="w-3.5 h-3.5 text-amber-400" />}
        <Clock className="w-3.5 h-3.5 opacity-60" />
        <span className="text-xs font-bold tabular-nums">{formatClock(seconds)}</span>
        <button
          onClick={onClockOut}
          disabled={busy}
          className="ml-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 transition-colors disabled:opacity-50"
        >
          <Square className="w-3 h-3" />
          Out
        </button>
      </div>
    </div>
  )
}
