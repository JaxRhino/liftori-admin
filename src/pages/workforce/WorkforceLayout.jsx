import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'

const subNav = [
  { label: 'My Team',   path: '/admin/workforce' },
  { label: 'Activity',  path: '/admin/workforce/activity' },
  { label: 'Org Chart', path: '/admin/workforce/org-chart' },
]

export default function WorkforceLayout() {
  const { profile } = useAuth()
  const location = useLocation()
  const isAgentRoute = location.pathname.startsWith('/admin/workforce/agent/')

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Workforce</h1>
            <span className="text-sm text-slate-400">your AI executive team</span>
          </div>
          <p className="text-slate-400 mt-2 max-w-2xl">
            Seven AI executives running Liftori day-to-day. Sage holds strategy with Ryan; Atlas holds build with Mike; the rest run their domains. Every agent is real and shipping.
          </p>
        </div>

        {!isAgentRoute && (
          <nav className="flex gap-1 mb-8 border-b border-slate-800">
            {subNav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin/workforce'}
                className={({ isActive }) =>
                  `px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    isActive
                      ? 'text-white border-brand-blue'
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <Outlet />
      </div>
    </div>
  )
}
