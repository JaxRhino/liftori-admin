// =====================================================================
// EOSAccountability - Accountability Chart (org structure by SEAT)
// Wave C.2.2
// Reads/writes: eos_accountability_charts (per-tenant LABOS DB)
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, useCrmClient } from '../_shared'

// ---------- formatters ----------
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `seat_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

// ---------- primitives ----------
function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className={`bg-navy-800 border border-navy-700/60 rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-hidden flex flex-col`} onClick={(e) => e.stopPropagation()}>
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
      <div className="w-full sm:w-[560px] bg-navy-800 border-l border-navy-700/50 h-full overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
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
        <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan">
        <option value="">(root)</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

function Textarea(props) { return <Input {...props} rows={props.rows || 3} /> }

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition ${
        active ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40'
               : 'text-gray-400 hover:text-white border border-transparent'
      }`}
    >
      {children}
    </button>
  )
}

function TempBadge({ tone, children }) {
  return <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${tone}`}>{children}</span>
}

function RolesList({ items, onChange, disabled }) {
  const arr = Array.isArray(items) ? items : []
  const [draft, setDraft] = useState('')

  function add() {
    if (!draft.trim()) return
    onChange([...arr, draft.trim()])
    setDraft('')
  }
  function remove(idx) {
    const next = [...arr]
    next.splice(idx, 1)
    onChange(next)
  }
  function update(idx, v) {
    const next = [...arr]
    next[idx] = v
    onChange(next)
  }

  return (
    <div>
      <ul className="space-y-1.5 mb-2">
        {arr.length === 0 && <li className="text-xs text-gray-500 italic">No roles defined.</li>}
        {arr.map((it, i) => (
          <li key={i} className="flex items-center gap-2 bg-navy-900/40 border border-navy-700/40 rounded px-3 py-1.5">
            <span className="text-brand-cyan text-xs">-</span>
            <input
              value={it}
              onChange={(e) => update(i, e.target.value)}
              disabled={disabled}
              className="flex-1 bg-transparent text-sm text-white outline-none disabled:opacity-70"
            />
            {!disabled && <button onClick={() => remove(i)} className="text-xs text-rose-300 hover:text-rose-200">x</button>}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="Add a role and press Enter"
            className="flex-1 bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
          />
          <button onClick={add} className="text-xs px-3 py-2 rounded-lg bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40">Add</button>
        </div>
      )}
    </div>
  )
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function EOSAccountability() {
  const { client, platform } = useCrmClient()

  const [versions, setVersions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('tree') // tree | table
  const [editingSeat, setEditingSeat] = useState(null) // {seat, isNew}
  const [saving, setSaving] = useState(false)
  const [newVerOpen, setNewVerOpen] = useState(false)

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      const { data, error } = await client.from('eos_accountability_charts').select('*').order('version', { ascending: false }).limit(50)
      if (error) throw error
      setVersions(data || [])
      if (data && data.length > 0) {
        const active = data.find(v => v.is_active) || data[0]
        setSelectedId(prev => prev || active.id)
      }
    } catch (e) {
      console.error('[EOSAccountability] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  const selected = useMemo(() => versions.find(v => v.id === selectedId), [versions, selectedId])
  const seats = useMemo(() => Array.isArray(selected?.seats) ? selected.seats : [], [selected])

  // ---- stats ----
  const stats = useMemo(() => {
    const total = seats.length
    const filled = seats.filter(s => (s.holder_name || '').trim()).length
    return { total, filled, vacant: total - filled }
  }, [seats])

  // ---- tree builder ----
  const tree = useMemo(() => buildTree(seats), [seats])

  // ---- table flat list ----
  const flat = useMemo(() => seats.map(s => ({
    ...s,
    parent_title: (seats.find(p => p.id === s.parent_seat_id) || {}).title || '-',
  })), [seats])

  async function persistSeats(nextSeats) {
    if (!client || !selectedId) return
    setSaving(true)
    try {
      const { error } = await client.from('eos_accountability_charts').update({ seats: nextSeats }).eq('id', selectedId)
      if (error) throw error
      await load()
    } catch (e) {
      console.error('[EOSAccountability] persist', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  function openNewSeat() {
    setEditingSeat({
      seat: { id: newId(), title: '', holder_name: '', holder_id: '', parent_seat_id: '', roles: [], department: '' },
      isNew: true,
    })
  }

  async function saveSeat(seat) {
    let next
    if (seats.find(s => s.id === seat.id)) {
      next = seats.map(s => s.id === seat.id ? seat : s)
    } else {
      next = [...seats, seat]
    }
    await persistSeats(next)
    setEditingSeat(null)
  }

  async function deleteSeat(seatId) {
    const children = seats.filter(s => s.parent_seat_id === seatId)
    if (children.length > 0) {
      const ok = window.confirm(`${children.length} child seats will be re-parented to root. Continue?`)
      if (!ok) return
    }
    const next = seats
      .filter(s => s.id !== seatId)
      .map(s => s.parent_seat_id === seatId ? { ...s, parent_seat_id: '' } : s)
    await persistSeats(next)
    setEditingSeat(null)
  }

  async function newVersion() {
    if (!client) return
    setSaving(true)
    try {
      const base = selected
      const payload = {
        version: (Number(base?.version) || 0) + 1,
        seats: base?.seats || [],
        is_active: false,
      }
      const { data, error } = await client.from('eos_accountability_charts').insert(payload).select('*').single()
      if (error) throw error
      if (data) setSelectedId(data.id)
      setNewVerOpen(false)
      await load()
    } catch (e) {
      console.error('[EOSAccountability] newVersion', e)
      alert('Failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function makeActive() {
    if (!client || !selectedId) return
    setSaving(true)
    try {
      await client.from('eos_accountability_charts').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
      const { error } = await client.from('eos_accountability_charts').update({ is_active: true, effective_date: new Date().toISOString() }).eq('id', selectedId)
      if (error) throw error
      await load()
    } catch (e) {
      console.error('[EOSAccountability] makeActive', e)
      alert('Failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <HubPage
      title="Accountability Chart"
      subtitle={`Org structure by seat${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
      actions={
        <div className="flex items-center gap-2">
          {versions.length > 1 && (
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.version}{v.is_active ? ' (active)' : ''}</option>
              ))}
            </select>
          )}
          <button onClick={() => setNewVerOpen(true)} className="text-sm px-3 py-2 rounded-lg bg-navy-900/60 text-gray-300 border border-navy-700/50 hover:text-white">
            + New Version
          </button>
          {selected && !selected.is_active && (
            <button onClick={makeActive} className="text-sm px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30">
              Make Active
            </button>
          )}
          <button onClick={openNewSeat} disabled={!selected} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50">
            + New Seat
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Total Seats" value={stats.total} />
        <StatCard
          label="Filled vs Vacant"
          value={`${stats.filled} / ${stats.vacant}`}
          accent={stats.vacant === 0 ? 'text-emerald-400' : 'text-amber-400'}
          hint="Filled / Vacant"
        />
      </div>

      <div className="flex items-center gap-2 mb-5">
        <TabBtn active={view === 'tree'} onClick={() => setView('tree')}>Tree</TabBtn>
        <TabBtn active={view === 'table'} onClick={() => setView('table')}>Table</TabBtn>
        <div className="ml-auto text-xs text-gray-500">
          {selected && (
            <>v{selected.version}{selected.is_active ? ' - ACTIVE' : ''} - effective {fmtDate(selected.effective_date)}</>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6 text-sm text-gray-500">Loading chart...</div>
      ) : !selected ? (
        <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-12 text-center">
          <h3 className="text-white font-semibold mb-1">No accountability chart yet</h3>
          <p className="text-gray-400 text-sm mb-4">Create the first version, then add seats for each role in the org.</p>
          <button onClick={() => setNewVerOpen(true)} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
            + New Version
          </button>
        </div>
      ) : seats.length === 0 ? (
        <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-12 text-center">
          <h3 className="text-white font-semibold mb-1">No seats yet</h3>
          <p className="text-gray-400 text-sm mb-4">Start with the top of the org (Visionary or Integrator).</p>
          <button onClick={openNewSeat} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
            + New Seat
          </button>
        </div>
      ) : view === 'tree' ? (
        <TreeView nodes={tree} onSelect={(s) => setEditingSeat({ seat: s, isNew: false })} />
      ) : (
        <TableView rows={flat} onSelect={(s) => setEditingSeat({ seat: s, isNew: false })} />
      )}

      {/* New version confirm */}
      <Modal
        open={newVerOpen}
        onClose={() => setNewVerOpen(false)}
        title="New Chart Version"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setNewVerOpen(false)} className="text-sm px-4 py-2 text-gray-300">Cancel</button>
            <button onClick={newVersion} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Version'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-300">
          Creates a new chart row {selected ? `seeded from v${selected.version} (copies all seats)` : 'with no seats'}.
          It is created inactive - make it active explicitly when ready.
        </p>
      </Modal>

      {/* Seat detail drawer */}
      {editingSeat && (
        <SeatDrawer
          seat={editingSeat.seat}
          isNew={editingSeat.isNew}
          allSeats={seats}
          onClose={() => setEditingSeat(null)}
          onSave={saveSeat}
          onDelete={() => deleteSeat(editingSeat.seat.id)}
          saving={saving}
        />
      )}
    </HubPage>
  )
}

// ===========================================================================
//                                TREE / TABLE
// ===========================================================================
function buildTree(seats) {
  const byId = new Map(seats.map(s => [s.id, { ...s, children: [] }]))
  const roots = []
  for (const s of byId.values()) {
    if (s.parent_seat_id && byId.has(s.parent_seat_id)) {
      byId.get(s.parent_seat_id).children.push(s)
    } else {
      roots.push(s)
    }
  }
  return roots
}

function TreeView({ nodes, onSelect }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-5">
      <div className="space-y-4">
        {nodes.map(n => <TreeNode key={n.id} node={n} onSelect={onSelect} />)}
      </div>
    </div>
  )
}

function TreeNode({ node, onSelect, depth = 0 }) {
  const hasChildren = node.children && node.children.length > 0
  return (
    <div>
      <button
        onClick={() => onSelect(node)}
        className="text-left bg-navy-900/60 border border-navy-700/50 rounded-lg p-3 w-full hover:border-brand-cyan/40 transition"
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-brand-cyan text-sm font-semibold">{node.title || '(untitled seat)'}</span>
          {(node.holder_name || '').trim()
            ? <TempBadge tone="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">{node.holder_name}</TempBadge>
            : <TempBadge tone="bg-rose-500/20 text-rose-300 border-rose-500/40">Vacant</TempBadge>}
        </div>
        {node.department && <p className="text-[11px] text-gray-500 mb-1">{node.department}</p>}
        {Array.isArray(node.roles) && node.roles.length > 0 && (
          <ul className="text-xs text-gray-300 space-y-0.5 mt-1">
            {node.roles.slice(0, 5).map((r, i) => (
              <li key={i} className="flex gap-1.5"><span className="text-brand-cyan">-</span><span className="truncate">{r}</span></li>
            ))}
            {node.roles.length > 5 && <li className="text-[10px] text-gray-500">+ {node.roles.length - 5} more</li>}
          </ul>
        )}
      </button>
      {hasChildren && (
        <div className="ml-6 pl-4 mt-3 border-l border-dashed border-navy-700/60 space-y-3">
          {node.children.map(c => <TreeNode key={c.id} node={c} onSelect={onSelect} depth={depth + 1} />)}
        </div>
      )}
    </div>
  )
}

function TableView({ rows, onSelect }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-900/60 border-b border-navy-700/50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Holder</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Department</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Roles</th>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Reports To</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} onClick={() => onSelect(r)} className="border-b border-navy-700/30 hover:bg-navy-900/40 cursor-pointer">
                <td className="px-3 py-2 text-brand-cyan font-medium">{r.title || '-'}</td>
                <td className="px-3 py-2 text-white">
                  {(r.holder_name || '').trim() ? r.holder_name : <span className="text-rose-300 text-xs">Vacant</span>}
                </td>
                <td className="px-3 py-2 text-gray-400">{r.department || '-'}</td>
                <td className="px-3 py-2 text-gray-400">{(Array.isArray(r.roles) ? r.roles.length : 0)}</td>
                <td className="px-3 py-2 text-gray-400">{r.parent_title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===========================================================================
//                                SEAT DRAWER
// ===========================================================================
function SeatDrawer({ seat, isNew, allSeats, onClose, onSave, onDelete, saving }) {
  const [draft, setDraft] = useState(seat)

  useEffect(() => { setDraft(seat) }, [seat])

  if (!draft) return null

  // parent options exclude self + descendants to prevent cycles
  const descendantIds = new Set([draft.id])
  let changed = true
  while (changed) {
    changed = false
    for (const s of allSeats) {
      if (s.parent_seat_id && descendantIds.has(s.parent_seat_id) && !descendantIds.has(s.id)) {
        descendantIds.add(s.id)
        changed = true
      }
    }
  }
  const parentOptions = allSeats
    .filter(s => !descendantIds.has(s.id))
    .map(s => ({ value: s.id, label: s.title || '(untitled)' }))

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <TempBadge tone="bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40">SEAT</TempBadge>
          <span className="text-white font-semibold truncate">{draft.title || (isNew ? 'New Seat' : 'Untitled')}</span>
        </div>
      }
      footer={
        <div className="flex justify-between gap-2">
          {!isNew && (
            <button onClick={onDelete} className="text-sm px-3 py-2 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25">
              Delete Seat
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="text-sm px-3 py-2 text-gray-300 hover:text-white">Cancel</button>
            <button onClick={() => onSave(draft)} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Seat'}
            </button>
          </div>
        </div>
      }
    >
      <Input label="Seat Title" value={draft.title} onChange={(v) => setDraft(d => ({ ...d, title: v }))} placeholder="Integrator, Sales Lead, etc." />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Holder Name" value={draft.holder_name} onChange={(v) => setDraft(d => ({ ...d, holder_name: v }))} placeholder="Empty = Vacant" />
        <Input label="Holder ID (uuid)" value={draft.holder_id} onChange={(v) => setDraft(d => ({ ...d, holder_id: v }))} />
      </div>
      <Input label="Department" value={draft.department} onChange={(v) => setDraft(d => ({ ...d, department: v }))} />
      <Select label="Reports To (parent seat)" value={draft.parent_seat_id} onChange={(v) => setDraft(d => ({ ...d, parent_seat_id: v }))} options={parentOptions} />
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Roles / "The buck stops here" items</span>
      <RolesList
        items={draft.roles}
        onChange={(arr) => setDraft(d => ({ ...d, roles: arr }))}
      />
    </Drawer>
  )
}
