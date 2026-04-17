import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// ──────────────────────────────────────────────────────────
// Product-line configuration
// ──────────────────────────────────────────────────────────
const PRODUCT_LINES = [
  {
    key: 'custom',
    label: 'Custom Builds',
    description: 'Full-stack builds — apps, platforms, e-commerce, dashboards.',
    accent: 'sky',
    defaultBilling: 'project',
  },
  {
    key: 'labos',
    label: 'LABOS',
    description: 'Liftori AI Business OS — departments, agents, automation.',
    accent: 'indigo',
    defaultBilling: 'monthly',
  },
  {
    key: 'consulting',
    label: 'Consulting',
    description: 'Packaged consulting services — ops, sales, AI strategy.',
    accent: 'amber',
    defaultBilling: 'project',
  },
  {
    key: 'addon',
    label: 'Add-Ons',
    description: 'Modular upgrades, seats, credits, and managed services.',
    accent: 'emerald',
    defaultBilling: 'monthly',
  },
]

const PRICE_TIERS = ['free', 'preview', 'starter', 'growth', 'scale']
const BILLING_TYPES = [
  { key: 'project',   label: 'Project Fee' },
  { key: 'monthly',   label: 'Monthly' },
  { key: 'yearly',    label: 'Yearly' },
  { key: 'hybrid',    label: 'Hybrid (project + monthly)' },
  { key: 'one-time',  label: 'One-Time' },
  { key: 'usage',     label: 'Usage-Based' },
]

const TIER_BADGE = {
  free:    'bg-gray-100 text-gray-700',
  preview: 'bg-purple-100 text-purple-700',
  starter: 'bg-sky-100 text-sky-700',
  growth:  'bg-emerald-100 text-emerald-700',
  scale:   'bg-amber-100 text-amber-700',
}

const ACCENT = {
  sky:     { chip: 'bg-sky-100 text-sky-700 border-sky-200',           tab: 'border-sky-500 text-sky-700' },
  indigo:  { chip: 'bg-indigo-100 text-indigo-700 border-indigo-200',  tab: 'border-indigo-500 text-indigo-700' },
  amber:   { chip: 'bg-amber-100 text-amber-700 border-amber-200',     tab: 'border-amber-500 text-amber-700' },
  emerald: { chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', tab: 'border-emerald-500 text-emerald-700' },
}

const BLANK_PLAN = {
  name: '',
  description: '',
  product_type: 'custom',
  price_tier: 'starter',
  billing_type: 'project',
  price_min: '',
  price_max: '',
  monthly_price: '',
  yearly_price: '',
  category: '',
  is_active: true,
  sort_order: 0,
  features: [],
  add_ons: [],
  credits_included: '',
  credits_price_per: '',
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return ''
  const v = Number(n)
  if (!Number.isFinite(v)) return ''
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function priceDisplay(plan) {
  const billing = plan.billing_type
  const parts = []
  if (plan.price_min || plan.price_max) {
    if (plan.price_min && plan.price_max && plan.price_min !== plan.price_max) {
      parts.push(`${fmtMoney(plan.price_min)}–${fmtMoney(plan.price_max)}`)
    } else {
      parts.push(fmtMoney(plan.price_min || plan.price_max))
    }
  }
  if (plan.monthly_price) parts.push(`${fmtMoney(plan.monthly_price)}/mo`)
  if (plan.yearly_price && !plan.monthly_price) parts.push(`${fmtMoney(plan.yearly_price)}/yr`)
  if (parts.length === 0) return 'Pricing TBD'
  return parts.join(' + ')
}

// ──────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────
export default function Plans() {
  const [plans, setPlans]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [form, setForm]             = useState(BLANK_PLAN)
  const [featureInput, setFeatureInput] = useState('')
  const [addOnInput, setAddOnInput]     = useState('')
  const [projectCounts, setProjectCounts] = useState({})
  const [activeTab, setActiveTab]   = useState('custom')

  useEffect(() => { fetchPlans() }, [])

  async function fetchPlans() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('product_type', { ascending: true })
        .order('sort_order', { ascending: true })
      if (error) throw error
      setPlans(data || [])

      const { data: projData } = await supabase
        .from('projects')
        .select('plan_id')
        .not('plan_id', 'is', null)
      if (projData) {
        const counts = {}
        projData.forEach(p => { counts[p.plan_id] = (counts[p.plan_id] || 0) + 1 })
        setProjectCounts(counts)
      }
    } catch (err) {
      console.error('Error fetching plans:', err)
    } finally {
      setLoading(false)
    }
  }

  const plansByLine = useMemo(() => {
    const buckets = { custom: [], labos: [], consulting: [], addon: [] }
    plans.forEach(p => {
      const key = (p.product_type || 'custom').toLowerCase()
      if (buckets[key]) buckets[key].push(p)
      else buckets.custom.push(p)
    })
    return buckets
  }, [plans])

  const visiblePlans = plansByLine[activeTab] || []
  const activeLine   = PRODUCT_LINES.find(l => l.key === activeTab) || PRODUCT_LINES[0]

  function openNew() {
    setEditing(null)
    const line = PRODUCT_LINES.find(l => l.key === activeTab) || PRODUCT_LINES[0]
    setForm({
      ...BLANK_PLAN,
      product_type: line.key,
      billing_type: line.defaultBilling,
      sort_order: visiblePlans.length,
    })
    setFeatureInput('')
    setAddOnInput('')
    setError(null)
    setShowModal(true)
  }

  function openEdit(plan) {
    setEditing(plan)
    setForm({
      name:             plan.name || '',
      description:      plan.description || '',
      product_type:     plan.product_type || 'custom',
      price_tier:       plan.price_tier || 'starter',
      billing_type:     plan.billing_type || 'project',
      price_min:        plan.price_min ?? '',
      price_max:        plan.price_max ?? '',
      monthly_price:    plan.monthly_price ?? '',
      yearly_price:     plan.yearly_price ?? '',
      category:         plan.category || '',
      is_active:        plan.is_active,
      sort_order:       plan.sort_order,
      features:         Array.isArray(plan.features) ? plan.features : [],
      add_ons:          Array.isArray(plan.add_ons) ? plan.add_ons : [],
      credits_included: plan.credits_included ?? '',
      credits_price_per: plan.credits_price_per ?? '',
    })
    setFeatureInput('')
    setAddOnInput('')
    setError(null)
    setShowModal(true)
  }

  function addFeature() {
    const v = featureInput.trim()
    if (!v) return
    setForm(f => ({ ...f, features: [...f.features, v] }))
    setFeatureInput('')
  }
  function removeFeature(i) {
    setForm(f => ({ ...f, features: f.features.filter((_, idx) => idx !== i) }))
  }
  function addAddOn() {
    const v = addOnInput.trim()
    if (!v) return
    setForm(f => ({ ...f, add_ons: [...f.add_ons, v] }))
    setAddOnInput('')
  }
  function removeAddOn(i) {
    setForm(f => ({ ...f, add_ons: f.add_ons.filter((_, idx) => idx !== i) }))
  }

  async function savePlan() {
    if (!form.name.trim()) { setError('Plan name is required.'); return }
    setSaving(true); setError(null)
    try {
      const toInt = (v) => v === '' || v === null ? null : Number(v)
      const payload = {
        name:             form.name.trim(),
        description:      form.description.trim(),
        product_type:     form.product_type,
        price_tier:       form.price_tier,
        billing_type:     form.billing_type,
        price_min:        toInt(form.price_min),
        price_max:        toInt(form.price_max),
        monthly_price:    toInt(form.monthly_price),
        yearly_price:     toInt(form.yearly_price),
        category:         form.category.trim() || null,
        is_active:        form.is_active,
        sort_order:       Number(form.sort_order) || 0,
        features:         form.features,
        add_ons:          form.add_ons,
        credits_included: toInt(form.credits_included),
        credits_price_per: toInt(form.credits_price_per),
      }
      if (editing) {
        const { error } = await supabase.from('plans').update(payload).eq('id', editing.id)
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
    await supabase.from('plans').update({ is_active: !plan.is_active }).eq('id', plan.id)
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: !p.is_active } : p))
  }

  async function duplicatePlan(plan) {
    const copy = { ...plan }
    delete copy.id
    delete copy.created_at
    delete copy.updated_at
    copy.name = `${plan.name} (Copy)`
    copy.sort_order = (plan.sort_order ?? 0) + 1
    const { error } = await supabase.from('plans').insert(copy)
    if (error) { alert(error.message); return }
    await fetchPlans()
  }

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────
  if (loading) return <div className="p-6 text-gray-500">Loading plans…</div>

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans &amp; Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage every product line Liftori sells — Custom Builds, LABOS, Consulting, and Add-Ons.
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> New Plan
        </button>
      </div>

      {/* Product-line tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex flex-wrap gap-1 -mb-px">
          {PRODUCT_LINES.map(line => {
            const count = (plansByLine[line.key] || []).length
            const isActive = activeTab === line.key
            const accent = ACCENT[line.accent] || ACCENT.sky
            return (
              <button
                key={line.key}
                onClick={() => setActiveTab(line.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? accent.tab + ' bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {line.label}
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Line description + stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md border ${ACCENT[activeLine.accent].chip} mb-1`}>
            {activeLine.label}
          </div>
          <p className="text-sm text-gray-600">{activeLine.description}</p>
        </div>
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <div>
            <div className="text-lg font-bold text-gray-900">{visiblePlans.length}</div>
            <div>plans</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{visiblePlans.filter(p => p.is_active).length}</div>
            <div>active</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">
              {visiblePlans.reduce((s, p) => s + (projectCounts[p.id] || 0), 0)}
            </div>
            <div>attached projects</div>
          </div>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visiblePlans.map(plan => (
          <div
            key={plan.id}
            className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 transition-opacity ${
              !plan.is_active ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-gray-900 text-base">{plan.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIER_BADGE[plan.price_tier] || TIER_BADGE.starter}`}>
                    {plan.price_tier || 'starter'}
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

            {/* Price line */}
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <div className="font-semibold text-gray-900">{priceDisplay(plan)}</div>
              <div className="text-xs text-gray-500 capitalize">{plan.billing_type || 'project'} billing</div>
            </div>

            {Array.isArray(plan.features) && plan.features.length > 0 && (
              <ul className="space-y-1">
                {plan.features.slice(0, 5).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-sky-500 mt-0.5 shrink-0">✓</span> {f}
                  </li>
                ))}
                {plan.features.length > 5 && (
                  <li className="text-xs text-gray-400 pl-5">+{plan.features.length - 5} more</li>
                )}
              </ul>
            )}

            {Array.isArray(plan.add_ons) && plan.add_ons.length > 0 && (
              <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
                <span className="font-medium text-gray-700">Add-ons: </span>
                {plan.add_ons.join(', ')}
              </div>
            )}

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {projectCounts[plan.id] || 0} project{projectCounts[plan.id] !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => duplicatePlan(plan)}
                  className="text-xs px-2 py-1 rounded-md font-medium text-gray-500 hover:bg-gray-100"
                  title="Duplicate"
                >Dup</button>
                <button
                  onClick={() => toggleActive(plan)}
                  className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                    plan.is_active ? 'text-gray-500 hover:bg-gray-100' : 'text-sky-600 hover:bg-sky-50'
                  }`}
                >
                  {plan.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => openEdit(plan)}
                  className="text-xs px-2 py-1 rounded-md font-medium text-sky-600 hover:bg-sky-50 transition-colors"
                >Edit</button>
              </div>
            </div>
          </div>
        ))}

        {visiblePlans.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
            No {activeLine.label} plans yet. Create your first one to get started.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Plan' : 'New Plan'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {/* Product line + tier */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Line *</label>
                  <select
                    value={form.product_type}
                    onChange={e => {
                      const line = PRODUCT_LINES.find(l => l.key === e.target.value) || PRODUCT_LINES[0]
                      setForm(f => ({ ...f, product_type: line.key, billing_type: f.billing_type || line.defaultBilling }))
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {PRODUCT_LINES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Tier</label>
                  <select
                    value={form.price_tier}
                    onChange={e => setForm(f => ({ ...f, price_tier: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {PRICE_TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing</label>
                  <select
                    value={form.billing_type}
                    onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {BILLING_TYPES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Name + Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="platform, seat, credit pack, etc."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
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

              {/* Pricing */}
              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="px-2 text-sm font-semibold text-gray-700">Pricing</legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Price Min ($)</label>
                    <input type="number" value={form.price_min}
                      onChange={e => setForm(f => ({ ...f, price_min: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Price Max ($)</label>
                    <input type="number" value={form.price_max}
                      onChange={e => setForm(f => ({ ...f, price_max: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Monthly ($)</label>
                    <input type="number" value={form.monthly_price}
                      onChange={e => setForm(f => ({ ...f, monthly_price: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Yearly ($)</label>
                    <input type="number" value={form.yearly_price}
                      onChange={e => setForm(f => ({ ...f, yearly_price: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </fieldset>

              {/* Credits (LABOS / usage-based) */}
              {(form.product_type === 'labos' || form.billing_type === 'usage') && (
                <fieldset className="border border-gray-200 rounded-lg p-4">
                  <legend className="px-2 text-sm font-semibold text-gray-700">Credits</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Credits Included</label>
                      <input type="number" value={form.credits_included}
                        onChange={e => setForm(f => ({ ...f, credits_included: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Price per Extra ($)</label>
                      <input type="number" step="0.01" value={form.credits_price_per}
                        onChange={e => setForm(f => ({ ...f, credits_price_per: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                </fieldset>
              )}

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
                  <button type="button" onClick={addFeature}
                    className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-2 rounded-lg text-sm font-medium">
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
                        <button onClick={() => removeFeature(i)} className="text-red-400 hover:text-red-600 text-xs">remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Add-ons */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Add-Ons <span className="text-gray-400 font-normal">(available upgrades)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={addOnInput}
                    onChange={e => setAddOnInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAddOn() } }}
                    placeholder="e.g. +1 seat ($50/mo)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button type="button" onClick={addAddOn}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium">
                    Add
                  </button>
                </div>
                {form.add_ons.length > 0 && (
                  <ul className="flex flex-wrap gap-2 bg-gray-50 rounded-lg p-3">
                    {form.add_ons.map((a, i) => (
                      <li key={i} className="inline-flex items-center gap-2 text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
                        {a}
                        <button onClick={() => removeAddOn(i)} className="text-red-400 hover:text-red-600">×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Sort + Active */}
              <div className="flex items-center gap-6">
                <div className="w-28">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" min={0} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer mt-6">
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span className="text-sm text-gray-700">Active (visible to customers)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl sticky bottom-0">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={savePlan} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
