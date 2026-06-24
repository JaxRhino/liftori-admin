import { useEffect, useMemo, useState } from 'react'
import { cscSupabase, fmtDate, FREQUENCY_LABELS, COOKING_VOLUME_LABELS } from '../../lib/cscClient'

const MONTHS_BY_VOLUME = { solid_fuel: 1, high_volume: 3, moderate_volume: 6, low_volume: 12 }
const TIER_BY_MONTHS = { 1: 'monthly', 3: 'quarterly', 6: 'semi_annual', 12: 'annual' }
function mandatedTier(volume, tier) {
  const m = (volume && MONTHS_BY_VOLUME[volume]) || ({ monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 }[tier]) || 3
  return TIER_BY_MONTHS[m] || tier
}

const STATUS_TONE = {
  compliant: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  expiring: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  overdue: 'bg-red-500/20 text-red-300 border-red-500/40',
}
const STATUS_LABEL = { compliant: 'Compliant', expiring: 'Expiring', overdue: 'Out of compliance' }

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tone}`}>{children}</span>
}
function StatCard({ label, value, hint, accent }) {
  return (
    <div className="rounded-xl border border-navy-700/50 bg-navy-800 p-4">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent || 'text-white'}`}>{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
    </div>
  )
}

function csvEscape(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function downloadCsv(filename, rows) {
  const blob = new Blob([rows.map(r => r.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function CscReports() {
  const [loading, setLoading] = useState(true)
  const [restaurants, setRestaurants] = useState([])
  const [ahjs, setAhjs] = useState([])
  const [certs, setCerts] = useState([])
  const [defs, setDefs] = useState([])
  const [ahjFilter, setAhjFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const [r, a, c, d] = await Promise.all([
      cscSupabase.from('csc_restaurants').select('*').eq('status', 'active').order('name'),
      cscSupabase.from('csc_ahj_jurisdictions').select('id, name, state'),
      cscSupabase.from('csc_certificates').select('restaurant_id, cert_number, issued_at, expires_at'),
      cscSupabase.from('csc_deficiencies').select('restaurant_id, quote_status, severity'),
    ])
    setRestaurants(r.data || [])
    setAhjs(a.data || [])
    setCerts(c.data || [])
    setDefs(d.data || [])
    setLoading(false)
  }

  const ahjById = useMemo(() => Object.fromEntries(ahjs.map(a => [a.id, a])), [ahjs])

  const rows = useMemo(() => {
    const now = Date.now()
    const latestCert = {}
    certs.forEach(c => {
      const cur = latestCert[c.restaurant_id]
      if (!cur || (c.issued_at || '') > (cur.issued_at || '')) latestCert[c.restaurant_id] = c
    })
    const openDef = {}
    defs.forEach(d => { if (['open', 'quoted', 'approved'].includes(d.quote_status)) openDef[d.restaurant_id] = (openDef[d.restaurant_id] || 0) + 1 })

    return restaurants.map(r => {
      const ahj = ahjById[r.ahj_jurisdiction_id]
      const cert = latestCert[r.id]
      const nextDue = r.next_due_at ? new Date(r.next_due_at) : null
      const expires = cert?.expires_at ? new Date(cert.expires_at) : null
      const overdue = nextDue ? nextDue.getTime() < now : true
      const expSoon = expires ? (expires.getTime() - now) / 86400000 <= 30 && expires.getTime() >= now : false
      let status
      if (overdue || (expires && expires.getTime() < now) || !cert) status = 'overdue'
      else if (expSoon) status = 'expiring'
      else status = 'compliant'
      return {
        r, ahj, cert,
        frequency: mandatedTier(r.cooking_volume, r.frequency_tier),
        lastCleaned: r.last_cleaned_at, nextDue, expires,
        openDef: openDef[r.id] || 0, status,
      }
    })
  }, [restaurants, ahjById, certs, defs])

  const filtered = useMemo(() => rows.filter(row => {
    if (ahjFilter !== 'all' && row.r.ahj_jurisdiction_id !== ahjFilter) return false
    if (statusFilter !== 'all' && row.status !== statusFilter) return false
    return true
  }), [rows, ahjFilter, statusFilter])

  const stats = useMemo(() => {
    const total = filtered.length
    const compliant = filtered.filter(x => x.status === 'compliant').length
    return {
      total,
      rate: total ? Math.round((compliant / total) * 100) : 0,
      overdue: filtered.filter(x => x.status === 'overdue').length,
      expiring: filtered.filter(x => x.status === 'expiring').length,
      certs: filtered.filter(x => x.cert).length,
      openDef: filtered.reduce((s, x) => s + x.openDef, 0),
    }
  }, [filtered])

  function exportCsv() {
    const header = ['Account', 'City', 'State', 'AHJ', 'Cooking volume', 'NFPA 96 frequency', 'Last cleaned', 'Next due', 'Certificate #', 'Cert expires', 'Open deficiencies', 'Compliance status']
    const body = filtered.map(x => [
      x.r.name, x.r.city, x.r.state, x.ahj?.name || '',
      COOKING_VOLUME_LABELS[x.r.cooking_volume] || x.r.cooking_volume || '',
      FREQUENCY_LABELS[x.frequency] || x.frequency,
      x.lastCleaned ? fmtDate(x.lastCleaned) : '',
      x.nextDue ? fmtDate(x.nextDue) : '',
      x.cert?.cert_number || '', x.expires ? fmtDate(x.expires) : '',
      x.openDef, STATUS_LABEL[x.status],
    ])
    const scope = ahjFilter === 'all' ? 'all-jurisdictions' : (ahjById[ahjFilter]?.name || 'jurisdiction').replace(/\s+/g, '-').toLowerCase()
    downloadCsv(`csc-nfpa96-compliance-${scope}-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Compliance Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">NFPA 96 (2024) &amp; ANSI/IKECA C10-2021 compliance status across all accounts — export for owners, insurers, or the AHJ.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-3 py-2 rounded-lg text-sm border border-navy-700/50 text-gray-300 hover:bg-navy-700">Print</button>
          <button onClick={exportCsv} disabled={loading || !filtered.length} className="px-3 py-2 rounded-lg text-sm font-medium bg-orange-500/90 hover:bg-orange-500 text-white disabled:opacity-40">Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Compliance rate" value={loading ? '—' : `${stats.rate}%`} hint={`${stats.total} accounts in scope`} accent={stats.rate >= 80 ? 'text-emerald-300' : stats.rate >= 60 ? 'text-amber-300' : 'text-red-300'} />
        <StatCard label="Out of compliance" value={loading ? '—' : stats.overdue} hint="overdue or no valid cert" accent={stats.overdue ? 'text-red-300' : 'text-white'} />
        <StatCard label="Certs expiring ≤ 30d" value={loading ? '—' : stats.expiring} hint="renewal due" accent={stats.expiring ? 'text-amber-300' : 'text-white'} />
        <StatCard label="Open deficiencies" value={loading ? '—' : stats.openDef} hint="across scope" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={ahjFilter} onChange={e => setAhjFilter(e.target.value)} className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-white text-sm">
          <option value="all">All jurisdictions (AHJ)</option>
          {ahjs.map(a => <option key={a.id} value={a.id}>{a.name}{a.state ? ` (${a.state})` : ''}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-white text-sm">
          <option value="all">All statuses</option>
          <option value="compliant">Compliant</option>
          <option value="expiring">Expiring</option>
          <option value="overdue">Out of compliance</option>
        </select>
        <div className="ml-auto text-xs text-gray-400">{filtered.length} of {rows.length} accounts</div>
      </div>

      <div className="rounded-xl border border-navy-700/50 bg-navy-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy-800 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="text-left px-5 py-3 font-semibold">Account</th>
              <th className="text-left px-3 py-3 font-semibold">AHJ</th>
              <th className="text-left px-3 py-3 font-semibold">Frequency</th>
              <th className="text-left px-3 py-3 font-semibold">Last cleaned</th>
              <th className="text-left px-3 py-3 font-semibold">Certificate</th>
              <th className="text-left px-3 py-3 font-semibold">Cert expires</th>
              <th className="text-center px-3 py-3 font-semibold">Open def.</th>
              <th className="text-left px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {loading && <tr><td colSpan="8" className="px-5 py-6 text-gray-500">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="8" className="px-5 py-6 text-gray-500">No accounts match.</td></tr>}
            {filtered.map(x => (
              <tr key={x.r.id} className="hover:bg-navy-700">
                <td className="px-5 py-3">
                  <div className="text-white">{x.r.name}</div>
                  <div className="text-xs text-gray-500">{[x.r.city, x.r.state].filter(Boolean).join(', ')}</div>
                </td>
                <td className="px-3 py-3 text-gray-300">{x.ahj?.name || <span className="text-gray-500 italic">—</span>}</td>
                <td className="px-3 py-3 text-gray-300">{FREQUENCY_LABELS[x.frequency] || x.frequency}</td>
                <td className="px-3 py-3 text-gray-300">{x.lastCleaned ? fmtDate(x.lastCleaned) : <span className="text-gray-500 italic">never</span>}</td>
                <td className="px-3 py-3 font-mono text-xs text-gray-300">{x.cert?.cert_number || <span className="text-gray-500 italic">none</span>}</td>
                <td className="px-3 py-3 text-gray-300">{x.expires ? fmtDate(x.expires) : <span className="text-gray-500">—</span>}</td>
                <td className="px-3 py-3 text-center">{x.openDef ? <span className="text-amber-300">{x.openDef}</span> : <span className="text-gray-600">0</span>}</td>
                <td className="px-5 py-3"><Pill tone={STATUS_TONE[x.status]}>{STATUS_LABEL[x.status]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-gray-500">
        Compliance basis: NFPA 96 (2024) cleaning frequency by cooking volume; certificates issued per ANSI/IKECA C10-2021. "Out of compliance" = past next-due date, expired certificate, or no certificate on file.
      </div>
    </div>
  )
}
