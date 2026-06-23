// =====================================================================
// CrmLayout — The LABOS chrome: left sidebar + top header.
// Wraps all 8 hub pages. Shows when Ryan (admin) clicks a platform
// card and jumps INTO that client's LABOS backend.
// =====================================================================

import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Bug, ExternalLink, Globe, GraduationCap, Sparkles } from 'lucide-react'
import { CrmProvider, useCrm } from '../../contexts/CrmContext'
import BugReportModal from './BugReportModal'

const HUB_DEFS = [
  { key:'dashboard',      label:'Dashboard',      path:'dashboard',      icon: DashboardIcon },
  { key:'sales',          label:'Sales',          path:'sales',          icon: SalesIcon },
  { key:'operations',     label:'Operations',     path:'operations',     icon: OpsIcon },
  { key:'calendar',       label:'Calendar',       path:'calendar',       icon: CalendarIcon },
  { key:'tasks',          label:'Tasks',          path:'tasks',          icon: TasksIcon },
  { key:'notes',          label:'Notes',          path:'notes',          icon: NotesIcon },
  { key:'finance',        label:'Finance',        path:'finance',        icon: FinanceIcon },
  { key:'marketing',      label:'Marketing',      path:'marketing',      icon: MarketingIcon },
  { key:'call_center',    label:'Call Center',    path:'call-center',    icon: CommsIcon },
  { key:'communications', label:'Communications', path:'communications', icon: CommsIcon },
  { key:'chat',           label:'Chat',           path:'chat',           icon: ChatIcon },
  { key:'eos',            label:'EOS',            path:'eos',            icon: EOSIcon },
  { key:'university',     label:'University',     path:'university/sales', icon: GraduationCap },
]

// Hubs that expand into a dropdown of sub-pages. Sub-page paths must match
// the child routes mounted under /crm/:platformId in App.jsx.
const HUB_CHILDREN = {
  // E-commerce industry Marketing dropdown. Only rendered when an
  // ECOM_HUB_DEFS hub carries this key, so it is a no-op for every
  // non-ecommerce tenant.
  ecom_marketing: [
    { label: 'Social',    path: 'social' },
    { label: 'Marketing', path: 'marketing' },
  ],
  sales: [
    { label: 'Customers',    path: 'customers' },
    { label: 'Pipeline',     path: 'pipeline' },
    { label: 'Lead Sources', path: 'lead-sources' },
    { label: 'Commissions',  path: 'commissions' },
    { label: 'Sequences',    path: 'sequences' },
  ],
  university: [
    { label: 'Sales', path: 'university/sales' },
    { label: 'Operations', path: 'university/operations' },
    { label: 'Management', path: 'university/manager' },
    { label: 'Owner / Business', path: 'university/owner' },
  ],
  operations: [
    { label: 'Dashboard',         path: 'operations/dashboard' },
    { label: 'Ops Pipeline',      path: 'ops-pipeline' },
    { label: 'Jobs',       path: 'operations/work-orders' },
    { label: 'Production',        path: 'operations/production' },
    { label: 'Subcontractors',    path: 'operations/subcontractors' },
    { label: 'Schedule',          path: 'operations/schedule' },
    { label: 'Crews',             path: 'operations/crews' },
    { label: 'Crew Availability', path: 'operations/crew-availability' },
    { label: 'Job Map',           path: 'operations/map' },
    { label: 'Inventory',         path: 'operations/inventory' },
  ],
  eos: [
    { label: 'Rocks', path: 'eos/rocks' },
    { label: 'Scorecard', path: 'eos/scorecard' },
    { label: 'Issues', path: 'eos/issues' },
    { label: 'To-Dos', path: 'eos/todos' },
    { label: 'Vision', path: 'eos/vto' },
    { label: 'Level 10', path: 'eos/meetings' },
    { label: 'Accountability', path: 'eos/accountability' },
    { label: 'Headlines', path: 'eos/headlines' },
  ],
}

export default function CrmLayout() {
  return (
    <CrmProvider>
      <LabosShell />
    </CrmProvider>
  )
}

function LabosShell() {
  const { platform, orgSettings, enabledHubs, loading, error, platformId } = useCrm()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const [navPinned, setNavPinned] = useState(() => { try { return localStorage.getItem('crm_nav_pinned') !== '0' } catch (e) { return true } })
  function toggleNavPinned() { setNavPinned(p => { const n = !p; try { localStorage.setItem('crm_nav_pinned', n ? '1' : '0') } catch (e) {} return n }) }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center p-6">
        <div className="max-w-md bg-navy-800 border border-red-500/30 rounded-xl p-6 text-center">
          <h2 className="text-red-400 font-semibold mb-2">LABOS unavailable</h2>
          <p className="text-sm text-gray-400 mb-4">{error.message}</p>
          <button onClick={() => navigate('/admin/products')} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm">
            Back to Products
          </button>
        </div>
      </div>
    )
  }

  const clientName = orgSettings?.business_name || platform?.client_name || 'Liftori'
  // The base CRM is always the floor for every industry. A tenant's
  // labos_hubs can pick which base hubs show; industry-specific add-ons
  // are layered on as we build them. If a tenant's labos_hubs match NONE
  // of the base hubs (misconfigured / industry-only keys), fall back to
  // the full base CRM so we never render a bare sidebar.
  const CSC_HUB_DEFS = [
    { key: 'overview', label: 'Overview', path: 'overview', icon: DashboardIcon },
    { key: 'jobs', label: 'Jobs', path: 'jobs', icon: OpsIcon },
    { key: 'deficiencies', label: 'Deficiencies', path: 'deficiencies', icon: NotificationsIcon },
    { key: 'certificates', label: 'Certificates', path: 'certificates', icon: NotesIcon },
    { key: 'stickers', label: 'Stickers', path: 'stickers', icon: TasksIcon },
    { key: 'ahj', label: 'AHJ Map', path: 'ahj', icon: CalendarIcon },
    { key: 'customers', label: 'Customers', path: 'customers', icon: SalesIcon },
    { key: 'invoices', label: 'Invoices', path: 'invoices', icon: FinanceIcon },
  ]
  // E-commerce industry tenants (e.g. VJ Thrift Finds) get a curated
  // retail nav: shop hubs first, then the base hubs minus the
  // service-only ones. Gated on platform.industry === 'ecommerce'.
  const ECOM_HUB_DEFS = [
    { key: 'ecom_dashboard', label: 'Dashboard', path: 'dashboard', icon: DashboardIcon },
    { key: 'ecom_listings',  label: 'Listings',  path: 'listings',  icon: TagIcon },
    { key: 'ecom_orders',    label: 'Orders',    path: 'orders',    icon: BagIcon },
    { key: 'ecom_customers', label: 'Customers', path: 'customers', icon: SalesIcon },
    { key: 'ecom_marketing', label: 'Marketing', path: 'marketing', icon: MarketingIcon },
    { key: 'ecom_finance',   label: 'Finance',   path: 'finance',   icon: FinanceIcon },
  ]
  // Base hubs hidden for ecommerce: covered by ECOM_HUB_DEFS (dashboard,
  // marketing, finance) or service-only (sales pipeline, operations,
  // university - not seeded for ecomm yet).
  const ECOM_HIDDEN_BASE = ['dashboard', 'sales', 'operations', 'university', 'marketing', 'finance', 'eos']
  const matchedHubs = HUB_DEFS.filter(h => enabledHubs.includes(h.key))
  const baseHubs = matchedHubs.length > 0 ? matchedHubs : HUB_DEFS
  // KEC (hood-cleaning) industry tenants get the industry hub layer appended.
  // E-commerce tenants get the curated retail nav; everyone else is untouched.
  const hubs = platform?.industry === 'kec'
    ? [...baseHubs, ...CSC_HUB_DEFS]
    : platform?.industry === 'ecommerce'
      ? [...ECOM_HUB_DEFS, ...baseHubs.filter(h => !ECOM_HIDDEN_BASE.includes(h.key)), { key: 'assistant', label: 'AI Assistant', path: 'assistant', icon: Sparkles }]
      : baseHubs

  return (
    <div className="crm-theme min-h-screen bg-navy-950 flex">
      {/* Mobile drawer backdrop */}
      {drawerOpen && <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 bg-black/50 z-30 lg:hidden" />}
      {/* SIDEBAR */}
      <aside className={`w-64 bg-navy-900 border-r border-navy-700/50 flex flex-col fixed h-screen z-40 transform transition-transform duration-200 ${navPinned ? 'lg:translate-x-0' : 'lg:-translate-x-full'} ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-navy-700/50">
          <button
            onClick={() => navigate('/admin/products')}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-3"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            All Products
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white font-bold">
              {clientName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold truncate">{clientName}</div>
              <div className="text-xs text-brand-blue">Liftori</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {hubs.map(hub => {
            const Icon = hub.icon
            const children = HUB_CHILDREN[hub.key]
            if (children) {
              const groupActive = children.some(ch => location.pathname.startsWith(`/crm/${platformId}/${ch.path}`)) || location.pathname === `/crm/${platformId}/${hub.path}`
              const isOpen = openGroups[hub.key] !== undefined ? openGroups[hub.key] : groupActive
              return (
                <div key={hub.key}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups(g => ({ ...g, [hub.key]: !(g[hub.key] !== undefined ? g[hub.key] : groupActive) }))}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      groupActive ? 'text-brand-blue' : 'text-gray-400 hover:bg-navy-800 hover:text-white'
                    }`}
                  >
                    {Icon ? <Icon className="w-4 h-4" /> : null}
                    <span className="flex-1 text-left">{hub.label}</span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="mt-1 ml-4 pl-3 border-l border-navy-700/50 space-y-1">
                      {children.map(ch => (
                        <NavLink
                          key={ch.path}
                          to={`/crm/${platformId}/${ch.path}`}
                          end
                          onClick={() => setDrawerOpen(false)}
                          className={({ isActive }) =>
                            `block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              isActive
                                ? 'bg-brand-blue/15 text-brand-blue'
                                : 'text-gray-500 hover:bg-navy-800 hover:text-white'
                            }`
                        }
                      >
                        {ch.label}
                      </NavLink>
                    ))}
                    </div>
                  )}
                </div>
              )
            }
            return (
              <NavLink
                key={hub.key}
                to={`/crm/${platformId}/${hub.path}`}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-blue/15 text-brand-blue'
                      : 'text-gray-400 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                {Icon ? <Icon className="w-4 h-4" /> : null}
                <span>{hub.label}</span>
              </NavLink>
            )
          })}
          {/* Website -- external link to the tenant's live site, only if they have one */}
          {platform?.site_url && (
            <a
              href={platform.site_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-400 hover:bg-navy-800 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
              </svg>
              <span className="flex-1 text-left">Website</span>
              <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5l-8 8M11 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" />
              </svg>
            </a>
          )}
          {/* Settings -- pinned at the bottom */}
          <div className="h-px bg-navy-700/50 my-3 mx-1" />
          <NavLink
            to={`/crm/${platformId}/settings`}
            onClick={() => setDrawerOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-blue/15 text-brand-blue'
                  : 'text-gray-400 hover:bg-navy-800 hover:text-white'
              }`
            }
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-navy-700/50">
          <div className="text-xs text-gray-500">
            Powered by <span className="text-brand-blue font-medium">Liftori</span>
          </div>
          <div className="text-[10px] text-gray-600 mt-1">{platform?.industry?.replace('_',' ')}</div>
        </div>
      </aside>

      {/* MAIN */}
      <div className={`flex-1 ml-0 ${navPinned ? 'lg:ml-64' : 'lg:ml-0'} flex flex-col min-h-screen transition-all duration-200`}>
        <CrmHeader onMenu={() => setDrawerOpen(true)} navPinned={navPinned} onToggleNav={toggleNavPinned} />
        <main className="flex-1 bg-navy-900">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function CrmHeader({ onMenu, navPinned, onToggleNav }) {
  const { client, platform, orgSettings } = useCrm()
  const siteUrl = platform?.site_url
  const [showNotifications, setShowNotifications] = useState(false)
  const [showBugModal, setShowBugModal] = useState(false)
  const [notifications, setNotifications] = useState([])
  const navigate = useNavigate()

  async function loadNotifications() {
    if (!client) return
    const { data } = await client
      .from('notifications')
      .select('*')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
    setNotifications(data || [])
  }

  function toggleNotifications() {
    if (!showNotifications) loadNotifications()
    setShowNotifications(!showNotifications)
  }

  const userInitials = (orgSettings?.business_name || platform?.client_name || 'L')
    .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header className="h-14 bg-navy-900 border-b border-navy-700/50 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <button onClick={onMenu} className="lg:hidden -ml-2 mr-1 w-9 h-9 rounded-lg hover:bg-navy-800 flex items-center justify-center text-gray-300" aria-label="Open menu">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <button onClick={onToggleNav} className="hidden lg:flex -ml-2 mr-1 w-9 h-9 rounded-lg hover:bg-navy-800 items-center justify-center text-gray-300" title={navPinned ? 'Hide sidebar' : 'Show sidebar'} aria-label="Toggle sidebar">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="text-sm text-gray-500">Liftori</span>
        <span className="text-gray-600">/</span>
        <span className="text-sm text-white font-medium">{orgSettings?.business_name || platform?.client_name}</span>
      </div>

      <div className="flex items-center gap-2">

        {/* CHAT ICON — jumps to Chat hub */}
        <button
          onClick={() => navigate(`/crm/${platform.id}/chat`)}
          className="w-9 h-9 rounded-lg hover:bg-navy-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          title="Chat"
        >
          <ChatIcon className="w-4 h-4" />
        </button>

        {/* BUG REPORT */}
        <button
          onClick={() => setShowBugModal(true)}
          className="w-9 h-9 rounded-lg hover:bg-amber-500/10 flex items-center justify-center text-amber-400 hover:text-amber-300 transition-colors"
          title="Report a bug or ask Liftori support"
        >
          <Bug className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>

        {/* NOTIFICATIONS BELL */}
        <div className="relative">
          <button
            onClick={toggleNotifications}
            className="w-9 h-9 rounded-lg hover:bg-navy-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title="Notifications"
          >
            <BellIcon className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-brand-blue rounded-full" />
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-11 w-80 bg-navy-800 border border-navy-700/50 rounded-xl shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Notifications</span>
                <button onClick={() => setShowNotifications(false)} className="text-gray-500 hover:text-white text-xs">Close</button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500">You're all caught up.</div>
                ) : notifications.map(n => (
                  <div key={n.id} className="px-4 py-3 border-b border-navy-700/30 hover:bg-navy-900/50">
                    <div className="text-sm text-white">{n.title}</div>
                    {n.body && <div className="text-xs text-gray-400 mt-0.5">{n.body}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PROFILE */}
        <button
          onClick={() => navigate(`/crm/${platform.id}/dashboard`)}
          className="ml-2 w-9 h-9 rounded-full bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white text-xs font-bold hover:ring-2 hover:ring-brand-blue/40 transition-all"
          title="Profile"
        >
          {userInitials}
        </button>
      </div>

      {showBugModal && <BugReportModal onClose={() => setShowBugModal(false)} />}
    </header>
  )
}

// ---------- Icons ----------
function DashboardIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h3v7H4V6zm0 10a2 2 0 002 2h3v-7H4v5zm13 2a2 2 0 002-2v-4h-5v6h3zm2-14a2 2 0 00-2-2h-3v7h5V4z" /></svg> }
function SalesIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-4 4 4 5-5" /></svg> }
function OpsIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> }
function MarketingIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> }
function FinanceIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function CommsIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> }
function ChatIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> }
function CalendarIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> }
function TasksIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> }
function NotesIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> }
function EOSIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg> }
function NotificationsIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> }
function BellIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> }
function TagIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 015 10V5a2 2 0 012-2z" /></svg> }
function BagIcon({ className }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg> }
