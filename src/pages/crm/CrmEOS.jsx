// =====================================================================
// CrmEOS - EOS hub shell for service businesses
// Sub-tabs: Rocks | Issues | To-Dos | L10 Meetings | Scorecard | V/TO | Org Chart
// Renders <Outlet /> for each sub-route.
// Wave C.2.1 ships Rocks, Issues, To-Dos as real pages.
// Meetings, Scorecard, V/TO, Accountability Chart land in Wave C.2.2.
// Mobile collapses tab row to a <select> dropdown.
// =====================================================================

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

const HUB_DEFS = [
  { key: 'rocks',          label: 'Rocks',         path: 'rocks' },
  { key: 'issues',         label: 'Issues',        path: 'issues' },
  { key: 'todos',          label: 'To-Dos',        path: 'todos' },
  { key: 'meetings',       label: 'L10 Meetings',  path: 'meetings' },
  { key: 'scorecard',      label: 'Scorecard',     path: 'scorecard' },
  { key: 'vto',            label: 'V/TO',          path: 'vto' },
  { key: 'accountability', label: 'Org Chart',     path: 'accountability' },
]

export default function CrmEOS() {
  const location = useLocation()
  const navigate = useNavigate()

  // Derive active tab from URL last segment
  const segs = location.pathname.split('/').filter(Boolean)
  const last = segs[segs.length - 1] || 'rocks'
  const activeKey = HUB_DEFS.find(t => t.path === last)?.key || 'rocks'

  return (
    <div>
      {/* Desktop / tablet: horizontal pill row */}
      <div className="hidden md:block bg-navy-900 border-b border-navy-700/50 px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {HUB_DEFS.map(tab => (
            <NavLink
              key={tab.key}
              to={tab.path}
              end={false}
              className={({ isActive }) =>
                `whitespace-nowrap px-4 py-3 text-sm border-b-2 transition-colors ${
                  isActive
                    ? 'border-brand-cyan text-brand-cyan'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Mobile: select dropdown */}
      <div className="md:hidden bg-navy-900 border-b border-navy-700/50 px-4 py-3">
        <select
          value={activeKey}
          onChange={(e) => {
            const next = HUB_DEFS.find(t => t.key === e.target.value)
            if (next) navigate(next.path)
          }}
          className="w-full bg-navy-800 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
        >
          {HUB_DEFS.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      <Outlet />
    </div>
  )
}
