import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'
import { toast } from 'sonner'

// Permit & inspection tracking. Reads the tenant's OWN Supabase via
// useCrmClient(). Permits per job (permits) + inspection scheduling and
// pass/fail records (inspections).

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const fmtWhen = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'

const PERMIT_STATUSES = ['not_applied', 'applied', 'issued', 'expired', 'rejected', 'closed']
const permitMeta = {
  not_applied: { label: 'Not applied', color: 'bg-gray-500/20 text-gray-300' },
  applied: { label: 'Applied', color: 'bg-amber-500/20 text-amber-300' },
  issued: { label: 'Issued', color: 'bg-emerald-500/20 text-emerald-300' },
  expired: { label: 'Expired', color: 'bg-red-500/20 text-red-300' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-300' },
  closed: { label: 'Closed', color: 'bg-blue-500/20 text-blue-300' },
}
const resultMeta = {
  pending: { label: 'Pending', color: 'bg-amber-500/20 text-amber-300' },
  pass: { label: 'Pass', color: 'bg-emerald-500/20 text-emerald-300' },
  fail: { label: 'Fail', color: 'bg-red-500/20 text-red-300' },
}
const blankPermit = () => ({ work_order_id: '', permit_number: '', permit_type: 'Roofing', authority: '', status: 'not_applied', fee: '', applied_date: '', issued_date: '', expires_date: '' })
const blankInspection = () => ({ work_order_id: '', permit_id: '', inspection_type: '', scheduled_at: '', inspector: '' })

export default function OperationsPermits() {
  const { client } = useCrmClient()
  const [permits, setPermits] = useState([])
  const [inspections, setInspections] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editPermit, setEditPermit] = useState(null)
  const [editInsp, setEditInsp] = useState(null)

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client])

  async function load() {
    try {
      setLoading(true)
      const [pRes, iRes, jRes] = await Promise.all([
        client.from('permits').select('*').order('created_at', { ascending: false }),
        client.from('inspections').select('*').order('scheduled_at', { ascending: true }),
        client.from('ops_work_orders').select('id, work_order_number, title').order('work_order_number'),
      ])
      setPermits(pRes?.data || [])
      setInspections(iRes?.data || [])
      setJobs(jRes?.data || [])
    } catch (e) { console.error('permits load failed', e); toast.error('Failed to load permits') } finally { setLoading(false) }
  }

  const jobById = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j])), [jobs])
  const permitsForJob = (wo) => permits.filter((p) => p.work_order_id === wo)
  const jobLabel = (id) => { const j = jobById[id]; return j ? `${j.work_order_number} · ${j.title}` : '-' }
  const stats = useMemo(() => ({
    open: permits.filter((p) => !['closed', 'rejected'].includes(p.status)).length,
    awaiting: inspections.filter((i) => i.result === 'pending').length,
    passed: inspections.filter((i) => i.result === 'pass').length,
    failed: inspections.filter((i) => i.result === 'fail').length,
  }), [permits, inspections])

  // ---- permit CRUD ----
  async function savePermit() {
    if (!editPermit.work_order_id) { toast.error('Pick a job'); return }
    setBusy(true)
    try {
      const payload = {
        work_order_id: editPermit.work_order_id, permit_number: editPermit.permit_number || null,
        permit_type: editPermit.permit_type || null, authority: editPermit.authority || null, status: editPermit.status,
        fee_cents: Math.round((Number(editPermit.fee) || 0) * 100),
        applied_date: editPermit.applied_date || null, issued_date: editPermit.issued_date || null, expires_date: editPermit.expires_date || null,
      }
      if (editPermit.id) { const { error } = await client.from('permits').update(payload).eq('id', editPermit.id); if (error) throw error }
      else { const { error } = await client.from('permits').insert(payload); if (error) throw error }
      toast.success('Permit saved'); setEditPermit(null); load()
    } catch (e) { console.error(e); toast.error(e.message || 'Save failed') } finally { setBusy(false) }
  }
  async function removePermit(p) {
    if (!window.confirm(`Delete permit ${p.permit_number || ''}? Its inspections stay on the job.`)) return
    try { const { error } = await client.from('permits').delete().eq('id', p.id); if (error) throw error; toast.success('Permit removed'); load() }
    catch (e) { console.error(e); toast.error(e.message || 'Delete failed') }
  }

  // ---- inspection ----
  async function saveInspection() {
    if (!editInsp.work_order_id) { toast.error('Pick a job'); return }
    if (!editInsp.inspection_type.trim()) { toast.error('Inspection type required'); return }
    setBusy(true)
    try {
      const { error } = await client.from('inspections').insert({
        work_order_id: editInsp.work_order_id, permit_id: editInsp.permit_id || null,
        inspection_type: editInsp.inspection_type, scheduled_at: editInsp.scheduled_at || null,
        inspector: editInsp.inspector || null, result: 'pending',
      })
      if (error) throw error
      toast.success('Inspection scheduled'); setEditInsp(null); load()
    } catch (e) { console.error(e); toast.error(e.message || 'Save failed') } finally { setBusy(false) }
  }
  async function recordResult(i, result) {
    const patch = { result, completed_at: result === 'pending' ? null : new Date().toISOString() }
    setInspections((arr) => arr.map((x) => (x.id === i.id ? { ...x, ...patch } : x)))
    try { const { error } = await client.from('inspections').update(patch).eq('id', i.id); if (error) throw error }
    catch (e) { console.error(e); toast.error('Update failed'); load() }
  }
  async function removeInspection(i) {
    try { const { error } = await client.from('inspections').delete().eq('id', i.id); if (error) throw error; setInspections((arr) => arr.filter((x) => x.id !== i.id)) }
    catch (e) { console.error(e); toast.error('Could not remove') }
  }

  return (
    <HubPage
      title="Permits & Inspections"
      subtitle="Permits per job plus inspection scheduling and pass/fail records."
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => setEditInsp(blankInspection())} className="px-3 py-2 rounded-lg text-sm bg-navy-700 hover:bg-navy-600 text-gray-200">Schedule inspection</button>
          <button onClick={() => setEditPermit(blankPermit())} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">New permit</button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Open Permits" value={stats.open} />
            <StatCard label="Awaiting Inspection" value={stats.awaiting} accent="text-amber-400" />
            <StatCard label="Passed" value={stats.passed} accent="text-emerald-400" />
            <StatCard label="Failed / Reinspect" value={stats.failed} accent={stats.failed ? 'text-red-400' : 'text-gray-300'} />
          </div>

          <Section title="Permits">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 font-medium">Job</th>
                  <th className="text-left px-4 py-3 font-medium">Permit #</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Authority</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Fee</th>
                  <th className="text-left px-4 py-3 font-medium">Issued</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {permits.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-500">No permits yet.</td></tr>}
                  {permits.map((p) => {
                    const pm = permitMeta[p.status] || permitMeta.not_applied
                    return (
                      <tr key={p.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3 text-gray-300">{jobLabel(p.work_order_id)}</td>
                        <td className="px-4 py-3 text-white font-mono text-xs">{p.permit_number || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{p.permit_type || '-'}</td>
                        <td className="px-4 py-3 text-gray-400">{p.authority || '-'}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${pm.color}`}>{pm.label}</span></td>
                        <td className="px-4 py-3 text-right text-gray-300">{p.fee_cents ? money(p.fee_cents / 100) : '-'}</td>
                        <td className="px-4 py-3 text-gray-400">{fmtDate(p.issued_date)}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button onClick={() => setEditPermit({ ...p, fee: p.fee_cents ? p.fee_cents / 100 : '', applied_date: p.applied_date || '', issued_date: p.issued_date || '', expires_date: p.expires_date || '' })} className="px-2 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue rounded text-xs transition mr-1">Edit</button>
                          <button onClick={() => removePermit(p)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition">Remove</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Inspections">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 font-medium">Job</th>
                  <th className="text-left px-4 py-3 font-medium">Inspection</th>
                  <th className="text-left px-4 py-3 font-medium">Scheduled</th>
                  <th className="text-left px-4 py-3 font-medium">Inspector</th>
                  <th className="text-left px-4 py-3 font-medium">Result</th>
                  <th className="text-right px-5 py-3 font-medium">Record</th>
                </tr></thead>
                <tbody>
                  {inspections.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No inspections scheduled.</td></tr>}
                  {inspections.map((i) => {
                    const rm = resultMeta[i.result] || resultMeta.pending
                    return (
                      <tr key={i.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3 text-gray-300">{jobLabel(i.work_order_id)}</td>
                        <td className="px-4 py-3 text-white">{i.inspection_type}</td>
                        <td className="px-4 py-3 text-gray-400">{fmtWhen(i.scheduled_at)}</td>
                        <td className="px-4 py-3 text-gray-400">{i.inspector || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${rm.color}`}>{rm.label}</span>
                          {i.result === 'fail' && i.notes && <span className="block text-[11px] text-red-300/80 mt-0.5">{i.notes}</span>}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button onClick={() => recordResult(i, 'pass')} className={`px-2 py-1 rounded text-xs transition mr-1 ${i.result === 'pass' ? 'bg-emerald-600/40 text-emerald-200' : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300'}`}>Pass</button>
                          <button onClick={() => recordResult(i, 'fail')} className={`px-2 py-1 rounded text-xs transition mr-1 ${i.result === 'fail' ? 'bg-red-600/40 text-red-200' : 'bg-red-600/20 hover:bg-red-600/30 text-red-400'}`}>Fail</button>
                          <button onClick={() => removeInspection(i)} className="px-2 py-1 text-gray-500 hover:text-red-400 rounded text-xs transition">Remove</button>
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

      {/* permit editor */}
      {editPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEditPermit(null)}>
          <div className="bg-navy-900 border border-navy-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">{editPermit.id ? 'Edit permit' : 'New permit'}</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-400 mb-1">Job</label><select value={editPermit.work_order_id} onChange={(e) => setEditPermit({ ...editPermit, work_order_id: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm"><option value="">Select...</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.work_order_number} · {j.title}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Permit #</label><input value={editPermit.permit_number} onChange={(e) => setEditPermit({ ...editPermit, permit_number: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" placeholder="BLD-2026-0455" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Type</label><input value={editPermit.permit_type} onChange={(e) => setEditPermit({ ...editPermit, permit_type: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" placeholder="Roofing" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Authority (AHJ)</label><input value={editPermit.authority} onChange={(e) => setEditPermit({ ...editPermit, authority: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" placeholder="City of Jacksonville" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Status</label><select value={editPermit.status} onChange={(e) => setEditPermit({ ...editPermit, status: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">{PERMIT_STATUSES.map((s) => <option key={s} value={s}>{permitMeta[s].label}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Fee ($)</label><input type="number" min="0" value={editPermit.fee} onChange={(e) => setEditPermit({ ...editPermit, fee: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Applied</label><input type="date" value={editPermit.applied_date} onChange={(e) => setEditPermit({ ...editPermit, applied_date: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Issued</label><input type="date" value={editPermit.issued_date} onChange={(e) => setEditPermit({ ...editPermit, issued_date: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Expires</label><input type="date" value={editPermit.expires_date} onChange={(e) => setEditPermit({ ...editPermit, expires_date: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditPermit(null)} className="px-3 py-2 rounded-lg text-sm border border-navy-700 text-gray-300">Cancel</button>
              <button onClick={savePermit} disabled={busy} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* inspection scheduler */}
      {editInsp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEditInsp(null)}>
          <div className="bg-navy-900 border border-navy-800 rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">Schedule inspection</h3>
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-400 mb-1">Job</label><select value={editInsp.work_order_id} onChange={(e) => setEditInsp({ ...editInsp, work_order_id: e.target.value, permit_id: '' })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm"><option value="">Select...</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.work_order_number} · {j.title}</option>)}</select></div>
              {editInsp.work_order_id && permitsForJob(editInsp.work_order_id).length > 0 && (
                <div><label className="block text-xs text-gray-400 mb-1">Permit (optional)</label><select value={editInsp.permit_id} onChange={(e) => setEditInsp({ ...editInsp, permit_id: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm"><option value="">None</option>{permitsForJob(editInsp.work_order_id).map((p) => <option key={p.id} value={p.id}>{p.permit_number || p.permit_type}</option>)}</select></div>
              )}
              <div><label className="block text-xs text-gray-400 mb-1">Inspection type</label><input value={editInsp.inspection_type} onChange={(e) => setEditInsp({ ...editInsp, inspection_type: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" placeholder="Dry-In / Final Roof" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">Scheduled</label><input type="date" value={editInsp.scheduled_at} onChange={(e) => setEditInsp({ ...editInsp, scheduled_at: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">Inspector</label><input value={editInsp.inspector} onChange={(e) => setEditInsp({ ...editInsp, inspector: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditInsp(null)} className="px-3 py-2 rounded-lg text-sm border border-navy-700 text-gray-300">Cancel</button>
              <button onClick={saveInspection} disabled={busy} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">Schedule</button>
            </div>
          </div>
        </div>
      )}
    </HubPage>
  )
}
