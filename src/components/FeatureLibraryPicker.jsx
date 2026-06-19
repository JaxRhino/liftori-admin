import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useFeatureLibrary } from '../lib/useFeatureLibrary'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))
const money = (v) => '$' + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })

// ── Pure ws transforms ─────────────────────────────────────────────────────
function appendScopeSection(scope, feat) {
  const s = scope || ''
  if (s.includes(`## ${feat.name}`)) return s
  const block = `## ${feat.name}\n${feat.scope || feat.detail || ''}`
  return (s.trim() ? s.trim() + '\n\n' : '') + block
}
function stripScopeSection(scope, name) {
  if (!scope) return scope
  const out = []
  let skip = false
  for (const line of scope.split('\n')) {
    if (line.trim() === `## ${name}`) { skip = true; continue }
    if (skip && /^##\s+/.test(line.trim())) skip = false
    if (!skip) out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function applyLibraryFeature(ws, feat) {
  const w = ws || {}
  const features = w.features || []
  const tasks = w.tasks || []
  const costs = w.costs || {}
  const lineItems = costs.line_items || []

  const nextFeatures = features.some(f => f.libKey === feat.key)
    ? features
    : [...features, { id: uid(), name: feat.name, detail: feat.detail || feat.scope || '', libKey: feat.key }]

  const dt = Array.isArray(feat.default_tasks) ? feat.default_tasks : []
  const existingTitles = new Set(tasks.filter(t => t.libKey === feat.key).map(t => t.title))
  const newTasks = dt
    .filter(t => t && !existingTitles.has(t))
    .map(t => ({ id: uid(), title: t, done: false, libKey: feat.key }))

  const nextCosts = lineItems.some(l => l.libKey === feat.key)
    ? costs
    : { ...costs, line_items: [...lineItems, { id: uid(), label: `${feat.name} — est. build`, amount: Number(feat.est_cost || 0), libKey: feat.key }] }

  return {
    ...w,
    features: nextFeatures,
    scope: appendScopeSection(w.scope, feat),
    tasks: [...tasks, ...newTasks],
    costs: nextCosts,
  }
}

export function removeLibraryFeature(ws, key, name) {
  const w = ws || {}
  const costs = w.costs || {}
  return {
    ...w,
    features: (w.features || []).filter(f => f.libKey !== key),
    tasks: (w.tasks || []).filter(t => !(t.libKey === key && !t.done)),
    costs: { ...costs, line_items: (costs.line_items || []).filter(l => l.libKey !== key) },
    scope: stripScopeSection(w.scope, name),
  }
}

// ── Manage-library editor (writes feature_library) ─────────────────────────
function blankRow(order) {
  return { key: '', name: '', category: 'General', detail: '', scope: '', est_hours: 0, est_cost: 0, default_tasks: [], sort_order: order, active: true, _new: true }
}
function slugify(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) }

function ManageLibrary({ features, onClose, onSaved }) {
  const [rows, setRows] = useState(features.map(f => ({ ...f, default_tasks: Array.isArray(f.default_tasks) ? f.default_tasks : [] })))
  const [busy, setBusy] = useState(false)
  const upd = (i, k, v) => setRows(rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  const addRow = () => setRows([...rows, blankRow((rows.length + 1) * 10)])
  const removeRow = async (i) => {
    const r = rows[i]
    if (!r._new && r.key && !confirm(`Remove "${r.name}" from the library?`)) return
    if (!r._new && r.key) await supabase.from('feature_library').delete().eq('key', r.key)
    setRows(rows.filter((_, idx) => idx !== i))
  }
  const save = async () => {
    setBusy(true)
    const payload = rows
      .map(r => ({ ...r, key: r.key || slugify(r.name) }))
      .filter(r => r.key && r.name)
      .map(({ _new, created_at, updated_at, ...r }) => ({
        ...r,
        est_hours: Number(r.est_hours || 0),
        est_cost: Number(r.est_cost || 0),
        sort_order: Number(r.sort_order || 0),
        default_tasks: Array.isArray(r.default_tasks)
          ? r.default_tasks
          : String(r.default_tasks || '').split('\n').map(s => s.trim()).filter(Boolean),
        updated_at: new Date().toISOString(),
      }))
    const { error } = await supabase.from('feature_library').upsert(payload, { onConflict: 'key' })
    setBusy(false)
    if (error) { alert('Save failed: ' + error.message); return }
    onSaved()
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Edit the master catalog. Changes apply everywhere features are added from.</p>
        <button onClick={onClose} className="text-xs text-sky-400 hover:underline">Back to picker</button>
      </div>
      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {rows.map((r, i) => (
          <div key={r.key || i} className="bg-navy-900 border border-navy-700/50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={r.name} onChange={e => upd(i, 'name', e.target.value)} placeholder="Feature name" className="bg-navy-800 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
              <input value={r.category} onChange={e => upd(i, 'category', e.target.value)} placeholder="Category" className="bg-navy-800 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <input value={r.detail} onChange={e => upd(i, 'detail', e.target.value)} placeholder="Short detail (one line)" className="w-full bg-navy-800 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
            <textarea value={r.scope} onChange={e => upd(i, 'scope', e.target.value)} placeholder="Full scope blurb" className="w-full bg-navy-800 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 h-16 resize-y" />
            <textarea value={Array.isArray(r.default_tasks) ? r.default_tasks.join('\n') : r.default_tasks} onChange={e => upd(i, 'default_tasks', e.target.value.split('\n'))} placeholder="Default tasks (one per line)" className="w-full bg-navy-800 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 h-16 resize-y" />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-slate-500">Hours</label>
              <input value={r.est_hours} onChange={e => upd(i, 'est_hours', e.target.value.replace(/[^0-9.]/g, ''))} className="w-20 bg-navy-800 border border-navy-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-sky-500" />
              <label className="text-[11px] text-slate-500">Est $</label>
              <input value={r.est_cost} onChange={e => upd(i, 'est_cost', e.target.value.replace(/[^0-9.]/g, ''))} className="w-24 bg-navy-800 border border-navy-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-sky-500" />
              <label className="text-[11px] text-slate-500">Order</label>
              <input value={r.sort_order} onChange={e => upd(i, 'sort_order', e.target.value.replace(/[^0-9]/g, ''))} className="w-16 bg-navy-800 border border-navy-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-sky-500" />
              <button onClick={() => removeRow(i)} className="ml-auto text-xs text-slate-500 hover:text-red-400">Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={addRow} className="px-3 py-1.5 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-xs font-medium">+ Add feature</button>
        <button onClick={save} disabled={busy} className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium">{busy ? 'Saving...' : 'Save library'}</button>
      </div>
    </div>
  )
}

// ── Picker modal ───────────────────────────────────────────────────────────
export default function FeatureLibraryPicker({ ws, onSave }) {
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const { features, loading, reload } = useFeatureLibrary()
  const w = ws || {}
  const appliedKeys = new Set((w.features || []).filter(f => f.libKey).map(f => f.libKey))

  const toggle = (feat) => {
    if (appliedKeys.has(feat.key)) onSave(removeLibraryFeature(w, feat.key, feat.name))
    else onSave(applyLibraryFeature(w, feat))
  }

  const cats = []
  const grouped = {}
  for (const f of features) {
    if (!grouped[f.category]) { grouped[f.category] = []; cats.push(f.category) }
    grouped[f.category].push(f)
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button onClick={() => { setOpen(true); setManaging(false) }} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors">+ Add from library</button>
        {appliedKeys.size > 0 && <span className="text-xs text-slate-500">{appliedKeys.size} from library</span>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="bg-navy-800 border border-navy-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-navy-700/60">
              <div>
                <p className="text-base font-semibold text-white">{managing ? 'Manage feature library' : 'Feature library'}</p>
                {!managing && <p className="text-xs text-slate-500 mt-0.5">Check a pre-built feature to drop it into this build — fills its scope, tasks and estimated cost.</p>}
              </div>
              <div className="flex items-center gap-3">
                {!managing && <button onClick={() => setManaging(true)} className="text-xs text-sky-400 hover:underline">Manage library</button>}
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">×</button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto">
              {managing ? (
                <ManageLibrary features={features} onClose={() => setManaging(false)} onSaved={() => { reload(); setManaging(false) }} />
              ) : loading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <div className="space-y-5">
                  {cats.map(cat => (
                    <div key={cat}>
                      <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{cat}</p>
                      <div className="space-y-2">
                        {grouped[cat].map(f => {
                          const on = appliedKeys.has(f.key)
                          return (
                            <button key={f.key} onClick={() => toggle(f)} className={`w-full text-left flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${on ? 'bg-sky-500/10 border-sky-500/40' : 'bg-navy-900 border-navy-700/50 hover:border-navy-600'}`}>
                              <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${on ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-600 text-transparent'}`}>v</span>
                              <span className="flex-1 min-w-0">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-white">{f.name}</span>
                                  <span className="text-[11px] text-slate-500 shrink-0">~{Number(f.est_hours || 0)}h · {money(f.est_cost)}</span>
                                </span>
                                <span className="block text-xs text-slate-400 mt-0.5">{f.detail}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
