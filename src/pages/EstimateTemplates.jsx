// ============================================================
// EstimateTemplates.jsx — /admin/estimate-templates
// Liftori product estimate templates — per-product line items & costs.
// Mike & Ryan edit unit costs here; these pre-fill combo estimates.
// ============================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Discovery', 'Design', 'Build', 'Integrations', 'QA', 'Launch', 'Training', 'Project Mgmt', 'Managed Services']
const fmt = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })

export default function EstimateTemplates() {
  const [templates, setTemplates] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [{ data: t }, { data: it }] = await Promise.all([
      supabase.from('estimate_product_templates').select('*').order('product_type', { ascending: true }),
      supabase.from('estimate_product_template_items').select('*').order('sort_order', { ascending: true }),
    ])
    setTemplates(t || [])
    setItems(it || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const itemsFor = (tid) => items.filter(i => i.template_id === tid).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const patchLocal = (id, patch) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  async function saveItem(it) {
    await supabase.from('estimate_product_template_items').update({
      label: it.label, category: it.category, qty: Number(it.qty) || 0,
      unit_cost: Number(it.unit_cost) || 0, recurring: !!it.recurring, notes: it.notes || null,
    }).eq('id', it.id)
  }
  async function addItem(t) {
    const maxSort = Math.max(0, ...itemsFor(t.id).map(i => i.sort_order || 0))
    const { data } = await supabase.from('estimate_product_template_items')
      .insert({ template_id: t.id, sort_order: maxSort + 1, label: 'New line', category: 'Build', qty: 1, unit_cost: 0, recurring: false })
      .select().single()
    if (data) setItems(prev => [...prev, data])
  }
  async function removeItem(id) {
    if (!window.confirm('Remove this line item?')) return
    await supabase.from('estimate_product_template_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <div className="p-6 text-slate-400">Loading templates…</div>

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Estimate Templates</h1>
        <p className="text-sm text-slate-400 mt-1">Per-product line items & costs. Edit unit costs here — they pre-fill combo estimates on customers.</p>
      </div>

      {templates.map(t => {
        const its = itemsFor(t.id)
        const oneTime = its.filter(i => !i.recurring).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_cost) || 0), 0)
        const monthly = its.filter(i => i.recurring).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_cost) || 0), 0)
        return (
          <div key={t.id} className="bg-navy-800/50 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">{t.product_type}</h2>
                <p className="text-xs text-slate-500">{t.name}</p>
              </div>
              <div className="text-right text-sm">
                <span className="text-emerald-400 font-semibold">{fmt(oneTime)}</span><span className="text-slate-500"> one-time</span>
                {monthly > 0 && <><span className="text-slate-600 mx-2">·</span><span className="text-amber-400 font-semibold">{fmt(monthly)}</span><span className="text-slate-500">/mo</span></>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 text-xs border-b border-white/10">
                    <th className="px-2 py-2">Line item</th>
                    <th className="px-2 py-2 w-36">Category</th>
                    <th className="px-2 py-2 w-16">Qty</th>
                    <th className="px-2 py-2 w-28">Unit cost</th>
                    <th className="px-2 py-2 w-14 text-center">/mo</th>
                    <th className="px-2 py-2 w-28 text-right">Line</th>
                    <th className="px-2 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {its.map(i => (
                    <tr key={i.id} className="border-b border-white/5">
                      <td className="px-2 py-1.5"><input value={i.label || ''} onChange={e => patchLocal(i.id, { label: e.target.value })} onBlur={() => saveItem(i)} className="w-full bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-white" /></td>
                      <td className="px-2 py-1.5">
                        <select value={i.category || ''} onChange={e => { patchLocal(i.id, { category: e.target.value }); saveItem({ ...i, category: e.target.value }) }} className="w-full bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-slate-300">
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><input type="number" value={i.qty ?? 1} onChange={e => patchLocal(i.id, { qty: e.target.value })} onBlur={() => saveItem(i)} className="w-full bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-white" /></td>
                      <td className="px-2 py-1.5"><input type="number" value={i.unit_cost ?? 0} onChange={e => patchLocal(i.id, { unit_cost: e.target.value })} onBlur={() => saveItem(i)} className="w-full bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-white" /></td>
                      <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={!!i.recurring} onChange={e => { patchLocal(i.id, { recurring: e.target.checked }); saveItem({ ...i, recurring: e.target.checked }) }} /></td>
                      <td className="px-2 py-1.5 text-right text-slate-300">{fmt((Number(i.qty) || 0) * (Number(i.unit_cost) || 0))}{i.recurring ? '/mo' : ''}</td>
                      <td className="px-2 py-1.5 text-right"><button onClick={() => removeItem(i.id)} className="text-red-400 hover:text-red-300 text-xs">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => addItem(t)} className="mt-3 px-3 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg font-medium">+ Add line item</button>
          </div>
        )
      })}
      {templates.length === 0 && <p className="text-slate-500 text-sm">No product templates found.</p>}
    </div>
  )
}
