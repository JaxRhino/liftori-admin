import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HubPage, Section, EmptyState, useCrmClient } from './_shared'

// ---------- formatters ----------
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const fmtTime = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
const fmtTimeRange = (s, e, all) => {
  if (all) return 'All day'
  if (!s) return ''
  if (!e) return fmtTime(s)
  return `${fmtTime(s)} - ${fmtTime(e)}`
}
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const startOfWeek = (d) => addDays(startOfDay(d), -d.getDay())
const monthLabel = (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const weekLabel = (d) => {
  const s = startOfWeek(d)
  const e = addDays(s, 6)
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}
const dayLabel = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

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
      <span className="text-white text-right max-w-[260px] truncate">{value || '-'}</span>
    </div>
  )
}

function SourceBadge({ source }) {
  if (source === 'ops') return <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Ops</span>
  return <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-brand-cyan/20 text-brand-cyan">Personal</span>
}

// ---------- color presets ----------
const COLOR_PRESETS = [
  { key: 'cyan', value: '#22d3ee', class: 'bg-brand-cyan' },
  { key: 'blue', value: '#3b82f6', class: 'bg-brand-blue' },
  { key: 'emerald', value: '#10b981', class: 'bg-emerald-400' },
  { key: 'amber', value: '#f59e0b', class: 'bg-amber-400' },
  { key: 'rose', value: '#f43f5e', class: 'bg-rose-400' },
  { key: 'violet', value: '#8b5cf6', class: 'bg-violet-400' },
]

const OPS_EVENT_TYPES = ['job', 'meeting', 'personal', 'blocked']

// ---------- event normalizers ----------
function normalizeAdminEvent(row) {
  const s = row.all_day
    ? `${row.start_date}T00:00:00`
    : `${row.start_date}T${row.start_time || '00:00:00'}`
  const e = row.all_day
    ? `${row.end_date || row.start_date}T23:59:59`
    : `${row.end_date || row.start_date}T${row.end_time || row.start_time || '00:00:00'}`
  return {
    id: `admin-${row.id}`,
    source: 'admin',
    title: row.title || '(untitled)',
    start: new Date(s).toISOString(),
    end: new Date(e).toISOString(),
    all_day: !!row.all_day,
    color: row.color || '#22d3ee',
    notes: row.description || '',
    event_type: null,
    status: null,
    address: null,
    raw: row,
  }
}

function normalizeOpsEvent(row) {
  return {
    id: `ops-${row.id}`,
    source: 'ops',
    title: row.title || '(untitled)',
    start: row.start_time,
    end: row.end_time || row.start_time,
    all_day: !!row.all_day,
    color: row.color || '#f59e0b',
    notes: row.notes || '',
    event_type: row.event_type || 'meeting',
    status: row.status || 'scheduled',
    address: row.address || null,
    raw: row,
  }
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function CrmCalendar() {
  const { client, platform } = useCrmClient()
  const navigate = useNavigate()
  const { platformId } = useParams()

  const [view, setView] = useState('month') // month | week | day | list
  const [cursor, setCursor] = useState(startOfDay(new Date()))
  const [sourceFilter, setSourceFilter] = useState('all') // all | admin | ops
  const [typeFilter, setTypeFilter] = useState('all') // all | job | meeting | personal | blocked

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const [newOpen, setNewOpen] = useState(false)
  const [newPrefill, setNewPrefill] = useState(null) // {start_date}
  const [eventDrawer, setEventDrawer] = useState(null)

  // ---- determine range to query ----
  const range = useMemo(() => {
    if (view === 'month') {
      const start = startOfWeek(startOfMonth(cursor))
      const end = addDays(startOfWeek(addDays(endOfMonth(cursor), 1)), -1)
      return { start, end: addDays(end, 1) }
    }
    if (view === 'week') {
      const start = startOfWeek(cursor)
      return { start, end: addDays(start, 7) }
    }
    if (view === 'day') {
      const start = startOfDay(cursor)
      return { start, end: addDays(start, 1) }
    }
    // list: next 30 days from cursor
    const start = startOfDay(cursor)
    return { start, end: addDays(start, 30) }
  }, [cursor, view])

  // ---- loader ----
  async function load() {
    if (!client) return
    setLoading(true)
    try {
      const startIso = range.start.toISOString()
      const endIso = range.end.toISOString()
      const startDateOnly = ymd(range.start)
      const endDateOnly = ymd(range.end)

      const queries = []
      if (sourceFilter !== 'ops') {
        queries.push(
          client
            .from('admin_calendar_events')
            .select('*')
            .gte('start_date', startDateOnly)
            .lt('start_date', endDateOnly)
            .order('start_date', { ascending: true })
            .limit(500)
        )
      } else {
        queries.push(Promise.resolve({ data: [], error: null }))
      }
      if (sourceFilter !== 'admin') {
        queries.push(
          client
            .from('ops_schedule')
            .select('*')
            .gte('start_time', startIso)
            .lt('start_time', endIso)
            .order('start_time', { ascending: true })
            .limit(500)
        )
      } else {
        queries.push(Promise.resolve({ data: [], error: null }))
      }

      const [adminRes, opsRes] = await Promise.all(queries)
      if (adminRes.error) throw adminRes.error
      if (opsRes.error) throw opsRes.error

      const adminEv = (adminRes.data || []).map(normalizeAdminEvent)
      const opsEv = (opsRes.data || []).map(normalizeOpsEvent)
      const merged = [...adminEv, ...opsEv].sort((a, b) => new Date(a.start) - new Date(b.start))
      setEvents(merged)
    } catch (e) {
      console.error('[CrmCalendar] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, range.start.toISOString(), range.end.toISOString(), sourceFilter])

  // ---- filtered events ----
  const visible = useMemo(() => {
    return events.filter((ev) => {
      if (typeFilter !== 'all' && ev.source === 'ops' && ev.event_type !== typeFilter) return false
      return true
    })
  }, [events, typeFilter])

  // ---- nav handlers ----
  const goToday = () => setCursor(startOfDay(new Date()))
  const goPrev = () => {
    if (view === 'month') setCursor(addMonths(cursor, -1))
    else if (view === 'week') setCursor(addDays(cursor, -7))
    else if (view === 'day') setCursor(addDays(cursor, -1))
    else setCursor(addDays(cursor, -7))
  }
  const goNext = () => {
    if (view === 'month') setCursor(addMonths(cursor, 1))
    else if (view === 'week') setCursor(addDays(cursor, 7))
    else if (view === 'day') setCursor(addDays(cursor, 1))
    else setCursor(addDays(cursor, 7))
  }

  const currentLabel = useMemo(() => {
    if (view === 'month') return monthLabel(cursor)
    if (view === 'week') return weekLabel(cursor)
    if (view === 'day') return dayLabel(cursor)
    return `Next 30 days from ${fmtDate(cursor)}`
  }, [view, cursor])

  function openNewFor(date) {
    setNewPrefill({ start_date: ymd(date) })
    setNewOpen(true)
  }

  return (
    <HubPage
      title="Calendar"
      subtitle={`Schedule events, jobs, and team availability${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
    >
      {/* nav bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={goPrev} className="bg-navy-800 border border-navy-700/60 text-gray-300 hover:text-white text-sm px-3 py-1.5 rounded-lg">&lt;</button>
        <button onClick={goToday} className="bg-navy-800 border border-navy-700/60 text-gray-300 hover:text-white text-sm px-3 py-1.5 rounded-lg">Today</button>
        <button onClick={goNext} className="bg-navy-800 border border-navy-700/60 text-gray-300 hover:text-white text-sm px-3 py-1.5 rounded-lg">&gt;</button>
        <span className="text-white font-medium ml-2">{currentLabel}</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => { setNewPrefill(null); setNewOpen(true) }}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium"
          >
            + New Event
          </button>
        </div>
      </div>

      {/* view toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <TabBtn active={view === 'month'} onClick={() => setView('month')}>Month</TabBtn>
        <TabBtn active={view === 'week'} onClick={() => setView('week')}>Week</TabBtn>
        <TabBtn active={view === 'day'} onClick={() => setView('day')}>Day</TabBtn>
        <TabBtn active={view === 'list'} onClick={() => setView('list')}>List</TabBtn>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Source</span>
        <Chip active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>All</Chip>
        <Chip active={sourceFilter === 'admin'} onClick={() => setSourceFilter('admin')}>Personal</Chip>
        <Chip active={sourceFilter === 'ops'} onClick={() => setSourceFilter('ops')}>Ops</Chip>
        <span className="text-xs text-gray-500 uppercase tracking-wider ml-3 mr-1">Type</span>
        <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</Chip>
        {OPS_EVENT_TYPES.map((t) => (
          <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>{t}</Chip>
        ))}
      </div>

      {loading ? (
        <Section title={currentLabel}><div className="p-6 text-sm text-gray-500">Loading events...</div></Section>
      ) : (
        <>
          {view === 'month' && (
            <MonthView cursor={cursor} events={visible} onCellClick={openNewFor} onEventClick={(ev) => setEventDrawer(ev)} />
          )}
          {view === 'week' && (
            <WeekView cursor={cursor} events={visible} onCellClick={openNewFor} onEventClick={(ev) => setEventDrawer(ev)} />
          )}
          {view === 'day' && (
            <DayView cursor={cursor} events={visible} onCellClick={openNewFor} onEventClick={(ev) => setEventDrawer(ev)} />
          )}
          {view === 'list' && (
            <ListView events={visible} onEventClick={(ev) => setEventDrawer(ev)} />
          )}
        </>
      )}

      <NewEventModal
        open={newOpen}
        onClose={() => { setNewOpen(false); setNewPrefill(null) }}
        client={client}
        prefill={newPrefill}
        onSaved={() => { setNewOpen(false); setNewPrefill(null); load() }}
      />

      <EventDrawer
        ev={eventDrawer}
        onClose={() => setEventDrawer(null)}
        client={client}
        onChanged={() => { setEventDrawer(null); load() }}
        onOpenWorkOrder={(woId) => {
          if (woId) navigate(`/crm/${platformId}/operations/work-orders`)
        }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                              MONTH VIEW
// ===========================================================================
function MonthView({ cursor, events, onCellClick, onEventClick }) {
  const monthStart = startOfMonth(cursor)
  const gridStart = startOfWeek(monthStart)
  const monthEnd = endOfMonth(cursor)
  const gridEnd = addDays(startOfWeek(addDays(monthEnd, 1)), -1)
  const totalDays = Math.round((gridEnd - gridStart) / 86400000) + 1
  const weeks = Math.ceil(totalDays / 7)

  const cells = []
  for (let i = 0; i < weeks * 7; i++) cells.push(addDays(gridStart, i))

  function eventsForDay(day) {
    const key = ymd(day)
    return events.filter((ev) => ymd(new Date(ev.start)) === key)
  }

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-navy-700/50 text-xs text-gray-400 uppercase tracking-wider">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
          <div key={d} className="px-3 py-2 text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(110px, 1fr)' }}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth()
          const isToday = ymd(d) === ymd(new Date())
          const dayEvents = eventsForDay(d)
          return (
            <div
              key={i}
              onClick={() => onCellClick(d)}
              className={`border-b border-r border-navy-700/40 p-1.5 cursor-pointer hover:bg-navy-700/20 ${inMonth ? '' : 'bg-navy-900/30 opacity-60'}`}
            >
              <div className={`text-xs mb-1 ${isToday ? 'text-brand-cyan font-bold' : inMonth ? 'text-gray-300' : 'text-gray-600'}`}>
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                    className="w-full flex items-center gap-1 text-left text-[11px] px-1 py-0.5 rounded bg-navy-900/60 hover:bg-navy-900 truncate"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                    <span className="text-white truncate">{ev.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-brand-cyan">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===========================================================================
//                              WEEK VIEW
// ===========================================================================
function WeekView({ cursor, events, onCellClick, onEventClick }) {
  const weekStart = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 17 }, (_, i) => 6 + i) // 6am - 10pm

  const allDay = events.filter((ev) => ev.all_day)
  const timed = events.filter((ev) => !ev.all_day)

  function eventsForDayHour(day, hour) {
    const key = ymd(day)
    return timed.filter((ev) => {
      const s = new Date(ev.start)
      return ymd(s) === key && s.getHours() === hour
    })
  }

  function allDayForDay(day) {
    const key = ymd(day)
    return allDay.filter((ev) => ymd(new Date(ev.start)) === key)
  }

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      {/* day headers */}
      <div className="grid border-b border-navy-700/50" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        <div />
        {days.map((d) => {
          const isToday = ymd(d) === ymd(new Date())
          return (
            <div key={d.toISOString()} className={`px-2 py-2 text-center text-xs ${isToday ? 'text-brand-cyan font-bold' : 'text-gray-400'}`}>
              <div>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className="text-white">{d.getDate()}</div>
            </div>
          )
        })}
      </div>
      {/* all-day banner */}
      <div className="grid border-b border-navy-700/50 bg-navy-900/30" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        <div className="px-2 py-1 text-[10px] text-gray-500 uppercase">All</div>
        {days.map((d) => {
          const ev = allDayForDay(d)
          return (
            <div key={d.toISOString()} className="p-1 border-l border-navy-700/40 min-h-[24px]">
              {ev.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  className="block w-full text-left text-[11px] px-1 py-0.5 rounded truncate text-white mb-0.5"
                  style={{ backgroundColor: `${e.color}40` }}
                >
                  {e.title}
                </button>
              ))}
            </div>
          )
        })}
      </div>
      {/* hour rows */}
      <div className="overflow-y-auto max-h-[600px]">
        {hours.map((h) => (
          <div key={h} className="grid border-b border-navy-700/30" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
            <div className="px-2 py-1 text-[10px] text-gray-500 border-r border-navy-700/40">{h % 12 || 12}{h < 12 ? 'am' : 'pm'}</div>
            {days.map((d) => {
              const ev = eventsForDayHour(d, h)
              return (
                <div
                  key={d.toISOString() + h}
                  onClick={() => onCellClick(d)}
                  className="border-l border-navy-700/40 p-1 min-h-[40px] cursor-pointer hover:bg-navy-700/20"
                >
                  {ev.map((e) => (
                    <button
                      key={e.id}
                      onClick={(evt) => { evt.stopPropagation(); onEventClick(e) }}
                      className="block w-full text-left text-[11px] px-1 py-0.5 rounded truncate text-white mb-0.5"
                      style={{ backgroundColor: `${e.color}60` }}
                    >
                      <span className="font-medium">{e.title}</span>
                      <span className="ml-1 text-[10px] opacity-80">{fmtTime(e.start)}</span>
                    </button>
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

// ===========================================================================
//                               DAY VIEW
// ===========================================================================
function DayView({ cursor, events, onCellClick, onEventClick }) {
  const day = startOfDay(cursor)
  const key = ymd(day)
  const dayEvents = events.filter((ev) => ymd(new Date(ev.start)) === key)
  const allDay = dayEvents.filter((ev) => ev.all_day)
  const timed = dayEvents.filter((ev) => !ev.all_day)

  const hours = Array.from({ length: 17 }, (_, i) => 6 + i)

  function eventsForHour(h) {
    return timed.filter((ev) => new Date(ev.start).getHours() === h)
  }

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-navy-700/50 text-white font-medium">{dayLabel(day)}</div>
      {allDay.length > 0 && (
        <div className="px-4 py-2 bg-navy-900/30 border-b border-navy-700/50">
          <div className="text-[10px] text-gray-500 uppercase mb-1">All day</div>
          <div className="flex flex-wrap gap-2">
            {allDay.map((e) => (
              <button
                key={e.id}
                onClick={() => onEventClick(e)}
                className="text-xs px-2 py-1 rounded text-white"
                style={{ backgroundColor: `${e.color}50` }}
              >
                {e.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="overflow-y-auto max-h-[600px]">
        {hours.map((h) => (
          <div key={h} className="grid border-b border-navy-700/30" style={{ gridTemplateColumns: '80px 1fr' }}>
            <div className="px-3 py-2 text-xs text-gray-500 border-r border-navy-700/40">{h % 12 || 12}:00 {h < 12 ? 'am' : 'pm'}</div>
            <div
              onClick={() => onCellClick(day)}
              className="p-2 cursor-pointer hover:bg-navy-700/20 min-h-[60px]"
            >
              {eventsForHour(h).map((e) => (
                <button
                  key={e.id}
                  onClick={(evt) => { evt.stopPropagation(); onEventClick(e) }}
                  className="block w-full text-left rounded p-2 mb-1 text-white"
                  style={{ backgroundColor: `${e.color}60` }}
                >
                  <div className="font-medium text-sm">{e.title}</div>
                  <div className="text-[11px] opacity-80">{fmtTimeRange(e.start, e.end, e.all_day)}</div>
                  {e.event_type && <div className="text-[10px] uppercase mt-1 opacity-70">{e.event_type}</div>}
                  {e.address && <div className="text-[10px] opacity-70 mt-0.5">{e.address}</div>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===========================================================================
//                              LIST VIEW
// ===========================================================================
function ListView({ events, onEventClick }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No events in this range"
        description="Add an event or expand the range to see what's scheduled."
      />
    )
  }
  return (
    <Section title="Upcoming">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider bg-navy-900/30">
            <tr>
              <th className="text-left px-4 py-2">Date / Time</th>
              <th className="text-left px-4 py-2">Title</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Source</th>
              <th className="text-left px-4 py-2">Location</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {events.map((ev) => (
              <tr key={ev.id} onClick={() => onEventClick(ev)} className="cursor-pointer hover:bg-navy-700/30">
                <td className="px-4 py-2 text-gray-300">
                  <div className="text-white">{fmtDate(ev.start)}</div>
                  <div className="text-[11px] text-gray-500">{fmtTimeRange(ev.start, ev.end, ev.all_day)}</div>
                </td>
                <td className="px-4 py-2 text-white">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ev.color }} />
                    {ev.title}
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-300 capitalize">{ev.event_type || '-'}</td>
                <td className="px-4 py-2"><SourceBadge source={ev.source} /></td>
                <td className="px-4 py-2 text-gray-500">{ev.address || '-'}</td>
                <td className="px-4 py-2 text-gray-300 capitalize">{ev.status || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ===========================================================================
//                            NEW EVENT MODAL
// ===========================================================================
function NewEventModal({ open, onClose, client, prefill, onSaved }) {
  const [destination, setDestination] = useState('admin')
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const today = prefill?.start_date || ymd(new Date())
    setDestination('admin')
    setForm({
      title: '',
      all_day: false,
      start_date: today,
      end_date: today,
      start_time: '09:00',
      end_time: '10:00',
      color: '#22d3ee',
      description: '',
      event_type: 'meeting',
      notes: '',
      address: '',
      work_order_id: '',
      project_id: '',
    })
  }, [open, prefill])

  async function submit() {
    if (!client) return
    if (!form.title) { alert('Title required'); return }
    setSaving(true)
    try {
      if (destination === 'admin') {
        const payload = {
          title: form.title,
          description: form.description || null,
          start_date: form.start_date,
          end_date: form.end_date || form.start_date,
          start_time: form.all_day ? null : form.start_time || null,
          end_time: form.all_day ? null : form.end_time || null,
          all_day: !!form.all_day,
          color: form.color || '#22d3ee',
          project_id: form.project_id || null,
        }
        const { error } = await client.from('admin_calendar_events').insert(payload)
        if (error) throw error
      } else {
        const startIso = form.all_day
          ? new Date(`${form.start_date}T00:00:00`).toISOString()
          : new Date(`${form.start_date}T${form.start_time || '09:00'}:00`).toISOString()
        const endIso = form.all_day
          ? new Date(`${form.end_date || form.start_date}T23:59:59`).toISOString()
          : new Date(`${form.end_date || form.start_date}T${form.end_time || form.start_time || '10:00'}:00`).toISOString()
        const payload = {
          title: form.title,
          event_type: form.event_type || 'meeting',
          start_time: startIso,
          end_time: endIso,
          all_day: !!form.all_day,
          color: form.color || '#f59e0b',
          notes: form.notes || null,
          address: form.address || null,
          work_order_id: form.work_order_id || null,
          status: 'scheduled',
        }
        const { error } = await client.from('ops_schedule').insert(payload)
        if (error) throw error
      }
      onSaved()
    } catch (e) {
      console.error('[NewEventModal] submit', e)
      alert('Could not save event: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Event"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Event'}
          </button>
        </div>
      }
    >
      <div className="flex gap-2 mb-4">
        <span className="text-xs text-gray-400 uppercase tracking-wider self-center">Save to:</span>
        <Chip active={destination === 'admin'} onClick={() => setDestination('admin')}>Personal Calendar</Chip>
        <Chip active={destination === 'ops'} onClick={() => setDestination('ops')}>Ops Schedule</Chip>
      </div>

      <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />

      <label className="flex items-center gap-2 mb-3 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={!!form.all_day}
          onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
          className="rounded"
        />
        All day
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
        <Input label="End Date" type="date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
        {!form.all_day && (
          <>
            <Input label="Start Time" type="time" value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
            <Input label="End Time" type="time" value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
          </>
        )}
      </div>

      <div className="mb-3">
        <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Color</span>
        <div className="flex gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.key}
              onClick={() => setForm({ ...form, color: c.value })}
              className={`w-7 h-7 rounded-full border-2 ${form.color === c.value ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c.value }}
              aria-label={c.key}
            />
          ))}
        </div>
      </div>

      {destination === 'admin' && (
        <>
          <Input label="Description" rows={3} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <Input label="Project ID (optional)" value={form.project_id} onChange={(v) => setForm({ ...form, project_id: v })} placeholder="uuid" />
        </>
      )}

      {destination === 'ops' && (
        <>
          <Select
            label="Event Type"
            value={form.event_type}
            onChange={(v) => setForm({ ...form, event_type: v })}
            options={OPS_EVENT_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <Input label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="123 Main St" />
          <Input label="Job ID (optional)" value={form.work_order_id} onChange={(v) => setForm({ ...form, work_order_id: v })} placeholder="uuid" />
          <Input label="Notes" rows={3} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        </>
      )}
    </Modal>
  )
}

// ===========================================================================
//                           EVENT DETAIL DRAWER
// ===========================================================================
function EventDrawer({ ev, onClose, client, onChanged, onOpenWorkOrder }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!ev) return
    if (ev.source === 'admin') {
      const r = ev.raw
      setForm({
        title: r.title || '',
        description: r.description || '',
        start_date: r.start_date || '',
        end_date: r.end_date || r.start_date || '',
        start_time: r.start_time || '',
        end_time: r.end_time || '',
        all_day: !!r.all_day,
        color: r.color || '#22d3ee',
      })
    } else {
      const r = ev.raw
      setForm({
        title: r.title || '',
        notes: r.notes || '',
        address: r.address || '',
        event_type: r.event_type || 'meeting',
        color: r.color || '#f59e0b',
        all_day: !!r.all_day,
        start_time: r.start_time ? r.start_time.slice(0, 16) : '',
        end_time: r.end_time ? r.end_time.slice(0, 16) : '',
        work_order_id: r.work_order_id || '',
        status: r.status || 'scheduled',
      })
    }
  }, [ev])

  if (!ev) return null

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      if (ev.source === 'admin') {
        const payload = {
          title: form.title || null,
          description: form.description || null,
          start_date: form.start_date,
          end_date: form.end_date || form.start_date,
          start_time: form.all_day ? null : form.start_time || null,
          end_time: form.all_day ? null : form.end_time || null,
          all_day: !!form.all_day,
          color: form.color || '#22d3ee',
        }
        const { error } = await client.from('admin_calendar_events').update(payload).eq('id', ev.raw.id)
        if (error) throw error
      } else {
        const payload = {
          title: form.title || null,
          notes: form.notes || null,
          address: form.address || null,
          event_type: form.event_type || 'meeting',
          color: form.color || '#f59e0b',
          all_day: !!form.all_day,
          start_time: form.start_time ? new Date(form.start_time).toISOString() : ev.raw.start_time,
          end_time: form.end_time ? new Date(form.end_time).toISOString() : ev.raw.end_time,
          work_order_id: form.work_order_id || null,
          status: form.status || 'scheduled',
        }
        const { error } = await client.from('ops_schedule').update(payload).eq('id', ev.raw.id)
        if (error) throw error
      }
      onChanged()
    } catch (e) {
      console.error('[EventDrawer] save', e)
      alert('Could not save: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!client) return
    if (!confirm('Delete this event?')) return
    setSaving(true)
    try {
      if (ev.source === 'admin') {
        const { error } = await client.from('admin_calendar_events').delete().eq('id', ev.raw.id)
        if (error) throw error
      } else {
        const { error } = await client.from('ops_schedule').update({ status: 'cancelled' }).eq('id', ev.raw.id)
        if (error) throw error
      }
      onChanged()
    } catch (e) {
      console.error('[EventDrawer] remove', e)
      alert('Could not delete: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={!!ev}
      onClose={onClose}
      title={ev.title || 'Event'}
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
      <div className="flex items-center gap-2 mb-4">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ev.color }} />
        <SourceBadge source={ev.source} />
        {ev.event_type && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-navy-700/60 text-gray-300">{ev.event_type}</span>}
      </div>

      <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />

      <label className="flex items-center gap-2 mb-3 text-sm text-gray-300">
        <input type="checkbox" checked={!!form.all_day} onChange={(e) => setForm({ ...form, all_day: e.target.checked })} />
        All day
      </label>

      {ev.source === 'admin' ? (
        <>
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
            <Input label="End Date" type="date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
            {!form.all_day && (
              <>
                <Input label="Start Time" type="time" value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
                <Input label="End Time" type="time" value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
              </>
            )}
          </div>
          <Input label="Description" rows={3} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-3">
            <Input label="Start" type="datetime-local" value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
            <Input label="End" type="datetime-local" value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
          </div>
          <Select
            label="Event Type"
            value={form.event_type}
            onChange={(v) => setForm({ ...form, event_type: v })}
            options={OPS_EVENT_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <Input label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Input label="Notes" rows={3} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <DetailRow label="Status" value={form.status} />
          {form.work_order_id && (
            <button
              onClick={() => onOpenWorkOrder(form.work_order_id)}
              className="mt-3 w-full text-sm bg-navy-900/60 border border-navy-700/60 hover:border-brand-cyan/60 text-brand-cyan rounded-lg px-3 py-2"
            >
              Open Job
            </button>
          )}
        </>
      )}

      <div className="mt-3">
        <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Color</span>
        <div className="flex gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.key}
              onClick={() => setForm({ ...form, color: c.value })}
              className={`w-7 h-7 rounded-full border-2 ${form.color === c.value ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>
    </Drawer>
  )
}
