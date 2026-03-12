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
