import { useEffect, useMemo, useState } from 'react'
import { cscSupabase } from '../../lib/cscClient'

export default function CscAhjMap() {
  const [ahjs, setAhjs] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const [a, r] = await Promise.all([
      cscSupabase.from('csc_ahj_jurisdictions').select('*').order('state').order('city'),
      cscSupabase.from('csc_restaurants').select('id, ahj_jurisdiction_id'),
    ])
    setAhjs(a.data || [])
    const c = {}
    ;(r.data || []).forEach(rr => { if (rr.ahj_jurisdiction_id) c[rr.ahj_jurisdiction_id] = (c[rr.ahj_jurisdiction_id] || 0) + 1 })
    setCounts(c)
    setLoading(false)
  }

  const byState = useMemo(() => {
    const grouped = {}
    ahjs.forEach(a => { (grouped[a.state] = grouped[a.state] || []).push(a) })
    return grouped
  }, [ahjs])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-navy-700/50 bg-navy-800 p-5">
        <div className="text-sm text-gray-400">
          <span className="text-brand-cyan font-semibold">AHJ portal preview.</span> Once a jurisdiction subscribes (free for marshals), they get a public dashboard showing every active sticker in their area + QR-verified compliance state in real time. Click-to-verify on any sticker scan. This is the LABOS-KEC moat — when one fire marshal in Hartford starts asking "scan the sticker", every contractor in his jurisdiction has to be on LABOS or look like they're hiding something.
        </div>
      </div>

      <div className="space-y-6">
        {loading && <div className="text-gray-500 text-sm">Loading…</div>}
        {!loading && Object.keys(byState).sort().map(state => (
          <div key={state}>
            <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">{state} — {byState[state].length} jurisdiction{byState[state].length !== 1 ? 's' : ''}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {byState[state].map(a => (
                <div key={a.id} className="rounded-xl border border-navy-700/50 bg-navy-800 p-4 hover:bg-navy-700 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium">{a.name}</div>
                      <div className="text-xs text-gray-500 capitalize mt-0.5">{(a.jurisdiction_type || '').replace('_', ' ')} · {a.city}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-heading text-brand-cyan">{counts[a.id] || 0}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">accounts</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-navy-700/40 space-y-1 text-xs">
                    {a.contact_name && <div className="text-gray-300">{a.contact_name}</div>}
                    {a.contact_email && <div className="text-blue-300/80 truncate">{a.contact_email}</div>}
                    {a.contact_phone && <div className="text-gray-400">{a.contact_phone}</div>}
                  </div>
                  {a.accepts_digital_certs && (
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                      Accepts digital certs
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
