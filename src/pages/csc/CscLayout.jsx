import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/admin/csc', label: 'Overview', end: true },
  { to: '/admin/csc/customers', label: 'Customers' },
  { to: '/admin/csc/jobs', label: 'Jobs' },
  { to: '/admin/csc/deficiencies', label: 'Deficiencies' },
  { to: '/admin/csc/invoices', label: 'Invoices' },
  { to: '/admin/csc/certificates', label: 'Certificates' },
  { to: '/admin/csc/stickers', label: 'Stickers' },
  { to: '/admin/csc/ahj', label: 'AHJ Map' },
]

export default function CscLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-orange-400/80 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
            LABOS-KEC · Demo Tenant
          </div>
          <h1 className="text-2xl font-heading tracking-wide text-white mt-1">CSC Services Hood &amp; Duct</h1>
          <p className="text-white/50 text-sm mt-1 max-w-2xl">
            Kitchen exhaust cleaning operations — NFPA 96 compliance, frequency tracking, deficiency upsells, AHJ-ready certificate issuance.
          </p>
        </div>
        <div className="text-right text-xs text-white/40">
          <div>Service area: CT · MA · RI · NY</div>
          <div className="mt-1">Demo data on VJ DB · csc_* namespace</div>
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
                isActive ? 'border-orange-400 text-orange-300' : 'border-transparent text-white/50 hover:text-white'
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
