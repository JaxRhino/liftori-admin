// =====================================================================
// EOSRocks - Quarterly priorities tracker (EOS Traction methodology)
// Wave C.2.1
// Reads/writes: eos_rocks (per-tenant LABOS DB)
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'

// ---------- formatters ----------
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const shortId = (id) => (id ? String(id).slice(0, 8) : '-')

// ---------- quarter helpers ----------
function quarterOf(date) {
  const d = new Date(date)
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-Q${q}`
}
function currentQuarter() { return quarterOf(new Date()) }
function shiftQuarter(qStr, delta) {
  const [yStr, qPart] = qStr.split('-Q')
  let y = parseInt(yStr, 10)
  let q = parseInt(qPart, 10) + delta
  while (q > 4) { q -= 4; y += 1 }
  while (q < 1) { q += 4; y -= 1 }
  return `${y}-Q${q}`
}
function quarterBounds(qStr) {
  const [yStr, qPart] = qStr.split('-Q')
  const y = parseInt(yStr, 10)
  const q = parseInt(qPart, 10)
  const startMonth = (q - 1) * 3
  const start = new Date(y, startMonth, 1)
  const end = new Date(y, startMonth + 3, 0, 23, 59, 59)
  return { start: start.toISOString(), end: end.toISOString() }
}

// ---------- constants ----------
const ROCK_STATUSES = [
  { key: 'on-track',  label: 'On Track',  tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { key: 'at-risk',   label: 'At Risk',   tone: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { key: 'off-track', label: 'Off Track', tone: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
]
const ROCK_TYPES = [
  { key: 'company',    label: 'Company',    tone: 'bg-brand-cyan/20 text-brand-cyan' },
  { key: 'department', label: 'Department', tone: 'bg-brand-blue/20 text-brand-blue' },
  { key: 'individual', label: 'Individual', tone: 'bg-violet-500/20 text-violet-300' },
]

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

function Textarea(props) { return <Input {...props} rows={props.rows || 3} /> }

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

function TabBtn({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
        active
          ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40'
          : 'text-gray-400 hover:text-white border border-transparent'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy-700/60">{count}</span>
      )}
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

function StatusBadge({ status }) {
  const s = ROCK_STATUSES.find(x => x.key === status)
  if (!s) return <span className="text-[10px] px-2 py-0.5 rounded border bg-navy-700/60 text-gray-300 border-navy-700/60 uppercase">{status || '-'}</span>
  return <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${s.tone}`}>{s.label}</span>
}

function TypeBadge({ type }) {
  const t = ROCK_TYPES.find(x => x.key === type)
  if (!t) return <span className="text-[10px] px-2 py-0.5 rounded bg-navy-700/60 text-gray-300 uppercase">{type || '-'}</span>
  return <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${t.tone}`}>{t.label}</span>
}

function ProgressBar({ pct }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0))
  const tone = p >= 80 ? 'bg-emerald-400' : p >= 40 ? 'bg-brand-cyan' : 'bg-amber-400'
  return (
    <div className="w-full h-1.5 rounded-full bg-navy-900/70 overflow-hidden">
      <div className={`h-full ${tone}`} style={{ width: `${p}%` }} />
    </div>
  )
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function EOSRocks() {
  const { client, platform } = useCrmClient()

  const [rocks, setRocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [quarter, setQuarter] = useState(currentQuarter())
  const [showCarried, setShowCarried] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // grid | table
  const [newOpen, setNewOpen] = useState(false)
  const [drawer, setDrawer] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      let q = client.from('eos_rocks').select('*').eq('quarter', quarter)
      if (showCarried) q = q.not('carried_over_from', 'is', null)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(300)
      if (error) throw error
      setRocks(data || [])
    } catch (e) {
      console.error('[EOSRocks] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, quarter, showCarried])

  // ---- stats ----
  const stats = useMemo(() => {
    const open = rocks.filter(r => !r.is_complete)
    return {
      active: open.length,
      onTrack: open.filter(r => r.status === 'on-track').length,
      atRisk: open.filter(r => r.status === 'at-risk').length,
      offTrack: open.filter(r => r.status === 'off-track').length,
    }
  }, [rocks])

  // ---- quarter pills ----
  const quarters = useMemo(() => {
    const cur = currentQuarter()
    return [shiftQuarter(cur, -2), shiftQuarter(cur, -1), cur, shiftQuarter(cur, 1)]
  }, [])

  return (
    <HubPage
      title="Rocks"
      subtitle={`Quarterly priorities${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
      actions={
        <button
          onClick={() => setNewOpen(true)}
          className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium hover:brightness-110"
        >
          + New Rock
        </button>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Active Rocks" value={stats.active} />
        <StatCard label="On Track" value={stats.onTrack} accent="text-emerald-400" />
        <StatCard label="At Risk" value={stats.atRisk} accent="text-amber-400" />
        <StatCard label="Off Track" value={stats.offTrack} accent="text-rose-400" />
      </div>

      {/* Quarter switcher */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Quarter</span>
        {quarters.map(q => (
          <Chip key={q} active={q === quarter} onClick={() => setQuarter(q)}>{q}</Chip>
        ))}
        <label className="flex items-center gap-2 text-xs text-gray-400 ml-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showCarried}
            onChange={(e) => setShowCarried(e.target.checked)}
            className="accent-brand-cyan"
          />
          Show carried-over only
        </label>
        <div className="ml-auto flex items-center gap-2">
          <TabBtn active={viewMode === 'grid'} onClick={() => setViewMode('grid')}>Grid</TabBtn>
          <TabBtn active={viewMode === 'table'} onClick={() => setViewMode('table')}>Table</TabBtn>
        </div>
      </div>

      {loading ? (
        <Section title={quarter}><div className="p-6 text-sm text-gray-500">Loading rocks...</div></Section>
      ) : rocks.length === 0 ? (
        <EmptyState
          title="No rocks yet"
          description={`No rocks tracked for ${quarter}. Create one to start the quarter.`}
          cta={
            <button
              onClick={() => setNewOpen(true)}
              className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium"
            >
              + New Rock
            </button>
          }
        />
      ) : viewMode === 'grid' ? (
        <RockGrid rocks={rocks} onOpen={(r) => setDrawer(r)} />
      ) : (
        <RockTable rocks={rocks} onOpen={(r) => setDrawer(r)} />
      )}

      <NewRockModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        client={client}
        defaultQuarter={quarter}
        onSaved={() => { setNewOpen(false); load() }}
      />

      <RockDrawer
        rock={drawer}
        onClose={() => setDrawer(null)}
        client={client}
        onChanged={() => { setDrawer(null); load() }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                                ROCK GRID
// ===========================================================================
function RockGrid({ rocks, onOpen }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {rocks.map(r => {
        const milestones = Array.isArray(r.milestones) ? r.milestones : []
        const done = milestones.filter(m => m.completed).length
        return (
          <button
            key={r.id}
            onClick={() => onOpen(r)}
            className="text-left bg-navy-800 border border-navy-700/50 rounded-xl p-4 hover:border-brand-cyan/40 transition"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <TypeBadge type={r.rock_type} />
                <StatusBadge status={r.status} />
              </div>
              {r.is_complete && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200 uppercase">Done</span>
              )}
            </div>
            <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">{r.title}</h3>
            <p className="text-xs text-gray-500 mb-2">Owner: {shortId(r.owner_id)}</p>
            {r.success_criteria && (
              <p className="text-xs text-gray-400 line-clamp-1 mb-3">{r.success_criteria}</p>
            )}
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>{r.quarter}</span>
              <span>{done}/{milestones.length} milestones</span>
            </div>
            <ProgressBar pct={r.progress_percentage} />
            <p className="text-[10px] text-gray-500 mt-1 text-right">{r.progress_percentage || 0}%</p>
          </button>
        )
      })}
    </div>
  )
}

// ===========================================================================
//                                ROCK TABLE
// ===========================================================================
function RockTable({ rocks, onOpen }) {
  const [sort, setSort] = useState({ key: 'progress_percentage', dir: 'desc' })
  const sorted = useMemo(() => {
    const arr = [...rocks]
    arr.sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      const cmp = (va ?? 0) > (vb ?? 0) ? 1 : (va ?? 0) < (vb ?? 0) ? -1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [rocks, sort])

  function head(key, label) {
    const active = sort.key === key
    return (
      <th
        onClick={() => setSort(s => ({ key, dir: active && s.dir === 'desc' ? 'asc' : 'desc' }))}
        className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
      >
        {label}{active ? (sort.dir === 'desc' ? ' v' : ' ^') : ''}
      </th>
    )
  }

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-900/60 border-b border-navy-700/50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Owner</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Quarter</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Status</th>
              {head('progress_percentage', 'Progress')}
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Milestones</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Done</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const ms = Array.isArray(r.milestones) ? r.milestones : []
              const doneCount = ms.filter(m => m.completed).length
              return (
                <tr
                  key={r.id}
                  onClick={() => onOpen(r)}
                  className="border-b border-navy-700/30 hover:bg-navy-900/40 cursor-pointer"
                >
                  <td className="px-3 py-2 text-white max-w-[260px] truncate">{r.title}</td>
                  <td className="px-3 py-2"><TypeBadge type={r.rock_type} /></td>
                  <td className="px-3 py-2 text-gray-400">{shortId(r.owner_id)}</td>
                  <td className="px-3 py-2 text-gray-400">{r.quarter || '-'}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-gray-300 w-[120px]">
                    <ProgressBar pct={r.progress_percentage} />
                    <div className="text-[10px] text-gray-500 mt-0.5">{r.progress_percentage || 0}%</div>
                  </td>
                  <td className="px-3 py-2 text-gray-400">{doneCount}/{ms.length}</td>
                  <td className="px-3 py-2">{r.is_complete ? <span className="text-emerald-300 text-xs">yes</span> : <span className="text-gray-500 text-xs">-</span>}</td>
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
//                                NEW ROCK MODAL
// ===========================================================================
function NewRockModal({ open, onClose, client, defaultQuarter, onSaved }) {
  const [form, setForm] = useState(emptyForm(defaultQuarter))
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm(emptyForm(defaultQuarter)) }, [open, defaultQuarter])

  function emptyForm(q) {
    const bounds = quarterBounds(q || currentQuarter())
    return {
      title: '',
      description: '',
      success_criteria: '',
      owner_id: '',
      rock_type: 'individual',
      department: '',
      quarter: q || currentQuarter(),
      quarter_start_date: bounds.start,
      quarter_end_date: bounds.end,
    }
  }

  async function save() {
    if (!client) return
    if (!form.title.trim()) { alert('Title is required'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        success_criteria: form.success_criteria || null,
        owner_id: form.owner_id || null,
        rock_type: form.rock_type || 'individual',
        department: form.department || null,
        quarter: form.quarter,
        quarter_start_date: form.quarter_start_date,
        quarter_end_date: form.quarter_end_date,
        status: 'on-track',
        progress_percentage: 0,
        milestones: [],
        update_history: [],
        is_complete: false,
      }
      const { error } = await client.from('eos_rocks').insert(payload)
      if (error) throw error
      onSaved?.()
    } catch (e) {
      console.error('[EOSRocks] save', e)
      alert('Failed to save rock: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Rock"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Create Rock'}
          </button>
        </div>
      }
    >
      <Input label="Title" value={form.title} onChange={(v) => setForm(f => ({ ...f, title: v }))} placeholder="Ship Wave C.2 by EOQ" />
      <Textarea label="Description" value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} rows={3} />
      <Textarea label="Success Criteria" value={form.success_criteria} onChange={(v) => setForm(f => ({ ...f, success_criteria: v }))} rows={2} placeholder="3 of 7 EOS modules shipped and live in prod" />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Type"
          value={form.rock_type}
          onChange={(v) => setForm(f => ({ ...f, rock_type: v }))}
          options={ROCK_TYPES.map(t => ({ value: t.key, label: t.label }))}
        />
        <Input label="Department" value={form.department} onChange={(v) => setForm(f => ({ ...f, department: v }))} placeholder="Engineering" />
      </div>
      <Input label="Owner ID (uuid)" value={form.owner_id} onChange={(v) => setForm(f => ({ ...f, owner_id: v }))} placeholder="00000000-0000-0000-0000-000000000000" />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Quarter" value={form.quarter} onChange={(v) => setForm(f => ({ ...f, quarter: v }))} placeholder="2026-Q2" />
        <Input label="Start" type="date" value={form.quarter_start_date?.slice(0, 10)} onChange={(v) => setForm(f => ({ ...f, quarter_start_date: v }))} />
        <Input label="End" type="date" value={form.quarter_end_date?.slice(0, 10)} onChange={(v) => setForm(f => ({ ...f, quarter_end_date: v }))} />
      </div>
    </Modal>
  )
}

// ===========================================================================
//                                ROCK DETAIL DRAWER
// ===========================================================================
function RockDrawer({ rock, onClose, client, onChanged }) {
  const [tab, setTab] = useState('overview')
  const [draft, setDraft] = useState(rock)
  const [saving, setSaving] = useState(false)
  const [newUpdate, setNewUpdate] = useState('')
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')

  useEffect(() => {
    setDraft(rock)
    setTab('overview')
    setNewUpdate('')
    setCompletionNotes('')
  }, [rock])

  if (!rock) return null

  async function saveField(updates) {
    if (!client) return
    setSaving(true)
    try {
      const { error } = await client.from('eos_rocks').update(updates).eq('id', rock.id)
      if (error) throw error
      setDraft(d => ({ ...d, ...updates }))
    } catch (e) {
      console.error('[EOSRocks] saveField', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function saveAll() {
    await saveField({
      title: draft.title,
      description: draft.description,
      success_criteria: draft.success_criteria,
      owner_id: draft.owner_id || null,
      department: draft.department,
      quarter: draft.quarter,
      progress_percentage: Math.max(0, Math.min(100, parseInt(draft.progress_percentage, 10) || 0)),
      status: draft.status,
    })
    onChanged?.()
  }

  async function toggleMilestone(idx) {
    const arr = Array.isArray(draft.milestones) ? [...draft.milestones] : []
    if (!arr[idx]) return
    arr[idx] = { ...arr[idx], completed: !arr[idx].completed }
    await saveField({ milestones: arr })
  }

  async function addMilestone() {
    const title = window.prompt('Milestone title?')
    if (!title) return
    const arr = Array.isArray(draft.milestones) ? [...draft.milestones] : []
    arr.push({ title, due_date: null, completed: false })
    await saveField({ milestones: arr })
  }

  async function removeMilestone(idx) {
    const arr = Array.isArray(draft.milestones) ? [...draft.milestones] : []
    arr.splice(idx, 1)
    await saveField({ milestones: arr })
  }

  async function addUpdate() {
    if (!newUpdate.trim()) return
    const arr = Array.isArray(draft.update_history) ? [...draft.update_history] : []
    arr.push({
      date: new Date().toISOString(),
      by: null,
      message: newUpdate.trim(),
      progress: draft.progress_percentage || 0,
    })
    await saveField({ update_history: arr })
    setNewUpdate('')
  }

  async function markComplete() {
    if (!client) return
    setSaving(true)
    try {
      const { error } = await client.from('eos_rocks').update({
        is_complete: true,
        completed_at: new Date().toISOString(),
        completion_notes: completionNotes || null,
        progress_percentage: 100,
      }).eq('id', rock.id)
      if (error) throw error
      onChanged?.()
    } catch (e) {
      console.error('[EOSRocks] markComplete', e)
      alert('Failed: ' + (e.message || e))
    } finally {
      setSaving(false)
      setCompleteOpen(false)
    }
  }

  const milestones = Array.isArray(draft?.milestones) ? draft.milestones : []
  const history = Array.isArray(draft?.update_history) ? [...draft.update_history].reverse() : []

  return (
    <Drawer
      open={!!rock}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <TypeBadge type={draft?.rock_type} />
          <StatusBadge status={draft?.status} />
          <span className="text-white font-semibold truncate">{draft?.title || 'Rock'}</span>
        </div>
      }
      footer={
        <div className="flex justify-between gap-2">
          <button
            onClick={() => setCompleteOpen(true)}
            disabled={draft?.is_complete}
            className="text-sm px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            {draft?.is_complete ? 'Completed' : 'Mark Complete'}
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
        <TabBtn active={tab === 'milestones'} onClick={() => setTab('milestones')} count={milestones.length}>Milestones</TabBtn>
        <TabBtn active={tab === 'updates'} onClick={() => setTab('updates')} count={history.length}>Update History</TabBtn>
        <TabBtn active={tab === 'linked'} onClick={() => setTab('linked')}>Linked</TabBtn>
      </div>

      {tab === 'overview' && draft && (
        <div>
          <Input label="Title" value={draft.title} onChange={(v) => setDraft(d => ({ ...d, title: v }))} />
          <Textarea label="Description" value={draft.description} onChange={(v) => setDraft(d => ({ ...d, description: v }))} rows={3} />
          <Textarea label="Success Criteria" value={draft.success_criteria} onChange={(v) => setDraft(d => ({ ...d, success_criteria: v }))} rows={2} />
          <Input label="Owner ID" value={draft.owner_id || ''} onChange={(v) => setDraft(d => ({ ...d, owner_id: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={draft.department} onChange={(v) => setDraft(d => ({ ...d, department: v }))} />
            <Input label="Quarter" value={draft.quarter} onChange={(v) => setDraft(d => ({ ...d, quarter: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status"
              value={draft.status}
              onChange={(v) => setDraft(d => ({ ...d, status: v }))}
              options={ROCK_STATUSES.map(s => ({ value: s.key, label: s.label }))}
            />
            <Input
              label="Progress %"
              type="number"
              value={draft.progress_percentage ?? 0}
              onChange={(v) => setDraft(d => ({ ...d, progress_percentage: v }))}
            />
          </div>
          <div className="mt-2"><ProgressBar pct={draft.progress_percentage} /></div>
          {draft.is_complete && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <DetailRow label="Completed at" value={fmtDate(draft.completed_at)} />
              <DetailRow label="Completion notes" value={draft.completion_notes} />
            </div>
          )}
        </div>
      )}

      {tab === 'milestones' && (
        <div>
          {milestones.length === 0 && <p className="text-sm text-gray-500 mb-3">No milestones yet.</p>}
          <ul className="space-y-2 mb-3">
            {milestones.map((m, i) => (
              <li key={i} className="flex items-center gap-3 bg-navy-900/50 border border-navy-700/40 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!m.completed}
                  onChange={() => toggleMilestone(i)}
                  className="accent-brand-cyan"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${m.completed ? 'line-through text-gray-500' : 'text-white'}`}>{m.title}</p>
                  {m.due_date && <p className="text-[10px] text-gray-500">Due {fmtDate(m.due_date)}</p>}
                </div>
                <button onClick={() => removeMilestone(i)} className="text-xs text-rose-300 hover:text-rose-200">Remove</button>
              </li>
            ))}
          </ul>
          <button onClick={addMilestone} className="text-sm text-brand-cyan hover:brightness-110">+ Add milestone</button>
        </div>
      )}

      {tab === 'updates' && (
        <div>
          <div className="mb-4">
            <Textarea label="Add progress update" value={newUpdate} onChange={setNewUpdate} rows={3} placeholder="Where do we stand this week?" />
            <button
              onClick={addUpdate}
              disabled={!newUpdate.trim()}
              className="bg-brand-cyan text-navy-900 text-sm px-3 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              Post Update
            </button>
          </div>
          <div className="space-y-2">
            {history.length === 0 && <p className="text-sm text-gray-500">No updates yet.</p>}
            {history.map((h, i) => (
              <div key={i} className="bg-navy-900/40 border border-navy-700/40 rounded-lg p-3">
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                  <span>{shortId(h.by)} - {fmtDate(h.date)}</span>
                  <span>Progress: {h.progress ?? 0}%</span>
                </div>
                <p className="text-sm text-white whitespace-pre-wrap">{h.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'linked' && (
        <div className="space-y-4">
          <LinkedSection label="Linked Issues" ids={draft?.linked_issues} />
          <LinkedSection label="Linked To-Dos" ids={draft?.linked_todos} />
          <LinkedSection label="Linked Metrics" ids={draft?.linked_metrics} />
          <p className="text-xs text-gray-500">Linking pickers land in Wave F. For now, edit the array fields directly in Supabase.</p>
        </div>
      )}

      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Mark Rock Complete"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setCompleteOpen(false)} className="text-sm px-4 py-2 text-gray-300">Cancel</button>
            <button onClick={markComplete} className="bg-emerald-500 text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">Confirm</button>
          </div>
        }
      >
        <p className="text-sm text-gray-300 mb-3">Adds a completion note and sets progress to 100%.</p>
        <Textarea label="Completion notes" value={completionNotes} onChange={setCompletionNotes} rows={4} placeholder="Outcome, learnings, links..." />
      </Modal>
    </Drawer>
  )
}

function LinkedSection({ label, ids }) {
  const arr = Array.isArray(ids) ? ids : []
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">{label}</h4>
      {arr.length === 0 ? (
        <p className="text-sm text-gray-500">No links.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {arr.map(id => (
            <span key={id} className="text-xs px-2 py-1 rounded bg-navy-900/60 border border-navy-700/50 text-gray-300">{shortId(id)}</span>
          ))}
        </div>
      )}
    </div>
  )
}
