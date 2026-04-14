import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

export default function AffiliateCalendar() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', start_date: '', start_time: '', end_date: '', end_time: '', all_day: false,
  })

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('admin_calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .order('start_time', { ascending: true })
      if (error) throw error
      setEvents(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load calendar') }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function addEvent(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.start_date) return
    try {
      const { error } = await supabase.from('admin_calendar_events').insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        start_time: form.all_day ? null : (form.start_time || null),
        end_time: form.all_day ? null : (form.end_time || null),
        all_day: form.all_day,
      })
      if (error) throw error
      setForm({ title: '', description: '', start_date: '', start_time: '', end_date: '', end_time: '', all_day: false })
      setShowForm(false)
      load()
    } catch (err) { console.error(err); toast.error('Save failed') }
  }

  async function del(id) {
    if (!window.confirm('Delete this event?')) return
    try { await supabase.from('admin_calendar_events').delete().eq('id', id); load() }
    catch { toast.error('Delete failed') }
  }

  const grouped = events.reduce((acc, ev) => {
    const d = ev.start_date
    if (!acc[d]) acc[d] = []
    acc[d].push(ev)
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">🗓️ Calendar</h1>
          <p className="text-sm text-gray-400">Meetings, content drops, launches — upcoming events.</p>
        </div>
        <button onClick={() => setShowForm((x) => !x)} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">
          {showForm ? 'Cancel' : '+ New event'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addEvent} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 space-y-3">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="Event title" className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input type="checkbox" checked={form.all_day} onChange={(e) => setForm((f) => ({ ...f, all_day: e.target.checked }))} />
            All-day event
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-[10px] uppercase text-gray-500">Start date</span>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} required className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            </label>
            <label className="block"><span className="text-[10px] uppercase text-gray-500">End date</span>
              <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            </label>
          </div>
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="text-[10px] uppercase text-gray-500">Start time</span>
                <input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
              </label>
              <label className="block"><span className="text-[10px] uppercase text-gray-500">End time</span>
                <input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
              </label>
            </div>
          )}
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Notes / description" rows={2} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <button type="submit" className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">Save event</button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : events.length === 0 ? (
        <div className="text-center text-gray-500 py-12 italic">No upcoming events.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, evs]) => (
            <div key={date}>
              <div className="text-xs uppercase font-bold text-gray-500 mb-2">
                {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="space-y-1">
                {evs.map((ev) => (
                  <div key={ev.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3 flex items-center gap-3">
                    <div className="text-xs text-gray-400 w-20 flex-shrink-0">
                      {ev.all_day ? 'All day' : (ev.start_time?.slice(0, 5) || '—')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white">{ev.title}</div>
                      {ev.description && <div className="text-xs text-gray-500 line-clamp-2">{ev.description}</div>}
                    </div>
                    <button onClick={() => del(ev.id)} className="text-xs text-gray-500 hover:text-rose-400 flex-shrink-0">✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
