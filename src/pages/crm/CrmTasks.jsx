import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from './_shared'

// ---------- formatters ----------
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
const isOverdue = (due, status) => {
  if (!due) return false
  if (status === 'done') return false
  return new Date(due).getTime() < Date.now() - 86400000
}

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
        className="w-full sm:w-[480px] bg-navy-800 border-l border-navy-700/50 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between sticky top-0 bg-navy-800 z-10">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
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

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition ${
        active
          ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40'
          : 'text-gray-400 hover:text-white border border-transparent'
      }`}
    >
      {children}
    </button>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-navy-700/40 last:border-b-0">
      <span className="text-gray-400">{label}</span>
      <span className="text-white text-right max-w-[260px] truncate font-mono text-[11px]">{value || '-'}</span>
    </div>
  )
}

function SourceBadge({ source }) {
  if (source === 'eos') return <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">EOS</span>
  return <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-brand-cyan/20 text-brand-cyan">Task</span>
}

function PriorityBadge({ priority }) {
  const map = {
    urgent: 'bg-rose-500/20 text-rose-300',
    high: 'bg-amber-500/20 text-amber-300',
    normal: 'bg-navy-700/60 text-gray-300',
    low: 'bg-sky-500/20 text-sky-300',
  }
  if (!priority) return null
  return <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${map[priority] || 'bg-navy-700/60 text-gray-300'}`}>{priority}</span>
}

// ---------- status mapping ----------
const UNIFIED_STATUSES = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
]

function unifyStatus(source, status) {
  if (source === 'admin') {
    if (status === 'pending') return 'todo'
    if (status === 'completed') return 'done'
    return status || 'todo'
  }
  // eos
  if (status === 'open') return 'todo'
  if (status === 'done') return 'done'
  return status || 'todo'
}

function denormalizeStatus(source, unified) {
  if (source === 'admin') {
    if (unified === 'todo') return 'pending'
    if (unified === 'done') return 'completed'
    return unified
  }
  if (unified === 'todo') return 'open'
  if (unified === 'blocked') return 'in_progress' // eos has no blocked, fall back
  return unified
}

const ADMIN_PRIORITIES = ['low', 'normal', 'high', 'urgent']
const EOS_PRIORITIES = ['low', 'normal', 'high']

// ---------- normalizers ----------
function normalizeAdmin(row) {
  return {
    id: `admin-${row.id}`,
    source: 'admin',
    title: row.title || '(untitled)',
    description: row.description || '',
    status: unifyStatus('admin', row.status),
    rawStatus: row.status,
    priority: row.priority || 'normal',
    due_date: row.due_date,
    owner_id: row.user_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    raw: row,
  }
}

function normalizeEos(row) {
  return {
    id: `eos-${row.id}`,
    source: 'eos',
    title: row.task || '(untitled)',
    description: row.description || '',
    status: unifyStatus('eos', row.status),
    rawStatus: row.status,
    priority: row.priority || 'normal',
    due_date: row.due_date,
    owner_id: row.owner_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    raw: row,
  }
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function CrmTasks() {
  const { client, platform } = useCrmClient()

  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState('list')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [newOpen, setNewOpen] = useState(false)
  const [taskDrawer, setTaskDrawer] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      const [adminRes, eosRes] = await Promise.all([
        client
          .from('admin_tasks')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        client
          .from('eos_todos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
      ])
      if (adminRes.error) throw adminRes.error
      if (eosRes.error) throw eosRes.error
      const adminT = (adminRes.data || []).map(normalizeAdmin)
      const eosT = (eosRes.data || []).map(normalizeEos)
      const merged = [...adminT, ...eosT].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setTasks(merged)
    } catch (e) {
      console.error('[CrmTasks] load', e)
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
    const today = ymd(new Date())
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const total = tasks.length
    const dueToday = tasks.filter((t) => t.due_date && ymd(t.due_date) === today && t.status !== 'done').length
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status)).length
    const completedWeek = tasks.filter(
      (t) => t.status === 'done' && new Date(t.updated_at || t.created_at) >= weekStart
    ).length
    return { total, dueToday, overdue, completedWeek }
  }, [tasks])

  // ---- filter ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (sourceFilter !== 'all' && t.source !== sourceFilter) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [tasks, statusFilter, priorityFilter, sourceFilter, search])

  // ---- toggle complete from row ----
  async function toggleComplete(task) {
    if (!client) return
    const targetUnified = task.status === 'done' ? 'todo' : 'done'
    const newRaw = denormalizeStatus(task.source, targetUnified)
    try {
      const table = task.source === 'admin' ? 'admin_tasks' : 'eos_todos'
      const patch = { status: newRaw }
      if (task.source === 'eos' && targetUnified === 'done') patch.completed_at = new Date().toISOString()
      const { error } = await client.from(table).update(patch).eq('id', task.raw.id)
      if (error) throw error
      load()
    } catch (e) {
      console.error('[CrmTasks] toggleComplete', e)
    }
  }

  return (
    <HubPage
      title="Tasks"
      subtitle={`Stay on top of what's next - across the team and EOS${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
      actions={
        <button
          onClick={() => setNewOpen(true)}
          className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium"
        >
          + New Task
        </button>
      }
    >
      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tasks" value={stats.total} accent="text-brand-cyan" />
        <StatCard label="Due Today" value={stats.dueToday} accent="text-amber-400" />
        <StatCard label="Overdue" value={stats.overdue} accent="text-rose-400" />
        <StatCard label="Done This Week" value={stats.completedWeek} accent="text-emerald-400" />
      </div>

      {/* view toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <TabBtn active={view === 'list'} onClick={() => setView('list')}>List</TabBtn>
        <TabBtn active={view === 'kanban'} onClick={() => setView('kanban')}>Kanban</TabBtn>
        <div className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title..."
          className="w-48 bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
        />
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Status</span>
        <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
        {UNIFIED_STATUSES.map((s) => (
          <Chip key={s.key} active={statusFilter === s.key} onClick={() => setStatusFilter(s.key)}>{s.label}</Chip>
        ))}
        <span className="text-xs text-gray-500 uppercase tracking-wider ml-3 mr-1">Priority</span>
        <Chip active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')}>All</Chip>
        {ADMIN_PRIORITIES.map((p) => (
          <Chip key={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)}>{p}</Chip>
        ))}
        <span className="text-xs text-gray-500 uppercase tracking-wider ml-3 mr-1">Source</span>
        <Chip active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>All</Chip>
        <Chip active={sourceFilter === 'admin'} onClick={() => setSourceFilter('admin')}>Tasks</Chip>
        <Chip active={sourceFilter === 'eos'} onClick={() => setSourceFilter('eos')}>EOS</Chip>
      </div>

      {loading ? (
        <Section title="Loading"><div className="p-6 text-sm text-gray-500">Loading tasks...</div></Section>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tasks.length === 0 ? 'No tasks yet' : 'No tasks match'}
          description={tasks.length === 0 ? 'Add your first task to start tracking what needs doing.' : 'Try a different filter or clear the search.'}
          cta={
            tasks.length === 0 ? (
              <button onClick={() => setNewOpen(true)} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
                + New Task
              </button>
            ) : null
          }
        />
      ) : view === 'list' ? (
        <TaskList tasks={filtered} onRow={setTaskDrawer} onToggle={toggleComplete} />
      ) : (
        <TaskKanban tasks={filtered} onCard={setTaskDrawer} />
      )}

      <NewTaskModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        client={client}
        onSaved={() => { setNewOpen(false); load() }}
      />

      <TaskDrawer
        task={taskDrawer}
        onClose={() => setTaskDrawer(null)}
        client={client}
        onChanged={() => { setTaskDrawer(null); load() }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                              LIST VIEW
// ===========================================================================
function TaskList({ tasks, onRow, onToggle }) {
  return (
    <Section title="All Tasks">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider bg-navy-900/30">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="text-left px-4 py-2">Title</th>
              <th className="text-left px-4 py-2">Source</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Priority</th>
              <th className="text-left px-4 py-2">Due</th>
              <th className="text-left px-4 py-2">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-navy-700/30">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={(e) => { e.stopPropagation(); onToggle(t) }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td onClick={() => onRow(t)} className={`px-4 py-2 text-white cursor-pointer ${t.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                  {t.title}
                </td>
                <td onClick={() => onRow(t)} className="px-4 py-2 cursor-pointer"><SourceBadge source={t.source} /></td>
                <td onClick={() => onRow(t)} className="px-4 py-2 cursor-pointer">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-navy-700/50 text-gray-300 capitalize">
                    {UNIFIED_STATUSES.find((s) => s.key === t.status)?.label || t.status}
                  </span>
                </td>
                <td onClick={() => onRow(t)} className="px-4 py-2 cursor-pointer"><PriorityBadge priority={t.priority} /></td>
                <td onClick={() => onRow(t)} className={`px-4 py-2 cursor-pointer ${isOverdue(t.due_date, t.status) ? 'text-rose-400 font-medium' : 'text-gray-300'}`}>
                  {fmtDate(t.due_date)}
                </td>
                <td onClick={() => onRow(t)} className="px-4 py-2 text-gray-500 text-xs cursor-pointer font-mono">
                  {t.owner_id ? `${t.owner_id.slice(0, 8)}...` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ===========================================================================
//                              KANBAN VIEW
// ===========================================================================
function TaskKanban({ tasks, onCard }) {
  const grouped = useMemo(() => {
    const g = {}
    for (const s of UNIFIED_STATUSES) g[s.key] = []
    for (const t of tasks) {
      const k = g[t.status] ? t.status : 'todo'
      g[k].push(t)
    }
    return g
  }, [tasks])

  return (
    <Section title="Board">
      <div className="overflow-x-auto p-4">
        <div className="flex gap-3 min-w-[800px]">
          {UNIFIED_STATUSES.map((s) => {
            const cards = grouped[s.key] || []
            return (
              <div key={s.key} className="w-64 flex-shrink-0 bg-navy-900/40 border border-navy-700/40 rounded-lg">
                <div className="px-3 py-2 border-b border-navy-700/40 flex items-center justify-between">
                  <div className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</div>
                  <span className="text-[10px] text-gray-500">{cards.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[60px]">
                  {cards.length === 0 && (
                    <div className="text-[11px] text-gray-600 text-center py-4">Empty</div>
                  )}
                  {cards.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onCard(t)}
                      className="w-full text-left bg-navy-800 border border-navy-700/50 rounded-lg p-3 hover:border-brand-cyan/40 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm text-white font-medium line-clamp-2 flex-1">{t.title}</div>
                        <SourceBadge source={t.source} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <PriorityBadge priority={t.priority} />
                        <span className={`text-[11px] ${isOverdue(t.due_date, t.status) ? 'text-rose-400 font-medium' : 'text-gray-500'}`}>
                          {fmtDate(t.due_date)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Section>
  )
}

// ===========================================================================
//                              NEW TASK MODAL
// ===========================================================================
function NewTaskModal({ open, onClose, client, onSaved }) {
  const [destination, setDestination] = useState('admin')
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDestination('admin')
    setForm({ priority: 'normal' })
  }, [open])

  async function submit() {
    if (!client) return
    if (!form.title) { alert('Title required'); return }
    setSaving(true)
    try {
      if (destination === 'admin') {
        const payload = {
          title: form.title,
          description: form.description || null,
          status: 'pending',
          priority: form.priority || 'normal',
          due_date: form.due_date || null,
          project_id: form.project_id || null,
          customer_id: form.customer_id || null,
        }
        const { error } = await client.from('admin_tasks').insert(payload)
        if (error) throw error
      } else {
        const payload = {
          task: form.title,
          description: form.description || null,
          owner_id: form.owner_id || null,
          due_date: form.due_date || null,
          priority: form.priority === 'urgent' ? 'high' : (form.priority || 'normal'),
          status: 'open',
          linked_rock_id: form.linked_rock_id || null,
          linked_issue_id: form.linked_issue_id || null,
          linked_meeting_id: form.linked_meeting_id || null,
        }
        const { error } = await client.from('eos_todos').insert(payload)
        if (error) throw error
      }
      onSaved()
    } catch (e) {
      console.error('[NewTaskModal] submit', e)
      alert('Could not save task: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Task"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Task'}
          </button>
        </div>
      }
    >
      <div className="flex gap-2 mb-4">
        <span className="text-xs text-gray-400 uppercase tracking-wider self-center">Save to:</span>
        <Chip active={destination === 'admin'} onClick={() => setDestination('admin')}>Tasks</Chip>
        <Chip active={destination === 'eos'} onClick={() => setDestination('eos')}>EOS Todo</Chip>
      </div>

      <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
      <Input label="Description" rows={3} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Select
          label="Priority"
          value={form.priority}
          onChange={(v) => setForm({ ...form, priority: v })}
          options={(destination === 'admin' ? ADMIN_PRIORITIES : EOS_PRIORITIES).map((p) => ({ value: p, label: p }))}
        />
        <Input label="Due Date" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />

        {destination === 'admin' ? (
          <>
            <Input label="Project ID (optional)" value={form.project_id} onChange={(v) => setForm({ ...form, project_id: v })} placeholder="uuid" />
            <Input label="Customer ID (optional)" value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })} placeholder="uuid" />
          </>
        ) : (
          <>
            <Input label="Owner ID" value={form.owner_id} onChange={(v) => setForm({ ...form, owner_id: v })} placeholder="uuid" />
            <Input label="Linked Rock (optional)" value={form.linked_rock_id} onChange={(v) => setForm({ ...form, linked_rock_id: v })} placeholder="uuid" />
            <Input label="Linked Issue (optional)" value={form.linked_issue_id} onChange={(v) => setForm({ ...form, linked_issue_id: v })} placeholder="uuid" />
            <Input label="Linked Meeting (optional)" value={form.linked_meeting_id} onChange={(v) => setForm({ ...form, linked_meeting_id: v })} placeholder="uuid" />
          </>
        )}
      </div>
    </Modal>
  )
}

// ===========================================================================
//                              TASK DRAWER
// ===========================================================================
function TaskDrawer({ task, onClose, client, onChanged }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!task) return
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority || 'normal',
      due_date: task.due_date || '',
      owner_id: task.owner_id || '',
    })
  }, [task])

  if (!task) return null

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      const newRaw = denormalizeStatus(task.source, form.status)
      const table = task.source === 'admin' ? 'admin_tasks' : 'eos_todos'
      const titleField = task.source === 'admin' ? 'title' : 'task'
      const payload = {
        [titleField]: form.title || null,
        description: form.description || null,
        status: newRaw,
        priority: task.source === 'eos' && form.priority === 'urgent' ? 'high' : (form.priority || 'normal'),
        due_date: form.due_date || null,
      }
      if (task.source === 'admin') {
        payload.user_id = form.owner_id || null
      } else {
        payload.owner_id = form.owner_id || null
        if (form.status === 'done' && task.rawStatus !== 'done') {
          payload.completed_at = new Date().toISOString()
        }
      }
      const { error } = await client.from(table).update(payload).eq('id', task.raw.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[TaskDrawer] save', e)
      alert('Could not save: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function markComplete() {
    if (!client) return
    setForm({ ...form, status: 'done' })
    setSaving(true)
    try {
      const table = task.source === 'admin' ? 'admin_tasks' : 'eos_todos'
      const patch = { status: denormalizeStatus(task.source, 'done') }
      if (task.source === 'eos') patch.completed_at = new Date().toISOString()
      const { error } = await client.from(table).update(patch).eq('id', task.raw.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[TaskDrawer] markComplete', e)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!client) return
    if (!confirm('Delete this task?')) return
    setSaving(true)
    try {
      const table = task.source === 'admin' ? 'admin_tasks' : 'eos_todos'
      const { error } = await client.from(table).delete().eq('id', task.raw.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[TaskDrawer] remove', e)
      alert('Could not delete: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={!!task}
      onClose={onClose}
      title={task.title}
      footer={
        <div className="flex justify-between gap-2">
          <button onClick={remove} disabled={saving} className="text-sm px-3 py-1.5 text-rose-400 hover:text-rose-300">Delete</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
            <button onClick={save} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <SourceBadge source={task.source} />
        <PriorityBadge priority={form.priority} />
      </div>

      {form.status !== 'done' && (
        <button
          onClick={markComplete}
          disabled={saving}
          className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-sm px-3 py-2 rounded-lg mb-4"
        >
          Mark Complete
        </button>
      )}

      <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
      <Input label="Description" rows={4} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />

      <div className="grid grid-cols-2 gap-x-3">
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => setForm({ ...form, status: v })}
          options={UNIFIED_STATUSES.map((s) => ({ value: s.key, label: s.label }))}
        />
        <Select
          label="Priority"
          value={form.priority}
          onChange={(v) => setForm({ ...form, priority: v })}
          options={(task.source === 'admin' ? ADMIN_PRIORITIES : EOS_PRIORITIES).map((p) => ({ value: p, label: p }))}
        />
        <Input label="Due Date" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
        <Input label="Owner ID" value={form.owner_id} onChange={(v) => setForm({ ...form, owner_id: v })} placeholder="uuid" />
      </div>

      <div className="mt-4 bg-navy-900/40 border border-navy-700/40 rounded-lg p-3">
        <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Refs</div>
        {task.source === 'admin' ? (
          <>
            <DetailRow label="Project" value={task.raw.project_id} />
            <DetailRow label="Customer" value={task.raw.customer_id} />
          </>
        ) : (
          <>
            <DetailRow label="Linked Rock" value={task.raw.linked_rock_id} />
            <DetailRow label="Linked Issue" value={task.raw.linked_issue_id} />
            <DetailRow label="Linked Meeting" value={task.raw.linked_meeting_id} />
            <DetailRow label="L10 Meeting" value={task.raw.l10_meeting_id} />
          </>
        )}
        <DetailRow label="Created" value={fmtDate(task.created_at)} />
      </div>
    </Drawer>
  )
}
