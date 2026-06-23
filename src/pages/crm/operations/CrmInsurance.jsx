import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, useCrmClient } from '../_shared'
import { toast } from 'sonner'

// Insurance claim workflow. Reads the tenant's OWN Supabase via useCrmClient().
// Tracks claims (carrier, claim #, adjuster, dates, Xactimate RCV/ACV/deductible/
// depreciation, status) per customer + supplement tracking (insurance_claims,
// claim_supplements). Roofing/storm tenants use this to manage carrier claims.

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()
const num = (v) => Number(v) || 0
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const STATUSES = ['filed', 'inspection', 'approved', 'supplement', 'paid', 'denied', 'closed']
const statusMeta = {
  filed: { label: 'Filed', color: 'bg-blue-500/20 text-blue-300' },
  inspection: { label: 'Inspection', color: 'bg-amber-500/20 text-amber-300' },
  approved: { label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300' },
  supplement: { label: 'Supplement', color: 'bg-purple-500/20 text-purple-300' },
  paid: { label: 'Paid', color: 'bg-emerald-600/20 text-emerald-300' },
  denied: { label: 'Denied', color: 'bg-red-500/20 text-red-300' },
  closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-300' },
}
const supMeta = {
  submitted: { label: 'Submitted', color: 'bg-amber-500/20 text-amber-300' },
  approved: { label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300' },
  denied: { label: 'Denied', color: 'bg-red-500/20 text-red-300' },
}
const blankClaim = () => ({ contact_id: '', claim_number: '', carrier: '', policy_number: '', adjuster_name: '', adjuster_phone: '', adjuster_email: '', date_of_loss: '', date_filed: '', status: 'filed', rcv: '', acv: '', deductible: '', depreciation: '', approved_amount: '', xactimate_ref: '', notes: '' })

function Fld({ label, children }) { return <div><label className="block text-xs text-gray-400 mb-1">{label}</label>{children}</div> }
const inputCls = 'w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm'

export default function CrmInsurance() {
  const { client } = useCrmClient()
  const [claims, setClaims] = useState([])
  const [supplements, setSupplements] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(null)
  const [supForm, setSupForm] = useState({ description: '', amount: '' })

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client])

  async function load() {
    try {
      setLoading(true)
      const [cRes, sRes, ctRes] = await Promise.all([
        client.from('insurance_claims').select('*').order('created_at', { ascending: false }),
        client.from('claim_supplements').select('*').order('created_at', { ascending: false }),
        client.from('customer_contacts').select('id, first_name, last_name').order('first_name'),
      ])
      setClaims(cRes?.data || [])
      setSupplements(sRes?.data || [])
      setContacts(ctRes?.data || [])
    } catch (e) { console.error('insurance load failed', e); toast.error('Failed to load claims') } finally { setLoading(false) }
  }

  const contactById = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ')])), [contacts])
  const supsForClaim = (cid) => supplements.filter((s) => s.claim_id === cid)
  const supApproved = (cid) => supsForClaim(cid).filter((s) => s.status === 'approved').reduce((t, s) => t + num(s.amount), 0)

  const stats = useMemo(() => {
    const open = claims.filter((c) => !['paid', 'denied', 'closed'].includes(c.status))
    return {
      open: open.length,
      rcv: open.reduce((t, c) => t + num(c.rcv), 0),
      approved: claims.reduce((t, c) => t + num(c.approved_amount), 0),
      supPending: supplements.filter((s) => s.status === 'submitted').length,
    }
  }, [claims, supplements])

  async function saveClaim() {
    if (!edit.contact_id) { toast.error('Pick a customer'); return }
    if (!edit.claim_number && !edit.carrier) { toast.error('Add a claim # or carrier'); return }
    setBusy(true)
    try {
      const patch = {
        contact_id: edit.contact_id, claim_number: edit.claim_number || null, carrier: edit.carrier || null,
        policy_number: edit.policy_number || null, adjuster_name: edit.adjuster_name || null,
        adjuster_phone: edit.adjuster_phone || null, adjuster_email: edit.adjuster_email || null,
        date_of_loss: edit.date_of_loss || null, date_filed: edit.date_filed || null, status: edit.status,
        rcv: num(edit.rcv), acv: num(edit.acv), deductible: num(edit.deductible), depreciation: num(edit.depreciation),
        approved_amount: num(edit.approved_amount), xactimate_ref: edit.xactimate_ref || null, notes: edit.notes || null,
        updated_at: new Date().toISOString(),
      }
      if (edit.id) {
        const { error } = await client.from('insurance_claims').update(patch).eq('id', edit.id)
        if (error) throw error
      } else {
        const { data, error } = await client.from('insurance_claims').insert(patch).select().single()
        if (error) throw error
        setEdit({ ...edit, id: data.id })
      }
      toast.success('Claim saved')
      await load()
    } catch (e) { console.error(e); toast.error('Save failed') } finally { setBusy(false) }
  }

  async function removeClaim(c) {
    if (!window.confirm('Delete this claim and its supplements?')) return
    try { await client.from('insurance_claims').delete().eq('id', c.id); toast.success('Claim deleted'); setEdit(null); await load() }
    catch (e) { console.error(e); toast.error('Delete failed') }
  }

  async function addSupplement() {
    if (!edit.id) { toast.error('Save the claim first'); return }
    if (!supForm.description) { toast.error('Add a description'); return }
    try {
      const { error } = await client.from('claim_supplements').insert({ claim_id: edit.id, description: supForm.description, amount: num(supForm.amount), status: 'submitted' })
      if (error) throw error
      setSupForm({ description: '', amount: '' })
      toast.success('Supplement added')
      await load()
    } catch (e) { console.error(e); toast.error('Could not add supplement') }
  }

  async function setSupStatus(s, status) {
    try {
      await client.from('claim_supplements').update({ status, approved_at: status === 'approved' ? new Date().toISOString().slice(0, 10) : null }).eq('id', s.id)
      await load()
    } catch (e) { console.error(e); toast.error('Update failed') }
  }
  async function removeSupplement(s) {
    try { await client.from('claim_supplements').delete().eq('id', s.id); await load() }
    catch (e) { console.error(e); toast.error('Delete failed') }
  }

  return (
    <HubPage title="Insurance Claims" subtitle="Carrier claims, adjusters, Xactimate values, and supplement tracking."
      actions={<button onClick={() => { setEdit(blankClaim()); setSupForm({ description: '', amount: '' }) }} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">New claim</button>}>
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Open Claims" value={stats.open} accent="text-brand-blue" />
            <StatCard label="Open RCV" value={money(stats.rcv)} />
            <StatCard label="Approved" value={money(stats.approved)} accent="text-emerald-400" />
            <StatCard label="Supplements Pending" value={stats.supPending} accent={stats.supPending ? 'text-amber-400' : 'text-gray-300'} />
          </div>

          <Section title="Claims">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Claim #</th>
                  <th className="text-left px-4 py-3 font-medium">Carrier</th>
                  <th className="text-left px-4 py-3 font-medium">Adjuster</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">RCV</th>
                  <th className="text-left px-4 py-3 font-medium">Loss date</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {claims.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-500">No claims yet. Click “New claim” to start one.</td></tr>}
                  {claims.map((c) => {
                    const sm = statusMeta[c.status] || statusMeta.filed
                    return (
                      <tr key={c.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3 text-gray-300">{contactById[c.contact_id] || '—'}</td>
                        <td className="px-4 py-3 text-white font-mono text-xs">{c.claim_number || '—'}</td>
                        <td className="px-4 py-3 text-gray-300">{c.carrier || '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{c.adjuster_name || '—'}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${sm.color}`}>{sm.label}</span></td>
                        <td className="px-4 py-3 text-right text-gray-300">{c.rcv ? money(c.rcv) : '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{fmtDate(c.date_of_loss)}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button onClick={() => { setEdit({ ...c, rcv: c.rcv || '', acv: c.acv || '', deductible: c.deductible || '', depreciation: c.depreciation || '', approved_amount: c.approved_amount || '', date_of_loss: c.date_of_loss || '', date_filed: c.date_filed || '' }); setSupForm({ description: '', amount: '' }) }} className="px-2 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue rounded text-xs transition mr-1">Open</button>
                          <button onClick={() => removeClaim(c)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition">Delete</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* claim editor */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEdit(null)}>
          <div className="bg-navy-900 border border-navy-800 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">{edit.id ? 'Claim details' : 'New claim'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Customer"><select value={edit.contact_id} onChange={(e) => setEdit({ ...edit, contact_id: e.target.value })} className={inputCls}><option value="">Select...</option>{contacts.map((c) => <option key={c.id} value={c.id}>{[c.first_name, c.last_name].filter(Boolean).join(' ')}</option>)}</select></Fld>
                <Fld label="Status"><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className={inputCls}>{STATUSES.map((s) => <option key={s} value={s}>{statusMeta[s].label}</option>)}</select></Fld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Claim #"><input value={edit.claim_number} onChange={(e) => setEdit({ ...edit, claim_number: e.target.value })} className={inputCls} placeholder="CLM-0098451" /></Fld>
                <Fld label="Carrier"><input value={edit.carrier} onChange={(e) => setEdit({ ...edit, carrier: e.target.value })} className={inputCls} placeholder="State Farm" /></Fld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Policy #"><input value={edit.policy_number} onChange={(e) => setEdit({ ...edit, policy_number: e.target.value })} className={inputCls} /></Fld>
                <Fld label="Xactimate ref"><input value={edit.xactimate_ref} onChange={(e) => setEdit({ ...edit, xactimate_ref: e.target.value })} className={inputCls} placeholder="Estimate #" /></Fld>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Fld label="Adjuster"><input value={edit.adjuster_name} onChange={(e) => setEdit({ ...edit, adjuster_name: e.target.value })} className={inputCls} /></Fld>
                <Fld label="Adjuster phone"><input value={edit.adjuster_phone} onChange={(e) => setEdit({ ...edit, adjuster_phone: e.target.value })} className={inputCls} /></Fld>
                <Fld label="Adjuster email"><input value={edit.adjuster_email} onChange={(e) => setEdit({ ...edit, adjuster_email: e.target.value })} className={inputCls} /></Fld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Date of loss"><input type="date" value={edit.date_of_loss} onChange={(e) => setEdit({ ...edit, date_of_loss: e.target.value })} className={inputCls} /></Fld>
                <Fld label="Date filed"><input type="date" value={edit.date_filed} onChange={(e) => setEdit({ ...edit, date_filed: e.target.value })} className={inputCls} /></Fld>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Fld label="RCV"><input type="number" value={edit.rcv} onChange={(e) => setEdit({ ...edit, rcv: e.target.value })} className={inputCls} /></Fld>
                <Fld label="ACV"><input type="number" value={edit.acv} onChange={(e) => setEdit({ ...edit, acv: e.target.value })} className={inputCls} /></Fld>
                <Fld label="Deductible"><input type="number" value={edit.deductible} onChange={(e) => setEdit({ ...edit, deductible: e.target.value })} className={inputCls} /></Fld>
                <Fld label="Depreciation"><input type="number" value={edit.depreciation} onChange={(e) => setEdit({ ...edit, depreciation: e.target.value })} className={inputCls} /></Fld>
                <Fld label="Approved"><input type="number" value={edit.approved_amount} onChange={(e) => setEdit({ ...edit, approved_amount: e.target.value })} className={inputCls} /></Fld>
              </div>
              <Fld label="Notes"><textarea rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} className={inputCls} /></Fld>
            </div>

            {/* Supplements */}
            {edit.id && (
              <div className="mt-5 border-t border-navy-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium text-sm">Supplements</span>
                  <span className="text-xs text-gray-400">Approved: <span className="text-emerald-400">{money(supApproved(edit.id))}</span></span>
                </div>
                <div className="space-y-2 mb-3">
                  {supsForClaim(edit.id).length === 0 && <div className="text-xs text-gray-500">No supplements yet.</div>}
                  {supsForClaim(edit.id).map((s) => {
                    const m = supMeta[s.status] || supMeta.submitted
                    return (
                      <div key={s.id} className="flex items-center gap-2 bg-navy-950 border border-navy-800 rounded px-3 py-2">
                        <div className="flex-1 min-w-0"><div className="text-sm text-gray-200 truncate">{s.description}</div><div className="text-xs text-gray-500">{money(s.amount)}</div></div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>
                        <button onClick={() => setSupStatus(s, 'approved')} className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-xs">Approve</button>
                        <button onClick={() => setSupStatus(s, 'denied')} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs">Deny</button>
                        <button onClick={() => removeSupplement(s)} className="px-2 py-1 text-gray-500 hover:text-red-400 rounded text-xs">✕</button>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <input value={supForm.description} onChange={(e) => setSupForm({ ...supForm, description: e.target.value })} placeholder="Supplement description" className="flex-1 bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" />
                  <input type="number" value={supForm.amount} onChange={(e) => setSupForm({ ...supForm, amount: e.target.value })} placeholder="$" className="w-28 bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" />
                  <button onClick={addSupplement} className="px-3 py-2 rounded-lg text-sm bg-navy-700 hover:bg-navy-600 text-gray-200">Add</button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-5">
              <div className="text-xs text-gray-500">{edit.id ? 'Tip: save the claim before adding supplements.' : 'Save to start tracking supplements.'}</div>
              <div className="flex gap-2">
                <button onClick={() => setEdit(null)} className="px-3 py-2 rounded-lg text-sm border border-navy-700 text-gray-300">Close</button>
                <button onClick={saveClaim} disabled={busy} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </HubPage>
  )
}
