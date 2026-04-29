import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  cscSupabase, fmtDate, fmtDateTime, fmtMoney, relTime,
  CLEANING_STATUS_TONES, SEVERITY_TONES, QUOTE_STATUS_TONES,
  FREQUENCY_LABELS,
} from '../../lib/cscClient'

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tone}`}>{children}</span>
}

function ComplianceHeader({ restaurant }) {
  const now = Date.now()
  const due = restaurant?.next_due_at ? new Date(restaurant.next_due_at).getTime() : null
  const days = due ? (due - now) / (1000 * 60 * 60 * 24) : null
  let band = { tone: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', label: 'CURRENT', dot: 'bg-emerald-400' }
  let msg = `Next service due ${restaurant?.next_due_at ? fmtDate(restaurant.next_due_at) : '—'}.`
  if (days != null) {
    if (days < 0) { band = { tone: 'bg-red-500/20 border-red-500/40 text-red-300', label: 'OVERDUE', dot: 'bg-red-400' }; msg = `Service was due ${fmtDate(restaurant.next_due_at)} (${Math.abs(Math.round(days))} days ago).` }
    else if (days < 14) { band = { tone: 'bg-amber-500/20 border-amber-500/40 text-amber-300', label: 'DUE SOON', dot: 'bg-amber-400' }; msg = `Next service due in ${Math.round(days)} days.` }
  }

  return (
    <div className={`rounded-xl border ${band.tone} p-5 flex items-center justify-between gap-4`}>
      <div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${band.dot} animate-pulse`}></span>
          <span className="text-sm font-bold uppercase tracking-wider">{band.label}</span>
        </div>
        <div className="text-sm text-white/80 mt-1">{msg}</div>
      </div>
      <div className="text-right text-xs text-white/60">
        <div>Last cleaned</div>
        <div className="text-white text-sm font-medium">{fmtDate(restaurant?.last_cleaned_at)}</div>
      </div>
    </div>
  )
}

export default function CscPortal() {
  const { token } = useParams()
  const [restaurants, setRestaurants] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [deficiencies, setDeficiencies] = useState([])
  const [nextScheduled, setNextScheduled] = useState(null)
  const [busyId, setBusyId] = useState(null)

  // Step 1: load the restaurant by token + sister locations under same chain
  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: anchor, error: aErr } = await cscSupabase
        .from('csc_restaurants')
        .select('*, chain:csc_chain_groups(id, name)')
        .eq('portal_token', token)
        .maybeSingle()
      if (aErr || !anchor) { setError('Portal link not recognized.'); setLoading(false); return }

      let siblings = [anchor]
      if (anchor.chain_group_id) {
        const { data: chainSibs } = await cscSupabase
          .from('csc_restaurants')
          .select('*, chain:csc_chain_groups(id, name)')
          .eq('chain_group_id', anchor.chain_group_id)
          .order('name')
        siblings = chainSibs && chainSibs.length ? chainSibs : [anchor]
      }
      setRestaurants(siblings)
      setActiveId(anchor.id)
      setLoading(false)
    })()
  }, [token])

  // Step 2: when active restaurant changes, load its history + open deficiencies + next scheduled
  useEffect(() => {
    if (!activeId) return
    (async () => {
      const [h, d, n] = await Promise.all([
        cscSupabase.from('csc_cleanings').select('*, certificate:csc_certificates(cert_number, pdf_url, public_verify_url, expires_at)').eq('restaurant_id', activeId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(8),
        cscSupabase.from('csc_deficiencies').select('*').eq('restaurant_id', activeId).in('quote_status', ['open', 'quoted']).order('created_at', { ascending: false }),
        cscSupabase.from('csc_cleanings').select('*').eq('restaurant_id', activeId).eq('status', 'scheduled').order('scheduled_at').limit(1).maybeSingle(),
      ])
      setHistory(h.data || [])
      setDeficiencies(d.data || [])
      setNextScheduled(n.data || null)
    })()
  }, [activeId])

  const active = useMemo(() => restaurants.find(r => r.id === activeId), [restaurants, activeId])

  async function approveQuote(d) {
    const name = window.prompt(`Approve $${Number(d.quote_amount).toFixed(2)} repair?\n\n${d.title}\n\nEnter your name to confirm:`)
    if (!name?.trim()) return
    setBusyId(d.id)
    try {
      const { error } = await cscSupabase.from('csc_deficiencies').update({
        quote_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by_name: name.trim(),
      }).eq('id', d.id)
      if (error) throw error
      setDeficiencies(prev => prev.map(x => x.id === d.id ? { ...x, quote_status: 'approved', approved_by_name: name.trim() } : x))
    } catch (e) { alert('Could not approve: ' + (e.message || e)) }
    finally { setBusyId(null) }
  }

  async function declineQuote(d) {
    const reason = window.prompt(`Decline this quote?\n\n${d.title}\n\nOptional reason:`) ?? null
    if (reason === null) return // cancel
    setBusyId(d.id)
    try {
      const { error } = await cscSupabase.from('csc_deficiencies').update({
        quote_status: 'declined',
        declined_at: new Date().toISOString(),
        declined_reason: reason || null,
      }).eq('id', d.id)
      if (error) throw error
      setDeficiencies(prev => prev.filter(x => x.id !== d.id))
    } catch (e) { alert('Could not decline: ' + (e.message || e)) }
    finally { setBusyId(null) }
  }

  async function confirmWindow() {
    if (!nextScheduled) return
    setBusyId(nextScheduled.id)
    try {
      const { error } = await cscSupabase.from('csc_cleanings').update({
        customer_window_confirmed: true,
        customer_window_confirmed_at: new Date().toISOString(),
      }).eq('id', nextScheduled.id)
      if (error) throw error
      setNextScheduled(prev => ({ ...prev, customer_window_confirmed: true, customer_window_confirmed_at: new Date().toISOString() }))
    } catch (e) { alert('Could not confirm: ' + (e.message || e)) }
    finally { setBusyId(null) }
  }

  if (loading) return <div className="text-white/40 text-center py-12">Loading your portal…</div>
  if (error) return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-8 text-center">
      <div className="text-2xl">⚠</div>
      <div className="text-lg font-semibold text-red-300 mt-2">{error}</div>
      <div className="text-sm text-white/60 mt-2">If you believe this link is valid, contact CSC Services at <a className="text-blue-300/80" href="mailto:info@cleanmyducts.com">info@cleanmyducts.com</a>.</div>
    </div>
  )
  if (!active) return null

  return (
    <div className="space-y-6">
      {/* Restaurant heading + multi-location switcher */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-orange-300/80 font-semibold">Compliance Portal</div>
          <h1 className="text-3xl font-heading text-white mt-1">{active.name}</h1>
          <div className="text-sm text-white/60 mt-1">{active.address_line1} · {active.city}, {active.state} {active.zip}</div>
        </div>
        {restaurants.length > 1 && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Switch location</div>
            <select value={activeId} onChange={e => setActiveId(e.target.value)}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <ComplianceHeader restaurant={active} />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Frequency</div>
          <div className="text-base text-white mt-1">{FREQUENCY_LABELS[active.frequency_tier] || '—'}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Hoods</div>
          <div className="text-base text-white mt-1">{active.hood_count}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Cleanings on file</div>
          <div className="text-base text-white mt-1">{history.length}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Open quotes</div>
          <div className="text-base text-amber-300 mt-1">{deficiencies.filter(d => d.quote_status === 'quoted').length}</div>
        </div>
      </div>

      {/* Next scheduled — confirm window CTA */}
      {nextScheduled && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-blue-300/80 font-semibold">Next Scheduled Cleaning</div>
              <div className="text-lg text-white mt-1">{fmtDateTime(nextScheduled.scheduled_at)}</div>
              <div className="text-xs text-white/50 mt-1">Tech: {nextScheduled.tech_name || 'TBA'}</div>
            </div>
            <div>
              {nextScheduled.customer_window_confirmed ? (
                <Pill tone="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">Window confirmed</Pill>
              ) : (
                <button onClick={confirmWindow} disabled={busyId === nextScheduled.id}
                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 rounded font-medium text-sm transition-colors disabled:opacity-50">
                  {busyId === nextScheduled.id ? 'Confirming…' : 'Confirm cleaning window'}
                </button>
              )}
            </div>
          </div>
          <div className="text-xs text-white/40 mt-2">Confirming the overnight access window saves a phone call from the office.</div>
        </div>
      )}

      {/* Open deficiencies — approve-quote workflow */}
      {deficiencies.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Items Requiring Your Attention</h3>
            <div className="text-xs text-white/40 mt-0.5">Approve a quote to schedule the repair on your next visit.</div>
          </div>
          <div className="divide-y divide-white/5">
            {deficiencies.map(d => (
              <div key={d.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Pill tone={SEVERITY_TONES[d.severity]}>{d.severity}</Pill>
                      {d.nfpa_code_ref && <span className="text-[11px] text-white/40">{d.nfpa_code_ref}</span>}
                    </div>
                    <div className="text-base text-white mt-1.5">{d.title}</div>
                    {d.description && <div className="text-sm text-white/60 mt-1">{d.description}</div>}
                    {d.quote_description && <div className="text-xs text-white/50 mt-2 pt-2 border-t border-white/5"><span className="text-white/40 uppercase tracking-wider text-[10px] font-semibold">Repair scope: </span>{d.quote_description}</div>}
                  </div>
                  <div className="text-right shrink-0 space-y-2 min-w-[140px]">
                    <div className="text-2xl font-heading text-white">{fmtMoney(d.quote_amount)}</div>
                    {d.quote_status === 'quoted' ? (
                      <div className="flex flex-col gap-1">
                        <button onClick={() => approveQuote(d)} disabled={busyId === d.id}
                                className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 rounded text-sm font-medium transition-colors disabled:opacity-50">
                          {busyId === d.id ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => declineQuote(d)} disabled={busyId === d.id}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded text-xs transition-colors disabled:opacity-50">
                          Decline
                        </button>
                      </div>
                    ) : (
                      <Pill tone={QUOTE_STATUS_TONES[d.quote_status]}>{d.quote_status}</Pill>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service history with cert downloads */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">Service History</h3>
          <div className="text-xs text-white/40 mt-0.5">Download any certificate for fire marshal or insurance records.</div>
        </div>
        {history.length === 0 ? (
          <div className="px-5 py-6 text-sm text-white/40">No completed cleanings on file yet.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {history.map(h => (
              <div key={h.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white">{fmtDate(h.completed_at)}</div>
                  <div className="text-xs text-white/40">Tech: {h.tech_name || '—'}{h.certificate?.cert_number ? ` · ${h.certificate.cert_number}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  {h.certificate?.pdf_url && (
                    <a href={h.certificate.pdf_url} target="_blank" rel="noopener noreferrer"
                       className="px-3 py-1.5 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-200 text-xs rounded transition-colors">
                      Download PDF
                    </a>
                  )}
                  {h.certificate?.public_verify_url && (
                    <a href={h.certificate.public_verify_url} target="_blank" rel="noopener noreferrer"
                       className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs rounded transition-colors">
                      Verify
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-white/5 bg-black/20 p-4 text-[11px] text-white/40">
        Questions? CSC Services Hood &amp; Duct · <a className="text-blue-300/70" href="mailto:info@cleanmyducts.com">info@cleanmyducts.com</a> · serving CT/MA/RI/NY
      </div>
    </div>
  )
}
