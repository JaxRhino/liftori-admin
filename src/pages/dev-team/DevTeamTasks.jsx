import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_STYLES = {
  queued:      { dot: 'bg-slate-500', text: 'text-slate-300', label: 'Queued' },
  in_progress: { dot: 'bg-blue-500',  text: 'text-blue-300',  label: 'In Progress' },
  blocked:     { dot: 'bg-amber-500', text: 'text-amber-300', label: 'Blocked' },
  done:        { dot: 'bg-emerald-500', text: 'text-emerald-300', label: 'Done' },
}

export default function DevTeamTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('dev_team_tasks')
          .select('id, title, description, status, priority, wave, files_scope, assignee_user_id, claimed_at, completed_at, created_at')
          .order('created_at', { ascending: false })
        if (error) throw error
        setTasks(data || [])
      } catch (err) {
        console.error('[DevTeam] tasks load failed:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-amber-500/15 text-amber-300 font-semibold">Wave C</span>
        <div className="text-sm text-white/70">
          Lane assignment, pull-queue claiming, and skill hooks ship in Wave C. Below is the live read of <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">dev_team_tasks</code> against the schema applied in Wave A.
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left text-xs uppercase tracking-wider text-white/50">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Wave</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40">Loading…</td></tr>
            )}
            {!loading && tasks.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40 italic">No tasks yet.</td></tr>
            )}
            {tasks.map(t => {
              const s = STATUS_STYLES[t.status] || STATUS_STYLES.queued
              return (
                <tr key={t.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{t.title}</div>
                    {t.description && <div className="text-xs text-white/40 mt-0.5 line-clamp-1">{t.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-white/60">{t.wave || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                      <span className={s.text}>{s.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/60 capitalize">{t.priority}</td>
                  <td className="px-4 py-3 text-white/40">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
