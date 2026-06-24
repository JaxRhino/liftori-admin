// ============================================================
// FeatureLibrary.jsx -- /admin/feature-library  (Dev Lab)
// The real, deep feature knowledge base. Extends the same
// feature_library table the build picker reads, adding the
// full buildout spec for each feature so they can be improved
// over time and dropped into future builds.
// Two views: (1) full-width library list, (2) a single feature
// open full-screen with a "Back to library" button.
// Access: super_admin, admin, dev, tester (gated at the route).
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'sonner'

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

// jsonb-array <-> text helpers
const linesToArr = (s) => (s || '').split('\n').map(x => x.trim()).filter(Boolean)
const arrToLines = (a) => (Array.isArray(a) ? a.join('\n') : '')
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
function Area({ value, onChange, placeholder, rows = 4, mono }) {
  return <textarea value={value || ''} onChange={onChange} placeholder={placeholder} rows={rows} className={`${inputCls} resize-y leading-relaxed ${mono ? 'font-mono text-[12px]' : ''}`} />
}

const BLANK = {
  key: '', name: '', category: 'CRM Hubs', maturity: 'idea', version: 'v1',
  tier: '', complexity: '', active: true,
  detail: '', problem: '', value: '',
  scope: '', prerequisites: [],
  db_schema: '', edge_functions: '', frontend: '', design_notes: '',
  implementation_plan: '', tech_notes: '',
  default_tasks: [], where_live: [], reference_commits: '', tags: [],
  est_hours: '', est_cost: '',
}

export default function FeatureLibrary() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [matFilter, setMatFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [draft, setDraft] = useState(null)      // when set -> full-screen detail view
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

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
    setIsNew(false)
    setDraft({ ...BLANK, ...r,
      prerequisites: r.prerequisites || [], where_live: r.where_live || [], tags: r.tags || [], default_tasks: r.default_tasks || [],
    })
  }
  function openNew() { setIsNew(true); setDraft({ ...BLANK }) }
  function backToLibrary() { setDraft(null); setIsNew(false) }
  function set(k, v) { setDraft(d => ({ ...d, [k]: v })) }

  async function save() {
    if (!draft) return
    const name = (draft.name || '').trim()
    if (!name) { toast.error('Name is required'); return }
    const key = (draft.key || '').trim() || slugify(name)
    setSaving(true)
    const payload = {
      key, name, category: draft.category, maturity: draft.maturity, version: draft.version || 'v1',
      tier: draft.tier || null, complexity: draft.complexity || null, active: draft.active !== false,
      detail: draft.detail || null, problem: draft.problem || null, value: draft.value || null,
      scope: draft.scope || null, prerequisites: draft.prerequisites || [],
      db_schema: draft.db_schema || null, edge_functions: draft.edge_functions || null,
      frontend: draft.frontend || null, design_notes: draft.design_notes || null,
      implementation_plan: draft.implementation_plan || null, tech_notes: draft.tech_notes || null,
      default_tasks: draft.default_tasks || [], where_live: draft.where_live || [],
      reference_commits: draft.reference_commits || null, tags: draft.tags || [],
      est_hours: draft.est_hours === '' ? null : Number(draft.est_hours),
      est_cost: draft.est_cost === '' ? null : Number(draft.est_cost),
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
    setIsNew(false)
    setDraft(d => ({ ...d, key }))
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

  // ── Full-screen feature detail ──────────────────────────────
  if (draft) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="sticky top-0 z-10 bg-navy-900/95 backdrop-blur border-b border-white/10 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={backToLibrary} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:border-white/30 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Back to library
              </button>
              <div className="min-w-0">
                <div className="text-lg font-heading text-white truncate">{draft.name || (isNew ? 'New feature' : '')}</div>
                <div className="text-[11px] text-white/40 font-mono">{draft.key || slugify(draft.name) || 'key…'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isNew && <button onClick={toggleArchive} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:border-white/30">{draft.active === false ? 'Restore' : 'Archive'}</button>}
              <button onClick={save} disabled={saving} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-brand-blue/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full p-6 space-y-7">
          {/* Identity */}
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

          {/* Overview */}
          <section className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue/80">Overview</div>
            <Field label="Summary" hint="one-liner the picker shows"><Area value={draft.detail} onChange={e => set('detail', e.target.value)} rows={2} placeholder="What this feature is, in one or two lines." /></Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Problem it solves"><Area value={draft.problem} onChange={e => set('problem', e.target.value)} rows={3} /></Field>
              <Field label="Value / outcome"><Area value={draft.value} onChange={e => set('value', e.target.value)} rows={3} /></Field>
            </div>
          </section>

          {/* Scope */}
          <section className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue/80">Scope</div>
            <Field label="Scope" hint="what's in / out"><Area value={draft.scope} onChange={e => set('scope', e.target.value)} rows={5} /></Field>
            <Field label="Prerequisites" hint="feature keys, comma-separated"><TextInput value={arrToCsv(draft.prerequisites)} onChange={e => set('prerequisites', csvToArr(e.target.value))} placeholder="auth, user_management" /></Field>
          </section>

          {/* Build spec */}
          <section className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue/80">Build spec</div>
            <Field label="Database schema" hint="tables, columns, RLS"><Area value={draft.db_schema} onChange={e => set('db_schema', e.target.value)} rows={6} mono /></Field>
            <Field label="Edge functions"><Area value={draft.edge_functions} onChange={e => set('edge_functions', e.target.value)} rows={3} mono /></Field>
            <Field label="Frontend" hint="files, routes, components"><Area value={draft.frontend} onChange={e => set('frontend', e.target.value)} rows={5} mono /></Field>
            <Field label="Design notes"><Area value={draft.design_notes} onChange={e => set('design_notes', e.target.value)} rows={3} /></Field>
            <Field label="Implementation plan" hint="numbered build steps"><Area value={draft.implementation_plan} onChange={e => set('implementation_plan', e.target.value)} rows={6} /></Field>
            <Field label="Gotchas / lessons learned"><Area value={draft.tech_notes} onChange={e => set('tech_notes', e.target.value)} rows={4} /></Field>
            <Field label="Default tasks" hint="one per line"><Area value={arrToLines(draft.default_tasks)} onChange={e => set('default_tasks', linesToArr(e.target.value))} rows={4} /></Field>
          </section>

          {/* Tracking */}
          <section className="space-y-4 pb-12">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue/80">Tracking</div>
            <Field label="Where it's live" hint="tenants / products, comma-separated"><TextInput value={arrToCsv(draft.where_live)} onChange={e => set('where_live', csvToArr(e.target.value))} placeholder="RoofX, Apex HVAC, CSC" /></Field>
            <Field label="Reference commits"><Area value={draft.reference_commits} onChange={e => set('reference_commits', e.target.value)} rows={2} mono /></Field>
            <Field label="Tags" hint="comma-separated"><TextInput value={arrToCsv(draft.tags)} onChange={e => set('tags', csvToArr(e.target.value))} placeholder="multi-tenant, foundation" /></Field>
            {draft.updated_by && <div className="text-[11px] text-white/30">Last edited by {draft.updated_by}</div>}
          </section>
        </div>
      </div>
    )
  }

  // ── Library list view ───────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
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

      {/* Card grid grouped by category */}
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
