import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const money = (v) => (v == null ? '$0' : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }))
const money2 = (v) => (v == null ? '$0.00' : '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const fullName = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim()
const loadRoute = (l) => `${l.origin_city || '?'}, ${l.origin_state || '?'} → ${l.dest_city || '?'}, ${l.dest_state || '?'}`

const LOAD_STATUS = {
  posted: 'bg-sky-500/10 text-sky-300', bidding: 'bg-orange-500/10 text-orange-300',
  booked: 'bg-indigo-500/10 text-indigo-300', accepted: 'bg-indigo-500/10 text-indigo-300',
  en_route: 'bg-violet-500/10 text-violet-300', delivering: 'bg-violet-500/10 text-violet-300',
  complete: 'bg-emerald-500/10 text-emerald-300', paid: 'bg-emerald-500/15 text-emerald-200',
  cancelled: 'bg-red-500/10 text-red-300',
}
const COMM_STATUS = {
  pending: 'bg-amber-500/10 text-amber-300', approved: 'bg-sky-500/10 text-sky-300',
  paid: 'bg-emerald-500/10 text-emerald-300', cancelled: 'bg-red-500/10 text-red-300',
}
const cap = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function FreightSalesDesk() {
  const [reps, setReps] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loads, setLoads] = useState([])
  const [commissions, setCommissions] = useState([])
  const [shippers, setShippers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selId, setSelId] = useState(null)
  const [tab, setTab] = useState('customers')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignShipper, setAssignShipper] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [rp, asg, ld, cm, sh] = await Promise.all([
        supabase.from('freight_sales_profiles').select('*').order('last_name'),
        supabase.from('freight_sales_assignments').select('*, freight_shippers(company_name, contact_name, city, state, status)'),
        supabase.from('freight_loads').select('id, load_number, reference_number, origin_city, origin_state, dest_city, dest_state, equipment_type, status, shipper_rate, final_rate, pickup_date, assigned_sales_id, freight_shippers(company_name)').order('pickup_date', { ascending: false }),
        supabase.from('freight_commissions').select('*').eq('recipient_type', 'sales_profile'),
        supabase.from('freight_shippers').select('id, company_name, city, state, status').order('company_name'),
      ])
      const repRows = rp.data || []
      setReps(repRows)
      setAssignments(asg.data || [])
      setLoads(ld.data || [])
      setCommissions(cm.data || [])
      setShippers(sh.data || [])
      setSelId(prev => prev || repRows[0]?.id || null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ---- per-rep derived data ----
  const repCustomers = (id) => assignments.filter(a => a.sales_profile_id === id)
  const repLoads = (id) => loads.filter(l => l.assigned_sales_id === id)
  const repComms = (id) => commissions.filter(c => c.recipient_id === id)
  const repRevenue = (id) => repLoads(id).reduce((s, l) => s + Number(l.final_rate || l.shipper_rate || 0), 0)
  const repCommEarned = (id) => repComms(id).reduce((s, c) => s + Number(c.amount || 0), 0)
  const repCommPaid = (id) => repComms(id).filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount || 0), 0)
  const activeLoadStatuses = ['posted', 'bidding', 'booked', 'accepted', 'en_route', 'delivering']

  const sel = reps.find(r => r.id === selId)

  // ---- overall stats ----
  const stats = [
    { label: 'Sales Reps', value: reps.filter(r => r.status === 'active').length, color: 'text-white' },
    { label: 'Customers', value: assignments.length, color: 'text-white' },
    { label: 'Active Loads', value: loads.filter(l => l.assigned_sales_id && activeLoadStatuses.includes(l.status)).length, color: 'text-sky-300' },
    { label: 'Commissions Pending', value: money(commissions.filter(c => c.status !== 'paid').reduce((s, c) => s + Number(c.amount || 0), 0)), color: 'text-amber-400' },
    { label: 'Commissions Paid', value: money(commissions.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount || 0), 0)), color: 'text-emerald-400' },
  ]

  // shippers not already on this rep's book
  const unassignedShippers = sel
    ? shippers.filter(s => !repCustomers(sel.id).some(a => a.shipper_id === s.id))
    : []

  async function assignCustomer() {
    if (!assignShipper || !sel) return
    setBusy(true)
    try {
      const { error } = await supabase.from('freight_sales_assignments').insert({
        sales_profile_id: sel.id, shipper_id: assignShipper, status: 'active',
      })
      if (error) throw error
      setAssignOpen(false); setAssignShipper('')
      await loadAll()
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  async function removeCustomer(a) {
    if (!window.confirm('Remove this customer from the rep’s book?')) return
    setBusy(true)
    try {
      await supabase.from('freight_sales_assignments').delete().eq('id', a.id)
      await loadAll()
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  const tabs = sel ? [
    { key: 'customers', label: `Customers (${repCustomers(sel.id).length})` },
    { key: 'loads', label: `Loads (${repLoads(sel.id).length})` },
    { key: 'commissions', label: `Commissions (${repComms(sel.id).length})` },
  ] : []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <h1 className="text-xl font-bold text-white">Sales Desk</h1>
        </div>
        <p className="text-sm text-gray-400">Each BIH rep&rsquo;s book of customers, their load pipeline, and commission ledger.</p>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-navy-800 border border-navy-700/50 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : reps.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl py-16 text-center text-gray-400">No sales reps yet.</div>
      ) : (
        <>
          {/* Rep selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            {reps.map(r => {
              const active = r.id === selId
              return (
                <button key={r.id} onClick={() => { setSelId(r.id); setTab('customers') }}
                  className={`text-left bg-navy-800 border rounded-xl p-4 transition-colors ${active ? 'border-brand-blue' : 'border-navy-700/50 hover:border-navy-600'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{fullName(r)}</span>
                    <span className="text-xs font-mono font-semibold text-emerald-400">{r.commission_rate != null ? r.commission_rate + '%' : '—'}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{r.email || '—'}</p>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-navy-700/40">
                    <div><p className="text-[10px] uppercase tracking-wider text-gray-600">Cust</p><p className="text-sm font-semibold text-white">{repCustomers(r.id).length}</p></div>
                    <div><p className="text-[10px] uppercase tracking-wider text-gray-600">Loads</p><p className="text-sm font-semibold text-white">{repLoads(r.id).length}</p></div>
                    <div><p className="text-[10px] uppercase tracking-wider text-gray-600">Comm</p><p className="text-sm font-semibold text-emerald-400">{money(repCommEarned(r.id))}</p></div>
                  </div>
                </button>
              )
            })}
          </div>

          {sel && (
            <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
              {/* Desk header */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-navy-700/50">
                <div>
                  <h2 className="text-base font-bold text-white">{fullName(sel)}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {sel.email || '—'}{sel.phone ? ' · ' + sel.phone : ''} · {sel.commission_rate}% commission · Revenue {money(repRevenue(sel.id))}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div><p className="text-[10px] uppercase tracking-wider text-gray-600">Earned</p><p className="text-sm font-bold text-emerald-400">{money2(repCommEarned(sel.id))}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-gray-600">Paid</p><p className="text-sm font-bold text-white">{money2(repCommPaid(sel.id))}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-gray-600">Pending</p><p className="text-sm font-bold text-amber-400">{money2(repCommEarned(sel.id) - repCommPaid(sel.id))}</p></div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 px-5 pt-3 border-b border-navy-700/50">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t.key ? 'bg-navy-900 text-white border-b-2 border-brand-blue' : 'text-gray-400 hover:text-white'}`}>
                    {t.label}
                  </button>
                ))}
                {tab === 'customers' && (
                  <button onClick={() => { setAssignShipper(''); setAssignOpen(true) }} className="ml-auto mb-1 px-3 py-1.5 bg-brand-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors">
                    + Assign Customer
                  </button>
                )}
              </div>

              {/* Tab body */}
              <div className="overflow-x-auto">
                {tab === 'customers' && (
                  <table className="w-full">
                    <thead><tr className="border-b border-navy-700/50">{['Customer', 'Location', 'Contact', 'Status', ''].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>)}</tr></thead>
                    <tbody>
                      {repCustomers(sel.id).length === 0 ? (
                        <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">No customers on this rep&rsquo;s book yet.</td></tr>
                      ) : repCustomers(sel.id).map(a => (
                        <tr key={a.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                          <td className="px-5 py-3 text-sm font-medium text-white">{a.freight_shippers?.company_name || '—'}</td>
                          <td className="px-5 py-3 text-sm text-gray-400">{[a.freight_shippers?.city, a.freight_shippers?.state].filter(Boolean).join(', ') || '—'}</td>
                          <td className="px-5 py-3 text-sm text-gray-400">{a.freight_shippers?.contact_name || '—'}</td>
                          <td className="px-5 py-3"><span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-300 capitalize">{a.status || 'active'}</span></td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => removeCustomer(a)} disabled={busy} className="text-xs text-gray-500 hover:text-red-400 disabled:opacity-50">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {tab === 'loads' && (
                  <table className="w-full">
                    <thead><tr className="border-b border-navy-700/50">{['Load', 'Route', 'Customer', 'Equipment', 'Rate', 'Pickup', 'Status'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>)}</tr></thead>
                    <tbody>
                      {repLoads(sel.id).length === 0 ? (
                        <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-500">No loads assigned to this rep yet.</td></tr>
                      ) : repLoads(sel.id).map(l => (
                        <tr key={l.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                          <td className="px-5 py-3 text-xs font-mono text-gray-400">{l.load_number || l.reference_number || '—'}</td>
                          <td className="px-5 py-3 text-sm font-medium text-white whitespace-nowrap">{loadRoute(l)}</td>
                          <td className="px-5 py-3 text-sm text-gray-400">{l.freight_shippers?.company_name || '—'}</td>
                          <td className="px-5 py-3 text-sm text-gray-400">{cap(l.equipment_type)}</td>
                          <td className="px-5 py-3 text-sm font-semibold text-white">{money(l.final_rate || l.shipper_rate)}</td>
                          <td className="px-5 py-3 text-xs text-gray-400">{l.pickup_date ? new Date(l.pickup_date).toLocaleDateString() : '—'}</td>
                          <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${LOAD_STATUS[l.status] || 'bg-gray-500/10 text-gray-400'}`}>{cap(l.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {tab === 'commissions' && (
                  <table className="w-full">
                    <thead><tr className="border-b border-navy-700/50">{['Load', 'Rate', 'Amount', 'Status', 'Date'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>)}</tr></thead>
                    <tbody>
                      {repComms(sel.id).length === 0 ? (
                        <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">No commissions recorded for this rep yet.</td></tr>
                      ) : repComms(sel.id).map(c => {
                        const l = loads.find(x => x.id === c.load_id)
                        return (
                          <tr key={c.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                            <td className="px-5 py-3 text-sm text-white">{l ? loadRoute(l) : <span className="font-mono text-xs text-gray-500">{(c.load_id || '').slice(0, 8)}</span>}</td>
                            <td className="px-5 py-3 text-sm text-gray-400">{c.rate != null ? c.rate + '%' : '—'}</td>
                            <td className="px-5 py-3 text-sm font-semibold text-emerald-400">{money2(c.amount)}</td>
                            <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${COMM_STATUS[c.status] || 'bg-gray-500/10 text-gray-400'}`}>{cap(c.status)}</span></td>
                            <td className="px-5 py-3 text-xs text-gray-400">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Assign customer modal */}
      {assignOpen && sel && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700/50">
              <h2 className="text-base font-semibold text-white">Assign Customer to {fullName(sel)}</h2>
              <button onClick={() => setAssignOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-navy-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Shipper / Customer</label>
              <select value={assignShipper} onChange={e => setAssignShipper(e.target.value)} className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/60">
                <option value="">Select customer…</option>
                {unassignedShippers.map(s => <option key={s.id} value={s.id}>{s.company_name}{s.city ? ` — ${s.city}, ${s.state || ''}` : ''}</option>)}
              </select>
              {unassignedShippers.length === 0 && <p className="text-xs text-gray-500 mt-2">All customers are already on this rep&rsquo;s book.</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-navy-700/50">
              <button onClick={() => setAssignOpen(false)} className="px-4 py-2 border border-navy-600 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={assignCustomer} disabled={busy || !assignShipper} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">{busy ? 'Assigning…' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
