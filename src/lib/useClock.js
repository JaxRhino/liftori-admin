/**
 * useClock — React hook that owns the user's work session state.
 *
 * Responsibilities:
 *   - Auto clock-in on mount (login): if an open session exists, restore it;
 *     otherwise call start_session() which will revive a closed session that
 *     ended < 15 min ago, or start a fresh one. Logout/reload within the
 *     15-min window is transparent — the user just picks up where they left off.
 *   - Heartbeat every 60s while clocked in (bumps session.updated_at)
 *   - Watch user activity (mouse/keyboard/focus). If none for IDLE_TIMEOUT, auto-end.
 *   - Warn at WARN_AT with a "Still working?" toast prompt
 *   - No beforeunload auto-end — server-side idle reaper cleans up stale sessions.
 *
 * Exposes:
 *   { session, running, seconds, busy, idleWarning, revivedFlash,
 *     clockIn, clockOut, acknowledgeIdle }
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  startSession,
  endSession,
  getMyOpenSession,
  heartbeat,
} from './pulseService'
import { supabase } from './supabase'

const IDLE_TIMEOUT_MS = 15 * 60 * 1000   // 15 min — auto-end
const WARN_AT_MS      = 13 * 60 * 1000   // 13 min — show "still there?"
const HEARTBEAT_MS    = 60 * 1000        // 1 min
const TICK_MS         = 1000             // update running counter every second

// Accounts that clock in at start of day and clock out at end of day —
// the 15-min idle auto-end doesn't match their workflow (heads-down coding,
// pushing to GitHub, away from the admin for long stretches). Heartbeat
// still runs so server-side reaper won't touch them either.
const IDLE_EXEMPT_EMAILS = new Set([
  'ryan@liftori.ai',
  'rhinomarch78@gmail.com',
])

export function useClock() {
  const [session, setSession] = useState(null)     // full row or null
  const [seconds, setSeconds] = useState(0)        // running seconds since start
  const [idleWarning, setIdleWarning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [revivedFlash, setRevivedFlash] = useState(false) // true briefly after a revive

  const lastActivityRef = useRef(Date.now())
  const tickTimerRef    = useRef(null)
  const heartbeatRef    = useRef(null)
  const idleCheckRef    = useRef(null)
  const didAutoStartRef = useRef(false)
  const idleExemptRef   = useRef(false)  // set once on mount from auth email

  // Resolve once on mount whether this account is exempt from idle auto-end.
  // Synchronous-enough: the ref flips before the 15-min idle window elapses.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const email = (data?.user?.email || '').toLowerCase()
        if (!cancelled && IDLE_EXEMPT_EMAILS.has(email)) {
          idleExemptRef.current = true
        }
      } catch {
        // leave ref at false — default behavior preserved
      }
    })()
    return () => { cancelled = true }
  }, [])

  const running = !!session && !session.ended_at

  // ─── Activity tracking ─────────────────────────────────────────────
  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (idleWarning) setIdleWarning(false)
  }, [idleWarning])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'focus']
    events.forEach((e) => window.addEventListener(e, markActivity, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, markActivity))
  }, [markActivity])

  // ─── Restore / auto-start on mount ─────────────────────────────────
  // Priority:
  //   1. Open session exists? → restore it silently
  //   2. No open session? → auto-clock-in via start_session RPC
  //      The RPC will revive a closed session if it ended < 15 min ago,
  //      otherwise it creates a fresh one. Either way the user is now
  //      clocked in without having to touch the header chip.
  useEffect(() => {
    if (didAutoStartRef.current) return
    didAutoStartRef.current = true

    ;(async () => {
      try {
        const open = await getMyOpenSession()
        if (open) {
          setSession(open)
          return
        }
        // No open session — try auto-start. start_session() is idempotent
        // and gated to internal team members, so a non-team account silently
        // 403s and we stay clocked-out (which is correct behavior).
        const s = await startSession()
        if (!s) return

        setSession(s)
        lastActivityRef.current = Date.now()

        // Detect revive: if started_at is older than a minute it means
        // we reopened an existing session rather than inserting a new one.
        const startedMs = new Date(s.started_at).getTime()
        if (Date.now() - startedMs > 60_000) {
          setRevivedFlash(true)
          setTimeout(() => setRevivedFlash(false), 5000)
        }
      } catch (err) {
        // Not-internal users hit the role gate — that's expected, not an error.
        if (!/internal team/i.test(err?.message || '')) {
          console.warn('[useClock] auto-start failed:', err?.message)
        }
      }
    })()
  }, [])

  // ─── Running counter tick ──────────────────────────────────────────
  useEffect(() => {
    if (!running) {
      setSeconds(0)
      if (tickTimerRef.current) clearInterval(tickTimerRef.current)
      return
    }
    const startedMs = new Date(session.started_at).getTime()
    const update = () => setSeconds(Math.floor((Date.now() - startedMs) / 1000))
    update()
    tickTimerRef.current = setInterval(update, TICK_MS)
    return () => clearInterval(tickTimerRef.current)
  }, [running, session?.started_at])

  // ─── Heartbeat + idle detection loop ───────────────────────────────
  useEffect(() => {
    if (!running) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (idleCheckRef.current) clearInterval(idleCheckRef.current)
      return
    }

    heartbeatRef.current = setInterval(() => {
      heartbeat()
    }, HEARTBEAT_MS)

    idleCheckRef.current = setInterval(() => {
      // Exempt accounts: heartbeat keeps their session open all day until they
      // manually clock out. Skip the idle warning + auto-end entirely.
      if (idleExemptRef.current) return
      const idle = Date.now() - lastActivityRef.current
      if (idle >= IDLE_TIMEOUT_MS) {
        // Auto clock-out
        endSession('idle_timeout')
          .then((s) => setSession(null))
          .catch((err) => console.warn('[useClock] auto-end failed:', err?.message))
      } else if (idle >= WARN_AT_MS) {
        setIdleWarning(true)
      }
    }, 15_000)

    return () => {
      clearInterval(heartbeatRef.current)
      clearInterval(idleCheckRef.current)
    }
  }, [running])

  // NOTE: No beforeunload handler. Logout / reload / tab-close should NOT
  // auto-end the session — if the user comes back within 15 min, the
  // start_session RPC will revive it. Stale sessions are cleaned up by
  // the server-side idle reaper (reap_idle_sessions) after 15 min of no
  // heartbeat. See migration pulse_start_session_revive_within_15min.

  // ─── Public actions ────────────────────────────────────────────────
  const clockIn = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const s = await startSession()
      setSession(s)
      lastActivityRef.current = Date.now()
      setIdleWarning(false)
      return s
    } finally {
      setBusy(false)
    }
  }, [busy])

  const clockOut = useCallback(async (reason = 'manual') => {
    if (busy) return
    setBusy(true)
    try {
      await endSession(reason)
      setSession(null)
      setIdleWarning(false)
    } finally {
      setBusy(false)
    }
  }, [busy])

  const acknowledgeIdle = useCallback(() => {
    lastActivityRef.current = Date.now()
    setIdleWarning(false)
  }, [])

  return {
    session,
    running,
    seconds,
    busy,
    idleWarning,
    revivedFlash,
    clockIn,
    clockOut,
    acknowledgeIdle,
  }
}
