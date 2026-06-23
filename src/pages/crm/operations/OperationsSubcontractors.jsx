import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'
import { toast } from 'sonner'

// Subcontractor management. Reads the tenant's OWN Supabase via useCrmClient().
// Sub crews roster (subcontractors) + job assignments + sub-pay tracking
// (sub_assignments). Flags expired/expiring insurance.

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const RATE_TYPES = [
  { key: 'per_job', label: 'Per job' },
  { key: 'per_square', label: 'Per square' },
  { key: 'percent', label: '% of job' },
  { key: 'hourly', label: 'Hourly' },
]
const rateLabel = (s) => {
  const r = Number(s.default_rate) || 0
  if (s.rate_type === 'per_square') return '$' + r + '/sq'
  if (s.rate_type === 'percent') return r + '%'
  if (s.rate_type === 'hourly') return '$' + r + '/hr'
  return r ? '$' + r + '/job' : 'Per job'
}
const statusMeta = {
  assigned: { label: 'Assigned', color: 'bg-sky-500/20 text-sky-300' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-300' },
  complete: { label: 'Complete', color: 'bg-blue-500/20 text-blue-300' },
}
const payMeta = {
  unpaid: { label: 'Unpaid', color: 'bg-amber-500/20 text-amber-300' },
  approved: { label: 'Approved', color: 'bg-sky-500/20 text-sky-300' },
  paid: { label: 'Paid', color: 'bg-emerald-500/20 text-emerald-300' },
}
function insStatus(d) {
  if (!d) return { label: 'No COI', color: 'bg-gray-500/20 text-gray-300', alert: true }
  const days = Math.floor((new Date(d) - new Date()) / 86400000)
  if (days < 0) return { label: 'Expired', color: 'bg-red-500/20 text-red-300', alert: true }
  if (days < 30) return { label: 'Expiring', color: 'bg-amber-500/20 text-amber-300', alert: true }
  return { label: 'Valid', color: 'bg-emerald-500/20 text-emerald-300', alert: false }
}
const blankSub = () => ({ company_name: '', contact_name: '', phone: '', email: '', trade: '', rate_type: 'per_job', default_rate: 0, insurance_expires: '', is_active: true })
const blankAssign = () => ({ subcontractor_id: '', work_order_id: '', scope: '', amount: '', status: 'assigned' })

export default function OperationsSubcontractors() {
  const { client } = useCrmClient()
  const [subs, setSubs] = useState([])
  const [assigns, setAssigns] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editSub, setEditSub] = useState(null)
  const [assigning, setAssigning] = useState(null) // assignment form or null

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client])

  async function load() {
    try {
      setLoading(true)
      const [sRes, aRes, jRes] = await Promise.all([
        client.from('subcontractors').select('*').order('company_name'),
        client.from('sub_assignments').select('*').order('created_at', { ascending: false }),
        client.from('ops_work_orders').select('id, work_order_number, title').order('work_order_number'),
      ])
      setSubs(sRes?.data || [])
      setAssigns(aRes?.data || [])
      setJobs(jRes?.data || [])
    } catch (e) {
      console.error('subs load failed', e); toast.error('Failed to load subcontractors')
    } finally { setLoading(false) }
  }

  const subById = useMemo(() => Object.fromEntries(subs.map((s) => [s.id, s])), [subs])
  const jobById = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j])), [jobs])
  const stats = useMemo(() => {
    const outstanding = assigns.filter((a) => a.pay_status !== 'paid').reduce((t, a) => t + (a.amount_cents || 0) / 100, 0)
    const paid = assigns.filter((a) => a.pay_status === 'paid').reduce((t, a) => t + (a.amount_cents || 0) / 100, 0)
    const alerts = subs.filter((s) => s.is_active && insStatus(s.insurance_expires).alert).length
    return { active: subs.filter((s) => s.is_active).length, outstanding, paid, alerts }
  }, [subs, assigns])

  // ---- sub CRUD ----
  async function saveSub() {
    if (!editSub.company_name.trim()) { toast.error('Company name required'); return }
    setBusy(true)
    try {
      const payload = {
        company_name: editSub.company_name, contact_name: editSub.contact_name || null, phone: editSub.phone || null,
        email: editSub.email || null, trade: editSub.trade || null, rate_type: editSub.rate_type,
        default_rate: Number(editSub.default_rate) || 0, insurance_expires: editSub.insurance_expires || null, is_active: !!editSub.is_active,
      }
      if (editSub.id) {
        const { error } = await client.from('subcontractors').update(payload).eq('id', editSub.id); if (error) throw error
      } else {
        const { error } = await client.from('subcontractors').insert(payload); if (error) throw error
      }
      toast.success('Subcontractor saved'); setEditSub(null); load()
    } catch (e) { console.error(e); toast.error(e.message || 'Save failed') } finally { setBusy(false) }
  }
  async function deleteSub(s) {
    if (!window.confirm(`Remove "${s.company_name}"? Its assignments are removed too.`)) return
    try {
      const { error } = await client.from('subcontractors').delete().eq('id', s.id); if (error) throw error
      toast.success('Subcontractor removed'); load()
    } catch (e) { console.error(e); toast.error(e.message || 'Delete failed') }
  }

  // ---- assignment ----
  async function saveAssign() {
    if (!assigning.subcontractor_id) { toast.error('Pick a subcontractor'); return }
    if (!assigning.work_order_id) { toast.error('Pick a job'); return }
    setBusy(true)
    try {
      const { error } = await client.from('sub_assignments').insert({
        subcontractor_id: assigning.subcontractor_id, work_order_id: assigning.work_order_id,
        scope: assigning.scope || null, amount_cents: Math.round((Number(assigning.amount) || 0) * 100),
        status: assigning.status, pay_status: 'unpaid',
      })
      if (error) throw error
      toast.success('Assigned to job'); setAssigning(null); load()
    } catch (e) { console.error(e); toast.error(e.message || 'Assign failed') } finally { setBusy(false) }
  }
  async function setPay(a, pay_status) {
    const patch = { pay_status, paid_at: pay_status === 'paid' ? new Date().toISOString() : null }
    setAssigns((arr) => arr.map((x) => (x.id === a.id ? { ...x, ...patch } : x)))
    try {
      const { error } = await client.from('sub_assignments').update(patch).eq('id', a.id); if (error) throw error
    } catch (e) { console.error(e); toast.error('Update failed'); load() }
  }
  async function removeAssign(a) {
    try {
      const { error } = await client.from('sub_assignments').delete().eq('id', a.id); if (error) throw error
      setAssigns((arr) => arr.filter((x) => x.id !== a.id))
    } catch (e) { console.error(e); toast.error('Could not remove') }
  }

  return (
    <HubPage
      title="Subcontractors"
      subtitle="Sub crews, job assignments, and sub-pay tracking."
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => setAssigning(blankAssign())} className="px-3 py-2 rounded-lg text-sm bg-navy-700 hover:bg-navy-600 text-gray-200">Assign to job</button>
          <button onClick={() => setEditSub(blankSub())} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">New subcontractor</button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Subs" value={stats.active} />
            <StatCard label="Outstanding Pay" value={money(stats.outstanding)} accent="text-amber-400" hint="unpaid assignments" />
            <StatCard label="Paid to Subs" value={money(stats.paid)} accent="text-emerald-400" />
            <StatCard label="Insurance Alerts" value={stats.alerts} accent={stats.alerts ? 'text-red-400' : 'text-emerald-400'} hint="expired or expiring" />
          </div>

          <Section title="Subcontractors">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 font-medium">Company</th>
                  <th className="text-left px-4 py-3 font-medium">Trade</th>
                  <th className="text-left px-4 py-3 font-medium">Contact</th>
                  <th className="text-right px-4 py-3 font-medium">Rate</th>
                  <th className="text-left px-4 py-3 font-medium">Insurance</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {subs.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No subcontractors yet.</td></tr>}
                  {subs.map((s) => {
                    const ins = insStatus(s.insurance_expires)
                    return (
                      <tr key={s.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3"><span className="text-white font-medium">{s.company_name}</span>{!s.is_active && <span className="text-[10px] text-gray-500 ml-2">inactive</span>}</td>
                        <td className="px-4 py-3 text-gray-300">{s.trade || '-'}</td>
                        <td className="px-4 py-3 text-gray-400">{s.contact_name || '-'}{s.phone ? ` · ${s.phone}` : ''}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{rateLabel(s)}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${ins.color}`}>{ins.label}</span>{s.insurance_expires && <span className="text-[11px] text-gray-500 ml-2">{fmtDate(s.insurance_expires)}</span>}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => setEditSub({ ...s, insurance_expires: s.insurance_expires || '' })} className="px-2 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue rounded text-xs transition mr-2">Edit</button>
                          <button onClick={() => deleteSub(s)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition">Remove</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Job assignments & sub pay">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 font-medium">Subcontractor</th>
                  <th className="text-left px-4 py-3 font-medium">Job</th>
                  <th className="text-left px-4 py-3 font-medium">Scope</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Pay</th>
                  <th className="text-right px-5 py-3 font-medium">Action</th>
                </tr></thead>
                <tbody>
                  {assigns.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-500">No assignments yet. Assign a sub to a job.</td></tr>}
                  {assigns.map((a) => {
                    const sub = subById[a.subcontractor_id]; const job = jobById[a.work_order_id]
                    const sm = statusMeta[a.status] || statusMeta.assigned; const pm = payMeta[a.pay_status] || payMeta.unpaid
                    return (
                      <tr key={a.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3 text-white">{sub ? sub.company_name : '(removed)'}</td>
                        <td className="px-4 py-3 text-gray-300">{job ? `${job.work_order_number} · ${job.title}` : '-'}</td>
                        <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{a.scope || '-'}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{money((a.amount_cents || 0) / 100)}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${sm.color}`}>{sm.label}</span></td>
                        <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${pm.color}`}>{pm.label}</span></td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {a.pay_status === 'paid'
                            ? <button onClick={() => setPay(a, 'unpaid')} className="px-2 py-1 bg-navy-700/60 hover:bg-navy-700 text-gray-300 rounded text-xs transition">Mark unpaid</button>
                            : <button onClick={() => setPay(a, 'paid')} className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-xs transition">Mark paid</button>}
                          <button onClick={() => removeAssign(a)} className="px-2 py-1 text-gray-500 hover:text-red-400 rounded text-xs transition ml-1">Remove</button>
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

      {/* sub editor */}
      {editSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEditSub(null)}>
          <div className="bg-navy-900 border border-navy-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">{editSub.id ? 'Edit subcontractor' : 'New subcontractor'}</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-400 mb-1">Company name</label><input value={editSub.company_name} onChange={(e) => setEditSub({ ...editSub, company_name: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" placeholder="Apex Tear-Off LLC" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Contact</label><input value={editSub.contact_name} onChange={(e) => setEditSub({ ...editSub, contact_name: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Phone</label><input value={editSub.phone} onChange={(e) => setEditSub({ ...editSub, phone: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Email</label><input value={editSub.email} onChange={(e) => setEditSub({ ...editSub, email: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Trade</label><input value={editSub.trade} onChange={(e) => setEditSub({ ...editSub, trade: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" placeholder="Tear-Off" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Rate type</label><select value={editSub.rate_type} onChange={(e) => setEditSub({ ...editSub, rate_type: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">{RATE_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
                <div><label className="block text-xs text-gray-400 mb-1">Default rate</label><input type="number" min="0" value={editSub.default_rate} onChange={(e) => setEditSub({ ...editSub, default_rate: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div><label className="block text-xs text-gray-400 mb-1">Insurance expires</label><input type="date" value={editSub.insurance_expires} onChange={(e) => setEditSub({ ...editSub, insurance_expires: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
                <label className="flex items-center gap-2 text-sm text-gray-300 pb-2"><input type="checkbox" checked={!!editSub.is_active} onChange={(e) => setEditSub({ ...editSub, is_active: e.target.checked })} className="accent-brand-blue" /> Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditSub(null)} className="px-3 py-2 rounded-lg text-sm border border-navy-700 text-gray-300">Cancel</button>
              <button onClick={saveSub} disabled={busy} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* assign modal */}
      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setAssigning(null)}>
          <div className="bg-navy-900 border border-navy-800 rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">Assign a sub to a job</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-400 mb-1">Subcontractor</label><select value={assigning.subcontractor_id} onChange={(e) => setAssigning({ ...assigning, subcontractor_id: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm"><option value="">Select...</option>{subs.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
              <div><label className="block text-xs text-gray-400 mb-1">Job</label><select value={assigning.work_order_id} onChange={(e) => setAssigning({ ...assigning, work_order_id: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm"><option value="">Select...</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.work_order_number} · {j.title}</option>)}</select></div>
              <div><label className="block text-xs text-gray-400 mb-1">Scope</label><input value={assigning.scope} onChange={(e) => setAssigning({ ...assigning, scope: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" placeholder="Full tear-off, 30 sq" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Amount ($)</label><input type="number" min="0" value={assigning.amount} onChange={(e) => setAssigning({ ...assigning, amount: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Status</label><select value={assigning.status} onChange={(e) => setAssigning({ ...assigning, status: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm"><option value="assigned">Assigned</option><option value="in_progress">In Progress</option><option value="complete">Complete</option></select></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setAssigning(null)} className="px-3 py-2 rounded-lg text-sm border border-navy-700 text-gray-300">Cancel</button>
              <button onClick={saveAssign} disabled={busy} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">Assign</button>
            </div>
          </div>
        </div>
      )}
    </HubPage>
  )
}
