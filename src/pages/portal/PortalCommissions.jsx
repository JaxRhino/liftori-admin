import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

const STATUS_COLORS = {
  pending:  'bg-yellow-500/20 text-yellow-400',
  paid:     'bg-green-500/20 text-green-400',
  approved: 'bg-blue-500/20 text-blue-400',
}

export default function PortalCommissions() {
  const { user } = useAuth()
  const [affiliate, setAffiliate] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total_earned: 0, pending: 0, paid: 0, referral_count: 0 })

  useEffect(() => {
    if (user) fetchCommissions()
  }, [user])

  async function fetchCommissions() {
    try {
      // Find affiliate record by email
      const { data: aff, error: affErr } = await supabase
        .from('affiliates')
        .select('*')
        .eq('email', user.email)
        .single()

      if (affErr || !aff) {
        setLoading(false)
        return
      }
      setAffiliate(aff)

      // Fetch referral signups that used this affiliate's code
      const { data: refs, error: refErr } = await supabase
        .from('waitlist_signups')
        .select('*')
        .eq('referral_code', aff.referral_code)
        .order('created_at', { ascending: false })

      if (!refErr) setReferrals(refs || [])

      // Calculate stats
      const referralCount = refs?.length || 0
      setStats({
        total_earned: 0, // Will be calculated when commission tracking is live
        pending: 0,
        paid: 0,
        referral_count: referralCount,
      })
    } catch (err) {
      console.error('Error fetching commissions:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!affiliate) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Commissions</h1>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">No Affiliate Account</h3>
          <p className="text-gray-400 text-sm">You don't have an active affiliate account yet. Contact us to join the affiliate program and start earning commissions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-1">Commissions</h1>
      <p className="text-gray-400 text-sm mb-6">Track your referrals and earnings</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Referrals</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.referral_count}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Commission Rate</p>
          <p className="text-2xl font-bold text-sky-400 mt-1">{(parseFloat(affiliate.commission_rate) * 100).toFixed(0)}%</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">${stats.pending.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Paid</p>
          <p className="text-2xl font-bold text-green-400 mt-1">${stats.paid.toFixed(2)}</p>
        </div>
      </div>

      {/* Referral Code */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Your Referral Code</p>
            <p className="text-xl font-mono font-bold text-sky-400 mt-1">{affiliate.referral_code}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Share Link</p>
            <p className="text-sm text-white mt-1 font-mono">liftori.ai?ref={affiliate.referral_code}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`https://www.liftori.ai?ref=${affiliate.referral_code}`)
            }}
            className="px-4 py-2 bg-sky-500/20 text-sky-400 rounded-lg text-sm hover:bg-sky-500/30 transition-colors"
          >
            Copy Link
          </button>
        </div>
      </div>

      {/* Referral History */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-white font-semibold">Referral History</h3>
        </div>
        {referrals.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No referrals yet. Share your link to start earning!
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {referrals.map((ref) => (
              <div key={ref.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{ref.full_name || 'Anonymous'}</p>
                  <p className="text-gray-500 text-xs">{ref.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">
                    {new Date(ref.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
