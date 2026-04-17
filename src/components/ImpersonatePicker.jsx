/**
 * ImpersonatePicker
 *
 * Founder-only control mounted in GlobalHeader that opens a dropdown of
 * Liftori team members (no customers, no affiliates — `fetchUsers()` in
 * chatService.js filters by TEAM_ROLES). Clicking a user puts the app
 * into "view-as" mode via AuthContext.startImpersonation(userId).
 *
 * Only renders when the real logged-in user passes isFounder() — which
 * AuthContext surfaces as `canImpersonate`. Uses an explicit founder
 * gate here as well so a stale prop never leaks the button to a non-
 * founder admin.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { fetchUsers } from '../lib/chatService'

function initialsOf(name, email) {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base[0].toUpperCase()
}

export default function ImpersonatePicker() {
  const { canImpersonate, realUser, isImpersonating, startImpersonation } = useAuth()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  // Load team roster lazily on first open, cache for the session.
  useEffect(() => {
    if (!open || users.length > 0) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { users: rows } = await fetchUsers()
        if (!cancelled) setUsers(rows || [])
      } catch (err) {
        console.error('ImpersonatePicker fetchUsers failed', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, users.length])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = users.filter((u) => u.id !== realUser?.id)
    if (!q) return base
    return base.filter((u) => {
      const name = (u.name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      const role = (u.roleLabel || u.role || '').toLowerCase()
      return name.includes(q) || email.includes(q) || role.includes(q)
    })
  }, [users, query, realUser?.id])

  if (!canImpersonate) return null

  const pick = (id) => {
    startImpersonation(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-lg transition-colors ${
          isImpersonating
            ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
            : 'text-gray-400 hover:text-sky-400 hover:bg-navy-700/50'
        }`}
        title="View as another team member"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700/50 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/40">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-gray-400">
              View as team member
            </div>
            <div className="text-[11px] text-slate-500 dark:text-gray-500 mt-0.5">
              Preview their view. Your session is unchanged.
            </div>
          </div>
          <div className="p-2">
            <input
              autoFocus
              type="text"
              placeholder="Search name, email, role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-700 rounded-md text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {loading && (
              <div className="px-3 py-6 text-center text-sm text-slate-500 dark:text-gray-400">
                Loading team…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-500 dark:text-gray-400">
                No team members found
              </div>
            )}
            {!loading && filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => pick(u.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-700/50 transition-colors"
              >
                {u.avatar ? (
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center text-[11px] font-bold text-sky-600 dark:text-sky-400 flex-shrink-0">
                    {initialsOf(u.name, u.email)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">
                    {u.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                    {u.roleLabel || u.role || ''}{u.title ? ` · ${u.title}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
