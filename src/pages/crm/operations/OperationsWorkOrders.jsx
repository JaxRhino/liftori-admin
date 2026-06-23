import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'
import {
  computeMetrics, normalizeMeasurements,
  diagramSvg, diagramPng, buildPdf, pdfFilename,
  lineColor, ensureTurf, ensurePdf,
} from './roofReport'

// ---------- formatters ----------
const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'

// ---------- constants ----------
const WO_STATUSES = [
  { key: 'pending',     label: 'Pending',     tone: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { key: 'scheduled',   label: 'Scheduled',   tone: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  { key: 'in_progress', label: 'In Progress', tone: 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40' },
  { key: 'on_hold',     label: 'On Hold',     tone: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { key: 'completed',   label: 'Completed',   tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { key: 'cancelled',   label: 'Cancelled',   tone: 'bg-red-500/20 text-red-300 border-red-500/40' },
]

const PRIORITY_TONES = {
  low:    'bg-navy-700/60 text-gray-300',
  normal: 'bg-sky-500/20 text-sky-300',
  high:   'bg-amber-500/20 text-amber-300',
  urgent: 'bg-red-500/20 text-red-300',
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

function StatusBadge({ status }) {
  const s = WO_STATUSES.find(x => x.key === status)
  const tone = s?.tone || 'bg-navy-700/60 text-gray-300 border-navy-700/60'
  return <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${tone}`}>{s?.label || status}</span>
}

function PriorityBadge({ priority }) {
  if (!priority) return null
  const tone = PRIORITY_TONES[priority] || PRIORITY_TONES.normal
  return <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${tone}`}>{priority}</span>
}

// ---------- helpers ----------
function shortId() {
  return Math.random().toString(36).slice(2, 7).toUpperCase()
}
function genWoNumber() {
  const d = new Date()
  const ymd = d.toISOString().slice(0, 10)
  return `WO-${ymd}-${shortId()}`
}
function startOfWeek(d) {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfWeek(d) {
  const x = startOfWeek(d)
  x.setDate(x.getDate() + 7)
  return x
}
function isToday(d) {
  if (!d) return false
  const x = new Date(d)
  const now = new Date()
  return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth() && x.getDate() === now.getDate()
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function OperationsWorkOrders() {
  const { client } = useCrmClient()

  const [workOrders, setWorkOrders] = useState([])
  const [contacts, setContacts] = useState([])
  const [crews, setCrews] = useState([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState('kanban') // kanban | table | map
  const [filter, setFilter] = useState('all') // all | high | urgent | mine | unassigned
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('scheduled_start')
  const [sortDir, setSortDir] = useState('desc')

  const [newOpen, setNewOpen] = useState(false)
  const [openWo, setOpenWo] = useState(null)

  // ---- load ----
  async function loadAll() {
    if (!client) return
    setLoading(true)
    try {
      const [woRes, ctRes, crRes] = await Promise.all([
        client.from('ops_work_orders').select('*').order('created_at', { ascending: false }).limit(500),
        client.from('customer_contacts').select('id,first_name,last_name,email,phone').limit(500),
        client.from('ops_crews').select('id,name,color,status').limit(100),
      ])
      setWorkOrders(woRes.data || [])
      setContacts(ctRes.data || [])
      setCrews(crRes.data || [])
    } catch (e) {
      console.error('[OperationsWorkOrders] load', e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadAll() }, [client])

  const contactById = useMemo(() => {
    const m = {}
    contacts.forEach(c => { m[c.id] = c })
    return m
  }, [contacts])
  const crewById = useMemo(() => {
    const m = {}
    crews.forEach(c => { m[c.id] = c })
    return m
  }, [crews])

  function contactName(id) {
    const c = contactById[id]
    if (!c) return '-'
    return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '-'
  }

  // ---- stats ----
  const stats = useMemo(() => {
    const open = workOrders.filter(w => !['completed', 'cancelled'].includes(w.status)).length
    const scheduledToday = workOrders.filter(w => isToday(w.scheduled_start)).length
    const inProg = workOrders.filter(w => w.status === 'in_progress').length
    const wkStart = startOfWeek(new Date()).getTime()
    const completedWeek = workOrders.filter(w => w.status === 'completed' && w.actual_end && new Date(w.actual_end).getTime() >= wkStart)
    const completedRevenue = completedWeek.reduce((s, w) => s + Number(w.actual_cost || 0), 0)
    return { open, scheduledToday, inProg, completedWeekCount: completedWeek.length, completedRevenue }
  }, [workOrders])

  // ---- filter + search ----
  const filtered = useMemo(() => {
    let list = workOrders
    if (filter === 'high') list = list.filter(w => w.priority === 'high')
    else if (filter === 'urgent') list = list.filter(w => w.priority === 'urgent')
    else if (filter === 'unassigned') list = list.filter(w => !w.assigned_crew_id && (!w.assigned_to || w.assigned_to.length === 0))
    // 'mine' currently no current-user context; treat as no-op visual filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(w =>
        (w.title || '').toLowerCase().includes(q) ||
        (w.work_order_number || '').toLowerCase().includes(q) ||
        (w.address || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [workOrders, filter, search])

  // ---- by-status grouping for kanban ----
  const byStatus = useMemo(() => {
    const m = {}
    WO_STATUSES.forEach(s => { m[s.key] = [] })
    filtered.forEach(w => {
      if (m[w.status]) m[w.status].push(w)
      else (m.pending = m.pending || []).push(w)
    })
    return m
  }, [filtered])

  // ---- sorted for table ----
  const sortedTable = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [filtered, sortKey, sortDir])

  function toggleSort(k) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  return (
    <HubPage
      title="Jobs"
      subtitle="Schedule, dispatch, and complete every job"
      actions={
        <button
          onClick={() => setNewOpen(true)}
          className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + New Job
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open Jobs" value={stats.open} accent="text-brand-cyan" />
        <StatCard label="Scheduled Today" value={stats.scheduledToday} accent="text-sky-300" />
        <StatCard label="In Progress" value={stats.inProg} accent="text-amber-300" />
        <StatCard label="Completed This Week" value={`${stats.completedWeekCount} / ${fmtMoney(stats.completedRevenue)}`} accent="text-emerald-400" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="flex gap-1 bg-navy-800 border border-navy-700/50 rounded-lg p-1">
          <TabBtn active={view === 'kanban'} onClick={() => setView('kanban')}>Kanban</TabBtn>
          <TabBtn active={view === 'table'} onClick={() => setView('table')}>Table</TabBtn>
          <TabBtn active={view === 'map'} onClick={() => setView('map')}>Map</TabBtn>
        </div>
        <div className="flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, WO#, or address..."
            className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
        <Chip active={filter === 'high'} onClick={() => setFilter('high')}>High Priority</Chip>
        <Chip active={filter === 'urgent'} onClick={() => setFilter('urgent')}>Urgent</Chip>
        <Chip active={filter === 'mine'} onClick={() => setFilter('mine')}>Assigned to me</Chip>
        <Chip active={filter === 'unassigned'} onClick={() => setFilter('unassigned')}>Unassigned</Chip>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading jobs...</div>
      ) : workOrders.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Create the first job, schedule a crew, and watch it move through the pipeline."
          cta={
            <button onClick={() => setNewOpen(true)} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm font-medium px-4 py-2 rounded-lg">
              + New Job
            </button>
          }
        />
      ) : view === 'kanban' ? (
        <KanbanView byStatus={byStatus} onCardClick={setOpenWo} contactName={contactName} crewById={crewById} />
      ) : view === 'table' ? (
        <TableView list={sortedTable} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} onRowClick={setOpenWo} contactName={contactName} crewById={crewById} />
      ) : (
        <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-14 text-center">
          <h3 className="text-white font-semibold mb-1">Map view coming Wave F</h3>
          <p className="text-gray-400 text-sm">Job locations will plot on an interactive map with crew tracking. Switch to Kanban or Table for now.</p>
        </div>
      )}

      {/* New WO modal */}
      <NewWorkOrderModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        client={client}
        contacts={contacts}
        crews={crews}
        onSaved={() => { setNewOpen(false); loadAll() }}
      />

      {/* Detail drawer */}
      <WorkOrderDrawer
        wo={openWo}
        client={client}
        contacts={contacts}
        crews={crews}
        contactName={contactName}
        crewById={crewById}
        onClose={() => setOpenWo(null)}
        onSaved={() => { loadAll() }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                              KANBAN VIEW
// ===========================================================================
function KanbanView({ byStatus, onCardClick, contactName, crewById }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
      {WO_STATUSES.map(s => (
        <div key={s.key} className="bg-navy-900/60 border border-navy-700/50 rounded-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-navy-700/50 flex items-center justify-between">
            <StatusBadge status={s.key} />
            <span className="text-xs text-gray-500">{byStatus[s.key]?.length || 0}</span>
          </div>
          <div className="p-2 space-y-2 max-h-[640px] overflow-y-auto">
            {(byStatus[s.key] || []).map(w => (
              <KanbanCard key={w.id} wo={w} onClick={() => onCardClick(w)} contactName={contactName} crewById={crewById} />
            ))}
            {(byStatus[s.key] || []).length === 0 && (
              <div className="text-xs text-gray-600 text-center py-6">No jobs</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function KanbanCard({ wo, onClick, contactName, crewById }) {
  const photoCount =
    (Array.isArray(wo.photos) ? wo.photos.length : 0) +
    (Array.isArray(wo.before_photos) ? wo.before_photos.length : 0) +
    (Array.isArray(wo.after_photos) ? wo.after_photos.length : 0)
  const crew = crewById[wo.assigned_crew_id]
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-navy-800 border border-navy-700/50 hover:border-brand-cyan/50 rounded-lg p-3 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-sm text-white font-medium line-clamp-2 flex-1">{wo.title || '(untitled)'}</div>
        <PriorityBadge priority={wo.priority} />
      </div>
      <div className="text-[11px] text-gray-500 mb-2">{wo.work_order_number}</div>
      <div className="text-xs text-gray-400 mb-1">{contactName(wo.contact_id)}</div>
      {wo.scheduled_start && (
        <div className="text-[11px] text-sky-300 mb-1">{fmtDateTime(wo.scheduled_start)}</div>
      )}
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>{fmtMoney(wo.estimated_cost)}</span>
        <span className="flex items-center gap-2">
          {crew && (
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: crew.color || '#60a5fa' }}
              title={crew.name}
            />
          )}
          {photoCount > 0 && <span>{photoCount} photo{photoCount === 1 ? '' : 's'}</span>}
        </span>
      </div>
    </button>
  )
}

// ===========================================================================
//                               TABLE VIEW
// ===========================================================================
function TableView({ list, sortKey, sortDir, onSort, onRowClick, contactName, crewById }) {
  const arrow = (k) => sortKey === k ? (sortDir === 'asc' ? ' ^' : ' v') : ''
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-900/60 border-b border-navy-700/50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
              <th onClick={() => onSort('work_order_number')} className="px-4 py-2.5 cursor-pointer hover:text-white">WO#{arrow('work_order_number')}</th>
              <th onClick={() => onSort('title')} className="px-4 py-2.5 cursor-pointer hover:text-white">Title{arrow('title')}</th>
              <th className="px-4 py-2.5">Contact</th>
              <th onClick={() => onSort('status')} className="px-4 py-2.5 cursor-pointer hover:text-white">Status{arrow('status')}</th>
              <th onClick={() => onSort('priority')} className="px-4 py-2.5 cursor-pointer hover:text-white">Priority{arrow('priority')}</th>
              <th onClick={() => onSort('scheduled_start')} className="px-4 py-2.5 cursor-pointer hover:text-white">Scheduled{arrow('scheduled_start')}</th>
              <th className="px-4 py-2.5">Crew</th>
              <th onClick={() => onSort('estimated_cost')} className="px-4 py-2.5 cursor-pointer hover:text-white text-right">Est. Cost{arrow('estimated_cost')}</th>
              <th onClick={() => onSort('actual_cost')} className="px-4 py-2.5 cursor-pointer hover:text-white text-right">Actual{arrow('actual_cost')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {list.map(w => {
              const crew = crewById[w.assigned_crew_id]
              return (
                <tr key={w.id} onClick={() => onRowClick(w)} className="hover:bg-navy-900/40 cursor-pointer">
                  <td className="px-4 py-2.5 text-xs text-gray-400">{w.work_order_number || '-'}</td>
                  <td className="px-4 py-2.5 text-white">{w.title || '(untitled)'}</td>
                  <td className="px-4 py-2.5 text-gray-300">{contactName(w.contact_id)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={w.status} /></td>
                  <td className="px-4 py-2.5"><PriorityBadge priority={w.priority} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-300">{fmtDateTime(w.scheduled_start)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-300">
                    {crew ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: crew.color || '#60a5fa' }} />
                        {crew.name}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">{fmtMoney(w.estimated_cost)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-300">{fmtMoney(w.actual_cost)}</td>
                </tr>
              )
            })}
            {list.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">No jobs match filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===========================================================================
//                            NEW WO MODAL
// ===========================================================================
function NewWorkOrderModal({ open, onClose, client, contacts, crews, onSaved }) {
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function blankForm() {
    return {
      title: '', description: '', work_order_number: '',
      contact_id: '', category: '', priority: 'normal',
      address: '', city: '', state: '', zip: '',
      scheduled_start: '', estimated_duration_hours: '',
      estimated_cost: '', assigned_crew_id: '', notes: '',
    }
  }
  function reset() { setForm(blankForm()); setErr('') }

  async function save() {
    if (!form.title.trim()) { setErr('Title is required.'); return }
    setSaving(true)
    setErr('')
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        work_order_number: form.work_order_number?.trim() || genWoNumber(),
        status: 'pending',
        priority: form.priority || 'normal',
        category: form.category || null,
        contact_id: form.contact_id || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        scheduled_start: form.scheduled_start || null,
        estimated_duration_hours: form.estimated_duration_hours ? Number(form.estimated_duration_hours) : null,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
        assigned_crew_id: form.assigned_crew_id || null,
        notes: form.notes || null,
      }
      const { error } = await client.from('ops_work_orders').insert(payload)
      if (error) throw error
      reset()
      onSaved()
    } catch (e) {
      console.error('[NewWorkOrder] save', e)
      setErr(e.message || 'Failed to create job')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="New Job"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={() => { reset(); onClose() }} className="text-gray-400 hover:text-white text-sm px-4 py-2">Cancel</button>
          <button onClick={save} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {saving ? 'Saving...' : 'Create Job'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="Title *" value={form.title} onChange={(v) => setForm(f => ({ ...f, title: v }))} placeholder="e.g. AC condenser replacement" />
        <Input label="Job # (optional)" value={form.work_order_number} onChange={(v) => setForm(f => ({ ...f, work_order_number: v }))} placeholder="auto-generated if blank" />
        <Select
          label="Contact"
          value={form.contact_id}
          onChange={(v) => setForm(f => ({ ...f, contact_id: v }))}
          options={contacts.map(c => ({ value: c.id, label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id }))}
        />
        <Input label="Category" value={form.category} onChange={(v) => setForm(f => ({ ...f, category: v }))} placeholder="HVAC, plumbing, etc." />
        <Select
          label="Priority"
          value={form.priority}
          onChange={(v) => setForm(f => ({ ...f, priority: v }))}
          options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
        />
        <Select
          label="Assigned Crew"
          value={form.assigned_crew_id}
          onChange={(v) => setForm(f => ({ ...f, assigned_crew_id: v }))}
          options={crews.map(c => ({ value: c.id, label: c.name }))}
        />
        <Input label="Address" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} />
        <Input label="City" value={form.city} onChange={(v) => setForm(f => ({ ...f, city: v }))} />
        <Input label="State" value={form.state} onChange={(v) => setForm(f => ({ ...f, state: v }))} />
        <Input label="ZIP" value={form.zip} onChange={(v) => setForm(f => ({ ...f, zip: v }))} />
        <Input label="Scheduled Start" type="datetime-local" value={form.scheduled_start} onChange={(v) => setForm(f => ({ ...f, scheduled_start: v }))} />
        <Input label="Est. Duration (hours)" type="number" value={form.estimated_duration_hours} onChange={(v) => setForm(f => ({ ...f, estimated_duration_hours: v }))} />
        <Input label="Estimated Cost ($)" type="number" value={form.estimated_cost} onChange={(v) => setForm(f => ({ ...f, estimated_cost: v }))} />
      </div>
      <Input label="Description" value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} rows={3} />
      <Input label="Notes" value={form.notes} onChange={(v) => setForm(f => ({ ...f, notes: v }))} rows={2} />
      {err && <div className="text-xs text-red-400 mt-2">{err}</div>}
    </Modal>
  )
}

// ===========================================================================
//                            DETAIL DRAWER
// ===========================================================================
function WorkOrderDrawer({ wo, client, contacts, crews, contactName, crewById, onClose, onSaved }) {
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (wo) {
      setDraft({ ...wo })
      setEditing(false)
      setTab('overview')
      setErr('')
    }
  }, [wo?.id])

  if (!wo || !draft) return null

  const crew = crewById[wo.assigned_crew_id]

  async function saveOverview() {
    setSaving(true); setErr('')
    try {
      const payload = {
        title: draft.title,
        description: draft.description,
        status: draft.status,
        priority: draft.priority,
        category: draft.category,
        address: draft.address, city: draft.city, state: draft.state, zip: draft.zip,
        scheduled_start: draft.scheduled_start || null,
        scheduled_end: draft.scheduled_end || null,
        actual_start: draft.actual_start || null,
        actual_end: draft.actual_end || null,
        estimated_duration_hours: draft.estimated_duration_hours ? Number(draft.estimated_duration_hours) : null,
        estimated_cost: draft.estimated_cost ? Number(draft.estimated_cost) : null,
        actual_cost: draft.actual_cost ? Number(draft.actual_cost) : null,
        labor_cost: draft.labor_cost ? Number(draft.labor_cost) : null,
        materials_cost: draft.materials_cost ? Number(draft.materials_cost) : null,
        assigned_crew_id: draft.assigned_crew_id || null,
      }
      const { error } = await client.from('ops_work_orders').update(payload).eq('id', wo.id)
      if (error) throw error
      setEditing(false)
      onSaved()
    } catch (e) {
      console.error('[WorkOrderDrawer] save', e)
      setErr(e.message || 'Save failed')
    } finally { setSaving(false) }
  }

  async function saveNotes() {
    setSaving(true); setErr('')
    try {
      const { error } = await client.from('ops_work_orders').update({
        customer_notes: draft.customer_notes || null,
        internal_notes: draft.internal_notes || null,
        completion_notes: draft.completion_notes || null,
      }).eq('id', wo.id)
      if (error) throw error
      onSaved()
    } catch (e) { setErr(e.message || 'Save failed') } finally { setSaving(false) }
  }

  async function saveChecklist() {
    setSaving(true); setErr('')
    try {
      const { error } = await client.from('ops_work_orders').update({ checklist: draft.checklist || [] }).eq('id', wo.id)
      if (error) throw error
      onSaved()
    } catch (e) { setErr(e.message || 'Save failed') } finally { setSaving(false) }
  }

  async function quickStatus(next) {
    setSaving(true); setErr('')
    try {
      const patch = { status: next }
      if (next === 'in_progress' && !wo.actual_start) patch.actual_start = new Date().toISOString()
      if (next === 'completed' && !wo.actual_end) patch.actual_end = new Date().toISOString()
      const { error } = await client.from('ops_work_orders').update(patch).eq('id', wo.id)
      if (error) throw error
      setDraft(d => ({ ...d, ...patch }))
      onSaved()
    } catch (e) { setErr(e.message || 'Save failed') } finally { setSaving(false) }
  }

  return (
    <Drawer
      open={!!wo}
      onClose={onClose}
      title={
        <div>
          <div className="text-xs text-gray-500 mb-0.5">{wo.work_order_number}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-white font-semibold truncate max-w-[300px]">{wo.title}</h2>
            <StatusBadge status={draft.status} />
            <PriorityBadge priority={draft.priority} />
          </div>
        </div>
      }
      footer={
        tab === 'overview' && editing ? (
          <div className="flex justify-end gap-2">
            <button onClick={() => { setDraft({ ...wo }); setEditing(false) }} className="text-gray-400 hover:text-white text-sm px-4 py-2">Cancel</button>
            <button onClick={saveOverview} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        ) : null
      }
    >
      {/* In-drawer tabs */}
      <div className="flex gap-1 mb-4 border-b border-navy-700/50">
        {[
          { k: 'overview', label: 'Overview' },
          { k: 'photos', label: 'Photos' },
          { k: 'notes', label: 'Notes' },
          { k: 'checklist', label: 'Checklist' },
          { k: 'roof', label: 'Roof Report' },
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-3 py-2 text-sm border-b-2 transition ${tab === t.k ? 'border-brand-cyan text-brand-cyan' : 'border-transparent text-gray-400 hover:text-white'}`}
          >{t.label}</button>
        ))}
      </div>

      {err && <div className="text-xs text-red-400 mb-3">{err}</div>}

      {tab === 'overview' && (
        <OverviewTab
          wo={wo}
          draft={draft}
          setDraft={setDraft}
          editing={editing}
          setEditing={setEditing}
          crews={crews}
          contactName={contactName}
          crew={crew}
          quickStatus={quickStatus}
        />
      )}

      {tab === 'photos' && <PhotosTab wo={wo} />}

      {tab === 'notes' && (
        <NotesTab draft={draft} setDraft={setDraft} onSave={saveNotes} saving={saving} />
      )}

      {tab === 'checklist' && (
        <ChecklistTab draft={draft} setDraft={setDraft} onSave={saveChecklist} saving={saving} />
      )}

      {tab === 'roof' && <RoofReportTab wo={wo} client={client} />}
    </Drawer>
  )
}

// Roof reports tied to this job (project_id and/or contact_id). Renders the
// full RoofR-style takeoff: squares, pitched/flat split, area-by-pitch,
// linear feet by type + drip edge, schematic, and a branded PDF download.
// Reads ops_measurements (template_type='aerial_roof'); deep-links into the
// Roof Measure tool to reopen. Backward-compatible with legacy array-shaped
// measurements (see normalizeMeasurements).
function RoofReportTab({ wo, client }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [pdfBusyId, setPdfBusyId] = useState(null)
  const [pdfErr, setPdfErr] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!wo || !client) return
    ;(async () => {
      setLoading(true)
      try {
        const ors = []
        if (wo.project_id) ors.push(`project_id.eq.${wo.project_id}`)
        if (wo.contact_id) ors.push(`contact_id.eq.${wo.contact_id}`)
        let q = client
          .from('ops_measurements')
          .select('id, title, address, summary, measurements, created_at, contact_id, project_id')
          .eq('template_type', 'aerial_roof')
          .order('created_at', { ascending: false })
        if (ors.length) q = q.or(ors.join(','))
        else { if (!cancelled) { setReports([]); setLoading(false) }; return }
        const { data } = await q
        if (!cancelled) setReports(data || [])
      } catch (e) {
        if (!cancelled) setReports([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [wo?.id, wo?.project_id, wo?.contact_id, client])

  const platformId = (typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : '') || ''
  const measureHref = platformId ? `/crm/${platformId}/measure` : '#'

  // Resolve a report's full metrics: prefer saved summary (if it carries linear),
  // else recompute from geometry. Returns { metrics, norm }.
  async function resolveMetrics(r) {
    const norm = normalizeMeasurements(r.measurements)
    const sm = r.summary || {}
    if (sm.linear) return { metrics: sm, norm }
    const turf = await ensureTurf()
    const metrics = computeMetrics(turf, norm.facets, norm.lines, { waste_pct: sm.waste_pct != null ? sm.waste_pct : 10 })
    return { metrics, norm }
  }

  async function downloadPdf(r) {
    setPdfBusyId(r.id); setPdfErr('')
    try {
      const jsPDF = await ensurePdf()
      const { metrics, norm } = await resolveMetrics(r)
      const png = diagramPng(norm.facets, norm.lines, metrics, { w: 640, h: 440 })
      const companyName = 'Roof Report'
      const rowObj = { title: r.title || 'Aerial roof measurement', address: r.address || '', created_at: r.created_at, id: r.id }
      const doc = buildPdf(jsPDF, { row: rowObj, metrics, pngDataUrl: png, companyName })
      doc.save(pdfFilename(rowObj))
    } catch (e) {
      setPdfErr(e.message || 'PDF export failed')
    } finally {
      setPdfBusyId(null)
    }
  }

  if (loading) {
    return <div className="text-xs text-gray-500 py-6 text-center">Loading roof reports...</div>
  }
  if (!wo.project_id && !wo.contact_id) {
    return <div className="text-xs text-gray-600 bg-navy-900/40 border border-dashed border-navy-700/60 rounded-lg p-4 text-center">Link a contact or project to this job to surface roof reports.</div>
  }
  if (reports.length === 0) {
    return (
      <div className="text-xs text-gray-600 bg-navy-900/40 border border-dashed border-navy-700/60 rounded-lg p-4 text-center">
        No aerial roof reports for this job yet.
        <div className="mt-2"><a href={measureHref} className="text-brand-cyan hover:text-brand-cyan/80">Open Roof Measure</a></div>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {pdfErr && <div className="text-xs text-red-400">{pdfErr}</div>}
      {reports.map((r) => <RoofReportCard key={r.id} r={r} measureHref={measureHref} onPdf={downloadPdf} pdfBusy={pdfBusyId === r.id} />)}
    </div>
  )
}

// One saved report rendered with full metrics + schematic. Recomputes linear /
// area-by-pitch from geometry when an older row lacks them in summary.
function RoofReportCard({ r, measureHref, onPdf, pdfBusy }) {
  const sm = r.summary || {}
  const norm = useMemo(() => normalizeMeasurements(r.measurements), [r])
  const [metrics, setMetrics] = useState(sm.linear ? sm : null)
  const [svg, setSvg] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let m = sm.linear ? sm : null
      if (!m) {
        try {
          const turf = await ensureTurf()
          m = computeMetrics(turf, norm.facets, norm.lines, { waste_pct: sm.waste_pct != null ? sm.waste_pct : 10 })
        } catch { m = null }
      }
      if (cancelled) return
      setMetrics(m)
      try {
        const facetObjs = (norm.facets || []).map((f) => ({ coords: f.coords, pitch: f.pitch }))
        const lineObjs = (norm.lines || []).map((l) => ({ type: l.type, coords: l.coords }))
        setSvg(diagramSvg(facetObjs, lineObjs, m, { w: 360, h: 220 }))
      } catch { setSvg(null) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id])

  const lin = (metrics && metrics.linear) || {}
  const areas = (metrics && metrics.areas) || {}
  const squares = metrics ? metrics.squares : (sm.squares ?? '-')

  return (
    <div className="bg-navy-900/40 border border-navy-700/50 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm text-white font-medium truncate">{r.title || 'Aerial roof measurement'}</span>
        <span className="text-xs text-emerald-400 shrink-0">{typeof squares === 'number' ? squares.toFixed(1) : squares} sq</span>
      </div>
      <div className="text-xs text-gray-500 truncate mb-2">{r.address || 'No address'} - {fmtDate(r.created_at)}</div>

      {svg && (
        <div className="rounded-md overflow-hidden mb-2 bg-navy-950/60" dangerouslySetInnerHTML={{ __html: svg }} />
      )}

      <div className="grid grid-cols-3 gap-2 text-center mb-2">
        <div className="bg-navy-800/60 rounded-md py-1.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Sloped</div>
          <div className="text-sm text-gray-200">{(metrics ? metrics.sloped_ft2 : (sm.sloped_ft2 ?? 0)).toLocaleString()} ft2</div>
        </div>
        <div className="bg-navy-800/60 rounded-md py-1.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Plan</div>
          <div className="text-sm text-gray-200">{(metrics ? metrics.plan_ft2 : (sm.plan_ft2 ?? 0)).toLocaleString()} ft2</div>
        </div>
        <div className="bg-navy-800/60 rounded-md py-1.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Waste</div>
          <div className="text-sm text-gray-200">{(metrics ? metrics.waste_pct : (sm.waste_pct ?? 0))}%</div>
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-2 text-center mb-2">
          <div className="bg-navy-800/60 rounded-md py-1.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Pitched</div>
            <div className="text-sm text-gray-200">{(areas.pitched_ft2 || 0).toLocaleString()} ft2</div>
          </div>
          <div className="bg-navy-800/60 rounded-md py-1.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Flat / low</div>
            <div className="text-sm text-gray-200">{(areas.flat_ft2 || 0).toLocaleString()} ft2</div>
          </div>
        </div>
      )}

      {metrics && (
        <div className="bg-navy-800/40 rounded-md p-2 mb-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Linear feet</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {[
              ['ridge', 'Ridge', lin.ridge_ft],
              ['hip', 'Hip', lin.hip_ft],
              ['valley', 'Valley', lin.valley_ft],
              ['eave', 'Eave', lin.eave_ft],
              ['rake', 'Rake', lin.rake_ft],
              ['flashing', 'Flashing', lin.flashing_ft],
            ].map(([k, label, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-gray-400">
                  <span className="inline-block w-2.5 h-1 rounded-full" style={{ backgroundColor: lineColor(k) }} />
                  {label}
                </span>
                <span className="text-gray-200">{(v || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs border-t border-navy-700/50 mt-1.5 pt-1.5">
            <span className="text-gray-400">Drip edge</span>
            <span className="text-white font-semibold">{(lin.drip_edge_ft || 0).toLocaleString()} LF</span>
          </div>
          {metrics.predominant_pitch ? (
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-400">Predominant pitch</span>
              <span className="text-gray-200">{metrics.predominant_pitch}</span>
            </div>
          ) : null}
        </div>
      )}

      {metrics && Object.keys(metrics.area_by_pitch || {}).length > 0 && (
        <div className="bg-navy-800/40 rounded-md p-2 mb-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Area by pitch</div>
          <div className="space-y-1 text-xs">
            {Object.keys(metrics.area_by_pitch).sort().map((k) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-gray-400">{k}</span>
                <span className="text-gray-200">{Number(metrics.area_by_pitch[k]).toLocaleString()} ft2</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <a href={measureHref} className="text-xs text-brand-cyan hover:text-brand-cyan/80">Open in Roof Measure</a>
        <button
          onClick={() => onPdf(r)}
          disabled={pdfBusy}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:text-brand-light disabled:opacity-50"
        >
          {pdfBusy ? 'Building...' : 'Download report (PDF)'}
        </button>
      </div>
    </div>
  )
}

function OverviewTab({ wo, draft, setDraft, editing, setEditing, crews, contactName, crew, quickStatus }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wider">Details</span>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-brand-cyan hover:text-brand-cyan/80">Edit</button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-3 text-sm">
          <Row label="Contact" value={contactName(wo.contact_id)} />
          <Row label="Category" value={wo.category || '-'} />
          <Row label="Address" value={[wo.address, wo.city, wo.state, wo.zip].filter(Boolean).join(', ') || '-'} />
          <Row label="Crew" value={crew?.name || '-'} />
          <Row label="Scheduled Start" value={fmtDateTime(wo.scheduled_start)} />
          <Row label="Scheduled End" value={fmtDateTime(wo.scheduled_end)} />
          <Row label="Actual Start" value={fmtDateTime(wo.actual_start)} />
          <Row label="Actual End" value={fmtDateTime(wo.actual_end)} />
          <Row label="Est. Duration" value={wo.estimated_duration_hours ? `${wo.estimated_duration_hours}h` : '-'} />
          <Row label="Estimated Cost" value={fmtMoney(wo.estimated_cost)} />
          <Row label="Actual Cost" value={fmtMoney(wo.actual_cost)} />
          <Row label="Labor Cost" value={fmtMoney(wo.labor_cost)} />
          <Row label="Materials Cost" value={fmtMoney(wo.materials_cost)} />
          {wo.description && <Row label="Description" value={wo.description} multiline />}

          <div className="pt-3 mt-3 border-t border-navy-700/50">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quick Status</div>
            <div className="flex flex-wrap gap-2">
              {WO_STATUSES.map(s => (
                <button
                  key={s.key}
                  onClick={() => quickStatus(s.key)}
                  disabled={draft.status === s.key}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition ${draft.status === s.key ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan cursor-default' : 'bg-navy-900/40 border-navy-700/60 text-gray-400 hover:text-white'}`}
                >{s.label}</button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <Input label="Title" value={draft.title} onChange={(v) => setDraft(d => ({ ...d, title: v }))} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <Select label="Status" value={draft.status} onChange={(v) => setDraft(d => ({ ...d, status: v }))} options={WO_STATUSES.map(s => ({ value: s.key, label: s.label }))} />
            <Select label="Priority" value={draft.priority} onChange={(v) => setDraft(d => ({ ...d, priority: v }))} options={[{value:'low',label:'Low'},{value:'normal',label:'Normal'},{value:'high',label:'High'},{value:'urgent',label:'Urgent'}]} />
            <Input label="Category" value={draft.category} onChange={(v) => setDraft(d => ({ ...d, category: v }))} />
            <Select label="Crew" value={draft.assigned_crew_id} onChange={(v) => setDraft(d => ({ ...d, assigned_crew_id: v }))} options={crews.map(c => ({ value: c.id, label: c.name }))} />
            <Input label="Address" value={draft.address} onChange={(v) => setDraft(d => ({ ...d, address: v }))} />
            <Input label="City" value={draft.city} onChange={(v) => setDraft(d => ({ ...d, city: v }))} />
            <Input label="State" value={draft.state} onChange={(v) => setDraft(d => ({ ...d, state: v }))} />
            <Input label="ZIP" value={draft.zip} onChange={(v) => setDraft(d => ({ ...d, zip: v }))} />
            <Input label="Scheduled Start" type="datetime-local" value={draft.scheduled_start ? String(draft.scheduled_start).slice(0,16) : ''} onChange={(v) => setDraft(d => ({ ...d, scheduled_start: v }))} />
            <Input label="Scheduled End" type="datetime-local" value={draft.scheduled_end ? String(draft.scheduled_end).slice(0,16) : ''} onChange={(v) => setDraft(d => ({ ...d, scheduled_end: v }))} />
            <Input label="Actual Start" type="datetime-local" value={draft.actual_start ? String(draft.actual_start).slice(0,16) : ''} onChange={(v) => setDraft(d => ({ ...d, actual_start: v }))} />
            <Input label="Actual End" type="datetime-local" value={draft.actual_end ? String(draft.actual_end).slice(0,16) : ''} onChange={(v) => setDraft(d => ({ ...d, actual_end: v }))} />
            <Input label="Est. Duration (h)" type="number" value={draft.estimated_duration_hours} onChange={(v) => setDraft(d => ({ ...d, estimated_duration_hours: v }))} />
            <Input label="Estimated Cost ($)" type="number" value={draft.estimated_cost} onChange={(v) => setDraft(d => ({ ...d, estimated_cost: v }))} />
            <Input label="Actual Cost ($)" type="number" value={draft.actual_cost} onChange={(v) => setDraft(d => ({ ...d, actual_cost: v }))} />
            <Input label="Labor Cost ($)" type="number" value={draft.labor_cost} onChange={(v) => setDraft(d => ({ ...d, labor_cost: v }))} />
            <Input label="Materials Cost ($)" type="number" value={draft.materials_cost} onChange={(v) => setDraft(d => ({ ...d, materials_cost: v }))} />
          </div>
          <Input label="Description" value={draft.description} onChange={(v) => setDraft(d => ({ ...d, description: v }))} rows={3} />
        </div>
      )}
    </div>
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

function PhotosTab({ wo }) {
  const before = Array.isArray(wo.before_photos) ? wo.before_photos : []
  const during = Array.isArray(wo.photos) ? wo.photos : []
  const after = Array.isArray(wo.after_photos) ? wo.after_photos : []
  return (
    <div>
      <PhotoSection title="Before" photos={before} />
      <PhotoSection title="On Site" photos={during} />
      <PhotoSection title="After" photos={after} />
      <button disabled className="w-full mt-3 bg-navy-900/40 border border-dashed border-navy-700/60 text-gray-500 text-sm px-4 py-3 rounded-lg cursor-not-allowed">
        Upload Photo (Wave F)
      </button>
    </div>
  )
}

function PhotoSection({ title, photos }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{title}</div>
      {photos.length === 0 ? (
        <div className="text-xs text-gray-600 bg-navy-900/40 border border-dashed border-navy-700/60 rounded-lg p-4 text-center">No photos</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => {
            const url = typeof p === 'string' ? p : p?.url
            return (
              <div key={i} className="aspect-square bg-navy-900/60 border border-navy-700/50 rounded-lg overflow-hidden">
                {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">no url</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NotesTab({ draft, setDraft, onSave, saving }) {
  return (
    <div>
      <Input label="Customer-Visible Notes" value={draft.customer_notes} onChange={(v) => setDraft(d => ({ ...d, customer_notes: v }))} rows={3} />
      <Input label="Internal Notes" value={draft.internal_notes} onChange={(v) => setDraft(d => ({ ...d, internal_notes: v }))} rows={3} />
      <Input label="Completion Notes" value={draft.completion_notes} onChange={(v) => setDraft(d => ({ ...d, completion_notes: v }))} rows={3} />
      <button onClick={onSave} disabled={saving} className="mt-2 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
        {saving ? 'Saving...' : 'Save Notes'}
      </button>
    </div>
  )
}

function ChecklistTab({ draft, setDraft, onSave, saving }) {
  const items = Array.isArray(draft.checklist) ? draft.checklist : []
  const [newLabel, setNewLabel] = useState('')

  function update(i, patch) {
    const next = items.map((it, idx) => idx === i ? { ...it, ...patch } : it)
    setDraft(d => ({ ...d, checklist: next }))
  }
  function remove(i) {
    const next = items.filter((_, idx) => idx !== i)
    setDraft(d => ({ ...d, checklist: next }))
  }
  function add() {
    if (!newLabel.trim()) return
    const next = [...items, { label: newLabel.trim(), completed: false }]
    setDraft(d => ({ ...d, checklist: next }))
    setNewLabel('')
  }

  return (
    <div>
      <div className="bg-navy-900/40 border border-navy-700/50 rounded-lg p-3 mb-3">
        {items.length === 0 ? (
          <div className="text-xs text-gray-600 text-center py-3">No checklist items yet.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!it.completed}
                  onChange={(e) => update(i, { completed: e.target.checked })}
                  className="accent-brand-cyan"
                />
                <input
                  value={it.label || ''}
                  onChange={(e) => update(i, { label: e.target.value })}
                  className="flex-1 bg-navy-800 border border-navy-700/50 rounded px-2 py-1 text-sm text-white"
                />
                <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add checklist item..."
          className="flex-1 bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
        />
        <button onClick={add} className="text-sm text-brand-cyan border border-brand-cyan/40 rounded-lg px-3 py-2 hover:bg-brand-cyan/10">Add</button>
      </div>
      <button onClick={onSave} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
        {saving ? 'Saving...' : 'Save Checklist'}
      </button>
    </div>
  )
}