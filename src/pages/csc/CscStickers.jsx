import { useEffect, useMemo, useState } from 'react'
import { cscSupabase, fmtDate, relTime } from '../../lib/cscClient'

const STATUS_TONES = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  expired: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  replaced: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  damaged: 'bg-red-500/20 text-red-300 border-red-500/40',
}

function Pill({ tone, children }) { return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tone}`}>{children}</span> }

export default function CscStickers() {
  const [stickers, setStickers] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const { data } = await cscSupabase
      .from('csc_stickers')
      .select('*, certificate:csc_certificates(cert_number, expires_at, restaurant:csc_restaurants(name, city, state))')
      .order('placed_at', { ascending: false })
    setStickers(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => stickers.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${s.qr_code} ${s.certificate?.restaurant?.name || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  }), [stickers, statusFilter, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search QR or account…" value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-orange-400/50 w-72" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
          <option value="all">All statuses</option><option value="active">Active</option><option value="expired">Expired</option><option value="replaced">Replaced</option><option value="damaged">Damaged</option>
        </select>
        <div className="ml-auto text-xs text-white/50">{filtered.length} of {stickers.length}</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/40">
            <tr><th className="text-left px-5 py-3 font-semibold">QR Code</th><th className="text-left px-3 py-3 font-semibold">Cert #</th><th className="text-left px-3 py-3 font-semibold">Account</th><th className="text-left px-3 py-3 font-semibold">Hood location</th><th className="text-left px-3 py-3 font-semibold">Placed</th><th className="text-left px-3 py-3 font-semibold">Status</th><th className="text-left px-5 py-3 font-semibold">Verify URL</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && <tr><td colSpan="7" className="px-5 py-6 text-white/40">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="7" className="px-5 py-6 text-white/40">No stickers match.</td></tr>}
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-white/5">
                <td className="px-5 py-3 font-mono text-xs text-orange-300">{s.qr_code}</td>
                <td className="px-3 py-3 font-mono text-xs text-white/70">{s.certificate?.cert_number || '—'}</td>
                <td className="px-3 py-3">
                  <div className="text-white/80">{s.certificate?.restaurant?.name || '—'}</div>
                  <div className="text-xs text-white/40">{s.certificate?.restaurant?.city}, {s.certificate?.restaurant?.state}</div>
                </td>
                <td className="px-3 py-3 text-white/70 text-xs capitalize">{(s.hood_location || '').replace('_', ' ')}</td>
                <td className="px-3 py-3 text-xs">
                  <div className="text-white/70">{fmtDate(s.placed_at)}</div>
                  <div className="text-white/40">{relTime(s.placed_at)}</div>
                </td>
                <td className="px-3 py-3"><Pill tone={STATUS_TONES[s.status]}>{s.status}</Pill></td>
                <td className="px-5 py-3 font-mono text-[11px] text-blue-300/80 truncate max-w-xs">/verify/{s.qr_code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
