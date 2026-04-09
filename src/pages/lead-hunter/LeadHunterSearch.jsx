import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTenantId } from '../../lib/useTenantId'

// Score badge colors
function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="text-xs text-gray-600">—</span>
  let bg, text
  if (score >= 80) {
    bg = 'bg-red-500/20'
    text = 'text-red-400'
  } else if (score >= 60) {
    bg = 'bg-yellow-500/20'
    text = 'text-yellow-400'
  } else if (score >= 40) {
    bg = 'bg-sky-500/20'
    text = 'text-sky-400'
  } else {
    bg = 'bg-gray-500/20'
    text = 'text-gray-400'
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {score}
    </span>
  )
}

// Enrichment status badge
function EnrichmentBadge({ status }) {
  const statuses = {
    'not_enriched': { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Not Enriched' },
    'enriching': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Enriching…' },
    'scored': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Scored' },
    'enriched': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Enriched' },
    'failed': { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
  }
  const config = statuses[status] || statuses['not_enriched']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

// Save Search Modal
function SaveSearchModal({ onClose, criteria, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    auto_pilot_enabled: false,
    auto_pilot_frequency: 'daily',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Search name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('lh_searches')
        .insert({
          name: form.name.trim(),
          description: form.description.trim() || null,
          criteria,
          auto_pilot_enabled: form.auto_pilot_enabled,
          auto_pilot_frequency: form.auto_pilot_enabled ? form.auto_pilot_frequency : null,
        })
        .select()
        .single()
      if (err) throw err
      onSaved(data)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">Save as ICP</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Search Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/50"
              placeholder="e.g., SaaS in Tech - SF Bay Area"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/50 resize-none"
              placeholder="Optional notes about this search..."
              rows={2}
            />
          </div>
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Current Criteria</p>
            <pre className="text-xs text-gray-400 max-h-32 overflow-auto">
              {JSON.stringify(criteria, null, 2)}
            </pre>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.auto_pilot_enabled}
                onChange={e => setForm(prev => ({ ...prev, auto_pilot_enabled: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-700/50 bg-slate-900/50 text-sky-500 focus:ring-sky-500/40"
              />
              <span className="text-sm text-white">Enable Auto-Pilot</span>
            </label>
            {form.auto_pilot_enabled && (
              <div className="pl-7">
                <select
                  value={form.auto_pilot_frequency}
                  onChange={e => setForm(prev => ({ ...prev, auto_pilot_frequency: e.target.value }))}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                </select>
              </div>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
            ) : (
              'Save Search'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Action Dropdown
function ActionDropdown({ company, onEnrich, onAddToList }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.5 1.5H9.5V3.5H10.5V1.5zM10.5 8.5H9.5V10.5H10.5V8.5zM10.5 15.5H9.5V17.5H10.5V15.5z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700/50 rounded-lg shadow-lg z-40 w-44">
          <button
            onClick={() => {
              navigate(`/admin/lead-hunter/company/${company.id}`)
              setOpen(false)
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50 first:rounded-t-lg transition-colors"
          >
            View Details
          </button>
          <button
            onClick={() => {
              onEnrich(company.id)
              setOpen(false)
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            Enrich Now
          </button>
          <button
            onClick={() => {
              onAddToList(company.id)
              setOpen(false)
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-slate-700/50 last:rounded-b-lg transition-colors"
          >
            Add to List
          </button>
        </div>
      )}
    </div>
  )
}

export default function LeadHunterSearch() {
  const navigate = useNavigate()
  const { tenantId, tenantFilter } = useTenantId()
  const [filters, setFilters] = useState({
    industry_keyword: '',
    location_city: '',
    location_state: '',
    radius_miles: 25,
    employee_range: 'any',
    revenue_range: 'any',
    has_website: 'any',
    website_quality_max: 100,
    cms_detected: 'any',
    tags: [],
  })
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [enriching, setEnriching] = useState(new Set())
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [filterExpanded, setFilterExpanded] = useState(true)
  const [discoveryCount, setDiscoveryCount] = useState(null)
  const [toast, setToast] = useState(null)

  const resultsPerPage = 25
  const totalPages = Math.ceil(totalCount / resultsPerPage)

  function showToast(message, type = 'info') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handleFilterChange(field, value) {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  function buildQuery() {
    let query = tenantFilter(supabase.from('lh_companies').select('*', { count: 'exact' }))

    if (filters.industry_keyword.trim()) {
      query = query.ilike('industry', `%${filters.industry_keyword.trim()}%`)
    }
    if (filters.location_city.trim()) {
      query = query.ilike('city', `%${filters.location_city.trim()}%`)
    }
    if (filters.location_state.trim()) {
      query = query.ilike('state', `%${filters.location_state.trim()}%`)
    }
    if (filters.employee_range !== 'any') {
      const ranges = {
        '1-10': [1, 10],
        '11-50': [11, 50],
        '51-200': [51, 200],
        '201-500': [201, 500],
        '500+': [500, 999999],
      }
      const [min, max] = ranges[filters.employee_range] || [0, 0]
      query = query.gte('employee_count', min).lte('employee_count', max)
    }
    if (filters.revenue_range !== 'any') {
      const ranges = {
        '<1M': [0, 1000000],
        '1M-5M': [1000000, 5000000],
        '5M-10M': [5000000, 10000000],
        '10M-50M': [10000000, 50000000],
        '50M+': [50000000, 999999999],
      }
      const [min, max] = ranges[filters.revenue_range] || [0, 0]
      query = query.gte('annual_revenue', min).lte('annual_revenue', max)
    }
    if (filters.has_website !== 'any') {
      if (filters.has_website === 'yes') {
        query = query.not('website', 'is', null)
      } else {
        query = query.is('website', null)
      }
    }
    if (filters.website_quality_max < 100) {
      query = query.lte('website_quality_score', filters.website_quality_max)
    }
    if (filters.cms_detected !== 'any') {
      query = query.eq('cms_detected', filters.cms_detected)
    }

    return query
  }

  // Search existing database
  async function handleSearch() {
    setCurrentPage(1)
    setSelectedRows(new Set())
    setLoading(true)
    try {
      const query = buildQuery()
      const { data, count, error } = await query
        .order('lead_score', { ascending: false, nullsFirst: false })
        .range(0, resultsPerPage - 1)

      if (error) throw error
      setResults(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Error searching companies:', err)
      setResults([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // Discover NEW companies via Google Places edge function
  async function handleDiscover() {
    if (!filters.industry_keyword.trim() || !filters.location_city.trim()) {
      showToast('Industry keyword and City are required for discovery', 'error')
      return
    }
    setDiscovering(true)
    setDiscoveryCount(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await supabase.functions.invoke('lh-search', {
        body: {
          action: 'discover',
          industry_keyword: filters.industry_keyword.trim(),
          location: `${filters.location_city.trim()}${filters.location_state.trim() ? ', ' + filters.location_state.trim() : ''}`,
          radius_miles: filters.radius_miles,
          tenant_id: tenantId,
        }
      })

      if (response.error) throw response.error

      const result = response.data
      setDiscoveryCount(result.new_discoveries || 0)
      showToast(`Discovered ${result.new_discoveries} new companies! ${result.companies?.length || 0} total results.`, 'success')

      // Now search the DB to show the results
      await handleSearch()
    } catch (err) {
      console.error('Discovery error:', err)
      showToast(`Discovery failed: ${err.message}`, 'error')
    } finally {
      setDiscovering(false)
    }
  }

  async function handlePageChange(page) {
    setCurrentPage(page)
    setSelectedRows(new Set())
    setLoading(true)
    try {
      const offset = (page - 1) * resultsPerPage
      const query = buildQuery()
      const { data, error } = await query
        .order('lead_score', { ascending: false, nullsFirst: false })
        .range(offset, offset + resultsPerPage - 1)

      if (error) throw error
      setResults(data || [])
    } catch (err) {
      console.error('Error fetching page:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function toggleRowSelection(id) {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRows(newSelected)
  }

  function toggleAllRows() {
    if (selectedRows.size === results.length && results.length > 0) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(results.map(r => r.id)))
    }
  }

  // Enrich a single company (website scan + Hunter.io + email patterns + AI scoring)
  async function handleEnrich(companyId) {
    if (enriching.has(companyId)) return
    setEnriching(prev => new Set([...prev, companyId]))

    // Optimistic UI: set enriching status
    setResults(prev => prev.map(c => c.id === companyId ? { ...c, enrichment_status: 'enriching' } : c))

    try {
      // Step 1: Enrich (website scan, Hunter.io, email patterns)
      const enrichResponse = await supabase.functions.invoke('lh-enrich', {
        body: { company_ids: [companyId], tenant_id: tenantId }
      })
      if (enrichResponse.error) throw enrichResponse.error

      // Step 2: Score (AI or rule-based)
      const scoreResponse = await supabase.functions.invoke('lh-score', {
        body: { company_ids: [companyId], tenant_id: tenantId }
      })
      if (scoreResponse.error) throw scoreResponse.error

      // Refresh the company data from DB
      const { data: updated } = await supabase
        .from('lh_companies')
        .select('*')
        .eq('id', companyId)
        .single()

      if (updated) {
        setResults(prev => prev.map(c => c.id === companyId ? updated : c))
      }

      showToast(`Enriched & scored: ${updated?.name || 'company'}`, 'success')
    } catch (err) {
      console.error('Enrich error:', err)
      setResults(prev => prev.map(c => c.id === companyId ? { ...c, enrichment_status: 'failed' } : c))
      showToast(`Enrichment failed: ${err.message}`, 'error')
    } finally {
      setEnriching(prev => {
        const next = new Set(prev)
        next.delete(companyId)
        return next
      })
    }
  }

  // Bulk enrich selected companies
  async function handleBulkEnrich() {
    const ids = [...selectedRows]
    if (ids.length === 0) return

    showToast(`Enriching ${ids.length} companies...`, 'info')
    setEnriching(prev => new Set([...prev, ...ids]))

    // Optimistic UI
    setResults(prev => prev.map(c => ids.includes(c.id) ? { ...c, enrichment_status: 'enriching' } : c))

    try {
      // Enrich in batches of 10
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10)

        const enrichResponse = await supabase.functions.invoke('lh-enrich', {
          body: { company_ids: batch, tenant_id: tenantId }
        })
        if (enrichResponse.error) console.error('Batch enrich error:', enrichResponse.error)

        const scoreResponse = await supabase.functions.invoke('lh-score', {
          body: { company_ids: batch, tenant_id: tenantId }
        })
        if (scoreResponse.error) console.error('Batch score error:', scoreResponse.error)
      }

      // Refresh all enriched companies
      const { data: updated } = await supabase
        .from('lh_companies')
        .select('*')
        .in('id', ids)

      if (updated) {
        const updateMap = Object.fromEntries(updated.map(c => [c.id, c]))
        setResults(prev => prev.map(c => updateMap[c.id] || c))
      }

      showToast(`Successfully enriched ${ids.length} companies`, 'success')
      setSelectedRows(new Set())
    } catch (err) {
      console.error('Bulk enrich error:', err)
      showToast(`Bulk enrichment failed: ${err.message}`, 'error')
    } finally {
      setEnriching(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    }
  }

  function handleAddToList(companyId) {
    navigate(`/admin/lead-hunter/lists`)
  }

  function handleExportCSV() {
    const rows = selectedRows.size > 0
      ? results.filter(c => selectedRows.has(c.id))
      : results;

    if (rows.length === 0) {
      showToast('No results to export', 'error');
      return;
    }

    const csv = [
      ['Company', 'Website', 'Industry', 'City', 'State', 'Phone', 'Employee Count', 'Lead Score', 'Enrichment Status', 'CMS', 'Website Quality'],
      ...rows.map(c => [
        c.name || '',
        c.website || '',
        c.industry || '',
        c.city || '',
        c.state || '',
        c.phone || '',
        c.employee_count || '',
        c.lead_score || '',
        c.enrichment_status || '',
        c.cms_detected || '',
        c.website_quality_score || '',
      ])
    ]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-hunter-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} companies to CSV`, 'success');
  }

  function buildCriteriaObject() {
    return {
      industry_keyword: filters.industry_keyword || null,
      location_city: filters.location_city || null,
      location_state: filters.location_state || null,
      radius_miles: filters.radius_miles,
      employee_range: filters.employee_range !== 'any' ? filters.employee_range : null,
      revenue_range: filters.revenue_range !== 'any' ? filters.revenue_range : null,
      has_website: filters.has_website !== 'any' ? (filters.has_website === 'yes') : null,
      website_quality_max: filters.website_quality_max,
      cms_detected: filters.cms_detected !== 'any' ? filters.cms_detected : null,
      tags: filters.tags && filters.tags.length > 0 ? filters.tags : null,
    }
  }

  const hasSearched = totalCount > 0 || (loading === false && results.length === 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Search & Discover</h1>
          <p className="text-sm text-gray-400 mt-1">Find companies matching your ideal customer profile</p>
        </div>
        <button
          onClick={() => setShowSaveModal(true)}
          disabled={totalCount === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-400 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Save as ICP
        </button>
      </div>

      {/* Filter Panel */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setFilterExpanded(!filterExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white">Filters</h2>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${filterExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {filterExpanded && (
          <div className="border-t border-slate-700/50 px-6 py-4 space-y-4">
            {/* Row 1: Industry, Location, Radius */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Industry Keyword</label>
                <input
                  type="text"
                  value={filters.industry_keyword}
                  onChange={e => handleFilterChange('industry_keyword', e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/50"
                  placeholder="e.g., SaaS, Tech..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">City</label>
                <input
                  type="text"
                  value={filters.location_city}
                  onChange={e => handleFilterChange('location_city', e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/50"
                  placeholder="e.g., San Francisco"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">State</label>
                <input
                  type="text"
                  value={filters.location_state}
                  onChange={e => handleFilterChange('location_state', e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/50"
                  placeholder="e.g., CA"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Radius (miles)</label>
                <select
                  value={filters.radius_miles}
                  onChange={e => handleFilterChange('radius_miles', parseInt(e.target.value))}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                  <option value={100}>100 miles</option>
                </select>
              </div>
            </div>

            {/* Row 2: Employee Count, Revenue */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Employee Count</label>
                <select
                  value={filters.employee_range}
                  onChange={e => handleFilterChange('employee_range', e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  <option value="any">Any</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="500+">500+</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Revenue Range</label>
                <select
                  value={filters.revenue_range}
                  onChange={e => handleFilterChange('revenue_range', e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  <option value="any">Any</option>
                  <option value="<1M">&lt;$1M</option>
                  <option value="1M-5M">$1M-$5M</option>
                  <option value="5M-10M">$5M-$10M</option>
                  <option value="10M-50M">$10M-$50M</option>
                  <option value="50M+">$50M+</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Has Website</label>
                <div className="flex gap-2">
                  {['any', 'yes', 'no'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleFilterChange('has_website', opt)}
                      className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${
                        filters.has_website === opt
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-900/50 border border-slate-700/50 text-gray-400 hover:text-white'
                      }`}
                    >
                      {opt === 'any' ? 'Any' : opt === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Website Quality, CMS Platform */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Website Quality Max: {filters.website_quality_max}
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={filters.website_quality_max}
                  onChange={e => handleFilterChange('website_quality_max', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-900/50 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">CMS Platform</label>
                <select
                  value={filters.cms_detected}
                  onChange={e => handleFilterChange('cms_detected', e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  <option value="any">Any</option>
                  <option value="wordpress">WordPress</option>
                  <option value="squarespace">Squarespace</option>
                  <option value="wix">Wix</option>
                  <option value="shopify">Shopify</option>
                  <option value="none">No CMS Detected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Tags</label>
                <input
                  type="text"
                  value={filters.tags.join(', ')}
                  onChange={e => handleFilterChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/50"
                  placeholder="Comma-separated tags..."
                />
              </div>
            </div>

            {/* Search Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSearch}
                disabled={loading || discovering}
                className="flex-1 px-4 py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Searching DB...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search Database
                  </>
                )}
              </button>
              <button
                onClick={handleDiscover}
                disabled={loading || discovering}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {discovering ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Discovering...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Discover New (Google Places)
                  </>
                )}
              </button>
            </div>
            {discoveryCount !== null && (
              <p className="text-sm text-emerald-400 text-center">
                {discoveryCount} new companies discovered and added to your database
              </p>
            )}
          </div>
        )}
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Showing {results.length > 0 ? (currentPage - 1) * resultsPerPage + 1 : 0}-{Math.min(currentPage * resultsPerPage, totalCount)} of {totalCount} companies
            </h2>
            {results.length > 0 && selectedRows.size === 0 && (
              <button
                onClick={handleExportCSV}
                className="px-3 py-1 text-sm font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                Export All to CSV
              </button>
            )}
          </div>

          {/* Bulk Action Bar */}
          {selectedRows.size > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-400">{selectedRows.size} selected</span>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkEnrich}
                  disabled={enriching.size > 0}
                  className="px-3 py-1 text-sm font-medium text-white bg-sky-500/20 border border-sky-500/50 rounded-lg hover:bg-sky-500/30 disabled:opacity-50 transition-colors"
                >
                  {enriching.size > 0 ? 'Enriching...' : 'Enrich Selected'}
                </button>
                <button
                  onClick={() => navigate('/admin/lead-hunter/lists')}
                  className="px-3 py-1 text-sm font-medium text-white bg-sky-500/20 border border-sky-500/50 rounded-lg hover:bg-sky-500/30 transition-colors"
                >
                  Add to List
                </button>
                <button
                  onClick={() => navigate('/admin/lead-hunter/sequences')}
                  className="px-3 py-1 text-sm font-medium text-white bg-sky-500/20 border border-sky-500/50 rounded-lg hover:bg-sky-500/30 transition-colors"
                >
                  Start Sequence
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1 text-sm font-medium text-white bg-emerald-500/20 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30 transition-colors"
                >
                  Export CSV
                </button>
              </div>
            </div>
          )}

          {/* Results Table */}
          {results.length > 0 ? (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/50">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === results.length && results.length > 0}
                        onChange={toggleAllRows}
                        className="w-4 h-4 rounded border-slate-700/50 bg-slate-900/50 text-sky-500 focus:ring-sky-500/40"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Industry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Employees</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Website</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((company, idx) => (
                    <tr key={company.id} className={`border-b border-slate-700/30 ${idx % 2 === 0 ? 'bg-slate-900/20' : ''} hover:bg-slate-700/20 transition-colors`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(company.id)}
                          onChange={() => toggleRowSelection(company.id)}
                          className="w-4 h-4 rounded border-slate-700/50 bg-slate-900/50 text-sky-500 focus:ring-sky-500/40"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/admin/lead-hunter/company/${company.id}`)}
                          className="text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          <div className="text-sm font-medium text-white">{company.name}</div>
                          <div className="text-xs text-gray-500">{company.domain || '—'}</div>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{company.industry || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{company.city && company.state ? `${company.city}, ${company.state}` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{company.employee_count ? company.employee_count.toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        {company.website ? (
                          <span className="text-gray-300">Score: {company.website_quality_score ?? '—'}</span>
                        ) : (
                          <span className="text-red-400">No website</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={company.lead_score} />
                      </td>
                      <td className="px-4 py-3">
                        <EnrichmentBadge status={company.enrichment_status || 'not_enriched'} />
                      </td>
                      <td className="px-4 py-3">
                        <ActionDropdown
                          company={company}
                          onEnrich={handleEnrich}
                          onAddToList={handleAddToList}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-8 text-center">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400">No companies found matching your criteria. Try broadening your search filters or run a discovery search.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  disabled={loading}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-sky-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Save Search Modal */}
      {showSaveModal && (
        <SaveSearchModal
          onClose={() => setShowSaveModal(false)}
          criteria={buildCriteriaObject()}
          onSaved={(data) => {
            showToast(`Search "${data.name}" saved!`, 'success')
            setShowSaveModal(false)
          }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-sky-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
