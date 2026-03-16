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
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Waitlist() {
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

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
      console.error('Error fetching signups:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = signups.filter(s => {
    const matchesSearch = !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.build_idea?.toLowerCase().includes(search.toLowerCase())

    let matchesFilter = true
    if (filter === 'has_idea') matchesFilter = !!s.build_idea
    if (filter === 'referred') matchesFilter = !!s.referral_code
    if (filter === 'unconverted') matchesFilter = !s.converted

    return matchesSearch && matchesFilter
  })

  const stats = {
    total: signups.length,
    withIdeas: signups.filter(s => s.build_idea).length,
    referred: signups.filter(s => s.referral_code).length,
    today: signups.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Waitlist</h1>
          <p className="text-gray-400 text-sm mt-1">{stats.total} total signups</p>
        </div>
        <button
          onClick={() => exportCSV(signups)}
          className="btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Total</p>
          <p className="text-2xl font-bold text-brand-blue">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">With Ideas</p>
          <p className="text-2xl font-bold text-purple-400">{stats.withIdeas}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Referred</p>
          <p className="text-2xl font-bold text-orange-400">{stats.referred}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Today</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.today}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          className="input max-w-xs"
          placeholder="Search name, email, or idea..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'has_idea', label: 'Has Idea' },
            { key: 'referred', label: 'Referred' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-brand-blue/20 text-brand-blue'
                  : 'text-gray-400 hover:text-white hover:bg-navy-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Idea</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(signup => (
                <tr key={signup.id} className="table-row">
                  <td className="px-4 py-3 text-sm font-medium text-white">{signup.full_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{signup.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">{signup.build_idea || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{signup.app_type || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {signup.referral_code ? (
                      <span className="badge bg-brand-blue/10 text-brand-blue">{signup.referral_code}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(signup.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/waitlist/convert/${signup.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-cyan/10 text-brand-cyan text-xs font-medium rounded-lg hover:bg-brand-cyan/20 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                      </svg>
                      Convert
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {search ? 'No signups match your search' : 'No signups yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function exportCSV(signups) {
  const headers = ['Name', 'Email', 'Build Idea', 'App Type', 'Referral', 'Date']
  const rows = signups.map(s => [
    s.full_name || '',
    s.email,
    s.build_idea || '',
    s.app_type || '',
    s.referral_code || '',
    new Date(s.created_at).toLocaleDateString()
  ])

  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `liftori-waitlist-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
