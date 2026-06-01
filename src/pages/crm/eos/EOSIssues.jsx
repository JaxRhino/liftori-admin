// =====================================================================
// EOSIssues - Running issues list + IDS (Identify Discuss Solve)
// Wave C.2.1
// Reads/writes: eos_issues (per-tenant LABOS DB)
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'

// ---------- formatters ----------
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const shortId = (id) => (id ? String(id).slice(0, 8) : '-')
function relTime(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(d)
}

// ---------- constants ----------
const PRIORITIES = [
  { key: 'high',   label: 'High',   tone: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  { key: 'medium', label: 'Medium', tone: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { key: 'low',    label: 'Low',    tone: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
]
const STATUSES = [
  { key: 'open',     label: 'Open',     tone: 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40' },
  { key: 'solved',   label: 'Solved',   tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { key: 'archived', label: 'Archived', tone: 'bg-navy-700/60 text-gray-300 border-navy-700/60' },
]
const SOURCE_TYPES = ['L10', 'scorecard', 'ad-hoc', 'customer', 'team']

// ---------- local primitives ----------
function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`bg-navy-800 border border-navy-700/60 rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40">{footer}</div>}
      </div>
    </div>
  )
}

function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <div
        className="w-full sm:w-[560px] bg-navy-800 border-l border-navy-700/50 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between sticky top-0 bg-navy-800 z-10">
          <div className="min-w-0">{title}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm shrink-0 ml-3">Close</button>
        </div>
        <div className="p-5 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40 sticky bottom-0">{footer}</div>}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder, rows }) {
  const base = 'w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan'
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      {rows ? (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={base} />
      ) : (
        <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
      >
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

function Textarea(props) { return <Input {...props} rows={props.rows || 3} /> }

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition ${
        active
          ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan'
          : 'bg-navy-900/40 border-navy-700/60 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function TabBtn({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
        active
          ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40'
          : 'text-gray-400 hover:text-white border border-transparent'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy-700/60">{count}</span>
      )}
    </button>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-navy-700/40 last:border-b-0">
      <span className="text-gray-400">{label}</span>
      <span className="text-white text-right max-w-[260px] truncate">{value || '-'}</span>
    </div>
  )
}

function PriorityBadge({ priority }) {
  const p = PRIORITIES.find(x => x.key === priority)
  if (!p) return <span className="text-[10px] px-2 py-0.5 rounded border bg-navy-700/60 text-gray-300 border-navy-700/60 uppercase">{priority || '-'}</span>
  return <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${p.tone}`}>{p.label}</span>
}

function StatusBadge({ status }) {
  const s = STATUSES.find(x => x.key === status)
  if (!s) return <span className="text-[10px] px-2 py-0.5 rounded border bg-navy-700/60 text-gray-300 border-navy-700/60 uppercase">{status || '-'}</span>
  return <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${s.tone}`}>{s.label}</span>
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function EOSIssues() {
  const { client, platform } = useCrmClient()

  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('list') // list | kanban
  const [newOpen, setNewOpen] = useState(false)
  const [drawer, setDrawer] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      let q = client.from('eos_issues').select('*')
      if (statusFilter === 'open') q = q.eq('status', 'open').is('archived_at', null)
      else if (statusFilter === 'solved') q = q.eq('status', 'solved').is('archived_at', null)
      else if (statusFilter === 'archived') q = q.not('archived_at', 'is', null)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(300)
      if (error) throw error
      setIssues(data || [])
    } catch (e) {
      console.error('[EOSIssues] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, statusFilter])

  // ---- stats ----
  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000
    const openCount = issues.filter(i => i.status === 'open' && !i.archived_at).length
    const highOpen = issues.filter(i => i.status === 'open' && i.priority === 'high' && !i.archived_at).length
    const solvedThisWeek = issues.filter(i => i.status === 'solved' && new Date(i.updated_at).getTime() >= weekAgo).length
    const solved = issues.filter(i => i.status === 'solved' && i.time_to_solve_hours != null)
    const avgHrs = solved.length > 0
      ? Math.round(solved.reduce((a, b) => a + (Number(b.time_to_solve_hours) || 0), 0) / solved.length)
      : null
    return {
      open: openCount,
      highOpen,
      solvedThisWeek,
      avgHrs: avgHrs == null ? '-' : `${avgHrs}h`,
    }
  }, [issues])

  // ---- filtered ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return issues.filter(i => {
      if (priorityFilter !== 'all' && i.priority !== priorityFilter) return false
      if (sourceFilter !== 'all') {
        const st = i.source?.type || '-'
        if (st !== sourceFilter) return false
      }
      if (q) {
        const hay = `${i.title || ''} ${i.description || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [issues, priorityFilter, sourceFilter, search])

  // ---- top sources for chip row ----
  const topSources = useMemo(() => {
    const counts = {}
    issues.forEach(i => {
      const t = i.source?.type
      if (!t) return
      counts[t] = (counts[t] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0])
  }, [issues])

  return (
    <HubPage
      title="Issues"
      subtitle={`Identify, Discuss, Solve${platform?.clientName ? ` - ${platform.clientName}` : ''}`}
      actions={
        <button
          onClick={() => setNewOpen(true)}
          className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium hover:brightness-110"
        >
          + New Issue
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open Issues" value={stats.open} />
        <StatCard label="High Priority" value={stats.highOpen} accent="text-rose-400" />
        <StatCard label="Solved (7d)" value={stats.solvedThisWeek} accent="text-emerald-400" />
        <StatCard label="Avg Time to Solve" value={stats.avgHrs} accent="text-brand-cyan" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Status</span>
        {['all', 'open', 'solved', 'archived'].map(s => (
          <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Priority</span>
        <Chip active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')}>all</Chip>
        {PRIORITIES.map(p => (
          <Chip key={p.key} active={priorityFilter === p.key} onClick={() => setPriorityFilter(p.key)}>{p.label}</Chip>
        ))}
      </div>
      {topSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Source</span>
          <Chip active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>all</Chip>
          {topSources.map(s => (
            <Chip key={s} active={sourceFilter === s} onClick={() => setSourceFilter(s)}>{s}</Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="search"
          placeholder="Search title or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
        />
        <div className="flex items-center gap-2">
          <TabBtn active={view === 'list'} onClick={() => setView('list')}>List</TabBtn>
          <TabBtn active={view === 'kanban'} onClick={() => setView('kanban')}>Kanban</TabBtn>
        </div>
      </div>

      {loading ? (
        <Section title="Issues"><div className="p-6 text-sm text-gray-500">Loading issues...</div></Section>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No issues"
          description="No issues match the current filter. Create one or open the IDS list at L10."
          cta={
            <button
              onClick={() => setNewOpen(true)}
              className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium"
            >
              + New Issue
            </button>
          }
        />
      ) : view === 'list' ? (
        <IssueTable issues={filtered} onOpen={(i) => setDrawer(i)} />
      ) : (
        <IssueKanban issues={filtered} onOpen={(i) => setDrawer(i)} />
      )}

      <NewIssueModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        client={client}
        onSaved={() => { setNewOpen(false); load() }}
      />

      <IssueDrawer
        issue={drawer}
        onClose={() => setDrawer(null)}
        client={client}
        onChanged={() => { setDrawer(null); load() }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                                ISSUE TABLE
// ===========================================================================
function IssueTable({ issues, onOpen }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-900/60 border-b border-navy-700/50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Priority</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Owner</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Dept</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Source</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Created</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Solve Time</th>
            </tr>
          </thead>
          <tbody>
            {issues.map(i => (
              <tr
                key={i.id}
                onClick={() => onOpen(i)}
                className="border-b border-navy-700/30 hover:bg-navy-900/40 cursor-pointer"
              >
                <td className="px-3 py-2"><PriorityBadge priority={i.priority} /></td>
                <td className="px-3 py-2 text-white max-w-[300px] truncate">{i.title}</td>
                <td className="px-3 py-2"><StatusBadge status={i.archived_at ? 'archived' : i.status} /></td>
                <td className="px-3 py-2 text-gray-400">{shortId(i.owner_id)}</td>
                <td className="px-3 py-2 text-gray-400">{i.department || '-'}</td>
                <td className="px-3 py-2 text-gray-400">{i.source?.type || '-'}</td>
                <td className="px-3 py-2 text-gray-500">{relTime(i.created_at)}</td>
                <td className="px-3 py-2 text-gray-400">{i.time_to_solve_hours != null ? `${Math.round(i.time_to_solve_hours)}h` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===========================================================================
//                                ISSUE KANBAN
// ===========================================================================
function IssueKanban({ issues, onOpen }) {
  const open = issues.filter(i => i.status === 'open' && !i.ids_process?.discussed && !i.archived_at)
  const inDiscussion = issues.filter(i => i.status === 'open' && i.ids_process?.discussed && !i.ids_process?.solved && !i.archived_at)
  const solved = issues.filter(i => i.status === 'solved' || i.ids_process?.solved)

  const cols = [
    { title: 'Open', items: open, tone: 'text-brand-cyan' },
    { title: 'In Discussion', items: inDiscussion, tone: 'text-amber-300' },
    { title: 'Solved', items: solved, tone: 'text-emerald-300' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cols.map(col => (
        <div key={col.title} className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden flex flex-col min-h-[200px]">
          <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
            <h3 className={`font-semibold text-sm ${col.tone}`}>{col.title}</h3>
            <span className="text-xs text-gray-500">{col.items.length}</span>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto">
            {col.items.length === 0 && <p className="text-xs text-gray-600 text-center py-4">empty</p>}
            {col.items.map(i => (
              <button
                key={i.id}
                onClick={() => onOpen(i)}
                className="w-full text-left bg-navy-900/50 border border-navy-700/40 rounded-lg p-3 hover:border-brand-cyan/40 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <PriorityBadge priority={i.priority} />
                  <span className="text-[10px] text-gray-500">{relTime(i.created_at)}</span>
                </div>
                <p className="text-sm text-white line-clamp-2">{i.title}</p>
                {i.owner_id && <p className="text-[10px] text-gray-500 mt-1">Owner: {shortId(i.owner_id)}</p>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ===========================================================================
//                                NEW ISSUE MODAL
// ===========================================================================
function NewIssueModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    reporter_id: '',
    department: '',
    sourceType: 'L10',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        title: '',
        description: '',
        priority: 'medium',
        reporter_id: '',
        department: '',
        sourceType: 'L10',
      })
    }
  }, [open])

  async function save() {
    if (!client) return
    if (!form.title.trim()) { alert('Title is required'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        priority: form.priority || 'medium',
        status: 'open',
        reporter_id: form.reporter_id || null,
        department: form.department || null,
        source: { type: form.sourceType || 'ad-hoc' },
        ids_process: { discussed: false, solved: false, comments: [] },
        comments: [],
      }
      const { error } = await client.from('eos_issues').insert(payload)
      if (error) throw error
      onSaved?.()
    } catch (e) {
      console.error('[EOSIssues] save', e)
      alert('Failed to save: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Issue"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Create Issue'}
          </button>
        </div>
      }
    >
      <Input label="Title" value={form.title} onChange={(v) => setForm(f => ({ ...f, title: v }))} placeholder="What is the issue?" />
      <Textarea label="Description" value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} rows={4} />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Priority"
          value={form.priority}
          onChange={(v) => setForm(f => ({ ...f, priority: v }))}
          options={PRIORITIES.map(p => ({ value: p.key, label: p.label }))}
        />
        <Select
          label="Source"
          value={form.sourceType}
          onChange={(v) => setForm(f => ({ ...f, sourceType: v }))}
          options={SOURCE_TYPES.map(s => ({ value: s, label: s }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Reporter ID" value={form.reporter_id} onChange={(v) => setForm(f => ({ ...f, reporter_id: v }))} placeholder="uuid" />
        <Input label="Department" value={form.department} onChange={(v) => setForm(f => ({ ...f, department: v }))} placeholder="Sales" />
      </div>
    </Modal>
  )
}

// ===========================================================================
//                                ISSUE DETAIL DRAWER
// ===========================================================================
function IssueDrawer({ issue, onClose, client, onChanged }) {
  const [tab, setTab] = useState('overview')
  const [draft, setDraft] = useState(issue)
  const [saving, setSaving] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [solveOpen, setSolveOpen] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')

  useEffect(() => {
    setDraft(issue)
    setTab('overview')
    setNewComment('')
    setResolutionNote('')
  }, [issue])

  if (!issue) return null

  async function saveField(updates) {
    if (!client) return
    setSaving(true)
    try {
      const { error } = await client.from('eos_issues').update(updates).eq('id', issue.id)
      if (error) throw error
      setDraft(d => ({ ...d, ...updates }))
    } catch (e) {
      console.error('[EOSIssues] saveField', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function saveAll() {
    await saveField({
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      status: draft.status,
      owner_id: draft.owner_id || null,
      reporter_id: draft.reporter_id || null,
      department: draft.department,
      source: draft.source || null,
    })
    onChanged?.()
  }

  async function toggleIds(key) {
    const next = { ...(draft.ids_process || {}) }
    next[key] = !next[key]
    await saveField({ ids_process: next })
  }

  async function addComment() {
    if (!newComment.trim()) return
    const arr = Array.isArray(draft.ids_process?.comments) ? [...draft.ids_process.comments] : []
    arr.push({ by: null, at: new Date().toISOString(), message: newComment.trim() })
    const next = { ...(draft.ids_process || {}), comments: arr }
    await saveField({ ids_process: next })
    setNewComment('')
  }

  async function solve() {
    if (!client) return
    setSaving(true)
    try {
      const createdAt = draft.created_at ? new Date(draft.created_at).getTime() : Date.now()
      const hrs = Math.max(0, Math.round((Date.now() - createdAt) / 36e5))
      const idsComments = Array.isArray(draft.ids_process?.comments) ? [...draft.ids_process.comments] : []
      if (resolutionNote.trim()) {
        idsComments.push({ by: null, at: new Date().toISOString(), message: '[Resolution] ' + resolutionNote.trim() })
      }
      const next = { ...(draft.ids_process || {}), discussed: true, solved: true, comments: idsComments }
      const { error } = await client.from('eos_issues').update({
        status: 'solved',
        ids_process: next,
        time_to_solve_hours: hrs,
      }).eq('id', issue.id)
      if (error) throw error
      onChanged?.()
    } catch (e) {
      console.error('[EOSIssues] solve', e)
      alert('Solve failed: ' + (e.message || e))
    } finally {
      setSaving(false)
      setSolveOpen(false)
    }
  }

  async function archive() {
    if (!confirm('Archive this issue?')) return
    await saveField({ archived_at: new Date().toISOString() })
    onChanged?.()
  }

  const ids = draft?.ids_process || {}
  const comments = Array.isArray(ids.comments) ? [...ids.comments].reverse() : []

  return (
    <Drawer
      open={!!issue}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <PriorityBadge priority={draft?.priority} />
          <StatusBadge status={draft?.archived_at ? 'archived' : draft?.status} />
          <span className="text-white font-semibold truncate">{draft?.title || 'Issue'}</span>
        </div>
      }
      footer={
        <div className="flex justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={archive}
              disabled={!!draft?.archived_at}
              className="text-sm px-3 py-2 rounded-lg bg-navy-700/60 text-gray-300 hover:bg-navy-700/80 disabled:opacity-40"
            >
              Archive
            </button>
            <button
              onClick={() => setSolveOpen(true)}
              disabled={draft?.status === 'solved'}
              className="text-sm px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              Solve
            </button>
          </div>
          <button
            onClick={saveAll}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      {/* IDS toggle row */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-navy-900/40 border border-navy-700/40">
        <span className="text-xs uppercase tracking-wider text-gray-500 mr-2">IDS</span>
        <IdsToggle label="Identify" active disabled />
        <IdsToggle label="Discuss" active={!!ids.discussed} onClick={() => toggleIds('discussed')} />
        <IdsToggle label="Solve" active={!!ids.solved} onClick={() => toggleIds('solved')} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
        <TabBtn active={tab === 'comments'} onClick={() => setTab('comments')} count={comments.length}>Comments</TabBtn>
        <TabBtn active={tab === 'linked'} onClick={() => setTab('linked')}>Linked</TabBtn>
      </div>

      {tab === 'overview' && draft && (
        <div>
          <Input label="Title" value={draft.title} onChange={(v) => setDraft(d => ({ ...d, title: v }))} />
          <Textarea label="Description" value={draft.description} onChange={(v) => setDraft(d => ({ ...d, description: v }))} rows={4} />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={draft.priority}
              onChange={(v) => setDraft(d => ({ ...d, priority: v }))}
              options={PRIORITIES.map(p => ({ value: p.key, label: p.label }))}
            />
            <Select
              label="Status"
              value={draft.status}
              onChange={(v) => setDraft(d => ({ ...d, status: v }))}
              options={[{ value: 'open', label: 'Open' }, { value: 'solved', label: 'Solved' }]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Reporter ID" value={draft.reporter_id || ''} onChange={(v) => setDraft(d => ({ ...d, reporter_id: v }))} />
            <Input label="Owner ID" value={draft.owner_id || ''} onChange={(v) => setDraft(d => ({ ...d, owner_id: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={draft.department} onChange={(v) => setDraft(d => ({ ...d, department: v }))} />
            <Select
              label="Source type"
              value={draft.source?.type || ''}
              onChange={(v) => setDraft(d => ({ ...d, source: { ...(d.source || {}), type: v } }))}
              options={SOURCE_TYPES.map(s => ({ value: s, label: s }))}
            />
          </div>
          <DetailRow label="Created" value={fmtDate(draft.created_at)} />
          <DetailRow label="Updated" value={fmtDate(draft.updated_at)} />
          {draft.time_to_solve_hours != null && (
            <DetailRow label="Time to solve" value={`${Math.round(draft.time_to_solve_hours)}h`} />
          )}
        </div>
      )}

      {tab === 'comments' && (
        <div>
          <div className="mb-4">
            <Textarea label="Add comment" value={newComment} onChange={setNewComment} rows={3} placeholder="Discussion notes..." />
            <button
              onClick={addComment}
              disabled={!newComment.trim()}
              className="bg-brand-cyan text-navy-900 text-sm px-3 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              Post
            </button>
          </div>
          <div className="space-y-2">
            {comments.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
            {comments.map((c, i) => (
              <div key={i} className="bg-navy-900/40 border border-navy-700/40 rounded-lg p-3">
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                  <span>{shortId(c.by)}</span>
                  <span>{relTime(c.at)}</span>
                </div>
                <p className="text-sm text-white whitespace-pre-wrap">{c.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'linked' && (
        <div className="space-y-4">
          <LinkedSection label="Linked Rocks" ids={draft?.linked_rocks} />
          <LinkedSection label="Linked To-Dos" ids={draft?.linked_todos} />
          <LinkedSection label="Linked Meetings" ids={draft?.linked_meetings} />
          <p className="text-xs text-gray-500">Linking pickers land in Wave F. UUID display only for now.</p>
        </div>
      )}

      <Modal
        open={solveOpen}
        onClose={() => setSolveOpen(false)}
        title="Solve Issue"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setSolveOpen(false)} className="text-sm px-4 py-2 text-gray-300">Cancel</button>
            <button onClick={solve} className="bg-emerald-500 text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">Solve</button>
          </div>
        }
      >
        <p className="text-sm text-gray-300 mb-3">Sets status to solved, marks IDS Solve, computes time-to-solve, and posts your resolution.</p>
        <Textarea label="Resolution note" value={resolutionNote} onChange={setResolutionNote} rows={4} placeholder="What was the solution? Who owns the follow-up?" />
      </Modal>
    </Drawer>
  )
}

function IdsToggle({ label, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
        active
          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
          : 'bg-navy-900/40 border-navy-700/60 text-gray-400 hover:text-white'
      } ${disabled ? 'cursor-default' : ''}`}
    >
      {active ? '[x] ' : '[ ] '}{label}
    </button>
  )
}

function LinkedSection({ label, ids }) {
  const arr = Array.isArray(ids) ? ids : []
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">{label}</h4>
      {arr.length === 0 ? (
        <p className="text-sm text-gray-500">No links.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {arr.map(id => (
            <span key={id} className="text-xs px-2 py-1 rounded bg-navy-900/60 border border-navy-700/50 text-gray-300">{shortId(id)}</span>
          ))}
        </div>
      )}
    </div>
  )
}
