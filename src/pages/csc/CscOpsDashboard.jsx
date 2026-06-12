import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cscSupabase, fmtMoney, fmtDateTime, fmtDate, relTime, CLEANING_STATUS_TONES } from '../../lib/cscClient'

function Stat({ label, value, hint, accent, to }) {
  const inner = (
    <div className="rounded-xl border border-navy-700/50 bg-navy-800 hover:bg-navy-700 transition-colors p-5 h-full">
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className={`text-3xl font-heading mt-2 ${accent || 'text-white'}`}>{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  )
  return to ? <Link to={to} className="block">{inner}</Link> : inner
}

const STATUS_ORDER = ['scheduled', 'en_route', 'in_progress', 'completed', 'missed', 'cancelled']

export default function CscOpsDashboard() {
  const { platformId } = useParams()
  const [loading, setLoading] = useState(true)
  const [statusCounts, setStatusCounts] = useState({})
  const [upcoming, setUpcoming] = useState([])
  const [pipeline, setPipeline] = useState({ open: 0, openVal: 0, quoted: 0, quotedVal: 0, approved: 0, approvedVal: 0 })
  const [output, setOutput] = useState({ certsMonth: 0, stickersActive: 0, completed30: 0 })
  const [unconfirmed, setUnconfirmed] = useState([])

  async function fetchAll() {
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 86400000)
    const ago30 = new Date(now.getTime() - 30 * 86400000)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const [allStatuses, upcomingJobs, defs, certsMonth, stickersActive, completed30, unconf] = await Promise.all([
      cscSupabase.from('csc_cleanings').select('status'),
      cscSupabase.from('csc_cleanings').select('id, scheduled_at, status, tech_name, customer_window_confirmed, restaurant:csc_restaurants(name, city, state)').eq('status', 'scheduled').gte('scheduled_at', now.toISOString()).lte('scheduled_at', in30.toISOString()).order('scheduled_at').limit(12),
      cscSupabase.from('csc_deficiencies').select('quote_status, quote_amount').in('quote_status', ['open', 'quoted', 'approved']),
      cscSupabase.from('csc_certificates').select('id', { count: 'exact', head: true }).gte('issued_at', monthStart.toISOString()),
      cscSupabase.from('csc_stickers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      cscSupabase.from('csc_cleanings').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', ago30.toISOString()),
      cscSupabase.from('csc_cleanings').select('id, scheduled_at, tech_name, restaurant:csc_restaurants(name)').eq('status', 'scheduled').eq('customer_window_confirmed', false).gte('scheduled_at', now.toISOString()).order('scheduled_at').limit(6),
    ])

    const counts = {}
    ;(allStatuses.data || []).forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1 })
    setStatusCounts(counts)

    const pl = { open: 0, openVal: 0, quoted: 0, quotedVal: 0, approved: 0, approvedVal: 0 }
    ;(defs.data || []).forEach(d => {
      const v = Number(d.quote_amount || 0)
      if (d.quote_status === 'open') { pl.open++; pl.openVal += v }
      else if (d.quote_status === 'quoted') { pl.quoted++; pl.quotedVal += v }
      else if (d.quote_status === 'approved') { pl.approved++; pl.approvedVal += v }
    })
    setPipeline(pl)
    setOutput({ certsMonth: certsMonth.count || 0, stickersActive: stickersActive.count || 0, completed30: completed30.count || 0 })
    setUpcoming(upcomingJobs.data || [])
    setUnconfirmed(unconf.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Operations Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Field scheduling, throughput, and the deficiency pipeline</p>
      </div>

      {/* Output stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Completed (30d)" value={loading ? '—' : output.completed30} hint="cleanings finished" accent="text-emerald-300" to={`/crm/${platformId}/jobs`} />
        <Stat label="Certs This Month" value={loading ? '—' : output.certsMonth} hint="issued since the 1st" to={`/crm/${platformId}/certificates`} accent="text-brand-cyan" />
        <Stat label="Active Stickers" value={loading ? '—' : output.stickersActive} hint="posted on hoods" to={`/crm/${platformId}/stickers`} />
        <Stat label="Approved Repairs" value={loading ? '—' : fmtMoney(pipeline.approvedVal)} hint={`${pipeline.approved} jobs queued`} accent="text-emerald-300" to={`/crm/${platformId}/deficiencies`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs by status */}
        <div className="rounded-xl border border-navy-700/50 bg-navy-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Jobs by Status</h3>
          <div className="space-y-2">
            {STATUS_ORDER.map(st => {
              const n = statusCounts[st] || 0
              const max = Math.max(1, ...Object.values(statusCounts))
              return (
                <div key={st} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-400 capitalize">{st.replace('_', ' ')}</div>
                  <div className="flex-1 h-2.5 rounded-full bg-navy-900 overflow-hidden">
                    <div className="h-full bg-brand-cyan/70" style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                  <div className="w-8 text-right text-sm text-white">{n}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Deficiency pipeline */}
        <div className="rounded-xl border border-navy-700/50 bg-navy-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Deficiency Pipeline</h3>
            <Link to={`/crm/${platformId}/deficiencies`} className="text-xs text-brand-cyan">View all →</Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: 'open', label: 'Open', n: pipeline.open, v: pipeline.openVal, tone: 'text-gray-300' },
              { k: 'quoted', label: 'Quoted', n: pipeline.quoted, v: pipeline.quotedVal, tone: 'text-amber-300' },
              { k: 'approved', label: 'Approved', n: pipeline.approved, v: pipeline.approvedVal, tone: 'text-emerald-300' },
            ].map(s => (
              <div key={s.k} className="rounded-lg border border-navy-700/50 bg-navy-900 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{s.label}</div>
                <div className={`text-xl font-heading mt-1 ${s.tone}`}>{loading ? '—' : fmtMoney(s.v)}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{s.n} item{s.n === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3">Quoted + approved is the open repair revenue waiting to be scheduled.</div>
        </div>
      </div>

      {/* Upcoming schedule */}
      <div className="rounded-xl border border-navy-700/50 bg-navy-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Upcoming Schedule — next 30 days</h3>
          <Link to={`/crm/${platformId}/jobs`} className="text-xs text-brand-cyan">View all jobs →</Link>
        </div>
        <div className="divide-y divide-navy-700/50">
          {loading && <div className="p-5 text-sm text-gray-500">Loading…</div>}
          {!loading && upcoming.length === 0 && <div className="p-5 text-sm text-gray-500">Nothing scheduled in the next 30 days.</div>}
          {upcoming.map(j => (
            <div key={j.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-navy-800">
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{j.restaurant?.name || '—'}</div>
                <div className="text-xs text-gray-500">{j.restaurant?.city}, {j.restaurant?.state} · {j.tech_name || 'Unassigned'}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm text-white">{fmtDateTime(j.scheduled_at)}</div>
                <div className="text-[11px] mt-0.5">
                  {j.customer_window_confirmed
                    ? <span className="text-emerald-300">window confirmed</span>
                    : <span className="text-amber-300">awaiting confirmation</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Needs confirmation */}
      {!loading && unconfirmed.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h3 className="text-sm font-semibold text-amber-200 mb-2">Service windows awaiting customer confirmation</h3>
          <div className="space-y-1.5">
            {unconfirmed.map(j => (
              <div key={j.id} className="flex items-center justify-between text-sm">
                <span className="text-white">{j.restaurant?.name}</span>
                <span className="text-xs text-gray-400">{fmtDate(j.scheduled_at)} · {relTime(j.scheduled_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
