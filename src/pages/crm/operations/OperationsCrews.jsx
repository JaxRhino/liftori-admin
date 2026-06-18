import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'

// ---------- formatters ----------
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'
const relTime = (d) => {
  if (!d) return '-'
  const ms = Date.now() - new Date(d).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  if (days < 30) return days + 'd ago'
  return fmtDate(d)
}

// ---------- constants ----------
const STATUSES = [
  { key: 'active',   label: 'Active',   tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { key: 'standby',  label: 'Standby',  tone: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { key: 'inactive', label: 'Inactive', tone: 'bg-navy-700/60 text-gray-300 border-navy-600/60' },
]

const COLOR_PRESETS = [
  { key: 'emerald', label: 'Emerald', hex: '#10b981' },
  { key: 'amber',   label: 'Amber',   hex: '#f59e0b' },
  { key: 'cyan',    label: 'Cyan',    hex: '#06b6d4' },
  { key: 'violet',  label: 'Violet',  hex: '#8b5cf6' },
  { key: 'rose',    label: 'Rose',    hex: '#f43f5e' },
  { key: 'sky',     label: 'Sky',     hex: '#0ea5e9' },
]

const MEMBER_ROLES = [
  { key: 'lead',      label: 'Lead' },
  { key: 'tech',      label: 'Tech' },
  { key: 'apprentice',label: 'Apprentice' },
]

// ---------- primitives ----------
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
        className="w-full sm:w-[640px] bg-navy-800 border-l border-navy-700/50 h-full overflow-y-auto flex flex-col"
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
        <option value="">--</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

function ChipInput({ label, values, onChange, placeholder }) {
  const [draft, setDraft] = useState('')
  const list = Array.isArray(values) ? values : []
  const add = () => {
    const v = draft.trim()
    if (!v) return
    if (list.includes(v)) { setDraft(''); return }
    onChange([...list, v])
    setDraft('')
  }
  const remove = (v) => onChange(list.filter(x => x !== v))
  return (
    <div className="mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <div className="flex flex-wrap gap-2 mb-2">
        {list.map(v => (
          <span key={v} className="inline-flex items-center gap-1 bg-navy-700/60 border border-navy-600/60 rounded-full px-3 py-1 text-xs text-gray-200">
            {v}
            <button type="button" onClick={() => remove(v)} className="text-gray-400 hover:text-white ml-1">x</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder || 'Type and press Enter'}
          className="flex-1 bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
        />
        <button type="button" onClick={add} className="px-3 py-2 text-sm rounded-lg bg-navy-700 text-gray-200 hover:bg-navy-600">Add</button>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const s = STATUSES.find(x => x.key === status) || STATUSES[2]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${s.tone}`}>{s.label}</span>
}

function ColorDot({ hex, size = 10 }) {
  return <span className="inline-block rounded-full" style={{ width: size, height: size, backgroundColor: hex || '#64748b' }} />
}

function Row({ label, value, multiline }) {
  return (
    <div className={`flex ${multiline ? 'flex-col gap-1' : 'justify-between gap-3'} py-2 border-b border-navy-700/40 last:border-0`}>
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-gray-200 whitespace-pre-wrap">{value}</span>
    </div>
  )
}

// ---------- main page ----------
export default function OperationsCrews() {
  const { client } = useCrmClient()
  const [crews, setCrews] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView] = useState('grid') // grid | table | map

  const [showNew, setShowNew] = useState(false)
  const [drawerCrew, setDrawerCrew] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true)
    setErr(null)
    try {
      const [cRes, mRes] = await Promise.all([
        client.from('ops_crews').select('*').order('name'),
        client.from('ops_crew_members').select('*').order('name'),
      ])
      if (cRes.error) throw cRes.error
      if (mRes.error) throw mRes.error
      setCrews(cRes.data || [])
      setMembers(mRes.data || [])
    } catch (e) {
      setErr(e.message || 'Failed to load crews')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [client])

  const memberCountByCrew = useMemo(() => {
    const map = {}
    for (const m of members) {
      if (m.status === 'inactive') continue
      map[m.crew_id] = (map[m.crew_id] || 0) + 1
    }
    return map
  }, [members])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return crews.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      if ((c.name || '').toLowerCase().includes(q)) return true
      const crewMembers = members.filter(m => m.crew_id === c.id)
      return crewMembers.some(m => (m.name || '').toLowerCase().includes(q))
    })
  }, [crews, members, search, statusFilter])

  const stats = useMemo(() => {
    const activeCrews = crews.filter(c => c.status === 'active').length
    const totalMembers = members.filter(m => m.status !== 'inactive').length
    const jobsCompleted = crews.reduce((s, c) => s + Number(c.jobs_completed || 0), 0)
    const ratedCrews = crews.filter(c => Number(c.avg_rating || 0) > 0 && Number(c.jobs_completed || 0) > 0)
    const wSum = ratedCrews.reduce((s, c) => s + Number(c.avg_rating) * Number(c.jobs_completed), 0)
    const wWeight = ratedCrews.reduce((s, c) => s + Number(c.jobs_completed), 0)
    const avgRating = wWeight > 0 ? (wSum / wWeight) : 0
    return { activeCrews, totalMembers, jobsCompleted, avgRating }
  }, [crews, members])

  return (
    <HubPage
      title="Crews"
      subtitle="Your field teams - assignments, members, vehicles, and live status"
      actions={
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 text-sm font-semibold hover:bg-brand-cyan/90"
        >
          + New Crew
        </button>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Active Crews" value={stats.activeCrews} accent="text-emerald-300" />
        <StatCard label="Total Members" value={stats.totalMembers} accent="text-white" />
        <StatCard label="Jobs Completed" value={stats.jobsCompleted.toLocaleString()} accent="text-brand-cyan" />
        <StatCard label="Avg Rating" value={stats.avgRating ? stats.avgRating.toFixed(2) + ' *' : '-'} accent="text-amber-300" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search crew name or member..."
            className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[{ key: 'all', label: 'All' }, ...STATUSES].map(s => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                statusFilter === s.key
                  ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan'
                  : 'bg-navy-800 border-navy-700/60 text-gray-300 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-navy-900/60 border border-navy-700/60 rounded-lg p-1 self-start">
          {['grid', 'table', 'map'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs rounded-md ${
                view === v ? 'bg-navy-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-sm text-red-300">{err}</div>
      )}

      {/* Body */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading crews...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={crews.length === 0 ? 'No crews yet' : 'No crews match filters'}
          description={crews.length === 0 ? 'Create your first crew to start assigning jobs.' : 'Try clearing search or status filter.'}
          cta={crews.length === 0 ? (
            <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 text-sm font-semibold hover:bg-brand-cyan/90">+ New Crew</button>
          ) : null}
        />
      ) : view === 'map' ? (
        <div className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-10 text-center">
          <div className="text-sm text-gray-400 mb-1">Live crew map</div>
          <div className="text-xs text-gray-500">Coming in Wave F - will plot current_lat/current_lng on a MapLibre map.</div>
        </div>
      ) : view === 'table' ? (
        <CrewTable crews={filtered} memberCountByCrew={memberCountByCrew} onPick={setDrawerCrew} />
      ) : (
        <CrewGrid crews={filtered} memberCountByCrew={memberCountByCrew} onPick={setDrawerCrew} />
      )}

      {/* Modals */}
      <NewCrewModal open={showNew} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} client={client} />
      <CrewDrawer
        open={!!drawerCrew}
        crew={drawerCrew}
        onClose={() => setDrawerCrew(null)}
        onSaved={() => { load() }}
        client={client}
        allMembers={members}
      />
    </HubPage>
  )
}

// ---------- grid ----------
function CrewGrid({ crews, memberCountByCrew, onPick }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {crews.map(c => {
        const specs = Array.isArray(c.specialties) ? c.specialties : []
        const head = specs.slice(0, 3)
        const more = Math.max(0, specs.length - 3)
        return (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className="text-left bg-navy-800 border border-navy-700/60 rounded-xl p-4 hover:border-brand-cyan/60 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <ColorDot hex={c.color} size={12} />
                <span className="text-white font-semibold truncate">{c.name || 'Unnamed crew'}</span>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="text-xs text-gray-400 mb-2">
              {c.vehicle || 'No vehicle'} {c.vehicle_plate ? '- ' + c.vehicle_plate : ''}
            </div>
            <div className="flex flex-wrap gap-1 mb-3 min-h-[24px]">
              {head.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-full text-[10px] bg-navy-700/70 text-gray-300 border border-navy-600/60">{s}</span>
              ))}
              {more > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-navy-700/40 text-gray-400">+{more} more</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 border-t border-navy-700/40 pt-2">
              <span>{memberCountByCrew[c.id] || 0} members</span>
              <span>{Number(c.jobs_completed || 0)} jobs</span>
              <span className="text-amber-300">{Number(c.avg_rating || 0) > 0 ? Number(c.avg_rating).toFixed(1) + ' *' : '-'}</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-2">
              Last seen: {c.current_location_updated_at ? relTime(c.current_location_updated_at) : 'never'}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------- table ----------
function CrewTable({ crews, memberCountByCrew, onPick }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-navy-700/60">
      <table className="w-full text-sm">
        <thead className="bg-navy-900/60 text-gray-400 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Vehicle</th>
            <th className="px-3 py-2 text-left">Specialties</th>
            <th className="px-3 py-2 text-right">Members</th>
            <th className="px-3 py-2 text-right">Jobs</th>
            <th className="px-3 py-2 text-right">Rating</th>
            <th className="px-3 py-2 text-left">Updated</th>
          </tr>
        </thead>
        <tbody>
          {crews.map(c => {
            const specs = Array.isArray(c.specialties) ? c.specialties : []
            const headLabel = specs.slice(0, 2).join(', ')
            const extra = Math.max(0, specs.length - 2)
            return (
              <tr
                key={c.id}
                onClick={() => onPick(c)}
                className="border-t border-navy-700/40 hover:bg-navy-700/30 cursor-pointer"
              >
                <td className="px-3 py-2 text-white flex items-center gap-2">
                  <ColorDot hex={c.color} />
                  <span className="truncate max-w-[180px]">{c.name}</span>
                </td>
                <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                <td className="px-3 py-2 text-gray-300">{c.vehicle || '-'} {c.vehicle_plate ? '/ ' + c.vehicle_plate : ''}</td>
                <td className="px-3 py-2 text-gray-300">{headLabel || '-'}{extra > 0 ? ' +' + extra : ''}</td>
                <td className="px-3 py-2 text-right text-gray-300">{memberCountByCrew[c.id] || 0}</td>
                <td className="px-3 py-2 text-right text-gray-300">{Number(c.jobs_completed || 0)}</td>
                <td className="px-3 py-2 text-right text-amber-300">{Number(c.avg_rating || 0) > 0 ? Number(c.avg_rating).toFixed(1) : '-'}</td>
                <td className="px-3 py-2 text-gray-400 text-xs">{c.current_location_updated_at ? relTime(c.current_location_updated_at) : 'never'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------- new crew modal ----------
function NewCrewModal({ open, onClose, onSaved, client }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLOR_PRESETS[2].hex)
  const [status, setStatus] = useState('active')
  const [vehicle, setVehicle] = useState('')
  const [plate, setPlate] = useState('')
  const [maxCap, setMaxCap] = useState('')
  const [specs, setSpecs] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (open) {
      setName(''); setDescription(''); setColor(COLOR_PRESETS[2].hex)
      setStatus('active'); setVehicle(''); setPlate(''); setMaxCap(''); setSpecs([])
      setErr(null); setSaving(false)
    }
  }, [open])

  async function save() {
    if (!client) return
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr(null)
    try {
      const { error } = await client.from('ops_crews').insert({
        name: name.trim(),
        description: description.trim() || null,
        color,
        status,
        vehicle: vehicle.trim() || null,
        vehicle_plate: plate.trim() || null,
        max_capacity: maxCap ? Number(maxCap) : null,
        specialties: specs,
        jobs_completed: 0,
      })
      if (error) throw error
      onSaved()
    } catch (e) {
      setErr(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Crew"
      wide
      footer={
        <div className="flex items-center justify-between">
          {err ? <span className="text-xs text-red-300">{err}</span> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-navy-700 text-gray-200 hover:bg-navy-600">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save crew'}</button>
          </div>
        </div>
      }
    >
      <Input label="Name" value={name} onChange={setName} placeholder="North Side Crew" />
      <Input label="Description" value={description} onChange={setDescription} rows={2} placeholder="Optional - territory or notes" />

      <div className="mb-3">
        <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Badge Color</span>
        <div className="flex gap-2">
          {COLOR_PRESETS.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setColor(p.hex)}
              className={`w-8 h-8 rounded-full border-2 ${color === p.hex ? 'border-white' : 'border-navy-700'}`}
              style={{ backgroundColor: p.hex }}
              title={p.label}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Select label="Status" value={status} onChange={setStatus} options={STATUSES.map(s => ({ value: s.key, label: s.label }))} />
        <Input label="Max Capacity (people)" type="number" value={maxCap} onChange={setMaxCap} placeholder="4" />
        <Input label="Vehicle" value={vehicle} onChange={setVehicle} placeholder="Ford Transit" />
        <Input label="Vehicle Plate" value={plate} onChange={setPlate} placeholder="ABC-1234" />
      </div>
      <ChipInput label="Specialties" values={specs} onChange={setSpecs} placeholder="HVAC, plumbing, electrical..." />
    </Modal>
  )
}

// ---------- crew drawer ----------
function CrewDrawer({ open, crew, onClose, onSaved, client, allMembers }) {
  const [tab, setTab] = useState('overview')
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const [workOrders, setWorkOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [loadingWO, setLoadingWO] = useState(false)
  const [loadingInv, setLoadingInv] = useState(false)

  const [showAddMember, setShowAddMember] = useState(false)

  useEffect(() => {
    if (crew) {
      setDraft({ ...crew })
      setTab('overview')
      setErr(null)
    }
  }, [crew?.id])

  // Load jobs + inventory when those tabs activate
  useEffect(() => {
    if (!crew || !client) return
    if (tab === 'jobs') {
      setLoadingWO(true)
      client.from('ops_work_orders')
        .select('id, work_order_number, title, status, scheduled_start')
        .eq('assigned_crew_id', crew.id)
        .order('scheduled_start', { ascending: false })
        .limit(20)
        .then(res => {
          if (!res.error) setWorkOrders(res.data || [])
          setLoadingWO(false)
        })
    } else if (tab === 'inventory') {
      setLoadingInv(true)
      client.from('ops_inventory')
        .select('id, name, sku, quantity, unit')
        .eq('assigned_crew_id', crew.id)
        .order('name')
        .then(res => {
          if (!res.error) setInventory(res.data || [])
          setLoadingInv(false)
        })
    }
  }, [tab, crew?.id, client])

  if (!crew) return null

  const crewMembers = allMembers.filter(m => m.crew_id === crew.id)

  async function saveOverview() {
    if (!client) return
    setSaving(true); setErr(null)
    try {
      const { error } = await client.from('ops_crews').update({
        name: draft.name,
        description: draft.description,
        color: draft.color,
        vehicle: draft.vehicle,
        vehicle_plate: draft.vehicle_plate,
        max_capacity: draft.max_capacity ? Number(draft.max_capacity) : null,
        specialties: Array.isArray(draft.specialties) ? draft.specialties : [],
      }).eq('id', crew.id)
      if (error) throw error
      onSaved()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(v) {
    if (!client) return
    try {
      const { error } = await client.from('ops_crews').update({ status: v }).eq('id', crew.id)
      if (error) throw error
      setDraft(d => ({ ...d, status: v }))
      onSaved()
    } catch (e) {
      setErr(e.message || 'Status update failed')
    }
  }

  async function removeMember(m) {
    if (!client) return
    if (!confirm('Mark ' + (m.name || 'this member') + ' inactive?')) return
    try {
      const { error } = await client.from('ops_crew_members').update({ status: 'inactive' }).eq('id', m.id)
      if (error) throw error
      onSaved()
    } catch (e) {
      setErr(e.message || 'Remove failed')
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2">
            <ColorDot hex={draft.color || crew.color} size={14} />
            <span className="text-white font-semibold truncate">{draft.name || crew.name}</span>
            <div className="ml-2">
              <select
                value={draft.status || crew.status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-navy-900/60 border border-navy-700/60 rounded-md px-2 py-1 text-xs text-white"
              >
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
        }
        footer={tab === 'overview' ? (
          <div className="flex items-center justify-between">
            {err ? <span className="text-xs text-red-300">{err}</span> : <span />}
            <button onClick={saveOverview} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        ) : null}
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-navy-700/50 overflow-x-auto">
          {[
            { key: 'overview',  label: 'Overview' },
            { key: 'members',   label: 'Members (' + crewMembers.filter(m => m.status !== 'inactive').length + ')' },
            { key: 'jobs',      label: 'Jobs' },
            { key: 'inventory', label: 'Inventory' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${
                tab === t.key
                  ? 'border-brand-cyan text-brand-cyan'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div>
            <Input label="Name" value={draft.name} onChange={(v) => setDraft(d => ({ ...d, name: v }))} />
            <Input label="Description" value={draft.description} onChange={(v) => setDraft(d => ({ ...d, description: v }))} rows={2} />
            <div className="mb-3">
              <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Badge Color</span>
              <div className="flex gap-2">
                {COLOR_PRESETS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, color: p.hex }))}
                    className={`w-8 h-8 rounded-full border-2 ${draft.color === p.hex ? 'border-white' : 'border-navy-700'}`}
                    style={{ backgroundColor: p.hex }}
                    title={p.label}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Input label="Vehicle" value={draft.vehicle} onChange={(v) => setDraft(d => ({ ...d, vehicle: v }))} />
              <Input label="Plate" value={draft.vehicle_plate} onChange={(v) => setDraft(d => ({ ...d, vehicle_plate: v }))} />
              <Input label="Max Capacity" type="number" value={draft.max_capacity} onChange={(v) => setDraft(d => ({ ...d, max_capacity: v }))} />
            </div>
            <ChipInput label="Specialties" values={draft.specialties} onChange={(v) => setDraft(d => ({ ...d, specialties: v }))} />

            <Section title="Live status">
              <Row label="Jobs Completed" value={String(Number(crew.jobs_completed || 0))} />
              <Row label="Avg Rating" value={Number(crew.avg_rating || 0) > 0 ? Number(crew.avg_rating).toFixed(2) : '-'} />
              <Row label="Last Location" value={crew.current_lat && crew.current_lng ? Number(crew.current_lat).toFixed(4) + ', ' + Number(crew.current_lng).toFixed(4) : 'Not reporting'} />
              <Row label="Last Update" value={crew.current_location_updated_at ? fmtDateTime(crew.current_location_updated_at) : '-'} />
              <Row label="Created" value={fmtDate(crew.created_at)} />
            </Section>
          </div>
        )}

        {tab === 'members' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Crew members</span>
              <button
                onClick={() => setShowAddMember(true)}
                className="px-3 py-1.5 text-xs rounded-lg bg-brand-cyan text-navy-900 font-semibold hover:bg-brand-cyan/90"
              >
                + Add Member
              </button>
            </div>
            {crewMembers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No members assigned yet.</div>
            ) : (
              <div className="space-y-2">
                {crewMembers.map(m => (
                  <div key={m.id} className={`p-3 rounded-lg border ${m.status === 'inactive' ? 'border-navy-700/40 bg-navy-900/40 opacity-60' : 'border-navy-700/60 bg-navy-900/40'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm text-white font-medium">{m.name || 'Unnamed'} <span className="ml-2 text-xs text-gray-400 capitalize">{m.role}</span></div>
                      {m.status !== 'inactive' && (
                        <button onClick={() => removeMember(m)} className="text-xs text-gray-400 hover:text-red-300">Remove</button>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{m.phone || ''} {m.phone && m.email ? '-' : ''} {m.email || ''}</div>
                    {Array.isArray(m.certifications) && m.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.certifications.map(c => (
                          <span key={c} className="px-2 py-0.5 rounded-full text-[10px] bg-navy-700/70 text-gray-300">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'jobs' && (
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Recent Jobs</div>
            {loadingWO ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
            ) : workOrders.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No jobs assigned to this crew yet.</div>
            ) : (
              <div className="space-y-2">
                {workOrders.map(w => (
                  <div key={w.id} className="p-3 rounded-lg border border-navy-700/60 bg-navy-900/40">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white">
                        <span className="text-gray-400">{w.work_order_number || '#'}</span> {w.title || 'Untitled'}
                      </div>
                      <span className="text-xs text-gray-400 capitalize">{(w.status || '').replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Scheduled: {fmtDateTime(w.scheduled_start)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'inventory' && (
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Inventory Assigned</div>
            {loadingInv ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
            ) : inventory.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Nothing assigned. Assign items from the Inventory tab.</div>
            ) : (
              <div className="space-y-2">
                {inventory.map(i => (
                  <div key={i.id} className="p-3 rounded-lg border border-navy-700/60 bg-navy-900/40 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white">{i.name}</div>
                      <div className="text-xs text-gray-500">{i.sku || ''}</div>
                    </div>
                    <div className="text-sm text-gray-300">{Number(i.quantity || 0)} <span className="text-xs text-gray-500">{i.unit || ''}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <NewMemberModal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        onSaved={() => { setShowAddMember(false); onSaved() }}
        client={client}
        crewId={crew.id}
      />
    </>
  )
}

// ---------- new member modal ----------
function NewMemberModal({ open, onClose, onSaved, client, crewId }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('tech')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [certs, setCerts] = useState([])
  const [hireDate, setHireDate] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (open) {
      setName(''); setRole('tech'); setPhone(''); setEmail('')
      setCerts([]); setHireDate(''); setHourlyRate('')
      setErr(null); setSaving(false)
    }
  }, [open])

  async function save() {
    if (!client) return
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr(null)
    try {
      const { error } = await client.from('ops_crew_members').insert({
        crew_id: crewId,
        name: name.trim(),
        role,
        phone: phone.trim() || null,
        email: email.trim() || null,
        certifications: certs,
        hire_date: hireDate || null,
        hourly_rate: hourlyRate ? Number(hourlyRate) : null,
        status: 'active',
      })
      if (error) throw error
      onSaved()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Crew Member"
      footer={
        <div className="flex items-center justify-between">
          {err ? <span className="text-xs text-red-300">{err}</span> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-navy-700 text-gray-200 hover:bg-navy-600">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Add member'}</button>
          </div>
        </div>
      }
    >
      <Input label="Name" value={name} onChange={setName} placeholder="Jane Smith" />
      <Select label="Role" value={role} onChange={setRole} options={MEMBER_ROLES.map(r => ({ value: r.key, label: r.label }))} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="Phone" value={phone} onChange={setPhone} placeholder="555-1234" />
        <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="jane@example.com" />
        <Input label="Hire Date" type="date" value={hireDate} onChange={setHireDate} />
        <Input label="Hourly Rate" type="number" value={hourlyRate} onChange={setHourlyRate} placeholder="35" />
      </div>
      <ChipInput label="Certifications" values={certs} onChange={setCerts} placeholder="NATE, EPA, OSHA-10..." />
    </Modal>
  )
}
