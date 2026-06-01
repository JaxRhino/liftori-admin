import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, EmptyState, useCrmClient } from '../_shared'

// ---------- formatters ----------
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '-'
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'

// ---------- constants ----------
const EVENT_TYPES = [
  { key: 'job',      label: 'Job',      color: '#22d3ee' },
  { key: 'meeting',  label: 'Meeting',  color: '#a78bfa' },
  { key: 'personal', label: 'Personal', color: '#f59e0b' },
  { key: 'blocked',  label: 'Blocked',  color: '#ef4444' },
]
const EVENT_TYPE_COLOR = Object.fromEntries(EVENT_TYPES.map(t => [t.key, t.color]))

const EVENT_STATUSES = [
  { key: 'scheduled',   label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed',   label: 'Completed' },
  { key: 'cancelled',   label: 'Cancelled' },
]

// ---------- date helpers ----------
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x }
function startOfWeek(d){ const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x }
function endOfWeek(d)  { const x = startOfWeek(d); x.setDate(x.getDate() + 6); return endOfDay(x) }
function startOfMonth(d){ const x = startOfDay(d); x.setDate(1); return x }
function endOfMonth(d) { const x = startOfMonth(d); x.setMonth(x.getMonth()+1); x.setDate(0); return endOfDay(x) }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x }
function addMonths(d,n){ const x = new Date(d); x.setMonth(x.getMonth()+n); return x }
function sameDay(a, b) {
  return a && b && new Date(a).toDateString() === new Date(b).toDateString()
}
function ymd(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`
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
          <div className="min-w-0">{title}</div>
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

function toLocalInput(d) {
  if (!d) return ''
  const x = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function OperationsSchedule() {
  const { client } = useCrmClient()

  const [events, setEvents] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [crews, setCrews] = useState([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState('week') // week | day | month | list
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [typeFilter, setTypeFilter] = useState('all')

  const [newOpen, setNewOpen] = useState(false)
  const [newPrefill, setNewPrefill] = useState(null)
  const [openEvent, setOpenEvent] = useState(null)

  async function loadAll() {
    if (!client) return
    setLoading(true)
    try {
      const [evRes, woRes, crRes] = await Promise.all([
        client.from('ops_schedule').select('*').order('start_time', { ascending: true }).limit(500),
        client.from('ops_work_orders').select('id,work_order_number,title,address,scheduled_start,assigned_crew_id').limit(500),
        client.from('ops_crews').select('id,name,color').limit(100),
      ])
      setEvents(evRes.data || [])
      setWorkOrders(woRes.data || [])
      setCrews(crRes.data || [])
    } catch (e) {
      console.error('[OperationsSchedule] load', e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadAll() }, [client])

  const crewById = useMemo(() => {
    const m = {}; crews.forEach(c => { m[c.id] = c }); return m
  }, [crews])
  const woById = useMemo(() => {
    const m = {}; workOrders.forEach(w => { m[w.id] = w }); return m
  }, [workOrders])

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return events
    return events.filter(e => e.event_type === typeFilter)
  }, [events, typeFilter])

  // ---- nav controls ----
  function goToday() { setAnchor(startOfDay(new Date())) }
  function goPrev() {
    if (view === 'day') setAnchor(addDays(anchor, -1))
    else if (view === 'week') setAnchor(addDays(anchor, -7))
    else if (view === 'month') setAnchor(addMonths(anchor, -1))
    else setAnchor(addDays(anchor, -7))
  }
  function goNext() {
    if (view === 'day') setAnchor(addDays(anchor, 1))
    else if (view === 'week') setAnchor(addDays(anchor, 7))
    else if (view === 'month') setAnchor(addMonths(anchor, 1))
    else setAnchor(addDays(anchor, 7))
  }

  // ---- visible range label ----
  const rangeLabel = useMemo(() => {
    if (view === 'day') return fmtDate(anchor)
    if (view === 'week') {
      const ws = startOfWeek(anchor); const we = endOfWeek(anchor)
      return `${fmtDate(ws)} - ${fmtDate(we)}`
    }
    if (view === 'month') return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return 'Upcoming'
  }, [view, anchor])

  function openNewAt(dt) {
    setNewPrefill({ start: dt, end: new Date(new Date(dt).getTime() + 60*60*1000) })
    setNewOpen(true)
  }

  return (
    <HubPage
      title="Schedule"
      subtitle="Jobs, meetings, and crew availability"
      actions={
        <button
          onClick={() => { setNewPrefill(null); setNewOpen(true) }}
          className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + New Event
        </button>
      }
    >
      {/* View toggle + nav */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="flex gap-1 bg-navy-800 border border-navy-700/50 rounded-lg p-1">
          <TabBtn active={view === 'week'} onClick={() => setView('week')}>Week</TabBtn>
          <TabBtn active={view === 'day'} onClick={() => setView('day')}>Day</TabBtn>
          <TabBtn active={view === 'month'} onClick={() => setView('month')}>Month</TabBtn>
          <TabBtn active={view === 'list'} onClick={() => setView('list')}>List</TabBtn>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="text-gray-400 hover:text-white px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm">&lt;</button>
          <button onClick={goToday} className="text-brand-cyan hover:text-brand-cyan/80 px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm">Today</button>
          <button onClick={goNext} className="text-gray-400 hover:text-white px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm">&gt;</button>
          <span className="text-sm text-gray-300 ml-2">{rangeLabel}</span>
        </div>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</Chip>
        {EVENT_TYPES.map(t => (
          <Chip key={t.key} active={typeFilter === t.key} onClick={() => setTypeFilter(t.key)}>{t.label}</Chip>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading schedule...</div>
      ) : view === 'week' ? (
        <WeekView anchor={anchor} events={filtered} crewById={crewById} onEventClick={setOpenEvent} onSlotClick={openNewAt} />
      ) : view === 'day' ? (
        <DayView anchor={anchor} events={filtered} crewById={crewById} onEventClick={setOpenEvent} onSlotClick={openNewAt} />
      ) : view === 'month' ? (
        <MonthView anchor={anchor} events={filtered} onEventClick={setOpenEvent} onDayClick={(d) => openNewAt(d)} />
      ) : (
        <ListView events={filtered} crewById={crewById} onEventClick={setOpenEvent} />
      )}

      <NewEventModal
        open={newOpen}
        onClose={() => { setNewOpen(false); setNewPrefill(null) }}
        prefill={newPrefill}
        client={client}
        workOrders={workOrders}
        crews={crews}
        onSaved={() => { setNewOpen(false); setNewPrefill(null); loadAll() }}
      />

      <EventDrawer
        ev={openEvent}
        client={client}
        workOrders={workOrders}
        crews={crews}
        woById={woById}
        crewById={crewById}
        onClose={() => setOpenEvent(null)}
        onSaved={() => { loadAll() }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                              WEEK VIEW
// ===========================================================================
function WeekView({ anchor, events, crewById, onEventClick, onSlotClick }) {
  const ws = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const hours = Array.from({ length: 17 }, (_, i) => 6 + i) // 6am..10pm
  const labelFor = (h) => {
    const ampm = h >= 12 ? 'p' : 'a'
    const hr = ((h + 11) % 12) + 1
    return `${hr}${ampm}`
  }

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-navy-700/50">
        <div className="px-2 py-2"></div>
        {days.map((d, i) => (
          <div key={i} className={`px-2 py-2 text-xs ${sameDay(d, new Date()) ? 'text-brand-cyan font-semibold' : 'text-gray-400'}`}>
            {d.toLocaleDateString('en-US', { weekday: 'short' })} <span className="text-gray-500">{d.getDate()}</span>
          </div>
        ))}
      </div>
      {/* Hour rows */}
      <div className="overflow-x-auto">
        {hours.map(h => (
          <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-navy-700/30 min-h-[48px]">
            <div className="px-2 py-1 text-[11px] text-gray-500 border-r border-navy-700/40">{labelFor(h)}</div>
            {days.map((d, di) => {
              const slotStart = new Date(d); slotStart.setHours(h, 0, 0, 0)
              const slotEnd = new Date(d); slotEnd.setHours(h+1, 0, 0, 0)
              const inSlot = events.filter(e => {
                if (!e.start_time) return false
                const t = new Date(e.start_time).getTime()
                return t >= slotStart.getTime() && t < slotEnd.getTime()
              })
              return (
                <div
                  key={di}
                  onClick={() => onSlotClick(slotStart)}
                  className="relative border-r border-navy-700/30 hover:bg-navy-900/30 cursor-pointer p-1"
                >
                  {inSlot.map(e => (
                    <EventBlock key={e.id} ev={e} crewById={crewById} onClick={(evt) => { evt.stopPropagation(); onEventClick(e) }} />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function EventBlock({ ev, crewById, onClick }) {
  const color = ev.color || EVENT_TYPE_COLOR[ev.event_type] || '#60a5fa'
  return (
    <button
      onClick={onClick}
      className="block w-full text-left text-[11px] rounded px-1.5 py-1 mb-1 text-white truncate"
      style={{ backgroundColor: color + '33', borderLeft: `3px solid ${color}` }}
    >
      <span className="text-white font-medium">{fmtTime(ev.start_time)}</span>
      <span className="ml-1 text-gray-200">{ev.title}</span>
    </button>
  )
}

// ===========================================================================
//                              DAY VIEW
// ===========================================================================
function DayView({ anchor, events, crewById, onEventClick, onSlotClick }) {
  const day = startOfDay(anchor)
  const hours = Array.from({ length: 17 }, (_, i) => 6 + i)
  const dayEvents = events.filter(e => e.start_time && sameDay(e.start_time, day))
  const labelFor = (h) => {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hr = ((h + 11) % 12) + 1
    return `${hr}:00 ${ampm}`
  }
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-navy-700/50 text-sm text-white font-medium">
        {day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
      {hours.map(h => {
        const slotStart = new Date(day); slotStart.setHours(h, 0, 0, 0)
        const slotEnd = new Date(day); slotEnd.setHours(h+1, 0, 0, 0)
        const inSlot = dayEvents.filter(e => {
          const t = new Date(e.start_time).getTime()
          return t >= slotStart.getTime() && t < slotEnd.getTime()
        })
        return (
          <div
            key={h}
            onClick={() => onSlotClick(slotStart)}
            className="grid grid-cols-[100px_1fr] border-b border-navy-700/30 min-h-[60px] hover:bg-navy-900/30 cursor-pointer"
          >
            <div className="px-3 py-2 text-xs text-gray-500 border-r border-navy-700/40">{labelFor(h)}</div>
            <div className="p-2 space-y-1">
              {inSlot.map(e => {
                const color = e.color || EVENT_TYPE_COLOR[e.event_type] || '#60a5fa'
                const crew = crewById[e.crew_id]
                return (
                  <button
                    key={e.id}
                    onClick={(evt) => { evt.stopPropagation(); onEventClick(e) }}
                    className="block w-full text-left rounded px-3 py-2 text-sm"
                    style={{ backgroundColor: color + '22', borderLeft: `4px solid ${color}` }}
                  >
                    <div className="text-white font-medium">{e.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fmtTime(e.start_time)} - {fmtTime(e.end_time)}
                      {crew && <span className="ml-2">{crew.name}</span>}
                    </div>
                    {e.address && <div className="text-xs text-gray-500 mt-0.5">{e.address}</div>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ===========================================================================
//                              MONTH VIEW
// ===========================================================================
function MonthView({ anchor, events, onEventClick, onDayClick }) {
  const monthStart = startOfMonth(anchor)
  const gridStart = startOfWeek(monthStart)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const eventsByDay = useMemo(() => {
    const m = {}
    events.forEach(e => {
      if (!e.start_time) return
      const k = ymd(e.start_time)
      if (!m[k]) m[k] = []
      m[k].push(e)
    })
    return m
  }, [events])

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-navy-700/50">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="px-3 py-2 text-xs text-gray-400 uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === monthStart.getMonth()
          const dayEvents = eventsByDay[ymd(d)] || []
          const visible = dayEvents.slice(0, 3)
          const overflow = dayEvents.length - visible.length
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              className={`min-h-[100px] border-b border-r border-navy-700/30 p-1.5 cursor-pointer hover:bg-navy-900/30 ${inMonth ? '' : 'opacity-40'}`}
            >
              <div className={`text-xs mb-1 ${sameDay(d, new Date()) ? 'text-brand-cyan font-bold' : 'text-gray-400'}`}>
                {d.getDate()}
              </div>
              {visible.map(e => {
                const color = e.color || EVENT_TYPE_COLOR[e.event_type] || '#60a5fa'
                return (
                  <button
                    key={e.id}
                    onClick={(evt) => { evt.stopPropagation(); onEventClick(e) }}
                    className="block w-full text-left text-[10px] rounded px-1.5 py-0.5 mb-0.5 truncate"
                    style={{ backgroundColor: color + '33', color: '#fff', borderLeft: `2px solid ${color}` }}
                  >
                    {fmtTime(e.start_time)} {e.title}
                  </button>
                )
              })}
              {overflow > 0 && (
                <div className="text-[10px] text-gray-500 px-1.5">+{overflow} more</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===========================================================================
//                              LIST VIEW
// ===========================================================================
function ListView({ events, crewById, onEventClick }) {
  const now = Date.now()
  const upcoming = useMemo(() => {
    return events
      .filter(e => e.start_time && new Date(e.start_time).getTime() >= now - 24*60*60*1000)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [events, now])

  if (upcoming.length === 0) {
    return <EmptyState title="No upcoming events" description="Create a new event or switch to month view to scroll history." />
  }

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-900/60 border-b border-navy-700/50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2.5">Date / Time</th>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Crew</th>
              <th className="px-4 py-2.5">Address</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {upcoming.map(e => {
              const crew = crewById[e.crew_id]
              const type = EVENT_TYPES.find(t => t.key === e.event_type)
              return (
                <tr key={e.id} onClick={() => onEventClick(e)} className="hover:bg-navy-900/40 cursor-pointer">
                  <td className="px-4 py-2.5 text-xs text-gray-300">{fmtDateTime(e.start_time)}</td>
                  <td className="px-4 py-2.5 text-white">{e.title}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded"
                      style={{ backgroundColor: (type?.color || '#60a5fa') + '33', color: type?.color || '#60a5fa' }}
                    >
                      {type?.label || e.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-300">{crew?.name || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{e.address || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-300">{e.status || 'scheduled'}</td>
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
//                            NEW EVENT MODAL
// ===========================================================================
function NewEventModal({ open, onClose, prefill, client, workOrders, crews, onSaved }) {
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function blankForm() {
    return {
      title: '', event_type: 'job',
      work_order_id: '', crew_id: '', assigned_to_input: '',
      start_time: '', end_time: '', all_day: false,
      address: '', color: '', notes: '',
    }
  }

  useEffect(() => {
    if (open) {
      const base = blankForm()
      if (prefill?.start) base.start_time = toLocalInput(prefill.start)
      if (prefill?.end)   base.end_time   = toLocalInput(prefill.end)
      setForm(base)
      setErr('')
    }
  }, [open, prefill])

  // Auto-populate from WO if selected
  useEffect(() => {
    if (!form.work_order_id) return
    const wo = workOrders.find(w => w.id === form.work_order_id)
    if (!wo) return
    setForm(f => ({
      ...f,
      title: f.title || wo.title || '',
      address: f.address || wo.address || '',
      crew_id: f.crew_id || wo.assigned_crew_id || '',
      start_time: f.start_time || (wo.scheduled_start ? toLocalInput(wo.scheduled_start) : ''),
    }))
  }, [form.work_order_id, workOrders])

  async function save() {
    if (!form.title.trim()) { setErr('Title is required.'); return }
    if (!form.start_time)  { setErr('Start time is required.'); return }
    setSaving(true); setErr('')
    try {
      const assignedList = (form.assigned_to_input || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      const payload = {
        title: form.title.trim(),
        event_type: form.event_type || 'job',
        work_order_id: form.work_order_id || null,
        crew_id: form.crew_id || null,
        assigned_to: assignedList.length ? assignedList : null,
        start_time: form.start_time,
        end_time: form.end_time || null,
        all_day: !!form.all_day,
        address: form.address || null,
        color: form.color || EVENT_TYPE_COLOR[form.event_type] || null,
        notes: form.notes || null,
        status: 'scheduled',
      }
      const { error } = await client.from('ops_schedule').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewEvent] save', e)
      setErr(e.message || 'Failed to create event')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Event"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm px-4 py-2">Cancel</button>
          <button onClick={save} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {saving ? 'Saving...' : 'Create Event'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="Title *" value={form.title} onChange={(v) => setForm(f => ({ ...f, title: v }))} />
        <Select label="Type" value={form.event_type} onChange={(v) => setForm(f => ({ ...f, event_type: v, color: EVENT_TYPE_COLOR[v] || f.color }))} options={EVENT_TYPES.map(t => ({ value: t.key, label: t.label }))} />
        <Select label="Linked Work Order" value={form.work_order_id} onChange={(v) => setForm(f => ({ ...f, work_order_id: v }))} options={workOrders.map(w => ({ value: w.id, label: `${w.work_order_number || ''} ${w.title || ''}`.trim() }))} />
        <Select label="Crew" value={form.crew_id} onChange={(v) => setForm(f => ({ ...f, crew_id: v }))} options={crews.map(c => ({ value: c.id, label: c.name }))} />
        <Input label="Start *" type="datetime-local" value={form.start_time} onChange={(v) => setForm(f => ({ ...f, start_time: v }))} />
        <Input label="End" type="datetime-local" value={form.end_time} onChange={(v) => setForm(f => ({ ...f, end_time: v }))} />
        <Input label="Address" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} />
        <Input label="Color (hex)" value={form.color} onChange={(v) => setForm(f => ({ ...f, color: v }))} placeholder={EVENT_TYPE_COLOR[form.event_type]} />
        <Input label="Assigned User IDs (comma-separated)" value={form.assigned_to_input} onChange={(v) => setForm(f => ({ ...f, assigned_to_input: v }))} />
        <label className="block mb-3">
          <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">All Day</span>
          <input
            type="checkbox"
            checked={!!form.all_day}
            onChange={(e) => setForm(f => ({ ...f, all_day: e.target.checked }))}
            className="accent-brand-cyan w-4 h-4"
          />
        </label>
      </div>
      <Input label="Notes" value={form.notes} onChange={(v) => setForm(f => ({ ...f, notes: v }))} rows={2} />
      {err && <div className="text-xs text-red-400 mt-2">{err}</div>}
    </Modal>
  )
}

// ===========================================================================
//                            EVENT DRAWER
// ===========================================================================
function EventDrawer({ ev, client, workOrders, crews, woById, crewById, onClose, onSaved }) {
  const [draft, setDraft] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (ev) {
      setDraft({ ...ev })
      setEditing(false)
      setErr('')
    }
  }, [ev?.id])

  if (!ev || !draft) return null

  const linkedWo = woById[ev.work_order_id]
  const crew = crewById[ev.crew_id]

  async function save() {
    setSaving(true); setErr('')
    try {
      const payload = {
        title: draft.title,
        event_type: draft.event_type,
        work_order_id: draft.work_order_id || null,
        crew_id: draft.crew_id || null,
        start_time: draft.start_time || null,
        end_time: draft.end_time || null,
        all_day: !!draft.all_day,
        address: draft.address || null,
        color: draft.color || null,
        notes: draft.notes || null,
        status: draft.status || 'scheduled',
      }
      const { error } = await client.from('ops_schedule').update(payload).eq('id', ev.id)
      if (error) throw error
      setEditing(false)
      onSaved()
    } catch (e) { setErr(e.message || 'Save failed') } finally { setSaving(false) }
  }

  async function cancelEvent() {
    setSaving(true); setErr('')
    try {
      const { error } = await client.from('ops_schedule').update({ status: 'cancelled' }).eq('id', ev.id)
      if (error) throw error
      setDraft(d => ({ ...d, status: 'cancelled' }))
      onSaved()
    } catch (e) { setErr(e.message || 'Cancel failed') } finally { setSaving(false) }
  }

  return (
    <Drawer
      open={!!ev}
      onClose={onClose}
      title={
        <div>
          <h2 className="text-white font-semibold truncate max-w-[300px]">{ev.title}</h2>
          <div className="text-xs text-gray-500 mt-0.5">{fmtDateTime(ev.start_time)}</div>
        </div>
      }
      footer={
        editing ? (
          <div className="flex justify-end gap-2">
            <button onClick={() => { setDraft({ ...ev }); setEditing(false) }} className="text-gray-400 hover:text-white text-sm px-4 py-2">Cancel</button>
            <button onClick={save} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        ) : (
          <div className="flex justify-between">
            <button onClick={cancelEvent} disabled={saving || draft.status === 'cancelled'} className="text-red-400 hover:text-red-300 disabled:opacity-50 text-sm px-4 py-2">Cancel Event</button>
            <button onClick={() => setEditing(true)} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm font-medium px-4 py-2 rounded-lg">Edit</button>
          </div>
        )
      }
    >
      {err && <div className="text-xs text-red-400 mb-3">{err}</div>}

      {!editing ? (
        <div className="space-y-3 text-sm">
          <Row label="Type" value={EVENT_TYPES.find(t => t.key === ev.event_type)?.label || ev.event_type} />
          <Row label="Status" value={ev.status || 'scheduled'} />
          <Row label="Start" value={fmtDateTime(ev.start_time)} />
          <Row label="End" value={fmtDateTime(ev.end_time)} />
          <Row label="All Day" value={ev.all_day ? 'Yes' : 'No'} />
          <Row label="Crew" value={crew?.name || '-'} />
          <Row label="Address" value={ev.address || '-'} />
          {linkedWo && (
            <Row label="Linked WO" value={`${linkedWo.work_order_number || ''} ${linkedWo.title || ''}`.trim()} />
          )}
          {Array.isArray(ev.assigned_to) && ev.assigned_to.length > 0 && (
            <Row label="Assigned To" value={ev.assigned_to.join(', ')} />
          )}
          {ev.notes && <Row label="Notes" value={ev.notes} multiline />}
          <div className="pt-3 mt-3 border-t border-navy-700/50">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quick Status</div>
            <Select
              label=""
              value={draft.status}
              onChange={async (v) => {
                setSaving(true); setErr('')
                try {
                  const { error } = await client.from('ops_schedule').update({ status: v }).eq('id', ev.id)
                  if (error) throw error
                  setDraft(d => ({ ...d, status: v }))
                  onSaved()
                } catch (e) { setErr(e.message || 'Failed') } finally { setSaving(false) }
              }}
              options={EVENT_STATUSES.map(s => ({ value: s.key, label: s.label }))}
            />
          </div>
        </div>
      ) : (
        <div>
          <Input label="Title" value={draft.title} onChange={(v) => setDraft(d => ({ ...d, title: v }))} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <Select label="Type" value={draft.event_type} onChange={(v) => setDraft(d => ({ ...d, event_type: v }))} options={EVENT_TYPES.map(t => ({ value: t.key, label: t.label }))} />
            <Select label="Status" value={draft.status} onChange={(v) => setDraft(d => ({ ...d, status: v }))} options={EVENT_STATUSES.map(s => ({ value: s.key, label: s.label }))} />
            <Select label="Linked WO" value={draft.work_order_id} onChange={(v) => setDraft(d => ({ ...d, work_order_id: v }))} options={workOrders.map(w => ({ value: w.id, label: `${w.work_order_number || ''} ${w.title || ''}`.trim() }))} />
            <Select label="Crew" value={draft.crew_id} onChange={(v) => setDraft(d => ({ ...d, crew_id: v }))} options={crews.map(c => ({ value: c.id, label: c.name }))} />
            <Input label="Start" type="datetime-local" value={draft.start_time ? toLocalInput(draft.start_time) : ''} onChange={(v) => setDraft(d => ({ ...d, start_time: v }))} />
            <Input label="End" type="datetime-local" value={draft.end_time ? toLocalInput(draft.end_time) : ''} onChange={(v) => setDraft(d => ({ ...d, end_time: v }))} />
            <Input label="Address" value={draft.address} onChange={(v) => setDraft(d => ({ ...d, address: v }))} />
            <Input label="Color (hex)" value={draft.color} onChange={(v) => setDraft(d => ({ ...d, color: v }))} />
          </div>
          <Input label="Notes" value={draft.notes} onChange={(v) => setDraft(d => ({ ...d, notes: v }))} rows={3} />
        </div>
      )}
    </Drawer>
  )
}

function Row({ label, value, multiline }) {
  return (
    <div className={`flex ${multiline ? 'flex-col gap-1' : 'justify-between gap-3'}`}>
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-gray-200 whitespace-pre-wrap">{value}</span>
    </div>
  )
}