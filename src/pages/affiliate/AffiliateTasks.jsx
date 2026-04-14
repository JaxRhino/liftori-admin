import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const STATUS_COLORS = {
  open: 'bg-sky-500/15 text-sky-300',
  in_progress: 'bg-amber-500/15 text-amber-300',
  done: 'bg-emerald-500/15 text-emerald-300',
  blocked: 'bg-rose-500/15 text-rose-300',
}
const PRIORITY_COLORS = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  urgent: 'text-rose-400',
}

export default function AffiliateTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newDueDate, setNewDueDate] = useState('')
  const [filter, setFilter] = useState('open')

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('admin_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('status', { ascending: true })
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      setTasks(data || [])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function addTask(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      await supabase.from('admin_tasks').insert({
        user_id: user.id,
        title: newTitle.trim(),
        priority: newPriority,
        due_date: newDueDate || null,
        status: 'open',
      })
      setNewTitle(''); setNewDueDate(''); setNewPriority('medium')
      load()
    } catch { toast.error('Save failed') }
  }

  async function changeStatus(id, status) {
    try {
      await supabase.from('admin_tasks').update({ status }).eq('id', id)
      load()
    } catch { toast.error('Update failed') }
  }

  async function deleteTask(id) {
    if (!window.confirm('Delete this task?')) return
    try {
      await supabase.from('admin_tasks').delete().eq('id', id)
      load()
    } catch { toast.error('Delete failed') }
  }

  const filtered = tasks.filter((t) => {
    if (filter === 'all') return true
    if (filter === 'open') return ['open', 'in_progress'].includes(t.status)
    return t.status === filter
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">✅ Tasks</h1>
        <p className="text-sm text-gray-400">Your daily to-do list.</p>
      </div>

      <form onSubmit={addTask} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 flex gap-2 flex-wrap">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="What needs to get done?"
          className="flex-1 min-w-[200px] bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white"
        />
        <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm">
          {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm" />
        <button type="submit" disabled={!newTitle.trim()} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          Add task
        </button>
      </form>

      <div className="flex items-center gap-1 p-1 bg-navy-800 border border-navy-700/50 rounded-lg w-fit">
        {['open', 'done', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${filter === f ? 'bg-pink-500/20 text-pink-300' : 'text-gray-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-8 italic">No tasks. You're caught up.</div>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3 flex items-center gap-3">
              <select value={t.status} onChange={(e) => changeStatus(t.id, e.target.value)} className={`text-[10px] uppercase font-bold rounded px-1.5 py-0.5 border-0 focus:outline-none ${STATUS_COLORS[t.status]}`}>
                {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s} className="bg-navy-900 text-white">{s.replace('_', ' ')}</option>)}
              </select>
              <span className={`text-xs uppercase font-bold ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
              <span className={`flex-1 text-sm ${t.status === 'done' ? 'line-through text-gray-500' : 'text-white'}`}>{t.title}</span>
              {t.due_date && <span className="text-xs text-gray-500">Due {new Date(t.due_date).toLocaleDateString()}</span>}
              <button onClick={() => deleteTask(t.id)} className="text-xs text-gray-500 hover:text-rose-400">✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
