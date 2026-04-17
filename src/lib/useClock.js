/**
 * useClock — React hook that owns the user's work session state.
 *
 * Responsibilities:
 *   - Restore in-progress session on mount
 *   - Clock in / clock out via RPC
 *   - Heartbeat every 60s while clocked in (bumps session.updated_at)
 *   - Watch user activity (mouse/keyboard/focus). If none for IDLE_TIMEOUT, auto-end.
 *   - Warn at WARN_AT with a "Still working?" toast prompt
 *   - On tab close / reload, attempt to end the session (best-effort)
 *
 * Exposes:
 *   { session, running, seconds, clockIn, clockOut, idleWarning, acknowledgeIdle }
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  startSession,
  endSession,
  getMyOpenSession,
  heartbeat,
} from './pulseService'

const IDLE_TIMEOUT_MS = 15 * 60 * 1000   // 15 min — auto-end
const WARN_AT_MS      = 13 * 60 * 1000   // 13 min — show "still there?"
const HEARTBEAT_MS    = 60 * 1000        // 1 min
const TICK_MS         = 1000             // update running counter every second

export function useClock() {
  const [session, setSession] = useState(null)     // full row or null
  const [seconds, setSeconds] = useState(0)        // running seconds since start
  const [idleWarning, setIdleWarning] = useState(false)
  const [busy, setBusy] = useState(false)

  const lastActivityRef = useRef(Date.now())
  const tickTimerRef    = useRef(null)
  const heartbeatRef    = useRef(null)
  const idleCheckRef    = useRef(null)

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

  // ─── Restore on mount ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const s = await getMyOpenSession()
        if (s) setSession(s)
      } catch (err) {
        console.warn('[useClock] restore failed:', err?.message)
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

  // ─── beforeunload: best-effort clock-out ───────────────────────────
  useEffect(() => {
    if (!running) return
    const onUnload = () => {
      // Fire-and-forget — can't await in unload. The idle reaper will clean
      // up if this doesn't land.
      try {
        endSession('browser_close')
      } catch (_) {}
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [running])

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
    clockIn,
    clockOut,
    acknowledgeIdle,
  }
}
