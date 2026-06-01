// =====================================================================
// EOSScorecard - Weekly metric grid (5-15 KPIs per tenant)
// Wave C.2.2
// Reads/writes: eos_scorecard_metrics + eos_scorecard_entries
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, EmptyState, useCrmClient } from '../_shared'

// ---------- formatters ----------
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '-'
const shortId = (id) => (id ? String(id).slice(0, 8) : '-')

function fmtValue(v, type) {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  switch (type) {
    case 'percent':  return `${n.toFixed(1)}%`
    case 'currency': return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    case 'ratio':    return n.toFixed(2)
    case 'duration': return `${n} min`
    default:         return n.toLocaleString('en-US')
  }
}

// ---------- week math (Sunday-anchored) ----------
function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}
function addWeeks(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n * 7)
  return d
}
function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}
function periodColumns(granularity, count) {
  const today = new Date()
  const start = granularity === 'weekly' ? startOfWeek(today) : new Date(today.getFullYear(), today.getMonth(), 1)
  const cols = []
  for (let i = count - 1; i >= 0; i--) {
    let d
    if (granularity === 'weekly')    d = addWeeks(start, -i)
    else if (granularity === 'monthly') d = addMonths(start, -i)
    else if (granularity === 'quarterly') d = addMonths(start, -i * 3)
    else /* yearly */                  d = addMonths(start, -i * 12)
    cols.push(d)
  }
  return cols
}

// ---------- constants ----------
const MEASUREMENT_TYPES = [
  { key: 'number',   label: '#', tone: 'text-brand-cyan' },
  { key: 'percent',  label: '%', tone: 'text-brand-blue' },
  { key: 'currency', label: '$', tone: 'text-emerald-400' },
  { key: 'ratio',    label: ':', tone: 'text-violet-400' },
  { key: 'duration', label: 't', tone: 'text-amber-400' },
]
const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly']

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
        <option value="">-</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        active ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan'
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
        active ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40'
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

function TypeBadge({ type }) {
  const t = MEASUREMENT_TYPES.find(x => x.key === type)
  if (!t) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700/60 text-gray-300">?</span>
  return <span className={`text-[10px] px-1.5 py-0.5 rounded bg-navy-700/60 ${t.tone} font-bold`}>{t.label}</span>
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function EOSScorecard() {
  const { client, platform } = useCrmClient()

  const [metrics, setMetrics] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [granularity, setGranularity] = useState('weekly')
  const [newOpen, setNewOpen] = useState(false)
  const [active, setActive] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      const [{ data: m, error: me }, { data: e, error: ee }] = await Promise.all([
        client.from('eos_scorecard_metrics').select('*').eq('is_active', true).order('display_order', { ascending: true }).limit(50),
        client.from('eos_scorecard_entries').select('*').order('period_date', { ascending: false }).limit(2000),
      ])
      if (me) throw me
      if (ee) throw ee
      setMetrics(m || [])
      setEntries(e || [])
    } catch (e) {
      console.error('[EOSScorecard] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  const columns = useMemo(() => periodColumns(granularity, 13), [granularity])

  // entries lookup map: metric_id -> period_iso (date only) -> entry
  const lookup = useMemo(() => {
    const map = new Map()
    for (const e of entries) {
      if (!e.metric_id || !e.period_date) continue
      const key = String(e.period_date).slice(0, 10)
      if (!map.has(e.metric_id)) map.set(e.metric_id, new Map())
      map.get(e.metric_id).set(key, e)
    }
    return map
  }, [entries])

  // ---- stats ----
  const stats = useMemo(() => {
    const activeCount = metrics.length
    const thisWeekKey = startOfWeek(new Date()).toISOString().slice(0, 10)
    let hit = 0, miss = 0
    let best = { name: '-', ratio: -Infinity }
    for (const m of metrics) {
      const e = lookup.get(m.id)?.get(thisWeekKey)
      if (!e) continue
      const goal = Number(m.goal)
      const val = Number(e.actual_value)
      if (Number.isNaN(goal) || Number.isNaN(val)) continue
      if (val >= goal) hit += 1
      else miss += 1
      const ratio = goal > 0 ? val / goal : 0
      if (ratio > best.ratio) { best = { name: m.name, ratio } }
    }
    return { activeCount, hit, miss, topPerformer: best.ratio === -Infinity ? '-' : best.name }
  }, [metrics, lookup])

  return (
    <HubPage
      title="Scorecard"
      subtitle={`Weekly KPIs${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
      actions={
        <button onClick={() => setNewOpen(true)} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium hover:brightness-110">
          + New Metric
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Active Metrics" value={stats.activeCount} />
        <StatCard label="Hit Goal (This Period)" value={stats.hit} accent="text-emerald-400" />
        <StatCard label="Missed Goal" value={stats.miss} accent="text-rose-400" />
        <StatCard label="Top Performer" value={stats.topPerformer} accent="text-brand-cyan" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Granularity</span>
        {FREQUENCIES.map(f => (
          <Chip key={f} active={f === granularity} onClick={() => setGranularity(f)}>{f}</Chip>
        ))}
      </div>

      {loading ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6 text-sm text-gray-500">Loading scorecard...</div>
      ) : metrics.length === 0 ? (
        <EmptyState
          title="No metrics yet"
          description="The EOS scorecard starts with 5-15 weekly KPIs. Add your first."
          cta={
            <button onClick={() => setNewOpen(true)} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + New Metric
            </button>
          }
        />
      ) : (
        <ScorecardGrid
          metrics={metrics}
          columns={columns}
          lookup={lookup}
          client={client}
          onChanged={load}
          onOpen={(m) => setActive(m)}
        />
      )}

      <NewMetricModal open={newOpen} onClose={() => setNewOpen(false)} client={client} onSaved={() => { setNewOpen(false); load() }} />
      <MetricDrawer metric={active} entries={entries.filter(e => e.metric_id === active?.id)} onClose={() => setActive(null)} client={client} onChanged={() => { setActive(null); load() }} />
    </HubPage>
  )
}

// ===========================================================================
//                                SCORECARD GRID
// ===========================================================================
function ScorecardGrid({ metrics, columns, lookup, client, onChanged, onOpen }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-900/60 border-b border-navy-700/50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider min-w-[240px] sticky left-0 bg-navy-900/60 z-10">Metric</th>
              <th className="px-3 py-2 text-right text-[11px] text-gray-400 uppercase tracking-wider w-[100px]">Goal</th>
              {columns.map((d, i) => (
                <th key={i} className="px-2 py-2 text-center text-[10px] text-gray-500 uppercase tracking-wider w-[64px]">
                  {shortDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => (
              <MetricRow
                key={m.id}
                metric={m}
                columns={columns}
                lookup={lookup}
                client={client}
                onChanged={onChanged}
                onOpen={onOpen}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricRow({ metric, columns, lookup, client, onChanged, onOpen }) {
  return (
    <tr className="border-b border-navy-700/30 hover:bg-navy-900/40">
      <td className="px-3 py-2 sticky left-0 bg-navy-800 z-10">
        <button onClick={() => onOpen(metric)} className="text-left w-full">
          <div className="flex items-center gap-2">
            <TypeBadge type={metric.measurement_type} />
            <span className="text-white text-sm font-medium truncate">{metric.name}</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Owner: {shortId(metric.owner_id)}{metric.department ? ` - ${metric.department}` : ''}</p>
        </button>
      </td>
      <td className="px-3 py-2 text-right text-brand-cyan font-medium">{fmtValue(metric.goal, metric.measurement_type)}</td>
      {columns.map((d, i) => {
        const key = d.toISOString().slice(0, 10)
        const entry = lookup.get(metric.id)?.get(key)
        return (
          <ScoreCell
            key={i}
            metric={metric}
            periodDate={d}
            entry={entry}
            client={client}
            onChanged={onChanged}
          />
        )
      })}
    </tr>
  )
}

function ScoreCell({ metric, periodDate, entry, client, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(entry?.actual_value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setVal(entry?.actual_value ?? '') }, [entry?.actual_value])

  const goal = Number(metric.goal)
  const thresholds = (metric.thresholds && typeof metric.thresholds === 'object') ? metric.thresholds : {}
  const numVal = entry?.actual_value === null || entry?.actual_value === undefined ? null : Number(entry.actual_value)

  let toneClass = 'text-gray-500'
  let bgClass = ''
  if (numVal !== null && !Number.isNaN(numVal)) {
    const green = Number(thresholds.green ?? goal)
    const yellow = Number(thresholds.yellow ?? goal * 0.8)
    if (!Number.isNaN(green) && numVal >= green) { toneClass = 'text-emerald-300'; bgClass = 'bg-emerald-500/10' }
    else if (!Number.isNaN(yellow) && numVal >= yellow) { toneClass = 'text-amber-300'; bgClass = 'bg-amber-500/10' }
    else { toneClass = 'text-rose-300'; bgClass = 'bg-rose-500/10' }
  }

  async function save() {
    if (!client) return
    const clean = val === '' ? null : Number(val)
    if (val !== '' && Number.isNaN(clean)) { setEditing(false); return }
    setSaving(true)
    try {
      const periodIso = periodDate.toISOString().slice(0, 10)
      const onTrack = clean !== null && !Number.isNaN(goal) && clean >= goal
      if (entry?.id) {
        const { error } = await client.from('eos_scorecard_entries').update({ actual_value: clean, on_track: onTrack }).eq('id', entry.id)
        if (error) throw error
      } else if (clean !== null) {
        const { error } = await client.from('eos_scorecard_entries').insert({
          metric_id: metric.id,
          period_date: periodIso,
          actual_value: clean,
          on_track: onTrack,
        })
        if (error) throw error
      }
      setEditing(false)
      onChanged?.()
    } catch (e) {
      console.error('[EOSScorecard] cell save', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <td className={`px-1 py-1 text-center w-[64px] ${bgClass}`}>
        <input
          autoFocus
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full bg-navy-900 border border-brand-cyan/60 rounded px-1 py-1 text-xs text-white text-center"
          disabled={saving}
        />
      </td>
    )
  }

  return (
    <td
      onClick={() => setEditing(true)}
      className={`px-1 py-2 text-center text-xs cursor-pointer hover:bg-navy-900/60 ${bgClass} ${toneClass}`}
    >
      {entry ? fmtValue(numVal, metric.measurement_type) : <span className="text-gray-600">-</span>}
    </td>
  )
}

// ===========================================================================
//                                NEW METRIC MODAL
// ===========================================================================
function NewMetricModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState(empty())
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm(empty()) }, [open])

  function empty() {
    return {
      name: '',
      description: '',
      owner_id: '',
      department: '',
      category: '',
      measurement_type: 'number',
      measurement_frequency: 'weekly',
      goal: '',
      goal_green: '',
      goal_yellow: '',
      goal_red: '',
      display_order: 0,
    }
  }

  async function save() {
    if (!client) return
    if (!form.name.trim()) { alert('Name is required'); return }
    setSaving(true)
    try {
      const thresholds = {
        green:  form.goal_green  === '' ? null : Number(form.goal_green),
        yellow: form.goal_yellow === '' ? null : Number(form.goal_yellow),
        red:    form.goal_red    === '' ? null : Number(form.goal_red),
      }
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        owner_id: form.owner_id || null,
        department: form.department || null,
        category: form.category || null,
        measurement_type: form.measurement_type || 'number',
        measurement_frequency: form.measurement_frequency || 'weekly',
        goal: form.goal === '' ? null : Number(form.goal),
        thresholds,
        is_active: true,
        display_order: parseInt(form.display_order, 10) || 0,
        weekly_data: [],
      }
      const { error } = await client.from('eos_scorecard_metrics').insert(payload)
      if (error) throw error
      onSaved?.()
    } catch (e) {
      console.error('[EOSScorecard] new metric', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Scorecard Metric"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
          <button onClick={save} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Metric'}
          </button>
        </div>
      }
    >
      <Input label="Name" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} placeholder="Weekly Revenue" />
      <Textarea label="Description" value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} rows={2} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Type" value={form.measurement_type} onChange={(v) => setForm(f => ({ ...f, measurement_type: v }))} options={MEASUREMENT_TYPES.map(t => ({ value: t.key, label: t.label }))} />
        <Select label="Frequency" value={form.measurement_frequency} onChange={(v) => setForm(f => ({ ...f, measurement_frequency: v }))} options={FREQUENCIES.map(f => ({ value: f, label: f }))} />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Input label="Goal" type="number" value={form.goal} onChange={(v) => setForm(f => ({ ...f, goal: v }))} />
        <Input label="Green >=" type="number" value={form.goal_green} onChange={(v) => setForm(f => ({ ...f, goal_green: v }))} />
        <Input label="Yellow >=" type="number" value={form.goal_yellow} onChange={(v) => setForm(f => ({ ...f, goal_yellow: v }))} />
        <Input label="Red below" type="number" value={form.goal_red} onChange={(v) => setForm(f => ({ ...f, goal_red: v }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Owner ID" value={form.owner_id} onChange={(v) => setForm(f => ({ ...f, owner_id: v }))} />
        <Input label="Department" value={form.department} onChange={(v) => setForm(f => ({ ...f, department: v }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Category" value={form.category} onChange={(v) => setForm(f => ({ ...f, category: v }))} />
        <Input label="Display Order" type="number" value={form.display_order} onChange={(v) => setForm(f => ({ ...f, display_order: v }))} />
      </div>
    </Modal>
  )
}

// ===========================================================================
//                                METRIC DRAWER
// ===========================================================================
function MetricDrawer({ metric, entries, onClose, client, onChanged }) {
  const [draft, setDraft] = useState(metric)
  const [tab, setTab] = useState('overview')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(metric)
    setTab('overview')
  }, [metric])

  if (!metric) return null

  const thresholds = (draft?.thresholds && typeof draft.thresholds === 'object') ? draft.thresholds : {}

  async function saveAll() {
    if (!client) return
    setSaving(true)
    try {
      const payload = {
        name: draft.name,
        description: draft.description,
        owner_id: draft.owner_id || null,
        department: draft.department || null,
        category: draft.category || null,
        measurement_type: draft.measurement_type || 'number',
        measurement_frequency: draft.measurement_frequency || 'weekly',
        goal: draft.goal === null || draft.goal === '' ? null : Number(draft.goal),
        goal_weekly:    draft.goal_weekly === '' ? null : Number(draft.goal_weekly),
        goal_monthly:   draft.goal_monthly === '' ? null : Number(draft.goal_monthly),
        goal_quarterly: draft.goal_quarterly === '' ? null : Number(draft.goal_quarterly),
        goal_yearly:    draft.goal_yearly === '' ? null : Number(draft.goal_yearly),
        thresholds: {
          green:  thresholds.green  === '' ? null : (thresholds.green === undefined ? null : Number(thresholds.green)),
          yellow: thresholds.yellow === '' ? null : (thresholds.yellow === undefined ? null : Number(thresholds.yellow)),
          red:    thresholds.red    === '' ? null : (thresholds.red === undefined ? null : Number(thresholds.red)),
        },
        calculation_formula: draft.calculation_formula || null,
        data_source: draft.data_source || null,
        is_auto_calculated: !!draft.is_auto_calculated,
        is_active: draft.is_active !== false,
        display_order: parseInt(draft.display_order, 10) || 0,
      }
      const { error } = await client.from('eos_scorecard_metrics').update(payload).eq('id', metric.id)
      if (error) throw error
      onChanged?.()
    } catch (e) {
      console.error('[EOSScorecard] update', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  function setThreshold(key, v) {
    setDraft(d => ({ ...d, thresholds: { ...(d?.thresholds && typeof d.thresholds === 'object' ? d.thresholds : {}), [key]: v } }))
  }

  const last26 = [...(entries || [])].sort((a, b) => new Date(b.period_date).getTime() - new Date(a.period_date).getTime()).slice(0, 26)

  return (
    <Drawer
      open={!!metric}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <TypeBadge type={draft?.measurement_type} />
          <span className="text-white font-semibold truncate">{draft?.name || 'Metric'}</span>
        </div>
      }
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={saveAll} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>History</TabBtn>
      </div>

      {tab === 'overview' && draft && (
        <div>
          <Input label="Name" value={draft.name} onChange={(v) => setDraft(d => ({ ...d, name: v }))} />
          <Textarea label="Description" value={draft.description} onChange={(v) => setDraft(d => ({ ...d, description: v }))} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Owner ID" value={draft.owner_id || ''} onChange={(v) => setDraft(d => ({ ...d, owner_id: v }))} />
            <Input label="Department" value={draft.department || ''} onChange={(v) => setDraft(d => ({ ...d, department: v }))} />
          </div>
          <Input label="Category" value={draft.category || ''} onChange={(v) => setDraft(d => ({ ...d, category: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={draft.measurement_type} onChange={(v) => setDraft(d => ({ ...d, measurement_type: v }))} options={MEASUREMENT_TYPES.map(t => ({ value: t.key, label: t.label }))} />
            <Select label="Frequency" value={draft.measurement_frequency} onChange={(v) => setDraft(d => ({ ...d, measurement_frequency: v }))} options={FREQUENCIES.map(f => ({ value: f, label: f }))} />
          </div>
          <Input label="Goal" type="number" value={draft.goal ?? ''} onChange={(v) => setDraft(d => ({ ...d, goal: v }))} />
          <div className="grid grid-cols-4 gap-3">
            <Input label="Wk" type="number" value={draft.goal_weekly ?? ''} onChange={(v) => setDraft(d => ({ ...d, goal_weekly: v }))} />
            <Input label="Mo" type="number" value={draft.goal_monthly ?? ''} onChange={(v) => setDraft(d => ({ ...d, goal_monthly: v }))} />
            <Input label="Qtr" type="number" value={draft.goal_quarterly ?? ''} onChange={(v) => setDraft(d => ({ ...d, goal_quarterly: v }))} />
            <Input label="Yr" type="number" value={draft.goal_yearly ?? ''} onChange={(v) => setDraft(d => ({ ...d, goal_yearly: v }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Green >=" type="number" value={thresholds.green ?? ''} onChange={(v) => setThreshold('green', v)} />
            <Input label="Yellow >=" type="number" value={thresholds.yellow ?? ''} onChange={(v) => setThreshold('yellow', v)} />
            <Input label="Red below" type="number" value={thresholds.red ?? ''} onChange={(v) => setThreshold('red', v)} />
          </div>
          <Textarea label="Calculation Formula" value={draft.calculation_formula || ''} onChange={(v) => setDraft(d => ({ ...d, calculation_formula: v }))} rows={2} />
          <Input label="Data Source" value={draft.data_source || ''} onChange={(v) => setDraft(d => ({ ...d, data_source: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={!!draft.is_auto_calculated} onChange={(e) => setDraft(d => ({ ...d, is_auto_calculated: e.target.checked }))} className="accent-brand-cyan" />
              Auto-calculated
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={draft.is_active !== false} onChange={(e) => setDraft(d => ({ ...d, is_active: e.target.checked }))} className="accent-brand-cyan" />
              Active
            </label>
          </div>
          <Input label="Display Order" type="number" value={draft.display_order ?? 0} onChange={(v) => setDraft(d => ({ ...d, display_order: v }))} />
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div className="bg-navy-900/40 border border-dashed border-navy-700/60 rounded-lg p-4 mb-4 text-center">
            <p className="text-xs text-gray-400">Trend chart: Wave F</p>
            <p className="text-[10px] text-gray-600 mt-1">For now, raw entries below.</p>
          </div>
          <div className="bg-navy-900/40 border border-navy-700/40 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-navy-900/60 border-b border-navy-700/50">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Period</th>
                  <th className="px-3 py-2 text-right text-[11px] text-gray-400 uppercase tracking-wider">Actual</th>
                  <th className="px-3 py-2 text-center text-[11px] text-gray-400 uppercase tracking-wider">On Track</th>
                  <th className="px-3 py-2 text-left text-[11px] text-gray-400 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {last26.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500 text-xs">No entries yet.</td></tr>
                )}
                {last26.map(e => (
                  <tr key={e.id} className="border-b border-navy-700/30">
                    <td className="px-3 py-2 text-gray-300">{fmtDate(e.period_date)}</td>
                    <td className="px-3 py-2 text-right text-white">{fmtValue(e.actual_value, metric.measurement_type)}</td>
                    <td className="px-3 py-2 text-center">
                      {e.on_track ? <span className="text-emerald-300 text-xs">yes</span> : <span className="text-rose-300 text-xs">no</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-400 truncate max-w-[200px]">{e.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Drawer>
  )
}
