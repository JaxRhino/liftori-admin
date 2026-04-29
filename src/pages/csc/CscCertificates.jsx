import { useEffect, useMemo, useState } from 'react'
import { cscSupabase, fmtDate, relTime } from '../../lib/cscClient'

export default function CscCertificates() {
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const { data } = await cscSupabase
      .from('csc_certificates')
      .select('*, restaurant:csc_restaurants(name, city, state), ahj:csc_ahj_jurisdictions(name, state)')
      .order('issued_at', { ascending: false })
    setCerts(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => certs.filter(c => {
    if (stateFilter !== 'all' && c.restaurant?.state !== stateFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${c.cert_number} ${c.restaurant?.name || ''} ${c.qr_code}`.toLowerCase().includes(q)) return false
    }
    return true
  }), [certs, stateFilter, search])

  const expiringSoon = useMemo(() => certs.filter(c => {
    const d = (new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return d > 0 && d < 30
  }).length, [certs])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Total certs issued</div>
          <div className="text-2xl font-heading text-white mt-1">{certs.length}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Expiring &lt; 30 days</div>
          <div className="text-2xl font-heading text-amber-300 mt-1">{expiringSoon}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">AHJ jurisdictions</div>
          <div className="text-2xl font-heading text-blue-300 mt-1">{new Set(certs.map(c => c.ahj_jurisdiction_id).filter(Boolean)).size}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search by cert# or QR…" value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-orange-400/50 w-72" />
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
          <option value="all">All states</option><option value="CT">CT</option><option value="MA">MA</option><option value="RI">RI</option><option value="NY">NY</option>
        </select>
        <div className="ml-auto text-xs text-white/50">{filtered.length} of {certs.length}</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/40">
            <tr><th className="text-left px-5 py-3 font-semibold">Cert #</th><th className="text-left px-3 py-3 font-semibold">QR Code</th><th className="text-left px-3 py-3 font-semibold">Account</th><th className="text-left px-3 py-3 font-semibold">Tech</th><th className="text-left px-3 py-3 font-semibold">Issued</th><th className="text-left px-3 py-3 font-semibold">Expires</th><th className="text-left px-5 py-3 font-semibold">AHJ</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && <tr><td colSpan="7" className="px-5 py-6 text-white/40">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="7" className="px-5 py-6 text-white/40">No certificates match.</td></tr>}
            {filtered.map(c => {
              const daysToExpiry = (new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              const expClass = daysToExpiry < 0 ? 'text-red-300' : daysToExpiry < 30 ? 'text-amber-300' : 'text-white/70'
              return (
                <tr key={c.id} className="hover:bg-white/5">
                  <td className="px-5 py-3 font-mono text-xs text-white">{c.cert_number}</td>
                  <td className="px-3 py-3 font-mono text-xs text-orange-300">{c.qr_code}</td>
                  <td className="px-3 py-3">
                    <div className="text-white/80">{c.restaurant?.name || '—'}</div>
                    <div className="text-xs text-white/40">{c.restaurant?.city}, {c.restaurant?.state}</div>
                  </td>
                  <td className="px-3 py-3 text-white/70">{c.tech_name || '—'}</td>
                  <td className="px-3 py-3 text-white/70 text-xs">{fmtDate(c.issued_at)}</td>
                  <td className={`px-3 py-3 text-xs ${expClass}`}>
                    <div>{fmtDate(c.expires_at)}</div>
                    <div className="text-[11px] opacity-70">{relTime(c.expires_at)}</div>
                  </td>
                  <td className="px-5 py-3 text-white/70 text-xs">{c.ahj?.name || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
