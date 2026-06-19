import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Globe, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { usePipelineStages } from '../lib/usePipelineStages'
import {
  WorkspaceTabBody,
  wsTabBadge,
  WORKSPACE_TABS,
  WORKSPACE_TAB_KEYS,
  PRODUCT_TYPES,
  money,
} from '../components/BuildWorkspace'

/**
 * CustomBuildDetail (/admin/custom-builds/:id)
 *
 * Full per-build dev window — SAME template as Products (ProductDetail) and
 * Operations Projects (ProjectDetail). Overview surfaces the customer-intake
 * data (customer, scope, estimate, build plan, mockup); the shared
 * workspace-jsonb spec tabs (Project Details, Design, Features, Scope, Timeline,
 * Implementation Plan, Security, Costs, Documents, Tasks) persist to
 * custom_builds.workspace, so every build is documented the same way.
 */

const PRIORITIES = ['low', 'normal', 'high', 'urgent']

const STAGE_FALLBACK = [
  'Submitted', 'In Review', 'Mock up', 'Estimate Sent', 'Dev Ready', 'Dev Prep',
  'In Progress', 'Testing', 'Customer Ready', 'Launched', 'Completed',
  'Active customer', 'Lost', 'Archived',
]

function fmtDateTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return String(value) }
}

function timeAgo(value) {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.floor((Date.now() - then) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  return new Date(value).toLocaleDateString()
}

export default function CustomBuildDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const adminName = profile?.full_name || user?.email || 'Admin'
  const { stages } = usePipelineStages('custom_build')

  const [build, setBuild] = useState(null)
  const [ws, setWs] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState('overview')
  const [wsSaving, setWsSaving] = useState(false)

  // header controls
  const [status, setStatus] = useState('Submitted')
  const [priority, setPriority] = useState('normal')
  const [progress, setProgress] = useState(0)
  const [assignedTo, setAssignedTo] = useState('')
  const [ctlSaving, setCtlSaving] = useState(false)
  const [ctlMsg, setCtlMsg] = useState(null)

  // notes
  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    supabase.from('custom_builds').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        if (!data) { setNotFound(true); setLoading(false); return }
        setBuild(data)
        const wsData = data.workspace && Object.keys(data.workspace).length
          ? data.workspace
          : (data.details && Object.keys(data.details).length ? { details: data.details } : {})
        setWs(wsData)
        setStatus(data.status || 'Submitted')
        setPriority(data.priority || 'normal')
        setProgress(data.progress ?? 0)
        setAssignedTo(data.assigned_to || '')
        setLoading(false)
      })
    return () => { alive = false }
  }, [id])

  const loadNotes = useCallback(async () => {
    setNotesLoading(true)
    const { data } = await supabase.from('custom_build_notes').select('*')
      .eq('build_id', id).order('created_at', { ascending: true })
    setNotes(data || [])
    setNotesLoading(false)
  }, [id])
  useEffect(() => { loadNotes() }, [loadNotes])

  async function saveWs(next) {
    setWs(next)
    setWsSaving(true)
    try {
      const { error } = await supabase.from('custom_builds')
        .update({ workspace: next, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) console.error('Error saving build workspace:', error)
    } finally { setWsSaving(false) }
  }

  async function changeStatus(value) {
    const prev = status
    setStatus(value)
    const { error } = await supabase.from('custom_builds').update({ status: value }).eq('id', id)
    if (error) { setStatus(prev); setCtlMsg('Could not update status'); return }
    setBuild((b) => (b ? { ...b, status: value } : b))
  }

  async function saveControls() {
    setCtlSaving(true); setCtlMsg(null)
    const patch = {
      priority,
      progress: Number.isNaN(Number(progress)) ? 0 : Number(progress),
      assigned_to: assignedTo || null,
    }
    const { error } = await supabase.from('custom_builds').update(patch).eq('id', id)
    setCtlSaving(false)
    if (error) { setCtlMsg('Save failed'); return }
    setBuild((b) => (b ? { ...b, ...patch } : b))
    setCtlMsg('Saved'); setTimeout(() => setCtlMsg(null), 2000)
  }

  async function addNote() {
    const body = newNote.trim()
    if (!body) return
    setAddingNote(true)
    const { error } = await supabase.from('custom_build_notes').insert({
      build_id: id, author: adminName, author_role: 'human', note_type: 'note', body,
    })
    setAddingNote(false)
    if (error) return
    setNewNote('')
    await loadNotes()
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (notFound || !build) {
    return (
      <div className="p-8">
        <p className="text-red-400">Build not found</p>
        <Link to="/admin/custom-builds" className="text-brand-blue hover:underline mt-2 inline-block">Back to Custom Builds</Link>
      </div>
    )
  }

  const stageOpts = (stages && stages.length)
    ? stages.map((s) => ({ k: s.stage_key, l: s.label }))
    : STAGE_FALLBACK.map((s) => ({ k: s, l: s }))

  const productType = {
    value: ws.details?.product_type || build.product_category || '',
    options: PRODUCT_TYPES,
    onChange: (v) => saveWs({ ...ws, details: { ...(ws.details || {}), product_type: v } }),
  }

  const allTabs = [
    { key: 'overview', label: 'Overview' },
    ...WORKSPACE_TABS,
    { key: 'mockup', label: 'Mockup' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div className="p-6 space-y-6">
      <Link to="/admin/custom-builds" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All custom builds
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-500">{build.ref || '—'}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${build.source === 'customer' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-500/20 text-slate-400'}`}>
              {build.source === 'customer' ? 'Customer' : 'Internal'}
            </span>
            {wsSaving && <span className="text-[11px] text-gray-500">Saving…</span>}
          </div>
          <h1 className="mt-1.5 text-3xl font-bold text-white">{build.title || 'Untitled build'}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {[build.product_category, build.product_name, build.industry].filter(Boolean).join(' · ') || 'No product details'}
          </p>
        </div>
        {build.mockup_url && (
          <a href={build.mockup_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm text-gray-200 hover:bg-navy-700">
            <Globe className="h-4 w-4" /> Mockup
          </a>
        )}
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-white/10 bg-navy-900/60 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Status">
            <select value={status} onChange={(e) => changeStatus(e.target.value)} className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500">
              {stageOpts.map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white capitalize focus:outline-none focus:border-sky-500">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Progress (%)">
            <input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500" />
          </Field>
          <Field label="Assigned to">
            <input type="text" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Unassigned" className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500" />
          </Field>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={saveControls} disabled={ctlSaving} className="text-sm px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium transition-colors">{ctlSaving ? 'Saving…' : 'Save'}</button>
          {ctlMsg && <span className="text-xs text-slate-400">{ctlMsg}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/10">
        {allTabs.map((t) => {
          const active = tab === t.key
          const badge = WORKSPACE_TAB_KEYS.includes(t.key) ? wsTabBadge(ws, t.key) : null
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${active ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-white'}`}>
              {t.label}
              {t.key === 'notes' && notes.length > 0 && <span className="ml-0.5 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">{notes.length}</span>}
              {badge != null && <span className="ml-0.5 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* Body */}
      {tab === 'overview' && <Overview build={build} />}
      {tab === 'mockup' && <MockupTab build={build} />}
      {tab === 'notes' && (
        <NotesTab notes={notes} loading={notesLoading} newNote={newNote} setNewNote={setNewNote} adding={addingNote} onAdd={addNote} />
      )}
      {WORKSPACE_TAB_KEYS.includes(tab) && (
        <WorkspaceTabBody tab={tab} ws={ws} onSave={saveWs} productType={productType} />
      )}
    </div>
  )
}

// ── Overview: customer-intake data ──────────────────────────────────────────
function Overview({ build }) {
  const scope = build.scope || {}
  const estimate = build.estimate || {}
  const hasCustomer = build.customer_name || build.customer_email || build.customer_phone || build.company_name
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card title="Scope of work"><ScopeView scope={scope} /></Card>
        <Card title="Build plan">
          {build.build_plan ? (
            <div>
              <div className="whitespace-pre-wrap text-sm text-slate-300">{build.build_plan}</div>
              {build.plan_generated_at && <div className="text-xs text-slate-500 mt-3">Generated {fmtDateTime(build.plan_generated_at)}</div>}
            </div>
          ) : <Empty>Plan not generated yet.</Empty>}
        </Card>
        <Card title="Estimate">
          {estimate && Object.keys(estimate).length > 0 ? <EstimateView estimate={estimate} sentAt={build.estimate_sent_at} /> : <Empty>No estimate built yet.</Empty>}
        </Card>
      </div>
      <aside className="space-y-6">
        <Card title="Customer">
          {hasCustomer ? (
            <div className="space-y-1.5 text-sm">
              {build.customer_name && <Row label="Name" value={build.customer_name} />}
              {build.customer_email && (
                <div className="flex justify-between gap-4"><span className="text-slate-500">Email</span><a href={`mailto:${build.customer_email}`} className="text-sky-400 hover:text-sky-300 truncate">{build.customer_email}</a></div>
              )}
              {build.customer_phone && <Row label="Phone" value={build.customer_phone} />}
              {build.company_name && <Row label="Company" value={build.company_name} />}
            </div>
          ) : <Empty>No customer details (internal build).</Empty>}
        </Card>
        <Card title="At a glance">
          <Row label="Priority" value={(build.priority || 'normal')} />
          <Row label="Progress" value={`${build.progress ?? 0}%`} />
          <Row label="Assigned" value={build.assigned_to || 'Unassigned'} />
          <Row label="Created" value={fmtDateTime(build.created_at)} />
        </Card>
      </aside>
    </div>
  )
}

function MockupTab({ build }) {
  if (!build.mockup_url) return <Empty>No mockup yet — the mockup agent will generate one.</Empty>
  return (
    <div>
      <iframe src={build.mockup_url} title="Mockup preview" className="w-full h-[600px] rounded-lg border border-navy-700/50 bg-white" />
      <a href={build.mockup_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 mt-3">Open in new tab <ExternalLink className="w-4 h-4" /></a>
    </div>
  )
}

function NotesTab({ notes, loading, newNote, setNewNote, adding, onAdd }) {
  return (
    <div className="space-y-4">
      {loading ? <Empty>Loading notes…</Empty> : notes.length === 0 ? <Empty>No notes yet.</Empty> : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg p-3 bg-navy-800 border border-navy-700/50">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{n.author || 'System'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${n.author_role === 'agent' ? 'bg-sky-500/20 text-sky-400' : n.author_role === 'human' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>{n.author_role || 'system'}</span>
                <span className="text-xs text-slate-500">{timeAgo(n.created_at)}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm text-slate-300 mt-2">{n.body}</div>
            </div>
          ))}
        </div>
      )}
      <div>
        <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} placeholder="Add a note for the team or agents…" className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-y" />
        <div className="flex justify-end mt-2">
          <button onClick={onAdd} disabled={adding || !newNote.trim()} className="text-sm px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium transition-colors">{adding ? 'Adding…' : 'Add note'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Scope + estimate renderers (mirror the old drawer) ──────────────────────
function ScopeView({ scope }) {
  const has = (k) => {
    const v = scope?.[k]
    if (v == null) return false
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') return Object.keys(v).length > 0
    return String(v).trim().length > 0
  }
  const anything = scope && Object.keys(scope).some((k) => has(k))
  if (!anything) return <Empty>No scope captured.</Empty>
  const colors = scope.colors || {}
  return (
    <div className="space-y-4 text-sm">
      {has('features') && (
        <Block label="Features"><div className="flex flex-wrap gap-2">{scope.features.map((f, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-500/20 text-sky-400">{f}</span>)}</div></Block>
      )}
      {(colors.primary || colors.palette || scope.style) && (
        <Block label="Look & feel">
          <div className="flex items-center gap-3 flex-wrap">
            {colors.primary && <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-md border border-navy-700/50" style={{ backgroundColor: colors.primary }} /><span className="text-slate-300 font-mono text-xs">{colors.primary}</span></div>}
            {colors.palette && <span className="text-slate-300">{colors.palette}</span>}
            {scope.style && <span className="text-slate-400">{scope.style}</span>}
          </div>
        </Block>
      )}
      {has('pages') && <Block label="Pages"><Chips items={scope.pages} /></Block>}
      {has('fields') && <Block label="Entry fields"><Chips items={scope.fields} /></Block>}
      {has('content') && <Block label="Content"><div className="whitespace-pre-wrap text-slate-300">{scope.content}</div></Block>}
      {(has('navigation') || has('navItems')) && (
        <Block label="Navigation">
          {has('navigation') && <div className="text-slate-300 mb-2">{scope.navigation}</div>}
          {has('navItems') && <Chips items={scope.navItems} />}
        </Block>
      )}
      {has('details') && <Block label="Details"><div className="whitespace-pre-wrap text-slate-300">{scope.details}</div></Block>}
      {(has('timeline') || has('budget')) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {has('timeline') && <div className="rounded-lg p-3 bg-navy-800 border border-navy-700/50"><div className="text-xs text-slate-500">Timeline</div><div className="text-slate-300 mt-0.5">{scope.timeline}</div></div>}
          {has('budget') && <div className="rounded-lg p-3 bg-navy-800 border border-navy-700/50"><div className="text-xs text-slate-500">Budget</div><div className="text-slate-300 mt-0.5">{scope.budget}</div></div>}
        </div>
      )}
    </div>
  )
}

function EstimateView({ estimate, sentAt }) {
  const breakdown = Array.isArray(estimate.breakdown) ? estimate.breakdown : null
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {estimate.price != null && <EstCell label="Price" value={money(estimate.price)} accent />}
        {estimate.low != null && <EstCell label="Low" value={money(estimate.low)} />}
        {estimate.high != null && <EstCell label="High" value={money(estimate.high)} />}
        {estimate.timeline && <EstCell label="Timeline" value={estimate.timeline} />}
      </div>
      {breakdown && breakdown.length > 0 && (
        <div className="rounded-lg border border-navy-700/50 divide-y divide-navy-700/50">
          {breakdown.map((row, i) => {
            const label = typeof row === 'object' ? (row.label || row.name || 'Item') : String(row)
            const amount = typeof row === 'object' ? (row.amount ?? row.price ?? row.cost) : null
            return <div key={i} className="flex items-center justify-between px-3 py-2"><span className="text-slate-300">{label}</span>{amount != null && <span className="text-slate-400">{money(amount)}</span>}</div>
          })}
        </div>
      )}
      {sentAt && <div className="text-xs text-slate-500">Sent {fmtDateTime(sentAt)}</div>}
    </div>
  )
}

// ── small presentational helpers ────────────────────────────────────────────
function Card({ title, children }) {
  return <section className="rounded-xl border border-white/10 bg-navy-900/60 p-5"><h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">{title}</h3>{children}</section>
}
function Field({ label, children }) {
  return <label className="block"><span className="text-xs text-slate-500 mb-1.5 block">{label}</span>{children}</label>
}
function Row({ label, value }) {
  return <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-0"><span className="text-xs text-slate-500">{label}</span><span className="text-xs font-medium text-white truncate">{value}</span></div>
}
function Block({ label, children }) {
  return <div><div className="text-xs text-slate-500 mb-1.5">{label}</div>{children}</div>
}
function Chips({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return <div className="flex flex-wrap gap-2">{items.map((it, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium bg-navy-800 border border-navy-700/50 text-slate-300">{String(it)}</span>)}</div>
}
function EstCell({ label, value, accent }) {
  return <div className="rounded-lg p-3 bg-navy-800 border border-navy-700/50"><div className="text-xs text-slate-500">{label}</div><div className={`mt-0.5 font-medium ${accent ? 'text-sky-400' : 'text-slate-300'}`}>{value}</div></div>
}
function Empty({ children }) { return <p className="text-sm text-slate-500">{children}</p> }
