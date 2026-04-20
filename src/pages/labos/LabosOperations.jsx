// =====================================================================
// LabosOperations — layout shell with 4-tab subnav.
// Tabs: Dashboard | Inventory | Fulfillment | Team
// Renders <Outlet /> for each sub-route.
// =====================================================================

import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Package, Truck, Users } from 'lucide-react'

const TABS = [
  { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: 'inventory', label: 'Inventory', icon: Package },
  { path: 'fulfillment', label: 'Fulfillment', icon: Truck },
  { path: 'team', label: 'Team', icon: Users },
]

export default function LabosOperations() {
  return (
    <div>
      {/* Subnav tab strip */}
      <div className="bg-navy-900 border-b border-navy-700/50 px-6">
        <div className="flex items-center gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
                    isActive
                      ? 'border-brand-blue text-brand-blue'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            )
          })}
        </div>
      </div>

      <Outlet />
    </div>
  )
}
