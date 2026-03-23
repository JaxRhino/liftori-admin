import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const EMPTY_FORM = {
  sales_rep_name: '',
  sales_rep_email: '',
  account_name: '',
  shipper_id: '',
  broker_id: '',
  commission_rate: '',
  status: 'active',
  notes: '',
}

export default function FreightSalesProfiles() {
  const [profiles, setProfiles] = useState([])
  const [shippers, setShippers] = useState([])
  const [brokers, setBrokers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null = create, object = edit
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [profilesRes, shippersRes, brokersRes] = await Promise.all([
        supabase.from('freight_sales_profiles').select('*, freight_shippers(name), freight_brokers(name)').order('created_at', { ascending: false }),
        supabase.from('freight_shippers').select('id, name').eq('status', 'active').order('name'),
        supabase.from('freight_brokers').select('id, name').order('name'),
      ])
      setProfiles(profilesRes.data || [])
      setShippers(shippersRes.data || [])
      setBrokers(brokersRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, broker_id: brokers[0]?.id || '' })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(profile) {
    setEditing(profile)
    setForm({
      sales_rep_name: profile.sales_rep_name || '',
      sales_rep_email: profile.sales_rep_email || '',
      account_name: profile.account_name || '',
      shipper_id: profile.shipper_id || '',
      broker_id: profile.broker_id || '',
      commission_rate: profile.commission_rate != null ? String(profile.commission_rate) : '',
      status: profile.status || 'active',
      notes: profile.notes || '',
    })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  async function handleSave() {
    setFormError('')
    if (!form.sales_rep_name.trim()) { setFormError('Sales rep name is required'); return }
    if (!form.account_name.trim()) { setFormError('Account name is required'); return }
    if (!form.shipper_id) { setFormError('Shipper is required'); return }
    if (!form.broker_id) { setFormError('Broker is required'); return }
    if (form.commission_rate === '' || isNaN(parseFloat(form.commission_rate))) {
      setFormError('Commission rate is required (e.g. 5 for 5%)')
      return
    }

    setSaving(true)
    try {
      const payload = {
        sales_rep_name: form.sales_rep_name.trim(),
        sales_rep_email: form.sales_rep_email.trim() || null,
        account_name: form.account_name.trim(),
        shipper_id: form.shipper_id,
        broker_id: form.broker_id,
        commission_rate: parseFloat(form.commission_rate),
        status: form.status,
        notes: form.notes.trim() || null,
      }

      if (editing) {
        const { error } = await supabase.from('freight_sales_profiles').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('freight_sales_profiles').insert(payload)
        if (error) throw error
      }

      closeModal()
      await loadAll()
    } catch (e) {
      setFormError(e.message || 'Error saving profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('freight_sales_profiles').delete().eq('id', id)
      if (error) throw error
      setDeleteConfirm(null)
      await loadAll()
    } catch (e) {
      console.error(e)
    }
  }

  async function toggleStatus(profile) {
    const newStatus = profile.status === 'active' ? 'inactive' : 'active'
    try {
      await supabase.from('freight_sales_profiles').update({ status: newStatus }).eq('id', profile.id)
      await loadAll()
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      p.sales_rep_name?.toLowerCase().includes(q) ||
      p.account_name?.toLowerCase().includes(q) ||
      p.sales_rep_email?.toLowerCase().includes(q) ||
      p.freight_shippers?.name?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <h1 className="text-xl font-bold text-white">Sales Profiles</h1>
          </div>
          <p className="text-sm text-gray-400">Manage BIH Freight sales reps and their shipper account assignments</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Profile
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search profiles…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/50"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="ml-auto text-sm text-gray-500 self-center">
          {filtered.length} profile{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
          </svg>
          <p className="text-gray-400 font-medium mb-1">{search || statusFilter ? 'No matching profiles' : 'No sales profiles yet'}</p>
          <p className="text-gray-600 text-sm mb-4">Sales profiles connect a BIH sales rep to a shipper account with a commission rate.</p>
          {!search && !statusFilter && (
            <button onClick={openCreate} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors">
              Create First Profile
            </button>
          )}
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700/50">
                  {['Sales Rep', 'Account', 'Shipper', 'Broker', 'Commission', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(profile => (
                  <tr key={profile.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white">{profile.sales_rep_name}</div>
                      {profile.sales_rep_email && (
                        <div className="text-xs text-gray-500 mt-0.5">{profile.sales_rep_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-300">{profile.account_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-300">{profile.freight_shippers?.name || <span className="text-gray-600">—</span>}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-400">{profile.freight_brokers?.name || <span className="text-gray-600">—</span>}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-mono font-semibold text-emerald-400">
                        {profile.commission_rate != null ? `${profile.commission_rate}%` : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleStatus(profile)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                        profile.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${profile.status === 'active' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                        {profile.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(profile)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-navy-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteConfirm(profile)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700/50">
              <h2 className="text-base font-semibold text-white">{editing ? 'Edit Sales Profile' : 'New Sales Profile'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-navy-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Account Name *</label>
                  <input
                    type="text"
                    value={form.account_name}
                    onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                    placeholder="e.g. Acme Shipping — Chicago"
                    className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Sales Rep Name *</label>
                  <input
                    type="text"
                    value={form.sales_rep_name}
                    onChange={e => setForm(f => ({ ...f, sales_rep_name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Sales Rep Email</label>
                  <input
                    type="email"
                    value={form.sales_rep_email}
                    onChange={e => setForm(f => ({ ...f, sales_rep_email: e.target.value }))}
                    placeholder="rep@bihfreight.com"
                    className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Shipper / Account *</label>
                  <select
                    value={form.shipper_id}
                    onChange={e => setForm(f => ({ ...f, shipper_id: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/60"
                  >
                    <option value="">Select shipper…</option>
                    {shippers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Broker *</label>
                  <select
                    value={form.broker_id}
                    onChange={e => setForm(f => ({ ...f, broker_id: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/60"
                  >
                    <option value="">Select broker…</option>
                    {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Commission Rate (%) *</label>
                  <input
                    type="number"
                    value={form.commission_rate}
                    onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
                    placeholder="e.g. 5"
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/60"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any notes about this account or sales arrangement…"
                    rows={3}
                    className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60 resize-none"
                  />
                </div>
              </div>
              {formError && (
                <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {formError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-navy-700/50">
              <button onClick={closeModal} className="px-4 py-2 border border-navy-600 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:border-navy-500 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-sm p-6">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Delete Sales Profile?</h3>
            <p className="text-sm text-gray-400 mb-5">
              <strong className="text-white">{deleteConfirm.account_name}</strong> ({deleteConfirm.sales_rep_name}) will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-navy-600 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
