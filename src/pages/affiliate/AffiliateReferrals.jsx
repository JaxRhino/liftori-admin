import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchMyAffiliateEnrollment, getTier } from '../../lib/affiliateProgramService'

export default function AffiliateReferrals() {
  const { user } = useAuth()
  const [enrollment, setEnrollment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [legacy, setLegacy] = useState(null) // existing affiliates table record

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      fetchMyAffiliateEnrollment(user.id),
      supabase.from('affiliates').select('*').eq('email', user.email).maybeSingle(),
    ])
      .then(([enr, { data: a }]) => { setEnrollment(enr); setLegacy(a) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.id, user?.email])

  const tier = enrollment ? getTier(enrollment.tier) : null
  const referralLink = enrollment?.referral_code ? `https://liftori.ai?ref=${enrollment.referral_code}` : null

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast.success('Copied') }
    catch { toast.error('Copy failed') }
  }

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center text-gray-500">Loading…</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">💰 Referrals</h1>
        <p className="text-sm text-gray-400">Your referral link, performance, and payout history.</p>
      </div>

      {/* Hero: referral link */}
      <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/5 border border-pink-500/30 rounded-xl p-6">
        <div className="text-xs uppercase tracking-wider text-pink-300 font-bold mb-2">Your unique referral link</div>
        {referralLink ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-base font-mono text-white bg-navy-900/60 rounded px-4 py-3 flex-1 min-w-0 break-all">{referralLink}</code>
              <button onClick={() => copy(referralLink)} className="px-5 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-bold">Copy</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 text-xs">
              <button onClick={() => copy(`Check out Liftori — AI-powered platform builder + business OS. Use my link: ${referralLink}`)} className="p-2 bg-navy-800/60 hover:bg-navy-800 border border-navy-700/50 rounded text-left text-gray-300">
                📱 Copy IG-ready text
              </button>
              <button onClick={() => copy(`I built my platform with Liftori. If you're starting a business, check it out: ${referralLink} (affiliate — I get a commission if you sign up)`)} className="p-2 bg-navy-800/60 hover:bg-navy-800 border border-navy-700/50 rounded text-left text-gray-300">
                ✍️ Copy X/LinkedIn post
              </button>
              <button onClick={() => copy(`(Use this in your bio) Build your business: ${referralLink}`)} className="p-2 bg-navy-800/60 hover:bg-navy-800 border border-navy-700/50 rounded text-left text-gray-300">
                🔗 Copy bio link
              </button>
              <button onClick={() => copy(referralLink + '&utm_source=email')} className="p-2 bg-navy-800/60 hover:bg-navy-800 border border-navy-700/50 rounded text-left text-gray-300">
                📧 Copy email UTM link
              </button>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-400">Referral code generation in progress…</div>
        )}
      </div>

      {/* Commission structure */}
      {tier && (
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5">
          <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
            <div>
              <div className="text-xs uppercase font-bold text-gray-500">Your tier</div>
              <div className="text-2xl font-bold text-white mt-1">{tier.label}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Commission rate</div>
              <div className="text-3xl font-bold text-emerald-400 tabular-nums">{(Number(enrollment.commission_rate) * 100).toFixed(0)}%</div>
            </div>
          </div>
          <p className="text-sm text-gray-400">{tier.tagline}</p>
        </div>
      )}

      {/* Performance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total referrals" value={legacy?.referral_count || 0} sub="all-time" />
        <Stat label="Pending commission" value="$0.00" sub="awaiting refund window" color="text-amber-400" />
        <Stat label="Earned this month" value="$0.00" sub="current period" color="text-emerald-400" />
        <Stat label="Lifetime paid" value="$0.00" sub="all-time payouts" />
      </div>

      <div className="text-xs text-gray-500 italic bg-navy-800/30 rounded-lg p-3">
        Pre-launch — commissions activate when Liftori hits its first paid customers. Per your agreement, every qualifying referral you send now still tracks + counts toward future payouts when we're profitable.
      </div>

      {/* FTC disclosure helpers */}
      <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-5">
        <div className="text-sm font-semibold text-white mb-2">FTC disclosure templates</div>
        <p className="text-xs text-gray-500 mb-3">Per your Creator Agreement (Section 2c), always disclose the affiliate relationship. Copy any of these:</p>
        <div className="space-y-2">
          {[
            '#ad #LiftoriAffiliate',
            'I\'m a Liftori affiliate — I earn a commission if you sign up through my link.',
            '(Partner) Use my link for Liftori — discount + I get a small cut.',
            'This post includes an affiliate link. I only recommend tools I actually use.',
          ].map((t) => (
            <div key={t} className="flex items-center gap-2 bg-navy-900/40 rounded p-2">
              <code className="text-xs text-gray-300 flex-1">{t}</code>
              <button onClick={() => copy(t)} className="text-xs text-pink-400 hover:text-pink-300">Copy</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className={`text-xl font-bold mt-0.5 tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
    </div>
  )
}
