import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PRIORITIES = [
  { value: 'high',   label: 'High',   color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  { value: 'medium', label: 'Medium', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  { value: 'low',    label: 'Low',    color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20' },
]
const STATUSES = [
  { value: 'todo',        label: 'To Do',       dot: 'bg-slate-500' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { value: 'done',        label: 'Done',        dot: 'bg-emerald-500' },
]

const INPUT = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500'
const TEXTAREA = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y'

function isOverdue(due_date, status) {
  if (!due_date || status === 'done') return false
  return new Date(due_date) < new Date(new Date().toDateString())
}

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '' })

  useEffect(() => { fetchTasks() }, [])

  async function fetchTasks() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('admin_tasks')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setTasks(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  function openCreate() {
    setEditing(null)
    setForm({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '' })
    setShowForm(true)
  }

  function openEdit(task) {
    setEditing(task)
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        updated_at: new Date().toISOString(),
      }
      if (editing) {
        const { error } = await supabase.from('admin_tasks').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('admin_tasks').insert([payload])
        if (error) throw error
      }
      await fetchTasks()
      setShowForm(false)
      setEditing(null)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function cycleStatus(task) {
    const order = ['todo', 'in_progress', 'done']
    const next = order[(order.indexOf(task.status) + 1) % order.length]
    await supabase.from('admin_tasks').update({ status: next, updated_at: new Date().toISOString() }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return
    await supabase.from('admin_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = {
    todo:        filtered.filter(t => t.status === 'todo'),
    in_progress: filtered.filter(t => t.status === 'in_progress'),
    done:        filtered.filter(t => t.status === 'done'),
  }

  const counts = {
    total: tasks.length,
    done:  tasks.filter(t => t.status === 'done').length,
    high:  tasks.filter(t => t.priority === 'high' && t.status !== 'done').length,
    overdue: tasks.filter(t => isOverdue(t.due_date, t.status)).length,
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track and manage your work items</p>
        </div>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          + New Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Tasks', value: counts.total, color: 'text-white' },
          { label: 'Completed', value: counts.done, color: 'text-emerald-400' },
          { label: 'High Priority', value: counts.high, color: 'text-red-400' },
          { label: 'Overdue', value: counts.overdue, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#0D1424] border border-white/10 rounded-xl p-4">
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-56" />
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
          {[{ value: 'all', label: 'All' }, ...STATUSES.map(s => ({ value: s.value, label: s.label }))].map(s => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterStatus === s.value ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
          {[{ value: 'all', label: 'All Priority' }, ...PRIORITIES.map(p => ({ value: p.value, label: p.label }))].map(p => (
            <button key={p.value} onClick={() => setFilterPriority(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterPriority === p.value ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-slate-500 text-xs ml-auto">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-[#0D1424] border border-blue-500/30 rounded-xl p-5 mb-5 space-y-4">
          <h3 className="text-white font-semibold">{editing ? 'Edit Task' : 'New Task'}</h3>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Task title *" className={INPUT} autoFocus />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)" rows={2} className={TEXTAREA} />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-[#0D1424] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-[#0D1424] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={!form.title.trim() || saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Task'}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null) }}
              className="text-slate-400 hover:text-white px-4 py-2 text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Task Columns */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          {search || filterStatus !== 'all' || filterPriority !== 'all'
            ? 'No tasks match your filters.'
            : 'No tasks yet — click New Task to get started.'}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {STATUSES.map(col => (
            <div key={col.value}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-sm font-semibold text-white">{col.label}</span>
                <span className="text-xs text-slate-500 ml-auto">{grouped[col.value].length}</span>
              </div>
              <div className="space-y-2">
                {grouped[col.value].map(task => {
                  const pri = PRIORITIES.find(p => p.value === task.priority)
                  const overdue = isOverdue(task.due_date, task.status)
                  return (
                    <div key={task.id}
                      className={`bg-[#0D1424] border rounded-xl p-3.5 group ${overdue ? 'border-amber-500/30' : 'border-white/10 hover:border-white/20'} transition-colors`}>
                      <div className="flex items-start gap-2">
                        <button onClick={() => cycleStatus(task)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                            task.status === 'done' ? 'bg-emerald-500 border-emerald-500' :
                            task.status === 'in_progress' ? 'border-blue-500' : 'border-slate-600 hover:border-slate-400'
                          }`}>
                          {task.status === 'done' && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                          {task.status === 'in_progress' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-snug ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${pri.bg} ${pri.color}`}>{pri.label}</span>
                            {task.due_date && (
                              <span className={`text-xs ${overdue ? 'text-amber-400' : 'text-slate-500'}`}>
                                {overdue ? '⚠️ ' : ''}Due {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(task)}
                          className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-white/10 transition-colors">Edit</button>
                        <button onClick={() => deleteTask(task.id)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 transition-colors">Delete</button>
                      </div>
                    </div>
                  )
                })}
                {grouped[col.value].length === 0 && (
                  <div className="border border-dashed border-white/10 rounded-xl p-4 text-center text-slate-600 text-xs">
                    No {col.label.toLowerCase()} tasks
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
