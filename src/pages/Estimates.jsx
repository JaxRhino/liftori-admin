import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Sales Hub > Estimates (Liftori admin side).
// Reps build a line-item estimate from the Liftori product catalog (estimate_pricing),
// send it to the customer for in-house e-signature + a 50% deposit (live Stripe),
// and the products land in the Pipeline (customer_product_lines) so the deal is tracked.

const PUBLIC_BASE = 'https://admin.liftori.ai'
const MANAGER_ROLES = ['super_admin', 'admin', 'dev', 'sales_director']

const STATUS_STYLE = {
  draft:        'bg-slate-500/15 text-slate-300 border-slate-500/30',
  sent:         'bg-sky-500/15 text-sky-300 border-sky-500/30',
  viewed:       'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  signed:       'bg-blue-500/15 text-blue-300 border-blue-500/30',
  deposit_paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  declined:     'bg-rose-500/15 text-rose-300 border-rose-500/30',
  expired:      'bg-amber-500/15 text-amber-300 border-amber-500/30',
}
const STATUS_LABEL = { draft: 'Draft', sent: 'Sent', viewed: 'Viewed', signed: 'Signed', deposit_paid: 'Deposit Paid', declined: 'Declined', expired: 'Expired' }
const STATUS_ORDER = ['draft', 'sent', 'viewed', 'signed', 'deposit_paid', 'declined']

const usd = (n) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const SCOPE_LABEL = { crm: 'CRM & Software', website: 'Websites', custom_build: 'Custom Builds', consulting: 'Consulting', branding: 'Branding', bolo: 'BOLO Go' }

export default function Estimates() {
  const { profile, user } = useAuth()
  const role = profile?.role || 'customer'
  const isManager = MANAGER_ROLES.includes(role)
  const myId = profile?.id || user?.id

  const [tab, setTab] = useState('estimates')
  const [estimates, setEstimates] = useState([])
  const [catalog, setCatalog] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [building, setBuilding] = useState(false)
  const [detail, setDetail] = useState(null)
  const [toast, setToast] = useState(null)
  function flash(m) { setToast(m); setTimeout(() => setToast(null), 3500) }

  async function loadAll() {
    setLoading(true)
    const [er, cr, custR] = await Promise.all([
      supabase.from('sales_estimates').select('*').order('created_at', { ascending: false }),
      supabase.from('estimate_pricing').select('*').order('scope').order('sort'),
      supabase.from('profiles').select('id, full_name, company_name, email').eq('role', 'customer').order('company_name').limit(500),
    ])
    setEstimates(er.data || [])
    setCatalog(cr.data || [])
    setCustomers(custR.data || [])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  const counts = useMemo(() => {
    const c = {}
    for (const s of STATUS_ORDER) c[s] = 0
    for (const e of estimates) c[e.status] = (c[e.status] || 0) + 1
    return c
  }, [estimates])

  const visible = useMemo(
    () => statusFilter === 'all' ? estimates : estimates.filter(e => e.status === statusFilter),
    [estimates, statusFilter]
  )

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Estimates</h1>
            <p className="mt-1 text-sm text-slate-400">Build a quote from Liftori products, send it for signature and a 50% deposit, and track it in the pipeline.</p>
          </div>
          {tab === 'estimates' && <button onClick={() => setBuilding(true)} className="btn-primary shrink-0">New estimate</button>}
        </div>

        <div className="mt-6 flex gap-1 border-b border-navy-700">
          {[['estimates', 'Estimates'], ...(isManager ? [['catalog', 'Product Catalog']] : [])].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${tab === id ? 'border-brand-cyan text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'estimates' ? (
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              <Chip on={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All <span className="opacity-60">{estimates.length}</span></Chip>
              {STATUS_ORDER.map(s => (
                <Chip key={s} on={statusFilter === s} onClick={() => setStatusFilter(s)}>{STATUS_LABEL[s]} <span className="opacity-60">{counts[s] || 0}</span></Chip>
              ))}
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-slate-500">Loading estimates...</div>
            ) : visible.length === 0 ? (
              <div className="mt-6 rounded-xl border border-navy-700 bg-navy-800/50 py-16 text-center text-sm text-slate-500">
                No estimates here yet. Click "New estimate" to build one.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-navy-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-navy-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Estimate</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold text-right">One-time</th>
                      <th className="px-4 py-3 font-semibold text-right">Monthly</th>
                      <th className="px-4 py-3 font-semibold text-right">Deposit (50%)</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/60">
                    {visible.map(e => (
                      <tr key={e.id} onClick={() => setDetail(e)} className="cursor-pointer bg-navy-900/40 hover:bg-navy-800/60">
                        <td className="px-4 py-3 font-mono text-xs text-slate-300">{e.estimate_number || '-'}<div className="text-[11px] text-slate-500 font-sans">{e.title}</div></td>
                        <td className="px-4 py-3 text-white">{e.customer_name || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">{usd(e.subtotal_onetime)}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">{e.subtotal_monthly ? usd(e.subtotal_monthly) + '/mo' : '-'}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-brand-cyan">{usd(e.deposit_amount)}</td>
                        <td className="px-4 py-3"><span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[e.status] || ''}`}>{STATUS_LABEL[e.status] || e.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <CatalogTab catalog={catalog} reload={loadAll} flash={flash} />
        )}
      </div>

      {building && (
        <Builder catalog={catalog} customers={customers} myId={myId}
          onClose={() => setBuilding(false)}
          onSaved={(msg) => { setBuilding(false); flash(msg); loadAll() }} />
      )}

      {detail && (
        <DetailDrawer est={detail} customers={customers} myId={myId}
          onClose={() => setDetail(null)}
          onChanged={(msg) => { flash(msg); loadAll(); setDetail(null) }} />
      )}

      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-sky-600 px-4 py-3 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  )
}

function Chip({ on, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${on ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30' : 'bg-navy-800 text-slate-400 border border-navy-700 hover:text-white'}`}>{children}</button>
  )
}

/* ----------------------------- Builder ----------------------------- */
function Builder({ catalog, customers, myId, onClose, onSaved }) {
  const [customerId, setCustomerId] = useState('')
  const [custName, setCustName] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [pickScope, setPickScope] = useState('crm')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const scopes = useMemo(() => [...new Set(catalog.map(c => c.scope))], [catalog])
  useEffect(() => { if (scopes.length && !scopes.includes(pickScope)) setPickScope(scopes[0]) }, [scopes]) // eslint-disable-line

  function onCustomer(id) {
    setCustomerId(id)
    const c = customers.find(x => x.id === id)
    if (c) { setCustName(c.company_name || c.full_name || ''); setCustEmail(c.email || '') }
  }
  function addItem(cat) {
    setItems(prev => {
      const existing = prev.find(i => i.catalog_item_key === cat.item_key)
      if (existing) return prev.map(i => i.catalog_item_key === cat.item_key ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { catalog_item_key: cat.item_key, name: cat.label, category: cat.scope, billing: cat.billing === 'monthly' ? 'monthly' : 'one_time', qty: 1, unit_price: Number(cat.price) || 0 }]
    })
  }
  function setQty(key, qty) { setItems(prev => prev.map(i => i.catalog_item_key === key ? { ...i, qty: Math.max(1, Number(qty) || 1) } : i)) }
  function setPrice(key, price) { setItems(prev => prev.map(i => i.catalog_item_key === key ? { ...i, unit_price: Number(price) || 0 } : i)) }
  function removeItem(key) { setItems(prev => prev.filter(i => i.catalog_item_key !== key)) }

  const totals = useMemo(() => {
    let onetime = 0, monthly = 0
    for (const i of items) { const lt = i.qty * i.unit_price; if (i.billing === 'monthly') monthly += lt; else onetime += lt }
    const upfront = onetime + monthly
    return { onetime, monthly, upfront, deposit: +(upfront * 0.5).toFixed(2) }
  }, [items])

  async function save(send) {
    setErr(null)
    if (!custName.trim()) { setErr('Add a customer name.'); return }
    if (items.length === 0) { setErr('Add at least one product.'); return }
    setSaving(true)
    try {
      const { data: est, error: e1 } = await supabase.from('sales_estimates').insert({
        customer_id: customerId || null, customer_name: custName.trim(), customer_email: custEmail.trim() || null,
        owner_id: myId, created_by: myId, title: title.trim() || (items[0]?.name || 'Estimate'),
        status: 'draft', subtotal_onetime: totals.onetime, subtotal_monthly: totals.monthly,
        deposit_pct: 50, deposit_amount: totals.deposit, valid_until: validUntil || null, notes: notes.trim() || null,
      }).select().single()
      if (e1) throw e1
      const rows = items.map((i, idx) => ({
        estimate_id: est.id, catalog_item_key: i.catalog_item_key, name: i.name, category: i.category,
        billing: i.billing, qty: i.qty, unit_price: i.unit_price, line_total: +(i.qty * i.unit_price).toFixed(2), sort_order: idx,
      }))
      const { error: e2 } = await supabase.from('sales_estimate_items').insert(rows)
      if (e2) throw e2
      if (send) { await sendEstimate(est, custName, custEmail, customerId, myId, totals); onSaved('Estimate sent to ' + custName) }
      else onSaved('Estimate saved as draft')
    } catch (e) { setErr('Save failed: ' + (e.message || 'error')); setSaving(false) }
  }

  const scopeItems = catalog.filter(c => c.scope === pickScope)

  return (
    <Drawer title="New estimate" onClose={onClose} wide>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: customer + products */}
        <div className="space-y-4">
          <div>
            <label className="label">Existing customer (optional)</label>
            <select className="input" value={customerId} onChange={e => onCustomer(e.target.value)}>
              <option value="">- New / not listed -</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.full_name || c.email}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Customer name</label><input className="input" value={custName} onChange={e => setCustName(e.target.value)} /></div>
            <div><label className="label">Customer email</label><input className="input" value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="for the signature link" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Title</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. CRM Pro + Website" /></div>
            <div><label className="label">Valid until</label><input type="date" className="input" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
          </div>

          <div>
            <label className="label">Add products</label>
            <div className="mb-2 flex flex-wrap gap-1">
              {scopes.map(s => (
                <button key={s} onClick={() => setPickScope(s)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${pickScope === s ? 'bg-brand-cyan/15 text-brand-cyan' : 'bg-navy-800 text-slate-400 hover:text-white'}`}>{SCOPE_LABEL[s] || s}</button>
              ))}
            </div>
            <div className="max-h-56 space-y-1 overflow-auto rounded-lg border border-navy-700 bg-navy-900/40 p-2">
              {scopeItems.map(c => (
                <button key={c.id} onClick={() => addItem(c)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-navy-800">
                  <span className="truncate pr-2">{c.label}</span>
                  <span className="shrink-0 font-mono text-xs text-slate-400">{usd(c.price)}{c.billing === 'monthly' ? '/mo' : ''}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: cart + totals */}
        <div className="space-y-3">
          <label className="label">Line items</label>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-navy-700 py-10 text-center text-sm text-slate-500">Pick products on the left.</div>
          ) : (
            <div className="space-y-2">
              {items.map(i => (
                <div key={i.catalog_item_key} className="rounded-lg border border-navy-700 bg-navy-900/40 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-white">{i.name}</span>
                    <button onClick={() => removeItem(i.catalog_item_key)} className="text-xs text-rose-400/80 hover:text-rose-300">remove</button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input type="number" min="1" value={i.qty} onChange={e => setQty(i.catalog_item_key, e.target.value)} className="input h-8 w-16 py-1 text-sm" />
                    <span className="text-slate-500">x</span>
                    <input type="number" min="0" value={i.unit_price} onChange={e => setPrice(i.catalog_item_key, e.target.value)} className="input h-8 w-24 py-1 text-sm" />
                    <span className="text-[11px] text-slate-500">{i.billing === 'monthly' ? '/mo' : 'one-time'}</span>
                    <span className="ml-auto font-mono text-sm text-brand-cyan">{usd(i.qty * i.unit_price)}{i.billing === 'monthly' ? '/mo' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-navy-700 bg-navy-800/50 p-3 text-sm">
            <Row label="One-time subtotal" value={usd(totals.onetime)} />
            <Row label="Monthly subtotal" value={totals.monthly ? usd(totals.monthly) + '/mo' : usd(0)} />
            <Row label="Due upfront (one-time + first month)" value={usd(totals.upfront)} />
            <div className="mt-1 border-t border-navy-700 pt-1">
              <Row label="50% deposit to collect" value={usd(totals.deposit)} accent />
            </div>
          </div>

          <div><label className="label">Notes (shown to customer)</label><textarea className="input min-h-[60px]" value={notes} onChange={e => setNotes(e.target.value)} /></div>
          {err && <p className="text-xs text-rose-400">{err}</p>}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-white">Cancel</button>
            <button onClick={() => save(false)} disabled={saving} className="rounded-lg border border-navy-600 px-3 py-2 text-sm text-slate-200 hover:bg-navy-800 disabled:opacity-50">Save draft</button>
            <button onClick={() => save(true)} disabled={saving} className="btn-primary">{saving ? 'Working...' : 'Save & send'}</button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

function Row({ label, value, accent }) {
  return <div className="flex items-center justify-between py-0.5"><span className="text-slate-400">{label}</span><span className={`font-mono ${accent ? 'font-semibold text-brand-cyan' : 'text-slate-200'}`}>{value}</span></div>
}

/* ----------------------------- Send helper ----------------------------- */
async function sendEstimate(est, custName, custEmail, customerId, myId, totals) {
  const link = `${PUBLIC_BASE}/estimate/${est.public_token}`
  await supabase.from('sales_estimates').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', est.id)

  // Reflect products in the pipeline (one line per base product type), if linked to a customer.
  if (customerId) {
    try {
      const { data: its } = await supabase.from('sales_estimate_items').select('*').eq('estimate_id', est.id)
      const map = { crm: 'CRM', website: 'Website', custom_build: 'Custom Build' }
      const groups = {}
      for (const i of (its || [])) {
        const pt = map[i.category]; if (!pt) continue
        groups[pt] = groups[pt] || { onetime: 0, monthly: 0 }
        if (i.billing === 'monthly') groups[pt].monthly += Number(i.line_total) || 0
        else groups[pt].onetime += Number(i.line_total) || 0
      }
      await supabase.from('customer_product_lines').delete().eq('estimate_id', est.id)
      const lines = Object.entries(groups).map(([pt, g]) => ({
        profile_id: customerId, product_type: pt, stage: 'Estimate Sent',
        estimated_value: g.onetime, mrr: g.monthly, owner_id: myId, estimate_id: est.id,
        expected_close_date: est.valid_until || null,
        fulfillment_path: pt === 'Custom Build' ? 'build' : 'demo',
      }))
      if (lines.length) await supabase.from('customer_product_lines').insert(lines)
    } catch (e) { console.error('pipeline sync', e) }
  }

  // Email the public link (best-effort).
  if (custEmail) {
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="color:#0EA5E9">Your Liftori estimate is ready</h2>
      <p>Hi ${custName || 'there'}, your estimate ${est.estimate_number || ''} is ready to review.</p>
      <p>One-time: <b>${usd(totals.onetime)}</b>${totals.monthly ? ` &middot; Monthly: <b>${usd(totals.monthly)}/mo</b>` : ''}<br/>
      50% deposit to get started: <b>${usd(totals.deposit)}</b></p>
      <p><a href="${link}" style="display:inline-block;background:#0EA5E9;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Review, sign &amp; pay deposit</a></p>
      <p style="font-size:12px;color:#64748b">Or paste this link: ${link}</p>
    </div>`
    try { await supabase.functions.invoke('send-email', { body: { to: custEmail, subject: `Your Liftori estimate ${est.estimate_number || ''}`, html } }) }
    catch (e) { console.error('send-email', e) }
  }
}

/* ----------------------------- Detail drawer ----------------------------- */
function DetailDrawer({ est, customers, myId, onClose, onChanged }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const link = `${PUBLIC_BASE}/estimate/${est.public_token}`

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('sales_estimate_items').select('*').eq('estimate_id', est.id).order('sort_order')
      setItems(data || []); setLoading(false)
    })()
  }, [est.id])

  const totals = useMemo(() => {
    let onetime = 0, monthly = 0
    for (const i of items) { if (i.billing === 'monthly') monthly += Number(i.line_total) || 0; else onetime += Number(i.line_total) || 0 }
    return { onetime, monthly }
  }, [items])

  async function doSend() {
    setBusy(true)
    try {
      await sendEstimate(est, est.customer_name, est.customer_email, est.customer_id, est.owner_id || myId,
        { onetime: totals.onetime, monthly: totals.monthly, deposit: est.deposit_amount })
      onChanged(est.status === 'draft' ? 'Estimate sent' : 'Estimate re-sent')
    } catch (e) { alert('Send failed: ' + (e.message || '')); setBusy(false) }
  }
  async function setStatus(s) {
    setBusy(true)
    const patch = { status: s, updated_at: new Date().toISOString() }
    if (s === 'declined') patch.declined_at = new Date().toISOString()
    const { error } = await supabase.from('sales_estimates').update(patch).eq('id', est.id)
    if (error) { alert(error.message); setBusy(false); return }
    onChanged('Marked ' + (STATUS_LABEL[s] || s))
  }
  async function del() {
    if (!confirm('Delete this estimate?')) return
    setBusy(true)
    await supabase.from('customer_product_lines').delete().eq('estimate_id', est.id)
    const { error } = await supabase.from('sales_estimates').delete().eq('id', est.id)
    if (error) { alert(error.message); setBusy(false); return }
    onChanged('Estimate deleted')
  }
  function copyLink() { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  return (
    <Drawer title={(est.estimate_number || 'Estimate') + (est.title ? ' - ' + est.title : '')} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[est.status] || ''}`}>{STATUS_LABEL[est.status] || est.status}</span>
          <span className="text-sm text-slate-300">{est.customer_name}</span>
          {est.customer_email && <span className="text-xs text-slate-500">{est.customer_email}</span>}
        </div>

        {loading ? <div className="py-8 text-center text-sm text-slate-500">Loading...</div> : (
          <div className="overflow-hidden rounded-xl border border-navy-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-800 text-[11px] uppercase tracking-wider text-slate-400">
                <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-navy-700/60">
                {items.map(i => (
                  <tr key={i.id} className="bg-navy-900/40">
                    <td className="px-3 py-2 text-white">{i.name}<span className="ml-1 text-[11px] text-slate-500">{i.billing === 'monthly' ? '(monthly)' : ''}</span></td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">{i.qty}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">{usd(i.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-brand-cyan">{usd(i.line_total)}{i.billing === 'monthly' ? '/mo' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-lg border border-navy-700 bg-navy-800/50 p-3 text-sm">
          <Row label="One-time" value={usd(totals.onetime)} />
          <Row label="Monthly" value={totals.monthly ? usd(totals.monthly) + '/mo' : usd(0)} />
          <Row label="50% deposit" value={usd(est.deposit_amount)} accent />
        </div>

        <div className="rounded-lg border border-navy-700 bg-navy-900/40 p-3 text-sm space-y-1">
          {est.signed_at ? <p className="text-emerald-300">Signed by {est.signer_name} on {new Date(est.signed_at).toLocaleString()}</p> : <p className="text-slate-500">Not signed yet</p>}
          {est.deposit_paid_at ? <p className="text-emerald-300">Deposit paid {new Date(est.deposit_paid_at).toLocaleString()}</p> : <p className="text-slate-500">Deposit not paid</p>}
        </div>

        <div>
          <label className="label">Customer signature link</label>
          <div className="flex gap-2">
            <input readOnly value={link} className="input flex-1 text-xs" onFocus={e => e.target.select()} />
            <button onClick={copyLink} className="rounded-lg border border-navy-600 px-3 text-sm text-slate-200 hover:bg-navy-800">{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button onClick={del} disabled={busy} className="text-xs text-rose-400/80 hover:text-rose-300">Delete</button>
          <div className="flex gap-2">
            {est.status !== 'declined' && est.status !== 'deposit_paid' && <button onClick={() => setStatus('declined')} disabled={busy} className="rounded-lg border border-navy-600 px-3 py-2 text-sm text-slate-300 hover:bg-navy-800">Mark declined</button>}
            <button onClick={doSend} disabled={busy} className="btn-primary">{est.status === 'draft' ? 'Send to customer' : 'Resend'}</button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

/* ----------------------------- Catalog tab ----------------------------- */
function CatalogTab({ catalog, reload, flash }) {
  const [editing, setEditing] = useState(null)
  const grouped = useMemo(() => {
    const g = {}
    for (const c of catalog) { (g[c.scope] = g[c.scope] || []).push(c) }
    return g
  }, [catalog])

  async function save(row) {
    const payload = { label: row.label, price: Number(row.price) || 0, billing: row.billing, active: row.active, scope: row.scope, category: row.category || 'base', item_key: row.item_key, sort: Number(row.sort) || 0 }
    const res = row.id ? await supabase.from('estimate_pricing').update(payload).eq('id', row.id) : await supabase.from('estimate_pricing').insert(payload)
    if (res.error) { flash('Save failed: ' + res.error.message); return }
    flash('Saved'); setEditing(null); reload()
  }
  async function toggle(c) {
    const { error } = await supabase.from('estimate_pricing').update({ active: !c.active }).eq('id', c.id)
    if (error) { flash('Failed: ' + error.message); return }
    reload()
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ scope: 'crm', category: 'base', item_key: '', label: '', price: 0, billing: 'monthly', active: true, sort: 0 })} className="btn-primary">Add product</button>
      </div>
      {Object.entries(grouped).map(([scope, items]) => (
        <div key={scope}>
          <h3 className="mb-2 text-sm font-semibold text-white">{SCOPE_LABEL[scope] || scope}</h3>
          <div className="overflow-hidden rounded-xl border border-navy-700">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-navy-700/60">
                {items.map(c => (
                  <tr key={c.id} className={`bg-navy-900/40 ${!c.active ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 text-white">{c.label}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">{usd(c.price)}{c.billing === 'monthly' ? '/mo' : c.billing === 'one_time' ? '' : ' (quote)'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => toggle(c)} className="text-xs text-slate-400 hover:text-white">{c.active ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => setEditing(c)} className="ml-3 text-xs text-brand-cyan hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {editing && (
        <Drawer title={editing.id ? 'Edit product' : 'Add product'} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <div><label className="label">Label</label><input className="input" value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Scope</label><input className="input" value={editing.scope} onChange={e => setEditing({ ...editing, scope: e.target.value })} placeholder="crm / website / custom_build" /></div>
              <div><label className="label">Item key</label><input className="input" value={editing.item_key} onChange={e => setEditing({ ...editing, item_key: e.target.value })} placeholder="unique_key" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Price</label><input type="number" className="input" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} /></div>
              <div><label className="label">Billing</label>
                <select className="input" value={editing.billing} onChange={e => setEditing({ ...editing, billing: e.target.value })}>
                  <option value="one_time">One-time</option><option value="monthly">Monthly</option><option value="quote">Quote</option>
                </select>
              </div>
              <div><label className="label">Sort</label><input type="number" className="input" value={editing.sort} onChange={e => setEditing({ ...editing, sort: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={() => setEditing(null)} className="text-sm text-slate-400 hover:text-white">Cancel</button>
              <button onClick={() => save(editing)} className="btn-primary">Save</button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}

/* ----------------------------- Drawer shell ----------------------------- */
function Drawer({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`h-full ${wide ? 'w-full max-w-3xl' : 'w-full max-w-xl'} overflow-auto border-l border-navy-700 bg-navy-900 p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
