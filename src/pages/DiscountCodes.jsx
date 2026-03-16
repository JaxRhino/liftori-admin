import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function DiscountCodes() {
  const [codes, setCodes] = useState([])
  const [usages, setUsages] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('usage') // 'usage' | 'manage'
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [newCode, setNewCode] = useState({ code: '', discount_pct: 100, max_uses: '', description: '', is_active: true })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const { data: codesData } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, project_type, discount_code, created_at, customer_id, status, profiles!projects_customer_id_fkey(full_name, email)')
        .not('discount_code', 'is', null)
        .order('created_at', { ascending: false })

      setCodes(codesData || [])
      setUsages(projectsData || [])
    } catch (err) {
      console.error('Error fetching discount data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddCode(e) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const { error } = await supabase.from('discount_codes').insert({
        code: newCode.code.trim().toUpperCase(),
        discount_pct: parseInt(newCode.discount_pct),
        max_uses: newCode.max_uses ? parseInt(newCode.max_uses) : null,
        description: newCode.description.trim() || null,
        is_active: newCode.is_active,
      })
      if (error) throw error
      setShowAddModal(false)
      setNewCode({ code: '', discount_pct: 100, max_uses: '', description: '', is_active: true })
      fetchData()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function toggleCodeActive(id, current) {
    await supabase.from('discount_codes').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  const filteredUsages = usages.filter(u => {
    const q = search.toLowerCase()
    return (
      u.discount_code?.toLowerCase().includes(q) ||
      u.profiles?.full_name?.toLowerCase().includes(q) ||
      u.profiles?.email?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q)
    )
  })

  const filteredCodes = codes.filter(c => {
    const q = search.toLowerCase()
    return c.code?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Discount Codes</h1>
          <p className="text-gray-400 text-sm mt-1">Track usage and manage discount codes</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-sky-400 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Code
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Codes" value={codes.length} icon="🏷️" />
        <StatCard label="Active Codes" value={codes.filter(c => c.is_active).length} icon="✅" />
        <StatCard label="Times Used" value={usages.length} icon="🔢" />
        <StatCard label="Unique Customers" value={new Set(usages.map(u => u.customer_id)).size} icon="👤" />
      </div>

      <div className="flex gap-1 mb-6 bg-navy-800/50 border border-navy-700/50 rounded-lg p-1 w-fit">
        {[
          { id: 'usage', label: 'Usage History' },
          { id: 'manage', label: 'Manage Codes' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={activeTab === 'usage' ? 'Search by code, customer, or project...' : 'Search codes...'}
            className="w-full sm:w-80 pl-9 pr-4 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue" />
        </div>
      </div>

      {activeTab === 'usage' && (
        <div className="rounded-xl border border-navy-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-800/70 border-b border-navy-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code Used</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Discount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/30">
              {filteredUsages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                    {search ? 'No results match your search.' : 'No discount codes have been used yet.'}
                  </td>
                </tr>
              ) : filteredUsages.map(usage => {
                const codeRecord = codes.find(c => c.code === usage.discount_code)
                return (
                  <tr key={usage.id} className="hover:bg-navy-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 bg-brand-blue/10 text-brand-blue text-xs font-mono font-semibold rounded-md border border-brand-blue/20">
                        {usage.discount_code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{usage.profiles?.full_name || '—'}</p>
                      <p className="text-gray-500 text-xs">{usage.profiles?.email || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{usage.name}</p>
                      <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full ${statusColor(usage.status)}`}>
                        {usage.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{usage.project_type}</td>
                    <td className="px-4 py-3">
                      {codeRecord ? (
                        <span className="text-green-400 font-semibold">{codeRecord.discount_pct}% off</span>
                      ) : (
                        <span className="text-gray-500 text-xs">Code deleted</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(usage.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="rounded-xl border border-navy-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-800/70 border-b border-navy-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Discount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Uses</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Expires</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/30">
              {filteredCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">
                    {search ? 'No codes match your search.' : 'No discount codes yet. Create one above.'}
                  </td>
                </tr>
              ) : filteredCodes.map(code => (
                <tr key={code.id} className="hover:bg-navy-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 bg-brand-blue/10 text-brand-blue text-xs font-mono font-semibold rounded-md border border-brand-blue/20">
                      {code.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-green-400 font-semibold">{code.discount_pct}% off</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {code.use_count}{code.max_uses ? ` / ${code.max_uses}` : ''}
                    {code.max_uses && (
                      <div className="mt-1 h-1 bg-navy-700 rounded-full w-16 overflow-hidden">
                        <div className="h-full bg-brand-blue rounded-full"
                          style={{ width: `${Math.min(100, (code.use_count / code.max_uses) * 100)}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{code.description || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {code.expires_at ? new Date(code.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No expiry'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${code.is_active ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'}`}>
                      {code.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleCodeActive(code.id, code.is_active)}
                      className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded border border-navy-600 hover:border-navy-500">
                      {code.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-850 border border-navy-700/50 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
              <h2 className="text-lg font-semibold text-white">Create Discount Code</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddCode} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Code *</label>
                <input type="text" required value={newCode.code} onChange={e => setNewCode(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., EARLY50, FRIEND100" className="input-field uppercase font-mono" />
                <p className="text-xs text-gray-500 mt-1">Code will be auto-uppercased</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Discount % *</label>
                  <input type="number" required min={1} max={100} value={newCode.discount_pct}
                    onChange={e => setNewCode(p => ({ ...p, discount_pct: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Max Uses</label>
                  <input type="number" min={1} value={newCode.max_uses}
                    onChange={e => setNewCode(p => ({ ...p, max_uses: e.target.value }))}
                    placeholder="Unlimited" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
                <input type="text" value={newCode.description} onChange={e => setNewCode(p => ({ ...p, description: e.target.value }))}
                  placeholder="Internal note — e.g., Early customer discount" className="input-field" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active-toggle" checked={newCode.is_active}
                  onChange={e => setNewCode(p => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-navy-500 text-brand-blue" />
                <label htmlFor="active-toggle" className="text-sm text-gray-300">Active immediately</label>
              </div>
              {addError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{addError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={adding}
                  className="px-5 py-2 text-sm font-medium text-white bg-brand-blue hover:bg-sky-400 rounded-lg disabled:opacity-50 transition-colors">
                  {adding ? 'Creating...' : 'Create Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div className="p-4 rounded-xl bg-navy-800/50 border border-navy-700/50">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function statusColor(status) {
  const map = {
    'Wizard Complete': 'bg-gray-500/10 text-gray-400',
    'Pending Estimate': 'bg-yellow-500/10 text-yellow-400',
    'Brief Review': 'bg-blue-500/10 text-blue-400',
    'In Build': 'bg-brand-blue/10 text-brand-blue',
    'QA': 'bg-purple-500/10 text-purple-400',
    'Launched': 'bg-green-500/10 text-green-400',
  }
  return map[status] || 'bg-gray-500/10 text-gray-400'
}
