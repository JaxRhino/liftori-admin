// =====================================================================
// EOSTodos - 7-day action items from L10 meetings
// Wave C.2.1
// Reads/writes: eos_todos (per-tenant LABOS DB)
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
const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const todayIso = () => addDays(new Date(), 7).toISOString().slice(0, 10) // default due +7d

// ---------- constants ----------
const STATUSES = [
  { key: 'open',         label: 'Open',        tone: 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40' },
  { key: 'in_progress',  label: 'In Progress', tone: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { key: 'done',         label: 'Done',        tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
]
const PRIORITIES = [
  { key: 'high',   label: 'High',   tone: 'bg-rose-500/20 text-rose-300' },
  { key: 'normal', label: 'Normal', tone: 'bg-sky-500/20 text-sky-300' },
  { key: 'low',    label: 'Low',    tone: 'bg-navy-700/60 text-gray-300' },
]

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

function StatusBadge({ status }) {
  const s = STATUSES.find(x => x.key === status)
  if (!s) return <span className="text-[10px] px-2 py-0.5 rounded border bg-navy-700/60 text-gray-300 border-navy-700/60 uppercase">{status || '-'}</span>
  return <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${s.tone}`}>{s.label}</span>
}

function PriorityBadge({ priority }) {
  const p = PRIORITIES.find(x => x.key === priority)
  if (!p) return <span className="text-[10px] px-2 py-0.5 rounded bg-navy-700/60 text-gray-300 uppercase">{priority || '-'}</span>
  return <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${p.tone}`}>{p.label}</span>
}

function DueBadge({ due, done }) {
  if (done) return <span className="text-xs text-emerald-300">Done</span>
  if (!due) return <span className="text-xs text-gray-500">-</span>
  const d = new Date(due)
  const today = startOfDay(new Date())
  const target = startOfDay(d)
  const diff = Math.round((target - today) / 86400000)
  if (diff < 0) return <span className="text-xs text-rose-300">Overdue {Math.abs(diff)}d</span>
  if (diff === 0) return <span className="text-xs text-amber-300">Today</span>
  if (diff === 1) return <span className="text-xs text-amber-300">Tomorrow</span>
  if (diff <= 7) return <span className="text-xs text-brand-cyan">{diff}d</span>
  return <span className="text-xs text-gray-400">{fmtDate(due)}</span>
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function EOSTodos() {
  const { client, platform } = useCrmClient()

  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dueFilter, setDueFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('list') // list | kanban
  const [newOpen, setNewOpen] = useState(false)
  const [drawer, setDrawer] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      const { data, error } = await client
        .from('eos_todos')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(500)
      if (error) throw error
      setTodos(data || [])
    } catch (e) {
      console.error('[EOSTodos] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  // ---- stats ----
  const stats = useMemo(() => {
    const now = Date.now()
    const weekFwd = now + 7 * 86400000
    const weekBack = now - 7 * 86400000
    const openOrInProg = todos.filter(t => t.status === 'open' || t.status === 'in_progress')
    return {
      open: openOrInProg.length,
      thisWeek: openOrInProg.filter(t => t.due_date && new Date(t.due_date).getTime() >= now && new Date(t.due_date).getTime() <= weekFwd).length,
      overdue: openOrInProg.filter(t => t.due_date && new Date(t.due_date).getTime() < now).length,
      done7d: todos.filter(t => t.status === 'done' && t.completed_at && new Date(t.completed_at).getTime() >= weekBack).length,
    }
  }, [todos])

  // ---- filtered ----
  const filtered = useMemo(() => {
    const now = Date.now()
    const today0 = startOfDay(new Date()).getTime()
    const tomorrow0 = today0 + 86400000
    const weekEnd = today0 + 7 * 86400000
    const nextWeekStart = today0 + 7 * 86400000
    const nextWeekEnd = today0 + 14 * 86400000
    const q = search.trim().toLowerCase()

    return todos.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (dueFilter !== 'all') {
        if (!t.due_date) return false
        const ts = new Date(t.due_date).getTime()
        if (dueFilter === 'overdue' && !(ts < now && t.status !== 'done')) return false
        if (dueFilter === 'today' && !(ts >= today0 && ts < tomorrow0)) return false
        if (dueFilter === 'week' && !(ts >= today0 && ts < weekEnd)) return false
        if (dueFilter === 'next_week' && !(ts >= nextWeekStart && ts < nextWeekEnd)) return false
      }
      if (q) {
        const hay = `${t.task || ''} ${t.description || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [todos, statusFilter, dueFilter, search])

  return (
    <HubPage
      title="To-Dos"
      subtitle={`7-day action items${platform?.clientName ? ` - ${platform.clientName}` : ''}`}
      actions={
        <button
          onClick={() => setNewOpen(true)}
          className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium hover:brightness-110"
        >
          + New To-Do
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open To-Dos" value={stats.open} />
        <StatCard label="Due This Week" value={stats.thisWeek} accent="text-brand-cyan" />
        <StatCard label="Overdue" value={stats.overdue} accent="text-rose-400" />
        <StatCard label="Completed 7d" value={stats.done7d} accent="text-emerald-400" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Status</span>
        <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>all</Chip>
        {STATUSES.map(s => (
          <Chip key={s.key} active={statusFilter === s.key} onClick={() => setStatusFilter(s.key)}>{s.label}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Due</span>
        <Chip active={dueFilter === 'all'} onClick={() => setDueFilter('all')}>all</Chip>
        <Chip active={dueFilter === 'overdue'} onClick={() => setDueFilter('overdue')}>overdue</Chip>
        <Chip active={dueFilter === 'today'} onClick={() => setDueFilter('today')}>today</Chip>
        <Chip active={dueFilter === 'week'} onClick={() => setDueFilter('week')}>this week</Chip>
        <Chip active={dueFilter === 'next_week'} onClick={() => setDueFilter('next_week')}>next week</Chip>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="search"
          placeholder="Search task or description"
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
        <Section title="To-Dos"><div className="p-6 text-sm text-gray-500">Loading to-dos...</div></Section>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No to-dos"
          description="No to-dos match the current filter. Create one or capture from your next L10."
          cta={
            <button
              onClick={() => setNewOpen(true)}
              className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium"
            >
              + New To-Do
            </button>
          }
        />
      ) : view === 'list' ? (
        <TodoList todos={filtered} onOpen={(t) => setDrawer(t)} client={client} onChanged={load} />
      ) : (
        <TodoKanban todos={filtered} onOpen={(t) => setDrawer(t)} />
      )}

      <NewTodoModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        client={client}
        onSaved={() => { setNewOpen(false); load() }}
      />

      <TodoDrawer
        todo={drawer}
        onClose={() => setDrawer(null)}
        client={client}
        onChanged={() => { setDrawer(null); load() }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                                TODO LIST
// ===========================================================================
function TodoList({ todos, onOpen, client, onChanged }) {
  async function quickToggle(t) {
    if (!client) return
    try {
      if (t.status === 'done') {
        const { error } = await client.from('eos_todos').update({
          status: 'open',
          completed_at: null,
        }).eq('id', t.id)
        if (error) throw error
      } else {
        const { error } = await client.from('eos_todos').update({
          status: 'done',
          completed_at: new Date().toISOString(),
        }).eq('id', t.id)
        if (error) throw error
      }
      onChanged?.()
    } catch (e) {
      console.error('[EOSTodos] quickToggle', e)
    }
  }

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-900/60 border-b border-navy-700/50">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Task</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Owner</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Due</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Priority</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Linked</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody>
            {todos.map(t => {
              const linkCount = (t.linked_rock_id ? 1 : 0) + (t.linked_issue_id ? 1 : 0) + (t.linked_meeting_id ? 1 : 0)
              return (
                <tr
                  key={t.id}
                  className="border-b border-navy-700/30 hover:bg-navy-900/40"
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={t.status === 'done'}
                      onChange={() => quickToggle(t)}
                      className="accent-brand-cyan"
                    />
                  </td>
                  <td onClick={() => onOpen(t)} className="px-3 py-2 text-white max-w-[300px] truncate cursor-pointer">
                    <span className={t.status === 'done' ? 'line-through text-gray-500' : ''}>{t.task}</span>
                  </td>
                  <td onClick={() => onOpen(t)} className="px-3 py-2 text-gray-400 cursor-pointer">{shortId(t.owner_id)}</td>
                  <td onClick={() => onOpen(t)} className="px-3 py-2 cursor-pointer"><DueBadge due={t.due_date} done={t.status === 'done'} /></td>
                  <td onClick={() => onOpen(t)} className="px-3 py-2 cursor-pointer"><PriorityBadge priority={t.priority} /></td>
                  <td onClick={() => onOpen(t)} className="px-3 py-2 cursor-pointer"><StatusBadge status={t.status} /></td>
                  <td onClick={() => onOpen(t)} className="px-3 py-2 text-gray-400 cursor-pointer">
                    {linkCount > 0 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">[{linkCount}]</span>
                    ) : '-'}
                  </td>
                  <td onClick={() => onOpen(t)} className="px-3 py-2 text-gray-500 cursor-pointer">{relTime(t.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===========================================================================
//                                TODO KANBAN
// ===========================================================================
function TodoKanban({ todos, onOpen }) {
  const cols = [
    { key: 'open',        title: 'Open',        items: todos.filter(t => t.status === 'open'),        tone: 'text-brand-cyan' },
    { key: 'in_progress', title: 'In Progress', items: todos.filter(t => t.status === 'in_progress'), tone: 'text-amber-300' },
    { key: 'done',        title: 'Done',        items: todos.filter(t => t.status === 'done'),        tone: 'text-emerald-300' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cols.map(col => (
        <div key={col.key} className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden flex flex-col min-h-[200px]">
          <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
            <h3 className={`font-semibold text-sm ${col.tone}`}>{col.title}</h3>
            <span className="text-xs text-gray-500">{col.items.length}</span>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto">
            {col.items.length === 0 && <p className="text-xs text-gray-600 text-center py-4">empty</p>}
            {col.items.map(t => (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                className="w-full text-left bg-navy-900/50 border border-navy-700/40 rounded-lg p-3 hover:border-brand-cyan/40 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <PriorityBadge priority={t.priority} />
                  <DueBadge due={t.due_date} done={t.status === 'done'} />
                </div>
                <p className={`text-sm ${t.status === 'done' ? 'line-through text-gray-500' : 'text-white'} line-clamp-2`}>{t.task}</p>
                {t.owner_id && <p className="text-[10px] text-gray-500 mt-1">Owner: {shortId(t.owner_id)}</p>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ===========================================================================
//                                NEW TODO MODAL
// ===========================================================================
function NewTodoModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState(empty())
  const [saving, setSaving] = useState(false)

  function empty() {
    return {
      task: '',
      description: '',
      owner_id: '',
      due_date: todayIso(),
      priority: 'normal',
      linked_rock_id: '',
      linked_issue_id: '',
      linked_meeting_id: '',
    }
  }
  useEffect(() => { if (open) setForm(empty()) }, [open])

  async function save() {
    if (!client) return
    if (!form.task.trim()) { alert('Task is required'); return }
    setSaving(true)
    try {
      const payload = {
        task: form.task.trim(),
        description: form.description || null,
        owner_id: form.owner_id || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        priority: form.priority || 'normal',
        status: 'open',
        subtasks: [],
        linked_rock_id: form.linked_rock_id || null,
        linked_issue_id: form.linked_issue_id || null,
        linked_meeting_id: form.linked_meeting_id || null,
      }
      const { error } = await client.from('eos_todos').insert(payload)
      if (error) throw error
      onSaved?.()
    } catch (e) {
      console.error('[EOSTodos] save', e)
      alert('Failed to save: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New To-Do"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Create To-Do'}
          </button>
        </div>
      }
    >
      <Input label="Task" value={form.task} onChange={(v) => setForm(f => ({ ...f, task: v }))} placeholder="Ship Wave C.2.1 by Friday" />
      <Textarea label="Description" value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} rows={3} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Owner ID" value={form.owner_id} onChange={(v) => setForm(f => ({ ...f, owner_id: v }))} placeholder="uuid" />
        <Input label="Due date" type="date" value={form.due_date} onChange={(v) => setForm(f => ({ ...f, due_date: v }))} />
      </div>
      <Select
        label="Priority"
        value={form.priority}
        onChange={(v) => setForm(f => ({ ...f, priority: v }))}
        options={PRIORITIES.map(p => ({ value: p.key, label: p.label }))}
      />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Linked Rock" value={form.linked_rock_id} onChange={(v) => setForm(f => ({ ...f, linked_rock_id: v }))} placeholder="uuid" />
        <Input label="Linked Issue" value={form.linked_issue_id} onChange={(v) => setForm(f => ({ ...f, linked_issue_id: v }))} placeholder="uuid" />
        <Input label="Linked Meeting" value={form.linked_meeting_id} onChange={(v) => setForm(f => ({ ...f, linked_meeting_id: v }))} placeholder="uuid" />
      </div>
    </Modal>
  )
}

// ===========================================================================
//                                TODO DETAIL DRAWER
// ===========================================================================
function TodoDrawer({ todo, onClose, client, onChanged }) {
  const [tab, setTab] = useState('overview')
  const [draft, setDraft] = useState(todo)
  const [saving, setSaving] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [newOwner, setNewOwner] = useState('')
  const [dateOpen, setDateOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [dateReason, setDateReason] = useState('')

  useEffect(() => {
    setDraft(todo)
    setTab('overview')
    setNewOwner('')
    setNewDate('')
    setDateReason('')
  }, [todo])

  if (!todo) return null

  async function saveField(updates) {
    if (!client) return
    setSaving(true)
    try {
      const { error } = await client.from('eos_todos').update(updates).eq('id', todo.id)
      if (error) throw error
      setDraft(d => ({ ...d, ...updates }))
    } catch (e) {
      console.error('[EOSTodos] saveField', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function saveAll() {
    await saveField({
      task: draft.task,
      description: draft.description,
      owner_id: draft.owner_id || null,
      due_date: draft.due_date ? new Date(draft.due_date).toISOString() : null,
      priority: draft.priority,
      status: draft.status,
    })
    onChanged?.()
  }

  async function toggleSubtask(idx) {
    const arr = Array.isArray(draft.subtasks) ? [...draft.subtasks] : []
    if (!arr[idx]) return
    arr[idx] = { ...arr[idx], completed: !arr[idx].completed }
    await saveField({ subtasks: arr })
  }
  async function addSubtask() {
    const title = window.prompt('Subtask title?')
    if (!title) return
    const arr = Array.isArray(draft.subtasks) ? [...draft.subtasks] : []
    arr.push({ title, completed: false })
    await saveField({ subtasks: arr })
  }
  async function removeSubtask(idx) {
    const arr = Array.isArray(draft.subtasks) ? [...draft.subtasks] : []
    arr.splice(idx, 1)
    await saveField({ subtasks: arr })
  }

  async function reassign() {
    if (!newOwner.trim()) return
    const history = Array.isArray(draft.reassignment_history) ? [...draft.reassignment_history] : []
    history.push({
      at: new Date().toISOString(),
      from_owner: draft.owner_id || null,
      to_owner: newOwner.trim(),
    })
    await saveField({ owner_id: newOwner.trim(), reassignment_history: history })
    setReassignOpen(false)
    setNewOwner('')
  }

  async function changeDate() {
    if (!newDate) return
    const history = Array.isArray(draft.deadline_changes) ? [...draft.deadline_changes] : []
    history.push({
      at: new Date().toISOString(),
      from_due: draft.due_date || null,
      to_due: new Date(newDate).toISOString(),
      reason: dateReason || null,
    })
    await saveField({ due_date: new Date(newDate).toISOString(), deadline_changes: history })
    setDateOpen(false)
    setNewDate('')
    setDateReason('')
  }

  async function markDone() {
    await saveField({ status: 'done', completed_at: new Date().toISOString() })
    onChanged?.()
  }

  const subtasks = Array.isArray(draft?.subtasks) ? draft.subtasks : []
  const reassigns = Array.isArray(draft?.reassignment_history) ? [...draft.reassignment_history].reverse() : []
  const deadlineHist = Array.isArray(draft?.deadline_changes) ? [...draft.deadline_changes].reverse() : []

  return (
    <Drawer
      open={!!todo}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <PriorityBadge priority={draft?.priority} />
          <StatusBadge status={draft?.status} />
          <span className="text-white font-semibold truncate">{draft?.task || 'To-Do'}</span>
        </div>
      }
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setReassignOpen(true)} className="text-sm px-3 py-2 rounded-lg bg-navy-700/60 text-gray-300 hover:bg-navy-700/80">Reassign</button>
            <button onClick={() => setDateOpen(true)} className="text-sm px-3 py-2 rounded-lg bg-navy-700/60 text-gray-300 hover:bg-navy-700/80">Change Due</button>
            <button
              onClick={markDone}
              disabled={draft?.status === 'done'}
              className="text-sm px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              Mark Done
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
      <div className="flex flex-wrap gap-2 mb-4">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
        <TabBtn active={tab === 'subtasks'} onClick={() => setTab('subtasks')} count={subtasks.length}>Subtasks</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} count={reassigns.length + deadlineHist.length}>History</TabBtn>
        <TabBtn active={tab === 'linked'} onClick={() => setTab('linked')}>Linked</TabBtn>
      </div>

      {tab === 'overview' && draft && (
        <div>
          <Input label="Task" value={draft.task} onChange={(v) => setDraft(d => ({ ...d, task: v }))} />
          <Textarea label="Description" value={draft.description} onChange={(v) => setDraft(d => ({ ...d, description: v }))} rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Owner ID" value={draft.owner_id || ''} onChange={(v) => setDraft(d => ({ ...d, owner_id: v }))} />
            <Input label="Due date" type="date" value={draft.due_date ? draft.due_date.slice(0, 10) : ''} onChange={(v) => setDraft(d => ({ ...d, due_date: v }))} />
          </div>
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
              options={STATUSES.map(s => ({ value: s.key, label: s.label }))}
            />
          </div>
          <DetailRow label="Created" value={fmtDate(draft.created_at)} />
          <DetailRow label="Updated" value={fmtDate(draft.updated_at)} />
          {draft.completed_at && <DetailRow label="Completed" value={fmtDate(draft.completed_at)} />}
        </div>
      )}

      {tab === 'subtasks' && (
        <div>
          {subtasks.length === 0 && <p className="text-sm text-gray-500 mb-3">No subtasks.</p>}
          <ul className="space-y-2 mb-3">
            {subtasks.map((s, i) => (
              <li key={i} className="flex items-center gap-3 bg-navy-900/50 border border-navy-700/40 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!s.completed}
                  onChange={() => toggleSubtask(i)}
                  className="accent-brand-cyan"
                />
                <p className={`flex-1 text-sm truncate ${s.completed ? 'line-through text-gray-500' : 'text-white'}`}>{s.title}</p>
                <button onClick={() => removeSubtask(i)} className="text-xs text-rose-300 hover:text-rose-200">Remove</button>
              </li>
            ))}
          </ul>
          <button onClick={addSubtask} className="text-sm text-brand-cyan hover:brightness-110">+ Add subtask</button>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-5">
          <div>
            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Reassignments</h4>
            {reassigns.length === 0 ? (
              <p className="text-sm text-gray-500">No reassignments yet.</p>
            ) : (
              <div className="space-y-2">
                {reassigns.map((h, i) => (
                  <div key={i} className="bg-navy-900/40 border border-navy-700/40 rounded-lg p-3 text-sm">
                    <div className="text-[11px] text-gray-500 mb-1">{relTime(h.at)}</div>
                    <p className="text-white">{shortId(h.from_owner)} -&gt; {shortId(h.to_owner)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Deadline changes</h4>
            {deadlineHist.length === 0 ? (
              <p className="text-sm text-gray-500">No deadline changes yet.</p>
            ) : (
              <div className="space-y-2">
                {deadlineHist.map((h, i) => (
                  <div key={i} className="bg-navy-900/40 border border-navy-700/40 rounded-lg p-3 text-sm">
                    <div className="text-[11px] text-gray-500 mb-1">{relTime(h.at)}</div>
                    <p className="text-white">{fmtDate(h.from_due)} -&gt; {fmtDate(h.to_due)}</p>
                    {h.reason && <p className="text-xs text-gray-400 mt-1">{h.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'linked' && (
        <div className="space-y-3">
          <DetailRow label="Linked Rock" value={shortId(draft?.linked_rock_id)} />
          <DetailRow label="Linked Issue" value={shortId(draft?.linked_issue_id)} />
          <DetailRow label="Linked Meeting" value={shortId(draft?.linked_meeting_id)} />
          <p className="text-xs text-gray-500">Linking pickers land in Wave F. Paste uuids directly in Overview to bind.</p>
        </div>
      )}

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign To-Do"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setReassignOpen(false)} className="text-sm px-4 py-2 text-gray-300">Cancel</button>
            <button onClick={reassign} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">Reassign</button>
          </div>
        }
      >
        <Input label="New owner ID" value={newOwner} onChange={setNewOwner} placeholder="uuid" />
      </Modal>

      <Modal
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        title="Change Due Date"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setDateOpen(false)} className="text-sm px-4 py-2 text-gray-300">Cancel</button>
            <button onClick={changeDate} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">Update</button>
          </div>
        }
      >
        <Input label="New due date" type="date" value={newDate} onChange={setNewDate} />
        <Textarea label="Reason" value={dateReason} onChange={setDateReason} rows={3} placeholder="Why is the due date moving?" />
      </Modal>
    </Drawer>
  )
}
