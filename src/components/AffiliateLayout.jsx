import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchMyAffiliateEnrollment, getTier } from '../lib/affiliateProgramService'

const NAV = [
  { label: 'Dashboard',       path: '/affiliate',            icon: '🏠' },
  { label: 'Referrals',       path: '/affiliate/referrals',  icon: '💰' },
  { label: 'Content Creator', path: '/affiliate/content',    icon: '✍️' },
  { label: 'Scheduler',       path: '/affiliate/scheduler',  icon: '📅' },
  { label: 'Library',         path: '/affiliate/library',    icon: '📚' },
  { label: 'Ideas Generator', path: '/affiliate/ideas',      icon: '💡' },
  { label: 'Analytics',       path: '/affiliate/analytics',  icon: '📊' },
  { label: 'Brand CRM',       path: '/affiliate/crm',        icon: '💼' },
  { label: 'Inventory',       path: '/affiliate/inventory',  icon: '📦' },
  { label: 'Notes',           path: '/affiliate/notes',      icon: '📝' },
  { label: 'Tasks',           path: '/affiliate/tasks',      icon: '✅' },
  { label: 'Calendar',        path: '/affiliate/calendar',   icon: '🗓️' },
  { label: 'Chat',            path: '/affiliate/chat',       icon: '💬' },
  { label: 'Support',         path: '/affiliate/support',    icon: '🆘' },
  { label: 'Settings',        path: '/affiliate/settings',   icon: '⚙️' },
]

export default function AffiliateLayout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [enrollment, setEnrollment] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    fetchMyAffiliateEnrollment(user.id).then(setEnrollment).catch(console.error)
  }, [user?.id])

  const tier = enrollment ? getTier(enrollment.tier) : null
  const referralLink = enrollment?.referral_code
    ? `https://liftori.ai?ref=${enrollment.referral_code}`
    : null

  async function copyReferralLink() {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      toast.success('Referral link copied')
    } catch {
      toast.error('Copy failed — link is in your Referrals page')
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy-900 border-r border-navy-700/50 transform transition-transform md:static md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="px-5 py-5 border-b border-navy-700/50">
            <div className="flex items-center gap-2">
              <div className="text-xl font-extrabold text-brand-blue tracking-tight">Liftori</div>
              <span className="text-xs px-2 py-0.5 rounded bg-pink-500/15 text-pink-300 border border-pink-500/30 font-semibold">Creator</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">Creator Platform</div>
          </div>

          {/* User card */}
          <div className="px-4 py-3 border-b border-navy-700/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">{profile?.full_name || user?.email}</div>
                {tier && (
                  <div className="text-[10px] text-gray-400">
                    <span className="text-pink-300 font-semibold">{tier.label}</span>
                    {tier.price > 0 && <span> · ${tier.price}/mo</span>}
                    {enrollment && <span> · {(Number(enrollment.commission_rate) * 100).toFixed(0)}%</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-2">
            {NAV.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/affiliate'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2 text-sm transition ${
                    isActive
                      ? 'bg-pink-500/10 text-pink-300 border-l-2 border-pink-500'
                      : 'text-gray-400 hover:text-white hover:bg-navy-800 border-l-2 border-transparent'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Sign out */}
          <div className="border-t border-navy-700/50 p-3">
            <button onClick={signOut} className="w-full text-left text-xs text-gray-500 hover:text-rose-400 py-1 px-2">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-12 bg-navy-900/80 backdrop-blur-sm border-b border-navy-700/50 flex items-center gap-3 px-4 flex-shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-gray-400 hover:text-white"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Referral link chip */}
          {referralLink ? (
            <button
              onClick={copyReferralLink}
              className="flex items-center gap-2 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-lg px-3 py-1.5 transition font-mono max-w-[50vw] truncate"
              title="Click to copy your referral link"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              <span className="truncate">{referralLink.replace('https://', '')}</span>
            </button>
          ) : (
            <div className="text-xs text-gray-500 italic">No referral link yet</div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => navigate('/affiliate/support')} className="text-xs text-gray-400 hover:text-white px-2">Support</button>
            <button onClick={signOut} className="text-xs text-gray-500 hover:text-rose-400 px-2">Sign out</button>
          </div>
        </header>

        {/* Mobile backdrop */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
