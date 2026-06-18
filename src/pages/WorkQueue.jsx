import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'sonner'

const LABS = [
  { value: 'ryan', label: "Ryan's Lab", blurb: 'Your active build bench' },
  { value: 'mike', label: "Mike's Lab", blurb: 'Mike + his agent' },
  { value: 'bug_agent', label: 'Bug Agent', blurb: 'Auto - fixes bugs nightly' },
  { value: 'update_agent', label: 'Update Agent', blurb: 'Auto - features & integrations' },
  { value: 'build_agent', label: 'Build Agent', blurb: 'Auto - full builds (spec-gated)' },
]
const LAB_LABEL = Object.fromEntries(LABS.map(l => [l.value, l.label]))

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'bg-sky-500', textColor: 'text-sky-400' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-500', textColor: 'text-amber-400' },
  { value: 'resolved', label: 'Resolved', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500', textColor: 'text-gray-400' },
  { value: 'wont_fix', label: "Won't Fix", color: 'bg-red-500', textColor: 'text-red-400' },
]
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]))

const CATEGORY_OPTIONS = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'feedback', label: 'Feedback' },
]
const CATEGORY_BADGE = {
  bug: 'bg-red-500/15 text-red-300 border-red-500/30',
  feature: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  feedback: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
}

const BUILD_TYPES = [
  { value: 'app', label: 'App' },
  { value: 'web_app', label: 'Web App' },
  { value: 'website', label: 'Website' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'mobile_app', label: 'Mobile App' },
  { value: 'feature', label: 'Feature' },
  { value: 'bug_fix', label: 'Bug Fix' },
  { value: 'integration', label: 'Integration' },
  { value: 'other', label: 'Other' },
]
const BUILD_TYPE_LABEL = Object.fromEntries(BUILD_TYPES.map(b => [b.value, b.label]))

const PRIORITY_CONFIG = {
  critical: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Critical', sort: 0 },
  high: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'High', sort: 1 },
  medium: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Medium', sort: 2 },
  low: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Low', sort: 3 },
}
const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

// Fields editable in the build-out window, persisted to work_queue
const SCOPE_FIELDS = [
  'title', 'summary', 'build_type', 'lab', 'type', 'priority', 'status', 'page',
  'description', 'goals', 'scope_detail', 'steps_to_reproduce',
  'plan_waves', 'design_notes', 'references_links', 'tech_notes',
  'acceptance_criteria', 'build_notes',
]

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function WorkQueue() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [lab, setLab] = useState('all')
  const [filter, setFilter] = useState({ status: '', type: '', priority: '' })
  const [selectedItem, setSelectedItem] = useState(null)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('work_queue')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Error fetching work queue:', err)
      toast.error('Failed to load Build Queue')
    } finally {
      setLoading(false)
    }
  }

  // Lab counts (across all, ignoring the secondary filters)
  const labCounts = useMemo(() => {
    const c = { all: items.length }
    for (const l of LABS) c[l.value] = 0
    for (const it of items) c[it.lab || 'ryan'] = (c[it.lab || 'ryan'] || 0) + 1
    return c
  }, [items])

  // Visible items = lab tab + secondary filters
  const visible = useMemo(() => {
    return items.filter(it => {
      if (lab !== 'all' && (it.lab || 'ryan') !== lab) return false
      if (filter.status && it.status !== filter.status) return false
      if (filter.type && it.type !== filter.type) return false
      if (filter.priority && it.priority !== filter.priority) return false
      return true
    })
  }, [items, lab, filter])

  const stats = useMemo(() => {
    const base = lab === 'all' ? items : items.filter(it => (it.lab || 'ryan') === lab)
    return {
      open: base.filter(i => i.status === 'open').length,
      in_progress: base.filter(i => i.status === 'in_progress').length,
      resolved: base.filter(i => i.status === 'resolved').length,
      total: base.length,
    }
  }, [items, lab])

  function newDraft() {
    return {
      title: '', summary: '', build_type: '', lab: (lab !== 'all' ? lab : 'ryan'),
      type: 'feature', priority: 'medium', status: 'open', page: '',
      description: '', goals: '', scope_detail: '', steps_to_reproduce: '',
      plan_waves: '', design_notes: '', references_links: '', tech_notes: '',
      acceptance_criteria: '', build_notes: '', created_at: new Date().toISOString(),
      _isNew: true,
    }
  }

  async function saveItem(updated, prev) {
    try {
      const patch = {}
      for (const f of SCOPE_FIELDS) patch[f] = updated[f] ?? null

      // Create mode
      if (!updated.id) {
        if (!(updated.title || '').trim()) { toast.error('Give the Build Task a title first'); return }
        patch.reported_by = user.id
        patch.reporter_name = profile?.full_name || user?.email || 'Unknown'
        patch.reporter_email = user?.email
        const { data, error } = await supabase.from('work_queue').insert(patch).select().single()
        if (error) throw error
        setItems(list => [data, ...list])
        toast.success('Build Task created')
        setSelectedItem(null)
        return
      }

      patch.updated_at = new Date().toISOString()
      if ((updated.status === 'resolved' || updated.status === 'closed') && !prev.resolved_at) {
        patch.resolved_at = new Date().toISOString()
      }
      if (updated.status === 'in_progress' && !prev.assigned_to) patch.assigned_to = user.id

      const { error } = await supabase.from('work_queue').update(patch).eq('id', updated.id)
      if (error) throw error

      // Notify reporter if status changed
      if (prev.status !== updated.status && updated.reported_by) {
        await supabase.from('notifications').insert({
          user_id: updated.reported_by,
          type: 'project_update',
          title: `Build Task updated: ${STATUS_LABEL[updated.status] || updated.status}`,
          body: `"${updated.title}" moved to ${STATUS_LABEL[updated.status] || updated.status} by ${profile?.full_name || 'a team member'}`,
          link: '/admin/work-queue',
          read: false,
        }).then(() => {}, () => {})
      }

      toast.success('Build Task saved')
      setItems(list => list.map(i => (i.id === updated.id ? { ...i, ...patch } : i)))
      setSelectedItem(null)
    } catch (err) {
      console.error('Error saving build task:', err)
      toast.error('Failed to save')
    }
  }

  async function assignLab(e, item, newLab) {
    e.stopPropagation()
    if (newLab === (item.lab || 'ryan')) return
    try {
      const { error } = await supabase
        .from('work_queue')
        .update({ lab: newLab, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      if (error) throw error
      setItems(list => list.map(i => (i.id === item.id ? { ...i, lab: newLab } : i)))
      toast.success(`Moved to ${LAB_LABEL[newLab]}`)
    } catch (err) {
      console.error('Error assigning lab:', err)
      toast.error('Failed to move')
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Build Queue</h1>
          <p className="text-gray-500 text-sm mt-1">Every Build Task across the labs - fixes, features, and full builds.</p>
        </div>
        <button
          onClick={() => setSelectedItem(newDraft())}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-sky-500 text-white hover:bg-sky-400 transition-colors"
        >
          + New Build Task
        </button>
      </div>

      {/* Lab Tabs */}
      <div className="flex flex-wrap items-stretch gap-2 mb-5">
        {[{ value: 'all', label: 'All Labs', blurb: 'Everything in the queue' }, ...LABS].map(l => {
          const active = lab === l.value
          return (
            <button
              key={l.value}
              onClick={() => { setLab(l.value); setSelectedItem(null) }}
              className={`flex-1 min-w-[180px] text-left rounded-xl border px-4 py-3 transition-all ${
                active
                  ? 'bg-navy-800 border-sky-500/60 ring-1 ring-sky-500/30'
                  : 'bg-navy-800/40 border-navy-700/50 hover:border-navy-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-300'}`}>{l.label}</span>
                <span className={`text-sm font-bold ${active ? 'text-sky-400' : 'text-gray-500'}`}>{labCounts[l.value] ?? 0}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">{l.blurb}</p>
            </button>
          )
        })}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Open', value: stats.open, color: 'text-sky-400', bg: 'bg-sky-500/10' },
          { label: 'In Progress', value: stats.in_progress, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Resolved', value: stats.resolved, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: lab === 'all' ? 'Total' : 'In Lab', value: stats.total, color: 'text-gray-300', bg: 'bg-navy-800' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-navy-700/50 rounded-xl p-4`}>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color} mt-1`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters (status line) */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
          {[{ value: '', label: 'All' }, ...STATUS_OPTIONS].map(s => (
            <button
              key={s.value}
              onClick={() => setFilter({ ...filter, status: s.value })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter.status === s.value ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
          {[{ value: '', label: 'All Types' }, ...CATEGORY_OPTIONS].map(t => (
            <button
              key={t.value}
              onClick={() => setFilter({ ...filter, type: t.value })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter.type === t.value ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
          {[{ value: '', label: 'All Priority' }, ...PRIORITY_OPTIONS].map(p => (
            <button
              key={p.value}
              onClick={() => setFilter({ ...filter, priority: p.value })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter.priority === p.value ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <span className="text-gray-600 text-xs ml-auto">{visible.length} Build Tasks</span>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No Build Tasks here</p>
            <p className="text-gray-600 text-sm mt-1">Reports from the header land in Ryan's Lab. Move them to a lab to organize.</p>
          </div>
        ) : visible.map(item => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedItem(item)}
            onKeyDown={e => { if (e.key === 'Enter') setSelectedItem(item) }}
            className="w-full text-left p-4 rounded-xl border bg-navy-800/50 border-navy-700/50 transition-all hover:border-navy-600 cursor-pointer flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-sm font-medium text-white truncate">{item.title}</h3>
                {item.build_type && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-navy-700 text-gray-300 border border-navy-600 whitespace-nowrap">
                    {BUILD_TYPE_LABEL[item.build_type] || item.build_type}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full border ${CATEGORY_BADGE[item.type] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
                  {CATEGORY_OPTIONS.find(c => c.value === item.type)?.label || item.type}
                </span>
                <span className={`px-2 py-0.5 rounded-full border ${PRIORITY_CONFIG[item.priority]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                  {PRIORITY_CONFIG[item.priority]?.label || item.priority}
                </span>
                <span className={`px-2 py-0.5 rounded-full ${STATUS_OPTIONS.find(s => s.value === item.status)?.color || 'bg-gray-500'} text-white`}>
                  {STATUS_LABEL[item.status] || item.status}
                </span>
                {item.page && <span className="text-gray-500">{item.page}</span>}
                <span className="text-gray-600">{item.reporter_name} · {timeAgo(item.created_at)}</span>
              </div>
            </div>
            {/* Inline lab assign */}
            <div className="shrink-0 flex flex-col items-end gap-1" onClick={e => e.stopPropagation()}>
              <span className="text-[10px] uppercase tracking-wider text-gray-600">Assign to</span>
              <select
                value={item.lab || 'ryan'}
                onClick={e => e.stopPropagation()}
                onChange={e => assignLab(e, item, e.target.value)}
                title="Assign this Build Task to a lab"
                className="bg-navy-900 border border-navy-600 rounded-lg px-2 py-1.5 text-xs text-gray-200 cursor-pointer focus:outline-none focus:border-sky-500/60 hover:border-navy-500"
              >
                {LABS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <BuildTaskWindow
          key={selectedItem.id}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSave={saveItem}
        />
      )}
    </div>
  )
}

// ============================================================
// Large 7-tab Build Task build-out window
// ============================================================
const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'scope', label: 'Scope & Spec' },
  { value: 'plan', label: 'Plan / Waves' },
  { value: 'design', label: 'Design' },
  { value: 'technical', label: 'Technical' },
  { value: 'qa', label: 'Acceptance / QA' },
  { value: 'activity', label: 'Activity & Notes' },
]

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-600 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-sky-500/60'
const areaCls = inputCls + ' resize-y leading-relaxed'

function BuildTaskWindow({ item, onClose, onSave }) {
  const [tab, setTab] = useState('overview')
  const [form, setForm] = useState(() => ({ ...item }))
  const [dirty, setDirty] = useState(false)
  const isNew = !item.id
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setDirty(true) }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-[88vh] bg-navy-800 border border-navy-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-navy-700/60">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">{isNew ? 'New Build Task' : 'Build Task'}</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] bg-navy-700 text-gray-300 border border-navy-600">
                {LAB_LABEL[form.lab || 'ryan']}
              </span>
              {form.build_type && (
                <span className="px-2 py-0.5 rounded-md text-[10px] bg-navy-700 text-gray-300 border border-navy-600">
                  {BUILD_TYPE_LABEL[form.build_type]}
                </span>
              )}
            </div>
            <input
              value={form.title || ''}
              onChange={e => set('title', e.target.value)}
              className="w-full bg-transparent text-xl font-bold text-white focus:outline-none border-b border-transparent focus:border-navy-600"
              placeholder="Build Task title"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onSave(form, item)}
              disabled={!isNew && !dirty}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                (isNew || dirty) ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-navy-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isNew ? 'Create' : (dirty ? 'Save' : 'Saved')}
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-4 pt-3 border-b border-navy-700/60 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3.5 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.value
                  ? 'bg-navy-900 text-white border-b-2 border-sky-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-navy-900/40">
          {tab === 'overview' && (
            <div className="space-y-5 max-w-3xl">
              <Field label="One-line summary" hint="The quick read — what this Build Task delivers.">
                <input value={form.summary || ''} onChange={e => set('summary', e.target.value)} className={inputCls} placeholder="e.g. Rebuild the Work Queue into a 3-lab Build Task system" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Lab">
                  <select value={form.lab || 'ryan'} onChange={e => set('lab', e.target.value)} className={inputCls}>
                    {LABS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </Field>
                <Field label="Build type">
                  <select value={form.build_type || ''} onChange={e => set('build_type', e.target.value)} className={inputCls}>
                    <option value="">— Select —</option>
                    {BUILD_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select value={form.type || ''} onChange={e => set('type', e.target.value)} className={inputCls}>
                    {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <select value={form.priority || 'medium'} onChange={e => set('priority', e.target.value)} className={inputCls}>
                    {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status || 'open'} onChange={e => set('status', e.target.value)} className={inputCls}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Area / Page" hint="Where this lives (page, app, repo).">
                  <input value={form.page || ''} onChange={e => set('page', e.target.value)} className={inputCls} placeholder="e.g. Operations · Dev Lab" />
                </Field>
              </div>
            </div>
          )}

          {tab === 'scope' && (
            <div className="space-y-5 max-w-3xl">
              <Field label="What we're building" hint="The full description of the work.">
                <textarea rows={6} value={form.description || ''} onChange={e => set('description', e.target.value)} className={areaCls} placeholder="Describe the build in full…" />
              </Field>
              <Field label="Goals / outcome" hint="What does done look like — the why.">
                <textarea rows={4} value={form.goals || ''} onChange={e => set('goals', e.target.value)} className={areaCls} placeholder="The outcome this should produce…" />
              </Field>
              <Field label="Detailed scope" hint="Every screen, field, flow, and edge case. The more here, the better unattended builds run.">
                <textarea rows={10} value={form.scope_detail || ''} onChange={e => set('scope_detail', e.target.value)} className={areaCls} placeholder="Full scope — components, data, flows, in/out of scope…" />
              </Field>
              <Field label="Steps to reproduce (bugs)" hint="Only for bug-category tasks.">
                <textarea rows={4} value={form.steps_to_reproduce || ''} onChange={e => set('steps_to_reproduce', e.target.value)} className={areaCls} placeholder="1. … 2. … 3. …" />
              </Field>
            </div>
          )}

          {tab === 'plan' && (
            <div className="space-y-5 max-w-3xl">
              <Field label="Build plan — waves" hint="Slice the build into verifiable waves (A/B/C…). This is what the builder executes against.">
                <textarea rows={16} value={form.plan_waves || ''} onChange={e => set('plan_waves', e.target.value)} className={areaCls + ' font-mono text-[13px]'} placeholder={'Wave A — …\nWave B — …\nWave C — …'} />
              </Field>
            </div>
          )}

          {tab === 'design' && (
            <div className="space-y-5 max-w-3xl">
              <Field label="Design notes" hint="Layout, components, brand, states. Must not look AI-built.">
                <textarea rows={9} value={form.design_notes || ''} onChange={e => set('design_notes', e.target.value)} className={areaCls} placeholder="Visual direction, navy palette, key screens, interactions…" />
              </Field>
              <Field label="References & links" hint="Mockups, similar screens, inspiration, related docs.">
                <textarea rows={5} value={form.references_links || ''} onChange={e => set('references_links', e.target.value)} className={areaCls} placeholder="URLs, file paths, related tasks…" />
              </Field>
            </div>
          )}

          {tab === 'technical' && (
            <div className="space-y-5 max-w-3xl">
              <Field label="Technical notes" hint="Repo, files, DB tables, RLS, edge functions, env vars, dependencies, gotchas.">
                <textarea rows={16} value={form.tech_notes || ''} onChange={e => set('tech_notes', e.target.value)} className={areaCls + ' font-mono text-[13px]'} placeholder={'Repo: \nFiles: \nDB / tables: \nEdge fns: \nEnv / secrets: \nGotchas: '} />
              </Field>
            </div>
          )}

          {tab === 'qa' && (
            <div className="space-y-5 max-w-3xl">
              <Field label="Acceptance criteria & QA checklist" hint="Every button, dropdown, link, and flow to verify before handoff.">
                <textarea rows={16} value={form.acceptance_criteria || ''} onChange={e => set('acceptance_criteria', e.target.value)} className={areaCls} placeholder={'[ ] …\n[ ] …\n[ ] every control tested in Chrome'} />
              </Field>
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-5 max-w-3xl">
              <Field label="Working notes" hint="Running log — decisions, progress, blockers.">
                <textarea rows={8} value={form.build_notes || ''} onChange={e => set('build_notes', e.target.value)} className={areaCls} placeholder="Notes as the build progresses…" />
              </Field>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-navy-700/60 bg-navy-900/60 p-4">
                <Meta label="Reported by" value={item.reporter_name || '—'} />
                <Meta label="Reported" value={`${new Date(item.created_at).toLocaleDateString()} (${timeAgo(item.created_at)})`} />
                <Meta label="Last updated" value={item.updated_at ? timeAgo(item.updated_at) : '—'} />
                <Meta label="Resolved" value={item.resolved_at ? new Date(item.resolved_at).toLocaleDateString() : 'Not yet'} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quick status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => set('status', s.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.status === s.value ? `${s.color} text-white` : 'bg-navy-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-600 mt-2">Status changes save with the Save button.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-300">{value}</p>
    </div>
  )
}
