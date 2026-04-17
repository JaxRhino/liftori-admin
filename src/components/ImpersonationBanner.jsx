/**
 * ImpersonationBanner
 *
 * Fixed banner rendered ABOVE the AdminLayout header when a founder is
 * viewing the app as another team member. Shows who they are viewing
 * as and a prominent "Return to admin" button so the founder can get
 * back to their own view without hunting for the control.
 *
 * Mounted inside AdminLayout at the very top of the root flex column,
 * so it pushes the rest of the layout down rather than overlapping
 * any existing header content.
 */
import { useAuth } from '../lib/AuthContext'

function initialsOf(name, email) {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base[0].toUpperCase()
}

function prettyRole(role) {
  if (!role) return ''
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ImpersonationBanner() {
  const { isImpersonating, profile, realProfile, stopImpersonation } = useAuth()

  if (!isImpersonating) return null

  const displayName = profile?.full_name || profile?.email || 'Unknown user'
  const roleLabel = prettyRole(profile?.role)
  const returningTo = realProfile?.full_name || realProfile?.email || 'admin'

  return (
    <div className="bg-amber-500 text-slate-900 flex-shrink-0 z-50 border-b border-amber-600">
      <div className="max-w-none px-3 py-2 flex items-center gap-3">
        {/* Eye icon */}
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>

        {/* Avatar + name */}
        <div className="flex items-center gap-2 min-w-0">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-2 ring-slate-900/20"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-slate-900/15 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
              {initialsOf(profile?.full_name, profile?.email)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">
              Viewing as {displayName}
              {roleLabel && (
                <span className="ml-2 text-xs font-medium bg-slate-900/20 px-1.5 py-0.5 rounded">
                  {roleLabel}
                </span>
              )}
            </div>
            <div className="text-[11px] opacity-80 leading-tight truncate">
              Preview only — writes still go to <span className="font-mono">{returningTo}</span>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Return to admin */}
        <button
          onClick={stopImpersonation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to admin
        </button>
      </div>
    </div>
  )
}
