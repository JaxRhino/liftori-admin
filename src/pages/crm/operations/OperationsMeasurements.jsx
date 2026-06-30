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
const TEMPLATES = [
  { key: 'sqft',       label: 'Sq Ft',       defaultUnit: 'sqft' },
  { key: 'linear-ft',  label: 'Linear Ft',   defaultUnit: 'lft' },
  { key: 'cu-yd',      label: 'Cu Yd',       defaultUnit: 'cyd' },
  { key: 'custom',     label: 'Custom',      defaultUnit: 'ea' },
]

const STATUSES = [
  { key: 'draft',    label: 'Draft',    tone: 'bg-navy-700/60 text-gray-300 border-navy-600/60' },
  { key: 'measured', label: 'Measured', tone: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  { key: 'approved', label: 'Approved', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
]

const UNITS = ['sqft', 'sqm', 'lft', 'lm', 'cyd', 'cum', 'ea', 'in', 'ft', 'm']

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

function StatusBadge({ status }) {
  const s = STATUSES.find(x => x.key === status) || STATUSES[0]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${s.tone}`}>{s.label}</span>
}

function TemplateBadge({ template }) {
  const t = TEMPLATES.find(x => x.key === template) || TEMPLATES[0]
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40">
      {t.label}
    </span>
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

// ---------- helpers ----------
function asArray(v) {
  if (Array.isArray(v)) return v
  if (v == null) return []
  try {
    const parsed = typeof v === 'string' ? JSON.parse(v) : v
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function computeSummary(lines) {
  const totalsByUnit = {}
  let totalLines = 0
  for (const l of lines) {
    if (!l || l.value == null || l.value === '') continue
    const n = Number(l.value)
    if (!isFinite(n)) continue
    const u = (l.unit || 'ea').toLowerCase()
    totalsByUnit[u] = (totalsByUnit[u] || 0) + n
    totalLines++
  }
  return { totals: totalsByUnit, count: totalLines }
}

function summaryToString(summary) {
  if (!summary || !summary.totals) return ''
  const parts = []
  for (const [u, v] of Object.entries(summary.totals)) {
    parts.push(Number(v).toLocaleString() + ' ' + u)
  }
  return parts.join(' / ')
}

// ---------- main page ----------
export default function OperationsMeasurements() {
  const { client } = useCrmClient()
  const [rows, setRows] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [search, setSearch] = useState('')
  const [templateFilter, setTemplateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [showNew, setShowNew] = useState(false)
  const [drawerRow, setDrawerRow] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true); setErr(null)
    try {
      const { data: pdefs } = await client.from('pipeline_definitions').select('id,name,is_default,is_active').eq('is_active', true).order('display_order')
      const pdl = pdefs || []
      const jpipe = pdl.find(d => /job|operation|production|install/i.test(d.name || '')) || pdl.find(d => !d.is_default) || pdl[0] || null
      let wq = client.from('customer_pipeline').select('id, title').order('title')
      if (jpipe) wq = wq.eq('pipeline_definition_id', jpipe.id)
      const [mRes, wRes, cRes] = await Promise.all([
        client.from('ops_measurements').select('*').order('created_at', { ascending: false }),
        wq,
        client.from('customer_contacts').select('id, name').order('name').limit(500),
      ])
      if (mRes.error) throw mRes.error
      // tolerate missing WO/contacts tables in case tenant hasn't migrated
      setRows(mRes.data || [])
      setWorkOrders(wRes.error ? [] : (wRes.data || []))
      setContacts(cRes.error ? [] : (cRes.data || []))
    } catch (e) {
      setErr(e.message || 'Failed to load measurements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [client])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (templateFilter !== 'all' && r.template_type !== templateFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return (
        (r.title || '').toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, templateFilter, statusFilter])

  const stats = useMemo(() => {
    const total = rows.length
    const draft = rows.filter(r => r.status === 'draft').length
    const measured = rows.filter(r => r.status === 'measured').length
    const approved = rows.filter(r => r.status === 'approved').length
    return { total, draft, measured, approved }
  }, [rows])

  return (
    <HubPage
      title="Measurements"
      subtitle="Field measurement templates - sq ft, linear ft, cubic yd, custom - with photos and sketches"
      actions={
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 text-sm font-semibold hover:bg-brand-cyan/90"
        >
          + New Measurement
        </button>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total" value={stats.total.toLocaleString()} accent="text-white" />
        <StatCard label="Draft" value={stats.draft} accent="text-gray-300" />
        <StatCard label="Measured" value={stats.measured} accent="text-sky-300" />
        <StatCard label="Approved" value={stats.approved} accent="text-emerald-300" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or address..."
          className="flex-1 bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {[{ key: 'all', label: 'All' }, ...TEMPLATES].map(t => (
            <button
              key={t.key}
              onClick={() => setTemplateFilter(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                templateFilter === t.key
                  ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan'
                  : 'bg-navy-800 border-navy-700/60 text-gray-300 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {[{ key: 'all', label: 'All Statuses' }, ...STATUSES].map(s => (
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

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading measurements...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'No measurements yet' : 'No measurements match filters'}
          description={rows.length === 0 ? 'Capture a new field measurement to get started.' : 'Try clearing filters.'}
          cta={rows.length === 0 ? (
            <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 text-sm font-semibold hover:bg-brand-cyan/90">+ New Measurement</button>
          ) : null}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(r => {
            const photos = asArray(r.photos)
            const summary = r.summary && typeof r.summary === 'object' ? r.summary : computeSummary(asArray(r.measurements))
            return (
              <button
                key={r.id}
                onClick={() => setDrawerRow(r)}
                className="text-left bg-navy-800 border border-navy-700/60 rounded-xl p-4 hover:border-brand-cyan/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-semibold truncate mr-2">{r.title || 'Untitled'}</div>
                  <div className="flex gap-2 shrink-0">
                    <TemplateBadge template={r.template_type} />
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-2 truncate">{r.address || 'No address'}</div>
                <div className="text-sm text-gray-200 mb-2">{summaryToString(summary) || 'No measurements yet'}</div>
                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-navy-700/40 pt-2">
                  <span>{photos.length} photo{photos.length === 1 ? '' : 's'}{r.sketch_url ? ' / sketch' : ''}</span>
                  <span>{r.measured_at ? relTime(r.measured_at) : 'never measured'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <NewMeasurementModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSaved={() => { setShowNew(false); load() }}
        client={client}
        workOrders={workOrders}
        contacts={contacts}
      />

      <MeasurementDrawer
        open={!!drawerRow}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        onSaved={() => { load() }}
        client={client}
      />
    </HubPage>
  )
}

// ---------- new measurement modal ----------
function NewMeasurementModal({ open, onClose, onSaved, client, workOrders, contacts }) {
  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState('sqft')
  const [address, setAddress] = useState('')
  const [woId, setWoId] = useState('')
  const [contactId, setContactId] = useState('')
  const [notes, setNotes] = useState('')
  const [conditions, setConditions] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (open) {
      setTitle(''); setTemplate('sqft'); setAddress('')
      setWoId(''); setContactId(''); setNotes(''); setConditions('')
      setErr(null); setSaving(false)
    }
  }, [open])

  async function save() {
    if (!client) return
    if (!title.trim()) { setErr('Title is required'); return }
    setSaving(true); setErr(null)
    try {
      const userRes = await client.auth.getUser()
      const uid = userRes?.data?.user?.id || null
      const { error } = await client.from('ops_measurements').insert({
        title: title.trim(),
        template_type: template,
        status: 'draft',
        address: address.trim() || null,
        pipeline_id: woId || null,
        contact_id: contactId || null,
        notes: notes.trim() || null,
        conditions: conditions.trim() || null,
        measurements: [],
        summary: { totals: {}, count: 0 },
        photos: [],
        diagrams: [],
        measured_by: uid,
        measured_at: new Date().toISOString(),
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
      title="New Measurement"
      wide
      footer={
        <div className="flex items-center justify-between">
          {err ? <span className="text-xs text-red-300">{err}</span> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-navy-700 text-gray-200 hover:bg-navy-600">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Create draft'}</button>
          </div>
        </div>
      }
    >
      <Input label="Title" value={title} onChange={setTitle} placeholder="Smith driveway sealcoat" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Select label="Template" value={template} onChange={setTemplate} allowBlank={false} options={TEMPLATES.map(t => ({ value: t.key, label: t.label }))} />
        <Input label="Address" value={address} onChange={setAddress} placeholder="123 Main St" />
        <Select label="Linked Job" value={woId} onChange={setWoId} options={workOrders.map(w => ({ value: w.id, label: w.title || 'Job' }))} />
        <Select label="Contact" value={contactId} onChange={setContactId} options={contacts.map(c => ({ value: c.id, label: c.name }))} />
      </div>
      <Input label="Notes" value={notes} onChange={setNotes} rows={2} />
      <Input label="Site Conditions" value={conditions} onChange={setConditions} rows={2} placeholder="Weather, access notes, hazards..." />
    </Modal>
  )
}

// ---------- measurement drawer ----------
function MeasurementDrawer({ open, row, onClose, onSaved, client }) {
  const [tab, setTab] = useState('measurements')
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (row) {
      setDraft({
        ...row,
        measurements: asArray(row.measurements),
        photos: asArray(row.photos),
        diagrams: asArray(row.diagrams),
      })
      setTab('measurements')
      setErr(null)
    }
  }, [row?.id])

  if (!row) return null

  const lines = draft.measurements || []
  const summary = computeSummary(lines)
  const defaultUnit = (TEMPLATES.find(t => t.key === draft.template_type) || TEMPLATES[0]).defaultUnit

  function addLine() {
    const next = [...lines, { label: '', value: '', unit: defaultUnit }]
    setDraft(d => ({ ...d, measurements: next }))
  }

  function updateLine(idx, key, val) {
    const next = lines.map((l, i) => i === idx ? { ...l, [key]: val } : l)
    setDraft(d => ({ ...d, measurements: next }))
  }

  function removeLine(idx) {
    const next = lines.filter((_, i) => i !== idx)
    setDraft(d => ({ ...d, measurements: next }))
  }

  async function saveMeasurements() {
    if (!client) return
    setSaving(true); setErr(null)
    try {
      const cleanLines = lines.map(l => ({
        label: (l.label || '').trim(),
        value: l.value === '' || l.value == null ? null : Number(l.value),
        unit: (l.unit || defaultUnit).toLowerCase(),
      }))
      const finalSummary = computeSummary(cleanLines)
      const nextStatus = (draft.status === 'draft' && finalSummary.count > 0) ? 'measured' : draft.status
      const { error } = await client.from('ops_measurements').update({
        measurements: cleanLines,
        summary: finalSummary,
        status: nextStatus,
        measured_at: new Date().toISOString(),
      }).eq('id', row.id)
      if (error) throw error
      setDraft(d => ({ ...d, measurements: cleanLines, summary: finalSummary, status: nextStatus }))
      onSaved()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveNotes() {
    if (!client) return
    setSaving(true); setErr(null)
    try {
      const { error } = await client.from('ops_measurements').update({
        notes: draft.notes || null,
        conditions: draft.conditions || null,
      }).eq('id', row.id)
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
      const { error } = await client.from('ops_measurements').update({ status: v }).eq('id', row.id)
      if (error) throw error
      setDraft(d => ({ ...d, status: v }))
      onSaved()
    } catch (e) {
      setErr(e.message || 'Status update failed')
    }
  }

  async function approve() {
    if (!client) return
    if ((draft.measurements || []).length === 0) {
      setErr('Add at least one measurement line before approving.')
      return
    }
    setSaving(true); setErr(null)
    try {
      const userRes = await client.auth.getUser()
      const uid = userRes?.data?.user?.id || null
      const { error } = await client.from('ops_measurements').update({
        status: 'approved',
        approved_by: uid,
        approved_at: new Date().toISOString(),
      }).eq('id', row.id)
      if (error) throw error
      setDraft(d => ({
        ...d,
        status: 'approved',
        approved_by: uid,
        approved_at: new Date().toISOString(),
      }))
      onSaved()
    } catch (e) {
      setErr(e.message || 'Approve failed')
    } finally {
      setSaving(false)
    }
  }

  const photos = draft.photos || []
  const diagrams = draft.diagrams || []

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-white font-semibold truncate">{draft.title || 'Untitled'}</div>
          <div className="ml-2">
            <select
              value={draft.status || 'draft'}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-navy-900/60 border border-navy-700/60 rounded-md px-2 py-1 text-xs text-white"
            >
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
      }
      footer={
        tab === 'measurements' ? (
          <div className="flex items-center justify-between">
            {err ? <span className="text-xs text-red-300">{err}</span> : <span className="text-xs text-gray-400">{summary.count} line{summary.count === 1 ? '' : 's'} - totals: {summaryToString(summary) || '-'}</span>}
            <button onClick={saveMeasurements} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save measurements'}</button>
          </div>
        ) : tab === 'notes' ? (
          <div className="flex items-center justify-between">
            {err ? <span className="text-xs text-red-300">{err}</span> : <span />}
            <button onClick={saveNotes} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save notes'}</button>
          </div>
        ) : null
      }
    >
      <div className="flex items-center gap-1 mb-4 border-b border-navy-700/50 overflow-x-auto">
        {[
          { key: 'measurements', label: 'Measurements' },
          { key: 'media',        label: 'Photos & Diagrams' },
          { key: 'notes',        label: 'Notes' },
          { key: 'approve',      label: 'Approve' },
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

      {tab === 'measurements' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Lines</div>
            <button onClick={addLine} className="px-3 py-1.5 text-xs rounded-lg bg-brand-cyan text-navy-900 font-semibold">+ Add Line</button>
          </div>
          {lines.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-navy-700/60 rounded-lg">
              No measurement lines yet. Click + Add Line to start.
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-navy-900/40 border border-navy-700/60 rounded-lg p-2">
                  <input
                    type="text"
                    value={l.label || ''}
                    onChange={(e) => updateLine(idx, 'label', e.target.value)}
                    placeholder="e.g. Front lawn, Section A, etc."
                    className="col-span-6 bg-navy-900/60 border border-navy-700/60 rounded-md px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
                  />
                  <input
                    type="number"
                    value={l.value ?? ''}
                    onChange={(e) => updateLine(idx, 'value', e.target.value)}
                    placeholder="0"
                    className="col-span-3 bg-navy-900/60 border border-navy-700/60 rounded-md px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan text-right"
                  />
                  <select
                    value={l.unit || defaultUnit}
                    onChange={(e) => updateLine(idx, 'unit', e.target.value)}
                    className="col-span-2 bg-navy-900/60 border border-navy-700/60 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:border-brand-cyan"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={() => removeLine(idx)} className="col-span-1 text-xs text-gray-400 hover:text-red-300">x</button>
                </div>
              ))}
            </div>
          )}
          <Section title="Live summary">
            <Row label="Lines" value={String(summary.count)} />
            <Row label="Totals" value={summaryToString(summary) || '-'} />
          </Section>
        </div>
      )}

      {tab === 'media' && (
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Photos & Diagrams</div>
          <div className="grid grid-cols-3 gap-3">
            {photos.map((p, idx) => {
              const url = typeof p === 'string' ? p : (p?.url || '')
              return (
                <div key={'p' + idx} className="aspect-square rounded-lg overflow-hidden bg-navy-900/60 border border-navy-700/60">
                  {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">photo</div>}
                </div>
              )
            })}
            {diagrams.map((d, idx) => {
              const url = typeof d === 'string' ? d : (d?.url || '')
              return (
                <div key={'d' + idx} className="aspect-square rounded-lg overflow-hidden bg-navy-900/60 border border-amber-500/30">
                  {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-amber-300">diagram</div>}
                </div>
              )
            })}
            {photos.length === 0 && diagrams.length === 0 && (
              <div className="col-span-3 py-8 text-center text-sm text-gray-400 border border-dashed border-navy-700/60 rounded-lg">No photos or diagrams attached yet.</div>
            )}
          </div>

          <div className="mt-4 p-3 rounded-lg bg-navy-900/40 border border-dashed border-navy-700/60 text-center">
            <div className="text-sm text-gray-300">Upload</div>
            <div className="text-xs text-gray-500 mt-1">Drag-drop / camera upload ships in Wave F.</div>
          </div>

          {draft.sketch_url && (
            <Section title="Sketch">
              <a href={draft.sketch_url} target="_blank" rel="noreferrer" className="text-sm text-brand-cyan hover:underline break-all">{draft.sketch_url}</a>
            </Section>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div>
          <Input label="Notes" value={draft.notes} onChange={(v) => setDraft(d => ({ ...d, notes: v }))} rows={6} placeholder="Free-form notes captured on-site..." />
          <Input label="Site Conditions" value={draft.conditions} onChange={(v) => setDraft(d => ({ ...d, conditions: v }))} rows={4} placeholder="Weather, terrain, access, hazards..." />
        </div>
      )}

      {tab === 'approve' && (
        <div>
          <Section title="Approval">
            <Row label="Current Status" value={(STATUSES.find(s => s.key === draft.status) || STATUSES[0]).label} />
            <Row label="Lines Captured" value={String((draft.measurements || []).length)} />
            <Row label="Approved By" value={draft.approved_by || '-'} />
            <Row label="Approved At" value={fmtDateTime(draft.approved_at)} />
          </Section>

          {draft.status === 'approved' ? (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-sm text-emerald-200">
              This measurement is approved and locked in.
            </div>
          ) : (
            <div className="mt-4">
              {err && <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-sm text-red-300">{err}</div>}
              <button
                onClick={approve}
                disabled={saving}
                className="w-full px-4 py-3 text-sm rounded-lg bg-emerald-500 text-navy-900 font-semibold disabled:opacity-50"
              >
                {saving ? 'Approving...' : 'Mark Approved'}
              </button>
              <div className="text-xs text-gray-500 mt-2 text-center">Requires at least one measurement line.</div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
