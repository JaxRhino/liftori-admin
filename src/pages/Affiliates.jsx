import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Affiliates() {
  const [affiliates, setAffiliates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    commission_rate: '5',
    commission_type: 'per_signup'
  })
  const [saving, setSaving] = useState(false)
  const [referralCounts, setReferralCounts] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [{ data: affs }, { data: signups }] = await Promise.all([
        supabase.from('affiliates').select('*').order('created_at', { ascending: false }),
        supabase.from('waitlist_signups').select('referral_code').not('referral_code', 'is', null)
      ])
      setAffiliates(affs || [])
      const counts = {}
      ;(signups || []).forEach(s => {
        counts[s.referral_code] = (counts[s.referral_code] || 0) + 1
      })
      setReferralCounts(counts)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  function openEdit(affiliate) {
    setEditingId(affiliate.id)
    setForm({
      name: affiliate.name || '',
      email: affiliate.email || '',
      commission_rate: String(affiliate.commission_rate || '0'),
      commission_type: affiliate.commission_type || 'per_signup'
    })
    setShowForm(true)
  }

  function openNew() {
    setEditingId(null)
    setForm({ name: '', email: '', commission_rate: '5', commission_type: 'per_signup' })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('affiliates')
          .update({
            name: form.name,
            email: form.email || null,
            commission_rate: parseFloat(form.commission_rate) || 0,
            commission_type: form.commission_type
          })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const code = form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        const { error } = await supabase.from('affiliates').insert({
          name: form.name,
          email: form.email || null,
          referral_code: code,
          commission_rate: parseFloat(form.commission_rate) || 0,
          commission_type: form.commission_type,
          is_active: true
        })
        if (error) throw error
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ name: '', email: '', commission_rate: '5', commission_type: 'per_signup' })
      fetchData()
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(id, currentState) {
    await supabase.from('affiliates').update({ is_active: !currentState }).eq('id', id)
    setAffiliates(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a))
  }

  // Derived stats
  const totalReferrals = Object.values(referralCounts).reduce((a, b) => a + b, 0)
  const activeCount = affiliates.filter(a => a.is_active).length
  const topAffiliate = affiliates.length > 0
    ? affiliates.reduce((top, a) =>
        (referralCounts[a.referral_code] || 0) > (referralCounts[top.referral_code] || 0) ? a : top,
        affiliates[0])
    : null

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Affiliates</h1>
          <p className="text-gray-400 text-sm mt-1">Manage referral partners and track performance</p>
        </div>
        <button
          onClick={() => {
            if (showForm && !editingId) { setShowForm(false) } else { openNew() }
          }}
          className="btn-primary"
        >
          {showForm && !editingId ? 'Cancel' : '+ Add Affiliate'}
        </button>
      </div>

      {/* Stat Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Total Affiliates</p>
          <p className="text-2xl font-bold text-brand-blue">{affiliates.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Total Referrals</p>
          <p className="text-2xl font-bold text-purple-400">{totalReferrals}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Active</p>
          <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Top Affiliate</p>
          <p className="text-lg font-bold text-orange-400 truncate">
            {topAffiliate && (referralCounts[topAffiliate.referral_code] || 0) > 0
              ? topAffiliate.name
              : '—'}
          </p>
          {topAffiliate && (referralCounts[topAffiliate.referral_code] || 0) > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {referralCounts[topAffiliate.referral_code]} referral{referralCounts[topAffiliate.referral_code] !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="card mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">{editingId ? 'Edit Affiliate' : 'New Affiliate'}</h3>
            {editingId && (
              <button
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Mike Lydon"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="mike@example.com"
              />
            </div>
            <div>
              <label className="label">Commission Rate</label>
              <input
                className="input"
                type="number"
                value={form.commission_rate}
                onChange={e => setForm({ ...form, commission_rate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Commission Type</label>
              <select
                className="select"
                value={form.commission_type}
                onChange={e => setForm({ ...form, commission_type: e.target.value })}
              >
                <option value="per_signup">Per Signup ($)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !form.name}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingId ? 'Update Affiliate' : 'Create Affiliate'}
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : affiliates.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-sm">No affiliates yet. Add your first affiliate to start tracking referrals.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referrals</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.map(a => (
                <tr key={a.id} className="table-row">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{a.name}</p>
                    {a.email && <p className="text-xs text-gray-500">{a.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-navy-700 px-2 py-1 rounded font-mono text-brand-light">
                      {a.referral_code}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white">
                    {referralCounts[a.referral_code] || 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {a.commission_type === 'per_signup'
                      ? `$${a.commission_rate}`
                      : `${a.commission_rate}%`} / {a.commission_type === 'per_signup' ? 'signup' : 'sale'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${a.is_active
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-gray-500/20 text-gray-500'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => openEdit(a)}
                      className="text-xs text-brand-blue hover:text-brand-light transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(a.id, a.is_active)}
                      className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      {a.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
