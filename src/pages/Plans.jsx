import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PRICE_TIERS = ['free', 'preview', 'starter', 'growth', 'scale']

const TIER_BADGE = {
  free:    'bg-gray-100 text-gray-700',
  preview: 'bg-purple-100 text-purple-700',
  starter: 'bg-sky-100 text-sky-700',
  growth:  'bg-emerald-100 text-emerald-700',
  scale:   'bg-amber-100 text-amber-700',
}

const BLANK_PLAN = {
  name: '',
  description: '',
  price_tier: 'starter',
  is_active: true,
  sort_order: 0,
  features: [],
}

export default function Plans() {
  const [plans, setPlans]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState(null) // plan object or null for new
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [form, setForm]             = useState(BLANK_PLAN)
  const [featureInput, setFeatureInput] = useState('')
  const [projectCounts, setProjectCounts] = useState({}) // plan_id → count

  useEffect(() => { fetchPlans() }, [])

  async function fetchPlans() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      setPlans(data || [])

      // Fetch project counts per plan
      const { data: projData } = await supabase
        .from('projects')
        .select('plan_id')
        .not('plan_id', 'is', null)
      if (projData) {
        const counts = {}
        projData.forEach(p => {
          counts[p.plan_id] = (counts[p.plan_id] || 0) + 1
        })
        setProjectCounts(counts)
      }
    } catch (err) {
      console.error('Error fetching plans:', err)
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm({ ...BLANK_PLAN, sort_order: plans.length })
    setFeatureInput('')
    setError(null)
    setShowModal(true)
  }

  function openEdit(plan) {
    setEditing(plan)
    setForm({
      name:        plan.name,
      description: plan.description || '',
      price_tier:  plan.price_tier || 'starter',
      is_active:   plan.is_active,
      sort_order:  plan.sort_order,
      features:    Array.isArray(plan.features) ? plan.features : [],
    })
    setFeatureInput('')
    setError(null)
    setShowModal(true)
  }

  function addFeature() {
    const val = featureInput.trim()
    if (!val) return
    setForm(f => ({ ...f, features: [...f.features, val] }))
    setFeatureInput('')
  }

  function removeFeature(idx) {
    setForm(f => ({ ...f, features: f.features.filter((_, i) => i !== idx) }))
  }

  async function savePlan() {
    if (!form.name.trim()) { setError('Plan name is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim(),
        price_tier:  form.price_tier,
        is_active:   form.is_active,
        sort_order:  Number(form.sort_order) || 0,
        features:    form.features,
      }
      if (editing) {
        const { error } = await supabase
          .from('plans').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('plans').insert(payload)
        if (error) throw error
      }
      await fetchPlans()
      setShowModal(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(plan) {
    await supabase
      .from('plans')
      .update({ is_active: !plan.is_active })
      .eq('id', plan.id)
    setPlans(prev =>
      prev.map(p => p.id === plan.id ? { ...p, is_active: !p.is_active } : p)
    )
  }

  if (loading) return (
    <div className="p-6 text-gray-500">Loading plans...</div>
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the plans customers can select when starting a project.
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> New Plan
        </button>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 transition-opacity ${
              !plan.is_active ? 'opacity-50' : ''
            }`}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-gray-900 text-base">{plan.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIER_BADGE[plan.price_tier] || TIER_BADGE.starter}`}>
                    {plan.price_tier}
                  </span>
                  {!plan.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                      Inactive
                    </span>
                  )}
                </div>
                {plan.description && (
                  <p className="text-sm text-gray-500 mt-1 leading-snug">{plan.description}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 shrink-0">#{plan.sort_order}</span>
            </div>

            {/* Features */}
            {Array.isArray(plan.features) && plan.features.length > 0 && (
              <ul className="space-y-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-sky-500 mt-0.5 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {projectCounts[plan.id] || 0} project{projectCounts[plan.id] !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(plan)}
                  className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                    plan.is_active
                      ? 'text-gray-500 hover:bg-gray-100'
                      : 'text-sky-600 hover:bg-sky-50'
                  }`}
                >
                  {plan.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => openEdit(plan)}
                  className="text-xs px-2 py-1 rounded-md font-medium text-sky-600 hover:bg-sky-50 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}

        {plans.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            No plans yet. Create your first plan to get started.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Plan' : 'New Plan'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >×</button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Build + Hosting + Domains"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description shown to customers"
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              {/* Price tier + sort order */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Tier</label>
                  <select
                    value={form.price_tier}
                    onChange={e => setForm(f => ({ ...f, price_tier: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {PRICE_TIERS.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    min={0}
                  />
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features <span className="text-gray-400 font-normal">(shown as checkmarks)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={featureInput}
                    onChange={e => setFeatureInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }}
                    placeholder="e.g. Custom domain setup"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-2 rounded-lg text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                {form.features.length > 0 && (
                  <ul className="space-y-1 bg-gray-50 rounded-lg p-3">
                    {form.features.map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="text-sky-500">✓</span> {f}
                        </span>
                        <button
                          onClick={() => removeFeature(i)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-sky-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm text-gray-700">Active (visible to customers)</span>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePlan}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
