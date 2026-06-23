import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// PUBLIC homeowner-facing proposal page (no auth). Resolves the tenant's
// Supabase routing via a SECURITY DEFINER RPC on the main DB, then reads the
// Good/Better/Best tier estimates (siblings sharing proposal_group_id) from the
// tenant DB and lets the homeowner pick a tier and e-sign. Light, professional
// theme — this is a customer document, not the dark admin dashboard.

const money = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
const TIER_LABEL = { good: 'Good', better: 'Better', best: 'Best' }
const tierPrice = (e) => Number(e.total) > 0 ? Number(e.total) : Number(e.subtotal || 0)
const scopeOf = (e) => {
  const secs = Array.isArray(e.sections) ? e.sections.filter((s) => s.enabled !== false) : []
  return secs.map((s) => ({ title: s.title, items: (s.items || []).map((it) => it.description).filter(Boolean) })).filter((s) => s.items.length)
}

export default function CrmProposal() {
  const { platformId, groupId } = useParams()
  const [client, setClient] = useState(null)
  const [tiers, setTiers] = useState([])
  const [org, setOrg] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [signer, setSigner] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { boot(); /* eslint-disable-next-line */ }, [platformId, groupId])

  async function boot() {
    try {
      setLoading(true)
      const { data: routes, error: rErr } = await supabase.rpc('get_crm_proposal_routing', { p_platform_id: platformId })
      if (rErr) throw rErr
      const route = Array.isArray(routes) ? routes[0] : routes
      if (!route || !route.supabase_url) throw new Error('Proposal not found')
      const tc = createClient(route.supabase_url, route.supabase_publishable_key, { auth: { persistSession: false } })
      setClient(tc)
      const { data: ests, error: eErr } = await tc.from('customer_estimates').select('*').eq('proposal_group_id', groupId).order('tier_order', { ascending: true })
      if (eErr) throw eErr
      if (!ests || !ests.length) throw new Error('Proposal not found')
      setTiers(ests)
      const rec = ests.find((e) => e.tier_recommended) || ests[ests.length - 1]
      setSelected(rec ? rec.id : ests[0].id)
      const [{ data: o }, contactRes] = await Promise.all([
        tc.from('org_settings').select('*').limit(1).maybeSingle(),
        ests[0].contact_id ? tc.from('customer_contacts').select('first_name, last_name, email').eq('id', ests[0].contact_id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setOrg(o || null)
      setCustomer(contactRes.data || null)
      if (contactRes.data) setSigner([contactRes.data.first_name, contactRes.data.last_name].filter(Boolean).join(' '))
    } catch (e) { console.error(e); setError(e.message || 'Unable to load proposal') }
    finally { setLoading(false) }
  }

  const signed = useMemo(() => tiers.find((e) => e.esign_status === 'signed'), [tiers])
  const accent = (org && org.accent_color) || '#2563eb'
  const companyName = (org && org.company_name) || 'Your Contractor'

  async function accept() {
    if (!client || !selected || !signer.trim()) return
    try {
      setSubmitting(true)
      const chosen = tiers.find((e) => e.id === selected)
      const now = new Date().toISOString()
      const { error: uErr } = await client.from('customer_estimates').update({
        esign_status: 'signed', esign_signed_at: now, signer_name: signer.trim(),
        signature_url: 'typed:' + signer.trim(), status: 'accepted', selected_tier: chosen.tier,
      }).eq('id', selected)
      if (uErr) throw uErr
      const others = tiers.filter((e) => e.id !== selected).map((e) => e.id)
      if (others.length) await client.from('customer_estimates').update({ status: 'declined' }).in('id', others)
      const { data: ests } = await client.from('customer_estimates').select('*').eq('proposal_group_id', groupId).order('tier_order', { ascending: true })
      setTiers(ests || [])
    } catch (e) { console.error(e); setError('Could not record your signature. Please try again.') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /></div>
  if (error) return <div className="min-h-screen bg-slate-100 flex items-center justify-center px-6"><div className="text-center"><div className="text-slate-800 text-xl font-semibold mb-2">Proposal unavailable</div><div className="text-slate-500">{error}</div></div></div>

  const custName = customer ? [customer.first_name, customer.last_name].filter(Boolean).join(' ') : ''
  const intro = tiers[0] && tiers[0].intro
  const terms = tiers[0] && tiers[0].terms

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="max-w-5xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {org && org.logo_url ? <img src={org.logo_url} alt="" className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200" /> : <div className="w-12 h-12 rounded-lg text-white font-bold text-lg flex items-center justify-center" style={{ background: accent }}>{companyName.charAt(0)}</div>}
            <div>
              <div className="font-semibold text-lg text-slate-900">{companyName}</div>
              <div className="text-xs text-slate-500">{[org && org.company_city, org && org.company_state].filter(Boolean).join(', ')}</div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-slate-400">Prepared for</div>
            <div className="font-medium text-slate-900">{custName || '—'}</div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">{tiers[0] ? tiers[0].title : 'Your Proposal'}</h1>
        {intro ? <p className="text-slate-600 mb-8 max-w-2xl">{intro}</p> : <div className="mb-8" />}

        {signed && (
          <div className="mb-8 rounded-xl border border-emerald-300 bg-emerald-50 p-5">
            <div className="font-semibold text-emerald-800">Proposal accepted</div>
            <div className="text-sm text-emerald-700 mt-1">Signed by {signed.signer_name} on {signed.esign_signed_at ? new Date(signed.esign_signed_at).toLocaleString() : ''} — {TIER_LABEL[signed.selected_tier || signed.tier] || signed.tier} option ({money(tierPrice(signed))}). Thank you!</div>
          </div>
        )}

        {/* Tiers */}
        <div className={'grid gap-4 mb-10 ' + (tiers.length >= 3 ? 'md:grid-cols-3' : tiers.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
          {tiers.map((e) => {
            const isSel = selected === e.id
            const rec = e.tier_recommended
            return (
              <button key={e.id} onClick={() => !signed && setSelected(e.id)} disabled={!!signed}
                className={'text-left rounded-2xl border-2 bg-white p-5 transition shadow-sm ' + (isSel ? 'shadow-md' : 'border-slate-200 hover:border-slate-300')}
                style={isSel ? { borderColor: accent } : {}}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">{TIER_LABEL[e.tier] || e.tier || 'Option'}</div>
                  {rec && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: accent }}>RECOMMENDED</span>}
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-3">{money(tierPrice(e))}</div>
                <div className="space-y-3">
                  {scopeOf(e).map((s, i) => (
                    <div key={i}>
                      <div className="text-xs font-semibold text-slate-700 mb-1">{s.title}</div>
                      <ul className="space-y-1">
                        {s.items.map((it, j) => (
                          <li key={j} className="text-sm text-slate-600 flex gap-2"><span style={{ color: accent }}>✓</span><span>{it}</span></li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {!signed && (
                  <div className={'mt-4 text-center text-sm font-medium rounded-lg py-2 ' + (isSel ? 'text-white' : 'text-slate-500 bg-slate-100')} style={isSel ? { background: accent } : {}}>
                    {isSel ? 'Selected' : 'Select this option'}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Sign */}
        {!signed && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 max-w-2xl">
            <div className="font-semibold text-slate-900 mb-1">Accept &amp; sign</div>
            <p className="text-sm text-slate-500 mb-4">By typing your name and accepting, you authorize {companyName} to proceed with the selected option.</p>
            <label className="block text-xs text-slate-500 mb-1">Full legal name</label>
            <input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="Your full name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 mb-4 focus:outline-none focus:ring-2" style={{ '--tw-ring-color': accent }} />
            <button onClick={accept} disabled={submitting || !signer.trim() || !selected}
              className="w-full text-white font-semibold rounded-lg py-3 disabled:opacity-50" style={{ background: accent }}>
              {submitting ? 'Recording…' : `Accept & Sign — ${money(tierPrice(tiers.find((e) => e.id === selected) || {}))}`}
            </button>
          </div>
        )}

        {terms && <div className="mt-8 text-xs text-slate-500 max-w-2xl whitespace-pre-wrap"><div className="font-semibold text-slate-600 mb-1">Terms</div>{terms}</div>}
        <div className="mt-10 text-center text-xs text-slate-400">Powered by Liftori</div>
      </div>
    </div>
  )
}
