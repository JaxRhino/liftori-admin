// ============================================================
// CrmSettings.jsx — /crm/:platformId/settings
// Tenant-scoped Settings home for a LABOS client. Tabs:
// Reports, Estimate Templates, Email Templates, Automations,
// Business. All data reads/writes go through the tenant's own
// Supabase client (useCrm().client), NOT the main Liftori DB.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { useCrm } from '../../contexts/CrmContext'

const TABS = [
  { key: 'reports',    label: 'Reports' },
  { key: 'estimates',  label: 'Estimate Templates' },
  { key: 'pricing',    label: 'Estimate Pricing' },
  { key: 'emails',     label: 'Email Templates' },
  { key: 'automations',label: 'Automations' },
  { key: 'business',   label: 'Business' },
]

export default function CrmSettings() {
  const { client, orgSettings } = useCrm()
  const [tab, setTab] = useState('reports')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">
          Reports, templates and automations for your business — plus your org details.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-navy-700/40">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!client ? (
        <Panel>Connecting to your workspace…</Panel>
      ) : (
        <>
          {tab === 'reports'     && <ReportsTab client={client} />}
          {tab === 'estimates'   && <EstimateTemplatesTab client={client} />}
          {tab === 'pricing'     && <EstimatePricingTab client={client} />}
          {tab === 'emails'      && <EmailTemplatesTab client={client} />}
          {tab === 'automations' && <AutomationsTab client={client} />}
          {tab === 'business'    && <BusinessTab orgSettings={orgSettings} />}
        </>
      )}
    </div>
  )
}

// ---------- shared bits ----------
function EstimatePricingTab({ client }) {
  const [settings, setSettings] = useState(null)
  const [products, setProducts] = useState([])
  const [deletedIds, setDeletedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  async function load() {
    try {
      setLoading(true)
      let { data: s } = await client.from('estimate_settings').select('*').limit(1).maybeSingle()
      if (!s) { const ins = await client.from('estimate_settings').insert({ default_gross_margin: 50, minimum_price: 0, default_tax_rate: 0 }).select().single(); s = ins.data }
      setSettings(s)
      const { data: p } = await client.from('estimate_products').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      setProducts(p || [])
      setDeletedIds([])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  function setS(k, v) { setSaved(false); setSettings(s => ({ ...s, [k]: v })) }
  function setP(i, k, v) { setSaved(false); setProducts(ps => ps.map((p, j) => j === i ? { ...p, [k]: v } : p)) }
  function addP() { setSaved(false); setProducts(ps => [...ps, { _tmp: Math.random().toString(36).slice(2, 10), name: '', item_type: 'material', cost: 0, markup_percent: 0, unit: '', in_default_template: false, is_active: true }]) }
  function removeP(i) { setSaved(false); setProducts(ps => { const t = ps[i]; if (t && t.id) setDeletedIds(d => [...d, t.id]); return ps.filter((_, j) => j !== i) }) }

  async function save() {
    if (!settings) return
    try {
      setSaving(true)
      await client.from('estimate_settings').update({
        default_gross_margin: Number(settings.default_gross_margin) || 0,
        minimum_price: Number(settings.minimum_price) || 0,
        default_tax_rate: Number(settings.default_tax_rate) || 0,
        labor_rate: Number(settings.labor_rate) || 0,
        updated_at: new Date().toISOString(),
      }).eq('id', settings.id)

      if (deletedIds.length) await client.from('estimate_products').delete().in('id', deletedIds)

      const rows = products.map((p, idx) => ({
        id: p.id, name: p.name || '', description: p.description || null,
        item_type: p.item_type === 'labor' ? 'labor' : 'material', cost: Number(p.cost) || 0,
        markup_percent: Number(p.markup_percent) || 0, unit: p.unit || null,
        in_default_template: !!p.in_default_template, is_active: p.is_active !== false,
        sort_order: idx, updated_at: new Date().toISOString(),
      }))
      for (const r of rows.filter(r => r.id)) { const { id, ...rest } = r; await client.from('estimate_products').update(rest).eq('id', id) }
      const toInsert = rows.filter(r => !r.id).map(({ id, ...rest }) => rest)
      if (toInsert.length) await client.from('estimate_products').insert(toInsert)

      await load()
      setSaved(true)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  if (loading || !settings) return <div className="text-gray-400 text-sm py-8">Loading…</div>

  const fmt = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const price = (p) => (Number(p.cost) || 0) * (1 + (Number(p.markup_percent) || 0) / 100)
  const inputCls = "w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
  const labelCls = "block text-xs text-gray-400 mb-1"

  return (
    <div className="max-w-4xl space-y-5">
      <div className="bg-navy-900 border border-navy-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-3">Defaults</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><label className={labelCls}>Default Gross Margin (%)</label><input type="number" value={settings.default_gross_margin ?? ''} onChange={(e) => setS('default_gross_margin', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Company Minimum ($)</label><input type="number" value={settings.minimum_price ?? ''} onChange={(e) => setS('minimum_price', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Labor Rate ($/hr)</label><input type="number" value={settings.labor_rate ?? ''} onChange={(e) => setS('labor_rate', e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Default Tax Rate (%)</label><input type="number" value={settings.default_tax_rate ?? ''} onChange={(e) => setS('default_tax_rate', e.target.value)} className={inputCls} /></div>
        </div>
      </div>

      <div className="bg-navy-900 border border-navy-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-semibold">Products & Services</h3>
            <p className="text-gray-400 text-xs">Your price book. Set cost + markup to get price. Check Default to include an item on every new estimate.</p>
          </div>
          <button onClick={addP} className="text-xs text-brand-blue hover:text-brand-light">+ Add item</button>
        </div>

        {products.length === 0 && <div className="text-gray-500 text-sm py-4">No products or services yet. Add your first one.</div>}

        {products.length > 0 && (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] text-gray-500 px-1">
              <span className="col-span-3">Name</span><span className="col-span-2">Type</span><span className="col-span-1">Unit</span><span className="col-span-2 text-right">Cost</span><span className="col-span-1 text-right">Markup %</span><span className="col-span-2 text-right">Price</span><span className="col-span-1 text-center">Default</span>
            </div>
            {products.map((p, i) => (
              <div key={p.id || p._tmp} className="grid grid-cols-12 gap-2 items-center">
                <input value={p.name} onChange={(e) => setP(i, 'name', e.target.value)} placeholder="Item name" className="col-span-3 bg-navy-950 border border-navy-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-500" />
                <div className="col-span-2 flex gap-1">
                  <button onClick={() => setP(i, 'item_type', 'material')} className={'flex-1 px-2 py-1.5 rounded text-xs ' + (p.item_type !== 'labor' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400')}>Material</button>
                  <button onClick={() => setP(i, 'item_type', 'labor')} className={'flex-1 px-2 py-1.5 rounded text-xs ' + (p.item_type === 'labor' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400')}>Labor</button>
                </div>
                <input value={p.unit || ''} onChange={(e) => setP(i, 'unit', e.target.value)} placeholder="ea" className="col-span-1 bg-navy-950 border border-navy-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-500" />
                <input type="number" value={p.cost ?? ''} onChange={(e) => setP(i, 'cost', e.target.value)} className="col-span-2 bg-navy-950 border border-navy-700 rounded-lg px-2 py-1.5 text-sm text-white text-right" />
                <input type="number" value={p.markup_percent ?? ''} onChange={(e) => setP(i, 'markup_percent', e.target.value)} className="col-span-1 bg-navy-950 border border-navy-700 rounded-lg px-2 py-1.5 text-sm text-white text-right" />
                <span className="col-span-2 text-right text-sm text-white font-medium">{fmt(price(p))}</span>
                <div className="col-span-1 flex items-center justify-center gap-2">
                  <input type="checkbox" checked={!!p.in_default_template} onChange={(e) => setP(i, 'in_default_template', e.target.checked)} className="accent-brand-blue" title="Add to default estimate template" />
                  <button onClick={() => removeP(i)} className="text-gray-500 hover:text-red-400 text-sm">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium">{saving ? 'Saving…' : 'Save Pricing'}</button>
        {saved && <span className="text-emerald-400 text-sm">Saved</span>}
      </div>
    </div>
  )
}

function Panel({ children }) {
  return (
    <div className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-10 text-center text-gray-500">
      {children}
    </div>
  )
}
function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-navy-700/50 bg-navy-800/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: accent || '#f1f5f9' }}>{value}</p>
    </div>
  )
}
function Chip({ children, color }) {
  return (
    <span
      className="rounded-full border bg-navy-900/40 px-2 py-0.5 text-[10px] uppercase tracking-wider"
      style={{ borderColor: (color || '#475569') + '60', color: color || '#94a3b8' }}
    >{children}</span>
  )
}

// ---------- Reports ----------
const REPORT_CATS = [
  { key: 'all', label: 'All', color: '#94a3b8' },
  { key: 'favorite', label: 'Favorites', color: '#fbbf24' },
  { key: 'sales', label: 'Sales', color: '#06b6d4' },
  { key: 'finance', label: 'Finance', color: '#10b981' },
  { key: 'marketing', label: 'Marketing', color: '#a855f7' },
  { key: 'ops', label: 'Ops', color: '#f59e0b' },
  { key: 'executive', label: 'Executive', color: '#ef4444' },
]
const VIZ_ICON = { table: '☷', bar: '▮', line: '⌇', pie: '◔', number: '#', funnel: '⌒', heatmap: '▤' }

function ReportsTab({ client }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await client
        .from('crm_reports').select('*')
        .order('is_favorite', { ascending: false })
        .order('updated_at', { ascending: false })
      if (!cancelled) {
        if (error) console.warn('reports load', error)
        setReports(data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [client])

  const filtered = useMemo(() => (reports || []).filter(r => {
    if (cat === 'favorite' && !r.is_favorite) return false
    if (cat !== 'all' && cat !== 'favorite' && r.category !== cat) return false
    if (q && !`${r.name} ${r.description || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [reports, cat, q])

  const counts = useMemo(() => ({
    total: reports.length,
    favorites: reports.filter(r => r.is_favorite).length,
    scheduled: reports.filter(r => r.is_scheduled).length,
  }), [reports])

  async function toggleFavorite(r) {
    const next = !r.is_favorite
    setReports(prev => prev.map(x => x.id === r.id ? { ...x, is_favorite: next } : x))
    await client.from('crm_reports').update({ is_favorite: next }).eq('id', r.id)
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Saved reports" value={counts.total} />
        <Stat label="Favorites" value={counts.favorites} accent="#fbbf24" />
        <Stat label="Scheduled" value={counts.scheduled} accent="#10b981" />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {REPORT_CATS.map(c => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              cat === c.key ? 'border-transparent bg-brand-blue text-white'
              : 'border-navy-700/60 bg-navy-800/40 text-gray-300 hover:text-brand-blue'}`}
            style={cat === c.key ? {} : { borderLeftColor: c.color, borderLeftWidth: 3 }}>
            {c.label}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search reports..."
          className="ml-auto w-64 rounded-md border border-navy-700/60 bg-navy-900/60 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-blue focus:outline-none" />
      </div>
      {loading ? <Panel>Loading reports…</Panel>
        : filtered.length === 0 ? <Panel>No reports match. Try a different category or clear search.</Panel>
        : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(r => (
              <article key={r.id} className="group rounded-xl border border-navy-700/50 bg-navy-800/60 p-4 transition hover:border-brand-blue/40">
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-900/60 text-base text-brand-blue">{VIZ_ICON[r.visualization] || '◇'}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-100">{r.name}</h3>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">{r.category || 'general'} · {r.visualization}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleFavorite(r)} className="text-base" style={{ color: r.is_favorite ? '#fbbf24' : '#475569' }} title={r.is_favorite ? 'Unstar' : 'Star'}>★</button>
                </header>
                {r.description && <p className="mb-3 line-clamp-2 text-xs text-gray-400">{r.description}</p>}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {r.source_table && <Chip>{r.source_table.replace(/_/g, ' ')}</Chip>}
                  {r.date_range && <Chip>{r.date_range.replace(/_/g, ' ')}</Chip>}
                  {r.is_scheduled && <Chip color="#10b981">scheduled</Chip>}
                </div>
              </article>
            ))}
          </div>
        )}
    </>
  )
}

// ---------- Estimate Templates ----------
const INDUSTRY_LABEL = {
  hvac: 'HVAC', plumbing: 'Plumbing', roofing: 'Roofing', cleaning: 'Cleaning',
  landscaping: 'Landscaping', electrical: 'Electrical', pest: 'Pest Control',
  pool: 'Pool Services', it: 'IT / MSP', consulting: 'Consulting', general: 'General',
}

function EstimateTemplatesTab({ client }) {
  const [templates, setTemplates] = useState([])
  const [items, setItems] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [industry, setIndustry] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data } = await client.from('estimate_templates').select('*')
        .order('industry', { ascending: true }).order('name', { ascending: true })
      if (!cancelled) { setTemplates(data || []); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [client])

  async function loadItems(id) {
    if (items[id]) return
    const { data } = await client.from('estimate_template_items').select('*').eq('template_id', id).order('step_order')
    setItems(prev => ({ ...prev, [id]: data || [] }))
  }
  function handleExpand(id) { setExpanded(expanded === id ? null : id); loadItems(id) }

  const filtered = useMemo(() => (templates || []).filter(t => {
    if (industry !== 'all' && t.industry !== industry) return false
    if (q && !`${t.name} ${t.description || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [templates, industry, q])

  const industries = useMemo(() => {
    const set = new Set(templates.map(t => t.industry).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [templates])

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {industries.map(ind => (
          <button key={ind} onClick={() => setIndustry(ind)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              industry === ind ? 'border-transparent bg-brand-blue text-white'
              : 'border-navy-700/60 bg-navy-800/40 text-gray-300 hover:text-brand-blue'}`}>
            {ind === 'all' ? 'All' : (INDUSTRY_LABEL[ind] || ind)}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates..."
          className="ml-auto w-64 rounded-md border border-navy-700/60 bg-navy-900/60 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-blue focus:outline-none" />
      </div>
      {loading ? <Panel>Loading templates…</Panel>
        : filtered.length === 0 ? <Panel>No templates yet.</Panel>
        : (
          <div className="space-y-3">
            {filtered.map(t => {
              const open = expanded === t.id
              const list = items[t.id] || []
              const total = list.filter(i => !i.is_optional).reduce((a, i) => a + (Number(i.quantity) * Number(i.unit_price)), 0)
              return (
                <article key={t.id} className="rounded-xl border border-navy-700/50 bg-navy-800/60">
                  <button onClick={() => handleExpand(t.id)} className="flex w-full items-start justify-between gap-4 p-4 text-left transition hover:bg-navy-800/80">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-100">{t.name}</h3>
                        {t.industry && <Chip color="#06b6d4">{INDUSTRY_LABEL[t.industry] || t.industry}</Chip>}
                        {t.service_type && <Chip>{t.service_type}</Chip>}
                      </div>
                      {t.description && <p className="mt-1 text-xs text-gray-400">{t.description}</p>}
                      <p className="mt-2 text-[11px] text-gray-500">
                        Used {t.usage_count || 0} times{t.default_validity_days ? ` · Valid ${t.default_validity_days}d` : ''}{t.default_tax_rate != null ? ` · Tax ${(Number(t.default_tax_rate) * 100).toFixed(1)}%` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-2xl text-gray-500">{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <div className="border-t border-navy-700/40 p-4">
                      {list.length === 0 ? <p className="py-4 text-center text-xs text-gray-500">No line items.</p>
                        : (
                          <table className="w-full text-xs">
                            <thead className="text-[10px] uppercase tracking-wider text-gray-500">
                              <tr><th className="px-2 py-2 text-left">Item</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Unit</th><th className="px-2 py-2 text-right">Price</th><th className="px-2 py-2 text-right">Total</th></tr>
                            </thead>
                            <tbody>
                              {list.map(li => (
                                <tr key={li.id} className={`border-t border-navy-700/30 ${li.is_optional ? 'opacity-60' : ''}`}>
                                  <td className="px-2 py-2 text-gray-200">
                                    <div className="font-medium">{li.name}</div>
                                    {li.is_optional && <div className="text-[10px] text-amber-400">optional</div>}
                                  </td>
                                  <td className="px-2 py-2 text-right text-gray-300">{Number(li.quantity)}</td>
                                  <td className="px-2 py-2 text-right text-gray-400">{li.unit}</td>
                                  <td className="px-2 py-2 text-right text-gray-300">${Number(li.unit_price).toFixed(2)}</td>
                                  <td className="px-2 py-2 text-right text-gray-100">${(Number(li.quantity) * Number(li.unit_price)).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-navy-700/50"><td colSpan={4} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-gray-500">Required subtotal</td><td className="px-2 py-2 text-right text-sm font-semibold text-brand-blue">${total.toFixed(2)}</td></tr>
                            </tfoot>
                          </table>
                        )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
    </>
  )
}

// ---------- Email Templates ----------
const CHANNEL_COLOR = { email: '#06b6d4', sms: '#10b981', call_script: '#a855f7' }
const CHANNEL_ICON = { email: '✉', sms: '✆', call_script: '☎' }

function EmailTemplatesTab({ client }) {
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [sequences, setSequences] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('templates')
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [tplRes, catRes, seqRes] = await Promise.all([
        client.from('comms_templates').select('*').order('usage_count', { ascending: false }),
        client.from('comms_template_categories').select('*').order('display_order'),
        client.from('email_sequences').select('*').order('status').order('updated_at', { ascending: false }),
      ])
      if (!cancelled) {
        setTemplates(tplRes.data || [])
        setCategories(catRes.data || [])
        setSequences(seqRes.data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [client])

  const filtered = useMemo(() => (templates || []).filter(t => {
    if (cat !== 'all' && t.category !== cat) return false
    if (q && !`${t.name} ${t.subject || ''} ${t.body || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [templates, cat, q])

  return (
    <>
      <div className="mb-5 flex items-center gap-2 border-b border-navy-700/40">
        {['templates', 'sequences'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            {t === 'templates' ? `Templates (${templates.length})` : `Sequences (${sequences.length})`}
          </button>
        ))}
      </div>

      {tab === 'templates' && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button onClick={() => setCat('all')}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${cat === 'all' ? 'border-transparent bg-brand-blue text-white' : 'border-navy-700/60 bg-navy-800/40 text-gray-300 hover:text-brand-blue'}`}>All</button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCat(c.name)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${cat === c.name ? 'border-transparent bg-brand-blue text-white' : 'border-navy-700/60 bg-navy-800/40 text-gray-300 hover:text-brand-blue'}`}
                style={cat === c.name ? {} : { borderLeftColor: c.color || '#64748b', borderLeftWidth: 3 }}>{c.name}</button>
            ))}
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates..."
              className="ml-auto w-64 rounded-md border border-navy-700/60 bg-navy-900/60 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-brand-blue focus:outline-none" />
          </div>
          {loading ? <Panel>Loading templates…</Panel>
            : filtered.length === 0 ? <Panel>No templates yet.</Panel>
            : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map(t => (
                  <article key={t.id} onClick={() => setPreview(t)} className="cursor-pointer rounded-xl border border-navy-700/50 bg-navy-800/60 p-4 transition hover:border-brand-blue/40">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md text-sm" style={{ background: (CHANNEL_COLOR[t.channel_type] || '#64748b') + '20', color: CHANNEL_COLOR[t.channel_type] || '#64748b' }}>{CHANNEL_ICON[t.channel_type] || '◇'}</span>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-100">{t.name}</h3>
                          <p className="text-[10px] uppercase tracking-wider text-gray-500">{t.channel_type} · {t.category || 'general'}</p>
                        </div>
                      </div>
                      {t.is_active
                        ? <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-300">live</span>
                        : <span className="rounded-full border border-navy-700/60 px-2 py-0.5 text-[10px] uppercase text-gray-500">draft</span>}
                    </div>
                    {t.subject && <p className="mb-1 truncate text-xs text-gray-200">{t.subject}</p>}
                    <p className="line-clamp-3 text-[11px] text-gray-500">{t.body}</p>
                  </article>
                ))}
              </div>
            )}
        </>
      )}

      {tab === 'sequences' && (
        <div className="space-y-2">
          {sequences.map(s => (
            <article key={s.id} className="rounded-lg border border-navy-700/50 bg-navy-800/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-100">{s.name}</h3>
                <Chip color={s.status === 'active' ? '#10b981' : '#94a3b8'}>{s.status}</Chip>
              </div>
              {s.description && <p className="mt-1 text-xs text-gray-400">{s.description}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
                <span>{s.total_enrolled || 0} enrolled</span>
                <span>{s.total_completed || 0} completed</span>
                <span style={{ color: '#06b6d4' }}>{s.total_replied || 0} replied</span>
              </div>
            </article>
          ))}
          {sequences.length === 0 && <Panel>No sequences yet.</Panel>}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-navy-700/50 bg-navy-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">{preview.name}</h2>
                <p className="text-xs text-gray-500">{preview.channel_type} · {preview.category}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-500 hover:text-gray-200">✕</button>
            </div>
            {preview.subject && (
              <div className="mb-3 rounded-md border border-navy-700/50 bg-navy-800/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Subject</p>
                <p className="mt-0.5 text-sm text-gray-100">{preview.subject}</p>
              </div>
            )}
            <div className="rounded-md border border-navy-700/50 bg-navy-800/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Body</p>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-gray-200">{preview.body}</pre>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- Automations ----------
const STATUS_COLOR = { active: '#10b981', draft: '#94a3b8', paused: '#f59e0b' }
const TRIGGER_LABEL = {
  record_created: 'When a record is created', record_updated: 'When a record is updated',
  record_stage_changed: 'When stage changes', scheduled: 'On a schedule', webhook: 'When webhook fires',
  form_submitted: 'When form is submitted', email_replied: 'When email is replied to', no_activity: 'When activity goes quiet',
}

function AutomationsTab({ client }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await client.from('crm_automations').select('*')
        .order('status', { ascending: true }).order('created_at', { ascending: false })
      if (!cancelled) {
        if (error) console.warn('automations load', error)
        setItems(data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [client])

  const filtered = useMemo(() => filter === 'all' ? items : items.filter(i => i.status === filter), [items, filter])
  const counts = useMemo(() => ({
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    draft: items.filter(i => i.status === 'draft').length,
    runs: items.reduce((a, i) => a + (i.total_runs || 0), 0),
  }), [items])

  async function toggleStatus(item) {
    const next = item.status === 'active' ? 'paused' : 'active'
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: next } : x))
    await client.from('crm_automations').update({ status: next }).eq('id', item.id)
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-4 gap-3">
        <Stat label="Total" value={counts.total} />
        <Stat label="Active" value={counts.active} accent="#10b981" />
        <Stat label="Drafts" value={counts.draft} accent="#94a3b8" />
        <Stat label="Total runs" value={counts.runs} accent="#06b6d4" />
      </div>
      <div className="mb-4 flex items-center gap-2">
        {['all', 'active', 'draft', 'paused'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === s ? 'border-transparent bg-brand-blue text-white' : 'border-navy-700/60 bg-navy-800/40 text-gray-300 hover:text-brand-blue'}`}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <Panel>Loading automations…</Panel>
        : filtered.length === 0 ? <Panel>No automations in this view yet.</Panel>
        : (
          <div className="space-y-2">
            {filtered.map(a => {
              const successPct = a.total_runs > 0 ? Math.round((a.success_runs / a.total_runs) * 100) : null
              return (
                <article key={a.id} className="rounded-lg border border-navy-700/50 bg-navy-800/60 p-4 transition hover:border-brand-blue/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-100">{a.name}</h3>
                        <Chip color={STATUS_COLOR[a.status]}>{a.status}</Chip>
                        {a.is_ai_assisted && <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-purple-300">✨ AI</span>}
                      </div>
                      {a.description && <p className="mt-1 text-xs text-gray-400">{a.description}</p>}
                      <p className="mt-2 text-[11px] text-gray-500">
                        <span className="text-gray-400">{TRIGGER_LABEL[a.trigger_type] || a.trigger_type}</span>
                        {a.trigger_table && <> on <code className="rounded bg-navy-900/60 px-1 py-0.5 text-[10px]">{a.trigger_table}</code></>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-100">{a.total_runs || 0} runs</p>
                        {successPct !== null && <p className="text-[10px]" style={{ color: successPct >= 95 ? '#10b981' : successPct >= 80 ? '#f59e0b' : '#ef4444' }}>{successPct}% success</p>}
                      </div>
                      <button onClick={() => toggleStatus(a)} className="rounded-md border border-navy-700/60 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition hover:border-brand-blue/40 hover:text-brand-blue">
                        {a.status === 'active' ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
    </>
  )
}

// ---------- Business (org settings, read-only summary) ----------
function BusinessTab({ orgSettings }) {
  if (!orgSettings) return <Panel>No business details on file yet.</Panel>
  const rows = [
    ['Business name', orgSettings.business_name],
    ['Industry', orgSettings.industry],
    ['Email', orgSettings.contact_email || orgSettings.email],
    ['Phone', orgSettings.contact_phone || orgSettings.phone],
    ['Website', orgSettings.website || orgSettings.site_url],
    ['Address', orgSettings.address],
  ].filter(([, v]) => v)
  return (
    <div className="rounded-xl border border-navy-700/50 bg-navy-800/60 divide-y divide-navy-700/40">
      {rows.length === 0 ? <div className="p-6 text-center text-sm text-gray-500">No business details on file yet.</div>
        : rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-xs uppercase tracking-wider text-gray-500">{label}</span>
            <span className="text-sm text-gray-100 text-right">{String(value)}</span>
          </div>
        ))}
    </div>
  )
}
