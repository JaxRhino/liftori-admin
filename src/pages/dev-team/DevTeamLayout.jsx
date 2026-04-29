import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/admin/dev-team',          label: 'Overview', end: true },
  { to: '/admin/dev-team/tasks',    label: 'Tasks' },
  { to: '/admin/dev-team/ideas',    label: 'Feature Ideas' },
  { to: '/admin/dev-team/activity', label: 'Activity' },
  { to: '/admin/dev-team/canvas',   label: 'Canvas' },
  { to: '/admin/dev-team/skills',   label: 'Skills & Memory' },
  { to: '/admin/dev-team/agent-chat', label: 'Agent Chat' },
]

export default function DevTeamLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-brand-blue/80 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse"></span>
            Operations · Dev Team
          </div>
          <h1 className="text-2xl font-heading tracking-wide text-white mt-1">Dev Team</h1>
          <p className="text-white/50 text-sm mt-1 max-w-2xl">
            Private coordination layer for the Liftori build. Skills, memory, tasks, and live activity sync across every dev's Cowork session.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                isActive
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-white/50 hover:text-white'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}
