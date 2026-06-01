import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'

// ---------- formatters ----------
const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'

// ---------- constants ----------
const STATUS_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'in_stock', label: 'In Stock' },
  { key: 'low',      label: 'Low Stock' },
  { key: 'out',      label: 'Out of Stock' },
  { key: 'inactive', label: 'Inactive' },
]

const TX_TYPES = [
  { key: 'restock',  label: 'Restock',  sign: +1 },
  { key: 'use',      label: 'Use',      sign: -1 },
  { key: 'transfer', label: 'Transfer', sign: 0 },
  { key: 'adjust',   label: 'Adjust',   sign: 0 },
  { key: 'return',   label: 'Return',   sign: +1 },
  { key: 'damage',   label: 'Damage',   sign: -1 },
]

const CONDITIONS = [
  { key: 'new',  label: 'New' },
  { key: 'good', label: 'Good' },
  { key: 'fair', label: 'Fair' },
  { key: 'poor', label: 'Poor' },
]

const UNITS = ['ea', 'ft', 'lb', 'gal', 'bx', 'pk', 'm', 'kg', 'L']

function stockStatus(item) {
  if (!item.is_active) return 'inactive'
  const qty = Number(item.quantity || 0)
  const min = Number(item.min_quantity || 0)
  if (qty <= 0) return 'out'
  if (min > 0 && qty < min) return 'low'
  return 'in_stock'
}

function stockTone(status) {
  switch (status) {
    case 'in_stock': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    case 'low':      return 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    case 'out':      return 'bg-red-500/20 text-red-300 border-red-500/40'
    case 'inactive': return 'bg-navy-700/60 text-gray-400 border-navy-600/60'
    default:         return 'bg-navy-700/60 text-gray-300 border-navy-600/60'
  }
}

function stockLabel(status) {
  switch (status) {
    case 'in_stock': return 'In Stock'
    case 'low':      return 'Low'
    case 'out':      return 'Out'
    case 'inactive': return 'Inactive'
    default:         return status
  }
}

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
        <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </label>
  )
}

function Select({ label, value, onChange, options, allowBlank = true }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
      >
        {allowBlank && <option value="">--</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 mb-3 py-2">
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-10 h-6 rounded-full border ${value ? 'bg-brand-cyan border-brand-cyan' : 'bg-navy-700 border-navy-600'} relative transition-colors`}
      >
        <span className={`absolute top-0.5 ${value ? 'right-0.5' : 'left-0.5'} w-5 h-5 rounded-full bg-white transition-all`} />
      </button>
    </label>
  )
}

function Row({ label, value, multiline }) {
  return (
    <div className={`flex ${multiline ? 'flex-col gap-1' : 'justify-between gap-3'} py-2 border-b border-navy-700/40 last:border-0`}>
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-gray-200 whitespace-pre-wrap">{value}</span>
    </div>
  )
}

function StockBadge({ status }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${stockTone(status)}`}>{stockLabel(status)}</span>
}

function PhotoThumb({ url, size = 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-16 h-16'
  if (!url) {
    return <div className={`${dim} rounded-lg bg-navy-900/60 border border-navy-700/60 flex items-center justify-center text-gray-500 text-xs`}>No photo</div>
  }
  return <img src={url} alt="" className={`${dim} rounded-lg object-cover border border-navy-700/60`} />
}

// ---------- main page ----------
export default function OperationsInventory() {
  const { client } = useCrmClient()
  const [items, setItems] = useState([])
  const [crews, setCrews] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [view, setView] = useState('grid')

  const [showNew, setShowNew] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [drawerItem, setDrawerItem] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true); setErr(null)
    try {
      const [iRes, cRes] = await Promise.all([
        client.from('ops_inventory').select('*').order('name'),
        client.from('ops_crews').select('id, name, color').order('name'),
      ])
      if (iRes.error) throw iRes.error
      if (cRes.error) throw cRes.error
      setItems(iRes.data || [])
      setCrews(cRes.data || [])
    } catch (e) {
      setErr(e.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [client])

  const categories = useMemo(() => {
    const set = new Set()
    for (const i of items) if (i.category) set.add(i.category)
    return Array.from(set).sort()
  }, [items])

  const crewLookup = useMemo(() => {
    const map = {}
    for (const c of crews) map[c.id] = c
    return map
  }, [crews])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = items.filter(i => {
      if (categoryFilter && i.category !== categoryFilter) return false
      const s = stockStatus(i)
      if (statusFilter !== 'all' && s !== statusFilter) return false
      if (!q) return true
      return (
        (i.name || '').toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        (i.supplier_name || '').toLowerCase().includes(q)
      )
    })
    list.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [items, search, categoryFilter, statusFilter, sortKey, sortDir])

  const stats = useMemo(() => {
    const total = items.length
    let low = 0
    let pendingReorder = 0
    let value = 0
    for (const i of items) {
      const s = stockStatus(i)
      if (s === 'low' || s === 'out') low++
      if ((s === 'low' || s === 'out') && i.reorder_url) pendingReorder++
      value += Number(i.quantity || 0) * Number(i.unit_cost || 0)
    }
    return { total, low, value, pendingReorder }
  }, [items])

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <HubPage
      title="Inventory"
      subtitle="Parts, materials, tools, and equipment - tracked across crews and storage locations"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdjust(true)}
            className="px-4 py-2 rounded-lg bg-navy-700 text-gray-200 text-sm font-semibold hover:bg-navy-600"
          >
            Adjust Stock
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 text-sm font-semibold hover:bg-brand-cyan/90"
          >
            + New Item
          </button>
        </div>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total SKUs" value={stats.total.toLocaleString()} accent="text-white" />
        <StatCard label="Low Stock" value={stats.low} accent={stats.low > 0 ? 'text-amber-300' : 'text-white'} />
        <StatCard label="Inventory Value" value={fmtMoney(stats.value)} accent="text-brand-cyan" />
        <StatCard label="Pending Reorders" value={stats.pendingReorder} accent={stats.pendingReorder > 0 ? 'text-amber-300' : 'text-white'} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU, or supplier..."
          className="flex-1 bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center bg-navy-900/60 border border-navy-700/60 rounded-lg p-1 self-start">
          {['grid', 'table'].map(v => (
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

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {STATUS_FILTERS.map(s => (
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

      {err && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-sm text-red-300">{err}</div>
      )}

      {/* Body */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading inventory...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? 'No inventory yet' : 'No items match filters'}
          description={items.length === 0 ? 'Add your first SKU - parts, materials, or equipment.' : 'Try clearing search or category filter.'}
          cta={items.length === 0 ? (
            <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 text-sm font-semibold hover:bg-brand-cyan/90">+ New Item</button>
          ) : null}
        />
      ) : view === 'table' ? (
        <InventoryTable
          items={filtered}
          crewLookup={crewLookup}
          onPick={setDrawerItem}
          sortKey={sortKey}
          sortDir={sortDir}
          toggleSort={toggleSort}
        />
      ) : (
        <InventoryGrid items={filtered} crewLookup={crewLookup} onPick={setDrawerItem} />
      )}

      <NewItemModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSaved={() => { setShowNew(false); load() }}
        client={client}
        crews={crews}
        existingCategories={categories}
      />

      <AdjustStockModal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        onSaved={() => { setShowAdjust(false); load() }}
        client={client}
        items={items}
        crews={crews}
      />

      <ItemDrawer
        open={!!drawerItem}
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        onSaved={() => { load() }}
        client={client}
        crews={crews}
      />
    </HubPage>
  )
}

// ---------- grid view ----------
function InventoryGrid({ items, crewLookup, onPick }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map(i => {
        const s = stockStatus(i)
        const crew = i.assigned_crew_id ? crewLookup[i.assigned_crew_id] : null
        return (
          <button
            key={i.id}
            onClick={() => onPick(i)}
            className="text-left bg-navy-800 border border-navy-700/60 rounded-xl overflow-hidden hover:border-brand-cyan/60 transition-colors flex flex-col"
          >
            <div className="h-32 bg-navy-900/60 border-b border-navy-700/60 flex items-center justify-center">
              {i.photo_url ? (
                <img src={i.photo_url} alt={i.name} className="w-full h-full object-cover" />
              ) : (
                <div className="text-gray-500 text-xs">No photo</div>
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-white text-sm font-semibold truncate">{i.name || 'Unnamed item'}</div>
                <StockBadge status={s} />
              </div>
              <div className="text-xs text-gray-500 mb-2 font-mono">{i.sku || '-'}</div>
              {i.category && (
                <span className="self-start px-2 py-0.5 rounded-full text-[10px] bg-navy-700/70 text-gray-300 border border-navy-600/60 mb-2">
                  {i.category}
                </span>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-2 border-t border-navy-700/40">
                <span>{Number(i.quantity || 0)} {i.unit || 'ea'}</span>
                <span className="truncate">{i.storage_location || '-'}</span>
              </div>
              {crew && (
                <div className="text-[10px] text-gray-500 mt-1 truncate">Crew: {crew.name}</div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------- table view ----------
function InventoryTable({ items, crewLookup, onPick, sortKey, sortDir, toggleSort }) {
  const Header = ({ k, label, align }) => (
    <th onClick={() => toggleSort(k)} className={`px-3 py-2 ${align || 'text-left'} cursor-pointer select-none`}>
      {label} {sortKey === k ? (sortDir === 'asc' ? '^' : 'v') : ''}
    </th>
  )
  return (
    <div className="overflow-x-auto rounded-xl border border-navy-700/60">
      <table className="w-full text-sm">
        <thead className="bg-navy-900/60 text-gray-400 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left w-14">Photo</th>
            <Header k="name" label="Name" />
            <Header k="sku" label="SKU" />
            <Header k="category" label="Category" />
            <Header k="quantity" label="Qty" align="text-right" />
            <Header k="min_quantity" label="Min" align="text-right" />
            <Header k="unit_cost" label="Unit Cost" align="text-right" />
            <Header k="sell_price" label="Sell" align="text-right" />
            <Header k="storage_location" label="Location" />
            <th className="px-3 py-2 text-left">Crew</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(i => {
            const s = stockStatus(i)
            const crew = i.assigned_crew_id ? crewLookup[i.assigned_crew_id] : null
            return (
              <tr
                key={i.id}
                onClick={() => onPick(i)}
                className="border-t border-navy-700/40 hover:bg-navy-700/30 cursor-pointer"
              >
                <td className="px-3 py-2"><PhotoThumb url={i.photo_url} size="sm" /></td>
                <td className="px-3 py-2 text-white truncate max-w-[200px]">{i.name}</td>
                <td className="px-3 py-2 text-gray-400 font-mono text-xs">{i.sku || '-'}</td>
                <td className="px-3 py-2 text-gray-300">{i.category || '-'}</td>
                <td className="px-3 py-2 text-right text-gray-200">{Number(i.quantity || 0)} <span className="text-xs text-gray-500">{i.unit || ''}</span></td>
                <td className="px-3 py-2 text-right text-gray-400">{i.min_quantity != null ? Number(i.min_quantity) : '-'}</td>
                <td className="px-3 py-2 text-right text-gray-300">{i.unit_cost != null ? fmtMoney(i.unit_cost) : '-'}</td>
                <td className="px-3 py-2 text-right text-gray-300">{i.sell_price != null ? fmtMoney(i.sell_price) : '-'}</td>
                <td className="px-3 py-2 text-gray-300 truncate max-w-[140px]">{i.storage_location || '-'}</td>
                <td className="px-3 py-2 text-gray-300 truncate max-w-[140px]">{crew ? crew.name : '-'}</td>
                <td className="px-3 py-2"><StockBadge status={s} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------- new item modal ----------
function NewItemModal({ open, onClose, onSaved, client, crews, existingCategories }) {
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (open) {
      setDraft({
        name: '', sku: '', category: '', description: '',
        quantity: 0, min_quantity: '', max_quantity: '',
        unit: 'ea', unit_cost: '', sell_price: '',
        storage_location: '', assigned_crew_id: '',
        serial_number: '', condition: 'new',
        supplier_name: '', reorder_url: '',
      })
      setErr(null); setSaving(false)
    }
  }, [open])

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  async function save() {
    if (!client) return
    if (!draft.name?.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr(null)
    try {
      const { error } = await client.from('ops_inventory').insert({
        name: draft.name.trim(),
        sku: draft.sku?.trim() || null,
        category: draft.category?.trim() || null,
        description: draft.description?.trim() || null,
        quantity: draft.quantity ? Number(draft.quantity) : 0,
        min_quantity: draft.min_quantity ? Number(draft.min_quantity) : null,
        max_quantity: draft.max_quantity ? Number(draft.max_quantity) : null,
        unit: draft.unit || 'ea',
        unit_cost: draft.unit_cost ? Number(draft.unit_cost) : null,
        sell_price: draft.sell_price ? Number(draft.sell_price) : null,
        storage_location: draft.storage_location?.trim() || null,
        assigned_crew_id: draft.assigned_crew_id || null,
        serial_number: draft.serial_number?.trim() || null,
        condition: draft.condition || 'new',
        supplier_name: draft.supplier_name?.trim() || null,
        reorder_url: draft.reorder_url?.trim() || null,
        is_active: true,
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
      title="New Inventory Item"
      wide
      footer={
        <div className="flex items-center justify-between">
          {err ? <span className="text-xs text-red-300">{err}</span> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-navy-700 text-gray-200 hover:bg-navy-600">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save item'}</button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="Name" value={draft.name} onChange={(v) => set('name', v)} placeholder="1/2 in. PVC elbow" />
        <Input label="SKU" value={draft.sku} onChange={(v) => set('sku', v)} placeholder="PVC-EL-050" />
        <div>
          <label className="block mb-3">
            <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Category</span>
            <input
              type="text"
              list="cat-options"
              value={draft.category || ''}
              onChange={(e) => set('category', e.target.value)}
              placeholder="Plumbing"
              className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
            />
            <datalist id="cat-options">
              {existingCategories.map(c => <option key={c} value={c} />)}
            </datalist>
          </label>
        </div>
        <Select label="Unit" value={draft.unit} onChange={(v) => set('unit', v)} allowBlank={false} options={UNITS.map(u => ({ value: u, label: u }))} />
        <Input label="Quantity" type="number" value={draft.quantity} onChange={(v) => set('quantity', v)} />
        <Input label="Min Quantity" type="number" value={draft.min_quantity} onChange={(v) => set('min_quantity', v)} />
        <Input label="Max Quantity" type="number" value={draft.max_quantity} onChange={(v) => set('max_quantity', v)} />
        <Input label="Unit Cost" type="number" value={draft.unit_cost} onChange={(v) => set('unit_cost', v)} />
        <Input label="Sell Price" type="number" value={draft.sell_price} onChange={(v) => set('sell_price', v)} />
        <Input label="Storage Location" value={draft.storage_location} onChange={(v) => set('storage_location', v)} placeholder="Warehouse A, bin 12" />
        <Select label="Assigned Crew" value={draft.assigned_crew_id} onChange={(v) => set('assigned_crew_id', v)} options={crews.map(c => ({ value: c.id, label: c.name }))} />
        <Input label="Serial Number" value={draft.serial_number} onChange={(v) => set('serial_number', v)} />
        <Select label="Condition" value={draft.condition} onChange={(v) => set('condition', v)} allowBlank={false} options={CONDITIONS.map(c => ({ value: c.key, label: c.label }))} />
        <Input label="Supplier" value={draft.supplier_name} onChange={(v) => set('supplier_name', v)} />
        <Input label="Reorder URL" value={draft.reorder_url} onChange={(v) => set('reorder_url', v)} placeholder="https://..." />
      </div>
      <Input label="Description" value={draft.description} onChange={(v) => set('description', v)} rows={2} />
    </Modal>
  )
}

// ---------- adjust stock modal ----------
function AdjustStockModal({ open, onClose, onSaved, client, items, crews }) {
  const [itemId, setItemId] = useState('')
  const [txType, setTxType] = useState('restock')
  const [qty, setQty] = useState('')
  const [direction, setDirection] = useState('+') // for transfer/adjust UI
  const [unitCost, setUnitCost] = useState('')
  const [workOrderId, setWorkOrderId] = useState('')
  const [crewId, setCrewId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (open) {
      setItemId(''); setTxType('restock'); setQty(''); setDirection('+')
      setUnitCost(''); setWorkOrderId(''); setCrewId(''); setNotes('')
      setErr(null); setSaving(false)
    }
  }, [open])

  // auto-fill unit cost from item
  useEffect(() => {
    if (itemId) {
      const it = items.find(x => x.id === itemId)
      if (it && it.unit_cost != null) setUnitCost(String(it.unit_cost))
    }
  }, [itemId, items])

  const txDef = TX_TYPES.find(t => t.key === txType) || TX_TYPES[0]
  const needsDirection = txDef.sign === 0 // adjust/transfer

  async function save() {
    if (!client) return
    if (!itemId) { setErr('Pick an item'); return }
    if (!qty || Number(qty) <= 0) { setErr('Quantity must be > 0'); return }
    setSaving(true); setErr(null)
    try {
      const item = items.find(x => x.id === itemId)
      if (!item) throw new Error('Item not found')
      const signedQty = (needsDirection ? (direction === '+' ? +1 : -1) : txDef.sign) * Number(qty)
      const newQty = Number(item.quantity || 0) + signedQty

      // Log transaction
      const { error: txErr } = await client.from('ops_inventory_transactions').insert({
        inventory_id: itemId,
        transaction_type: txType,
        quantity: signedQty,
        unit_cost: unitCost ? Number(unitCost) : null,
        work_order_id: workOrderId || null,
        crew_id: crewId || null,
        notes: notes?.trim() || null,
      })
      if (txErr) throw txErr

      // Update inventory.quantity
      const { error: upErr } = await client.from('ops_inventory').update({ quantity: newQty }).eq('id', itemId)
      if (upErr) throw upErr

      onSaved()
    } catch (e) {
      setErr(e.message || 'Adjustment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust Stock"
      footer={
        <div className="flex items-center justify-between">
          {err ? <span className="text-xs text-red-300">{err}</span> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-navy-700 text-gray-200 hover:bg-navy-600">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Log adjustment'}</button>
          </div>
        </div>
      }
    >
      <Select label="Item" value={itemId} onChange={setItemId} options={items.map(i => ({ value: i.id, label: (i.sku ? i.sku + ' - ' : '') + (i.name || 'Unnamed') }))} />
      <Select label="Transaction Type" value={txType} onChange={setTxType} allowBlank={false} options={TX_TYPES.map(t => ({ value: t.key, label: t.label }))} />

      {needsDirection && (
        <div className="mb-3">
          <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Direction</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDirection('+')} className={`px-4 py-2 text-sm rounded-lg border ${direction === '+' ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200' : 'bg-navy-800 border-navy-700/60 text-gray-300'}`}>+ Add</button>
            <button type="button" onClick={() => setDirection('-')} className={`px-4 py-2 text-sm rounded-lg border ${direction === '-' ? 'bg-red-500/20 border-red-500/60 text-red-200' : 'bg-navy-800 border-navy-700/60 text-gray-300'}`}>- Remove</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="Quantity (absolute)" type="number" value={qty} onChange={setQty} placeholder="10" />
        <Input label="Unit Cost (optional)" type="number" value={unitCost} onChange={setUnitCost} />
        <Input label="Work Order ID (optional)" value={workOrderId} onChange={setWorkOrderId} placeholder="UUID" />
        <Select label="Crew (optional)" value={crewId} onChange={setCrewId} options={crews.map(c => ({ value: c.id, label: c.name }))} />
      </div>
      <Input label="Notes" value={notes} onChange={setNotes} rows={2} />
    </Modal>
  )
}

// ---------- item drawer ----------
function ItemDrawer({ open, item, onClose, onSaved, client, crews }) {
  const [tab, setTab] = useState('overview')
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loadingTx, setLoadingTx] = useState(false)
  const [confirmUrl, setConfirmUrl] = useState(null)

  useEffect(() => {
    if (item) {
      setDraft({ ...item })
      setTab('overview')
      setErr(null)
    }
  }, [item?.id])

  useEffect(() => {
    if (!item || !client) return
    if (tab === 'transactions') {
      setLoadingTx(true)
      client.from('ops_inventory_transactions')
        .select('*')
        .eq('inventory_id', item.id)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(res => {
          if (!res.error) setTransactions(res.data || [])
          setLoadingTx(false)
        })
    }
  }, [tab, item?.id, client])

  if (!item) return null

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  async function save() {
    if (!client) return
    setSaving(true); setErr(null)
    try {
      const { error } = await client.from('ops_inventory').update({
        name: draft.name,
        sku: draft.sku || null,
        category: draft.category || null,
        description: draft.description || null,
        quantity: draft.quantity != null && draft.quantity !== '' ? Number(draft.quantity) : 0,
        min_quantity: draft.min_quantity != null && draft.min_quantity !== '' ? Number(draft.min_quantity) : null,
        max_quantity: draft.max_quantity != null && draft.max_quantity !== '' ? Number(draft.max_quantity) : null,
        unit: draft.unit || 'ea',
        unit_cost: draft.unit_cost != null && draft.unit_cost !== '' ? Number(draft.unit_cost) : null,
        sell_price: draft.sell_price != null && draft.sell_price !== '' ? Number(draft.sell_price) : null,
        storage_location: draft.storage_location || null,
        assigned_crew_id: draft.assigned_crew_id || null,
        serial_number: draft.serial_number || null,
        condition: draft.condition || 'good',
        last_inspected: draft.last_inspected || null,
        warranty_expiry: draft.warranty_expiry || null,
        photo_url: draft.photo_url || null,
        is_active: !!draft.is_active,
      }).eq('id', item.id)
      if (error) throw error
      onSaved()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveReorderTab() {
    if (!client) return
    setSaving(true); setErr(null)
    try {
      const { error } = await client.from('ops_inventory').update({
        supplier_name: draft.supplier_name || null,
        supplier_contact: draft.supplier_contact || null,
        supplier_part_number: draft.supplier_part_number || null,
        reorder_url: draft.reorder_url || null,
      }).eq('id', item.id)
      if (error) throw error
      onSaved()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const status = stockStatus(draft)

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={
          <div className="flex items-center gap-3 min-w-0">
            <PhotoThumb url={draft.photo_url} size="sm" />
            <div className="min-w-0">
              <div className="text-white font-semibold truncate">{draft.name || 'Unnamed item'}</div>
              <div className="text-xs text-gray-400 font-mono truncate">{draft.sku || '-'}</div>
            </div>
            <div className="ml-2"><StockBadge status={status} /></div>
          </div>
        }
        footer={tab === 'overview' || tab === 'reorder' ? (
          <div className="flex items-center justify-between">
            {err ? <span className="text-xs text-red-300">{err}</span> : <span />}
            <button
              onClick={tab === 'overview' ? save : saveReorderTab}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        ) : null}
      >
        <div className="flex items-center gap-1 mb-4 border-b border-navy-700/50 overflow-x-auto">
          {[
            { key: 'overview',     label: 'Overview' },
            { key: 'transactions', label: 'Transactions' },
            { key: 'reorder',      label: 'Reorder' },
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Input label="Name" value={draft.name} onChange={(v) => set('name', v)} />
              <Input label="SKU" value={draft.sku} onChange={(v) => set('sku', v)} />
              <Input label="Category" value={draft.category} onChange={(v) => set('category', v)} />
              <Select label="Unit" value={draft.unit} onChange={(v) => set('unit', v)} allowBlank={false} options={UNITS.map(u => ({ value: u, label: u }))} />
              <Input label="Quantity" type="number" value={draft.quantity} onChange={(v) => set('quantity', v)} />
              <Input label="Min Quantity" type="number" value={draft.min_quantity} onChange={(v) => set('min_quantity', v)} />
              <Input label="Max Quantity" type="number" value={draft.max_quantity} onChange={(v) => set('max_quantity', v)} />
              <Input label="Unit Cost" type="number" value={draft.unit_cost} onChange={(v) => set('unit_cost', v)} />
              <Input label="Sell Price" type="number" value={draft.sell_price} onChange={(v) => set('sell_price', v)} />
              <Input label="Storage Location" value={draft.storage_location} onChange={(v) => set('storage_location', v)} />
              <Select label="Assigned Crew" value={draft.assigned_crew_id} onChange={(v) => set('assigned_crew_id', v)} options={crews.map(c => ({ value: c.id, label: c.name }))} />
              <Input label="Serial Number" value={draft.serial_number} onChange={(v) => set('serial_number', v)} />
              <Select label="Condition" value={draft.condition} onChange={(v) => set('condition', v)} allowBlank={false} options={CONDITIONS.map(c => ({ value: c.key, label: c.label }))} />
              <Input label="Last Inspected" type="date" value={(draft.last_inspected || '').slice(0,10)} onChange={(v) => set('last_inspected', v)} />
              <Input label="Warranty Expiry" type="date" value={(draft.warranty_expiry || '').slice(0,10)} onChange={(v) => set('warranty_expiry', v)} />
              <Input label="Photo URL" value={draft.photo_url} onChange={(v) => set('photo_url', v)} placeholder="https://..." />
            </div>
            <Input label="Description" value={draft.description} onChange={(v) => set('description', v)} rows={3} />
            <Toggle label="Active" value={!!draft.is_active} onChange={(v) => set('is_active', v)} />

            <Section title="Computed">
              <Row label="Status" value={stockLabel(status)} />
              <Row label="Total Value" value={fmtMoney(Number(draft.quantity || 0) * Number(draft.unit_cost || 0))} />
              <Row label="Created" value={fmtDate(item.created_at)} />
              <Row label="Updated" value={fmtDateTime(item.updated_at)} />
            </Section>
          </div>
        )}

        {tab === 'transactions' && (
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Last 50 transactions</div>
            {loadingTx ? (
              <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No transactions yet. Use Adjust Stock to log one.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-navy-700/60">
                <table className="w-full text-xs">
                  <thead className="bg-navy-900/60 text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Unit Cost</th>
                      <th className="px-2 py-2 text-left">WO / Crew</th>
                      <th className="px-2 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr key={t.id} className="border-t border-navy-700/40">
                        <td className="px-2 py-2 text-gray-300 whitespace-nowrap">{fmtDateTime(t.created_at)}</td>
                        <td className="px-2 py-2 text-gray-300 capitalize">{t.transaction_type}</td>
                        <td className={`px-2 py-2 text-right ${Number(t.quantity) > 0 ? 'text-emerald-300' : 'text-red-300'}`}>{Number(t.quantity) > 0 ? '+' : ''}{Number(t.quantity)}</td>
                        <td className="px-2 py-2 text-right text-gray-300">{t.unit_cost != null ? fmtMoney(t.unit_cost) : '-'}</td>
                        <td className="px-2 py-2 text-gray-400 truncate max-w-[120px]">{t.work_order_id ? 'WO' : ''} {t.crew_id ? 'Crew' : ''}</td>
                        <td className="px-2 py-2 text-gray-300 truncate max-w-[200px]">{t.notes || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'reorder' && (
          <div>
            <Input label="Supplier Name" value={draft.supplier_name} onChange={(v) => set('supplier_name', v)} />
            <Input label="Supplier Contact" value={draft.supplier_contact} onChange={(v) => set('supplier_contact', v)} placeholder="phone or email" />
            <Input label="Supplier Part Number" value={draft.supplier_part_number} onChange={(v) => set('supplier_part_number', v)} />
            <Input label="Reorder URL" value={draft.reorder_url} onChange={(v) => set('reorder_url', v)} placeholder="https://..." />

            {draft.reorder_url && (
              <div className="mt-2 p-3 rounded-lg bg-navy-900/40 border border-navy-700/60">
                <div className="text-xs text-gray-400 mb-2">Reorder link</div>
                <button
                  onClick={() => setConfirmUrl(draft.reorder_url)}
                  className="text-sm text-brand-cyan hover:underline truncate w-full text-left"
                >
                  {draft.reorder_url}
                </button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={!!confirmUrl}
        onClose={() => setConfirmUrl(null)}
        title="Open external link?"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmUrl(null)} className="px-4 py-2 text-sm rounded-lg bg-navy-700 text-gray-200 hover:bg-navy-600">Cancel</button>
            <a
              href={confirmUrl || '#'}
              target="_blank"
              rel="noreferrer"
              onClick={() => setConfirmUrl(null)}
              className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold"
            >
              Open in new tab
            </a>
          </div>
        }
      >
        <div className="text-sm text-gray-300 break-all">{confirmUrl}</div>
        <div className="text-xs text-gray-500 mt-2">This link will open in a new tab.</div>
      </Modal>
    </>
  )
}
