import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Trash2, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STAGE_COLORS, paletteTint } from '../lib/products'

/**
 * PipelineStagesEditor — generic "Manage stages" editor for any pipeline surface
 * (Custom Builds, Projects). Mirrors the Products StagesEditor but reads/writes
 * pipeline_stages filtered by `surface`. Add / rename / reorder / recolor / remove.
 * On remove, rows in `statusTable.statusColumn` that used a deleted stage are
 * reassigned to the first remaining stage so nothing is hidden, then the stage is deleted.
 */
let _n = 0
const localId = () => 'new_' + (++_n)
const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'stage'

export default function PipelineStagesEditor({ surface, statusTable, statusColumn, title = 'Manage stages', onClose, onSaved }) {
  const [rows, setRows] = useState([])
  const [initialKeys, setInitialKeys] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    supabase
      .from('pipeline_stages')
      .select('stage_key,label,sort_order,color')
      .eq('surface', surface)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (!alive) return
        const src = data || []
        setRows(src.map((s) => ({ _id: s.stage_key, stage_key: s.stage_key, label: s.label, color: s.color })))
        setInitialKeys(src.map((s) => s.stage_key))
      })
    return () => { alive = false }
  }, [surface])

  const update = (id, patch) => setRows((r) => r.map((x) => (x._id === id ? { ...x, ...patch } : x)))
  const remove = (id) => setRows((r) => r.filter((x) => x._id !== id))
  const add = () => setRows((r) => [...r, { _id: localId(), stage_key: '', label: '', color: 'slate' }])
  const move = (i, dir) => setRows((r) => {
    const j = i + dir
    if (j < 0 || j >= r.length) return r
    const next = [...r]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  async function save() {
    setError('')
    if (rows.some((r) => !r.label.trim())) { setError('Every stage needs a name.'); return }
    if (rows.length === 0) { setError('Keep at least one stage.'); return }
    setSaving(true)
    try {
      const used = new Set()
      const resolved = rows.map((r) => {
        let key = r.stage_key
        if (!key) { let base = slugify(r.label); key = base; let n = 2; while (used.has(key)) key = base + '_' + n++ }
        used.add(key)
        return { ...r, stage_key: key }
      })

      const payload = resolved.map((r, i) => ({
        surface,
        stage_key: r.stage_key,
        label: r.label.trim(),
        color: r.color,
        sort_order: (i + 1) * 10,
        updated_at: new Date().toISOString(),
      }))
      const { error: upErr } = await supabase.from('pipeline_stages').upsert(payload, { onConflict: 'surface,stage_key' })
      if (upErr) throw upErr

      const finalKeys = resolved.map((r) => r.stage_key)
      const finalSet = new Set(finalKeys)
      const removed = initialKeys.filter((k) => !finalSet.has(k))
      if (removed.length) {
        const fallback = finalKeys[0]
        if (statusTable && statusColumn && fallback) {
          await supabase.from(statusTable).update({ [statusColumn]: fallback }).in(statusColumn, removed)
        }
        await supabase.from('pipeline_stages').delete().eq('surface', surface).in('stage_key', removed)
      }
      onSaved && onSaved()
      onClose && onClose()
    } catch (e) {
      console.error('Error saving stages:', e)
      setError(e.message || 'Could not save stages.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-navy-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-xs text-gray-400">Reorder, rename, recolor, add or remove the stages in this pipeline.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto px-5 py-4">
          {rows.map((r, i) => (
            <div key={r._id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800/60 p-2">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-0.5 text-gray-500 hover:text-white disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="rounded p-0.5 text-gray-500 hover:text-white disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${paletteTint(r.color)}`}>{r.label || 'Untitled'}</span>
              <input
                value={r.label}
                onChange={(e) => update(r._id, { label: e.target.value })}
                placeholder="Stage name"
                className="min-w-0 flex-1 rounded-md border border-navy-700 bg-navy-900 px-2.5 py-1.5 text-sm text-white focus:border-brand-blue focus:outline-none"
              />
              <div className="flex items-center gap-1">
                {STAGE_COLORS.map((c) => (
                  <button key={c} onClick={() => update(r._id, { color: c })} title={c}
                    className={`h-5 w-5 rounded-full border ${paletteTint(c)} ${r.color === c ? 'ring-2 ring-white/70' : 'opacity-70 hover:opacity-100'}`} />
                ))}
              </div>
              <button onClick={() => remove(r._id)} className="rounded-lg p-1.5 text-gray-500 hover:bg-rose-500/10 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={add} className="mt-1 inline-flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2 text-sm text-gray-300 hover:border-brand-blue/40 hover:text-white">
            <Plus className="h-4 w-4" /> Add stage
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
          <span className="text-xs text-rose-400">{error}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-white/10 bg-navy-800 px-4 py-2 text-sm text-gray-200 hover:bg-navy-700">Cancel</button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
