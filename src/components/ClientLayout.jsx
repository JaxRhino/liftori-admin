import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useState } from 'react'

const navItems = [
  {
    label: 'Dashboard',
    path: '/portal',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    )
  },
  {
    label: 'My Project',
    path: '/portal/project',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    )
  },
  {
    label: 'Messages',
    path: '/portal/messages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    )
  },
  {
    label: 'Documents',
    path: '/portal/documents',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  },
  {
    label: 'Invoices',
    path: '/portal/invoices',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    )
  }
]

export default function ClientLayout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} bg-navy-800 border-r border-navy-700/50 flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-navy-700/50">
          <span className="font-display text-2xl tracking-wider text-white">
            {sidebarOpen ? 'LIFTORI' : 'L'}
          </span>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={sidebarOpen ? "M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" : "M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5"} />
            </svg>
          </button>
        </div>

        {/* Portal badge */}
        {sidebarOpen && (
          <div className="px-4 py-2 border-b border-navy-700/50">
            <span className="text-xs font-medium text-brand-blue bg-brand-blue/10 px-2 py-1 rounded-full">
              Client Portal
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/portal'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-blue/10 text-brand-blue'
                    : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                }`
              }
            >
              {item.icon}
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* New Project CTA */}
        <div className="px-3 py-2">
          <NavLink
            to="/portal/new-project"
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-blue text-white'
                  : 'bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20'
              }`
            }
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {sidebarOpen && <span>New Project</span>}
          </NavLink>
        </div>

        {/* User */}
        <div className="p-3 border-t border-navy-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue text-sm font-bold flex-shrink-0">
              {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name || user?.email}
                </p>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
