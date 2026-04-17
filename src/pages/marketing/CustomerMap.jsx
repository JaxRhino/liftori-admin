import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatInt } from '../../lib/marketingService'

const STATE_CENTROIDS = {
  AL: [-86.79, 32.81], AK: [-152.40, 64.20], AZ: [-111.66, 34.28], AR: [-92.34, 34.75],
  CA: [-119.68, 37.29], CO: [-105.54, 39.06], CT: [-72.73, 41.59], DE: [-75.51, 38.99],
  FL: [-81.65, 28.49], GA: [-83.44, 32.65], HI: [-157.50, 20.76], ID: [-114.73, 44.24],
  IL: [-89.19, 40.04], IN: [-86.28, 39.90], IA: [-93.21, 42.07], KS: [-98.38, 38.49],
  KY: [-84.67, 37.53], LA: [-91.87, 31.07], ME: [-69.24, 45.37], MD: [-76.80, 39.05],
  MA: [-71.82, 42.26], MI: [-84.53, 43.33], MN: [-94.30, 46.28], MS: [-89.66, 32.74],
  MO: [-92.46, 38.46], MT: [-109.63, 47.05], NE: [-99.79, 41.53], NV: [-116.63, 38.50],
  NH: [-71.58, 43.68], NJ: [-74.52, 40.20], NM: [-106.10, 34.40], NY: [-74.95, 42.96],
  NC: [-79.81, 35.56], ND: [-99.79, 47.45], OH: [-82.79, 40.28], OK: [-97.50, 35.57],
  OR: [-122.07, 43.93], PA: [-77.79, 40.59], RI: [-71.52, 41.68], SC: [-80.95, 33.86],
  SD: [-99.44, 44.29], TN: [-86.70, 35.75], TX: [-97.56, 31.05], UT: [-111.86, 39.32],
  VT: [-72.71, 44.04], VA: [-78.17, 37.77], WA: [-121.49, 47.40], WV: [-80.95, 38.49],
  WI: [-89.62, 44.27], WY: [-107.30, 42.75], DC: [-77.03, 38.91],
}
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'DC',
}

function normalizeState(raw) {
  if (!raw) return null
  const s = String(raw).trim().toUpperCase()
  if (STATE_CENTROIDS[s]) return s
  for (const [k, name] of Object.entries(STATE_NAMES)) {
    if (name.toUpperCase() === s) return k
  }
  return null
}

function project(lon, lat, width = 800, height = 460) {
  // Simple bounding-box projection for CONUS with AK/HI fudged
  if (lon < -130) { // AK
    return { x: 60, y: height - 70 }
  }
  if (lat < 24 && lon > -160 && lon < -150) { // HI
    return { x: 150, y: height - 50 }
  }
  const lonMin = -125, lonMax = -66
  const latMin = 24, latMax = 50
  const x = ((lon - lonMin) / (lonMax - lonMin)) * width
  const y = height - ((lat - latMin) / (latMax - latMin)) * height
  return { x, y }
}

export default function CustomerMap() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email, role, legal_city, legal_state, legal_country')
        .order('created_at', { ascending: false })
        .limit(1000)
      setProfiles(data || [])
    } catch (e) { console.error('Map load:', e) }
    finally { setLoading(false) }
  }

  const byState = useMemo(() => {
    const m = {}
    profiles.forEach(p => {
      const st = normalizeState(p.legal_state)
      if (!st) return
      if (!m[st]) m[st] = { state: st, count: 0, profiles: [] }
      m[st].count++
      m[st].profiles.push(p)
    })
    return Object.values(m).sort((a, b) => b.count - a.count)
  }, [profiles])

  const byCountry = useMemo(() => {
    const m = {}
    profiles.forEach(p => {
      const c = (p.legal_country || 'Unknown').trim() || 'Unknown'
      if (!m[c]) m[c] = 0
      m[c]++
    })
    return Object.entries(m).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count)
  }, [profiles])

  const maxCount = Math.max(1, ...byState.map(s => s.count))
  const filtered = selectedState ? profiles.filter(p => normalizeState(p.legal_state) === selectedState) : profiles
  const totalUSA = byState.reduce((a, s) => a + s.count, 0)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Map</h1>
        <p className="text-sm text-gray-400 mt-1">Geographic distribution of customers and team members.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total Profiles" value={formatInt(profiles.length)} />
        <Kpi label="USA Profiles" value={formatInt(totalUSA)} />
        <Kpi label="States Covered" value={formatInt(byState.length)} />
        <Kpi label="Countries" value={formatInt(byCountry.length)} />
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">USA Distribution</h2>
          {selectedState && (
            <button onClick={() => setSelectedState(null)} className="text-xs text-sky-400 hover:underline">Clear filter</button>
          )}
        </div>
        {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
          <svg viewBox="0 0 800 460" className="w-full h-auto bg-navy-900/40 rounded-lg">
            <rect x="0" y="0" width="800" height="460" fill="transparent" />
            {byState.map(s => {
              const c = STATE_CENTROIDS[s.state]
              if (!c) return null
              const { x, y } = project(c[0], c[1])
              const r = 4 + Math.sqrt(s.count / maxCount) * 20
              const isSelected = selectedState === s.state
              const color = s.count >= maxCount * 0.5 ? '#f43f5e' : s.count >= maxCount * 0.2 ? '#f59e0b' : '#38bdf8'
              return (
                <g key={s.state} className="cursor-pointer" onClick={() => setSelectedState(isSelected ? null : s.state)}>
                  <circle cx={x} cy={y} r={r} fill={color} fillOpacity={isSelected ? 0.9 : 0.5} stroke={color} strokeWidth={isSelected ? 3 : 1} />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="white" fontWeight="600" pointerEvents="none">{s.count}</text>
                  <title>{STATE_NAMES[s.state]}: {s.count} profile{s.count === 1 ? '' : 's'}</title>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
          <h2 className="text-sm font-semibold text-white mb-3">
            {selectedState ? `Profiles in ${STATE_NAMES[selectedState]} (${filtered.length})` : `All Profiles (${filtered.length})`}
          </h2>
          {filtered.length === 0 ? <p className="text-gray-500 text-sm">No profiles.</p> : (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-gray-400 sticky top-0 bg-navy-800">
                  <tr>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Role</th>
                    <th className="text-left py-2">City</th>
                    <th className="text-left py-2">State</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map(p => (
                    <tr key={p.id} className="border-t border-navy-700/40">
                      <td className="py-1.5 text-white">{p.full_name || p.email}</td>
                      <td className="py-1.5 text-gray-300 capitalize text-xs">{p.role}</td>
                      <td className="py-1.5 text-gray-300">{p.legal_city || '—'}</td>
                      <td className="py-1.5 text-gray-300">{p.legal_state || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
          <h2 className="text-sm font-semibold text-white mb-3">By Country</h2>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {byCountry.map(c => (
              <div key={c.country} className="flex items-center justify-between text-sm border-b border-navy-700/40 py-1.5">
                <span className="text-gray-300">{c.country}</span>
                <span className="text-white font-semibold">{formatInt(c.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-xl font-bold mt-1 text-white">{value}</p>
    </div>
  )
}
