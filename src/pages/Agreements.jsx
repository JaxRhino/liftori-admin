import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Sales Hub > Agreements (Liftori admin side).
// Build a contract from an editable template, send it to the customer for in-house
// e-signature via a public link, then a Liftori admin countersigns to fully execute it.

const PUBLIC_BASE = 'https://admin.liftori.ai'
const LIFTORI_ENTITY = 'Liftori, LLC'
const MANAGER_ROLES = ['super_admin', 'admin', 'dev', 'sales_director']

const STATUS_STYLE = {
  draft:         'bg-slate-500/15 text-slate-300 border-slate-500/30',
  sent:          'bg-sky-500/15 text-sky-300 border-sky-500/30',
  viewed:        'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  signed:        'bg-blue-500/15 text-blue-300 border-blue-500/30',
  countersigned: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  declined:      'bg-rose-500/15 text-rose-300 border-rose-500/30',
  expired:       'bg-amber-500/15 text-amber-300 border-amber-500/30',
}
const STATUS_LABEL = { draft: 'Draft', sent: 'Sent', viewed: 'Viewed', signed: 'Signed', countersigned: 'Executed', declined: 'Declined', expired: 'Expired' }
const STATUS_ORDER = ['draft', 'sent', 'viewed', 'signed', 'countersigned', 'declined']
const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })

function render(body, m) {
  if (!body) return ''
  return body
    .replaceAll('{{liftori_entity}}', LIFTORI_ENTITY)
    .replaceAll('{{customer_company}}', m.company || '')
    .replaceAll('{{customer_name}}', m.contact || '')
    .replaceAll('{{effective_date}}', m.effective_date || today())
    .replaceAll('{{amount}}', m.amount || '')
    .replaceAll('{{term}}', m.term || '')
    .replaceAll('{{title}}', m.title || '')
    .replaceAll('{{date}}', today())
}

export default function Agreements() {
  const { profile, user } = useAuth()
  const role = profile?.role || 'customer'
  const isManager = MANAGER_ROLES.includes(role)
  const isAdmin = ['super_admin', 'admin', 'dev', 'sales_director'].includes(role)
  const myId = profile?.id || user?.id
  const myName = profile?.full_name || profile?.email || 'Liftori'

  const [tab, setTab] = useState('agreements')
  const [agreements, setAgreements] = useState([])
  const [templates, setTemplates] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [building, setBuilding] = useState(false)
  const [detail, setDetail] = useState(null)
  const [toast, setToast] = useState(null)
  function flash(m) { setToast(m); setTimeout(() => setToast(null), 3500) }

  async function loadAll() {
    setLoading(true)
    const [ar, tr, cr] = await Promise.all([
      supabase.from('sales_agreements').select('*').order('created_at', { ascending: false }),
      supabase.from('agreement_templates').select('*').order('sort_order'),
      supabase.from('profiles').select('id, full_name, company_name, email').eq('role', 'customer').order('company_name').limit(500),
    ])
    setAgreements(ar.data || []); setTemplates(tr.data || []); setCustomers(cr.data || [])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  const counts = useMemo(() => {
    const c = {}; for (const s of STATUS_ORDER) c[s] = 0
    for (const a of agreements) c[a.status] = (c[a.status] || 0) + 1
    return c
  }, [agreements])
  const visible = useMemo(() => statusFilter === 'all' ? agreements : agreements.filter(a => a.status === statusFilter), [agreements, statusFilter])

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Agreements</h1>
            <p className="mt-1 text-sm text-slate-400">Send contracts for e-signature. The customer signs online, then Liftori countersigns to fully execute.</p>
          </div>
          {tab === 'agreements' && <button onClick={() => setBuilding(true)} className="btn-primary shrink-0">New agreement</button>}
        </div>

        <div className="mt-6 flex gap-1 border-b border-navy-700">
          {[['agreements', 'Agreements'], ...(isManager ? [['templates', 'Templates']] : [])].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${tab === id ? 'border-brand-cyan text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{label}</button>
          ))}
        </div>

        {tab === 'agreements' ? (
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              <Chip on={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All <span className="opacity-60">{agreements.length}</span></Chip>
              {STATUS_ORDER.map(s => <Chip key={s} on={statusFilter === s} onClick={() => setStatusFilter(s)}>{STATUS_LABEL[s]} <span className="opacity-60">{counts[s] || 0}</span></Chip>)}
            </div>
            {loading ? <div className="py-16 text-center text-sm text-slate-500">Loading...</div>
              : visible.length === 0 ? <div className="mt-6 rounded-xl border border-navy-700 bg-navy-800/50 py-16 text-center text-sm text-slate-500">No agreements here yet. Click "New agreement" to create one.</div>
              : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-navy-700">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-navy-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <tr><th className="px-4 py-3 font-semibold">Agreement</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700/60">
                      {visible.map(a => (
                        <tr key={a.id} onClick={() => setDetail(a)} className="cursor-pointer bg-navy-900/40 hover:bg-navy-800/60">
                          <td className="px-4 py-3 font-mono text-xs text-slate-300">{a.agreement_number}<div className="font-sans text-[11px] text-slate-500">{a.title}</div></td>
                          <td className="px-4 py-3 text-white">{a.customer_name || '-'}</td>
                          <td className="px-4 py-3 text-slate-400 capitalize">{(a.category || '').replace('_', ' ')}</td>
                          <td className="px-4 py-3"><span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[a.status] || ''}`}>{STATUS_LABEL[a.status] || a.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        ) : (
          <TemplatesTab templates={templates} reload={loadAll} flash={flash} />
        )}
      </div>

      {building && <Builder templates={templates} customers={customers} myId={myId} onClose={() => setBuilding(false)} onSaved={(m) => { setBuilding(false); flash(m); loadAll() }} />}
      {detail && <DetailDrawer ag={detail} isAdmin={isAdmin} myName={myName} onClose={() => setDetail(null)} onChanged={(m) => { flash(m); loadAll(); setDetail(null) }} onLocalRefresh={(updated) => setDetail(updated)} />}
      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-sky-600 px-4 py-3 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  )
}

function Chip({ on, onClick, children }) {
  return <button onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${on ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30' : 'bg-navy-800 text-slate-400 border border-navy-700 hover:text-white'}`}>{children}</button>
}

/* ----------------------------- Builder ----------------------------- */
function Builder({ templates, customers, myId, onClose, onSaved }) {
  const [customerId, setCustomerId] = useState('')
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [templateKey, setTemplateKey] = useState(templates[0]?.template_key || '')
  const [amount, setAmount] = useState('')
  const [term, setTerm] = useState('12 months')
  const [effective, setEffective] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const tpl = templates.find(t => t.template_key === templateKey)
  function mergeObj() { return { company, contact, amount, term, effective_date: effective || today(), title: title || tpl?.name } }
  function applyTemplate(key) {
    const t = templates.find(x => x.template_key === key) || tpl
    setTemplateKey(key)
    if (t) { setBody(render(t.body, mergeObj())); if (!title) setTitle(t.name) }
  }
  function reapply() { if (tpl) setBody(render(tpl.body, mergeObj())) }
  useEffect(() => { if (tpl && !body) setBody(render(tpl.body, mergeObj())) }, []) // eslint-disable-line

  function onCustomer(id) {
    setCustomerId(id)
    const c = customers.find(x => x.id === id)
    if (c) { setCompany(c.company_name || c.full_name || ''); setContact(c.full_name || ''); setEmail(c.email || '') }
  }

  async function save(send) {
    setErr(null)
    if (!company.trim()) { setErr('Add a customer / company name.'); return }
    if (!body.trim()) { setErr('Pick a template or write the agreement body.'); return }
    setSaving(true)
    try {
      const { data: ag, error } = await supabase.from('sales_agreements').insert({
        customer_id: customerId || null, customer_name: company.trim(), customer_email: email.trim() || null,
        owner_id: myId, created_by: myId, template_key: templateKey || null, category: tpl?.category || 'custom',
        title: title.trim() || (tpl?.name || 'Agreement'), body, status: 'draft',
        valid_until: validUntil || null, merge_values: mergeObj(),
      }).select().single()
      if (error) throw error
      if (send) { await sendAgreement(ag, company, email); onSaved('Agreement sent to ' + company) }
      else onSaved('Agreement saved as draft')
    } catch (e) { setErr('Save failed: ' + (e.message || 'error')); setSaving(false) }
  }

  return (
    <Drawer title="New agreement" onClose={onClose} wide>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="label">Existing customer (optional)</label>
            <select className="input" value={customerId} onChange={e => onCustomer(e.target.value)}>
              <option value="">- New / not listed -</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.full_name || c.email}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Company</label><input className="input" value={company} onChange={e => setCompany(e.target.value)} /></div>
            <div><label className="label">Signer name</label><input className="input" value={contact} onChange={e => setContact(e.target.value)} /></div>
          </div>
          <div><label className="label">Signer email</label><input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="for the signature link" /></div>
          <div>
            <label className="label">Template</label>
            <select className="input" value={templateKey} onChange={e => applyTemplate(e.target.value)}>
              {templates.map(t => <option key={t.template_key} value={t.template_key}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount / value</label><input className="input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="$1,800" /></div>
            <div><label className="label">Term</label><input className="input" value={term} onChange={e => setTerm(e.target.value)} placeholder="12 months" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Effective date</label><input type="date" className="input" value={effective} onChange={e => setEffective(e.target.value)} /></div>
            <div><label className="label">Valid until</label><input type="date" className="input" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
          </div>
          <div><label className="label">Title</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <button onClick={reapply} type="button" className="rounded-lg border border-navy-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-navy-800">Re-apply template &amp; fields to body</button>
        </div>

        <div className="space-y-3">
          <label className="label">Agreement body (editable)</label>
          <textarea className="input min-h-[420px] font-mono text-[12px] leading-relaxed" value={body} onChange={e => setBody(e.target.value)} />
          {err && <p className="text-xs text-rose-400">{err}</p>}
          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-white">Cancel</button>
            <button onClick={() => save(false)} disabled={saving} className="rounded-lg border border-navy-600 px-3 py-2 text-sm text-slate-200 hover:bg-navy-800 disabled:opacity-50">Save draft</button>
            <button onClick={() => save(true)} disabled={saving} className="btn-primary">{saving ? 'Working...' : 'Save & send'}</button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

/* ----------------------------- Send helper ----------------------------- */
async function sendAgreement(ag, company, email) {
  const link = `${PUBLIC_BASE}/agreement/${ag.public_token}`
  await supabase.from('sales_agreements').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', ag.id)
  if (email) {
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="color:#0EA5E9">Please review and sign your agreement</h2>
      <p>Hi ${company || 'there'}, your agreement ${ag.agreement_number || ''} (${ag.title || ''}) is ready for signature.</p>
      <p><a href="${link}" style="display:inline-block;background:#0EA5E9;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Review &amp; sign</a></p>
      <p style="font-size:12px;color:#64748b">Or paste this link: ${link}</p></div>`
    try { await supabase.functions.invoke('send-email', { body: { to: email, subject: `Please sign: ${ag.title || 'Liftori agreement'} ${ag.agreement_number || ''}`, html } }) } catch (e) { console.error(e) }
  }
}

/* ----------------------------- Detail drawer ----------------------------- */
function DetailDrawer({ ag, isAdmin, myName, onClose, onChanged, onLocalRefresh }) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [countersignName, setCountersignName] = useState(myName)
  const link = `${PUBLIC_BASE}/agreement/${ag.public_token}`

  async function doSend() {
    setBusy(true)
    try { await sendAgreement(ag, ag.customer_name, ag.customer_email); onChanged(ag.status === 'draft' ? 'Agreement sent' : 'Agreement re-sent') }
    catch (e) { alert('Send failed: ' + (e.message || '')); setBusy(false) }
  }
  async function countersign() {
    setBusy(true)
    const { data, error } = await supabase.rpc('countersign_sales_agreement', { p_id: ag.id, p_name: countersignName.trim() || myName })
    if (error || !data?.ok) { alert('Countersign failed: ' + (data?.error || error?.message || '')); setBusy(false); return }
    onChanged('Agreement fully executed')
  }
  async function setStatus(s) {
    setBusy(true)
    const patch = { status: s, updated_at: new Date().toISOString() }
    if (s === 'declined') patch.declined_at = new Date().toISOString()
    const { error } = await supabase.from('sales_agreements').update(patch).eq('id', ag.id)
    if (error) { alert(error.message); setBusy(false); return }
    onChanged('Marked ' + (STATUS_LABEL[s] || s))
  }
  async function del() {
    if (!confirm('Delete this agreement?')) return
    setBusy(true)
    const { error } = await supabase.from('sales_agreements').delete().eq('id', ag.id)
    if (error) { alert(error.message); setBusy(false); return }
    onChanged('Agreement deleted')
  }
  function copyLink() { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  return (
    <Drawer title={(ag.agreement_number || 'Agreement') + (ag.title ? ' - ' + ag.title : '')} onClose={onClose} wide>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[ag.status] || ''}`}>{STATUS_LABEL[ag.status] || ag.status}</span>
            <span className="text-sm text-slate-300">{ag.customer_name}</span>
            {ag.customer_email && <span className="text-xs text-slate-500">{ag.customer_email}</span>}
          </div>
          <div className="rounded-lg border border-navy-700 bg-navy-900/60 p-3 text-sm space-y-1">
            <p className={ag.signed_at ? 'text-emerald-300' : 'text-slate-500'}>{ag.signed_at ? `Customer signed by ${ag.signer_name} on ${new Date(ag.signed_at).toLocaleString()}` : 'Customer has not signed yet'}</p>
            <p className={ag.countersigned_at ? 'text-emerald-300' : 'text-slate-500'}>{ag.countersigned_at ? `Countersigned by ${ag.countersigner_name} on ${new Date(ag.countersigned_at).toLocaleString()} - fully executed` : 'Awaiting Liftori countersignature'}</p>
          </div>

          {/* Countersign */}
          {isAdmin && ag.status === 'signed' && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-sm font-medium text-emerald-300">Countersign to fully execute</p>
              <input className="input mt-2" value={countersignName} onChange={e => setCountersignName(e.target.value)} placeholder="Your name" />
              <button onClick={countersign} disabled={busy} className="btn-primary mt-2 w-full">{busy ? 'Working...' : 'Countersign & execute'}</button>
            </div>
          )}

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
              {ag.status !== 'declined' && ag.status !== 'countersigned' && <button onClick={() => setStatus('declined')} disabled={busy} className="rounded-lg border border-navy-600 px-3 py-2 text-sm text-slate-300 hover:bg-navy-800">Mark declined</button>}
              {ag.status !== 'countersigned' && <button onClick={doSend} disabled={busy} className="btn-primary">{ag.status === 'draft' ? 'Send to customer' : 'Resend'}</button>}
            </div>
          </div>
        </div>

        <div>
          <label className="label">Agreement</label>
          <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-navy-700 bg-navy-900/60 p-4 font-mono text-[12px] leading-relaxed text-slate-300">{ag.body}</div>
        </div>
      </div>
    </Drawer>
  )
}

/* ----------------------------- Templates tab ----------------------------- */
function TemplatesTab({ templates, reload, flash }) {
  const [editing, setEditing] = useState(null)
  async function save(row) {
    const payload = { template_key: row.template_key, name: row.name, category: row.category, body: row.body, active: row.active, sort_order: Number(row.sort_order) || 0, updated_at: new Date().toISOString() }
    const res = row.id ? await supabase.from('agreement_templates').update(payload).eq('id', row.id) : await supabase.from('agreement_templates').insert(payload)
    if (res.error) { flash('Save failed: ' + res.error.message); return }
    flash('Template saved'); setEditing(null); reload()
  }
  return (
    <div className="mt-6 space-y-3">
      <div className="flex justify-end"><button onClick={() => setEditing({ template_key: '', name: '', category: 'custom', body: '', active: true, sort_order: 0 })} className="btn-primary">Add template</button></div>
      <div className="overflow-hidden rounded-xl border border-navy-700">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-navy-700/60">
            {templates.map(t => (
              <tr key={t.id} className={`bg-navy-900/40 ${!t.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-white">{t.name}<div className="text-[11px] text-slate-500 capitalize">{(t.category || '').replace('_', ' ')}</div></td>
                <td className="px-4 py-3 text-right"><button onClick={() => setEditing(t)} className="text-xs text-brand-cyan hover:underline">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">Use merge fields in the body: {'{{customer_company}}'}, {'{{customer_name}}'}, {'{{effective_date}}'}, {'{{amount}}'}, {'{{term}}'}, {'{{title}}'}, {'{{liftori_entity}}'}. These are not legal advice - have counsel review before relying on them.</p>

      {editing && (
        <Drawer title={editing.id ? 'Edit template' : 'Add template'} onClose={() => setEditing(null)} wide>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Name</label><input className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><label className="label">Category</label><input className="input" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="nda / msa / sow / managed_services / custom" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Key</label><input className="input" value={editing.template_key} onChange={e => setEditing({ ...editing, template_key: e.target.value })} placeholder="unique_key" /></div>
              <div><label className="label">Sort</label><input type="number" className="input" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: e.target.value })} /></div>
            </div>
            <div><label className="label">Body</label><textarea className="input min-h-[420px] font-mono text-[12px]" value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} /></div>
            <div className="flex items-center justify-end gap-3"><button onClick={() => setEditing(null)} className="text-sm text-slate-400 hover:text-white">Cancel</button><button onClick={() => save(editing)} className="btn-primary">Save</button></div>
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
      <div onClick={e => e.stopPropagation()} className={`h-full ${wide ? 'w-full max-w-4xl' : 'w-full max-w-xl'} overflow-auto border-l border-navy-700 bg-navy-900 p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
