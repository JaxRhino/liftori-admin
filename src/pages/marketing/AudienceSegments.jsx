import { useEffect, useState } from 'react'
import {
  listSegments, createSegment, updateSegment, deleteSegment, refreshSegmentCount,
  SEGMENT_SOURCES, formatInt,
} from '../../lib/marketingService'

const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'in', 'is_null', 'is_not_null']

const emptyForm = {
  name: '', source: 'profiles', description: '',
  filter_json: { filters: [] },
}

export default function AudienceSegments() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const data = await listSegments(); setRows(data || []) }
    catch (e) { console.error('Segments load:', e) }
    finally { setLoading(false) }
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      name: r.name || '', source: r.source || 'profiles',
      description: r.description || '',
      filter_json: r.filter_json || { filters: [] },
    })
  }
  function newSeg() { setEditing('new'); setForm(emptyForm) }
  function cancel() { setEditing(null); setForm(emptyForm) }

  async function save() {
    if (!form.name) { alert('Name required'); return }
    try {
      const payload = { ...form }
      let row
      if (editing === 'new') {
        const { data } = await createSegment(payload)
        row = data
      } else {
        const { data } = await updateSegment(editing, payload)
        row = data
      }
      if (row) await refreshSegmentCount(row).catch(() => {})
      cancel(); load()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this segment?')) return
    try { await deleteSegment(id); load() } catch (e) { alert(e.message) }
  }

  async function refresh(r) {
    try { await refreshSegmentCount(r); load() } catch (e) { alert(e.message) }
  }

  function addFilter() {
    const filters = [...(form.filter_json.filters || []), { field: '', op: 'eq', value: '' }]
    setForm({ ...form, filter_json: { ...form.filter_json, filters } })
  }
  function updateFilter(i, patch) {
    const filters = [...(form.filter_json.filters || [])]
    filters[i] = { ...filters[i], ...patch }
    setForm({ ...form, filter_json: { ...form.filter_json, filters } })
  }
  function removeFilter(i) {
    const filters = (form.filter_json.filters || []).filter((_, ix) => ix !== i)
    setForm({ ...form, filter_json: { ...form.filter_json, filters } })
  }

  const totalCount = rows.reduce((a, r) => a + Number(r.member_count || 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audience Segments</h1>
          <p className="text-sm text-gray-400 mt-1">Build reusable dynamic segments for email, ads, and campaigns.</p>
        </div>
        <button onClick={newSeg} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">+ New Segment</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Segments" value={formatInt(rows.length)} />
        <Kpi label="Total Members (sum)" value={formatInt(totalCount)} />
        <Kpi label="Sources" value={new Set(rows.map(r => r.source)).size || 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading ? <p className="text-gray-400 text-sm col-span-2">Loading…</p> :
         rows.length === 0 ? <p className="text-gray-500 text-sm col-span-2">No segments yet.</p> :
         rows.map(r => (
          <div key={r.id} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold">{r.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">Source: {r.source}</p>
              </div>
              <div className="flex gap-2 text-xs">
                <button onClick={() => refresh(r)} className="text-sky-400 hover:underline">Refresh</button>
                <button onClick={() => openEdit(r)} className="text-sky-400 hover:underline">Edit</button>
                <button onClick={() => remove(r.id)} className="text-rose-400 hover:underline">Del</button>
              </div>
            </div>
            {r.description && <p className="text-sm text-gray-300 mt-2">{r.description}</p>}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {(r.filter_json?.filters || []).map((f, i) => (
                  <span key={i} className="text-[10px] bg-navy-900 text-gray-300 px-1.5 py-0.5 rounded">
                    {f.field} {f.op} {String(f.value ?? '')}
                  </span>
                ))}
              </div>
              <span className="text-lg font-bold text-sky-300">{formatInt(r.member_count || 0)}</span>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl max-w-2xl w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">{editing === 'new' ? 'New Segment' : 'Edit Segment'}</h2>
            <Field label="Name"><input className={inputCls} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></Field>
            <Field label="Source">
              <select className={inputCls} value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                {SEGMENT_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Description"><input className={inputCls} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></Field>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase">Filters</span>
                <button onClick={addFilter} className="text-xs text-sky-400 hover:underline">+ Add filter</button>
              </div>
              {(form.filter_json.filters || []).length === 0 && <p className="text-xs text-gray-500">No filters — matches all rows from source.</p>}
              <div className="space-y-2">
                {(form.filter_json.filters || []).map((f, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input placeholder="field" value={f.field} onChange={e => updateFilter(i, { field: e.target.value })} className={`col-span-4 ${inputCls}`} />
                    <select value={f.op} onChange={e => updateFilter(i, { op: e.target.value })} className={`col-span-3 ${inputCls}`}>
                      {FILTER_OPS.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                    <input placeholder="value" value={f.value ?? ''} onChange={e => updateFilter(i, { value: e.target.value })}
                      disabled={f.op === 'is_null' || f.op === 'is_not_null'} className={`col-span-4 ${inputCls}`} />
                    <button onClick={() => removeFilter(i)} className="col-span-1 text-rose-400 text-xs hover:underline">×</button>
                  </div>
                ))}
              </div>
            </div>

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

function Kpi({ label, value }) {
  return (
    <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-xl font-bold mt-1 text-white">{value}</p>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs text-gray-400 block mb-1">{label}</span>{children}</label>
}
