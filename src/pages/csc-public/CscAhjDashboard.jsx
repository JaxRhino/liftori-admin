import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { cscSupabase, fmtDate, relTime } from '../../lib/cscClient'

// NFPA 96 light inspection checklist used by the AHJ when recording a field check.
const CHECKLIST_ITEMS = [
  { key: 'canopy', label: 'Canopy / hood interior clean to bare metal' },
  { key: 'ducts', label: 'Ducts clear, access panels openable' },
  { key: 'fan', label: 'Exhaust fan housing degreased, hinge functional' },
  { key: 'sticker', label: 'Current NFPA 96 sticker posted & intact' },
  { key: 'grease', label: 'Grease depth within threshold (< 0.125")' },
]

function statusOf(nextDue) {
  if (!nextDue) return 'unknown'
  const d = new Date(nextDue).getTime()
  const now = Date.now()
  if (d < now) return 'overdue'
  if (d < now + 30 * 86400000) return 'expiring'
  return 'current'
}
const STATUS_TONE = {
  current: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  expiring: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  overdue: 'bg-red-500/20 text-red-300 border-red-500/40',
  unknown: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
}
const STATUS_LABEL = { current: 'Current', expiring: 'Expiring soon', overdue: 'Overdue', unknown: 'No record' }

function Stat({ value, label, tone = 'text-white' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className={`text-3xl font-heading ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/50 mt-1">{label}</div>
    </div>
  )
}

export default function CscAhjDashboard() {
  const { slug } = useParams()
  const [ahj, setAhj] = useState(null)
  const [rows, setRows] = useState([])
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null) // restaurant row being inspected

  async function load() {
    setLoading(true); setError(null)
    const { data: a, error: aErr } = await cscSupabase
      .from('csc_ahj_jurisdictions').select('*').eq('slug', slug).maybeSingle()
    if (aErr || !a) { setError(aErr?.message || 'Jurisdiction not found'); setLoading(false); return }
    setAhj(a)
    const { data: rest } = await cscSupabase
      .from('csc_restaurants')
      .select('id, name, address_line1, city, state, zip, frequency_tier, hood_count, last_cleaned_at, next_due_at, last_grease_depth_inches, contact_name')
      .eq('ahj_jurisdiction_id', a.id).eq('ahj_enrolled', true).order('next_due_at')
    const ids = (rest || []).map(r => r.id)
    let certByRest = {}
    if (ids.length) {
      const { data: certs } = await cscSupabase
        .from('csc_certificates')
        .select('restaurant_id, cleaning_id, cert_number, qr_code, public_verify_url, expires_at, issued_at')
        .in('restaurant_id', ids).order('issued_at', { ascending: false })
      for (const c of certs || []) if (!certByRest[c.restaurant_id]) certByRest[c.restaurant_id] = c
    }
    setRows((rest || []).map(r => ({ ...r, cert: certByRest[r.id] || null })))
    const { data: insp } = await cscSupabase
      .from('csc_ahj_inspections').select('*, restaurant:csc_restaurants(name)')
      .eq('ahj_jurisdiction_id', a.id).order('inspected_at', { ascending: false }).limit(12)
    setInspections(insp || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [slug])

  const counts = useMemo(() => {
    const c = { current: 0, expiring: 0, overdue: 0, unknown: 0 }
    rows.forEach(r => { c[statusOf(r.next_due_at)]++ })
    return c
  }, [rows])

  const visible = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter(r => statusOf(r.next_due_at) === filter)
  }, [rows, filter])

  function exportCsv() {
    const head = ['Location', 'Address', 'City', 'Frequency', 'Last cleaned', 'Next due', 'Status', 'Cert #']
    const lines = [head.join(',')]
    rows.forEach(r => {
      lines.push([
        r.name, r.address_line1 || '', `${r.city || ''} ${r.state || ''}`.trim(),
        r.frequency_tier || '', r.last_cleaned_at ? fmtDate(r.last_cleaned_at) : '',
        r.next_due_at ? fmtDate(r.next_due_at) : '', STATUS_LABEL[statusOf(r.next_due_at)],
        r.cert?.cert_number || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${slug}-compliance.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="py-20 text-center text-white/50">Loading jurisdiction…</div>
  if (error) return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
      <div className="text-red-300 font-semibold mb-1">Jurisdiction unavailable</div>
      <div className="text-sm text-white/50">{error}</div>
      <Link to="/csc/ahj" className="inline-block mt-4 text-sm text-orange-300 hover:text-orange-200">← Back to AHJ overview</Link>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/8 to-violet-500/5 p-6 md:p-8">
        <div className="text-xs uppercase tracking-wider text-orange-300/80 font-bold">Jurisdiction compliance portal</div>
        <h1 className="text-3xl md:text-4xl font-heading text-white mt-2">{ahj.name}</h1>
        <div className="text-sm text-white/60 mt-2">
          {[ahj.city, ahj.state].filter(Boolean).join(', ')}
          {ahj.contact_name && <> · Contact: {ahj.contact_name}</>}
        </div>
        <p className="text-sm text-white/50 mt-3 max-w-2xl">
          Every enrolled foodservice location in your jurisdiction, with live NFPA 96 compliance status.
          Scan any sticker for an instant cert, or record a field inspection below. Free for AHJs — always.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat value={rows.length} label="Enrolled locations" />
        <Stat value={counts.current} label="Current" tone="text-emerald-300" />
        <Stat value={counts.expiring} label="Expiring ≤30d" tone="text-amber-300" />
        <Stat value={counts.overdue} label="Overdue" tone="text-red-300" />
      </div>

      {/* Filter + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {['all', 'overdue', 'expiring', 'current'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === f ? 'bg-orange-500/25 border-orange-500/40 text-orange-200'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}>
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/70 hover:text-white">
          Export CSV
        </button>
      </div>

      {/* Roster */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Frequency</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Last cleaned</th>
              <th className="text-left px-4 py-3">Next due</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visible.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-white/40">No locations in this filter.</td></tr>
            )}
            {visible.map(r => {
              const st = statusOf(r.next_due_at)
              return (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{r.name}</div>
                    <div className="text-xs text-white/40">{[r.address_line1, r.city, r.state].filter(Boolean).join(', ')}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-white/70 capitalize">{(r.frequency_tier || '').replace('_', '-')}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-white/60">{r.last_cleaned_at ? fmtDate(r.last_cleaned_at) : '—'}</td>
                  <td className="px-4 py-3 text-white/80">{r.next_due_at ? fmtDate(r.next_due_at) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS_TONE[st]}`}>{STATUS_LABEL[st]}</span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.cert?.qr_code && (
                      <a href={`/csc/verify/${r.cert.qr_code}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-orange-300 hover:text-orange-200 mr-3">Verify cert</a>
                    )}
                    <button onClick={() => setModal(r)} className="text-xs text-white/70 hover:text-white">Record inspection</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent inspections */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-orange-300/80 font-bold mb-3">Recent jurisdiction inspections</h2>
        {inspections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">No inspections recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {inspections.map(i => (
              <div key={i.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-white font-medium">{i.restaurant?.name || 'Location'}</span>
                  <span className="text-xs text-white/40 ml-2">{i.inspector_name || 'AHJ'} · {relTime(i.inspected_at)}</span>
                  {i.notes && <div className="text-xs text-white/50 mt-0.5">{i.notes}</div>}
                </div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  i.result === 'pass' ? STATUS_TONE.current : i.result === 'flag' ? STATUS_TONE.expiring : STATUS_TONE.overdue}`}>
                  {i.result?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {modal && <InspectionModal row={modal} ahj={ahj} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}

function InspectionModal({ row, ahj, onClose, onSaved }) {
  const [inspector, setInspector] = useState(ahj.contact_name || '')
  const [result, setResult] = useState('pass')
  const [checks, setChecks] = useState({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function save() {
    setSaving(true); setErr(null)
    const { error } = await cscSupabase.from('csc_ahj_inspections').insert({
      restaurant_id: row.id,
      ahj_jurisdiction_id: ahj.id,
      cleaning_id: row.cert?.cleaning_id || null,
      inspector_name: inspector || null,
      result,
      checklist: checks,
      notes: notes || null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-navy-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-orange-300/80 font-bold">Record inspection</div>
            <h3 className="text-lg font-semibold text-white mt-0.5">{row.name}</h3>
            <div className="text-xs text-white/40">{[row.address_line1, row.city, row.state].filter(Boolean).join(', ')}</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50">Inspector name</label>
            <input value={inspector} onChange={e => setInspector(e.target.value)}
              className="mt-1 w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="Inspector name" />
          </div>

          <div>
            <div className="text-xs text-white/50 mb-1.5">NFPA 96 checklist</div>
            <div className="space-y-1.5">
              {CHECKLIST_ITEMS.map(it => (
                <label key={it.key} className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                  <input type="checkbox" checked={!!checks[it.key]} onChange={e => setChecks(c => ({ ...c, [it.key]: e.target.checked }))} />
                  {it.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50">Result</label>
            <div className="mt-1 flex gap-2">
              {['pass', 'flag', 'fail'].map(r => (
                <button key={r} onClick={() => setResult(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${
                    result === r ? (r === 'pass' ? STATUS_TONE.current : r === 'flag' ? STATUS_TONE.expiring : STATUS_TONE.overdue)
                      : 'bg-white/5 border-white/10 text-white/60'}`}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="mt-1 w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="Observations, follow-up required, etc." />
          </div>

          {err && <div className="text-xs text-red-300">{err}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white">Cancel</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500/30 border border-orange-500/50 text-orange-100 hover:bg-orange-500/40 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save inspection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
