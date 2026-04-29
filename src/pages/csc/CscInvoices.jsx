import { useEffect, useMemo, useState } from 'react'
import { cscSupabase, fmtMoney, fmtDate, INVOICE_STATUS_TONES } from '../../lib/cscClient'

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tone}`}>{children}</span>
}

export default function CscInvoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const { data } = await cscSupabase
      .from('csc_invoices')
      .select('*, restaurant:csc_restaurants(name, city, state), chain:csc_chain_groups(name)')
      .order('issue_date', { ascending: false })
    setInvoices(data || [])
    setLoading(false)
  }

  const aging = useMemo(() => {
    const now = Date.now()
    const open = invoices.filter(i => ['sent', 'viewed', 'partial', 'overdue'].includes(i.status))
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0 }
    open.forEach(i => {
      const due = new Date(i.due_date).getTime()
      const daysOver = (now - due) / (1000 * 60 * 60 * 24)
      const owed = Number(i.total_amount - (i.amount_paid || 0))
      if (daysOver <= 0) buckets.current += owed
      else if (daysOver <= 30) buckets.d30 += owed
      else if (daysOver <= 60) buckets.d60 += owed
      else buckets.d90 += owed
    })
    return { ...buckets, total: buckets.current + buckets.d30 + buckets.d60 + buckets.d90 }
  }, [invoices])

  const filtered = useMemo(() => invoices.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${i.invoice_number} ${i.restaurant?.name || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  }), [invoices, statusFilter, search])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Total AR</div>
          <div className="text-2xl font-heading text-orange-300 mt-1">{fmtMoney(aging.total)}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Current</div>
          <div className="text-2xl font-heading text-emerald-300 mt-1">{fmtMoney(aging.current)}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">1–30 days</div>
          <div className="text-2xl font-heading text-amber-300 mt-1">{fmtMoney(aging.d30)}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">31–60 days</div>
          <div className="text-2xl font-heading text-orange-400 mt-1">{fmtMoney(aging.d60)}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">60+ days</div>
          <div className="text-2xl font-heading text-red-300 mt-1">{fmtMoney(aging.d90)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search invoices…" value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-orange-400/50 w-72" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
          <option value="all">All statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="viewed">Viewed</option><option value="partial">Partial</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option>
        </select>
        <div className="ml-auto text-xs text-white/50">{filtered.length} of {invoices.length}</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/40">
            <tr><th className="text-left px-5 py-3 font-semibold">Invoice</th><th className="text-left px-3 py-3 font-semibold">Account</th><th className="text-left px-3 py-3 font-semibold">Issued</th><th className="text-left px-3 py-3 font-semibold">Due</th><th className="text-left px-3 py-3 font-semibold">Status</th><th className="text-right px-3 py-3 font-semibold">Total</th><th className="text-right px-5 py-3 font-semibold">Outstanding</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && <tr><td colSpan="7" className="px-5 py-6 text-white/40">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="7" className="px-5 py-6 text-white/40">No invoices match.</td></tr>}
            {filtered.map(i => {
              const owed = Number(i.total_amount - (i.amount_paid || 0))
              return (
                <tr key={i.id} className="hover:bg-white/5">
                  <td className="px-5 py-3 font-mono text-xs text-white/80">{i.invoice_number}</td>
                  <td className="px-3 py-3">
                    <div className="text-white">{i.restaurant?.name || '—'}</div>
                    {i.chain?.name && <div className="text-xs text-white/40">{i.chain.name}</div>}
                  </td>
                  <td className="px-3 py-3 text-white/70 text-xs">{fmtDate(i.issue_date)}</td>
                  <td className="px-3 py-3 text-white/70 text-xs">{fmtDate(i.due_date)}</td>
                  <td className="px-3 py-3"><Pill tone={INVOICE_STATUS_TONES[i.status]}>{i.status}</Pill></td>
                  <td className="px-3 py-3 text-right text-white">{fmtMoney(i.total_amount)}</td>
                  <td className="px-5 py-3 text-right">
                    {owed > 0 ? <span className="text-orange-300">{fmtMoney(owed)}</span> : <span className="text-emerald-300/80">{fmtMoney(0)}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
