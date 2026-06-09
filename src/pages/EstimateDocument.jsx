// ============================================================
// EstimateDocument.jsx — /admin/estimate/:id
// Modern multi-section proposal/estimate document for a Liftori customer_estimate.
// Sections: Cover · About Liftori · About Product · Line items + totals/term.
// (Terms & e-sign land in Wave 2.)
// ============================================================
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ABOUT_LIFTORI = `Liftori turns business ideas into live, working platforms — without requiring you to be technical. We pair an AI-driven build pipeline with hands-on managed services to design, build, and launch the software your business runs on, then keep improving it.

Founded in 2026 in Jacksonville, Florida, Liftori builds CRMs, websites and e-commerce, and fully custom platforms — and runs EOS-based business consulting to help owners get real traction. One partner, from idea to launch to growth.`

const PRODUCT_ABOUT = {
  CRM: `A CRM built around how you actually sell. We map your pipeline, automate the busywork, and give you a clear view of every deal, customer, and dollar — then manage it so it stays useful.`,
  Website: `A fast, modern website or storefront designed to convert. We handle design, build, integrations, content, and launch — then host and maintain it so it keeps performing.`,
  'Custom Build': `Software shaped to your exact workflow. We scope the problem, architect a solution, build it in focused sprints, and support it with an SLA — no off-the-shelf compromises.`,
  Consulting: `EOS-based business consulting that installs real operating discipline — a clear vision, the right people in the right seats, a weekly scorecard, quarterly Rocks, and a Level 10 meeting rhythm — so your business runs on a system, not on you.`,
}

const TERMS = `1. Scope — This estimate covers the line items listed above. Work outside this scope will be quoted separately.
2. Payment — Project (one-time) fees are billed 50% at design approval, 40% at staging delivery, and 10% at launch. Recurring / managed-service fees are billed monthly in advance and begin at launch.
3. Validity — This estimate is valid until the date shown on the cover. Pricing may change thereafter.
4. Term — Recurring services run for the term shown and renew automatically unless cancelled with 30 days' written notice.
5. Ownership — Upon full payment, you own the delivered work product. Liftori retains its pre-existing tools, libraries, and frameworks.
6. Changes — Either party may request changes in writing. Material changes may affect price and timeline.
7. Confidentiality — Both parties will keep each other's non-public information confidential.
8. Acceptance — Signing below authorizes Liftori to begin work and constitutes agreement to these terms.`

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()

export default function EstimateDocument() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [est, setEst] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [lines, setLines] = useState([])
  const [term, setTerm] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signer, setSigner] = useState('')
  const [signing, setSigning] = useState(false)
  const [custView, setCustView] = useState(false)

  const SECTIONS = [
    { id: 'cover', label: 'Cover' },
    { id: 'about-liftori', label: 'About Liftori' },
    { id: 'about-product', label: 'About the Product' },
    { id: 'estimate', label: 'Estimate' },
    { id: 'terms', label: 'Terms' },
    { id: 'signature', label: 'Signature' },
  ]
  const jump = (sid) => document.getElementById(sid)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  async function load() {
    setLoading(true)
    const { data: e } = await supabase.from('customer_estimates').select('*').eq('id', id).single()
    setEst(e)
    setLines(Array.isArray(e?.line_items) ? e.line_items : [])
    if (e?.contact_id) {
      const [{ data: c }, { data: pls }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', e.contact_id).single(),
        supabase.from('customer_product_lines').select('term_months, lost_at').eq('profile_id', e.contact_id),
      ])
      setCustomer(c)
      setSigner(prev => prev || c?.full_name || '')
      const terms = (pls || []).filter(p => !p.lost_at).map(p => Number(p.term_months) || 0)
      setTerm(Math.max(0, ...terms))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const oneTime = lines.filter(l => l.included !== false && !l.recurring).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0)
  const monthly = lines.filter(l => l.included !== false && l.recurring).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0)
  const discount = Number(est?.discount_amount) || 0
  const oneTimeNet = oneTime - discount
  const effTerm = term > 0 ? term : (monthly > 0 ? 12 : 0)
  const tcv = oneTimeNet + monthly * effTerm
  const products = [...new Set(lines.map(l => l.product).filter(Boolean))]

  function updateLine(i, patch) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch, line_total: ((patch.qty ?? l.qty) || 0) * ((patch.unit_cost ?? l.unit_cost) || 0) } : l))
  }
  function removeLine(i) { setLines(prev => prev.filter((_, idx) => idx !== i)) }
  function setTier(p, tier) { setLines(prev => prev.map(l => (l.product === p && l.tier) ? { ...l, included: l.tier === tier } : l)) }

  async function saveDoc() {
    setSaving(true)
    await supabase.from('customer_estimates').update({ line_items: lines, subtotal: oneTime, total: oneTimeNet, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
  }

  async function signEstimate() {
    if (!signer.trim()) { alert('Type your name to sign'); return }
    setSigning(true)
    await supabase.from('customer_estimates').update({
      esign_status: 'signed', esign_signed_at: new Date().toISOString(), signer_name: signer.trim(),
      status: 'accepted', updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSigning(false)
    load()
  }

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>
  if (!est) return <div className="p-6 text-gray-400">Estimate not found.</div>

  const sectionCls = 'bg-navy-900 rounded-xl p-8 border border-white/10'

  return (
    <div className="bg-navy-950 min-h-screen">
      <div className="max-w-5xl mx-auto p-4 flex gap-4">
        <nav className="hidden md:block w-40 flex-shrink-0 sticky top-4 self-start space-y-1 print:hidden">
          {SECTIONS.map(s => <button key={s.id} onClick={() => jump(s.id)} className="block w-full text-left text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-navy-800/60">{s.label}</button>)}
        </nav>
        <div className="flex-1 min-w-0 space-y-4">
        <div className="flex justify-between items-center print:hidden">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-white">← Back</button>
          <div className="flex gap-2">
            <button onClick={() => setCustView(v => !v)} className={`px-3 py-1.5 text-xs rounded-lg font-medium ${custView ? 'bg-emerald-500/90 text-white' : 'bg-navy-700 text-gray-200 hover:bg-navy-600'}`}>{custView ? 'Customer view ✓' : 'Customer view'}</button>
            <button onClick={saveDoc} disabled={saving} className="px-3 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg font-medium">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => window.print()} className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 text-gray-200 rounded-lg font-medium">Print / PDF</button>
          </div>
        </div>

        {/* COVER */}
        <section id="cover" className="bg-navy-900 rounded-xl p-10 border border-white/10">
          <div className="text-4xl font-black tracking-tight"><span className="text-white">LIFT</span><span className="text-brand-blue">ORI</span></div>
          <p className="text-gray-500 mt-1 text-sm">Lift Your Idea</p>
          <div className="mt-14">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Proposal &amp; Estimate</p>
            <h1 className="text-3xl font-bold text-white mt-2">{est.title || 'Estimate'}</h1>
            <p className="text-gray-400 mt-1 font-mono text-sm">{est.estimate_number}</p>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-1">Prepared for</p>
              <p className="text-white font-semibold">{customer?.company_name || customer?.full_name || '—'}</p>
              {customer?.full_name && customer?.company_name && <p className="text-gray-400">{customer.full_name}</p>}
              {customer?.email && <p className="text-gray-400">{customer.email}</p>}
              {customer?.phone && <p className="text-gray-400">{customer.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-1">Date</p>
              <p className="text-white">{new Date(est.created_at).toLocaleDateString()}</p>
              {est.valid_until && <><p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-1 mt-3">Valid until</p><p className="text-white">{new Date(est.valid_until).toLocaleDateString()}</p></>}
            </div>
          </div>
        </section>

        {/* ABOUT LIFTORI */}
        <section id="about-liftori" className={sectionCls}>
          <h2 className="text-xl font-bold text-white mb-3">About Liftori</h2>
          <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{ABOUT_LIFTORI}</div>
        </section>

        {/* ABOUT PRODUCT(S) */}
        <div id="about-product" className="space-y-4">
        {products.filter(p => PRODUCT_ABOUT[p]).map(p => (
          <section key={p} className={sectionCls}>
            <h2 className="text-xl font-bold text-white mb-3">About {p}</h2>
            <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{PRODUCT_ABOUT[p]}</div>
          </section>
        ))}
        </div>

        {/* LINE ITEMS */}
        <section id="estimate" className={sectionCls}>
          <h2 className="text-xl font-bold text-white mb-4">Estimate</h2>
          {products.map(p => {
            const tiers = [...new Set(lines.filter(l => l.product === p && l.tier).map(l => l.tier))]
            const selTier = (lines.find(l => l.product === p && l.tier && l.included !== false) || {}).tier || tiers[0]
            return (
            <div key={p} className="mb-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <p className="text-sm font-semibold text-brand-blue">{p}</p>
                {tiers.length > 0 && (
                  <div className="flex gap-1 print:hidden">
                    {tiers.map(t => (
                      <button key={t} onClick={() => setTier(p, t)} className={`px-2.5 py-1 text-xs rounded-lg font-medium ${selTier === t ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400 hover:text-white'}`}>{t}</button>
                    ))}
                  </div>
                )}
              </div>
              {tiers.length > 0 && custView && <p className="text-xs text-gray-500 mb-1">{selTier} plan</p>}
              <table className="w-full text-sm">
                <tbody>
                  {lines.map((l, i) => (l.product === p && (!l.tier || l.tier === selTier) && (!custView || l.included !== false)) ? (
                    <tr key={i} className={`border-b border-white/5 ${l.included === false ? 'opacity-40' : ''}`}>
                      {!custView && <td className="py-1.5 w-8"><input type="checkbox" checked={l.included !== false} onChange={e => updateLine(i, { included: e.target.checked })} /></td>}
                      <td className="py-1.5 text-gray-300">{l.label}{l.recurring && <span className="text-amber-400 text-[11px]"> /mo</span>}</td>
                      {custView ? (
                        <td className="py-1.5 text-right text-gray-400 pr-4">{(Number(l.qty) || 0) > 1 ? (l.qty + ' × ') : ''}{money(Number(l.unit_cost) || 0)}</td>
                      ) : (
                        <>
                          <td className="py-1.5 w-16"><input type="number" value={l.qty ?? 1} onChange={e => updateLine(i, { qty: Number(e.target.value) })} className="w-14 bg-navy-800 border border-navy-700/50 rounded px-1.5 py-0.5 text-white print:border-0" /></td>
                          <td className="py-1.5 w-28"><input type="number" value={l.unit_cost ?? 0} onChange={e => updateLine(i, { unit_cost: Number(e.target.value) })} className="w-24 bg-navy-800 border border-navy-700/50 rounded px-1.5 py-0.5 text-white print:border-0" /></td>
                        </>
                      )}
                      <td className="py-1.5 w-28 text-right text-white">{money((Number(l.qty) || 0) * (Number(l.unit_cost) || 0))}{l.recurring ? '/mo' : ''}</td>
                      {!custView && <td className="py-1.5 w-8 text-right print:hidden"><button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-300 text-xs">✕</button></td>}
                    </tr>
                  ) : null)}
                </tbody>
              </table>
            </div>
            )
          })}
          {lines.length === 0 && <p className="text-sm text-gray-500">No line items. Generate this estimate from product lines, or add lines.</p>}

          <div className="border-t border-white/10 pt-4 mt-4 text-right space-y-1">
            <p className="text-gray-400 text-sm">One-time build: <span className="text-white font-semibold">{money(oneTime)}</span></p>
            {discount > 0 && <p className="text-gray-400 text-sm">Bundle discount: <span className="text-red-400">-{money(discount)}</span></p>}
            {monthly > 0 && <p className="text-gray-400 text-sm">Recurring: <span className="text-amber-400 font-semibold">{money(monthly)}/mo</span>{effTerm > 0 ? <span className="text-gray-500"> × {effTerm} mo</span> : null}</p>}
            <p className="text-lg text-white font-bold mt-2">
              Total agreement: {money(tcv)}{effTerm > 0 ? <span className="text-gray-400 text-sm font-normal"> over {effTerm} months</span> : null}
            </p>
            {monthly > 0 && <p className="text-[11px] text-gray-500">{money(oneTimeNet)} one-time + {money(monthly)}/mo</p>}
          </div>
        </section>

        {/* TERMS */}
        <section id="terms" className={sectionCls}>
          <h2 className="text-xl font-bold text-white mb-3">Terms &amp; Conditions</h2>
          <div className="text-xs text-gray-400 whitespace-pre-line leading-relaxed">{TERMS}</div>
        </section>

        {/* SIGNATURE / E-SIGN */}
        <section id="signature" className={sectionCls}>
          <h2 className="text-xl font-bold text-white mb-4">Acceptance &amp; Signature</h2>
          {est.esign_status === 'signed' ? (
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-semibold">✓ Signed</span>
              <span className="text-2xl text-brand-blue" style={{ fontFamily: 'cursive' }}>{est.signer_name}</span>
              <span className="text-gray-500">on {est.esign_signed_at ? new Date(est.esign_signed_at).toLocaleString() : ''}</span>
            </div>
          ) : (
            <div className="space-y-3 max-w-md">
              <p className="text-xs text-gray-500">By signing, you accept this proposal and its terms and authorize Liftori to begin work.</p>
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-gray-500 block mb-1">Type your full name to sign</label>
                <input value={signer} onChange={e => setSigner(e.target.value)} className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-white" />
              </div>
              {signer.trim() && <p className="text-2xl text-brand-blue px-1" style={{ fontFamily: 'cursive' }}>{signer}</p>}
              <button onClick={signEstimate} disabled={signing || !signer.trim()} className="px-4 py-2 text-sm bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-semibold print:hidden">{signing ? 'Signing…' : 'Agree & Sign'}</button>
            </div>
          )}
        </section>
        </div>
      </div>
    </div>
  )
}
