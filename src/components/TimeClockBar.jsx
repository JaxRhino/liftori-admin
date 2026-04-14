import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../lib/AuthContext'
import { isFounder } from '../lib/testerProgramService'
import {
  fetchActiveEntry,
  clockIn as apiClockIn,
  clockOut as apiClockOut,
  fetchMyEnrollment,
  liveDuration,
  formatDuration,
} from '../lib/timeTrackingService'

/**
 * Persistent clock-in / clock-out chip for the top nav.
 * - Only renders for users with an active tester_enrollments row.
 * - Shows a "Clock in" button when no active session.
 * - Shows a live-updating timer + "Clock out" button when active.
 * - Clicking the chip body navigates to the Testing page.
 */
export default function TimeClockBar() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const [enrollment, setEnrollment] = useState(null)
  const [enrollmentChecked, setEnrollmentChecked] = useState(false)

  // Founders have tester enrollments for preview purposes only — hide clock bar
  // globally for them, but still show it on the tester-dashboard preview route
  // so they can see what a real tester sees.
  const isFounderUser = isFounder({ email: user?.email, personal_email: profile?.personal_email })
  const onTesterPreview = location.pathname === '/admin/tester-dashboard'

  const refresh = useCallback(async () => {
    if (!user?.id) return
    try {
      const [entry, enr] = await Promise.all([
        fetchActiveEntry(user.id),
        fetchMyEnrollment(user.id),
      ])
      setActive(entry)
      setEnrollment(enr)
    } catch (err) {
      console.error('[TimeClockBar] refresh', err)
    } finally {
      setEnrollmentChecked(true)
    }
  }, [user?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Live timer — re-render every 30s while active
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [active])

  async function onClockIn() {
    if (!user?.id) return
    setLoading(true)
    try {
      const entry = await apiClockIn({
        userId: user.id,
        orgId: profile?.org_id || null,
        entryType: 'testing',
      })
      setActive(entry)
      toast.success('Clocked in')
    } catch (err) {
      console.error(err)
      toast.error(err?.message?.includes('duplicate') ? 'Already clocked in' : 'Clock-in failed')
    } finally {
      setLoading(false)
    }
  }

  async function onClockOut(e) {
    e.stopPropagation()
    if (!active?.id) return
    setLoading(true)
    try {
      await apiClockOut(active.id)
      setActive(null)
      toast.success('Clocked out')
    } catch (err) {
      console.error(err)
      toast.error('Clock-out failed')
    } finally {
      setLoading(false)
    }
  }

  // Founders: hide clock bar globally (their tester_enrollments rows are preview-only).
  // Exception: show on the tester-dashboard preview route so they see the full tester UI.
  if (isFounderUser && !onTesterPreview && !active) {
    return null
  }

  // Gate: only enrolled testers see the clock chip.
  // Exception: if a non-tester somehow has an active session (legacy data), still
  // show the "Clock out" affordance so they can close it cleanly.
  if (enrollmentChecked && !enrollment && !active) {
    return null
  }

  // Not clocked in — small CTA
  if (!active) {
    return (
      <button
        onClick={onClockIn}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors disabled:opacity-50"
        title="Clock in to start a testing session"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
        </svg>
        <span className="text-xs font-medium">Clock in</span>
      </button>
    )
  }

  // Active session — live timer chip + clock out
  const minutes = liveDuration(active.clock_in_at) // tick dependency triggers re-read
  void tick
  return (
    <div
      onClick={() => navigate('/admin/testing')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/50 cursor-pointer transition-colors"
      title="View Testing page"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
      </span>
      <span className="text-xs font-semibold tabular-nums">{formatDuration(minutes)}</span>
      <span className="text-[10px] uppercase tracking-wide text-rose-400/70">{active.entry_type}</span>
      <button
        onClick={onClockOut}
        disabled={loading}
        className="ml-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-500/30 hover:bg-rose-500/50 text-rose-50 transition-colors"
      >
        Out
      </button>
    </div>
  )
}
