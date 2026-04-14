import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchMyAffiliateEnrollment, getTier, AFFILIATE_TIERS } from '../../lib/affiliateProgramService'

export default function AffiliateDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [enrollment, setEnrollment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ referrals: 0, pending: 0, earned: 0, paid: 0 })

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      fetchMyAffiliateEnrollment(user.id),
      // referral counts — from existing affiliates table if any record exists
      supabase.from('affiliates').select('*').eq('email', user.email).maybeSingle(),
    ])
      .then(([enr, { data: legacy }]) => {
        setEnrollment(enr)
        if (legacy) {
          setStats((s) => ({ ...s, referrals: Number(legacy.referral_count || 0) }))
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.id, user?.email])

  const tier = enrollment ? getTier(enrollment.tier) : null
  const referralLink = enrollment?.referral_code
    ? `https://liftori.ai?ref=${enrollment.referral_code}`
    : null

  async function copy() {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      toast.success('Referral link copied')
    } catch { toast.error('Copy failed') }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!enrollment) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🎨</div>
          <h1 className="text-2xl font-bold text-white mb-2">No active Creator enrollment</h1>
          <p className="text-gray-400">Your account isn't enrolled yet. Reach out to Ryan.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Welcome */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi {(profile?.full_name || user.email).split(' ')[0]} 🎨</h1>
          <p className="text-sm text-gray-400">Your Creator Platform — tools, commissions, and audience growth in one place.</p>
        </div>
      </div>

      {/* Top row: referral + commission stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Referral link card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-pink-500/10 to-purple-500/5 border border-pink-500/30 rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-pink-300 font-bold">Your referral link</div>
          {referralLink ? (
            <>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <code className="text-sm font-mono text-white bg-navy-900/60 rounded px-3 py-2 flex-1 min-w-0 truncate">
                  {referralLink}
                </code>
                <button onClick={copy} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-bold">
                  Copy
                </button>
              </div>
              <div className="text-[10px] text-gray-500 mt-2">
                Share this link — 60-day cookie window, 30-day refund window, paid monthly.
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 mt-2">Referral code generation in progress…</div>
          )}
        </div>

        {/* Tier card */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Your tier</div>
          <div className="text-2xl font-bold text-white mt-1">{tier.label}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {tier.price === 0 ? 'Free forever' : `$${tier.price}/mo`} · {(Number(enrollment.commission_rate) * 100).toFixed(0)}% commission
          </div>
          {enrollment.tier !== 'pro' && (
            <button
              onClick={() => navigate('/affiliate/settings')}
              className="mt-3 text-xs text-pink-400 hover:text-pink-300 font-medium"
            >
              Upgrade tier →
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Referrals" value={stats.referrals} sub="total" color="text-white" />
        <Stat label="Pending commission" value={`$${stats.pending.toFixed(2)}`} sub="awaiting 30-day window" color="text-amber-400" />
        <Stat label="Earned this month" value={`$${stats.earned.toFixed(2)}`} sub="current period" color="text-emerald-400" />
        <Stat label="Lifetime paid" value={`$${stats.paid.toFixed(2)}`} sub="all-time" color="text-white" />
      </div>

      {/* Tool grid */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Your toolkit</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {TOOLS.map((t) => (
            <button
              key={t.path}
              onClick={() => navigate(t.path)}
              className="text-left p-4 bg-navy-800/50 hover:bg-navy-800 border border-navy-700/50 hover:border-pink-500/30 rounded-xl transition group"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{t.icon}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white group-hover:text-pink-300 transition">{t.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{t.desc}</div>
                </div>
              </div>
              {t.tier && t.tier !== 'free' && enrollment.tier === 'free' && (
                <div className="mt-2 inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                  {t.tier === 'creator' ? 'Creator+' : 'Pro only'}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Getting started tips */}
      <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Quick wins to get started</h2>
        <ul className="text-sm text-gray-300 space-y-2">
          <li className="flex gap-2"><span className="text-pink-400">1.</span> Copy your referral link (top-right) and share it on a post today.</li>
          <li className="flex gap-2"><span className="text-pink-400">2.</span> Set up your profile in Settings — niche, platforms, bio.</li>
          <li className="flex gap-2"><span className="text-pink-400">3.</span> Jump into Content Creator and explore the template library.</li>
          <li className="flex gap-2"><span className="text-pink-400">4.</span> Add your first 3 brand deal contacts in Brand CRM.</li>
          <li className="flex gap-2"><span className="text-pink-400">5.</span> Join the Creator chat to connect with the team — say hi!</li>
        </ul>
      </div>
    </div>
  )
}

const TOOLS = [
  { name: 'Content Creator', icon: '✍️', desc: 'Write captions, hooks, scripts', path: '/affiliate/content' },
  { name: 'Scheduler',       icon: '📅', desc: 'Plan + auto-post across platforms', path: '/affiliate/scheduler' },
  { name: 'Library',         icon: '📚', desc: 'Media, assets, templates',          path: '/affiliate/library' },
  { name: 'Ideas Generator', icon: '💡', desc: 'AI + template content ideas',       path: '/affiliate/ideas' },
  { name: 'Analytics',       icon: '📊', desc: 'Cross-platform audience insights',  path: '/affiliate/analytics' },
  { name: 'Brand CRM',       icon: '💼', desc: 'Sponsors, rate cards, pitches',     path: '/affiliate/crm' },
  { name: 'Inventory',       icon: '📦', desc: 'Merch + product tracking',          path: '/affiliate/inventory' },
  { name: 'Notes',           icon: '📝', desc: 'Capture ideas fast',                path: '/affiliate/notes' },
  { name: 'Tasks',           icon: '✅', desc: 'Daily to-do list',                  path: '/affiliate/tasks' },
  { name: 'Calendar',        icon: '🗓️', desc: 'Meetings, drops, launches',         path: '/affiliate/calendar' },
  { name: 'Chat',            icon: '💬', desc: 'Talk to the Liftori team',          path: '/affiliate/chat' },
  { name: 'Support',         icon: '🆘', desc: 'Get help fast',                     path: '/affiliate/support' },
]

function Stat({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className={`text-xl font-bold mt-0.5 tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
    </div>
  )
}
