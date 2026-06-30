import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'
import { toast } from 'sonner'

// Material ordering. Reads the tenant's OWN Supabase via useCrmClient().
// Build a material list per job and order it from a supplier (ABC Supply /
// Beacon / SRS). material_orders = PO header, material_order_items = lines.

const money = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'
const SUPPLIERS = ['ABC Supply', 'Beacon', 'SRS', 'Other']
const statusMeta = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-300' },
  ordered: { label: 'Ordered', color: 'bg-amber-500/20 text-amber-300' },
  delivered: { label: 'Delivered', color: 'bg-emerald-500/20 text-emerald-300' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-300' },
}
const blankItem = () => ({ name: '', sku: '', quantity: 1, unit: 'each', unit_cost: '' })
const blankOrder = () => ({ deal_id: '', supplier: 'ABC Supply', po_number: '', expected_delivery: '', items: [blankItem()] })

export default function OperationsMaterials() {
  const { client } = useCrmClient()
  const navigate = useNavigate()
  const { platformId } = useParams()
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // order form or null

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client])

  async function load() {
    try {
      setLoading(true)
      const { data: defs } = await client.from('pipeline_definitions').select('id,name,is_default,is_active').eq('is_active', true).order('display_order')
      const dl = defs || []
      const jp = dl.find(d => /job|operation|production|install/i.test(d.name || '')) || dl.find(d => !d.is_default) || dl[0] || null
      let jq = client.from('customer_pipeline').select('id, title, job_address').order('title')
      if (jp) jq = jq.eq('pipeline_definition_id', jp.id)
      const [oRes, iRes, jRes] = await Promise.all([
        client.from('material_orders').select('*').order('created_at', { ascending: false }),
        client.from('material_order_items').select('*'),
        jq,
      ])
      setOrders(oRes?.data || [])
      setItems(iRes?.data || [])
      setJobs(jRes?.data || [])
    } catch (e) { console.error('materials load failed', e); toast.error('Failed to load material orders') } finally { setLoading(false) }
  }

  const jobById = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j])), [jobs])
  const itemsByOrder = useMemo(() => {
    const m = {}
    for (const it of items) (m[it.order_id] = m[it.order_id] || []).push(it)
    return m
  }, [items])
  const orderTotal = (oid) => (itemsByOrder[oid] || []).reduce((t, it) => t + (Number(it.quantity) || 0) * (it.unit_cost_cents || 0) / 100, 0)
  const jobLabel = (id) => { const j = jobById[id]; return j ? (j.title || 'Job') : 'Unassigned' }

  const stats = useMemo(() => {
    let open = 0, onOrder = 0, delivered = 0
    const suppliers = new Set()
    for (const o of orders) {
      if (o.supplier) suppliers.add(o.supplier)
      const tot = orderTotal(o.id)
      if (o.status === 'draft' || o.status === 'ordered') open += 1
      if (o.status === 'ordered') onOrder += tot
      if (o.status === 'delivered') delivered += tot
    }
    return { open, onOrder, delivered, suppliers: suppliers.size }
  }, [orders, items])

  function openNew() { setEditing(blankOrder()) }
  function openEdit(o) {
    setEditing({
      id: o.id, deal_id: o.deal_id || '', supplier: o.supplier || 'ABC Supply', po_number: o.po_number || '',
      expected_delivery: o.expected_delivery || '',
      items: (itemsByOrder[o.id] || []).map((it) => ({ name: it.name, sku: it.sku || '', quantity: it.quantity, unit: it.unit || 'each', unit_cost: (it.unit_cost_cents || 0) / 100 })),
    })
    if (!(itemsByOrder[o.id] || []).length) setEditing((e) => ({ ...e, items: [blankItem()] }))
  }
  const draftTotal = useMemo(() => (editing?.items || []).reduce((t, it) => t + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0), 0), [editing])

  async function saveOrder() {
    if (!editing.deal_id) { toast.error('Pick a job'); return }
    const rows = editing.items.filter((it) => it.name.trim())
    if (!rows.length) { toast.error('Add at least one material line'); return }
    setBusy(true)
    try {
      let orderId = editing.id
      const payload = { deal_id: editing.deal_id, work_order_id: null, supplier: editing.supplier, po_number: editing.po_number || null, expected_delivery: editing.expected_delivery || null }
      if (orderId) {
        const { error } = await client.from('material_orders').update(payload).eq('id', orderId); if (error) throw error
        await client.from('material_order_items').delete().eq('order_id', orderId)
      } else {
        const { data, error } = await client.from('material_orders').insert({ ...payload, status: 'draft' }).select('id').single(); if (error) throw error
        orderId = data.id
      }
      const itemRows = rows.map((it) => ({ order_id: orderId, name: it.name, sku: it.sku || null, quantity: Number(it.quantity) || 0, unit: it.unit || 'each', unit_cost_cents: Math.round((Number(it.unit_cost) || 0) * 100) }))
      const { error: itErr } = await client.from('material_order_items').insert(itemRows); if (itErr) throw itErr
      toast.success('Material order saved'); setEditing(null); load()
    } catch (e) { console.error(e); toast.error(e.message || 'Save failed') } finally { setBusy(false) }
  }
  async function setStatus(o, status) {
    const patch = { status }
    if (status === 'ordered' && !o.ordered_date) patch.ordered_date = new Date().toISOString().slice(0, 10)
    setOrders((arr) => arr.map((x) => (x.id === o.id ? { ...x, ...patch } : x)))
    try { const { error } = await client.from('material_orders').update(patch).eq('id', o.id); if (error) throw error }
    catch (e) { console.error(e); toast.error('Update failed'); load() }
  }
  async function removeOrder(o) {
    if (!window.confirm(`Delete material order ${o.po_number || ''} for ${jobLabel(o.deal_id)}?`)) return
    try { const { error } = await client.from('material_orders').delete().eq('id', o.id); if (error) throw error; toast.success('Order removed'); load() }
    catch (e) { console.error(e); toast.error(e.message || 'Delete failed') }
  }

  return (
    <HubPage
      title="Materials"
      subtitle="Build a material list per job and order from ABC Supply, Beacon, or SRS."
      actions={<button onClick={openNew} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">Build material order</button>}
    >
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Open Orders" value={stats.open} hint="draft or ordered" />
            <StatCard label="On Order" value={money(stats.onOrder)} accent="text-amber-400" hint="awaiting delivery" />
            <StatCard label="Delivered" value={money(stats.delivered)} accent="text-emerald-400" />
            <StatCard label="Suppliers" value={stats.suppliers} accent="text-brand-blue" />
          </div>

          {orders.length === 0 ? (
            <EmptyState title="No material orders" description="Build a material list for a job and order it from a supplier." cta={<button onClick={openNew} className="px-3 py-2 rounded-lg text-sm bg-brand-blue text-white">Build material order</button>} />
          ) : orders.map((o) => {
            const sm = statusMeta[o.status] || statusMeta.draft
            const list = itemsByOrder[o.id] || []
            return (
              <Section key={o.id} title={`${o.supplier || 'Supplier'} ${o.po_number ? '· ' + o.po_number : ''}`} right={
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${sm.color}`}>{sm.label}</span>
                  <span className="text-xs text-gray-400">{money(orderTotal(o.id))}</span>
                </div>
              }>
                <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-navy-700/40">
                  <div className="text-sm text-gray-300">{o.deal_id ? <button onClick={() => navigate('/crm/' + platformId + '/deals/' + o.deal_id)} className="text-brand-cyan hover:underline">{jobLabel(o.deal_id)}</button> : jobLabel(o.deal_id)}{o.expected_delivery ? <span className="text-gray-500 ml-3 text-xs">ETA {fmtDate(o.expected_delivery)}</span> : null}</div>
                  <div className="flex items-center gap-2">
                    {o.status === 'draft' && <button onClick={() => setStatus(o, 'ordered')} className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 rounded text-xs transition">Mark ordered</button>}
                    {o.status === 'ordered' && <button onClick={() => setStatus(o, 'delivered')} className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-xs transition">Mark delivered</button>}
                    <button onClick={() => openEdit(o)} className="px-2 py-1 bg-navy-700/60 hover:bg-navy-700 text-gray-200 rounded text-xs transition">Edit</button>
                    <button onClick={() => removeOrder(o)} className="px-2 py-1 text-gray-500 hover:text-red-400 rounded text-xs transition">Remove</button>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-[11px] uppercase tracking-wider">
                    <th className="text-left px-5 py-2 font-medium">Material</th>
                    <th className="text-left px-4 py-2 font-medium">SKU</th>
                    <th className="text-right px-4 py-2 font-medium">Qty</th>
                    <th className="text-right px-4 py-2 font-medium">Unit cost</th>
                    <th className="text-right px-5 py-2 font-medium">Line</th>
                  </tr></thead>
                  <tbody>
                    {list.map((it) => (
                      <tr key={it.id} className="border-t border-navy-700/20">
                        <td className="px-5 py-2 text-white">{it.name}</td>
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs">{it.sku || '-'}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{Number(it.quantity)} {it.unit}</td>
                        <td className="px-4 py-2 text-right text-gray-400">{money((it.unit_cost_cents || 0) / 100)}</td>
                        <td className="px-5 py-2 text-right text-gray-200">{money((Number(it.quantity) || 0) * (it.unit_cost_cents || 0) / 100)}</td>
                      </tr>
                    ))}
                    {list.length === 0 && <tr><td colSpan={5} className="px-5 py-3 text-center text-gray-600 text-xs">No line items</td></tr>}
                  </tbody>
                </table>
              </Section>
            )
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEditing(null)}>
          <div className="bg-navy-900 border border-navy-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">{editing.id ? 'Edit material order' : 'Build material order'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Job</label><select value={editing.deal_id} onChange={(e) => setEditing({ ...editing, deal_id: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm"><option value="">Select...</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select></div>
                <div><label className="block text-xs text-gray-400 mb-1">Supplier</label><select value={editing.supplier} onChange={(e) => setEditing({ ...editing, supplier: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">{SUPPLIERS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">PO # (optional)</label><input value={editing.po_number} onChange={(e) => setEditing({ ...editing, po_number: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Expected delivery</label><input type="date" value={editing.expected_delivery} onChange={(e) => setEditing({ ...editing, expected_delivery: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Materials</label>
                  <button onClick={() => setEditing({ ...editing, items: [...editing.items, blankItem()] })} className="text-xs text-brand-blue hover:text-brand-blue/80">+ Add line</button>
                </div>
                <div className="space-y-2">
                  {editing.items.map((it, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input value={it.name} onChange={(e) => { const d = [...editing.items]; d[i] = { ...it, name: e.target.value }; setEditing({ ...editing, items: d }) }} placeholder="Material" className="col-span-4 bg-navy-800 border border-navy-700 text-white rounded px-2 py-1.5 text-sm" />
                      <input value={it.sku} onChange={(e) => { const d = [...editing.items]; d[i] = { ...it, sku: e.target.value }; setEditing({ ...editing, items: d }) }} placeholder="SKU" className="col-span-2 bg-navy-800 border border-navy-700 text-white rounded px-2 py-1.5 text-sm" />
                      <input type="number" min="0" value={it.quantity} onChange={(e) => { const d = [...editing.items]; d[i] = { ...it, quantity: e.target.value }; setEditing({ ...editing, items: d }) }} placeholder="Qty" className="col-span-1 bg-navy-800 border border-navy-700 text-white rounded px-2 py-1.5 text-sm text-right" />
                      <input value={it.unit} onChange={(e) => { const d = [...editing.items]; d[i] = { ...it, unit: e.target.value }; setEditing({ ...editing, items: d }) }} placeholder="unit" className="col-span-2 bg-navy-800 border border-navy-700 text-white rounded px-2 py-1.5 text-sm" />
                      <input type="number" min="0" value={it.unit_cost} onChange={(e) => { const d = [...editing.items]; d[i] = { ...it, unit_cost: e.target.value }; setEditing({ ...editing, items: d }) }} placeholder="$/unit" className="col-span-2 bg-navy-800 border border-navy-700 text-white rounded px-2 py-1.5 text-sm text-right" />
                      <button onClick={() => setEditing({ ...editing, items: editing.items.filter((_, j) => j !== i) })} className="col-span-1 text-gray-500 hover:text-red-400 text-center">×</button>
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm text-gray-300 mt-2">Order total: <span className="text-white font-semibold">{money(draftTotal)}</span></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="px-3 py-2 rounded-lg text-sm border border-navy-700 text-gray-300">Cancel</button>
              <button onClick={saveOrder} disabled={busy} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">Save order</button>
            </div>
          </div>
        </div>
      )}
    </HubPage>
  )
}
