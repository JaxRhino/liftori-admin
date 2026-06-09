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
      const terms = (pls || []).filter(p => !p.lost_at).map(p => Number(p.term_months) || 0)
      setTerm(Math.max(0, ...terms))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const oneTime = lines.filter(l => !l.recurring).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0)
  const monthly = lines.filter(l => l.recurring).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0)
  const discount = Number(est?.discount_amount) || 0
  const oneTimeNet = oneTime - discount
  const effTerm = term > 0 ? term : (monthly > 0 ? 12 : 0)
  const tcv = oneTimeNet + monthly * effTerm
  const products = [...new Set(lines.map(l => l.product).filter(Boolean))]

  function updateLine(i, patch) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch, line_total: ((patch.qty ?? l.qty) || 0) * ((patch.unit_cost ?? l.unit_cost) || 0) } : l))
  }
  function removeLine(i) { setLines(prev => prev.filter((_, idx) => idx !== i)) }

  async function saveDoc() {
    setSaving(true)
    await supabase.from('customer_estimates').update({ line_items: lines, subtotal: oneTime, total: oneTimeNet, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
  }

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>
  if (!est) return <div className="p-6 text-gray-400">Estimate not found.</div>

  const sectionCls = 'bg-navy-900 rounded-xl p-8 border border-white/10'

  return (
    <div className="bg-navy-950 min-h-screen">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex justify-between items-center print:hidden">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-white">← Back</button>
          <div className="flex gap-2">
            <button onClick={saveDoc} disabled={saving} className="px-3 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg font-medium">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => window.print()} className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 text-gray-200 rounded-lg font-medium">Print / PDF</button>
          </div>
        </div>

        {/* COVER */}
        <section className="bg-navy-900 rounded-xl p-10 border border-white/10">
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
        <section className={sectionCls}>
          <h2 className="text-xl font-bold text-white mb-3">About Liftori</h2>
          <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{ABOUT_LIFTORI}</div>
        </section>

        {/* ABOUT PRODUCT(S) */}
        {products.filter(p => PRODUCT_ABOUT[p]).map(p => (
          <section key={p} className={sectionCls}>
            <h2 className="text-xl font-bold text-white mb-3">About {p}</h2>
            <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{PRODUCT_ABOUT[p]}</div>
          </section>
        ))}

        {/* LINE ITEMS */}
        <section className={sectionCls}>
          <h2 className="text-xl font-bold text-white mb-4">Estimate</h2>
          {products.map(p => (
            <div key={p} className="mb-5">
              <p className="text-sm font-semibold text-brand-blue mb-1">{p}</p>
              <table className="w-full text-sm">
                <tbody>
                  {lines.map((l, i) => l.product === p ? (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-1.5 text-gray-300">{l.label}{l.recurring && <span className="text-amber-400 text-[11px]"> /mo</span>}</td>
                      <td className="py-1.5 w-16"><input type="number" value={l.qty ?? 1} onChange={e => updateLine(i, { qty: Number(e.target.value) })} className="w-14 bg-navy-800 border border-navy-700/50 rounded px-1.5 py-0.5 text-white print:border-0" /></td>
                      <td className="py-1.5 w-28"><input type="number" value={l.unit_cost ?? 0} onChange={e => updateLine(i, { unit_cost: Number(e.target.value) })} className="w-24 bg-navy-800 border border-navy-700/50 rounded px-1.5 py-0.5 text-white print:border-0" /></td>
                      <td className="py-1.5 w-28 text-right text-white">{money((Number(l.qty) || 0) * (Number(l.unit_cost) || 0))}{l.recurring ? '/mo' : ''}</td>
                      <td className="py-1.5 w-8 text-right print:hidden"><button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-300 text-xs">✕</button></td>
                    </tr>
                  ) : null)}
                </tbody>
              </table>
            </div>
          ))}
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

        <p className="text-center text-[11px] text-gray-600 print:hidden">Terms &amp; conditions and e-signature coming in the next update.</p>
      </div>
    </div>
  )
}
