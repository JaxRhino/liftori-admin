import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// ── Flow taxonomy ─────────────────────────────────────────────
const CATEGORIES = [
  { key: 'main',     label: 'Main Flow', hint: 'The account-first entry every customer starts with, before product flows' },
  { key: 'products', label: 'Products',  hint: 'One editable flow per product offering' },
  { key: 'services', label: 'Services',  hint: 'One editable flow per service offering' },
  { key: 'team',     label: 'Internal Flows', hint: 'Internal onboarding — triggered after a team member is invited' },
]

// Main + Internal flows are static. Product/Service flows are loaded from the
// offerings catalog at runtime so the dropdown always matches what we sell.
const STATIC_FLOWS = [
  { value: 'start', label: 'Start Flow', category: 'main', desc: 'Account-first entry — create account, set business journey, pick interests (runs before every customer flow)' },
  { value: 'tester_onboarding',     label: 'Tester Onboarding',     category: 'team', desc: 'NDA, 1099, platform access, first assignment' },
  { value: 'sales_onboarding',      label: 'Sales Onboarding',      category: 'team', desc: 'CRM training, scripts, pipeline rules' },
  { value: 'consultant_onboarding', label: 'Consultant Onboarding', category: 'team', desc: 'Scorecards, call hub, availability' },
  { value: 'dev_onboarding',        label: 'Dev Onboarding',        category: 'team', desc: 'GitHub, Supabase, deploy pipeline' },
  { value: 'pm_onboarding',         label: 'PM Onboarding',         category: 'team', desc: 'Project lifecycle, tools, cadence' },
  { value: 'ops_onboarding',        label: 'Ops Onboarding',        category: 'team', desc: 'Ticket queue, SLAs, internal systems' },
]

// Card types — what role a card plays in the flow
const CARD_TYPES = [
  { value: 'welcome',      label: 'Welcome',         hasBody: true,  hasFields: false, dot: 'bg-sky-400' },
  { value: 'account',      label: 'Create Account',  hasBody: true,  hasFields: true,  dot: 'bg-brand-blue' },
  { value: 'industry',     label: 'Industry Picker', hasBody: false, hasFields: true,  dot: 'bg-violet-400' },
  { value: 'customer_info',label: 'Customer Info',   hasBody: false, hasFields: true,  dot: 'bg-blue-400' },
  { value: 'company_info', label: 'Company Info',    hasBody: false, hasFields: true,  dot: 'bg-emerald-400' },
  { value: 'features',     label: 'Features',        hasBody: false, hasFields: true,  dot: 'bg-amber-400' },
  { value: 'data',         label: 'Data / Fields',   hasBody: false, hasFields: true,  dot: 'bg-cyan-400' },
  { value: 'estimate',     label: 'Estimate',        hasBody: true,  hasFields: false, dot: 'bg-teal-400' },
  { value: 'payment',      label: 'Payment',         hasBody: true,  hasFields: false, dot: 'bg-green-400' },
  { value: 'thankyou',     label: 'Thank You',       hasBody: true,  hasFields: false, dot: 'bg-rose-400' },
  { value: 'custom',       label: 'Custom',          hasBody: true,  hasFields: true,  dot: 'bg-slate-400' },
]
const cardTypeInfo = (t) => CARD_TYPES.find(c => c.value === t) || CARD_TYPES.find(c => c.value === 'data')

const FIELD_TYPES = [
  { value: 'text',        label: 'Short Text' },
  { value: 'textarea',    label: 'Long Text' },
  { value: 'email',       label: 'Email' },
  { value: 'password',    label: 'Password' },
  { value: 'tel',         label: 'Phone' },
  { value: 'number',      label: 'Number' },
  { value: 'currency',    label: 'Currency / Revenue' },
  { value: 'date',        label: 'Date' },
  { value: 'address',     label: 'Address' },
  { value: 'select',      label: 'Dropdown (single)' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'radio',       label: 'Radio (single)' },
  { value: 'file',        label: 'File Upload' },
  { value: 'color_theme', label: 'Color Theme (library)' },
  { value: 'signature',   label: 'E-Signature' },
  { value: 'info',        label: 'Info (display only)' },
]
const hasOptions = (t) => ['select', 'multiselect', 'radio'].includes(t)
const isTheme = (t) => t === 'color_theme'
const THEME_LIBRARY = [
  { key: 'midnight', name: 'Midnight',     colors: ['#0B1220', '#1E3A5F', '#3B82F6', '#E2E8F0'] },
  { key: 'ocean',    name: 'Ocean',        colors: ['#0C4A6E', '#0EA5E9', '#7DD3FC', '#F0F9FF'] },
  { key: 'forest',   name: 'Forest',       colors: ['#14532D', '#16A34A', '#86EFAC', '#F0FDF4'] },
  { key: 'sunset',   name: 'Sunset',       colors: ['#7C2D12', '#F97316', '#FDBA74', '#FFF7ED'] },
  { key: 'berry',    name: 'Berry',        colors: ['#581C87', '#A855F7', '#D8B4FE', '#FAF5FF'] },
  { key: 'rose',     name: 'Rose',         colors: ['#881337', '#F43F5E', '#FDA4AF', '#FFF1F2'] },
  { key: 'slate',    name: 'Slate Pro',    colors: ['#0F172A', '#475569', '#94A3B8', '#F8FAFC'] },
  { key: 'gold',     name: 'Gold & Black', colors: ['#1C1917', '#D4A017', '#FCD34D', '#FAFAF9'] },
  { key: 'mint',     name: 'Mint',         colors: ['#064E3B', '#10B981', '#6EE7B7', '#ECFDF5'] },
  { key: 'coral',    name: 'Coral',        colors: ['#7F1D1D', '#FB7185', '#FECDD3', '#FFF1F2'] },
  { key: 'mono',     name: 'Monochrome',   colors: ['#111827', '#374151', '#9CA3AF', '#F9FAFB'] },
  { key: 'sky',      name: 'Sky',          colors: ['#0369A1', '#38BDF8', '#BAE6FD', '#F0F9FF'] },
]
const themeKeys = () => THEME_LIBRARY.map(t => t.key)
const DEFAULT_INDUSTRIES = ['Real Estate','Healthcare','Legal Services','Insurance','Financial Services','Construction','Retail / E-Commerce','SaaS / Technology','Marketing Agency','Non-Profit','Recruiting / Staffing','Consulting','Property Management','Automotive','Other']

const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field'
const normOpts = (options) => (options || []).map(o => typeof o === 'string' ? { label: o, enabled: true } : { label: o.label || '', enabled: o.enabled !== false })
const enabledLabels = (options) => normOpts(options).filter(o => o.enabled && o.label).map(o => o.label)

export default function WizardBuilder() {
  const [category, setCategory] = useState('products')
  const [selectedFlow, setSelectedFlow] = useState('crm')
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null) // working copy of the card in the modal
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [offeringFlows, setOfferingFlows] = useState([])

  // Product/Service flows come from the offerings catalog -> dropdown stays in sync
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('offerings')
        .select('slug, name, kind, summary, flow_type, sort')
        .eq('active', true)
        .order('sort', { ascending: true })
      if (cancelled) return
      setOfferingFlows((data || []).map(of => ({
        value: of.flow_type || of.slug,
        label: of.name,
        category: of.kind === 'product' ? 'products' : 'services',
        desc: of.summary || '',
      })))
    })()
    return () => { cancelled = true }
  }, [])

  const FLOWS = useMemo(() => [...STATIC_FLOWS, ...offeringFlows], [offeringFlows])

  const flowsInCategory = FLOWS.filter(f => f.category === category)
  const flowInfo = FLOWS.find(f => f.value === selectedFlow) || FLOWS[0]

  // Industries available for scoping come from this flow's industry-picker card (published only)
  const industryCard = cards.find(c => c.card_type === 'industry')
  const industryField = industryCard?.fields?.find(f => hasOptions(f.type)) || industryCard?.fields?.[0]
  const availableIndustries = (industryField && (industryField.options || []).length)
    ? enabledLabels(industryField.options)
    : DEFAULT_INDUSTRIES

  useEffect(() => { fetchCards() }, [selectedFlow])

  // When switching category, jump to the first flow in that category
  function switchCategory(cat) {
    setCategory(cat)
    const first = FLOWS.find(f => f.category === cat)
    if (first) setSelectedFlow(first.value)
  }

  async function fetchCards() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('wizard_steps')
        .select('*')
        .eq('flow_type', selectedFlow)
        .order('step_number', { ascending: true })
      if (error) throw error
      setCards((data || []).map(normalize))
    } catch (err) {
      console.error('fetchCards:', err)
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  function normalize(row) {
    return {
      ...row,
      card_title: row.card_title || row.question || 'Untitled',
      card_type: row.card_type || 'data',
      body: row.body || '',
      subtitle: row.subtitle || '',
      fields: Array.isArray(row.fields) ? row.fields : [],
      industries: Array.isArray(row.industries) ? row.industries : [],
    }
  }

  function openCard(card) {
    setIsNew(false)
    setEditing(JSON.parse(JSON.stringify(card)))
  }

  function openNewCard() {
    setIsNew(true)
    setEditing({
      flow_type: selectedFlow,
      step_number: cards.length + 1,
      card_title: '',
      card_type: 'data',
      subtitle: '',
      body: '',
      fields: [],
      industries: [],
    })
  }

  function closeModal() { setEditing(null); setIsNew(false) }

  async function saveCard() {
    if (!editing) return
    setSaving(true)
    try {
      const payload = {
        flow_type: selectedFlow,
        step_number: parseInt(editing.step_number) || cards.length + 1,
        question: (editing.card_title || 'Untitled').trim(),
        card_title: (editing.card_title || 'Untitled').trim(),
        card_type: editing.card_type,
        subtitle: (editing.subtitle || '').trim() || null,
        body: (editing.body || '').trim() || null,
        field_type: 'composite',
        fields: (editing.fields || []).map(normalizeField),
        industries: editing.industries || [],
        required: false,
        options: [],
      }
      if (!isNew && editing.id) {
        const { error } = await supabase.from('wizard_steps').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('wizard_steps').insert([payload])
        if (error) throw error
      }
      await fetchCards()
      closeModal()
    } catch (err) {
      console.error('saveCard:', err)
      alert(err.message || 'Failed to save card')
    } finally {
      setSaving(false)
    }
  }

  function normalizeField(f) {
    const type = f.type || 'text'
    return {
      key: f.key || slugify(f.label),
      label: f.label || '',
      type,
      required: !!f.required,
      placeholder: f.placeholder || '',
      options: hasOptions(type) ? normOpts(f.options).filter(o => o.label.trim()).map(o => ({ label: o.label.trim(), enabled: o.enabled !== false })) : isTheme(type) ? (Array.isArray(f.options) && f.options.length ? f.options : themeKeys()) : [],
    }
  }

  async function deleteCard() {
    if (!editing?.id) { closeModal(); return }
    if (!confirm('Delete this card?')) return
    const { error } = await supabase.from('wizard_steps').delete().eq('id', editing.id)
    if (error) { alert(error.message); return }
    await fetchCards()
    closeModal()
  }

  async function moveCard(card, dir) {
    const idx = cards.findIndex(c => c.id === card.id)
    const swapWith = cards[idx + dir]
    if (!swapWith) return
    await Promise.all([
      supabase.from('wizard_steps').update({ step_number: swapWith.step_number }).eq('id', card.id),
      supabase.from('wizard_steps').update({ step_number: card.step_number }).eq('id', swapWith.id),
    ])
    fetchCards()
  }

  // ── Field editor helpers (operate on the working copy) ──
  const setField = (i, patch) => setEditing(e => ({ ...e, fields: e.fields.map((f, idx) => idx === i ? { ...f, ...patch } : f) }))
  const addField = () => setEditing(e => ({ ...e, fields: [...(e.fields || []), { key: '', label: '', type: 'text', required: false, placeholder: '', options: [] }] }))
  const removeField = (i) => setEditing(e => ({ ...e, fields: e.fields.filter((_, idx) => idx !== i) }))
  const moveField = (i, dir) => setEditing(e => {
    const arr = [...e.fields]; const j = i + dir
    if (j < 0 || j >= arr.length) return e
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return { ...e, fields: arr }
  })
  const setOption = (i, j, patch) => setEditing(e => ({ ...e, fields: e.fields.map((f, idx) => idx === i ? { ...f, options: normOpts(f.options).map((o, oj) => oj === j ? { ...o, ...patch } : o) } : f) }))
  const addOption = (i) => setEditing(e => ({ ...e, fields: e.fields.map((f, idx) => idx === i ? { ...f, options: [...normOpts(f.options), { label: '', enabled: true }] } : f) }))
  const removeOption = (i, j) => setEditing(e => ({ ...e, fields: e.fields.map((f, idx) => idx === i ? { ...f, options: normOpts(f.options).filter((_, oj) => oj !== j) } : f) }))
  const moveOption = (i, j, dir) => setEditing(e => ({ ...e, fields: e.fields.map((f, idx) => { if (idx !== i) return f; const opts = normOpts(f.options); const k = j + dir; if (k < 0 || k >= opts.length) return f; const t = opts[j]; opts[j] = opts[k]; opts[k] = t; return { ...f, options: opts } }) }))
  const sortOptions = (i) => setEditing(e => ({ ...e, fields: e.fields.map((f, idx) => { if (idx !== i) return f; const isOther = (l) => /^(other|none)$/i.test((l || '').trim()); const opts = normOpts(f.options).slice().sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })).sort((a, b) => (isOther(a.label) ? 1 : 0) - (isOther(b.label) ? 1 : 0)); return { ...f, options: opts } }) }))
  const toggleTheme = (i, key) => setEditing(e => ({ ...e, fields: e.fields.map((f, idx) => { if (idx !== i) return f; const cur = Array.isArray(f.options) && f.options.length ? f.options : themeKeys(); const has = cur.includes(key); return { ...f, options: has ? cur.filter(k => k !== key) : [...cur, key] } }) }))
  const toggleIndustry = (ind) => setEditing(e => {
    const has = (e.industries || []).includes(ind)
    return { ...e, industries: has ? e.industries.filter(x => x !== ind) : [...(e.industries || []), ind] }
  })

  const editTypeInfo = editing ? cardTypeInfo(editing.card_type) : null

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Wizard Builder</h1>
          <p className="text-slate-400 text-sm mt-1">Design each onboarding flow as a sequence of cards. Click a card to edit its fields.</p>
        </div>
        <button
          onClick={() => window.open('/onboard?test=true', '_blank')}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          Test Wizard
        </button>
      </div>

      {/* Two-dropdown selector */}
      <div className="bg-[#0D1424] border border-white/10 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Flow group</label>
            <select
              value={category}
              onChange={e => switchCategory(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-blue"
            >
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Flow</label>
            <select
              value={selectedFlow}
              onChange={e => setSelectedFlow(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-blue"
            >
              {flowsInCategory.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-3">{flowInfo?.desc}</p>
      </div>

      {/* Flow header + add */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">{flowInfo?.label} Flow</h2>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-slate-400">{cards.length} cards</span>
          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${category === 'team' ? 'border-white/20 text-slate-400' : 'border-white/10 text-slate-500'}`}>
            {category === 'team' ? 'Internal' : 'Customer'}
          </span>
        </div>
        <button onClick={openNewCard} className="bg-brand-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Add Card
        </button>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading cards...</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          No cards yet — click <strong className="text-white">+ Add Card</strong> to start this flow.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((card, idx) => {
            const ti = cardTypeInfo(card.card_type)
            const scoped = (card.industries || []).length > 0
            return (
              <div
                key={card.id}
                onClick={() => openCard(card)}
                className="group bg-[#0D1424] border border-white/10 hover:border-brand-blue/50 rounded-xl p-4 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">{idx + 1}</span>
                    <span className="text-white font-semibold truncate">{card.card_title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); moveCard(card, -1) }} disabled={idx === 0} className="w-6 h-6 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 text-xs">↑</button>
                    <button onClick={e => { e.stopPropagation(); moveCard(card, 1) }} disabled={idx === cards.length - 1} className="w-6 h-6 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 text-xs">↓</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${ti.dot}`}></span>{ti.label}
                  </span>
                  {ti.hasFields && <span className="text-[11px] text-slate-500">· {(card.fields || []).length} fields</span>}
                </div>
                {card.subtitle && <p className="text-slate-500 text-xs mb-2 line-clamp-2">{card.subtitle}</p>}
                {scoped && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[10px] text-amber-400/90 border border-amber-500/20 bg-amber-500/10 rounded px-1.5 py-0.5">
                      Only: {card.industries.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Card editor modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 p-3 sm:p-6 overflow-y-auto" onClick={closeModal}>
          <div
            className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl mx-auto my-4"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={closeModal} className="absolute top-3 right-4 text-slate-500 hover:text-white text-3xl leading-none">×</button>

            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-white font-semibold text-lg pr-8">{isNew ? 'New Card' : 'Edit Card'}</h3>
                <p className="text-slate-500 text-xs mt-0.5">Card {editing.step_number} of the {flowInfo?.label} flow</p>
              </div>

              {/* Title + type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Card title</label>
                  <input
                    value={editing.card_title}
                    onChange={e => setEditing(s => ({ ...s, card_title: e.target.value }))}
                    placeholder="e.g. Company Information"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-blue"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Card type</label>
                  <select
                    value={editing.card_type}
                    onChange={e => setEditing(s => ({ ...s, card_type: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-blue"
                  >
                    {CARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-xs mb-1 block">Subtitle (optional)</label>
                <input
                  value={editing.subtitle}
                  onChange={e => setEditing(s => ({ ...s, subtitle: e.target.value }))}
                  placeholder="Short helper line under the title"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-blue"
                />
              </div>

              {/* Body — for content cards */}
              {editTypeInfo?.hasBody && (
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Body content {editing.card_type === 'welcome' ? '(welcome + product info shown to the customer)' : '(message shown to the customer)'}</label>
                  <textarea
                    value={editing.body}
                    onChange={e => setEditing(s => ({ ...s, body: e.target.value }))}
                    rows={5}
                    placeholder="Text shown to the customer on this card..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-blue resize-y"
                  />
                </div>
              )}

              {/* Fields editor */}
              {editTypeInfo?.hasFields && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-300 text-sm font-medium">Fields on this card</label>
                    <button onClick={addField} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 px-3 py-1.5 rounded-lg transition-colors">+ Add field</button>
                  </div>
                  {(editing.fields || []).length === 0 ? (
                    <p className="text-slate-500 text-xs py-3 text-center border border-dashed border-white/10 rounded-lg">No fields yet. Add Name, Email, Phone, Revenue, Date, and more.</p>
                  ) : (
                    <div className="space-y-3">
                      {editing.fields.map((f, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                            <input
                              value={f.label}
                              onChange={e => setField(i, { label: e.target.value, key: slugify(e.target.value) })}
                              placeholder="Field label (e.g. Annual Revenue)"
                              className="sm:col-span-6 w-full bg-slate-800 border border-white/10 rounded px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-brand-blue"
                            />
                            <select
                              value={f.type}
                              onChange={e => setField(i, { type: e.target.value })}
                              className="sm:col-span-4 w-full bg-slate-800 border border-white/10 rounded px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-brand-blue"
                            >
                              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <div className="sm:col-span-2 flex items-center justify-end gap-1">
                              <button onClick={() => moveField(i, -1)} disabled={i === 0} className="w-7 h-7 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 text-xs">↑</button>
                              <button onClick={() => moveField(i, 1)} disabled={i === editing.fields.length - 1} className="w-7 h-7 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 text-xs">↓</button>
                              <button onClick={() => removeField(i)} className="w-7 h-7 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs">×</button>
                            </div>
                          </div>
                          {hasOptions(f.type) && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-500">Options — uncheck to unpublish, × to remove</span>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => sortOptions(i)} className="text-[11px] text-slate-400 hover:text-white">Sort A-Z</button>
                                  <button onClick={() => addOption(i)} className="text-[11px] text-brand-blue hover:text-blue-400">+ Add option</button>
                                </div>
                              </div>
                              {normOpts(f.options).length === 0 ? (
                                <p className="text-[11px] text-slate-600">No options yet. Click + Add option.</p>
                              ) : (
                                <div className="space-y-1">
                                  {normOpts(f.options).map((o, j) => (
                                    <div key={j} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={o.enabled !== false}
                                        onChange={e => setOption(i, j, { enabled: e.target.checked })}
                                        className="rounded shrink-0"
                                        title={o.enabled !== false ? 'Published — uncheck to hide from the live wizard' : 'Hidden from the live wizard'}
                                      />
                                      <input
                                        value={o.label}
                                        onChange={e => setOption(i, j, { label: e.target.value })}
                                        placeholder="Option label"
                                        className={`flex-1 bg-slate-800 border border-white/10 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-brand-blue ${o.enabled !== false ? 'text-white' : 'text-slate-500 line-through'}`}
                                      />
                                      <button onClick={() => moveOption(i, j, -1)} disabled={j === 0} className="w-6 h-6 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 text-xs shrink-0">↑</button>
                                      <button onClick={() => moveOption(i, j, 1)} disabled={j === normOpts(f.options).length - 1} className="w-6 h-6 rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 text-xs shrink-0">↓</button>
                                      <button onClick={() => removeOption(i, j)} className="w-6 h-6 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs shrink-0">×</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {isTheme(f.type) && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] text-slate-500">Theme library — the customer picks one. Uncheck to hide a theme.</span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {THEME_LIBRARY.map(t => {
                                  const on = (Array.isArray(f.options) && f.options.length ? f.options : themeKeys()).includes(t.key)
                                  return (
                                    <button key={t.key} type="button" onClick={() => toggleTheme(i, t.key)} className={`text-left rounded-lg border p-2 transition-colors ${on ? 'border-brand-blue bg-brand-blue/5' : 'border-white/10 opacity-50 hover:opacity-100'}`}>
                                      <div className="flex gap-1 mb-1">
                                        {t.colors.map((c, ci) => <span key={ci} className="w-4 h-4 rounded-sm border border-black/20" style={{ backgroundColor: c }} />)}
                                      </div>
                                      <div className="text-[11px] text-slate-300 flex items-center justify-between">{t.name}<span className="text-brand-blue">{on ? '\u2713' : ''}</span></div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 text-slate-400 text-xs cursor-pointer">
                              <input type="checkbox" checked={!!f.required} onChange={e => setField(i, { required: e.target.checked })} className="rounded" />
                              Required
                            </label>
                            {!hasOptions(f.type) && !isTheme(f.type) && f.type !== 'info' && (
                              <input
                                value={f.placeholder || ''}
                                onChange={e => setField(i, { placeholder: e.target.value })}
                                placeholder="Placeholder (optional)"
                                className="flex-1 bg-slate-800 border border-white/10 rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-brand-blue"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Industry scoping (branching) — hidden on the industry picker itself */}
              {editing.card_type !== 'industry' && availableIndustries.length > 0 && (
                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-1">Show this card for…</label>
                  <p className="text-slate-500 text-xs mb-2">Leave all unselected to show for every industry. Select industries to only show this card when one of them is picked.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableIndustries.map(ind => {
                      const on = (editing.industries || []).includes(ind)
                      return (
                        <button
                          key={ind}
                          onClick={() => toggleIndustry(ind)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        >
                          {ind}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                <div>
                  {!isNew && (
                    <button onClick={deleteCard} className="text-red-400 hover:text-red-300 text-sm px-2 py-2 transition-colors">Delete card</button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={closeModal} className="text-slate-400 hover:text-white text-sm px-4 py-2 transition-colors">Cancel</button>
                  <button
                    onClick={saveCard}
                    disabled={saving || !(editing.card_title || '').trim()}
                    className="bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {saving ? 'Saving…' : isNew ? 'Add Card' : 'Save Card'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
