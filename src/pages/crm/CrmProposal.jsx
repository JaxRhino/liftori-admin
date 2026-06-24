import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// PUBLIC homeowner-facing proposal page (no auth). Resolves the tenant's
// Supabase routing via a SECURITY DEFINER RPC on the main DB, then reads the
// Good/Better/Best tier estimates (siblings sharing proposal_group_id) from the
// tenant DB and renders a multi-page customer proposal: cover, about, roof,
// manufacturer, photos, investment breakdown, warranties, terms, e-sign.
// Light, professional document theme driven by the tenant's brand accent.

const money = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
const TIER_LABEL = { good: 'Good', better: 'Better', best: 'Best' }
const tierPrice = (e) => (Number(e.total) > 0 ? Number(e.total) : Number(e.subtotal || 0))
const num = (v) => Number(v) || 0

const PITCH_LABEL = { flat: 'Flat', low: 'Low (3-4/12)', standard: 'Standard (5-7/12)', steep: 'Steep (8-9/12)', very_steep: 'Very steep (10-12/12)', extreme: 'Extreme (>12/12)' }

// Scale cost-based line items up to the customer price so the breakdown sums to the tier total.
function pricedSections(est) {
  if (!est) return { sections: [], total: 0 }
  const secs = Array.isArray(est.sections) ? est.sections.filter((s) => s.enabled !== false) : []
  const lineCost = (it) => num(it.qty) * num(it.unit_cost)
  const totalCost = secs.reduce((a, s) => a + (s.items || []).reduce((b, it) => b + lineCost(it), 0), 0)
  const price = tierPrice(est)
  const f = totalCost > 0 ? price / totalCost : 0
  const sections = secs
    .map((s) => {
      const items = (s.items || [])
        .filter((it) => it.description)
        .map((it) => ({ description: it.description, qty: it.qty, unit: it.unit, amount: lineCost(it) * f }))
      return { title: s.title, items, subtotal: items.reduce((a, it) => a + it.amount, 0) }
    })
    .filter((s) => s.items.length)
  return { sections, total: price }
}

export default function CrmProposal() {
  const { platformId, groupId } = useParams()
  const [client, setClient] = useState(null)
  const [tiers, setTiers] = useState([])
  const [org, setOrg] = useState(null)
  const [settings, setSettings] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [photos, setPhotos] = useState([])
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
      const [{ data: o }, { data: st }, contactRes] = await Promise.all([
        tc.from('org_settings').select('*').limit(1).maybeSingle(),
        tc.from('estimate_settings').select('*').limit(1).maybeSingle(),
        ests[0].contact_id ? tc.from('customer_contacts').select('*').eq('id', ests[0].contact_id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setOrg(o || null)
      setSettings(st || null)
      setCustomer(contactRes.data || null)
      if (contactRes.data) setSigner([contactRes.data.first_name, contactRes.data.last_name].filter(Boolean).join(' '))
      // Photos — pull the estimate's selected photos and sign them from the (private) bucket.
      const ids = (ests[0].photo_ids || []).filter(Boolean)
      if (ests[0].show_photos !== false && ids.length) {
        const { data: ph } = await tc.from('customer_photos').select('id, url, storage_path, caption').in('id', ids)
        const rows = ph || []
        const out = []
        for (const p of rows) {
          let url = p.url
          if (p.storage_path) {
            const { data: s } = await tc.storage.from('customer-photos').createSignedUrl(p.storage_path, 3600)
            if (s && s.signedUrl) url = s.signedUrl
          }
          if (url) out.push({ url, caption: p.caption })
        }
        setPhotos(out)
      }
    } catch (e) { console.error(e); setError(e.message || 'Unable to load proposal') }
    finally { setLoading(false) }
  }

  const signed = useMemo(() => tiers.find((e) => e.esign_status === 'signed'), [tiers])
  const accent = (org && org.accent_color) || '#0EA5E9'
  const ink = '#0b1220'
  const companyName = (org && org.company_name) || 'Your Contractor'
  const selectedEst = useMemo(() => tiers.find((e) => e.id === selected) || tiers[0], [tiers, selected])
  const breakdown = useMemo(() => pricedSections(selectedEst), [selectedEst])
  const meas = (selectedEst && selectedEst.measurements && typeof selectedEst.measurements === 'object') ? selectedEst.measurements : {}
  const adjSquares = useMemo(() => {
    const sq = Math.max(0, num(meas.squares)); const w = Math.max(0, num(meas.waste_pct))
    return sq * (1 + w / 100)
  }, [meas])

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
  const custAddr = customer ? [customer.address, customer.city, customer.state].filter(Boolean).join(', ') : ''
  const intro = (tiers[0] && tiers[0].intro) || (settings && settings.about_content) || ''
  const terms = (tiers[0] && tiers[0].terms) || (settings && settings.terms_content) || ''
  const mfg = (settings && settings.manufacturer && typeof settings.manufacturer === 'object') ? settings.manufacturer : null
  const issued = tiers[0] && tiers[0].created_at ? new Date(tiers[0].created_at).toLocaleDateString() : ''
  const validUntil = tiers[0] && tiers[0].valid_until ? new Date(tiers[0].valid_until).toLocaleDateString() : ''
  const hasRoof = num(meas.squares) > 0

  const Tag = ({ children }) => (
    <div className="flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
      <span className="h-0.5 w-5 rounded" style={{ background: accent }} />{children}
    </div>
  )
  const Sheet = ({ children }) => <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 md:p-10 mb-6">{children}</div>

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">

        {/* COVER */}
        <div className="rounded-2xl overflow-hidden mb-6 shadow-lg" style={{ background: `linear-gradient(135deg, ${ink} 0%, #1e293b 55%, ${accent} 220%)` }}>
          <div className="p-8 md:p-12 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {org && org.logo_url ? <img src={org.logo_url} alt="" className="w-11 h-11 rounded-lg object-contain bg-white/10" /> : <div className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-lg" style={{ background: accent }}>{companyName.charAt(0)}</div>}
                <div className="font-bold text-xl tracking-wide">{companyName}</div>
              </div>
              {org && (org.license_number || org.company_phone) && (
                <div className="text-right text-[11px] text-slate-300 leading-relaxed">
                  {org.license_number ? <div>License #{org.license_number}</div> : null}
                  <div>Licensed &amp; Insured</div>
                </div>
              )}
            </div>
            <div className="py-10 md:py-16">
              <div className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: org && org.accent_color ? '#7DD3FC' : '#7DD3FC' }}>{tiers[0] ? tiers[0].title : 'Project Proposal'}</div>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight max-w-[14ch]">Your project, done right.</h1>
              {intro ? <p className="mt-4 text-slate-200 max-w-md text-[15px]">{intro.split('\n')[0]}</p> : null}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 border-t border-white/15 pt-5 text-sm">
              <div><div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Prepared for</div><div className="font-medium">{custName || '—'}</div>{custAddr ? <div className="text-xs text-slate-300">{custAddr}</div> : null}</div>
              <div><div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Contact</div><div className="font-medium">{(org && org.company_phone) || ''}</div>{org && org.company_email ? <div className="text-xs text-slate-300">{org.company_email}</div> : null}</div>
              <div><div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Issued</div><div className="font-medium">{issued || '—'}</div>{validUntil ? <div className="text-xs text-slate-300">Valid until {validUntil}</div> : null}</div>
            </div>
          </div>
        </div>

        {signed && (
          <div className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-5">
            <div className="font-semibold text-emerald-800">Proposal accepted</div>
            <div className="text-sm text-emerald-700 mt-1">Signed by {signed.signer_name} on {signed.esign_signed_at ? new Date(signed.esign_signed_at).toLocaleString() : ''} — {TIER_LABEL[signed.selected_tier || signed.tier] || signed.tier} option ({money(tierPrice(signed))}). Thank you!</div>
          </div>
        )}

        {/* ABOUT */}
        {intro ? (
          <Sheet>
            <Tag>About {companyName}</Tag>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4">A contractor who stands behind the work.</h2>
            <div className="space-y-3 text-[15px] text-slate-600 whitespace-pre-line">{intro}</div>
          </Sheet>
        ) : null}

        {/* YOUR ROOF */}
        {hasRoof ? (
          <Sheet>
            <Tag>Your Roof</Tag>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Measured, not guessed.</h2>
            <p className="text-slate-500 text-sm mb-5">Pricing is based on your roof's measured dimensions.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
              {[['Squares', adjSquares ? adjSquares.toFixed(1) : num(meas.squares).toFixed(1)], ['Pitch', PITCH_LABEL[meas.pitch] || (meas.pitch || '—')], ['Waste', meas.waste_pct ? meas.waste_pct + '%' : '—'], ['Tear-off layers', meas.layers || '—']].map((t, i) => (
                <div key={i} className="bg-white p-4"><div className="font-extrabold text-2xl text-slate-900">{t[1]}</div><div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">{t[0]}</div></div>
              ))}
            </div>
          </Sheet>
        ) : null}

        {/* MANUFACTURER */}
        {mfg && (mfg.name || mfg.blurb) ? (
          <Sheet>
            <Tag>Our Manufacturer</Tag>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4">{mfg.name ? `Why we build with ${mfg.name}.` : 'Our materials.'}</h2>
            <div className="flex items-center gap-4 mb-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="w-16 h-12 rounded-lg flex items-center justify-center font-extrabold text-lg text-white" style={{ background: ink }}>{(mfg.name || '?').slice(0, 4)}</div>
              <div><div className="font-bold text-slate-900">{mfg.name}</div>{mfg.tagline ? <div className="text-sm text-slate-500">{mfg.tagline}</div> : null}</div>
            </div>
            {mfg.blurb ? <p className="text-[15px] text-slate-600 mb-4">{mfg.blurb}</p> : null}
            {Array.isArray(mfg.why) && mfg.why.length ? (
              <ul className="space-y-2.5">
                {mfg.why.map((w, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-slate-600"><span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: accent + '22', color: accent }}>✓</span><span>{w}</span></li>
                ))}
              </ul>
            ) : null}
          </Sheet>
        ) : null}

        {/* PHOTOS */}
        {photos.length ? (
          <Sheet>
            <Tag>Job Photos</Tag>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-5">What we documented on your property.</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((p, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  {p.caption ? <div className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 text-[11px] font-medium text-white bg-gradient-to-t from-black/70 to-transparent">{p.caption}</div> : null}
                </div>
              ))}
            </div>
          </Sheet>
        ) : null}

        {/* INVESTMENT */}
        <Sheet>
          <Tag>Your Investment</Tag>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <h2 className="text-2xl font-extrabold text-slate-900">{selectedEst ? (TIER_LABEL[selectedEst.tier] || 'Your package') : 'Your package'}</h2>
            {tiers.length > 1 ? (
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {tiers.map((e) => {
                  const on = selected === e.id
                  return <button key={e.id} onClick={() => !signed && setSelected(e.id)} disabled={!!signed} className={'px-3.5 py-1.5 rounded-lg text-sm font-bold transition ' + (on ? 'text-white shadow-sm' : 'text-slate-500')} style={on ? { background: accent } : {}}>{TIER_LABEL[e.tier] || e.tier}</button>
                })}
              </div>
            ) : null}
          </div>
          {breakdown.sections.length ? (
            <div className="space-y-3">
              {breakdown.sections.map((s, i) => (
                <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="font-bold text-slate-800 text-[15px]">{s.title}</div>
                    <div className="font-bold text-slate-800">{money(s.subtotal)}</div>
                  </div>
                  {s.items.map((it, j) => (
                    <div key={j} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 text-sm">
                      <div className="text-slate-700">{it.description}{it.qty && it.unit ? <span className="text-slate-400"> · {it.qty} {it.unit}</span> : null}</div>
                      <div className="text-slate-600 font-medium tabular-nums">{it.amount ? money(it.amount) : 'Included'}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : <p className="text-slate-400 text-sm">Line-item detail will appear here.</p>}
          <div className="mt-5 ml-auto w-full md:w-72">
            {selectedEst && num(selectedEst.discount_amount) > 0 ? (
              <div className="flex justify-between py-1.5 text-sm text-emerald-600 font-medium"><span>Discount</span><span>−{money(selectedEst.discount_amount)}</span></div>
            ) : null}
            <div className="flex justify-between pt-3 mt-1 border-t-2 text-xl font-extrabold text-slate-900" style={{ borderColor: ink }}><span>Total</span><span>{money(breakdown.total)}</span></div>
          </div>
        </Sheet>

        {/* WARRANTIES */}
        {settings && settings.warranty_content ? (
          <Sheet>
            <Tag>Warranties</Tag>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-4">Protected for the long haul.</h2>
            <div className="text-[15px] text-slate-600 whitespace-pre-line">{settings.warranty_content}</div>
          </Sheet>
        ) : null}

        {/* PACKAGE SELECT + SIGN */}
        <Sheet>
          <Tag>Choose &amp; Approve</Tag>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-5">Choose your package.</h2>
          <div className={'grid gap-3 mb-6 ' + (tiers.length >= 3 ? 'md:grid-cols-3' : tiers.length === 2 ? 'md:grid-cols-2' : 'grid-cols-1')}>
            {tiers.map((e) => {
              const isSel = selected === e.id
              return (
                <button key={e.id} onClick={() => !signed && setSelected(e.id)} disabled={!!signed} className={'text-left rounded-2xl border-2 bg-white p-5 transition ' + (isSel ? 'shadow-md' : 'border-slate-200 hover:border-slate-300')} style={isSel ? { borderColor: accent, boxShadow: `0 0 0 3px ${accent}22` } : {}}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{TIER_LABEL[e.tier] || e.tier || 'Option'}</div>
                    {e.tier_recommended ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: ink }}>RECOMMENDED</span> : null}
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900 mb-2">{money(tierPrice(e))}</div>
                  <div className={'mt-3 text-center text-sm font-bold rounded-lg py-2 ' + (isSel ? 'text-white' : 'text-slate-500 bg-slate-100')} style={isSel ? { background: accent } : {}}>{isSel ? 'Selected' : 'Select'}</div>
                </button>
              )
            })}
          </div>

          {!signed ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="font-bold text-slate-900 mb-1">Accept &amp; sign</div>
              <p className="text-sm text-slate-500 mb-4">By typing your name and accepting, you authorize {companyName} to proceed with the selected option.</p>
              <label className="block text-xs text-slate-500 mb-1">Full legal name</label>
              <input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="Your full name" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 mb-4 bg-white focus:outline-none focus:ring-2" style={{ '--tw-ring-color': accent }} />
              <button onClick={accept} disabled={submitting || !signer.trim() || !selected} className="w-full text-white font-bold rounded-lg py-3.5 disabled:opacity-50" style={{ background: accent }}>{submitting ? 'Recording…' : `Accept & Sign — ${money(tierPrice(selectedEst || {}))}`}</button>
            </div>
          ) : null}
        </Sheet>

        {/* TERMS */}
        {terms ? (
          <Sheet>
            <Tag>Terms &amp; Conditions</Tag>
            <div className="text-[13px] text-slate-500 whitespace-pre-line leading-relaxed">{terms}</div>
          </Sheet>
        ) : null}

        <div className="mt-4 text-center text-xs text-slate-400">Powered by Liftori</div>
      </div>
    </div>
  )
}
