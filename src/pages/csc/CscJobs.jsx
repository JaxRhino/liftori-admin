import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cscSupabase, fmtDateTime, relTime, fmtMoney, CLEANING_STATUS_TONES } from '../../lib/cscClient'

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tone}`}>{children}</span>
}

export default function CscJobs() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [whenFilter, setWhenFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const { data } = await cscSupabase
      .from('csc_cleanings')
      .select('*, restaurant:csc_restaurants(name, city, state, frequency_tier, chain:csc_chain_groups(name)), certificate:csc_certificates(cert_number)')
      .order('scheduled_at', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const now = Date.now()
    return jobs.filter(j => {
      if (statusFilter !== 'all' && j.status !== statusFilter) return false
      const ts = new Date(j.scheduled_at).getTime()
      if (whenFilter === 'past' && ts > now) return false
      if (whenFilter === 'upcoming' && ts <= now) return false
      if (whenFilter === 'today') {
        const d = new Date(j.scheduled_at); const t = new Date()
        if (d.toDateString() !== t.toDateString()) return false
      }
      if (search) {
        const q = search.toLowerCase()
        const hay = `${j.restaurant?.name || ''} ${j.restaurant?.city || ''} ${j.tech_name || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [jobs, search, statusFilter, whenFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search jobs (account, tech, city)…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-orange-400/50 w-72"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="en_route">En route</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="missed">Missed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={whenFilter} onChange={e => setWhenFilter(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
        <div className="ml-auto text-xs text-white/50">{filtered.length} of {jobs.length} jobs</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/40">
            <tr>
              <th className="text-left px-5 py-3 font-semibold">Scheduled</th>
              <th className="text-left px-3 py-3 font-semibold">Account</th>
              <th className="text-left px-3 py-3 font-semibold">Tech</th>
              <th className="text-left px-3 py-3 font-semibold">Status</th>
              <th className="text-left px-3 py-3 font-semibold">Grease (pre/post)</th>
              <th className="text-left px-3 py-3 font-semibold">Cert</th>
              <th className="text-right px-5 py-3 font-semibold">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && <tr><td colSpan="7" className="px-5 py-6 text-white/40">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="7" className="px-5 py-6 text-white/40">No jobs match.</td></tr>}
            {filtered.map(j => {
              const exceeded = j.exceeded_threshold || (j.grease_depth_pre_inches && Number(j.grease_depth_pre_inches) >= 0.125)
              return (
                <tr key={j.id} onClick={() => navigate(`/admin/csc/jobs/${j.id}`)} className="hover:bg-white/10 cursor-pointer">
                  <td className="px-5 py-3">
                    <div className="text-white">{fmtDateTime(j.scheduled_at)}</div>
                    <div className="text-xs text-white/40">{relTime(j.scheduled_at)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-white">{j.restaurant?.name || '—'}</div>
                    <div className="text-xs text-white/40">{j.restaurant?.city}, {j.restaurant?.state}{j.restaurant?.chain?.name ? ` · ${j.restaurant.chain.name}` : ''}</div>
                  </td>
                  <td className="px-3 py-3 text-white/70">{j.tech_name || <span className="text-white/30 italic">Unassigned</span>}</td>
                  <td className="px-3 py-3"><Pill tone={CLEANING_STATUS_TONES[j.status]}>{j.status.replace('_', ' ')}</Pill></td>
                  <td className="px-3 py-3 text-white/70">
                    {j.grease_depth_pre_inches != null ? (
                      <div>
                        <span className={exceeded ? 'text-red-300 font-medium' : ''}>{Number(j.grease_depth_pre_inches).toFixed(3)}"</span>
                        <span className="text-white/40"> → </span>
                        <span className="text-emerald-300/80">{j.grease_depth_post_inches != null ? Number(j.grease_depth_post_inches).toFixed(3) + '"' : '—'}</span>
                        {exceeded && <span className="ml-1 text-[10px] text-red-300 uppercase">⚠ over</span>}
                      </div>
                    ) : <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-white/60 font-mono">{j.certificate?.cert_number || <span className="text-white/30 italic">—</span>}</td>
                  <td className="px-5 py-3 text-right text-white/70">{fmtMoney(j.job_price)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
