import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { usePipelineStages } from '../lib/usePipelineStages'
import PipelineStagesEditor from '../components/PipelineStagesEditor'

// ---------------------------------------------------------------------------
// Pipeline stages (exact order + labels) and their status pill colors
// ---------------------------------------------------------------------------
const STAGES = [
  'Submitted',
  'In Review',
  'Mock up',
  'Estimate Sent',
  'Dev Ready',
  'Dev Prep',
  'In Progress',
  'Testing',
  'Customer Ready',
  'Launched',
  'Completed',
  'Active customer',
  'Lost',
  'Archived',
]

const STAGE_PILL = {
  'Submitted': 'bg-amber-500/20 text-amber-400',
  'In Review': 'bg-amber-500/20 text-amber-400',
  'Mock up': 'bg-yellow-500/20 text-yellow-400',
  'Estimate Sent': 'bg-sky-500/20 text-sky-400',
  'Dev Ready': 'bg-sky-500/20 text-sky-400',
  'Dev Prep': 'bg-sky-500/20 text-sky-400',
  'In Progress': 'bg-orange-500/20 text-orange-400',
  'Testing': 'bg-orange-500/20 text-orange-400',
  'Customer Ready': 'bg-yellow-500/20 text-yellow-400',
  'Launched': 'bg-green-500/20 text-green-400',
  'Completed': 'bg-green-500/20 text-green-400',
  'Active customer': 'bg-green-500/20 text-green-400',
  'Lost': 'bg-red-500/20 text-red-400',
  'Archived': 'bg-slate-500/20 text-slate-400',
}

// Top accent bar color per stage (solid-ish)
const STAGE_ACCENT = {
  'Submitted': 'bg-amber-500',
  'In Review': 'bg-amber-500',
  'Mock up': 'bg-yellow-500',
  'Estimate Sent': 'bg-sky-500',
  'Dev Ready': 'bg-sky-500',
  'Dev Prep': 'bg-sky-500',
  'In Progress': 'bg-orange-500',
  'Testing': 'bg-orange-500',
  'Customer Ready': 'bg-yellow-500',
  'Launched': 'bg-green-500',
  'Completed': 'bg-green-500',
  'Active customer': 'bg-green-500',
  'Lost': 'bg-red-500',
  'Archived': 'bg-slate-500',
}

const PRIORITY_DOT = {
  low: 'bg-slate-500',
  normal: 'bg-sky-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

const PRIORITIES = ['low', 'normal', 'high', 'urgent']

const CATEGORY_ORDER = ['Website', 'CRM', 'Mobile App', 'Digital Tool']

const CB_DETAIL_SECTIONS = [
  { title: 'Ownership', fields: [['owner', 'Project Owner', 'text'], ['stage', 'Stage', 'text'], ['start_date', 'Start Date', 'date'], ['target_launch', 'Target Launch', 'date']] },
  { title: 'Recurring Revenue', fields: [['mrr', 'MRR (monthly recurring)', 'money'], ['arr', 'ARR (annual recurring)', 'money'], ['pricing_model', 'Pricing Model', 'text'], ['active_customers', 'Active Customers', 'number']] },
  { title: 'Projections', fields: [['revenue_projection', 'Revenue Projection (12mo)', 'money'], ['buyout_prediction', 'Sale Price / Exit Value', 'money'], ['profit_margin', 'Profit Margin', 'percent'], ['break_even', 'Break-even (note)', 'text']] },
  { title: 'Budgets', fields: [['build_budget', 'Build Budget', 'money'], ['marketing_budget', 'Marketing Budget', 'money']] },
]

function CbField({ label, type, value, onCommit }) {
  const isMoney = type === 'money'
  const numeric = isMoney || type === 'percent' || type === 'number'
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <div className="bg-navy-900 border border-navy-700/50 rounded-lg p-3">
      <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {isMoney && <span className="text-slate-500 text-sm">$</span>}
        {type === 'date' ? (
          <input type="date" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onCommit(v)} className="w-full bg-transparent text-white text-sm focus:outline-none" />
        ) : (
          <input value={v} onChange={(e) => setV(numeric ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)} onBlur={() => onCommit(v)} placeholder="-" className="w-full bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none" />
        )}
        {type === 'percent' && <span className="text-slate-500 text-sm">%</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeAgo(value) {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function fmtDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function money(n) {
  const num = Number(n)
  if (Number.isNaN(num)) return ''
  return `$${num.toLocaleString()}`
}

// Small inline icons (stroke currentColor)
function Icon({ path, className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}
const ICONS = {
  plus: 'M12 4.5v15m7.5-7.5h-15',
  external: 'M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25',
  close: 'M6 18L18 6M6 6l12 12',
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  chevron: 'M19.5 8.25l-7.5 7.5-7.5-7.5',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CustomBuilds() {
  const { user, profile } = useAuth()
  const adminName = profile?.full_name || user?.email || 'Admin'
  const navigate = useNavigate()

  const [builds, setBuilds] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [sourceFilter, setSourceFilter] = useState('all') // all | customer | internal
  const [catalogOpen, setCatalogOpen] = useState(true)

  const [showNewModal, setShowNewModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const { stages: pipeStages, byKey: stageByKey, reload: reloadStages } = usePipelineStages('custom_build')
  const [activeStage, setActiveStage] = useState(null)
  const [stageEditorOpen, setStageEditorOpen] = useState(false)

  const loadData = useCallback(async () => {
    setError(null)
    const [buildsRes, productsRes] = await Promise.all([
      supabase.from('custom_builds').select('*').order('created_at', { ascending: false }),
      supabase.from('custom_build_products').select('*').order('sort_order', { ascending: true }),
    ])
    if (buildsRes.error) { setError(buildsRes.error.message); setBuilds([]) }
    else setBuilds(buildsRes.data || [])
    if (!productsRes.error) setProducts(productsRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Update a single build in local state (after a DB write)
  const patchBuild = useCallback((id, patch) => {
    setBuilds((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [])

  const stats = useMemo(() => {
    const by = (s) => builds.filter((b) => b.status === s).length
    return {
      total: builds.length,
      submitted: by('Submitted'),
      mockup: by('Mock up'),
      estimateSent: by('Estimate Sent'),
      activeCustomer: by('Active customer'),
      lost: by('Lost'),
    }
  }, [builds])

  const filteredBuilds = useMemo(() => {
    if (sourceFilter === 'all') return builds
    return builds.filter((b) => b.source === sourceFilter)
  }, [builds, sourceFilter])

  const stageList = pipeStages.length ? pipeStages : STAGES.map((s, i) => ({ stage_key: s, label: s, color: 'slate', sort_order: i }))

  const buildsByStage = useMemo(() => {
    const map = {}
    stageList.forEach((s) => { map[s.stage_key] = [] })
    filteredBuilds.forEach((b) => {
      if (!map[b.status]) map[b.status] = []
      map[b.status].push(b)
    })
    return map
  }, [filteredBuilds, pipeStages])

  // keep the active stage tab valid / populated as stages and data load
  useEffect(() => {
    if (!stageList.length) return
    const count = (k) => (buildsByStage[k] || []).length
    const exists = stageList.some((s) => s.stage_key === activeStage)
    if (!exists || count(activeStage) === 0) {
      const firstPop = stageList.find((s) => count(s.stage_key) > 0)
      setActiveStage(firstPop ? firstPop.stage_key : stageList[0].stage_key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeStages, filteredBuilds.length])

  const productsByCategory = useMemo(() => {
    const map = {}
    CATEGORY_ORDER.forEach((c) => { map[c] = [] })
    products.forEach((p) => {
      if (!map[p.category]) map[p.category] = []
      map[p.category].push(p)
    })
    return map
  }, [products])

  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Custom Builds</h1>
          <p className="text-sm text-slate-400 mt-1">
            Customer-submitted and internal product builds — plan, mock up, estimate, ship.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://www.liftori.ai/build"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-navy-700/50 text-slate-300 hover:text-white hover:border-navy-700 transition-colors"
          >
            Customer onboarding
            <Icon path={ICONS.external} className="w-4 h-4" />
          </a>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors"
          >
            <Icon path={ICONS.plus} className="w-4 h-4" />
            New internal build
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="New submissions" value={stats.submitted} />
        <StatCard label="In mockup" value={stats.mockup} />
        <StatCard label="Estimates sent" value={stats.estimateSent} />
        <StatCard label="Active customers" value={stats.activeCustomer} accent="text-green-400" />
        <StatCard label="Lost" value={stats.lost} accent="text-red-400" />
      </div>

      {/* Pipeline (stage tabs) */}
      <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-white">Pipeline</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg bg-navy-800 border border-navy-700/50 p-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'customer', label: 'Customer' },
              { id: 'internal', label: 'Internal' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSourceFilter(opt.id)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  sourceFilter === opt.id ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setStageEditorOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-navy-700/50 text-slate-300 hover:text-white hover:border-navy-700 transition-colors"
          >
            Manage stages
          </button>
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex flex-wrap gap-2 border-b border-navy-700/50 mb-4">
        {stageList.map((stg) => {
          const count = (buildsByStage[stg.stage_key] || []).length
          const active = activeStage === stg.stage_key
          return (
            <button
              key={stg.stage_key}
              onClick={() => setActiveStage(stg.stage_key)}
              className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {stg.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-sky-500/15 text-sky-400' : 'bg-white/5 text-slate-500'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Active stage cards */}
      {filteredBuilds.length === 0 ? (
        <div className="rounded-lg p-10 bg-navy-800 border border-navy-700/50 text-center mb-8">
          <p className="text-slate-400">No builds yet.</p>
          <p className="text-sm text-slate-500 mt-1">Customer requests from liftori.ai/build land here automatically, or start a New internal build from the top.</p>
        </div>
      ) : (buildsByStage[activeStage] || []).length === 0 ? (
        <div className="rounded-lg p-10 bg-navy-800 border border-navy-700/50 text-center mb-8">
          <p className="text-slate-400">Nothing in <span className="text-slate-200 font-medium">{stageByKey[activeStage]?.label || activeStage}</span> yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
          {(buildsByStage[activeStage] || []).map((b) => (
            <BuildCard key={b.id} build={b} onClick={() => navigate(`/admin/custom-builds/${b.id}`)} />
          ))}
        </div>
      )}

      {/* What we build */}
      <div className="mb-8 rounded-lg bg-navy-800 border border-navy-700/50">
        <button
          onClick={() => setCatalogOpen((o) => !o)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">What we build</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Our capability menu — the products customers can request and the team can spin up.
            </p>
          </div>
          <Icon
            path={ICONS.chevron}
            className={`w-5 h-5 text-slate-400 transition-transform ${catalogOpen ? '' : '-rotate-90'}`}
          />
        </button>

        {catalogOpen && (
          <div className="px-4 pb-5 space-y-6">
            <div className="mb-2 flex justify-end"><button onClick={() => setEditProduct({ __new: true })} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-navy-700/50 text-slate-300 hover:text-white hover:border-sky-500/50 transition-colors"><Icon path={ICONS.plus} className="w-4 h-4" /> Add product</button></div>
            {CATEGORY_ORDER.map((cat) => {
              const items = productsByCategory[cat] || []
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-500/20 text-sky-400">
                      {cat}
                    </span>
                    <span className="text-xs text-slate-500">{items.length} offering{items.length === 1 ? '' : 's'}</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-slate-500">No products in this category yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setEditProduct(p)} className={"rounded-lg p-4 bg-navy-900 border transition-colors cursor-pointer " + (p.is_active === false ? "opacity-50 hover:opacity-100 border-navy-700/50 hover:border-sky-500/40" : "border-navy-700/50 hover:border-sky-500/40")}
                        >
                          <div className="flex items-center justify-between gap-2"><div className="font-medium text-white">{p.name}</div><div className="flex items-center gap-2">{p.is_active === false && (<span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">Inactive</span>)}<span className="text-xs text-sky-400">Edit</span></div></div>
                          {p.tagline && (
                            <div className="text-sm text-slate-400 mt-1">{p.tagline}</div>
                          )}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-navy-700/50">
                            <span className="text-sm font-medium text-sky-400">
                              {p.starting_price != null ? `From ${money(p.starting_price)}` : 'Custom'}
                            </span>
                            {p.est_timeline && (
                              <span className="text-xs text-slate-500">{p.est_timeline}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editProduct && (
        <ProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={async () => { await loadData(); setEditProduct(null) }}
        />
      )}

      {/* New internal build modal */}
      {showNewModal && (
        <NewBuildModal
          products={products}
          onClose={() => setShowNewModal(false)}
          onCreated={async () => { await loadData(); setShowNewModal(false) }}
        />
      )}

      {stageEditorOpen && (
        <PipelineStagesEditor
          surface="custom_build"
          statusTable="custom_builds"
          statusColumn="status"
          title="Manage Custom Build stages"
          onClose={() => setStageEditorOpen(false)}
          onSaved={async () => { reloadStages(); await loadData() }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({ label, value, accent = 'text-white' }) {
  return (
    <div className="rounded-lg p-4 bg-navy-800 border border-navy-700/50">
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Build card (kanban)
// ---------------------------------------------------------------------------
function BuildCard({ build, onClick }) {
  const customerLine = build.company_name || build.customer_name || (build.source === 'internal' ? 'Internal build' : '')
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg p-3 bg-navy-900 border border-navy-700/50 hover:border-sky-500/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-500">{build.ref || '—'}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            build.source === 'customer'
              ? 'bg-sky-500/20 text-sky-400'
              : 'bg-slate-500/20 text-slate-400'
          }`}
        >
          {build.source === 'customer' ? 'Customer' : 'Internal'}
        </span>
      </div>
      <div className="text-white font-medium mt-1.5 truncate">{build.title || 'Untitled build'}</div>
      {build.product_name && (
        <div className="text-xs text-slate-400 mt-0.5 truncate">{build.product_name}</div>
      )}
      {customerLine && (
        <div className="text-xs text-slate-500 mt-1 truncate">{customerLine}</div>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-navy-700/50">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[build.priority] || PRIORITY_DOT.normal}`} />
          <span className="text-xs text-slate-500 capitalize">{build.priority || 'normal'}</span>
        </div>
        <span className="text-xs text-slate-500">{timeAgo(build.created_at)}</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------
function DetailDrawer({ build, adminName, stages, onClose, onPatch }) {
  const [status, setStatus] = useState(build.status || 'Submitted')
  const [priority, setPriority] = useState(build.priority || 'normal')
  const [progress, setProgress] = useState(build.progress ?? 0)
  const [assignedTo, setAssignedTo] = useState(build.assigned_to || '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [details, setDetails] = useState(build.details || {})

  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  // Sync local form when switching between builds
  useEffect(() => {
    setStatus(build.status || 'Submitted')
    setPriority(build.priority || 'normal')
    setProgress(build.progress ?? 0)
    setAssignedTo(build.assigned_to || '')
    setDetails(build.details || {})
    setSaveMsg(null)
  }, [build.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotes = useCallback(async () => {
    setNotesLoading(true)
    const { data, error } = await supabase
      .from('custom_build_notes')
      .select('*')
      .eq('build_id', build.id)
      .order('created_at', { ascending: true })
    if (!error) setNotes(data || [])
    setNotesLoading(false)
  }, [build.id])

  useEffect(() => { loadNotes() }, [loadNotes])

  // Status select: update DB immediately
  const commitDetail = async (key, val) => {
    const next = { ...details, [key]: val }
    setDetails(next)
    const { error } = await supabase.from('custom_builds').update({ details: next }).eq('id', build.id)
    if (!error) onPatch(build.id, { details: next })
  }

  const onStatusChange = async (value) => {
    const prev = status
    setStatus(value)
    const { error } = await supabase
      .from('custom_builds')
      .update({ status: value })
      .eq('id', build.id)
    if (error) { setStatus(prev); setSaveMsg('Could not update status'); return }
    onPatch(build.id, { status: value })
  }

  const onSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    const patch = {
      priority,
      progress: Number.isNaN(Number(progress)) ? 0 : Number(progress),
      assigned_to: assignedTo || null,
    }
    const { error } = await supabase
      .from('custom_builds')
      .update(patch)
      .eq('id', build.id)
    setSaving(false)
    if (error) { setSaveMsg('Save failed'); return }
    onPatch(build.id, patch)
    setSaveMsg('Saved')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  const onAddNote = async () => {
    const body = newNote.trim()
    if (!body) return
    setAddingNote(true)
    const { error } = await supabase.from('custom_build_notes').insert({
      build_id: build.id,
      author: adminName,
      author_role: 'human',
      note_type: 'note',
      body,
    })
    setAddingNote(false)
    if (error) return
    setNewNote('')
    await loadNotes()
  }

  const scope = build.scope || {}
  const estimate = build.estimate || {}

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-navy-900 border-l border-navy-700/50 overflow-y-auto z-50">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500">{build.ref || '—'}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    build.source === 'customer'
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'bg-slate-500/20 text-slate-400'
                  }`}
                >
                  {build.source === 'customer' ? 'Customer' : 'Internal'}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-white mt-1.5">{build.title || 'Untitled build'}</h2>
              <p className="text-sm text-slate-400 mt-1">
                {[build.product_category, build.product_name, build.industry].filter(Boolean).join(' · ') || 'No product details'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-navy-800 transition-colors"
              aria-label="Close"
            >
              <Icon path={ICONS.close} className="w-5 h-5" />
            </button>
          </div>

          {/* Controls */}
          <div className="rounded-lg p-4 bg-navy-800 border border-navy-700/50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Status">
                <select
                  value={status}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  {(stages && stages.length ? stages.map((o) => ({ k: o.stage_key, l: o.label })) : STAGES.map((o) => ({ k: o, l: o }))).map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 capitalize"
                >
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Progress (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </Field>
              <Field label="Assigned to">
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Unassigned"
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onSave}
                disabled={saving}
                className="text-sm px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saveMsg && <span className="text-xs text-slate-400">{saveMsg}</span>}
            </div>
          </div>

          {/* Project Details (business / value) */}
          <Card title="Project Details">
            <div className="space-y-4">
              {CB_DETAIL_SECTIONS.map((sec) => (
                <div key={sec.title}>
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">{sec.title}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sec.fields.map(([key, label, type]) => (
                      <CbField key={key} label={label} type={type} value={details[key]} onCommit={(val) => commitDetail(key, val)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Customer */}
          <Card title="Customer">
            {(build.customer_name || build.customer_email || build.customer_phone || build.company_name) ? (
              <div className="space-y-1.5 text-sm">
                {build.customer_name && <Row label="Name" value={build.customer_name} />}
                {build.customer_email && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Email</span>
                    <a href={`mailto:${build.customer_email}`} className="text-sky-400 hover:text-sky-300 truncate">
                      {build.customer_email}
                    </a>
                  </div>
                )}
                {build.customer_phone && <Row label="Phone" value={build.customer_phone} />}
                {build.company_name && <Row label="Company" value={build.company_name} />}
              </div>
            ) : (
              <EmptyText>No customer details (internal build).</EmptyText>
            )}
          </Card>

          {/* Scope of work */}
          <Card title="Scope of work">
            <ScopeView scope={scope} />
          </Card>

          {/* Build plan */}
          <Card title="Build plan">
            {build.build_plan ? (
              <div>
                <div className="whitespace-pre-wrap text-sm text-slate-300">{build.build_plan}</div>
                {build.plan_generated_at && (
                  <div className="text-xs text-slate-500 mt-3">Generated {fmtDateTime(build.plan_generated_at)}</div>
                )}
              </div>
            ) : (
              <EmptyText>Plan not generated yet — the plan agent will pick this up on its next run.</EmptyText>
            )}
          </Card>

          {/* Estimate */}
          <Card title="Estimate">
            {estimate && Object.keys(estimate).length > 0 ? (
              <EstimateView estimate={estimate} sentAt={build.estimate_sent_at} />
            ) : (
              <EmptyText>No estimate built yet.</EmptyText>
            )}
          </Card>

          {/* Mockup preview */}
          <Card title="Mockup preview">
            {build.mockup_url ? (
              <div>
                <iframe
                  src={build.mockup_url}
                  title="Mockup preview"
                  className="w-full h-[460px] rounded-lg border border-navy-700/50 bg-white"
                />
                <a
                  href={build.mockup_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 mt-3"
                >
                  Open in new tab
                  <Icon path={ICONS.external} className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <EmptyText>No mockup yet — the mockup agent will generate one.</EmptyText>
            )}
          </Card>

          {/* Agent notes */}
          <Card title="Agent notes">
            {notesLoading ? (
              <EmptyText>Loading notes…</EmptyText>
            ) : notes.length === 0 ? (
              <EmptyText>No notes yet.</EmptyText>
            ) : (
              <div className="space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg p-3 bg-navy-800 border border-navy-700/50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{n.author || 'System'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(n.author_role)}`}>
                        {n.author_role || 'system'}
                      </span>
                      <span className="text-xs text-slate-500">{timeAgo(n.created_at)}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-slate-300 mt-2">{n.body}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="Add a note for the team or agents…"
                className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-y"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={onAddNote}
                  disabled={addingNote || !newNote.trim()}
                  className="text-sm px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium transition-colors"
                >
                  {addingNote ? 'Adding…' : 'Add note'}
                </button>
              </div>
            </div>
          </Card>

          <div className="text-xs text-slate-500">
            Created {fmtDateTime(build.created_at)}
            {build.updated_at && ` · Updated ${fmtDateTime(build.updated_at)}`}
          </div>
        </div>
      </div>
    </>
  )
}

function roleBadge(role) {
  if (role === 'agent') return 'bg-sky-500/20 text-sky-400'
  if (role === 'human') return 'bg-green-500/20 text-green-400'
  return 'bg-slate-500/20 text-slate-400'
}

// ---------------------------------------------------------------------------
// Scope rendering
// ---------------------------------------------------------------------------
function ScopeView({ scope }) {
  const has = (k) => {
    const v = scope?.[k]
    if (v == null) return false
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') return Object.keys(v).length > 0
    return String(v).trim().length > 0
  }
  const anything = scope && Object.keys(scope).some((k) => has(k))
  if (!anything) return <EmptyText>No scope captured.</EmptyText>

  const colors = scope.colors || {}

  return (
    <div className="space-y-4 text-sm">
      {has('features') && (
        <ScopeBlock label="Features">
          <div className="flex flex-wrap gap-2">
            {scope.features.map((f, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium bg-sky-500/20 text-sky-400">{f}</span>
            ))}
          </div>
        </ScopeBlock>
      )}

      {(colors.primary || colors.palette || scope.style) && (
        <ScopeBlock label="Look & feel">
          <div className="flex items-center gap-3 flex-wrap">
            {colors.primary && (
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-md border border-navy-700/50"
                  style={{ backgroundColor: colors.primary }}
                />
                <span className="text-slate-300 font-mono text-xs">{colors.primary}</span>
              </div>
            )}
            {colors.palette && <span className="text-slate-300">{colors.palette}</span>}
            {scope.style && <span className="text-slate-400">{scope.style}</span>}
          </div>
        </ScopeBlock>
      )}

      {has('pages') && (
        <ScopeBlock label="Pages">
          <ChipList items={scope.pages} />
        </ScopeBlock>
      )}

      {has('fields') && (
        <ScopeBlock label="Entry fields">
          <ChipList items={scope.fields} />
        </ScopeBlock>
      )}

      {has('content') && (
        <ScopeBlock label="Content">
          <div className="whitespace-pre-wrap text-slate-300">{scope.content}</div>
        </ScopeBlock>
      )}

      {(has('navigation') || has('navItems')) && (
        <ScopeBlock label="Navigation">
          {has('navigation') && <div className="text-slate-300 mb-2">{scope.navigation}</div>}
          {has('navItems') && <ChipList items={scope.navItems} />}
        </ScopeBlock>
      )}

      {has('details') && (
        <ScopeBlock label="Details">
          <div className="whitespace-pre-wrap text-slate-300">{scope.details}</div>
        </ScopeBlock>
      )}

      {(has('timeline') || has('budget')) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {has('timeline') && (
            <div className="rounded-lg p-3 bg-navy-800 border border-navy-700/50">
              <div className="text-xs text-slate-500">Timeline</div>
              <div className="text-slate-300 mt-0.5">{scope.timeline}</div>
            </div>
          )}
          {has('budget') && (
            <div className="rounded-lg p-3 bg-navy-800 border border-navy-700/50">
              <div className="text-xs text-slate-500">Budget</div>
              <div className="text-slate-300 mt-0.5">{scope.budget}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScopeBlock({ label, children }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function ChipList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it, i) => (
        <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium bg-navy-800 border border-navy-700/50 text-slate-300">
          {String(it)}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Estimate rendering
// ---------------------------------------------------------------------------
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
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-300">{label}</span>
                {amount != null && <span className="text-slate-400">{money(amount)}</span>}
              </div>
            )
          })}
        </div>
      )}

      {sentAt && <div className="text-xs text-slate-500">Sent {fmtDateTime(sentAt)}</div>}
    </div>
  )
}

function EstCell({ label, value, accent }) {
  return (
    <div className="rounded-lg p-3 bg-navy-800 border border-navy-700/50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 font-medium ${accent ? 'text-sky-400' : 'text-slate-300'}`}>{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------
function Card({ title, children }) {
  return (
    <div className="rounded-lg p-4 bg-navy-800 border border-navy-700/50">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 truncate">{value}</span>
    </div>
  )
}

function EmptyText({ children }) {
  return <p className="text-sm text-slate-500">{children}</p>
}

// ---------------------------------------------------------------------------
// New internal build modal
// ---------------------------------------------------------------------------
function ProductModal({ product, onClose, onSaved }) {
  const isNew = !product || !product.id
  const [category, setCategory] = useState((product && product.category) || 'Website')
  const [name, setName] = useState((product && product.name) || '')
  const [tagline, setTagline] = useState((product && product.tagline) || '')
  const [description, setDescription] = useState((product && product.description) || '')
  const [price, setPrice] = useState(product && product.starting_price != null ? String(product.starting_price) : '')
  const [timeline, setTimeline] = useState((product && product.est_timeline) || '')
  const [features, setFeatures] = useState(
    product && Array.isArray(product.default_features) ? product.default_features.join('\n') : ''
  )
  const [sortOrder, setSortOrder] = useState(product && product.sort_order != null ? String(product.sort_order) : '0')
  const [isActive, setIsActive] = useState(!product || product.is_active !== false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const onSave = async () => {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true)
    setErr(null)
    const cleaned = String(price).replace(/[^0-9.]/g, '')
    const priceNum = cleaned === '' ? null : Number(cleaned)
    if (priceNum != null && Number.isNaN(priceNum)) { setSaving(false); setErr('Price must be a number'); return }
    const featuresArr = features.split('\n').map((f) => f.trim()).filter(Boolean)
    const payload = {
      category,
      name: name.trim(),
      slug: (product && product.slug) || slugify(name),
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      starting_price: priceNum,
      est_timeline: timeline.trim() || null,
      default_features: featuresArr,
      is_active: isActive,
      sort_order: Number(sortOrder) || 0,
    }
    const resp = isNew
      ? await supabase.from('custom_build_products').insert(payload)
      : await supabase.from('custom_build_products').update(payload).eq('id', product.id)
    setSaving(false)
    if (resp.error) { setErr(resp.error.message); return }
    await onSaved()
  }

  const INPUT = "w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-navy-900 border border-navy-700/50 rounded-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <h2 className="text-lg font-semibold text-white">{isNew ? 'Add product' : 'Edit product'}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-navy-800 transition-colors"
            aria-label="Close"
          >
            <Icon path={ICONS.close} className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {err && (
            <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{err}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name *">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing / Brand Website" className={INPUT} />
            </Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Tagline">
            <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Short one-liner" className={INPUT} />
          </Field>

          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What this product is" className={INPUT} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Starting price (USD)">
              <input type="text" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 2500" className={INPUT} />
            </Field>
            <Field label="Est. timeline">
              <input type="text" value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. 1-2 weeks" className={INPUT} />
            </Field>
          </div>

          <Field label="Default features (one per line)">
            <textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={5} placeholder="Lead capture" className={INPUT} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Sort order">
              <input type="text" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 mt-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-sky-500" />
                Active (shown to customers)
              </label>
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-navy-700/50">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-navy-700/50 text-slate-300 hover:text-white transition-colors">Cancel</button>
          <button onClick={onSave} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors disabled:opacity-50">{saving ? 'Saving...' : (isNew ? 'Add product' : 'Save changes')}</button>
        </div>
      </div>
    </div>
  )
}

function NewBuildModal({ products, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [productName, setProductName] = useState('')
  const [industry, setIndustry] = useState('')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const catalogForCategory = useMemo(
    () => products.filter((p) => p.is_active !== false && p.category === category),
    [products, category]
  )

  const onCreate = async () => {
    if (!title.trim()) { setErr('Title is required'); return }
    setSaving(true)
    setErr(null)
    const matched = products.find(
      (p) => p.category === category && p.name === productName
    )
    const payload = {
      source: 'internal',
      status: 'Submitted',
      title: title.trim(),
      product_category: category || null,
      product_name: productName || null,
      product_slug: matched?.slug || null,
      industry: industry || null,
      scope: { details: details || '' },
    }
    const { error } = await supabase.from('custom_builds').insert(payload)
    setSaving(false)
    if (error) { setErr(error.message); return }
    await onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-navy-900 border border-navy-700/50 rounded-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <h2 className="text-lg font-semibold text-white">New internal build</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-navy-800 transition-colors"
            aria-label="Close"
          >
            <Icon path={ICONS.close} className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {err && (
            <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{err}</div>
          )}

          <Field label="Title *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Internal ops dashboard"
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setProductName('') }}
                className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">Select category</option>
                {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Product">
              {catalogForCategory.length > 0 ? (
                <select
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">Select product</option>
                  {catalogForCategory.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  <option value="__custom__">Custom (type below)</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={productName === '__custom__' ? '' : productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Product name"
                  className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              )}
            </Field>
          </div>

          {productName === '__custom__' && (
            <Field label="Custom product name">
              <input
                type="text"
                value=""
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Type a product name"
                className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                autoFocus
              />
            </Field>
          )}

          <Field label="Industry">
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Roofing, Restaurant, SaaS"
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </Field>

          <Field label="Details">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="What should this build do? Key requirements, goals, scope notes…"
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-y"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-navy-700/50">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-navy-700/50 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={saving || !title.trim()}
            className="text-sm px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium transition-colors"
          >
            {saving ? 'Creating…' : 'Create build'}
          </button>
        </div>
      </div>
    </div>
  )
}
