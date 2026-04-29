import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cscSupabase, fmtMoney, fmtDate, relTime, CLEANING_STATUS_TONES, SEVERITY_TONES, INVOICE_STATUS_TONES } from '../../lib/cscClient'

function StatCard({ label, value, hint, accent, to }) {
  const inner = (
    <div className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-5 h-full">
      <div className="text-xs uppercase tracking-wider text-white/40 font-semibold">{label}</div>
      <div className={`text-3xl font-heading mt-2 ${accent || 'text-white'}`}>{value}</div>
      {hint && <div className="text-xs text-white/40 mt-1">{hint}</div>}
    </div>
  )
  return to ? <Link to={to} className="block">{inner}</Link> : inner
}

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tone}`}>{children}</span>
}

export default function CscOverview() {
  const [stats, setStats] = useState({ jobsToday: 0, overdue: 0, openDeficiencies: 0, arOutstanding: 0, revenueMTD: 0, totalRestaurants: 0 })
  const [recent, setRecent] = useState([])
  const [overdueList, setOverdueList] = useState([])
  const [openDeficiencies, setOpenDeficiencies] = useState([])
  const [overdueInvoices, setOverdueInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const [jobsToday, overdue, openDef, ar, mtd, total, recentJobs, overdueRest, openDefList, overdueInv] = await Promise.all([
      cscSupabase.from('csc_cleanings').select('id', { count: 'exact', head: true }).gte('scheduled_at', todayStart.toISOString()).lt('scheduled_at', todayEnd.toISOString()),
      cscSupabase.from('csc_restaurants').select('id', { count: 'exact', head: true }).lt('next_due_at', new Date().toISOString()).eq('status', 'active'),
      cscSupabase.from('csc_deficiencies').select('id', { count: 'exact', head: true }).in('quote_status', ['open', 'quoted']),
      cscSupabase.from('csc_invoices').select('total_amount, amount_paid').in('status', ['sent', 'overdue', 'partial']),
      cscSupabase.from('csc_invoices').select('total_amount').eq('status', 'paid').gte('paid_at', monthStart.toISOString()),
      cscSupabase.from('csc_restaurants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      cscSupabase.from('csc_cleanings').select('id, scheduled_at, completed_at, status, tech_name, restaurant:csc_restaurants(name, city, state)').order('scheduled_at', { ascending: false }).limit(8),
      cscSupabase.from('csc_restaurants').select('id, name, city, state, next_due_at, frequency_tier').lt('next_due_at', new Date().toISOString()).eq('status', 'active').order('next_due_at').limit(5),
      cscSupabase.from('csc_deficiencies').select('id, title, severity, quote_amount, quote_status, restaurant:csc_restaurants(name)').in('quote_status', ['open', 'quoted']).order('created_at', { ascending: false }).limit(6),
      cscSupabase.from('csc_invoices').select('id, invoice_number, total_amount, due_date, restaurant:csc_restaurants(name)').eq('status', 'overdue').order('due_date').limit(5),
    ])

    const arSum = (ar.data || []).reduce((s, i) => s + Number(i.total_amount - (i.amount_paid || 0)), 0)
    const mtdSum = (mtd.data || []).reduce((s, i) => s + Number(i.total_amount), 0)

    setStats({
      jobsToday: jobsToday.count || 0,
      overdue: overdue.count || 0,
      openDeficiencies: openDef.count || 0,
      arOutstanding: arSum,
      revenueMTD: mtdSum,
      totalRestaurants: total.count || 0,
    })
    setRecent(recentJobs.data || [])
    setOverdueList(overdueRest.data || [])
    setOpenDeficiencies(openDefList.data || [])
    setOverdueInvoices(overdueInv.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <a href="/csc/tech" target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-200 transition-colors">
          <span>📱</span> Open tech app (new tab)
        </a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Active Accounts" value={loading ? '—' : stats.totalRestaurants} hint="restaurants under contract" to="/admin/csc/customers" />
        <StatCard label="Jobs Today" value={loading ? '—' : stats.jobsToday} hint="scheduled or in progress" to="/admin/csc/jobs" accent="text-blue-300" />
        <StatCard label="Overdue Cleanings" value={loading ? '—' : stats.overdue} hint="past next_due_at" accent={stats.overdue > 0 ? 'text-red-300' : 'text-emerald-300'} to="/admin/csc/customers" />
        <StatCard label="Open Deficiencies" value={loading ? '—' : stats.openDeficiencies} hint="open or awaiting quote" to="/admin/csc/deficiencies" accent="text-amber-300" />
        <StatCard label="AR Outstanding" value={loading ? '—' : fmtMoney(stats.arOutstanding)} hint="sent + overdue + partial" to="/admin/csc/invoices" accent={stats.arOutstanding > 0 ? 'text-orange-300' : 'text-white'} />
        <StatCard label="Revenue MTD" value={loading ? '—' : fmtMoney(stats.revenueMTD)} hint="invoices paid this month" accent="text-emerald-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent jobs */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent Jobs</h3>
            <Link to="/admin/csc/jobs" className="text-xs text-orange-300 hover:text-orange-200">View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {loading && <div className="p-5 text-sm text-white/40">Loading…</div>}
            {!loading && recent.length === 0 && <div className="p-5 text-sm text-white/40">No jobs yet.</div>}
            {recent.map(j => (
              <div key={j.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/5">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{j.restaurant?.name || '—'}</div>
                  <div className="text-xs text-white/40">{j.restaurant?.city}, {j.restaurant?.state} · {j.tech_name || 'Unassigned'}</div>
                </div>
                <div className="text-right shrink-0">
                  <Pill tone={CLEANING_STATUS_TONES[j.status]}>{j.status.replace('_', ' ')}</Pill>
                  <div className="text-[11px] text-white/40 mt-1">{relTime(j.completed_at || j.scheduled_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue cleanings */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Overdue Cleanings</h3>
            <Link to="/admin/csc/customers" className="text-xs text-orange-300 hover:text-orange-200">View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {loading && <div className="p-5 text-sm text-white/40">Loading…</div>}
            {!loading && overdueList.length === 0 && <div className="p-5 text-sm text-emerald-300/80">All accounts current ✓</div>}
            {overdueList.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/5">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{r.name}</div>
                  <div className="text-xs text-white/40">{r.city}, {r.state} · {r.frequency_tier?.replace('_', '-')}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-red-300">{fmtDate(r.next_due_at)}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">{relTime(r.next_due_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open deficiencies */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Upsell Pipeline</h3>
            <Link to="/admin/csc/deficiencies" className="text-xs text-orange-300 hover:text-orange-200">View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {loading && <div className="p-5 text-sm text-white/40">Loading…</div>}
            {!loading && openDeficiencies.length === 0 && <div className="p-5 text-sm text-white/40">No open deficiencies.</div>}
            {openDeficiencies.map(d => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/5">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{d.title}</div>
                  <div className="text-xs text-white/40">{d.restaurant?.name}</div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <Pill tone={SEVERITY_TONES[d.severity]}>{d.severity}</Pill>
                  <div className="text-xs text-white/60">{fmtMoney(d.quote_amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue invoices */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">AR Aging — Overdue</h3>
            <Link to="/admin/csc/invoices" className="text-xs text-orange-300 hover:text-orange-200">View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {loading && <div className="p-5 text-sm text-white/40">Loading…</div>}
            {!loading && overdueInvoices.length === 0 && <div className="p-5 text-sm text-emerald-300/80">No overdue invoices ✓</div>}
            {overdueInvoices.map(i => (
              <div key={i.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/5">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{i.invoice_number}</div>
                  <div className="text-xs text-white/40">{i.restaurant?.name} · due {fmtDate(i.due_date)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm text-red-300">{fmtMoney(i.total_amount)}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">{relTime(i.due_date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
