// =====================================================================
// CrmOperations - Operations hub shell for service businesses
// Sub-tabs: Dashboard | Work Orders | Schedule | Crews | Inventory | Measurements
// Renders <Outlet /> for each sub-route.
// Mobile collapses tab row to a <select> dropdown.
// =====================================================================

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

const TABS = [
  { key: 'dashboard',    label: 'Dashboard',    path: 'dashboard' },
  { key: 'work-orders',  label: 'Work Orders',  path: 'work-orders' },
  { key: 'schedule',     label: 'Schedule',     path: 'schedule' },
  { key: 'crews',        label: 'Crews',        path: 'crews' },
  { key: 'inventory',    label: 'Inventory',    path: 'inventory' },
  { key: 'measurements', label: 'Measurements', path: 'measurements' },
]

export default function CrmOperations() {
  const location = useLocation()
  const navigate = useNavigate()

  // Derive active tab from URL last segment
  const segs = location.pathname.split('/').filter(Boolean)
  const last = segs[segs.length - 1] || 'dashboard'
  const activeKey = TABS.find(t => t.path === last)?.key || 'dashboard'

  return (
    <div>
      {/* Desktop / tablet: horizontal pill row */}
      <div className="hidden md:block bg-navy-900 border-b border-navy-700/50 px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map(tab => (
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
            const next = TABS.find(t => t.key === e.target.value)
            if (next) navigate(next.path)
          }}
          className="w-full bg-navy-800 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
        >
          {TABS.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      <Outlet />
    </div>
  )
}