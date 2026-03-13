import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TIER_COLORS = {
  starter: 'bg-gray-100 text-gray-700',
  growth: 'bg-blue-100 text-blue-700',
  scale: 'bg-purple-100 text-purple-700',
}

const TIER_LABELS = {
  starter: 'Starter',
  growth: 'Growth',
  scale: 'Scale',
}

const STATUS_COLORS = {
  wizard_complete: 'bg-yellow-100 text-yellow-700',
  brief_review: 'bg-orange-100 text-orange-700',
  design_approval: 'bg-blue-100 text-blue-700',
  in_build: 'bg-indigo-100 text-indigo-700',
  qa: 'bg-violet-100 text-violet-700',
  launched: 'bg-green-100 text-green-700',
}

const STATUS_LABELS = {
  wizard_complete: 'Wizard Complete',
  brief_review: 'Brief Review',
  design_approval: 'Design Approval',
  in_build: 'In Build',
  qa: 'QA',
  launched: 'Launched',
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, full_name, email, role, created_at, updated_at,
          projects (id, name, status, tier, mrr, created_at)
        `)
        .eq('role', 'customer')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      console.error('Error fetching customers:', err)
    } finally {
      setLoading(false)
    }
  }

  function getCustomerStats(customer) {
    const projects = customer.projects || []
    const activeProjects = projects.filter(
      p => p.status && p.status !== 'launched'
    )
    const totalMRR = projects.reduce((sum, p) => sum + (p.mrr || 0), 0)
    const primaryTier = projects.length > 0
      ? (projects.find(p => p.status !== 'launched')?.tier || projects[0]?.tier)
      : null
    return { projects, activeProjects, totalMRR, primaryTier }
  }

  const filtered = customers.filter(c => {
    const matchesSearch =
      !search ||
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const { primaryTier } = getCustomerStats(c)
    const matchesTier = tierFilter === 'all' || primaryTier === tierFilter
    return matchesSearch && matchesTier
  })

  const totalMRR = customers.reduce((sum, c) => {
    return sum + (c.projects || []).reduce((s, p) => s + (p.mrr || 0), 0)
  }, 0)

  const activeProjectCount = customers.reduce((sum, c) => {
    return sum + (c.projects || []).filter(p => p.status === 'in_build').length
  }, 0)

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function formatMRR(amount) {
    if (!amount) return <span className="text-gray-500">—</span>
    return (
      <span className="text-green-400 font-medium">
        ${amount.toLocaleString()}<span className="text-xs text-gray-500 font-normal">/mo</span>
      </span>
    )
  }

  function getInitial(customer) {
    return (customer.full_name || customer.email || '?')[0].toUpperCase()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customers</h1>
          <p className="text-sm text-gray-400 mt-1">
            {loading ? 'Loading...' : `${customers.length} total customer${customers.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={fetchCustomers}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-navy-700/50 rounded-lg hover:border-navy-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Customers</p>
          <p className="text-3xl font-bold text-white mt-2">{customers.length}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">In Build</p>
          <p className="text-3xl font-bold text-white mt-2">{activeProjectCount}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total MRR</p>
          <p className="text-3xl font-bold text-brand-blue mt-2">
            ${totalMRR.toLocaleString()}
            <span className="text-base text-gray-400 font-normal">/mo</span>
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-navy-800 border border-navy-700/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue/50 transition-colors"
          />
        </div>
        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40 min-w-[140px]"
        >
          <option value="all">All Tiers</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="scale">Scale</option>
        </select>
      </div>

      {/* Customer Table */}
      <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">
              {search || tierFilter !== 'all' ? 'No customers match your filters' : 'No customers yet'}
            </p>
            {(search || tierFilter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setTierFilter('all') }}
                className="mt-2 text-xs text-brand-blue hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700/50 bg-navy-900/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Tier</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Projects</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">MRR</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/30">
                {filtered.map(customer => {
                  const { projects, activeProjects, totalMRR: cMRR, primaryTier } = getCustomerStats(customer)
                  const isExpanded = expandedId === customer.id

                  return (
                    <>
                      <tr
                        key={customer.id}
                        className="hover:bg-navy-700/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : customer.id)}
                      >
                        {/* Customer */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-blue/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-brand-blue">{getInitial(customer)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white leading-tight">
                                {customer.full_name || <span className="text-gray-500 italic">No name</span>}
                              </p>
                              <p className="text-xs text-gray-400">{customer.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Tier */}
                        <td className="px-4 py-3">
                          {primaryTier ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIER_COLORS[primaryTier] || 'bg-gray-100 text-gray-700'}`}>
                              {TIER_LABELS[primaryTier] || primaryTier}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>

                        {/* Projects */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-white">{projects.length}</span>
                          {activeProjects.length > 0 && (
                            <span className="ml-1.5 text-xs text-brand-blue font-medium">
                              {activeProjects.length} active
                            </span>
                          )}
                        </td>

                        {/* MRR */}
                        <td className="px-4 py-3 text-sm">{formatMRR(cMRR)}</td>

                        {/* Joined */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-400">{formatDate(customer.created_at)}</span>
                        </td>

                        {/* Expand toggle */}
                        <td className="px-4 py-3 text-right">
                          <svg
                            className={`w-4 h-4 text-gray-500 transition-transform ml-auto ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </td>
                      </tr>

                      {/* Expanded project rows */}
                      {isExpanded && projects.length > 0 && (
                        <tr key={`${customer.id}-projects`} className="bg-navy-900/40">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="ml-11 space-y-2">
                              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Projects</p>
                              {projects.map(project => (
                                <div key={project.id} className="flex items-center gap-3 text-sm">
                                  <span className="text-white font-medium min-w-0 flex-1 truncate">
                                    {project.name || <span className="text-gray-500 italic">Untitled project</span>}
                                  </span>
                                  {project.status && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-700'}`}>
                                      {STATUS_LABELS[project.status] || project.status}
                                    </span>
                                  )}
                                  {project.tier && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${TIER_COLORS[project.tier] || 'bg-gray-100 text-gray-700'}`}>
                                      {TIER_LABELS[project.tier] || project.tier}
                                    </span>
                                  )}
                                  {project.mrr > 0 && (
                                    <span className="text-xs text-green-400 flex-shrink-0">
                                      ${project.mrr.toLocaleString()}/mo
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && projects.length === 0 && (
                        <tr key={`${customer.id}-empty`} className="bg-navy-900/40">
                          <td colSpan={6} className="px-4 py-3">
                            <p className="ml-11 text-xs text-gray-500 italic">No projects yet</p>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && filtered.length > 0 && filtered.length !== customers.length && (
        <p className="text-xs text-gray-500 text-center">
          Showing {filtered.length} of {customers.length} customers
        </p>
      )}
    </div>
  )
}
