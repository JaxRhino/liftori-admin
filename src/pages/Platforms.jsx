import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_COLORS = {
  'Live': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'In Build': 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  'On Hold': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Completed': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Cancelled': 'bg-red-500/10 text-red-400 border-red-500/20'
}

const TYPE_COLORS = {
  'Web App': 'text-brand-blue',
  'Mobile App': 'text-brand-cyan',
  'Business Platform': 'text-purple-400',
  'E-Commerce': 'text-amber-400'
}

export default function Platforms() {
  const [platforms, setPlatforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPlatform, setNewPlatform] = useState({
    client_name: '', owner_name: '', owner_email: '',
    site_url: '', admin_url: '', domain: '',
    platform_type: 'Web App', status: 'In Build', notes: ''
  })

  useEffect(() => { fetchPlatforms() }, [])

  async function fetchPlatforms() {
    setLoading(true)
    setFetchError(null)
    const { data, error } = await supabase
      .from('platforms')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      // Surface instead of silently swallowing — empty-state and RLS/auth
      // failures used to look identical in the UI. Now we always know which.
      console.error('[Platforms] fetch failed:', error)
      setFetchError(error.message || String(error))
      setPlatforms([])
    } else {
      setPlatforms(data || [])
    }
    setLoading(false)
  }

  async function handleAddPlatform(e) {
    e.preventDefault()
    const { error } = await supabase.from('platforms').insert([newPlatform])
    if (!error) {
      setShowAddModal(false)
      setNewPlatform({
        client_name: '', owner_name: '', owner_email: '',
        site_url: '', admin_url: '', domain: '',
        platform_type: 'Web App', status: 'In Build', notes: ''
      })
      fetchPlatforms()
    }
  }

  const filtered = platforms.filter(p => {
    const matchesSearch = !search ||
      p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.domain?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    const matchesType = typeFilter === 'all' || p.platform_type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const stats = {
    total: platforms.length,
    active: platforms.filter(p => p.status === 'Live').length,
    buildsThisMonth: platforms.filter(p => p.created_at >= monthStart).length,
    revenue: platforms.reduce((sum, p) => sum + (p.monthly_revenue || 0), 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-900 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Platforms</h1>
          <p className="text-gray-400 text-sm mt-1">Manage all built client platforms</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Platform
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Platforms', value: stats.total, color: 'text-white' },
          { label: 'Active / Live', value: stats.active, color: 'text-emerald-400' },
          { label: 'Builds This Month', value: stats.buildsThisMonth, color: 'text-brand-blue' },
          { label: 'Monthly Revenue', value: `$${(stats.revenue / 100).toLocaleString()}`, color: 'text-brand-cyan' }
        ].map(stat => (
          <div key={stat.label} className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" placeholder="Search platforms..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-navy-800 border border-navy-700/50 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50">
          <option value="all">All Status</option>
          <option value="Live">Live</option>
          <option value="In Build">In Build</option>
          <option value="On Hold">On Hold</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50">
          <option value="all">All Types</option>
          <option value="Web App">Web App</option>
          <option value="Mobile App">Mobile App</option>
          <option value="Business Platform">Business Platform</option>
          <option value="E-Commerce">E-Commerce</option>
        </select>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
          <div className="font-semibold mb-1">Couldn't load platforms</div>
          <div className="text-xs text-red-300/80 font-mono break-all">{fetchError}</div>
          <button onClick={fetchPlatforms} className="mt-2 text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-100">Retry</button>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="text-center py-16"><p className="text-gray-500">No platforms found</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(platform => {
            // LABOS-enabled platforms link straight into the LABOS backend;
            // legacy platforms keep the detail view.
            const target = platform.labos_enabled
              ? `/labos/${platform.id}/dashboard`
              : `/admin/platforms/${platform.id}`
            return (
              <Link key={platform.id} to={target}
                className="bg-navy-800 border border-navy-700/50 rounded-xl p-5 hover:border-brand-blue/30 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold group-hover:text-brand-blue transition-colors">{platform.client_name}</h3>
                    {platform.labos_enabled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-blue/15 text-brand-blue border border-brand-blue/30">
                        LABOS
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[platform.status] || 'text-gray-400 border-gray-600'}`}>{platform.status}</span>
                </div>
                {platform.owner_name && <p className="text-gray-400 text-sm mb-2">{platform.owner_name}</p>}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-medium ${TYPE_COLORS[platform.platform_type] || 'text-gray-400'}`}>{platform.platform_type}</span>
                  {platform.domain && (<><span className="text-gray-600">·</span><span className="text-xs text-gray-500">{platform.domain}</span></>)}
                  {platform.industry && (<><span className="text-gray-600">·</span><span className="text-xs text-gray-500 capitalize">{platform.industry.replace('_',' ')}</span></>)}
                </div>
                {platform.site_url && <p className="text-xs text-gray-500 truncate">{platform.site_url}</p>}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-navy-700/50">
                  <span className="text-xs text-gray-500">{new Date(platform.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    {platform.monthly_revenue > 0 && <span className="text-xs text-brand-cyan font-medium">${(platform.monthly_revenue / 100).toLocaleString()}/mo</span>}
                    {platform.labos_enabled && (
                      <span className="text-xs text-brand-blue font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Enter →
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-navy-700/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add Platform</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddPlatform} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Client/Platform Name *</label>
                <input required value={newPlatform.client_name} onChange={e => setNewPlatform({...newPlatform, client_name: e.target.value})}
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Owner Name</label>
                  <input value={newPlatform.owner_name} onChange={e => setNewPlatform({...newPlatform, owner_name: e.target.value})}
                    className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Owner Email</label>
                  <input type="email" value={newPlatform.owner_email} onChange={e => setNewPlatform({...newPlatform, owner_email: e.target.value})}
                    className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Site URL</label>
                  <input value={newPlatform.site_url} onChange={e => setNewPlatform({...newPlatform, site_url: e.target.value})}
                    className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Admin URL</label>
                  <input value={newPlatform.admin_url} onChange={e => setNewPlatform({...newPlatform, admin_url: e.target.value})}
                    className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Domain</label>
                  <input value={newPlatform.domain} onChange={e => setNewPlatform({...newPlatform, domain: e.target.value})}
                    className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Platform Type</label>
                  <select value={newPlatform.platform_type} onChange={e => setNewPlatform({...newPlatform, platform_type: e.target.value})}
                    className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50">
                    <option>Web App</option><option>Mobile App</option><option>Business Platform</option><option>E-Commerce</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Status</label>
                <select value={newPlatform.status} onChange={e => setNewPlatform({...newPlatform, status: e.target.value})}
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50">
                  <option>Live</option><option>In Build</option><option>On Hold</option><option>Completed</option><option>Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea rows={3} value={newPlatform.notes} onChange={e => setNewPlatform({...newPlatform, notes: e.target.value})}
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white text-sm font-medium rounded-lg transition-colors">Add Platform</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
