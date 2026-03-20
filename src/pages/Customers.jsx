import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// DB uses Title Case status values
const STATUS_COLORS = {
  'Wizard Complete':  { bg: 'bg-gray-500/20',    text: 'text-gray-400' },
  'Brief Review':     { bg: 'bg-yellow-500/20',  text: 'text-yellow-400' },
  'Design Approval':  { bg: 'bg-purple-500/20',  text: 'text-purple-400' },
  'In Build':         { bg: 'bg-brand-blue/20',  text: 'text-brand-blue' },
  'QA':               { bg: 'bg-orange-500/20',  text: 'text-orange-400' },
  'Launched':         { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'On Hold':          { bg: 'bg-gray-500/20',    text: 'text-gray-500' },
  'Cancelled':        { bg: 'bg-red-500/20',     text: 'text-red-400' },
}

const TIER_COLORS = {
  starter: { bg: 'bg-gray-500/20',   text: 'text-gray-400' },
  growth:  { bg: 'bg-blue-500/20',   text: 'text-blue-400' },
  scale:   { bg: 'bg-purple-500/20', text: 'text-purple-400' },
}

const TIER_LABELS = {
  starter: 'Starter',
  growth: 'Growth',
  scale: 'Scale',
}

// All pipeline statuses for filter dropdown
const STATUS_PIPELINE = [
  'Wizard Complete',
  'Brief Review',
  'Design Approval',
  'In Build',
  'QA',
  'Launched',
]

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-gray-600">—</span>
  const colors = STATUS_COLORS[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
      {status}
    </span>
  )
}

function TierBadge({ tier }) {
  if (!tier) return <span className="text-xs text-gray-600">—</span>
  const colors = TIER_COLORS[tier] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
      {TIER_LABELS[tier] || tier}
    </span>
  )
}

function CreateCustomerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'customer' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function handleCreate() {
    if (!form.email.trim()) { setError('Email is required'); return }
    setSaving(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .insert({
          full_name: form.full_name.trim() || null,
          email: form.email.trim(),
          role: form.role,
        })
        .select()
        .single()
      if (err) throw err
      onCreated(data)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700/50">
          <h2 className="text-lg font-semibold text-white">New Customer</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => handleChange('full_name', e.target.value)}
              className="w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue/50"
              placeholder="Jane Smith"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Email <span className="text-red-400">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              className="w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue/50"
              placeholder="jane@example.com"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={e => handleChange('role', e.target.value)}
              className="w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            >
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
              <option value="affiliate">Affiliate</option>
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-navy-700/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
            ) : (
              'Create Customer'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

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
          projects!projects_customer_id_fkey (id, name, status, tier, mrr, created_at)
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
    // 'Launched' uses Title Case to match DB
    const activeProjects = projects.filter(p => p.status && p.status !== 'Launched')
    const launchedProjects = projects.filter(p => p.status === 'Launched')
    const totalMRR = projects.reduce((sum, p) => sum + (p.mrr || 0), 0)
    // Primary tier from active project first, fallback to first project
    const primaryTier = projects.length > 0
      ? (projects.find(p => p.status !== 'Launched')?.tier || projects[0]?.tier)
      : null
    // Primary status: first active project's status, or Launched if all done
    const primaryStatus = activeProjects.length > 0
      ? activeProjects[0].status
      : (launchedProjects.length > 0 ? 'Launched' : null)
    return { projects, activeProjects, launchedProjects, totalMRR, primaryTier, primaryStatus }
  }

  const filtered = customers.filter(c => {
    const matchesSearch =
      !search ||
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const { primaryTier, primaryStatus } = getCustomerStats(c)
    const matchesTier = tierFilter === 'all' || primaryTier === tierFilter
    const matchesStatus = statusFilter === 'all' || primaryStatus === statusFilter
    return matchesSearch && matchesTier && matchesStatus
  })

  // Aggregate stats across all customers
  const totalMRR = customers.reduce((sum, c) => {
    return sum + (c.projects || []).reduce((s, p) => s + (p.mrr || 0), 0)
  }, 0)

  // 'In Build' uses Title Case
  const activeProjectCount = customers.reduce((sum, c) => {
    return sum + (c.projects || []).filter(p => p.status === 'In Build').length
  }, 0)

  const launchedCount = customers.reduce((sum, c) => {
    return sum + (c.projects || []).filter(p => p.status === 'Launched').length
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
      <span className="text-emerald-400 font-medium">
        ${amount.toLocaleString()}<span className="text-xs text-gray-500 font-normal">/mo</span>
      </span>
    )
  }

  function getInitials(customer) {
    const name = customer.full_name || ''
    if (name.includes(' ')) {
      const parts = name.trim().split(' ')
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return (name || customer.email || '?')[0].toUpperCase()
  }

  function clearFilters() {
    setSearch('')
    setTierFilter('all')
    setStatusFilter('all')
  }

  const hasFilters = search || tierFilter !== 'all' || statusFilter !== 'all'

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-blue hover:bg-sky-400 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Customer
          </button>
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
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Customers</p>
          <p className="text-3xl font-bold text-white mt-2">{customers.length}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">In Build</p>
          <p className="text-3xl font-bold text-white mt-2">{activeProjectCount}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Launched</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{launchedCount}</p>
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
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40 min-w-[160px]"
        >
          <option value="all">All Statuses</option>
          {STATUS_PIPELINE.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40 min-w-[130px]"
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
              {hasFilters ? 'No customers match your filters' : 'No customers yet'}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Projects</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">MRR</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/30">
                {filtered.map(customer => {
                  const { projects, activeProjects, totalMRR: cMRR, primaryTier, primaryStatus } = getCustomerStats(customer)
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
                              <span className="text-xs font-bold text-brand-blue">{getInitials(customer)}</span>
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
                          <TierBadge tier={primaryTier} />
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={primaryStatus} />
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

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); navigate(`/admin/customers/${customer.id}`) }}
                              className="px-2.5 py-1 text-xs text-brand-blue border border-brand-blue/30 rounded hover:bg-brand-blue/10 transition-colors"
                            >
                              View
                            </button>
                            <svg
                              className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded project rows */}
                      {isExpanded && projects.length > 0 && (
                        <tr key={`${customer.id}-projects`} className="bg-navy-900/40">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="ml-11 space-y-2.5">
                              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Projects</p>
                              {projects.map(project => {
                                const sc = STATUS_COLORS[project.status] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
                                const tc = TIER_COLORS[project.tier] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
                                return (
                                  <div key={project.id} className="flex items-center gap-3 text-sm">
                                    <span className="text-white font-medium min-w-0 flex-1 truncate">
                                      {project.name || <span className="text-gray-500 italic">Untitled project</span>}
                                    </span>
                                    {project.status && (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${sc.bg} ${sc.text}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${sc.text.replace('text-', 'bg-')}`} />
                                        {project.status}
                                      </span>
                                    )}
                                    {project.tier && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${tc.bg} ${tc.text}`}>
                                        {TIER_LABELS[project.tier] || project.tier}
                                      </span>
                                    )}
                                    {project.mrr > 0 && (
                                      <span className="text-xs text-emerald-400 flex-shrink-0">
                                        ${project.mrr.toLocaleString()}/mo
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-600 flex-shrink-0">
                                      {formatDate(project.created_at)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && projects.length === 0 && (
                        <tr key={`${customer.id}-empty`} className="bg-navy-900/40">
                          <td colSpan={7} className="px-4 py-3">
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

      {/* Create Customer Modal */}
      {showCreateModal && (
        <CreateCustomerModal
          onClose={() => setShowCreateModal(false)}
          onCreated={newCustomer => {
            setCustomers(prev => [{ ...newCustomer, projects: [] }, ...prev])
            setShowCreateModal(false)
          }}
        />
      )}
    </div>
  )
}
