import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import NotificationBell from './NotificationBell'
import ReportModal from './ReportModal'
import OrgSwitcher from './OrgSwitcher'

export default function GlobalHeader() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [reportOpen, setReportOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const initials = (profile?.full_name || user?.email || '?')[0].toUpperCase()
  const displayName = profile?.full_name || user?.email || 'User'
  const role = profile?.role || ''

  return (
    <>
      <header className="h-12 bg-navy-800/80 backdrop-blur-sm border-b border-navy-700/50 flex items-center justify-end gap-1 px-4 flex-shrink-0 z-30">
        {/* Bug Report Button */}
        <button
          onClick={() => setReportOpen(true)}
          className="relative p-2 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-navy-700/50 transition-colors group"
          title="Report Bug / Request Feature"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152-6.135 1.125 1.125 0 00-1.14-1.068l-.738.004c-.532.003-1.072-.095-1.551-.348-.354-.186-.752-.28-1.126-.28h-1c-.374 0-.772.094-1.126.28-.479.253-1.02.351-1.551.348l-.738-.004a1.125 1.125 0 00-1.14 1.068 23.91 23.91 0 01-1.152 6.135C9.353 13.258 12.117 12.75 12 12.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v.017c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-.017zM12 2.25c-1.892 0-3.483 1.273-3.97 3.009A2.21 2.21 0 009 6v.75h6V6a2.21 2.21 0 00.97-.741C15.483 3.523 13.892 2.25 12 2.25z" />
          </svg>
        </button>

        {/* Chat Shortcut */}
        <button
          onClick={() => navigate('/admin/chat')}
          className={`relative p-2 rounded-lg transition-colors ${
            location.pathname === '/admin/chat'
              ? 'text-brand-blue bg-brand-blue/10'
              : 'text-gray-400 hover:text-sky-400 hover:bg-navy-700/50'
          }`}
          title="Chat"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </button>

        {/* Notifications */}
        <NotificationBell />

        {/* Org Switcher (admin only) */}
        <OrgSwitcher />

        {/* Divider */}
        <div className="w-px h-6 bg-navy-700/50 mx-1" />

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-navy-700/50 transition-colors"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={displayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue text-xs font-bold flex-shrink-0">
                {initials}
              </div>
            )}
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 bg-navy-800 border border-navy-700/50 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-navy-700/50">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  {role && <span className="inline-block mt-1 text-[10px] font-medium text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full capitalize">{role}</span>}
                </div>
                <div className="p-1">
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/admin/settings'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-navy-700/50 rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Account Settings
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); signOut(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-red-400 hover:bg-navy-700/50 rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Report Modal */}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
    </>
  )
}
