// ============================================================
// FeatureLibrary.jsx -- /admin/feature-library  (Dev Lab)
// The real, deep feature knowledge base. Extends the same
// feature_library table the build picker reads.
// Two views: (1) full-width library card list, (2) a single
// feature open full-screen with the SAME workspace tabs as a
// Custom Build (Overview + Details/Design/Scope/Timeline/
// Implementation Plan/Security/Costs/Documents). Shell features
// (is_shell) additionally get a Features tab for sub-features.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'sonner'
import { WorkspaceTabBody, WORKSPACE_TABS, WORKSPACE_TAB_KEYS, wsTabBadge } from '../components/BuildWorkspace'

const CATEGORIES = ['CRM Hubs', 'Customer-Facing', 'Commerce', 'Mobile App', 'Productivity', 'Platform', 'Internal / Dev']
const MATURITY = [
  { value: 'idea', label: 'Idea', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30', dot: 'bg-slate-400' },
  { value: 'spec', label: 'Spec', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30', dot: 'bg-sky-400' },
  { value: 'built', label: 'Built', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
  { value: 'proven', label: 'Proven', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
]
const MATURITY_MAP = Object.fromEntries(MATURITY.map(m => [m.value, m]))
const TIERS = ['', 'Starter', 'Growth', 'Scale']
const COMPLEXITY = ['', 'Low', 'Medium', 'High']
const money = (v) => '$' + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const csvToArr = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean)
const arrToCsv = (a) => (Array.isArray(a) ? a.join(', ') : '')

function MaturityBadge({ value }) {
  const m = MATURITY_MAP[value] || MATURITY_MAP.idea
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${m.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</span>
        {hint && <span className="text-[10px] text-white/30">{hint}</span>}
      </div>
      {children}
    </label>
  )
}
const inputCls = 'w-full rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-brand-blue/60 focus:outline-none'
function TextInput(p) { return <input {...p} className={inputCls} /> }
function Select({ value, onChange, options }) {
  return <select value={value} onChange={onChange} className={inputCls}>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? (o === '' ? '—' : o)}</option>)}</select>
}
function Area({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value || ''} onChange={onChange} placeholder={placeholder} rows={rows} className={`${inputCls} resize-y leading-relaxed`} />
}

const BLANK = {
  key: '', name: '', category: 'CRM Hubs', maturity: 'idea', version: 'v1',
  tier: '', complexity: '', active: true, is_shell: false,
  detail: '', problem: '', value: '', prerequisites: [], where_live: [], tags: [],
  est_hours: '', est_cost: '', workspace: {},
}

export default function FeatureLibrary() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [matFilter, setMatFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [draft, setDraft] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wsSaving, setWsSaving] = useState(false)
  const [tab, setTab] = useState('overview')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('feature_library').select('*').order('category').order('sort_order')
    if (error) toast.error('Load failed: ' + error.message)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim()
    return rows.filter(r => {
      if (matFilter !== 'all' && r.maturity !== matFilter) return false
      if (catFilter !== 'all' && r.category !== catFilter) return false
      if (term && !(`${r.name} ${r.key} ${r.detail} ${r.category}`.toLowerCase().includes(term))) return false
      return true
    })
  }, [rows, q, matFilter, catFilter])

  const grouped = useMemo(() => {
    const g = {}
    filtered.forEach(r => { (g[r.category] = g[r.category] || []).push(r) })
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  function openFeature(r) {
    setIsNew(false); setTab('overview')
    setDraft({ ...BLANK, ...r,
      prerequisites: r.prerequisites || [], where_live: r.where_live || [], tags: r.tags || [], workspace: r.workspace || {},
    })
  }
  function openNew() { setIsNew(true); setTab('overview'); setDraft({ ...BLANK, workspace: {} }) }
  function backToLibrary() { setDraft(null); setIsNew(false); setTab('overview') }
  function set(k, v) { setDraft(d => ({ ...d, [k]: v })) }

  // Workspace tabs autosave (mirrors Custom Build saveWs). Persists the jsonb
  // and syncs scope/implementation_plan back to flat cols for the build picker.
  async function saveWs(nextWs) {
    setDraft(d => ({ ...d, workspace: nextWs }))
    if (isNew || !draft?.key) return
    setWsSaving(true)
    const { error } = await supabase.from('feature_library')
      .update({ workspace: nextWs, scope: nextWs.scope || null, implementation_plan: nextWs.implementation_plan || null, updated_by: user?.email || null, updated_at: new Date().toISOString() })
      .eq('key', draft.key)
    setWsSaving(false)
    if (error) toast.error('Autosave failed: ' + error.message)
    setRows(rs => rs.map(r => r.key === draft.key ? { ...r, workspace: nextWs } : r))
  }

  async function saveOverview() {
    if (!draft) return
    const name = (draft.name || '').trim()
    if (!name) { toast.error('Name is required'); return }
    const key = (draft.key || '').trim() || slugify(name)
    setSaving(true)
    const ws = draft.workspace || {}
    const payload = {
      key, name, category: draft.category, maturity: draft.maturity, version: draft.version || 'v1',
      tier: draft.tier || null, complexity: draft.complexity || null, active: draft.active !== false, is_shell: !!draft.is_shell,
      detail: draft.detail || null, problem: draft.problem || null, value: draft.value || null,
      prerequisites: draft.prerequisites || [], where_live: draft.where_live || [], tags: draft.tags || [],
      est_hours: draft.est_hours === '' ? null : Number(draft.est_hours),
      est_cost: draft.est_cost === '' ? null : Number(draft.est_cost),
      workspace: ws, scope: ws.scope || null, implementation_plan: ws.implementation_plan || null,
      updated_by: user?.email || null, updated_at: new Date().toISOString(),
    }
    if (isNew) {
      const maxSort = Math.max(0, ...rows.filter(r => r.category === draft.category).map(r => r.sort_order || 0))
      payload.sort_order = maxSort + 1
    }
    const { error } = await supabase.from('feature_library').upsert(payload, { onConflict: 'key' })
    setSaving(false)
    if (error) { toast.error('Save failed: ' + error.message); return }
    toast.success(isNew ? 'Feature created' : 'Saved')
    setIsNew(false); setDraft(d => ({ ...d, key }))
    await load()
  }

  async function toggleArchive() {
    if (!draft || isNew) return
    const next = !(draft.active !== false)
    const { error } = await supabase.from('feature_library').update({ active: next, updated_at: new Date().toISOString() }).eq('key', draft.key)
    if (error) { toast.error(error.message); return }
    set('active', next)
    toast.success(next ? 'Restored to catalog' : 'Archived (hidden from picker)')
    load()
  }

  const counts = useMemo(() => {
    const c = { all: rows.length }
    MATURITY.forEach(m => { c[m.value] = rows.filter(r => r.maturity === m.value).length })
    return c
  }, [rows])

  // ── Full-screen feature detail (Custom-Build workspace tabs) ─────────────
  if (draft) {
    const ws = draft.workspace || {}
    const tabs = [
      { key: 'overview', label: 'Overview' },
      ...WORKSPACE_TABS.filter(t => t.key !== 'tasks' && (t.key !== 'features' || draft.is_shell)),
    ]
    const productType = {
      value: (ws.details || {}).product_type,
      onChange: (v) => saveWs({ ...ws, details: { ...(ws.details || {}), product_type: v } }),
    }
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-navy-900/95 backdrop-blur border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={backToLibrary} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:border-white/30 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Back to library
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-heading text-white truncate">{draft.name || (isNew ? 'New feature' : '')}</span>
                  <MaturityBadge value={draft.maturity} />
                  {draft.is_shell && <span className="rounded-full border border-brand-blue/40 bg-brand-blue/10 text-brand-blue px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">Shell</span>}
                </div>
                <div className="text-[11px] text-white/40 font-mono">{draft.key || slugify(draft.name) || 'key…'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {wsSaving && <span className="text-[11px] text-white/40">Saving…</span>}
              {!isNew && <button onClick={toggleArchive} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:border-white/30">{draft.active === false ? 'Restore' : 'Archive'}</button>}
              <button onClick={saveOverview} disabled={saving} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-brand-blue/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 mt-4 -mb-4">
            {tabs.map(t => {
              const active = tab === t.key
              const badge = WORKSPACE_TAB_KEYS.includes(t.key) ? wsTabBadge(ws, t.key) : null
              return (
                <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${active ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-white'}`}>
                  {t.label}
                  {badge != null && <span className="ml-0.5 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">{badge}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {isNew && tab !== 'overview' && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">Save the feature on the Overview tab first to enable autosave for these tabs.</div>
          )}
          {tab === 'overview' ? (
            <div className="max-w-4xl space-y-7">
              <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Name"><TextInput value={draft.name} onChange={e => set('name', e.target.value)} placeholder="Feature name" /></Field>
                <Field label="Key" hint="slug, unique"><TextInput value={draft.key} onChange={e => set('key', e.target.value)} placeholder={slugify(draft.name) || 'auto from name'} disabled={!isNew} /></Field>
                <Field label="Category"><Select value={draft.category} onChange={e => set('category', e.target.value)} options={CATEGORIES} /></Field>
                <Field label="Maturity"><Select value={draft.maturity} onChange={e => set('maturity', e.target.value)} options={MATURITY} /></Field>
                <Field label="Tier"><Select value={draft.tier} onChange={e => set('tier', e.target.value)} options={TIERS} /></Field>
                <Field label="Complexity"><Select value={draft.complexity} onChange={e => set('complexity', e.target.value)} options={COMPLEXITY} /></Field>
                <Field label="Est. hours"><TextInput type="number" value={draft.est_hours ?? ''} onChange={e => set('est_hours', e.target.value)} placeholder="0" /></Field>
                <Field label="Est. cost"><TextInput type="number" value={draft.est_cost ?? ''} onChange={e => set('est_cost', e.target.value)} placeholder="0" /></Field>
                <Field label="Version"><TextInput value={draft.version} onChange={e => set('version', e.target.value)} placeholder="v1" /></Field>
              </section>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={!!draft.is_shell} onChange={e => set('is_shell', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-navy-900 text-brand-blue focus:ring-0" />
                <span className="text-sm text-white/80">Shell / composite feature</span>
                <span className="text-xs text-white/40">— a foundation made of sub-features (adds a Features tab)</span>
              </label>
              <section className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue/80">Overview</div>
                <Field label="Summary" hint="one-liner the picker shows"><Area value={draft.detail} onChange={e => set('detail', e.target.value)} rows={2} placeholder="What this feature is, in one or two lines." /></Field>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Problem it solves"><Area value={draft.problem} onChange={e => set('problem', e.target.value)} rows={3} /></Field>
                  <Field label="Value / outcome"><Area value={draft.value} onChange={e => set('value', e.target.value)} rows={3} /></Field>
                </div>
                <Field label="Prerequisites" hint="feature keys, comma-separated"><TextInput value={arrToCsv(draft.prerequisites)} onChange={e => set('prerequisites', csvToArr(e.target.value))} placeholder="auth, user_management" /></Field>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Where it's live" hint="tenants / products"><TextInput value={arrToCsv(draft.where_live)} onChange={e => set('where_live', csvToArr(e.target.value))} placeholder="RoofX, Apex HVAC, CSC" /></Field>
                  <Field label="Tags"><TextInput value={arrToCsv(draft.tags)} onChange={e => set('tags', csvToArr(e.target.value))} placeholder="multi-tenant, foundation" /></Field>
                </div>
                {draft.updated_by && <div className="text-[11px] text-white/30">Last edited by {draft.updated_by}</div>}
              </section>
            </div>
          ) : (
            <WorkspaceTabBody tab={tab} ws={ws} onSave={saveWs} productType={productType} />
          )}
        </div>
      </div>
    )
  }

  // ── Library list view ───────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-heading text-white">Feature Library</h1>
            <p className="text-sm text-white/50 mt-1 max-w-2xl">The deep buildout spec for every Liftori feature. Click a feature to open its full spec; improve it over time, then drop it straight into a build &mdash; the picker reads the same catalog.</p>
          </div>
          <button onClick={openNew} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-brand-blue/90 transition-colors">+ New feature</button>
        </div>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search features…" className="w-64 rounded-lg border border-white/10 bg-navy-900/60 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-brand-blue/60 focus:outline-none" />
          <button onClick={() => setMatFilter('all')} className={`rounded-full px-3 py-1 text-xs font-medium border ${matFilter === 'all' ? 'border-brand-blue/50 bg-brand-blue/10 text-brand-blue' : 'border-white/10 text-white/50 hover:text-white'}`}>All {counts.all}</button>
          {MATURITY.map(m => (
            <button key={m.value} onClick={() => setMatFilter(m.value)} className={`rounded-full px-3 py-1 text-xs font-medium border ${matFilter === m.value ? 'border-brand-blue/50 bg-brand-blue/10 text-brand-blue' : 'border-white/10 text-white/50 hover:text-white'}`}>{m.label} {counts[m.value] || 0}</button>
          ))}
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="rounded-lg border border-white/10 bg-navy-900/60 px-3 py-1.5 text-xs text-white focus:border-brand-blue/60 focus:outline-none">
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {loading && <div className="text-sm text-white/40">Loading catalog…</div>}
        {!loading && filtered.length === 0 && <div className="text-sm text-white/40">No features match.</div>}
        {grouped.map(([cat, items]) => (
          <div key={cat}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-3">{cat} <span className="text-white/25">({items.length})</span></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map(r => (
                <button key={r.key} onClick={() => openFeature(r)} className={`text-left rounded-xl border p-4 transition-colors ${r.active === false ? 'opacity-50 ' : ''}border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-brand-blue/40`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-white leading-snug">{r.name}</span>
                    <MaturityBadge value={r.maturity} />
                  </div>
                  {r.detail && <p className="text-xs text-white/45 mt-1.5 line-clamp-2 leading-relaxed">{r.detail}</p>}
                  <div className="flex items-center gap-3 mt-3 text-[11px] text-white/40">
                    <span>{r.est_hours ? `${r.est_hours}h` : '—'}</span>
                    <span>{r.est_cost ? money(r.est_cost) : ''}</span>
                    {r.tier && <span className="text-white/30">{r.tier}</span>}
                    {r.is_shell && <span className="text-brand-blue/70">shell</span>}
                    {r.active === false && <span className="text-amber-400/70">archived</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
