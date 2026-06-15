// ============================================================
// CrmSettings.jsx — /crm/:platformId/settings
// Tenant-scoped Settings home for a LABOS client. Tabs:
// Reports, Estimate Templates, Email Templates, Automations,
// Business. All data reads/writes go through the tenant's own
// Supabase client (useCrm().client), NOT the main Liftori DB.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { useCrm } from '../../contexts/CrmContext'
import { supabase as mainDb } from '../../lib/supabase'
import { toast } from 'sonner'
import BugReportModal from '../../components/crm/BugReportModal'
import { Users, UserCog, Building2, FileText, BarChart3, DollarSign, Zap, Info, FolderOpen, Sparkles, ArrowLeft, LifeBuoy, CreditCard } from 'lucide-react'

const SECTIONS = [
  { key:'company_settings', label:'Company Settings',    desc:'Business name, contact, address, license & tax', icon: Building2 },
  { key:'company_info',     label:'Company Information',  desc:'Branding, notifications & AI preferences',       icon: Info },
  { key:'users',            label:'User Management',      desc:'Invite users and manage access',                 icon: Users },
  { key:'teams',            label:'Team Management',      desc:'Crews, departments & roles',                     icon: UserCog },
  { key:'templates',        label:'Templates',           desc:'Estimate & email templates',                     icon: FileText },
  { key:'pricing',          label:'Pricing',             desc:'Price book & estimate defaults',                 icon: DollarSign },
  { key:'reports',          label:'Reports',             desc:'Saved reports & exports',                        icon: BarChart3 },
  { key:'automations',      label:'Automations',         desc:'Triggers & workflows',                           icon: Zap },
  { key:'docs',             label:'Company Docs',        desc:'Shared company documents',                       icon: FolderOpen },
  { key:'liftori_services', label:'Liftori Services',    desc:'Products, services & support',                   icon: Sparkles },
  { key:'billing',          label:'Billing & Invoices',   desc:'Plan, credits, payments & invoices',             icon: CreditCard },
]

export default function CrmSettings() {
  const { client, orgSettings } = useCrm()
  const [section, setSection] = useState(null)
  useEffect(() => { if (new URLSearchParams(window.location.search).get('credits')) setSection('billing') }, [])
  const active = SECTIONS.find(s => s.key === section)

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        {active && (
          <button onClick={() => setSection(null)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
            <ArrowLeft size={16} /> Settings
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{active ? active.label : 'Settings'}</h1>
          <p className="text-gray-400 text-sm mt-1">{active ? active.desc : 'Manage your company, team, templates, automations and Liftori services.'}</p>
        </div>
      </div>

      {!client ? (
        <Panel>Connecting to your workspace…</Panel>
      ) : !active ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTIONS.map(s => <SettingCard key={s.key} s={s} onClick={() => setSection(s.key)} />)}
        </div>
      ) : (
        <>
          {section === 'company_settings' && <CompanySettingsSection client={client} orgSettings={orgSettings} />}
          {section === 'company_info'     && <CompanyInfoSection client={client} orgSettings={orgSettings} />}
          {section === 'users'            && <UserManagementSection client={client} />}
          {section === 'teams'            && <TeamManagementSection client={client} />}
          {section === 'templates'        && <TemplatesSection client={client} />}
          {section === 'pricing'          && <EstimatePricingTab client={client} />}
          {section === 'reports'          && <ReportsTab client={client} />}
          {section === 'automations'      && <AutomationsTab client={client} />}
          {section === 'docs'             && <CompanyDocsSection client={client} />}
          {section === 'liftori_services' && <LiftoriServicesSection />}
          {section === 'billing'          && <BillingSection />}
        </>
      )}
    </div>
  )
}

function SettingCard({ s, onClick }) {
  const Icon = s.icon
  return (
    <button onClick={onClick} className="text-left rounded-xl border border-navy-700/50 bg-navy-800/60 p-5 hover:border-brand-blue/50 hover:bg-navy-800 transition group">
      <div className="w-11 h-11 rounded-lg bg-brand-blue/15 text-brand-blue flex items-center justify-center mb-3 group-hover:bg-brand-blue/25"><Icon size={20} /></div>
      <div className="text-white font-semibold">{s.label}</div>
      <div className="text-xs text-gray-400 mt-1">{s.desc}</div>
    </button>
  )
}

function LabeledInput({ label, value, onChange, full, type = 'text' }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" />
    </div>
  )
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-navy-700/30 last:border-0 cursor-pointer">
      <span className="text-sm text-gray-200">{label}</span>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
    </label>
  )
}

// ---------- shared bits ----------
const UNIT_OPTIONS = ['ea', 'Ft', 'LF', 'SF', 'SQ', 'SY', 'YD', 'CY', 'Bundle', 'Roll', 'Sheet', 'Box', 'Bag', 'Gal', 'Ton', 'Pallet', 'Hr', 'Day', 'Set', 'Pair'];

function EstimatePricingTab({ client }) {
  const [settings, setSettings] = useState(null)
  const [products, setProducts] = useState([])
  const [deletedIds, setDeletedIds] = useState([])
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
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
  const keyOf = (p) => p.id || p._tmp
  function setP(key, k, v) { setSaved(false); setProducts(ps => ps.map(p => keyOf(p) === key ? { ...p, [k]: v } : p)) }
  function addP() { setSaved(false); const t = typeFilter === 'labor' ? 'labor' : 'material'; setProducts(ps => [...ps, { _tmp: Math.random().toString(36).slice(2, 10), name: '', item_type: t, cost: 0, markup_percent: 0, unit: 'ea', in_default_template: false, is_active: true }]) }
  function removeP(key) { setSaved(false); setProducts(ps => { const t = ps.find(p => keyOf(p) === key); if (t && t.id) setDeletedIds(d => [...d, t.id]); return ps.filter(p => keyOf(p) !== key) }) }

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
  const q = search.trim().toLowerCase()
  const visible = products.filter(p => (typeFilter === 'all' || (typeFilter === 'labor' ? p.item_type === 'labor' : p.item_type !== 'labor')) && (!q || (p.name || '').toLowerCase().includes(q)))
  const filterBtn = (val, lbl) => (
    <button onClick={() => setTypeFilter(val)} className={'px-3 py-1 rounded-full text-xs border ' + (typeFilter === val ? 'border-brand-blue text-brand-blue bg-brand-blue/10' : 'border-navy-700 text-gray-400 hover:text-white')}>{lbl}</button>
  )

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
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div>
            <h3 className="text-white font-semibold">Products & Services</h3>
            <p className="text-gray-400 text-xs">Your price book. Set cost + markup to get price. Check Default to include an item on every new estimate.</p>
          </div>
          <button onClick={addP} className="text-xs text-brand-blue hover:text-brand-light">+ Add item</button>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {filterBtn('all', 'All (' + products.length + ')')}
          {filterBtn('material', 'Materials (' + products.filter(p => p.item_type !== 'labor').length + ')')}
          {filterBtn('labor', 'Labor / Services (' + products.filter(p => p.item_type === 'labor').length + ')')}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="ml-auto bg-navy-950 border border-navy-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 w-48" />
        </div>

        {visible.length === 0 && <div className="text-gray-500 text-sm py-4">{products.length === 0 ? 'No items yet. Add your first one.' : 'No items match.'}</div>}

        {visible.length > 0 && (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] text-gray-500 px-1">
              <span className="col-span-3">Name</span><span className="col-span-2">Type</span><span className="col-span-1">Unit</span><span className="col-span-2 text-right">Cost</span><span className="col-span-1 text-right">Markup %</span><span className="col-span-2 text-right">Price</span><span className="col-span-1 text-center">Default</span>
            </div>
            {visible.map(p => { const key = keyOf(p); return (
              <div key={key} className="grid grid-cols-12 gap-2 items-center">
                <input value={p.name} onChange={(e) => setP(key, 'name', e.target.value)} placeholder="Item name" className="col-span-3 bg-navy-950 border border-navy-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-500" />
                <div className="col-span-2 flex gap-1">
                  <button onClick={() => setP(key, 'item_type', 'material')} className={'flex-1 px-2 py-1.5 rounded text-xs ' + (p.item_type !== 'labor' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400')}>Material</button>
                  <button onClick={() => setP(key, 'item_type', 'labor')} className={'flex-1 px-2 py-1.5 rounded text-xs ' + (p.item_type === 'labor' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400')}>Labor</button>
                </div>
                <select value={p.unit || ''} onChange={(e) => setP(key, 'unit', e.target.value)} className="col-span-1 bg-navy-950 border border-navy-700 rounded-lg px-1 py-1.5 text-sm text-white"><option value="">—</option>{UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}{p.unit && !UNIT_OPTIONS.includes(p.unit) ? <option value={p.unit}>{p.unit}</option> : null}</select>
                <input type="number" value={p.cost ?? ''} onChange={(e) => setP(key, 'cost', e.target.value)} className="col-span-2 bg-navy-950 border border-navy-700 rounded-lg px-2 py-1.5 text-sm text-white text-right" />
                <input type="number" value={p.markup_percent ?? ''} onChange={(e) => setP(key, 'markup_percent', e.target.value)} className="col-span-1 bg-navy-950 border border-navy-700 rounded-lg px-2 py-1.5 text-sm text-white text-right" />
                <span className="col-span-2 text-right text-sm text-white font-medium">{fmt(price(p))}</span>
                <div className="col-span-1 flex items-center justify-center gap-2">
                  <input type="checkbox" checked={!!p.in_default_template} onChange={(e) => setP(key, 'in_default_template', e.target.checked)} className="accent-brand-blue" title="Add to default estimate template" />
                  <button onClick={() => removeP(key)} className="text-gray-500 hover:text-red-400 text-sm">✕</button>
                </div>
              </div>
            )})}
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

// ---------- new settings sections (2026-06-12) ----------
function TemplatesSection({ client }) {
  const [t, setT] = useState('estimate')
  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-navy-700/40">
        {[['estimate','Estimate Templates'],['email','Email Templates']].map(([k,l]) => (
          <button key={k} onClick={() => setT(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${t===k?'border-brand-blue text-brand-blue':'border-transparent text-gray-400 hover:text-gray-200'}`}>{l}</button>
        ))}
      </div>
      {t === 'estimate' ? <EstimateTemplatesTab client={client} /> : <EmailTemplatesTab client={client} />}
    </div>
  )
}

function CompanySettingsSection({ client, orgSettings }) {
  const [form, setForm] = useState(orgSettings || null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (orgSettings) { setForm(orgSettings); return }
    client.from('org_settings').select('*').limit(1).maybeSingle().then(({ data }) => setForm(data || {}))
  }, [orgSettings])
  if (!form) return <Panel>Loading…</Panel>
  const set = (k, v) => { setSaved(false); setForm(s => ({ ...s, [k]: v })) }
  async function save() {
    try {
      setSaving(true)
      const payload = { company_name:form.company_name, company_email:form.company_email, company_phone:form.company_phone, company_website:form.company_website, company_address:form.company_address, company_city:form.company_city, company_state:form.company_state, company_zip:form.company_zip, industry:form.industry, business_type:form.business_type, license_number:form.license_number, tax_id:form.tax_id, business_hours:form.business_hours, timezone:form.timezone, updated_at: new Date().toISOString() }
      const res = form.id ? await client.from('org_settings').update(payload).eq('id', form.id) : await client.from('org_settings').insert(payload)
      if (res.error) throw res.error
      setSaved(true)
    } catch (e) { console.error(e); alert('Could not save settings') } finally { setSaving(false) }
  }
  return (
    <div className="rounded-xl border border-navy-700/50 bg-navy-800/60 p-5 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LabeledInput label="Company Name" value={form.company_name} onChange={v=>set('company_name',v)} full />
        <LabeledInput label="Email" value={form.company_email} onChange={v=>set('company_email',v)} />
        <LabeledInput label="Phone" value={form.company_phone} onChange={v=>set('company_phone',v)} />
        <LabeledInput label="Website" value={form.company_website} onChange={v=>set('company_website',v)} full />
        <LabeledInput label="Address" value={form.company_address} onChange={v=>set('company_address',v)} full />
        <LabeledInput label="City" value={form.company_city} onChange={v=>set('company_city',v)} />
        <LabeledInput label="State" value={form.company_state} onChange={v=>set('company_state',v)} />
        <LabeledInput label="Zip" value={form.company_zip} onChange={v=>set('company_zip',v)} />
        <LabeledInput label="Industry" value={form.industry} onChange={v=>set('industry',v)} />
        <LabeledInput label="Business Type" value={form.business_type} onChange={v=>set('business_type',v)} />
        <LabeledInput label="License #" value={form.license_number} onChange={v=>set('license_number',v)} />
        <LabeledInput label="Tax ID" value={form.tax_id} onChange={v=>set('tax_id',v)} />
        <LabeledInput label="Business Hours" value={form.business_hours} onChange={v=>set('business_hours',v)} />
        <LabeledInput label="Timezone" value={form.timezone} onChange={v=>set('timezone',v)} />
      </div>
      <div className="flex items-center gap-3 mt-5">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-brand-blue text-white text-sm">{saving?'Saving…':'Save Changes'}</button>
        {saved && <span className="text-xs text-emerald-400">Saved ✓</span>}
      </div>
    </div>
  )
}

function CompanyInfoSection({ client, orgSettings }) {
  const [form, setForm] = useState(orgSettings || null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (orgSettings) { setForm(orgSettings); return }
    client.from('org_settings').select('*').limit(1).maybeSingle().then(({ data }) => setForm(data || {}))
  }, [orgSettings])
  if (!form) return <Panel>Loading…</Panel>
  const set = (k, v) => { setSaved(false); setForm(s => ({ ...s, [k]: v })) }
  async function save() {
    try {
      setSaving(true)
      const payload = { logo_url:form.logo_url, primary_color:form.primary_color, accent_color:form.accent_color, notify_new_lead:!!form.notify_new_lead, notify_job_update:!!form.notify_job_update, notify_payment_received:!!form.notify_payment_received, notify_estimate_signed:!!form.notify_estimate_signed, notify_team_activity:!!form.notify_team_activity, ai_enabled:!!form.ai_enabled, ai_auto_dispatch:!!form.ai_auto_dispatch, ai_lead_scoring:!!form.ai_lead_scoring, ai_email_drafts:!!form.ai_email_drafts, ai_estimate_assist:!!form.ai_estimate_assist, ai_call_summary:!!form.ai_call_summary, updated_at: new Date().toISOString() }
      const res = form.id ? await client.from('org_settings').update(payload).eq('id', form.id) : await client.from('org_settings').insert(payload)
      if (res.error) throw res.error
      setSaved(true)
    } catch (e) { console.error(e); alert('Could not save') } finally { setSaving(false) }
  }
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="rounded-xl border border-navy-700/50 bg-navy-800/60 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Branding</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledInput label="Logo URL" value={form.logo_url} onChange={v=>set('logo_url',v)} full />
          <LabeledInput label="Primary Color" value={form.primary_color} onChange={v=>set('primary_color',v)} />
          <LabeledInput label="Accent Color" value={form.accent_color} onChange={v=>set('accent_color',v)} />
        </div>
      </div>
      <div className="rounded-xl border border-navy-700/50 bg-navy-800/60">
        <div className="px-4 py-3 border-b border-navy-700/40 text-sm font-semibold text-white">Notifications</div>
        <ToggleRow label="New lead" checked={form.notify_new_lead} onChange={v=>set('notify_new_lead',v)} />
        <ToggleRow label="Job updates" checked={form.notify_job_update} onChange={v=>set('notify_job_update',v)} />
        <ToggleRow label="Payment received" checked={form.notify_payment_received} onChange={v=>set('notify_payment_received',v)} />
        <ToggleRow label="Estimate signed" checked={form.notify_estimate_signed} onChange={v=>set('notify_estimate_signed',v)} />
        <ToggleRow label="Team activity" checked={form.notify_team_activity} onChange={v=>set('notify_team_activity',v)} />
      </div>
      <div className="rounded-xl border border-navy-700/50 bg-navy-800/60">
        <div className="px-4 py-3 border-b border-navy-700/40 text-sm font-semibold text-white">AI Assist</div>
        <ToggleRow label="AI enabled" checked={form.ai_enabled} onChange={v=>set('ai_enabled',v)} />
        <ToggleRow label="Auto-dispatch" checked={form.ai_auto_dispatch} onChange={v=>set('ai_auto_dispatch',v)} />
        <ToggleRow label="Lead scoring" checked={form.ai_lead_scoring} onChange={v=>set('ai_lead_scoring',v)} />
        <ToggleRow label="Email drafts" checked={form.ai_email_drafts} onChange={v=>set('ai_email_drafts',v)} />
        <ToggleRow label="Estimate assist" checked={form.ai_estimate_assist} onChange={v=>set('ai_estimate_assist',v)} />
        <ToggleRow label="Call summaries" checked={form.ai_call_summary} onChange={v=>set('ai_call_summary',v)} />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-brand-blue text-white text-sm">{saving?'Saving…':'Save Changes'}</button>
        {saved && <span className="text-xs text-emerald-400">Saved ✓</span>}
      </div>
    </div>
  )
}

const ROLES = ['Owner', 'Admin', 'Manager', 'Dispatcher', 'Field Technician', 'Sales', 'Office/CSR', 'Viewer']
const ROLE_COLORS = { Owner:'#a855f7', Admin:'#0ea5e9', Manager:'#22c55e', Dispatcher:'#f59e0b', 'Field Technician':'#38bdf8', Sales:'#ec4899', 'Office/CSR':'#14b8a6', Viewer:'#94a3b8' }
const STATUS_COLORS = { active:'#22c55e', invited:'#f59e0b', suspended:'#ef4444' }
const PERM_HUBS = [
  ['dashboard','Dashboard'],['sales','Sales'],['operations','Operations'],['finance','Finance'],
  ['marketing','Marketing'],['communications','Communications'],['chat','Chat'],['eos','EOS'],
  ['calendar','Calendar'],['tasks','Tasks'],['notes','Notes'],['settings','Settings'],
]
const PERM_CAPS = [
  ['manage_users','Manage users'],['manage_billing','Manage billing'],['manage_settings','Manage settings'],
  ['export_data','Export data'],['delete_records','Delete records'],
]
function defaultPerms(role) {
  const all = (v) => Object.fromEntries(PERM_HUBS.map(([k]) => [k, v]))
  const allCaps = (v) => Object.fromEntries(PERM_CAPS.map(([k]) => [k, v]))
  const hubs = (keys) => Object.fromEntries(PERM_HUBS.map(([k]) => [k, keys.includes(k)]))
  switch (role) {
    case 'Owner':
    case 'Admin': return { hubs: all(true), caps: allCaps(true) }
    case 'Manager': return { hubs: hubs(['dashboard','sales','operations','finance','marketing','communications','chat','eos','calendar','tasks','notes']), caps: { ...allCaps(false), export_data:true, delete_records:true } }
    case 'Dispatcher': return { hubs: hubs(['dashboard','operations','calendar','tasks','communications','chat']), caps: allCaps(false) }
    case 'Field Technician': return { hubs: hubs(['dashboard','operations','calendar','tasks','chat']), caps: allCaps(false) }
    case 'Sales': return { hubs: hubs(['dashboard','sales','marketing','communications','chat','calendar','tasks']), caps: allCaps(false) }
    case 'Office/CSR': return { hubs: hubs(['dashboard','sales','operations','communications','chat','calendar','tasks']), caps: allCaps(false) }
    case 'Viewer': return { hubs: all(true), caps: allCaps(false) }
    default: return { hubs: hubs(['dashboard']), caps: allCaps(false) }
  }
}

function UserManagementSection({ client }) {
  const [rows, setRows] = useState(null)
  const [crews, setCrews] = useState([])
  const [memberCrews, setMemberCrews] = useState({})
  const [editing, setEditing] = useState(null)

  async function load() {
    const [u, c, m] = await Promise.all([
      client.from('org_team_members').select('*').order('created_at', { ascending: true }),
      client.from('ops_crews').select('id,name,color').order('name'),
      client.from('ops_crew_members').select('crew_id,email'),
    ])
    setRows(u.data || [])
    setCrews(c.data || [])
    const map = {}
    ;(m.data || []).forEach(x => { if (x.email) { const e = x.email.toLowerCase(); (map[e] = map[e] || []).push(x.crew_id) } })
    setMemberCrews(map)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  if (!rows) return <Panel>Loading…</Panel>
  const crewName = id => (crews.find(c => c.id === id) || {}).name || ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Add teammates, assign a role + permissions, and put them on crews. Email invites and access enforcement roll out next — assignments save now.</p>
        <button onClick={() => setEditing('new')} className="px-3 py-2 rounded bg-brand-blue text-white text-sm whitespace-nowrap">+ Add User</button>
      </div>
      {rows.length === 0 ? <Panel>No users yet. Add your first teammate.</Panel> : (
        <div className="rounded-xl border border-navy-700/50 bg-navy-800/60 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-navy-700/40 text-gray-500">
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Teams</th>
              <th className="text-left px-4 py-2 font-medium">Department</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr></thead>
            <tbody>{rows.map(u => {
              const cids = memberCrews[(u.email || '').toLowerCase()] || []
              return (
                <tr key={u.id} className="border-b border-navy-700/30 hover:bg-navy-800/40">
                  <td className="px-4 py-2 text-white">{`${u.first_name||''} ${u.last_name||''}`.trim() || u.email || '—'}<div className="text-[11px] text-gray-500">{u.email || ''}{u.title ? ` · ${u.title}` : ''}</div></td>
                  <td className="px-4 py-2"><Chip color={ROLE_COLORS[u.role] || '#94a3b8'}>{u.role || 'member'}</Chip></td>
                  <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{cids.length ? cids.map(id => <Chip key={id} color={(crews.find(c => c.id === id) || {}).color || '#475569'}>{crewName(id)}</Chip>) : <span className="text-gray-600 text-xs">—</span>}</div></td>
                  <td className="px-4 py-2 text-gray-300">{u.department || '—'}</td>
                  <td className="px-4 py-2"><Chip color={STATUS_COLORS[u.status] || '#94a3b8'}>{u.status || '—'}</Chip></td>
                  <td className="px-4 py-2 text-right"><button onClick={() => setEditing(u)} className="text-brand-blue hover:underline text-xs">Edit</button></td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
      {editing && <UserModal client={client} crews={crews} user={editing === 'new' ? null : editing} memberCrewIds={editing === 'new' ? [] : (memberCrews[(editing.email || '').toLowerCase()] || [])} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

function UserModal({ client, crews, user, memberCrewIds, onClose, onSaved }) {
  const isNew = !user
  const [f, setF] = useState(() => ({
    first_name: user?.first_name || '', last_name: user?.last_name || '', email: user?.email || '', phone: user?.phone || '',
    title: user?.title || '', department: user?.department || '', role: user?.role || 'Office/CSR', status: user?.status || 'invited',
    permissions: (user?.permissions && user.permissions.hubs) ? user.permissions : defaultPerms(user?.role || 'Office/CSR'),
  }))
  const [crewIds, setCrewIds] = useState(memberCrewIds || [])
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const changeRole = (role) => setF(s => ({ ...s, role, permissions: defaultPerms(role) }))
  const togglePerm = (group, key) => setF(s => ({ ...s, permissions: { ...s.permissions, [group]: { ...s.permissions[group], [key]: !s.permissions[group][key] } } }))
  const toggleCrew = (id) => setCrewIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  async function remove() {
    if (!user || !window.confirm('Remove this user?')) return
    try {
      setSaving(true)
      if (user.email) await client.from('ops_crew_members').delete().eq('email', user.email)
      const { error } = await client.from('org_team_members').delete().eq('id', user.id)
      if (error) throw error
      onSaved()
    } catch (e) { console.error(e); alert('Could not remove user') } finally { setSaving(false) }
  }

  async function save() {
    if (!f.email.trim() && !`${f.first_name} ${f.last_name}`.trim()) { alert('Add a name or email'); return }
    try {
      setSaving(true)
      const payload = { first_name: f.first_name || null, last_name: f.last_name || null, email: f.email || null, phone: f.phone || null, title: f.title || null, department: f.department || null, role: f.role, status: f.status, permissions: f.permissions, updated_at: new Date().toISOString() }
      if (isNew) {
        payload.invited_at = new Date().toISOString()
        const { error } = await client.from('org_team_members').insert(payload)
        if (error) throw error
      } else {
        const { error } = await client.from('org_team_members').update(payload).eq('id', user.id)
        if (error) throw error
      }
      if (f.email) {
        await client.from('ops_crew_members').delete().eq('email', f.email)
        if (crewIds.length) {
          const ins = crewIds.map(cid => ({ crew_id: cid, email: f.email, name: `${f.first_name} ${f.last_name}`.trim() || f.email, role: f.role, status: 'active' }))
          const { error } = await client.from('ops_crew_members').insert(ins)
          if (error) throw error
        }
      }
      onSaved()
    } catch (e) { console.error(e); alert('Could not save user') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-navy-900 border border-navy-700 rounded-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-navy-800 sticky top-0 bg-navy-900 z-10">
          <h3 className="text-white font-semibold">{isNew ? 'Add User' : 'Edit User'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LabeledInput label="First Name" value={f.first_name} onChange={v => set('first_name', v)} />
            <LabeledInput label="Last Name" value={f.last_name} onChange={v => set('last_name', v)} />
            <LabeledInput label="Email" value={f.email} onChange={v => set('email', v)} />
            <LabeledInput label="Phone" value={f.phone} onChange={v => set('phone', v)} />
            <LabeledInput label="Title" value={f.title} onChange={v => set('title', v)} />
            <LabeledInput label="Department" value={f.department} onChange={v => set('department', v)} />
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Role</label>
              <select value={f.role} onChange={e => changeRole(e.target.value)} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Status</label>
              <select value={f.status} onChange={e => set('status', e.target.value)} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">
                {['invited','active','suspended'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-white mb-2">Teams (Crews)</div>
            {crews.length === 0 ? <p className="text-xs text-gray-500">No crews yet — add them under Operations › Crews.</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {crews.map(c => (
                  <label key={c.id} className="flex items-center gap-2 rounded-lg border border-navy-700 bg-navy-800/60 px-3 py-2 text-sm text-gray-200 cursor-pointer">
                    <input type="checkbox" checked={crewIds.includes(c.id)} onChange={() => toggleCrew(c.id)} />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color || '#0ea5e9' }} />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
            {!f.email && <p className="text-[11px] text-amber-400 mt-1">Add an email to save crew assignments.</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-white">Permissions</div>
              <button onClick={() => set('permissions', defaultPerms(f.role))} className="text-xs text-brand-blue hover:underline">Reset to {f.role} defaults</button>
            </div>
            <div className="text-[11px] text-gray-500 mb-2">Hub access</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {PERM_HUBS.map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={!!f.permissions.hubs[k]} onChange={() => togglePerm('hubs', k)} /> {l}
                </label>
              ))}
            </div>
            <div className="text-[11px] text-gray-500 mb-2">Capabilities</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PERM_CAPS.map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={!!f.permissions.caps[k]} onChange={() => togglePerm('caps', k)} /> {l}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-navy-800 sticky bottom-0 bg-navy-900">
          {!isNew ? <button onClick={remove} disabled={saving} className="px-3 py-2 rounded text-red-400 hover:bg-red-500/10 text-sm">Remove</button> : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-brand-blue text-white text-sm">{saving ? 'Saving…' : (isNew ? 'Add User' : 'Save Changes')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TeamManagementSection({ client }) {
  const [crews, setCrews] = useState(null)
  const [members, setMembers] = useState([])
  useEffect(() => { (async () => {
    const { data: c } = await client.from('ops_crews').select('*').order('name'); setCrews(c || [])
    const { data: m } = await client.from('org_team_members').select('first_name,last_name,department,role'); setMembers(m || [])
  })() }, [])
  if (!crews) return <Panel>Loading…</Panel>
  const depts = {}; members.forEach(m => { const d = m.department || 'Unassigned'; (depts[d] = depts[d] || []).push(m) })
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-white">Crews</h3><span className="text-xs text-gray-500">Manage in Operations › Crews</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {crews.length === 0 ? <Panel>No crews yet.</Panel> : crews.map(c => (
            <div key={c.id} className="rounded-xl border border-navy-700/50 bg-navy-800/60 p-4">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.color || '#0ea5e9' }} /><span className="text-white font-medium">{c.name}</span></div>
              <div className="text-xs text-gray-400 mt-1">{(c.specialties || []).join(', ') || '—'}</div>
              <div className="text-[11px] text-gray-500 mt-2">Capacity {c.max_capacity || '—'} · {c.status || 'active'}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Departments</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(depts).map(([d, list]) => (
            <div key={d} className="rounded-xl border border-navy-700/50 bg-navy-800/60 p-4">
              <div className="text-white font-medium">{d}</div>
              <div className="text-xs text-gray-400 mt-1">{list.length} member{list.length !== 1 ? 's' : ''}</div>
            </div>
          ))}
          {members.length === 0 && <Panel>No team members yet.</Panel>}
        </div>
      </div>
    </div>
  )
}

function CompanyDocsSection({ client }) {
  const [docs, setDocs] = useState(null)
  useEffect(() => { client.from('documents').select('*').order('created_at', { ascending: false }).limit(200).then(({ data }) => setDocs(data || [])) }, [])
  if (!docs) return <Panel>Loading…</Panel>
  const company = docs.filter(d => !d.related_entity_id || d.related_entity_table === 'company' || d.doc_type === 'company')
  const list = company.length ? company : docs
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => alert('Document upload connects in a later phase')} className="px-3 py-2 rounded bg-brand-blue text-white text-sm">+ Upload Document</button></div>
      {list.length === 0 ? <Panel>No company documents yet.</Panel> : (
        <div className="rounded-xl border border-navy-700/50 bg-navy-800/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-navy-700/40 text-gray-500"><th className="text-left px-4 py-2 font-medium">Name</th><th className="text-left px-4 py-2 font-medium">Type</th><th className="text-left px-4 py-2 font-medium">Added</th></tr></thead>
            <tbody>{list.map(d => (
              <tr key={d.id} className="border-b border-navy-700/30">
                <td className="px-4 py-2 text-white">{d.name || 'Untitled'}</td>
                <td className="px-4 py-2 text-gray-300">{d.doc_type || d.mime_type || '—'}</td>
                <td className="px-4 py-2 text-gray-400">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const LIFTORI_SERVICES = [
  { name:'Custom Website', desc:'Marketing sites & landing pages' },
  { name:'E-Commerce Platform', desc:'Online stores & checkout' },
  { name:'Business Dashboard / CRM', desc:'Operations, sales & ops hubs' },
  { name:'AI Chatbot', desc:'24/7 assistant for your site' },
  { name:'Booking System', desc:'Scheduling & reminders' },
  { name:'Marketing Hub', desc:'Campaigns, SEO & social' },
  { name:'AI Call Center', desc:'Inbound/outbound voice agents' },
  { name:'Mobile App', desc:'iOS & Android companion apps' },
  { name:'Business Launchpad', desc:'Entity, branding & domain setup' },
]

function LiftoriServicesSection() {
  const [showSupport, setShowSupport] = useState(false)
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Products & Services</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LIFTORI_SERVICES.map(s => (
            <div key={s.name} className="rounded-xl border border-navy-700/50 bg-navy-800/60 p-4">
              <div className="text-white font-medium">{s.name}</div>
              <div className="text-xs text-gray-400 mt-1">{s.desc}</div>
              <a href="https://www.liftori.ai" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-xs text-brand-blue hover:underline">Learn more →</a>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-navy-700/50 bg-navy-800/60 p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-blue/15 text-brand-blue flex items-center justify-center"><LifeBuoy size={20} /></div>
          <div><div className="text-white font-medium">Need help or want to add a service?</div><div className="text-xs text-gray-400">Submit a request to the Liftori team — same as the bug report button.</div></div>
        </div>
        <button onClick={() => setShowSupport(true)} className="px-4 py-2 rounded bg-brand-blue text-white text-sm">Contact Support</button>
      </div>
      {showSupport && <BugReportModal onClose={() => setShowSupport(false)} />}
    </div>
  )
}


// ============ Billing & Invoices (reads the central credits engine on the main project) ============
function reasonLabel(r) {
  return ({ scan_item: 'Item scan', ai_listing_draft: 'AI listing draft', style_image: 'Studio background', monthly_grant: 'Monthly credits', purchase: 'Credit purchase', adjustment: 'Adjustment' })[r] || r
}

function BillingSection() {
  const { platformId } = useCrm()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data: res, error } = await mainDb.functions.invoke('credits', { body: { action: 'get', platform_id: platformId } })
        if (!active) return
        if (error) throw error
        setData(res)
      } catch (e) {
        console.error('billing load error', e)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [platformId])

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('credits')
    if (!c) return
    if (c === 'success') toast.success('Payment received - your credits will appear shortly')
    else if (c === 'cancelled') toast.message('Checkout cancelled')
    window.history.replaceState({}, '', window.location.pathname)
    const t = setTimeout(async () => {
      try { const { data: res } = await mainDb.functions.invoke('credits', { body: { action: 'get', platform_id: platformId } }); if (res) setData(res) } catch (_) {}
    }, 3000)
    return () => clearTimeout(t)
  }, [platformId])

  if (loading) return <Panel>Loading billing...</Panel>
  if (!data || !data.ok) return <Panel>Billing isn't set up for this account yet.</Panel>

  const includedUsed = Math.max(0, Number(data.monthly_allotment) - Number(data.included_remaining))
  const hasMobile = data.is_comped || data.plan === 'combo'
  const planLabel = data.is_comped ? 'Founder' : (data.plan === 'combo' ? 'Combo' : 'Web')
  const planPrice = data.is_comped ? '$0 / mo' : (data.plan === 'combo' ? '$89 / mo' : '$59 / mo')

  async function buy(pack) {
    if (busy || !pack) return
    setBusy(true)
    try {
      const { data, error } = await mainDb.functions.invoke('buy-credits', { body: { platform_id: platformId, pack_id: pack.id } })
      if (error) throw error
      if (data?.url) { window.location.href = data.url; return }
      throw new Error(data?.error || 'no checkout url')
    } catch (e) {
      console.error('buy credits', e)
      toast.error('Could not start checkout - try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Panel>
          <div className="text-xs text-gray-400">Current plan</div>
          <div className="text-white font-semibold text-lg mt-1">{planLabel}</div>
          <div className="text-sm text-brand-light">{planPrice}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-navy-700/60 text-gray-200">Web CRM</span>
            {hasMobile
              ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">Mobile app</span>
              : <span className="text-[11px] px-2 py-0.5 rounded-full bg-navy-700/40 text-gray-500">Mobile app not included</span>}
          </div>
          {data.is_comped && <div className="text-[11px] text-gray-500 mt-2">Founder &mdash; you only pay for overage credits.</div>}
        </Panel>
        <Panel>
          <div className="text-xs text-gray-400">Credits available</div>
          <div className="text-white font-bold text-3xl mt-1">{data.available}</div>
          <div className="text-[11px] text-gray-500 mt-1">{data.included_remaining} included + {data.purchased_balance} purchased</div>
        </Panel>
        <Panel>
          <div className="text-xs text-gray-400">This month</div>
          <div className="text-white font-semibold text-lg mt-1">{includedUsed} / {data.monthly_allotment}</div>
          <div className="text-[11px] text-gray-500 mt-1">included used - resets the 1st</div>
        </Panel>
      </div>

      <Panel>
        <h3 className="text-white font-semibold text-sm">How your credits work</h3>
        <p className="text-sm text-gray-300 mt-2">Your {planLabel} plan includes <span className="text-white font-medium">{data.monthly_allotment} AI credits</span> every month, refreshing on the 1st. Each AI action uses credits:</p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          {(data.action_costs || []).map(a => (
            <div key={a.action} className="flex items-center justify-between text-sm border-b border-navy-700/30 py-1">
              <span className="text-gray-300">{a.label}</span>
              <span className="text-brand-light font-medium">{a.credits} credits</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">Unused monthly credits don&rsquo;t roll over. Credit packs you buy never expire and are used only after your monthly credits run out. Running low? Add a pack below.</p>
      </Panel>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold text-sm">Add Credits</h3>
          {data.founder_pack_discount_pct > 0 && <span className="text-[11px] text-emerald-300 font-medium">Founder {data.founder_pack_discount_pct}% off</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(data.packs || []).map(p => {
            const cents = data.founder_pack_discount_pct ? Math.round(p.price_cents * (1 - data.founder_pack_discount_pct / 100)) : p.price_cents
            return (
              <div key={p.id} className="rounded-xl border border-navy-700/50 bg-navy-800/60 p-4 flex flex-col">
                <div className="text-white font-semibold">{p.credits} credits</div>
                <div className="text-sm mt-0.5">
                  <span className="text-brand-light font-semibold">${(cents / 100).toFixed(2)}</span>
                  {cents !== p.price_cents && <span className="text-gray-500 line-through ml-2 text-xs">${(p.price_cents / 100).toFixed(2)}</span>}
                </div>
                <button type="button" disabled={busy} onClick={() => buy(p)} className="mt-3 px-3 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium disabled:opacity-50">Buy</button>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="text-white font-semibold text-sm mb-2">Recent activity</h3>
        <div className="rounded-xl border border-navy-700/50 overflow-hidden">
          {(data.transactions || []).length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No activity yet.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.transactions.map((t, i) => (
                  <tr key={i} className="border-b border-navy-700/40 last:border-0">
                    <td className="px-3 py-2 text-gray-300">{reasonLabel(t.reason)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${Number(t.delta) >= 0 ? 'text-emerald-300' : 'text-gray-400'}`}>{Number(t.delta) >= 0 ? '+' : ''}{t.delta}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
