import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const STATUS_META = {
  queued:      { label: 'Queued',      dot: 'bg-slate-500',   text: 'text-slate-300',   ring: 'ring-slate-500/30' },
  in_progress: { label: 'In Progress', dot: 'bg-blue-500',    text: 'text-blue-300',    ring: 'ring-blue-500/30' },
  blocked:     { label: 'Blocked',     dot: 'bg-amber-500',   text: 'text-amber-300',   ring: 'ring-amber-500/30' },
  done:        { label: 'Done',        dot: 'bg-emerald-500', text: 'text-emerald-300', ring: 'ring-emerald-500/30' },
}
const STATUS_OPTIONS = ['queued', 'in_progress', 'blocked', 'done']

const PRIORITY_META = {
  urgent: { label: 'Urgent', text: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-500/30' },
  high:   { label: 'High',   text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  medium: { label: 'Medium', text: 'text-amber-300',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  low:    { label: 'Low',    text: 'text-slate-300',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
}
const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low']

const STATUS_RANK = { in_progress: 0, queued: 1, blocked: 2, done: 3 }
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 }

const INPUT = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue/50'
const TEXTAREA = INPUT + ' resize-y'

function StatusPill({ status }) {
  const s = STATUS_META[status] || STATUS_META.queued
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold">
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
      <span className={s.text}>{s.label}</span>
    </span>
  )
}

function PriorityPill({ priority }) {
  const p = PRIORITY_META[priority] || PRIORITY_META.medium
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${p.bg} ${p.text} ${p.border} border`}>
      {p.label}
    </span>
  )
}

function TaskCard({ task, onClick }) {
  const s = STATUS_META[task.status] || STATUS_META.queued
  const isDone = task.status === 'done'
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg p-3 border transition-all ${
        isDone
          ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] opacity-60'
          : `bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:ring-1 ${s.ring}`
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-white font-medium leading-snug flex-1 min-w-0">
          {task.title}
        </div>
        {task.wave && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue font-semibold whitespace-nowrap">
            {task.wave}
          </span>
        )}
      </div>
      {task.description && (
        <div className="text-xs text-white/50 mt-1.5 line-clamp-2">{task.description}</div>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <StatusPill status={task.status} />
        <PriorityPill priority={task.priority} />
        {task.files_scope && task.files_scope.length > 0 && (
          <span className="text-[10px] text-white/40 font-mono">
            {task.files_scope.length} file{task.files_scope.length === 1 ? '' : 's'}
          </span>
        )}
        {task.estimated_minutes != null && (
          <span className="text-[10px] text-white/40 font-mono">
            ~{task.estimated_minutes}m
          </span>
        )}
        {task.acceptance_criteria && (
          <span className="text-[10px] text-emerald-400/70 font-mono" title="Has acceptance criteria">
            ✓ DoD
          </span>
        )}
      </div>
    </button>
  )
}

function LaneColumn({ title, count, color, children }) {
  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden min-h-[200px]">
      <div className="bg-white/5 px-4 py-2.5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${color}`}></span>
          <span className="text-sm text-white font-semibold">{title}</span>
        </div>
        <span className="text-xs text-white/40">{count}</span>
      </div>
      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function TaskFormModal({ editing, members, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(editing)
  useEffect(() => { setForm(editing) }, [editing])

  const isNew = !editing?.id
  const filesScopeStr = (form?.files_scope || []).join('\n')

  function update(patch) { setForm(prev => ({ ...prev, ...patch })) }

  function save() {
    if (!form?.title?.trim()) return
    onSave({
      ...form,
      files_scope: filesScopeStr.split('\n').map(s => s.trim()).filter(Boolean),
    })
  }

  if (!form) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-navy-900 border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-heading text-white tracking-wide">{isNew ? 'New Task' : 'Edit Task'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Title *</label>
            <input className={INPUT} value={form.title || ''} onChange={e => update({ title: e.target.value })} placeholder="Wave D: Wire activity feed realtime stream" autoFocus />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Description</label>
            <textarea className={TEXTAREA} rows={3} value={form.description || ''} onChange={e => update({ description: e.target.value })} placeholder="What needs to happen, why it matters, what the success criteria are." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Assignee</label>
              <select className={INPUT} value={form.assignee_user_id || ''} onChange={e => update({ assignee_user_id: e.target.value || null })}>
                <option value="">Shared / Unassigned</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Wave</label>
              <input className={INPUT} value={form.wave || ''} onChange={e => update({ wave: e.target.value })} placeholder="A / B / C / D / E" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Status</label>
              <select className={INPUT} value={form.status || 'queued'} onChange={e => update({ status: e.target.value })}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Priority</label>
              <select className={INPUT} value={form.priority || 'medium'} onChange={e => update({ priority: e.target.value })}>
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Approach (where to find / where to change / verify steps)</label>
            <textarea className={TEXTAREA + ' font-mono text-xs'} rows={6} value={form.approach || ''} onChange={e => update({ approach: e.target.value })} placeholder={"WHERE TO FIND:\n- src/App.jsx line 448 (the ComingSoon route)\n- src/pages/Tasks.jsx (the real component, already 14KB)\n\nWHERE TO CHANGE:\n1. Add import line ...\n2. Replace route element ...\n\nVERIFY:\n- npx vite build green\n- Visit /admin/tasks ..."} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Acceptance Criteria (Done = ?)</label>
              <textarea className={TEXTAREA} rows={4} value={form.acceptance_criteria || ''} onChange={e => update({ acceptance_criteria: e.target.value })} placeholder={"1. /admin/tasks renders Tasks.jsx (not ComingSoon)\n2. Creating a task persists\n3. Vite build green"} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Test Plan (verify steps)</label>
              <textarea className={TEXTAREA} rows={4} value={form.test_plan || ''} onChange={e => update({ test_plan: e.target.value })} placeholder={"1. Build verify\n2. Smoke test on deployed\n3. Mobile viewport check"} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Estimated minutes</label>
              <input type="number" min="0" className={INPUT} value={form.estimated_minutes ?? ''} onChange={e => update({ estimated_minutes: e.target.value === '' ? null : Number(e.target.value) })} placeholder="30" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Business impact</label>
              <input className={INPUT} value={form.business_impact || ''} onChange={e => update({ business_impact: e.target.value })} placeholder="Unblocks customer signup; saves N hrs/week; etc." />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Reference links (one URL per line)</label>
            <textarea className={TEXTAREA + ' font-mono text-xs'} rows={2} defaultValue={(form.reference_links || []).join('\n')} onChange={e => update({ reference_links: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} placeholder={"https://github.com/JaxRhino/liftori-admin/blob/main/src/App.jsx\nmemory://feedback_scoped_git_add"} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Files Scope (one path per line)</label>
            <textarea className={TEXTAREA + ' font-mono text-xs'} rows={3} defaultValue={filesScopeStr} onChange={e => update({ files_scope: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} placeholder="liftori-admin/src/pages/dev-team/**&#10;liftori-admin/src/components/AdminLayout.jsx" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Notes (gotchas, decisions, side context)</label>
            <textarea className={TEXTAREA} rows={2} value={form.notes || ''} onChange={e => update({ notes: e.target.value })} placeholder="Decisions made, gotchas, links to context" />
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex items-center justify-between">
          <div>
            {!isNew && (
              <button onClick={() => onDelete(form.id)} className="text-sm text-red-400 hover:text-red-300 px-3 py-2">
                Delete task
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5">Cancel</button>
            <button onClick={save} disabled={!form.title?.trim()} className="px-4 py-2 rounded-lg text-sm bg-brand-blue text-navy-950 font-semibold hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed">
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DevTeamTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMine, setFilterMine] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)

  async function fetchAll() {
    const [tRes, mRes] = await Promise.all([
      supabase.from('dev_team_tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('dev_team_members').select('user_id, display_name').eq('active', true).order('display_name'),
    ])
    if (!tRes.error) setTasks(tRes.data || [])
    if (!mRes.error) setMembers(mRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('dev_team_tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_team_tasks' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const memberByUid = useMemo(() => Object.fromEntries(members.map(m => [m.user_id, m])), [members])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter(t => {
      if (filterMine && t.assignee_user_id !== user?.id) return false
      if (!showDone && t.status === 'done') return false
      if (q && !t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [tasks, filterMine, showDone, search, user])

  const lanes = useMemo(() => {
    // Each member gets their own lane, plus a Shared lane for unassigned
    const buckets = {}
    members.forEach(m => { buckets[m.user_id] = [] })
    buckets.__shared = []
    visible.forEach(t => {
      if (!t.assignee_user_id || !buckets[t.assignee_user_id]) buckets.__shared.push(t)
      else buckets[t.assignee_user_id].push(t)
    })
    const sortFn = (a, b) =>
      (STATUS_RANK[a.status] - STATUS_RANK[b.status]) ||
      (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) ||
      (new Date(b.created_at) - new Date(a.created_at))
    Object.keys(buckets).forEach(k => buckets[k].sort(sortFn))
    return buckets
  }, [visible, members])

  async function saveTask(t) {
    const payload = {
      title: t.title.trim(),
      description: t.description?.trim() || null,
      assignee_user_id: t.assignee_user_id || null,
      status: t.status || 'queued',
      priority: t.priority || 'medium',
      files_scope: t.files_scope || [],
      wave: t.wave?.trim() || null,
      notes: t.notes?.trim() || null,
      approach: t.approach?.trim() || null,
      acceptance_criteria: t.acceptance_criteria?.trim() || null,
      test_plan: t.test_plan?.trim() || null,
      reference_links: t.reference_links || [],
      estimated_minutes: t.estimated_minutes ?? null,
      business_impact: t.business_impact?.trim() || null,
      claimed_at: t.status === 'in_progress' && !t.claimed_at ? new Date().toISOString() : t.claimed_at,
      completed_at: t.status === 'done' && !t.completed_at ? new Date().toISOString() : (t.status !== 'done' ? null : t.completed_at),
    }
    if (t.id) {
      await supabase.from('dev_team_tasks').update(payload).eq('id', t.id)
    } else {
      await supabase.from('dev_team_tasks').insert({ ...payload, created_by: user.id })
    }
    setEditing(null)
    fetchAll()
  }

  async function deleteTask(id) {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    await supabase.from('dev_team_tasks').delete().eq('id', id)
    setEditing(null)
    fetchAll()
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue/50 w-64"
            placeholder="Search title or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            onClick={() => setFilterMine(v => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
              filterMine ? 'bg-brand-blue text-navy-950' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Mine only
          </button>
          <button
            onClick={() => setShowDone(v => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
              showDone ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {showDone ? 'Hide done' : 'Show done'}
          </button>
        </div>
        <button
          onClick={() => setEditing({ status: 'queued', priority: 'medium', files_scope: [] })}
          className="px-4 py-2 rounded-lg bg-brand-blue text-navy-950 font-semibold text-sm hover:bg-brand-blue/90 transition-colors"
        >
          + New Task
        </button>
      </div>

      {/* Lanes */}
      {loading ? (
        <div className="text-white/40 text-center py-12">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m, i) => {
            const colors = ['bg-cyan-400', 'bg-violet-400', 'bg-emerald-400', 'bg-rose-400']
            return (
              <LaneColumn key={m.user_id} title={m.display_name} count={lanes[m.user_id]?.length || 0} color={colors[i % colors.length]}>
                {(lanes[m.user_id] || []).map(t => (
                  <TaskCard key={t.id} task={t} onClick={() => setEditing({ ...t })} />
                ))}
                {(lanes[m.user_id] || []).length === 0 && (
                  <div className="text-xs text-white/30 italic text-center py-4">No tasks</div>
                )}
              </LaneColumn>
            )
          })}
          <LaneColumn title="Shared / Unassigned" count={lanes.__shared?.length || 0} color="bg-white/40">
            {(lanes.__shared || []).map(t => (
              <TaskCard key={t.id} task={t} onClick={() => setEditing({ ...t })} />
            ))}
            {(lanes.__shared || []).length === 0 && (
              <div className="text-xs text-white/30 italic text-center py-4">No tasks</div>
            )}
          </LaneColumn>
        </div>
      )}

      {/* Footer counts */}
      {!loading && (
        <div className="text-xs text-white/40 text-center">
          {visible.length} task{visible.length === 1 ? '' : 's'} visible · {tasks.length} total
        </div>
      )}

      {editing && (
        <TaskFormModal
          editing={editing}
          members={members}
          onClose={() => setEditing(null)}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}
    </div>
  )
}
