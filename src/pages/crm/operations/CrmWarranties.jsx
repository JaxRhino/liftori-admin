import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, useCrmClient } from '../_shared'
import { toast } from 'sonner'

// Warranty registration & tracking. Reads the tenant's OWN Supabase via
// useCrmClient(). Workmanship + manufacturer warranties per customer, with
// auto-computed expiration and an expiring-soon watch (warranties table).

const num = (v) => Number(v) || 0
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const today = () => new Date(new Date().toISOString().slice(0, 10))
const daysUntil = (d) => d ? Math.round((new Date(d) - today()) / 86400000) : null
const addYears = (start, yrs) => { if (!start || !yrs) return ''; const dt = new Date(start); dt.setFullYear(dt.getFullYear() + Math.round(num(yrs))); return dt.toISOString().slice(0, 10) }

const TYPES = ['workmanship', 'manufacturer']
const typeLabel = { workmanship: 'Workmanship', manufacturer: 'Manufacturer' }
const STATUSES = ['active', 'void', 'claimed']

// derive a display state from stored status + expiration date
function displayState(w) {
  if (w.status === 'void') return { key: 'void', label: 'Void', color: 'bg-gray-500/20 text-gray-300' }
  if (w.status === 'claimed') return { key: 'claimed', label: 'Claimed', color: 'bg-blue-500/20 text-blue-300' }
  const du = daysUntil(w.expiration_date)
  if (du != null && du < 0) return { key: 'expired', label: 'Expired', color: 'bg-red-500/20 text-red-300' }
  if (du != null && du <= 90) return { key: 'expiring', label: `Expiring · ${du}d`, color: 'bg-amber-500/20 text-amber-300' }
  return { key: 'active', label: 'Active', color: 'bg-emerald-500/20 text-emerald-300' }
}

const blank = () => ({ contact_id: '', warranty_type: 'workmanship', provider: '', product: '', registration_number: '', coverage_years: '', start_date: '', expiration_date: '', status: 'active', notes: '' })
function Fld({ label, children }) { return <div><label className="block text-xs text-gray-400 mb-1">{label}</label>{children}</div> }
const inputCls = 'w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm'

export default function CrmWarranties() {
  const { client } = useCrmClient()
  const [rows, setRows] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(null)

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client])
  async function load() {
    try {
      setLoading(true)
      const [wRes, cRes] = await Promise.all([
        client.from('warranties').select('*').order('expiration_date', { ascending: true, nullsFirst: false }),
        client.from('customer_contacts').select('id, first_name, last_name').order('first_name'),
      ])
      setRows(wRes?.data || [])
      setContacts(cRes?.data || [])
    } catch (e) { console.error('warranties load failed', e); toast.error('Failed to load warranties') } finally { setLoading(false) }
  }

  const contactById = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ')])), [contacts])
  const stats = useMemo(() => {
    let active = 0, expiring = 0, expired = 0, inactive = 0
    for (const w of rows) {
      const s = displayState(w).key
      if (s === 'active') active++
      else if (s === 'expiring') { active++; expiring++ }
      else if (s === 'expired') expired++
      else inactive++
    }
    return { active, expiring, expired, inactive }
  }, [rows])

  async function save() {
    if (!edit.contact_id) { toast.error('Pick a customer'); return }
    setBusy(true)
    try {
      const exp = edit.expiration_date || addYears(edit.start_date, edit.coverage_years)
      const patch = {
        contact_id: edit.contact_id, warranty_type: edit.warranty_type, provider: edit.provider || null,
        product: edit.product || null, registration_number: edit.registration_number || null,
        coverage_years: edit.coverage_years ? num(edit.coverage_years) : null,
        start_date: edit.start_date || null, expiration_date: exp || null, status: edit.status,
        notes: edit.notes || null, updated_at: new Date().toISOString(),
      }
      if (edit.id) { const { error } = await client.from('warranties').update(patch).eq('id', edit.id); if (error) throw error }
      else { const { error } = await client.from('warranties').insert(patch); if (error) throw error }
      toast.success('Warranty saved'); setEdit(null); await load()
    } catch (e) { console.error(e); toast.error('Save failed') } finally { setBusy(false) }
  }
  async function remove(w) {
    if (!window.confirm('Delete this warranty?')) return
    try { await client.from('warranties').delete().eq('id', w.id); toast.success('Deleted'); await load() }
    catch (e) { console.error(e); toast.error('Delete failed') }
  }

  return (
    <HubPage title="Warranties" subtitle="Workmanship and manufacturer warranty registration and tracking."
      actions={<button onClick={() => setEdit(blank())} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">New warranty</button>}>
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active" value={stats.active} accent="text-emerald-400" />
            <StatCard label="Expiring ≤90d" value={stats.expiring} accent={stats.expiring ? 'text-amber-400' : 'text-gray-300'} />
            <StatCard label="Expired" value={stats.expired} accent={stats.expired ? 'text-red-400' : 'text-gray-300'} />
            <StatCard label="Void / Claimed" value={stats.inactive} />
          </div>

          <Section title="Warranties">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Provider / Product</th>
                  <th className="text-left px-4 py-3 font-medium">Reg #</th>
                  <th className="text-left px-4 py-3 font-medium">Coverage</th>
                  <th className="text-left px-4 py-3 font-medium">Expires</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-500">No warranties yet. Click “New warranty” to register one.</td></tr>}
                  {rows.map((w) => {
                    const st = displayState(w)
                    return (
                      <tr key={w.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3 text-gray-300">{contactById[w.contact_id] || '—'}</td>
                        <td className="px-4 py-3 text-gray-300">{typeLabel[w.warranty_type] || w.warranty_type}</td>
                        <td className="px-4 py-3 text-gray-300">{[w.provider, w.product].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{w.registration_number || '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{w.coverage_years ? `${num(w.coverage_years)} yr` : '—'}</td>
                        <td className="px-4 py-3 text-gray-300">{fmtDate(w.expiration_date)}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button onClick={() => setEdit({ ...w, coverage_years: w.coverage_years || '', start_date: w.start_date || '', expiration_date: w.expiration_date || '' })} className="px-2 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue rounded text-xs transition mr-1">Edit</button>
                          <button onClick={() => remove(w)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition">Delete</button>
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

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEdit(null)}>
          <div className="bg-navy-900 border border-navy-800 rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-4">{edit.id ? 'Edit warranty' : 'New warranty'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Customer"><select value={edit.contact_id} onChange={(e) => setEdit({ ...edit, contact_id: e.target.value })} className={inputCls}><option value="">Select...</option>{contacts.map((c) => <option key={c.id} value={c.id}>{[c.first_name, c.last_name].filter(Boolean).join(' ')}</option>)}</select></Fld>
                <Fld label="Type"><select value={edit.warranty_type} onChange={(e) => setEdit({ ...edit, warranty_type: e.target.value })} className={inputCls}>{TYPES.map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}</select></Fld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Provider"><input value={edit.provider} onChange={(e) => setEdit({ ...edit, provider: e.target.value })} className={inputCls} placeholder="GAF / In-house" /></Fld>
                <Fld label="Product / scope"><input value={edit.product} onChange={(e) => setEdit({ ...edit, product: e.target.value })} className={inputCls} placeholder="Timberline HDZ shingles" /></Fld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Registration #"><input value={edit.registration_number} onChange={(e) => setEdit({ ...edit, registration_number: e.target.value })} className={inputCls} /></Fld>
                <Fld label="Coverage (years)"><input type="number" value={edit.coverage_years} onChange={(e) => { const cy = e.target.value; setEdit((p) => ({ ...p, coverage_years: cy, expiration_date: p.start_date ? addYears(p.start_date, cy) : p.expiration_date })) }} className={inputCls} placeholder="10" /></Fld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Start date"><input type="date" value={edit.start_date} onChange={(e) => { const sd = e.target.value; setEdit((p) => ({ ...p, start_date: sd, expiration_date: p.coverage_years ? addYears(sd, p.coverage_years) : p.expiration_date })) }} className={inputCls} /></Fld>
                <Fld label="Expiration"><input type="date" value={edit.expiration_date} onChange={(e) => setEdit({ ...edit, expiration_date: e.target.value })} className={inputCls} /></Fld>
              </div>
              <Fld label="Status"><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className={inputCls}>{STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></Fld>
              <Fld label="Notes"><textarea rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} className={inputCls} /></Fld>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEdit(null)} className="px-3 py-2 rounded-lg text-sm border border-navy-700 text-gray-300">Cancel</button>
              <button onClick={save} disabled={busy} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white">{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </HubPage>
  )
}
