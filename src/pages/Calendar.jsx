import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const EVENT_COLORS = [
  { value: 'blue',    label: 'Blue',    dot: 'bg-blue-500',    pill: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'green',   label: 'Green',   dot: 'bg-emerald-500', pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'amber',   label: 'Amber',   dot: 'bg-amber-500',   pill: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'red',     label: 'Red',     dot: 'bg-red-500',     pill: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { value: 'violet',  label: 'Violet',  dot: 'bg-violet-500',  pill: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { value: 'slate',   label: 'Gray',    dot: 'bg-slate-400',   pill: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const INPUT = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500'

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function toDateStr(date) {
  return date.toISOString().split('T')[0]
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function EventModal({ event, selectedDate, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    start_date: event?.start_date || selectedDate || toDateStr(new Date()),
    end_date: event?.end_date || '',
    start_time: event?.start_time || '',
    end_time: event?.end_time || '',
    all_day: event?.all_day !== undefined ? event.all_day : true,
    color: event?.color || 'blue',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    await onSave({
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      start_time: form.all_day ? null : (form.start_time || null),
      end_time: form.all_day ? null : (form.end_time || null),
      all_day: form.all_day,
      color: form.color,
    })
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this event?')) return
    setDeleting(true)
    await onDelete(event.id)
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0D1424] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <h2 className="text-white font-semibold">{event ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Event title *" className={INPUT} autoFocus />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)" rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className={INPUT} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className={INPUT} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.all_day} onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))}
              className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-sm text-slate-300">All day</span>
          </label>
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Start Time</label>
                <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  className={INPUT} />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">End Time</label>
                <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  className={INPUT} />
              </div>
            </div>
          )}
          <div>
            <label className="text-slate-400 text-xs mb-2 block">Color</label>
            <div className="flex gap-2">
              {EVENT_COLORS.map(c => (
                <button key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  title={c.label}
                  className={`w-6 h-6 rounded-full ${c.dot} transition-transform hover:scale-110 ${form.color === c.value ? 'ring-2 ring-white/50 scale-110' : ''}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 pb-5">
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={!form.title.trim() || saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Saving...' : event ? 'Save Changes' : 'Add Event'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 text-sm transition-colors">Cancel</button>
          </div>
          {event && (
            <button onClick={handleDelete} disabled={deleting}
              className="text-red-400 hover:text-red-300 text-sm transition-colors">
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Calendar() {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDayEvents, setSelectedDayEvents] = useState([])

  useEffect(() => { fetchEvents() }, [currentYear, currentMonth])

  async function fetchEvents() {
    setLoading(true)
    const startOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const endOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${getDaysInMonth(currentYear, currentMonth)}`
    try {
      const { data, error } = await supabase
        .from('admin_calendar_events')
        .select('*')
        .or(`start_date.gte.${startOfMonth},end_date.gte.${startOfMonth}`)
        .lte('start_date', endOfMonth)
        .order('start_date', { ascending: true })
        .order('start_time', { ascending: true })
      if (error) throw error
      setEvents(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function saveEvent(payload) {
    try {
      if (editing) {
        const { error } = await supabase.from('admin_calendar_events').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('admin_calendar_events').insert([payload])
        if (error) throw error
      }
      await fetchEvents()
      setShowModal(false)
      setEditing(null)
    } catch (err) { console.error(err) }
  }

  async function deleteEvent(id) {
    await supabase.from('admin_calendar_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setShowModal(false)
    setEditing(null)
    setSelectedDayEvents(prev => prev.filter(e => e.id !== id))
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  function goToday() {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
  }

  function getEventsForDate(dateStr) {
    return events.filter(e => {
      if (!e.end_date || e.end_date === e.start_date) return e.start_date === dateStr
      return dateStr >= e.start_date && dateStr <= e.end_date
    })
  }

  function handleDayClick(dateStr) {
    const dayEvents = getEventsForDate(dateStr)
    setSelectedDate(dateStr)
    setSelectedDayEvents(dayEvents)
  }

  function openCreate(dateStr) {
    setEditing(null)
    setSelectedDate(dateStr)
    setShowModal(true)
  }

  function openEdit(event) {
    setEditing(event)
    setShowModal(true)
  }

  // Build calendar grid
  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDay + 1
    if (dayNum < 1 || dayNum > daysInMonth) cells.push(null)
    else cells.push(dayNum)
  }

  const todayStr = toDateStr(today)

  // Upcoming events (next 30 days)
  const thirtyDaysStr = toDateStr(new Date(today.getTime() + 30 * 86400000))
  const upcomingEvents = events
    .filter(e => e.start_date >= todayStr && e.start_date <= thirtyDaysStr)
    .slice(0, 5)

  const totalThisMonth = events.length

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-slate-400 text-sm mt-0.5">Schedule and track events</p>
        </div>
        <button onClick={() => openCreate(todayStr)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          + New Event
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Calendar */}
        <div className="xl:col-span-3">
          <div className="bg-[#0D1424] border border-white/10 rounded-2xl overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <button onClick={prevMonth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-white font-semibold text-lg">{MONTHS[currentMonth]} {currentYear}</h2>
                <button onClick={goToday}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors">
                  Today
                </button>
              </div>
              <button onClick={nextMonth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-white/10">
              {DAYS.map(d => (
                <div key={d} className="py-2.5 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading...</div>
            ) : (
              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} className="min-h-[90px] border-b border-r border-white/5 bg-white/[0.01]" />
                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const dayEvents = getEventsForDate(dateStr)
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDate

                  return (
                    <div key={i}
                      onClick={() => handleDayClick(dateStr)}
                      className={`min-h-[90px] border-b border-r border-white/5 p-1.5 cursor-pointer transition-colors group
                        ${isSelected ? 'bg-blue-600/10' : 'hover:bg-white/[0.02]'}
                        ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}
                      `}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                          ${isToday ? 'bg-blue-600 text-white' : 'text-slate-400 group-hover:text-white'}`}>
                          {day}
                        </span>
                        {dayEvents.length === 0 && (
                          <button onClick={e => { e.stopPropagation(); openCreate(dateStr) }}
                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-400 transition-opacity text-sm leading-none">
                            +
                          </button>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(ev => {
                          const col = EVENT_COLORS.find(c => c.value === ev.color) || EVENT_COLORS[0]
                          return (
                            <div key={ev.id}
                              onClick={e => { e.stopPropagation(); openEdit(ev) }}
                              className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer border ${col.pill} hover:opacity-80 transition-opacity`}>
                              {!ev.all_day && ev.start_time && (
                                <span className="mr-1 opacity-70">{formatTime(ev.start_time)}</span>
                              )}
                              {ev.title}
                            </div>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-slate-500 px-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected day events */}
          {selectedDate && selectedDayEvents.length > 0 && (
            <div className="mt-4 bg-[#0D1424] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <button onClick={() => openCreate(selectedDate)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors">+ Add event</button>
              </div>
              <div className="space-y-2">
                {selectedDayEvents.map(ev => {
                  const col = EVENT_COLORS.find(c => c.value === ev.color) || EVENT_COLORS[0]
                  return (
                    <div key={ev.id}
                      onClick={() => openEdit(ev)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-white/5 ${col.pill}`}>
                      <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${col.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{ev.title}</p>
                        {ev.description && <p className="text-xs text-slate-400 mt-0.5">{ev.description}</p>}
                        <p className="text-xs text-slate-500 mt-1">
                          {ev.all_day ? 'All day' : `${formatTime(ev.start_time)}${ev.end_time ? ` â ${formatTime(ev.end_time)}` : ''}`}
                          {ev.end_date && ev.end_date !== ev.start_date && ` Â· until ${new Date(ev.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Month stats */}
          <div className="bg-[#0D1424] border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">This Month</p>
            <p className="text-3xl font-bold text-white mb-1">{totalThisMonth}</p>
            <p className="text-xs text-slate-400">{totalThisMonth === 1 ? 'event' : 'events'} scheduled</p>
          </div>

          {/* Color legend */}
          <div className="bg-[#0D1424] border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Event Colors</p>
            <div className="space-y-2">
              {EVENT_COLORS.map(c => (
                <div key={c.value} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                  <span className="text-xs text-slate-400">{c.label}</span>
                  <span className="text-xs text-slate-600 ml-auto">
                    {events.filter(e => e.color === c.value).length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming events */}
          <div className="bg-[#0D1424] border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Upcoming (30 days)</p>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-slate-600">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map(ev => {
                  const col = EVENT_COLORS.find(c => c.value === ev.color) || EVENT_COLORS[0]
                  const evDate = new Date(ev.start_date + 'T12:00:00')
                  return (
                    <div key={ev.id} onClick={() => openEdit(ev)}
                      className="flex items-start gap-2.5 cursor-pointer group">
                      <div className={`w-1 h-full min-h-[36px] rounded-full ${col.dot} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white group-hover:text-blue-300 transition-colors truncate">{ev.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {evDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {!ev.all_day && ev.start_time && ` Â· ${formatTime(ev.start_time)}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <EventModal
          event={editing}
          selectedDate={selectedDate}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}
    </div>
  )
}
