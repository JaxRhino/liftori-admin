import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cscSupabase, fmtDateTime, relTime, CLEANING_STATUS_TONES } from '../../lib/cscClient'

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${tone}`}>{children}</span>
}

export default function CscTechHome() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('today')

  useEffect(() => { fetchJobs() }, [])
  async function fetchJobs() {
    setLoading(true)
    const { data } = await cscSupabase
      .from('csc_cleanings')
      .select('id, scheduled_at, status, tech_name, restaurant:csc_restaurants(name, city, state, address_line1, rooftop_access_notes, hood_count, frequency_tier)')
      .in('status', ['scheduled', 'en_route', 'in_progress', 'completed'])
      .order('scheduled_at', { ascending: false })
      .limit(20)
    setJobs(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    return jobs.filter(j => {
      const ts = new Date(j.scheduled_at).getTime()
      if (filter === 'today') return ts >= today.getTime() && ts < tomorrow.getTime() + 86400000 * 7  // today + next 7 days
      if (filter === 'in_progress') return j.status === 'in_progress' || j.status === 'en_route'
      if (filter === 'recent') return j.status === 'completed'
      return true
    }).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
  }, [jobs, filter])

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-orange-300/80 font-semibold">Field Technician</div>
        <h1 className="text-xl font-heading text-white mt-0.5">Tonight's Jobs</h1>
        <div className="text-xs text-white/50 mt-1">Tap any job to start the close-out workflow.</div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
        {[
          { k: 'today', label: 'Upcoming' },
          { k: 'in_progress', label: 'In progress' },
          { k: 'recent', label: 'Recent' },
        ].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${filter === f.k ? 'bg-orange-500/20 border-orange-500/40 text-orange-200' : 'bg-white/5 border-white/10 text-white/60'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-white/40 text-sm py-8 text-center">Loading…</div>}
      {!loading && filtered.length === 0 && <div className="text-white/40 text-sm py-8 text-center">No jobs in this view.</div>}

      <div className="space-y-2">
        {filtered.map((j, idx) => {
          const isNext = idx === 0 && (filter === 'today' || filter === 'in_progress')
          return (
            <Link key={j.id} to={`/csc/tech/job/${j.id}`} className="block">
              <div className={`rounded-xl border p-4 transition-colors ${isNext ? 'border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Pill tone={CLEANING_STATUS_TONES[j.status]}>{j.status.replace('_', ' ')}</Pill>
                      {isNext && <Pill tone="bg-orange-500/30 text-orange-200 border-orange-400/50">▶ START NOW</Pill>}
                      {j.restaurant?.rooftop_access_notes && <Pill tone="bg-red-500/20 text-red-300 border-red-500/40">⚠ Roof key</Pill>}
                    </div>
                    <div className="text-base font-medium text-white mt-1.5">{j.restaurant?.name}</div>
                    <div className="text-xs text-white/50 mt-0.5">{j.restaurant?.address_line1} · {j.restaurant?.city}, {j.restaurant?.state}</div>
                    <div className="text-[11px] text-white/40 mt-1">
                      {j.restaurant?.hood_count} hood{j.restaurant?.hood_count !== 1 ? 's' : ''} · {(j.restaurant?.frequency_tier || '').replace('_','-')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-white/80">{new Date(j.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{relTime(j.scheduled_at)}</div>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
