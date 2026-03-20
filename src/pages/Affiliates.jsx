import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Performance tier thresholds (referral count)
const PERF_TIERS = [
  { key: 'gold',   label: 'Gold',   min: 15, bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  { key: 'silver', label: 'Silver', min: 5,  bg: 'bg-gray-400/20',   text: 'text-gray-300'  },
  { key: 'bronze', label: 'Bronze', min: 1,  bg: 'bg-orange-800/20', text: 'text-orange-400' },
  { key: 'none',   label: 'None',   min: 0,  bg: 'bg-gray-500/10',   text: 'text-gray-600'  },
]

function getPerfTier(referrals) {
  return PERF_TIERS.find(t => referrals >= t.min) || PERF_TIERS[PERF_TIERS.length - 1]
}

function calcCommission(affiliate, referralCount) {
  if (affiliate.commission_type === 'per_signup') {
    return (parseFloat(affiliate.commission_rate) || 0) * referralCount
  }
  return null // percentage — can't calculate without sale values
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function generateCode(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PerfBadge({ referrals }) {
  const tier = getPerfTier(referrals)
  if (tier.key === 'none') return <span className="text-xs text-gray-600">—</span>
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${tier.bg} ${tier.text}`}>
      {tier.key === 'gold' && '★ '}
      {tier.label}
    </span>
  )
}

function StatusBadge({ active }) {
  return active
    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Active</span>
    : <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-500" />Inactive</span>
}

function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-0.5 rounded border border-brand-blue/30 text-brand-blue hover:bg-brand-blue/10 transition-colors"
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ─── Affiliate Detail Panel (expanded row) ───────────────────────────────────

function AffiliateDetail({ affiliate, referralCount, onMarkPaid, onToggleActive, onEdit }) {
  const commission = calcCommission(affiliate, referralCount)
  const tier = getPerfTier(referralCount)
  const referralLink = `https://liftori.ai/?ref=${affiliate.referral_code}`
  const convRate = referralCount > 0 ? '—' : '—' // future: clicks data

  return (
    <div className="bg-navy-900/50 border-t border-navy-700/30 px-6 py-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

        {/* Profile + Referral Link */}
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Profile</p>
          <div className="space-y-1.5">
            <p className="text-sm text-white font-medium">{affiliate.name}</p>
            {affiliate.email && <p className="text-xs text-gray-400">{affiliate.email}</p>}
            <p className="text-xs text-gray-500">Joined {formatDate(affiliate.created_at)}</p>
          </div>
          <div className="pt-1 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Referral Link</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono bg-navy-800 border border-navy-700/50 px-2 py-1 rounded text-brand-light break-all">
                {referralLink}
              </code>
              <CopyButton value={referralLink} label="Copy Link" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Code:</span>
              <code className="text-xs font-mono bg-navy-800 border border-navy-700/50 px-2 py-1 rounded text-brand-light">
                {affiliate.referral_code}
              </code>
              <CopyButton value={affiliate.referral_code} label="Copy" />
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Performance</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-navy-800/60 border border-navy-700/40 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Referrals</p>
              <p className="text-xl font-bold text-white">{referralCount}</p>
            </div>
            <div className="bg-navy-800/60 border border-navy-700/40 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Tier</p>
              <div className="mt-0.5"><PerfBadge referrals={referralCount} /></div>
            </div>
            <div className="bg-navy-800/60 border border-navy-700/40 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Commission Rate</p>
              <p className="text-sm font-semibold text-white">
                {affiliate.commission_type === 'per_signup'
                  ? `$${affiliate.commission_rate} / signup`
                  : `${affiliate.commission_rate}% / sale`}
              </p>
            </div>
            <div className="bg-navy-800/60 border border-navy-700/40 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Commissions Owed</p>
              <p className="text-sm font-semibold text-emerald-400">
                {commission !== null ? `$${commission.toFixed(2)}` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Payout & Actions */}
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Payout Status</p>
          <div className="bg-navy-800/60 border border-navy-700/40 rounded-lg p-3 space-y-2">
            {affiliate.total_paid > 0 ? (
              <div>
                <p className="text-xs text-gray-500">Total Paid Out</p>
                <p className="text-lg font-bold text-emerald-400">${(affiliate.total_paid || 0).toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No payouts recorded yet</p>
            )}
            {commission !== null && commission > 0 && (
              <div className="pt-1 border-t border-navy-700/30">
                <p className="text-xs text-gray-500">Balance Owed</p>
                <p className="text-sm font-semibold text-yellow-400">
                  ${Math.max(0, commission - (affiliate.total_paid || 0)).toFixed(2)}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {commission !== null && commission > 0 && (
              <button
                onClick={() => onMarkPaid(affiliate, commission)}
                className="w-full px-3 py-1.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded-lg hover:bg-emerald-600/30 transition-colors"
              >
                Mark as Paid (${commission.toFixed(2)})
              </button>
            )}
            <button
              onClick={() => onEdit(affiliate)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-lg hover:bg-brand-blue/20 transition-colors"
            >
              Edit Affiliate
            </button>
            <button
              onClick={() => onToggleActive(affiliate.id, affiliate.is_active)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-navy-800 text-gray-400 border border-navy-700/50 rounded-lg hover:text-white transition-colors"
            >
              {affiliate.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function AffiliateModal({ editing, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editing?.name || '',
    email: editing?.email || '',
    commission_rate: String(editing?.commission_rate ?? '5'),
    commission_type: editing?.commission_type || 'per_signup',
    notes: editing?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const previewCode = generateCode(form.name)

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        const { error: err } = await supabase
          .from('affiliates')
          .update({
            name: form.name.trim(),
            email: form.email.trim() || null,
            commission_rate: parseFloat(form.commission_rate) || 0,
            commission_type: form.commission_type,
            notes: form.notes.trim() || null,
          })
          .eq('id', editing.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('affiliates')
          .insert({
            name: form.name.trim(),
            email: form.email.trim() || null,
            referral_code: previewCode,
            commission_rate: parseFloat(form.commission_rate) || 0,
            commission_type: form.commission_type,
            notes: form.notes.trim() || null,
            is_active: true,
          })
        if (err) throw err
      }
      onSaved()
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
          <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Affiliate' : 'New Affiliate'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Mike Lydon"
                autoFocus
              />
              {!editing && form.name && (
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
                  <span>Referral code:</span>
                  <code className="font-mono text-brand-light bg-navy-900/60 px-1.5 py-0.5 rounded">{previewCode}</code>
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="mike@example.com"
              />
            </div>
            <div>
              <label className="label">Commission Rate</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.5"
                value={form.commission_rate}
                onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Commission Type</label>
              <select
                className="select"
                value={form.commission_type}
                onChange={e => setForm(f => ({ ...f, commission_type: e.target.value }))}
              >
                <option value="per_signup">Per Signup ($)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Partner details, agreements, contact notes..."
              />
            </div>
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
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
            ) : editing ? 'Update Affiliate' : 'Create Affiliate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Affiliates() {
  const [affiliates, setAffiliates] = useState([])
  const [referralCounts, setReferralCounts] = useState({})
  const [totalSignups, setTotalSignups] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const [showModal, setShowModal] = useState(false)
  const [editingAffiliate, setEditingAffiliate] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: affs }, { data: signups }, { count: signupTotal }] = await Promise.all([
        supabase.from('affiliates').select('*').order('created_at', { ascending: false }),
        supabase.from('waitlist_signups').select('referral_code').not('referral_code', 'is', null),
        supabase.from('waitlist_signups').select('*', { count: 'exact', head: true }),
      ])
      setAffiliates(affs || [])
      const counts = {}
      ;(signups || []).forEach(s => {
        if (s.referral_code) counts[s.referral_code] = (counts[s.referral_code] || 0) + 1
      })
      setReferralCounts(counts)
      setTotalSignups(signupTotal || 0)
    } catch (err) {
      console.error('Error fetching affiliates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleActive(id, currentState) {
    await supabase.from('affiliates').update({ is_active: !currentState }).eq('id', id)
    setAffiliates(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a))
  }

  async function handleMarkPaid(affiliate, amount) {
    const newTotal = (affiliate.total_paid || 0) + amount
    const { error } = await supabase
      .from('affiliates')
      .update({ total_paid: newTotal })
      .eq('id', affiliate.id)
    if (!error) {
      setAffiliates(prev => prev.map(a => a.id === affiliate.id ? { ...a, total_paid: newTotal } : a))
    }
  }

  function openCreate() { setEditingAffiliate(null); setShowModal(true) }
  function openEdit(affiliate) { setEditingAffiliate(affiliate); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditingAffiliate(null) }

  // ─── Derived Stats ───────────────────────────────────────────────────────

  const totalReferrals = Object.values(referralCounts).reduce((a, b) => a + b, 0)
  const activeCount = affiliates.filter(a => a.is_active).length
  const conversionRate = totalSignups > 0 ? ((totalReferrals / totalSignups) * 100).toFixed(1) : '0.0'

  const commissionsOwed = affiliates.reduce((sum, a) => {
    const c = calcCommission(a, referralCounts[a.referral_code] || 0)
    return c !== null ? sum + c : sum
  }, 0)

  const totalPaidOut = affiliates.reduce((sum, a) => sum + (a.total_paid || 0), 0)

  // ─── Filtering ───────────────────────────────────────────────────────────

  const filtered = affiliates.filter(a => {
    const refs = referralCounts[a.referral_code] || 0
    const tier = getPerfTier(refs)

    const matchesSearch =
      !search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase()) ||
      a.referral_code?.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && a.is_active) ||
      (statusFilter === 'inactive' && !a.is_active)

    const matchesTier =
      tierFilter === 'all' || tier.key === tierFilter

    return matchesSearch && matchesStatus && matchesTier
  })

  const hasFilters = search || statusFilter !== 'all' || tierFilter !== 'all'

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Affiliates</h1>
          <p className="text-sm text-gray-400 mt-1">
            {loading ? 'Loading...' : `${affiliates.length} referral partner${affiliates.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-blue hover:bg-sky-400 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Affiliate
          </button>
          <button
            onClick={fetchData}
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Affiliates</p>
          <p className="text-3xl font-bold text-white mt-2">{affiliates.length}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Active</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{activeCount}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Referrals</p>
          <p className="text-3xl font-bold text-brand-blue mt-2">{totalReferrals}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Conversion Rate</p>
          <p className="text-3xl font-bold text-purple-400 mt-2">{conversionRate}<span className="text-base text-gray-400 font-normal">%</span></p>
          <p className="text-xs text-gray-600 mt-0.5">of total signups</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Commissions Owed</p>
          <p className="text-3xl font-bold text-yellow-400 mt-2">${commissionsOwed.toFixed(0)}</p>
          {totalPaidOut > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">${totalPaidOut.toFixed(0)} paid</p>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-navy-800 border border-navy-700/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue/50 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40 min-w-[140px]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40 min-w-[140px]"
        >
          <option value="all">All Tiers</option>
          <option value="gold">Gold (15+ refs)</option>
          <option value="silver">Silver (5+ refs)</option>
          <option value="bronze">Bronze (1+ refs)</option>
          <option value="none">No Referrals</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setTierFilter('all') }}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white border border-navy-700/50 rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
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
              {hasFilters ? 'No affiliates match your filters' : 'No affiliates yet. Add your first partner to start tracking referrals.'}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); setTierFilter('all') }}
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Affiliate</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Referrals</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Tier</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Commission</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Owed</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/30">
                {filtered.map(a => {
                  const refs = referralCounts[a.referral_code] || 0
                  const commission = calcCommission(a, refs)
                  const isExpanded = expandedId === a.id

                  return (
                    <>
                      <tr
                        key={a.id}
                        className="hover:bg-navy-700/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        {/* Affiliate */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-blue/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-brand-blue">
                                {(a.name || '?')[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white leading-tight">{a.name}</p>
                              {a.email && <p className="text-xs text-gray-400">{a.email}</p>}
                            </div>
                          </div>
                        </td>

                        {/* Code */}
                        <td className="px-4 py-3">
                          <code className="text-xs bg-navy-900/60 border border-navy-700/40 px-2 py-1 rounded font-mono text-brand-light">
                            {a.referral_code}
                          </code>
                        </td>

                        {/* Referrals */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-white">{refs}</span>
                        </td>

                        {/* Tier */}
                        <td className="px-4 py-3">
                          <PerfBadge referrals={refs} />
                        </td>

                        {/* Rate */}
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {a.commission_type === 'per_signup'
                            ? `$${a.commission_rate}/signup`
                            : `${a.commission_rate}%/sale`}
                        </td>

                        {/* Owed */}
                        <td className="px-4 py-3">
                          {commission !== null ? (
                            <span className={commission > 0 ? 'text-sm font-medium text-yellow-400' : 'text-sm text-gray-600'}>
                              ${commission.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge active={a.is_active} />
                        </td>

                        {/* Chevron */}
                        <td className="px-4 py-3">
                          <svg
                            className={`w-4 h-4 text-gray-500 transition-transform ml-auto ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </td>
                      </tr>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <tr key={`${a.id}-detail`}>
                          <td colSpan={8} className="p-0">
                            <AffiliateDetail
                              affiliate={a}
                              referralCount={refs}
                              onMarkPaid={handleMarkPaid}
                              onToggleActive={toggleActive}
                              onEdit={openEdit}
                            />
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
      {!loading && filtered.length > 0 && filtered.length !== affiliates.length && (
        <p className="text-xs text-gray-500 text-center">
          Showing {filtered.length} of {affiliates.length} affiliates
        </p>
      )}

      {/* Modal */}
      {showModal && (
        <AffiliateModal
          editing={editingAffiliate}
          onClose={closeModal}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}
