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

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: 'bg-yellow-500/20', text: 'text-yellow-400',  dot: 'bg-yellow-400' },
  approved: { label: 'Approved', bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected', bg: 'bg-red-500/20',    text: 'text-red-400',    dot: 'bg-red-400' },
  invited:  { label: 'Invited',  bg: 'bg-brand-blue/20', text: 'text-brand-blue', dot: 'bg-brand-blue' },
}

const STATUS_TABS = ['all', 'pending', 'approved', 'invited', 'rejected']

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function Toast({ message, type, onDismiss }) {
  if (!message) return null
  const colors = type === 'error'
    ? 'bg-red-900/80 border-red-600/50 text-red-300'
    : 'bg-emerald-900/80 border-emerald-600/50 text-emerald-300'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl ${colors}`}>
      <span className="text-sm">{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  )
}

function DetailPanel({ signup, onClose, onStatusChange }) {
  if (!signup) return null

  const [notes, setNotes] = useState(signup.review_notes || '')
  const [saving, setSaving] = useState(false)

  async function handleStatusChange(newStatus) {
    setSaving(true)
    await onStatusChange(signup.id, newStatus, notes)
    setSaving(false)
  }

  async function saveNotes() {
    setSaving(true)
    await onStatusChange(signup.id, signup.status || 'pending', notes)
    setSaving(false)
  }

  const currentStatus = signup.status || 'pending'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed right-0 top-12 bottom-0 w-full max-w-lg bg-navy-900 border-l border-navy-700 z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-700">
          <div>
            <h2 className="text-lg font-bold text-white">{signup.full_name}</h2>
            <p className="text-sm text-gray-400">{signup.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={currentStatus} />
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">×</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Actions */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Actions</p>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={saving || currentStatus === 'approved'}
                onClick={() => handleStatusChange('approved')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ✓ Approve
              </button>
              <button
                disabled={saving || currentStatus === 'invited'}
                onClick={() => handleStatusChange('invited')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-blue/20 text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                → Invite to Onboard
              </button>
              <button
                disabled={saving || currentStatus === 'rejected'}
                onClick={() => handleStatusChange('rejected')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ✕ Reject
              </button>
              {currentStatus !== 'pending' && (
                <button
                  disabled={saving}
                  onClick={() => handleStatusChange('pending')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ↩ Reset to Pending
                </button>
              )}
              <a
                href={`mailto:${signup.email}`}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-700 text-gray-300 border border-navy-600 hover:bg-navy-600 transition-colors"
              >
                ✉ Email {signup.full_name?.split(' ')[0]}
              </a>
            </div>
          </div>

          {/* Build Idea */}
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

          {/* Review Notes */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Review Notes</p>
            <textarea
              className="input min-h-[80px] resize-y text-sm"
              placeholder="Internal notes about this lead…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button
              disabled={saving}
              onClick={saveNotes}
              className="mt-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-700 text-gray-300 border border-navy-600 hover:bg-navy-600 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function exportToCSV(rows) {
  const headers = [
    'Name', 'Email', 'Status', 'App Type', 'Budget', 'Timeline',
    'Design Style', 'Build Idea', 'Target Audience', 'Key Features',
    'Referral Code', 'Review Notes', 'Signed Up'
  ]
  const escape = v => {
    if (v == null) return ''
    const s = String(v).replace(/"/g, '""')
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
  }
  const csvRows = [
    headers.join(','),
    ...rows.map(s => [
      escape(s.full_name),
      escape(s.email),
      escape(s.status || 'pending'),
      escape(APP_TYPE_LABELS[s.app_type] || s.app_type),
      escape(BUDGET_LABELS[s.budget_range] || s.budget_range),
      escape(TIMELINE_LABELS[s.timeline] || s.timeline),
      escape(s.design_style),
      escape(s.build_idea),
      escape(s.target_audience),
      escape(s.key_features),
      escape(s.referral_code),
      escape(s.review_notes),
      escape(formatDate(s.created_at)),
    ].join(','))
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `liftori-waitlist-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Waitlist() {
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [appTypeFilter, setAppTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchSignups()
  }, [])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

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
      showToast('Failed to load waitlist data', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id, newStatus, notes) {
    const updatePayload = { status: newStatus }
    if (notes !== undefined) updatePayload.review_notes = notes

    try {
      const { error } = await supabase
        .from('waitlist_signups')
        .update(updatePayload)
        .eq('id', id)
      if (error) throw error

      setSignups(prev => prev.map(s =>
        s.id === id ? { ...s, status: newStatus, review_notes: notes ?? s.review_notes } : s
      ))
      if (selected?.id === id) {
        setSelected(prev => ({ ...prev, status: newStatus, review_notes: notes ?? prev.review_notes }))
      }
      showToast(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
    } catch (err) {
      console.error('Status update failed:', err)
      showToast('Status update failed — check that the status column exists in waitlist_signups (see migration SQL file)', 'error')
    }
  }

  async function bulkUpdateStatus(newStatus) {
    if (selectedIds.size === 0) return
    setBulkUpdating(true)
    try {
      const ids = Array.from(selectedIds)
      const { error } = await supabase
        .from('waitlist_signups')
        .update({ status: newStatus })
        .in('id', ids)
      if (error) throw error

      setSignups(prev => prev.map(s =>
        selectedIds.has(s.id) ? { ...s, status: newStatus } : s
      ))
      setSelectedIds(new Set())
      showToast(`${ids.length} entr${ids.length !== 1 ? 'ies' : 'y'} marked as ${STATUS_CONFIG[newStatus]?.label}`)
    } catch (err) {
      console.error('Bulk update failed:', err)
      showToast('Bulk update failed', 'error')
    } finally {
      setBulkUpdating(false)
    }
  }

  function toggleSelect(id, e) {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)))
    }
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const filtered = signups.filter(s => {
    if (search) {
      const q = search.toLowerCase()
      const match =
        (s.full_name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.build_idea || '').toLowerCase().includes(q)
      if (!match) return false
    }
    if (statusTab !== 'all') {
      const sStatus = s.status || 'pending'
      if (sStatus !== statusTab) return false
    }
    if (appTypeFilter && s.app_type !== appTypeFilter) return false
    if (dateFrom && new Date(s.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(s.created_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const pendingCount = signups.filter(s => !s.status || s.status === 'pending').length
  const thisWeekCount = signups.filter(s => new Date(s.created_at) > weekAgo).length
  const referralCount = signups.filter(s => s.referral_code).length
  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length
  const hasFilters = statusTab !== 'all' || appTypeFilter || dateFrom || dateTo || search

  function clearFilters() {
    setStatusTab('all')
    setAppTypeFilter('')
    setDateFrom('')
    setDateTo('')
    setSearch('')
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Waitlist</h1>
          <p className="text-gray-400 text-sm mt-1">
            {signups.length} signup{signups.length !== 1 ? 's' : ''} — click any row to view full details
          </p>
        </div>
        <button
          onClick={() => exportToCSV(filtered)}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          ↓ Export CSV{filtered.length !== signups.length ? ` (${filtered.length})` : ''}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Total Signups</p>
          <p className="text-2xl font-bold text-brand-blue">{signups.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">This Week</p>
          <p className="text-2xl font-bold text-purple-400">{thisWeekCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Via Referral</p>
          <p className="text-2xl font-bold text-orange-400">{referralCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {STATUS_TABS.map(tab => {
            const count = tab === 'all'
              ? signups.length
              : signups.filter(s => (s.status || 'pending') === tab).length
            const cfg = STATUS_CONFIG[tab]
            const isActive = statusTab === tab
            return (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize flex items-center gap-1.5 ${
                  isActive
                    ? tab === 'all'
                      ? 'bg-navy-600 text-white'
                      : `${cfg.bg} ${cfg.text}`
                    : 'text-gray-500 hover:text-gray-300 hover:bg-navy-700'
                }`}
              >
                {tab === 'all' ? 'All' : cfg.label}
                <span className={`text-xs opacity-70`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search + filters row */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="input max-w-xs"
            placeholder="Search by name, email, or idea…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="select max-w-[180px]"
            value={appTypeFilter}
            onChange={e => setAppTypeFilter(e.target.value)}
          >
            <option value="">All App Types</option>
            {Object.entries(APP_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input max-w-[150px] text-sm"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              title="From date"
            />
            <span className="text-gray-600 text-xs">to</span>
            <input
              type="date"
              className="input max-w-[150px] text-sm"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              title="To date"
            />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-brand-blue/10 border border-brand-blue/30 rounded-xl">
          <span className="text-sm text-brand-blue font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2 ml-2">
            <button
              disabled={bulkUpdating}
              onClick={() => bulkUpdateStatus('approved')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
            >
              ✓ Bulk Approve
            </button>
            <button
              disabled={bulkUpdating}
              onClick={() => bulkUpdateStatus('invited')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-blue/20 text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/30 disabled:opacity-40 transition-colors"
            >
              → Bulk Invite
            </button>
            <button
              disabled={bulkUpdating}
              onClick={() => bulkUpdateStatus('rejected')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 transition-colors"
            >
              ✕ Bulk Reject
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-gray-500 hover:text-gray-300 text-xs transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-sm">
            {hasFilters ? 'No results match your filters.' : 'No signups yet.'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-2 text-xs text-brand-blue hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-navy-600 bg-navy-800 accent-brand-blue cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
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
                  className={`table-row cursor-pointer ${selectedIds.has(s.id) ? 'bg-brand-blue/5' : ''}`}
                  onClick={() => setSelected(s)}
                >
                  <td className="px-4 py-3" onClick={e => toggleSelect(s.id, e)}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => {}}
                      className="rounded border-navy-600 bg-navy-800 accent-brand-blue cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{s.full_name}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                    {s.referral_code && (
                      <span className="text-xs text-orange-400 font-mono">ref: {s.referral_code}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status || 'pending'} />
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
          <div className="px-4 py-2 border-t border-navy-700/30 text-xs text-gray-600">
            Showing {filtered.length} of {signups.length} entries
          </div>
        </div>
      )}

      {/* Detail Panel */}
      <DetailPanel
        signup={selected}
        onClose={() => setSelected(null)}
        onStatusChange={updateStatus}
      />

      {/* Toast */}
      <Toast
        message={toast?.message}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </div>
  )
}
