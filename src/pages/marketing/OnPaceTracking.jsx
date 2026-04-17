import { useEffect, useState } from 'react'
import {
  listGoals, createGoal, updateGoal, deleteGoal, onPaceProgress,
  GOAL_METRICS, formatInt, formatMoney, formatPct,
} from '../../lib/marketingService'

const emptyForm = {
  name: '', metric: 'revenue_cents', target_value: 0, start_value: 0,
  current_value: 0, period_start: new Date().toISOString().slice(0, 10),
  period_end: '', status: 'active', notes: '',
}

export default function OnPaceTracking() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [filterStatus, setFilterStatus] = useState('active')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [filterStatus])

  async function load() {
    setLoading(true)
    try { const data = await listGoals({ status: filterStatus || undefined }); setRows(data || []) }
    catch (e) { console.error('Goals load:', e) }
    finally { setLoading(false) }
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      name: r.name || '', metric: r.metric || 'revenue_cents',
      target_value: r.target_value || 0, start_value: r.start_value || 0,
      current_value: r.current_value || 0,
      period_start: r.period_start || '', period_end: r.period_end || '',
      status: r.status || 'active', notes: r.notes || '',
    })
  }
  function newGoal() { setEditing('new'); setForm(emptyForm) }
  function cancel() { setEditing(null); setForm(emptyForm) }

  async function save() {
    if (!form.name) { alert('Goal name required'); return }
    try {
      const payload = {
        ...form,
        target_value: Number(form.target_value) || 0,
        start_value: Number(form.start_value) || 0,
        current_value: Number(form.current_value) || 0,
        period_end: form.period_end || null,
      }
      if (editing === 'new') await createGoal(payload)
      else await updateGoal(editing, payload)
      cancel(); load()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this goal?')) return
    try { await deleteGoal(id); load() } catch (e) { alert(e.message) }
  }

  const formatMetricValue = (metric, v) => {
    if (!v && v !== 0) return '—'
    if (metric.endsWith('_cents')) return formatMoney(v)
    if (metric.endsWith('_rate') || metric === 'roas') return formatPct(v)
    return formatInt(v)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">On-Pace Tracking</h1>
          <p className="text-sm text-gray-400 mt-1">Set goals, track progress, flag off-pace work early.</p>
        </div>
        <button onClick={newGoal} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">+ New Goal</button>
      </div>

      <div className="flex items-center gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2">
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="missed">Missed</option>
          <option value="">All</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading ? <p className="text-gray-400 text-sm col-span-2">Loading…</p> :
         rows.length === 0 ? <p className="text-gray-500 text-sm col-span-2">No goals.</p> :
         rows.map(r => {
          const p = onPaceProgress(r)
          const deltaPct = p.actualPct - p.expectedPct
          const onPace = deltaPct >= -5
          return (
            <div key={r.id} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-semibold">{r.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{(r.metric || '').replaceAll('_', ' ')} · {r.status}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => openEdit(r)} className="text-sky-400 hover:underline">Edit</button>
                  <button onClick={() => remove(r.id)} className="text-rose-400 hover:underline">Del</button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Progress</span>
                  <span className="text-white font-semibold">{formatMetricValue(r.metric, r.current_value)} / {formatMetricValue(r.metric, r.target_value)}</span>
                </div>
                <div className="w-full bg-navy-900 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 ${onPace ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, p.actualPct)}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>{p.actualPct.toFixed(1)}% complete</span>
                  <span>Expected: {p.expectedPct.toFixed(1)}%</span>
                </div>
                <div className={`text-xs font-semibold ${onPace ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {onPace ? 'On Pace' : 'Off Pace'} ({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
                </div>
                <div className="text-xs text-gray-500">
                  {r.period_start} → {r.period_end || '—'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl max-w-xl w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">{editing === 'new' ? 'New Goal' : 'Edit Goal'}</h2>
            <Field label="Name"><input className={inputCls} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Metric">
                <select className={inputCls} value={form.metric} onChange={e => setForm({...form, metric: e.target.value})}>
                  {GOAL_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                </select>
              </Field>
              <Field label="Start Value"><input type="number" className={inputCls} value={form.start_value} onChange={e => setForm({...form, start_value: e.target.value})} /></Field>
              <Field label="Current Value"><input type="number" className={inputCls} value={form.current_value} onChange={e => setForm({...form, current_value: e.target.value})} /></Field>
              <Field label="Target Value"><input type="number" className={inputCls} value={form.target_value} onChange={e => setForm({...form, target_value: e.target.value})} /></Field>
              <Field label="Period Start"><input type="date" className={inputCls} value={form.period_start} onChange={e => setForm({...form, period_start: e.target.value})} /></Field>
              <Field label="Period End"><input type="date" className={inputCls} value={form.period_end} onChange={e => setForm({...form, period_end: e.target.value})} /></Field>
            </div>
            <Field label="Notes"><textarea className={inputCls + ' h-20'} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></Field>
            <div className="flex justify-end gap-2">
              <button onClick={cancel} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={save} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2'

function Field({ label, children }) {
  return <label className="block"><span className="text-xs text-gray-400 block mb-1">{label}</span>{children}</label>
}
