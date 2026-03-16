import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const APP_TYPE_LABELS = {
  ecommerce: 'E-Commerce',
  booking: 'Booking / Scheduling',
  ai_automation: 'AI Automation',
  saas: 'SaaS',
  portfolio: 'Portfolio',
  marketplace: 'Marketplace',
  other: 'Other'
}

const BUDGET_LABELS = {
  under_1k: 'Under $1K',
  '1k_5k': '$1K – $5K',
  '5k_10k': '$5K – $10K',
  '10k_plus': '$10K+',
  not_sure: 'Not Sure'
}

const TIMELINE_LABELS = {
  asap: 'ASAP',
  one_month: 'Within 1 Month',
  three_months: 'Within 3 Months',
  no_rush: 'No Rush'
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function DetailPanel({ signup, onClose }) {
  if (!signup) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-navy-900 border-l border-navy-700 z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-700">
          <div>
            <h2 className="text-lg font-bold text-white">{signup.full_name}</h2>
            <p className="text-sm text-gray-400">{signup.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Build Idea — hero field */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Build Idea</p>
            <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                {signup.build_idea || '—'}
              </p>
            </div>
          </div>

          {/* Key details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">App Type</p>
              <p className="text-sm text-white">{APP_TYPE_LABELS[signup.app_type] || signup.app_type || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Budget Range</p>
              <p className="text-sm text-white">{BUDGET_LABELS[signup.budget_range] || signup.budget_range || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Timeline</p>
              <p className="text-sm text-white">{TIMELINE_LABELS[signup.timeline] || signup.timeline || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Design Style</p>
              <p className="text-sm text-white capitalize">{signup.design_style || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Color Preference</p>
              <p className="text-sm text-white">{signup.color_preference || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Signed Up</p>
              <p className="text-sm text-white">{formatDate(signup.created_at)}</p>
            </div>
          </div>

          {/* Target Audience */}
          {signup.target_audience && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Target Audience</p>
              <p className="text-sm text-white">{signup.target_audience}</p>
            </div>
          )}

          {/* Key Features */}
          {signup.key_features && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Key Features</p>
              <div className="bg-navy-800 rounded-lg p-4 border border-navy-700">
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{signup.key_features}</p>
              </div>
            </div>
          )}

          {/* Referral Code */}
          {signup.referral_code && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Referred By</p>
              <code className="text-xs bg-navy-700 px-2 py-1 rounded font-mono text-brand-light">
                {signup.referral_code}
              </code>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-navy-700 flex gap-3">
            <a
              href={`mailto:${signup.email}`}
              className="btn-primary text-sm"
            >
              Email {signup.full_name.split(' ')[0]}
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Waitlist() {
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchSignups()
  }, [])

  async function fetchSignups() {
    try {
      const { data, error } = await supabase
        .from('waitlist_signups')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSignups(data || [])
    } catch (err) {
      console.error('Error fetching waitlist:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = signups.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.build_idea || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Waitlist</h1>
          <p className="text-gray-400 text-sm mt-1">
            {signups.length} signup{signups.length !== 1 ? 's' : ''} — click any row to view full details
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          className="input max-w-sm"
          placeholder="Search by name, email, or idea…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Total Signups</p>
          <p className="text-2xl font-bold text-brand-blue">{signups.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">This Week</p>
          <p className="text-2xl font-bold text-purple-400">
            {signups.filter(s => {
              const d = new Date(s.created_at)
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              return d > weekAgo
            }).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">AI Automation</p>
          <p className="text-2xl font-bold text-emerald-400">
            {signups.filter(s => s.app_type === 'ai_automation').length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Via Referral</p>
          <p className="text-2xl font-bold text-orange-400">
            {signups.filter(s => s.referral_code).length}
          </p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-sm">
            {search ? 'No results match your search.' : 'No signups yet.'}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">App Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Idea</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr
                  key={s.id}
                  className="table-row cursor-pointer"
                  onClick={() => setSelected(s)}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{s.full_name}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-navy-700 text-brand-light px-2 py-1 rounded">
                      {APP_TYPE_LABELS[s.app_type] || s.app_type || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-gray-300 truncate">
                      {s.build_idea || <span className="text-gray-600">No idea submitted</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {BUDGET_LABELS[s.budget_range] || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                    {formatDate(s.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      <DetailPanel signup={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
