import { useEffect, useMemo, useRef, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'
import { toast } from 'sonner'

// rf28 Storm & weather tracking. Storm-date lookup for insurance claims +
// canvassing targeting. Reads NOAA SPC preliminary storm reports through the
// MAIN `storm-lookup` edge function (server-side proxy, no key/CORS), and
// saves chosen events to the tenant's own `storm_events` table.

const STORM_FN_URL = 'https://qlerfkdyslndjbaltkwo.supabase.co/functions/v1/storm-lookup'

const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const todayISO = () => new Date().toISOString().slice(0, 10)
const daysAgoISO = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

const TYPE_META = {
  hail: { label: 'Hail', color: 'bg-blue-500/20 text-blue-300' },
  wind: { label: 'Wind', color: 'bg-amber-500/20 text-amber-300' },
  torn: { label: 'Tornado', color: 'bg-red-500/20 text-red-300' },
  tornado: { label: 'Tornado', color: 'bg-red-500/20 text-red-300' },
}

export default function OperationsStorms() {
  const { client } = useCrmClient()

  const [address, setAddress] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [coord, setCoord] = useState(null) // { lat, lng, label }
  const [startDate, setStartDate] = useState(daysAgoISO(30))
  const [endDate, setEndDate] = useState(todayISO())
  const [radius, setRadius] = useState(25)
  const [types, setTypes] = useState({ hail: true, wind: true, torn: true })
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null) // { summary, events } | null
  const [saved, setSaved] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const suggestTimer = useRef(null)

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client])

  async function load() {
    try {
      setLoading(true)
      const [sRes, jRes] = await Promise.all([
        client.from('storm_events').select('*').order('event_date', { ascending: false }),
        client.from('customer_pipeline').select('id, title').order('created_at', { ascending: false }).limit(200),
      ])
      setSaved(sRes?.data || [])
      setJobs(jRes?.data || [])
    } catch (e) { console.error('storms load failed', e) } finally { setLoading(false) }
  }

  // ---- geocoding (Nominatim) ----
  async function geocode(q, limit = 5) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=${limit}&q=${encodeURIComponent(q)}`
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    return r.json()
  }
  function onAddrChange(v) {
    setAddress(v); setCoord(null)
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (!v.trim() || v.trim().length < 4) { setSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      try { const rows = await geocode(v, 5); setSuggestions(Array.isArray(rows) ? rows : []) }
      catch { setSuggestions([]) }
    }, 350)
  }
  function pickSuggestion(s) {
    setAddress(s.display_name)
    setCoord({ lat: parseFloat(s.lat), lng: parseFloat(s.lon), label: s.display_name })
    setSuggestions([])
  }
  async function findAddress() {
    if (!address.trim()) return
    try {
      const rows = await geocode(address, 1)
      if (rows && rows[0]) { setCoord({ lat: parseFloat(rows[0].lat), lng: parseFloat(rows[0].lon), label: rows[0].display_name }); setSuggestions([]) }
      else toast.error('Address not found')
    } catch { toast.error('Lookup failed') }
  }

  async function runSearch() {
    if (!coord) { toast.error('Find an address first'); return }
    const wantTypes = Object.entries(types).filter(([, v]) => v).map(([k]) => k)
    if (!wantTypes.length) { toast.error('Pick at least one storm type'); return }
    setSearching(true); setResults(null)
    try {
      const r = await fetch(STORM_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: coord.lat, lng: coord.lng, radius_miles: Number(radius) || 25, start_date: startDate, end_date: endDate, types: wantTypes }),
      })
      const j = await r.json().catch(() => null)
      if (!j || j.error) { toast.error((j && j.error) || 'Storm lookup failed'); setResults({ summary: { total: 0 }, events: [] }); return }
      setResults({ summary: j.summary || { total: (j.events || []).length }, events: j.events || [], source: j.source, days: j.days_searched })
    } catch (e) { console.error(e); toast.error('Storm lookup failed') }
    finally { setSearching(false) }
  }

  async function saveEvent(ev) {
    try {
      const row = {
        event_date: ev.date, event_type: ev.type, magnitude: ev.magnitude, magnitude_label: ev.magnitude_label,
        location: ev.location, county: ev.county, state: ev.state, lat: ev.lat, lng: ev.lng, distance_mi: ev.distance_mi,
        source: results?.source || 'NOAA SPC', search_address: coord?.label || address,
      }
      const { error } = await client.from('storm_events').insert(row)
      if (error) throw error
      toast.success('Storm saved')
      load()
    } catch (e) { console.error(e); toast.error('Could not save storm') }
  }
  async function linkJob(id, pipeline_id) {
    try { await client.from('storm_events').update({ pipeline_id: pipeline_id || null, updated_at: new Date().toISOString() }).eq('id', id); load() }
    catch (e) { console.error(e) }
  }
  async function saveNote(id, notes) {
    try { await client.from('storm_events').update({ notes, updated_at: new Date().toISOString() }).eq('id', id) }
    catch (e) { console.error(e) }
  }
  async function deleteEvent(id) {
    try { await client.from('storm_events').delete().eq('id', id); setSaved(s => s.filter(x => x.id !== id)) }
    catch (e) { console.error(e); toast.error('Delete failed') }
  }

  const jobById = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs])
  const savedStats = useMemo(() => {
    const hail = saved.filter(s => s.event_type === 'hail')
    const maxHail = hail.reduce((m, s) => Math.max(m, Number(s.magnitude) || 0), 0)
    return { total: saved.length, hail: hail.length, wind: saved.filter(s => s.event_type === 'wind').length, maxHail }
  }, [saved])

  return (
    <HubPage title="Storm Center" subtitle="Look up hail, wind and tornado history for any address — for insurance claims and canvassing targeting.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Saved storms" value={savedStats.total} />
        <StatCard label="Hail events" value={savedStats.hail} accent="text-blue-300" />
        <StatCard label="Wind events" value={savedStats.wind} accent="text-amber-300" />
        <StatCard label="Largest hail" value={savedStats.maxHail ? savedStats.maxHail.toFixed(2) + '"' : '-'} accent="text-blue-300" />
      </div>

      <Section title="Storm lookup">
        <div className="p-5 space-y-4">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Property address or area</label>
            <div className="flex gap-2">
              <input value={address} onChange={e => onAddrChange(e.target.value)} placeholder="123 Main St, Jacksonville, FL"
                className="flex-1 bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white" />
              <button onClick={findAddress} className="bg-navy-700 hover:bg-navy-600 text-white text-sm px-4 rounded-lg whitespace-nowrap">Find</button>
            </div>
            {suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-navy-900 border border-navy-700 rounded-lg overflow-hidden shadow-xl">
                {suggestions.map((s, i) => (
                  <button key={i} type="button" onMouseDown={e => { e.preventDefault(); pickSuggestion(s) }}
                    className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-navy-700 border-b border-navy-700/50 last:border-0">{s.display_name}</button>
                ))}
              </div>
            )}
            {coord && <p className="text-xs text-emerald-400 mt-1.5">Located: {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">From</label>
              <input type="date" value={startDate} max={todayISO()} onChange={e => setStartDate(e.target.value)} className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">To</label>
              <input type="date" value={endDate} max={todayISO()} onChange={e => setEndDate(e.target.value)} className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Radius (miles)</label>
              <input type="number" value={radius} min={1} max={150} onChange={e => setRadius(e.target.value)} className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Storm types</label>
              <div className="flex items-center gap-3 pt-2">
                {[['hail', 'Hail'], ['wind', 'Wind'], ['torn', 'Tornado']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-1.5 text-sm text-gray-300">
                    <input type="checkbox" checked={!!types[k]} onChange={e => setTypes(t => ({ ...t, [k]: e.target.checked }))} />{l}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-500">Source: NOAA Storm Prediction Center preliminary reports. Hail in inches, wind in knots (kt).</p>
            <button onClick={runSearch} disabled={searching || !coord} className="bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">{searching ? 'Searching...' : 'Search storms'}</button>
          </div>
        </div>
      </Section>

      {results && (
        <div className="mt-5">
          <Section title={`Results — ${results.summary.total} report${results.summary.total === 1 ? '' : 's'}${results.days ? ' across ' + results.days + ' day(s)' : ''}`}>
            {results.events.length === 0 ? (
              <div className="p-8"><EmptyState title="No severe-weather reports found" description="No hail, wind or tornado reports in this radius and date range. Try widening the radius or the dates." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-navy-700/50 text-gray-400">
                    <th className="text-left px-4 py-2.5 font-semibold">Date</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Type</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Size / Speed</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Location</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Distance</th>
                    <th className="text-right px-4 py-2.5 font-semibold"></th>
                  </tr></thead>
                  <tbody>
                    {results.events.map((ev, i) => {
                      const m = TYPE_META[ev.type] || { label: ev.type, color: 'bg-gray-500/20 text-gray-300' }
                      return (
                        <tr key={i} className="border-b border-navy-800 hover:bg-navy-800/40">
                          <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{fmtDate(ev.date)}</td>
                          <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${m.color}`}>{m.label}</span></td>
                          <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">{ev.magnitude_label}</td>
                          <td className="px-4 py-2.5 text-gray-300">{[ev.location, ev.county, ev.state].filter(Boolean).join(', ')}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400 whitespace-nowrap">{ev.distance_mi} mi</td>
                          <td className="px-4 py-2.5 text-right"><button onClick={() => saveEvent(ev)} className="text-brand-blue hover:text-brand-cyan text-sm">Save</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      <div className="mt-6">
        <Section title="Saved storms">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
          ) : saved.length === 0 ? (
            <div className="p-8"><EmptyState title="No saved storms yet" description="Search an address above and save the relevant hail or wind dates to build your storm history for claims and canvassing." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-navy-700/50 text-gray-400">
                  <th className="text-left px-4 py-2.5 font-semibold">Date</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Type</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Size / Speed</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Location</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Linked job</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Note</th>
                  <th className="text-right px-4 py-2.5 font-semibold"></th>
                </tr></thead>
                <tbody>
                  {saved.map((s) => {
                    const m = TYPE_META[s.event_type] || { label: s.event_type, color: 'bg-gray-500/20 text-gray-300' }
                    return (
                      <tr key={s.id} className="border-b border-navy-800 align-top">
                        <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{fmtDate(s.event_date)}</td>
                        <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${m.color}`}>{m.label}</span></td>
                        <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">{s.magnitude_label || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-300">{[s.location, s.county, s.state].filter(Boolean).join(', ') || s.search_address || '-'}</td>
                        <td className="px-4 py-2.5">
                          <select value={s.pipeline_id || ''} onChange={e => linkJob(s.id, e.target.value)} className="bg-navy-950 border border-navy-700 rounded px-2 py-1 text-xs text-white max-w-[160px]">
                            <option value="">—</option>
                            {jobs.map(j => <option key={j.id} value={j.id}>{j.title || 'Job'}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input defaultValue={s.notes || ''} onBlur={e => saveNote(s.id, e.target.value)} placeholder="Add note" className="bg-navy-950 border border-navy-700 rounded px-2 py-1 text-xs text-white w-40" />
                        </td>
                        <td className="px-4 py-2.5 text-right"><button onClick={() => deleteEvent(s.id)} className="text-red-400 hover:text-red-300 text-sm">Remove</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </HubPage>
  )
}
