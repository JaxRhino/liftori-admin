import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const EMPTY_FORM = {
  name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  status: 'active',
  notes: '',
}

export default function FreightShippers() {
  const [shippers, setShippers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { loadShippers() }, [])

  async function loadShippers() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('freight_shippers')
        .select('*')
        .order('name')
      setShippers(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(shipper) {
    setEditing(shipper)
    setForm({
      name: shipper.name || '',
      contact_name: shipper.contact_name || '',
      contact_email: shipper.contact_email || '',
      contact_phone: shipper.contact_phone || '',
      address: shipper.address || '',
      city: shipper.city || '',
      state: shipper.state || '',
      zip: shipper.zip || '',
      status: shipper.status || 'active',
      notes: shipper.notes || '',
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
    if (!form.name.trim()) { setFormError('Company name is required'); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim().toUpperCase() || null,
        zip: form.zip.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      }

      if (editing) {
        const { error } = await supabase.from('freight_shippers').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('freight_shippers').insert(payload)
        if (error) throw error
      }

      closeModal()
      await loadShippers()
    } catch (e) {
      setFormError(e.message || 'Error saving shipper')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('freight_shippers').delete().eq('id', id)
      if (error) throw error
      setDeleteConfirm(null)
      await loadShippers()
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = shippers.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      s.name?.toLowerCase().includes(q) ||
      s.contact_name?.toLowerCase().includes(q) ||
      s.contact_email?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || s.status === statusFilter
    return matchSearch && matchStatus
  })

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <h1 className="text-xl font-bold text-white">Shippers</h1>
          </div>
          <p className="text-sm text-gray-400">Manage shipping company accounts for BIH Freight</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Shipper
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
            placeholder="Search shippers…"
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
        <span className="ml-auto text-sm text-gray-500 self-center">{filtered.length} shipper{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375z" />
          </svg>
          <p className="text-gray-400 font-medium mb-1">{search || statusFilter ? 'No matching shippers' : 'No shippers yet'}</p>
          <p className="text-gray-600 text-sm mb-4">Add shipping companies that work with BIH Freight.</p>
          {!search && !statusFilter && (
            <button onClick={openCreate} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors">Add First Shipper</button>
          )}
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700/50">
                  {['Company', 'Contact', 'Location', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(shipper => (
                  <tr key={shipper.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-white">{shipper.name}</div>
                      {shipper.notes && <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{shipper.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {shipper.contact_name && <div className="text-sm text-gray-300">{shipper.contact_name}</div>}
                      {shipper.contact_email && <div className="text-xs text-gray-500">{shipper.contact_email}</div>}
                      {shipper.contact_phone && <div className="text-xs text-gray-500">{shipper.contact_phone}</div>}
                      {!shipper.contact_name && !shipper.contact_email && <span className="text-gray-600 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-400">
                        {[shipper.city, shipper.state].filter(Boolean).join(', ') || <span className="text-gray-600">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        shipper.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-gray-500/10 text-gray-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${shipper.status === 'active' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                        {shipper.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(shipper)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-navy-600 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteConfirm(shipper)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
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
              <h2 className="text-base font-semibold text-white">{editing ? 'Edit Shipper' : 'Add Shipper'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-navy-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Company Name *</label>
                <input type="text" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Company name" className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Contact Name</label>
                  <input type="text" value={form.contact_name} onChange={e => f('contact_name', e.target.value)} placeholder="Full name" className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Contact Phone</label>
                  <input type="tel" value={form.contact_phone} onChange={e => f('contact_phone', e.target.value)} placeholder="(555) 000-0000" className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Contact Email</label>
                  <input type="email" value={form.contact_email} onChange={e => f('contact_email', e.target.value)} placeholder="contact@company.com" className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Address</label>
                  <input type="text" value={form.address} onChange={e => f('address', e.target.value)} placeholder="Street address" className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">City</label>
                  <input type="text" value={form.city} onChange={e => f('city', e.target.value)} placeholder="City" className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">State</label>
                    <input type="text" value={form.state} onChange={e => f('state', e.target.value.toUpperCase())} placeholder="FL" maxLength={2} className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">ZIP</label>
                    <input type="text" value={form.zip} onChange={e => f('zip', e.target.value)} placeholder="32202" className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Status</label>
                  <select value={form.status} onChange={e => f('status', e.target.value)} className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/60">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Notes about this shipper…" rows={2} className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60 resize-none" />
                </div>
              </div>
              {formError && (
                <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{formError}</div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-navy-700/50">
              <button onClick={closeModal} className="px-4 py-2 border border-navy-600 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Shipper'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-white mb-2">Delete Shipper?</h3>
            <p className="text-sm text-gray-400 mb-5"><strong className="text-white">{deleteConfirm.name}</strong> will be permanently deleted. Associated loads and profiles may be affected.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-navy-600 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
