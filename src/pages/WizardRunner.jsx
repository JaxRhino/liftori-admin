import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { computeEstimate, formatUSD } from '../lib/estimateEngine'

// Runtime wizard renderer: runs a single flow from wizard_steps, collects answers,
// and auto-populates the Estimate card from the customer's selections.
const THEME_COLORS = {
  midnight: ['#0B1220', '#1E3A5F', '#3B82F6'], ocean: ['#0C4A6E', '#0EA5E9', '#7DD3FC'],
  forest: ['#14532D', '#16A34A', '#86EFAC'], sunset: ['#7C2D12', '#F97316', '#FDBA74'],
  berry: ['#581C87', '#A855F7', '#D8B4FE'], rose: ['#881337', '#F43F5E', '#FDA4AF'],
  slate: ['#0F172A', '#475569', '#94A3B8'], gold: ['#1C1917', '#D4A017', '#FCD34D'],
  mint: ['#064E3B', '#10B981', '#6EE7B7'], coral: ['#7F1D1D', '#FB7185', '#FECDD3'],
  mono: ['#111827', '#374151', '#9CA3AF'], sky: ['#0369A1', '#38BDF8', '#BAE6FD'],
}
const enabledOpts = (opts) => (opts || []).map(o => typeof o === 'string' ? { label: o, enabled: true } : o).filter(o => o.enabled !== false)
const input = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue'
const chip = (on) => `text-left p-3 rounded-lg border text-sm transition-colors ${on ? 'border-brand-blue bg-brand-blue/10 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'}`

export default function WizardRunner() {
  const { flow } = useParams()
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [pricing, setPricing] = useState([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const submitRef = useRef(false)
  const isTest = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('test')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [c, p] = await Promise.all([
        supabase.from('wizard_steps').select('*').eq('flow_type', flow).order('step_number', { ascending: true }),
        supabase.from('estimate_pricing').select('*').eq('scope', flow).eq('active', true),
      ])
      if (cancelled) return
      setCards((c.data || [])
        .filter(r => !(r.config && r.config.disabled))
        .map(r => ({ ...r, fields: Array.isArray(r.fields) ? r.fields : [] })))
      setPricing(p.data || [])
      setIdx(0); setAnswers({}); setLoading(false)
    })()
    return () => { cancelled = true }
  }, [flow])

  const card = cards[idx]
  const set = (k, v) => setAnswers(a => ({ ...a, [k]: v }))
  const toggleMulti = (k, label) => setAnswers(a => {
    const cur = Array.isArray(a[k]) ? a[k] : []
    return { ...a, [k]: cur.includes(label) ? cur.filter(x => x !== label) : [...cur, label] }
  })
  const estimate = useMemo(() => card?.card_type === 'estimate' ? computeEstimate(flow, answers, pricing) : null, [card, flow, answers, pricing])

  async function submitLead() {
    setSubmitting(true)
    const est = computeEstimate(flow, answers, pricing)
    try {
      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/submit-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabase.supabaseKey },
        body: JSON.stringify({ flow_type: flow, answers, estimate: est, test: isTest }),
      })
      const j = await res.json().catch(() => ({}))
      setSubmitted(res.ok ? j : { error: j.error || ('HTTP ' + res.status) })
    } catch (e) {
      setSubmitted({ error: String(e) })
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (card && card.card_type === 'thankyou' && !submitRef.current) {
      submitRef.current = true
      submitLead()
    }
  }, [card]) // eslint-disable-line

  if (loading) return <div className="min-h-screen bg-navy-950 text-slate-400 flex items-center justify-center">Loading…</div>
  if (!card) return <div className="min-h-screen bg-navy-950 text-slate-400 flex items-center justify-center">No cards for this flow.</div>

  function renderField(f, i) {
    const v = answers[f.key]
    const opts = enabledOpts(f.options)
    if (['text', 'email', 'tel', 'number', 'date', 'currency', 'password'].includes(f.type)) {
      const t = f.type === 'currency' ? 'number' : f.type === 'password' ? 'password' : f.type
      return (
        <div key={i}>
          <label className="text-slate-400 text-xs mb-1 block">{f.label}{f.required && <span className="text-brand-blue"> *</span>}</label>
          <input type={t} value={v || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder || ''} className={input} />
        </div>
      )
    }
    if (f.type === 'textarea' || f.type === 'address') {
      return (
        <div key={i}>
          <label className="text-slate-400 text-xs mb-1 block">{f.label}{f.required && <span className="text-brand-blue"> *</span>}</label>
          <textarea value={v || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder || ''} rows={f.type === 'address' ? 2 : 3} className={input + ' resize-y'} />
        </div>
      )
    }
    if (f.type === 'select') {
      return (
        <div key={i}>
          <label className="text-slate-400 text-xs mb-1 block">{f.label}{f.required && <span className="text-brand-blue"> *</span>}</label>
          <select value={v || ''} onChange={e => set(f.key, e.target.value)} className={input}>
            <option value="">Select…</option>
            {opts.map((o, j) => <option key={j} value={o.label}>{o.label}</option>)}
          </select>
        </div>
      )
    }
    if (f.type === 'radio' || f.type === 'multiselect') {
      const multi = f.type === 'multiselect'
      return (
        <div key={i}>
          <label className="text-slate-400 text-xs mb-1.5 block">{f.label}{f.required && <span className="text-brand-blue"> *</span>}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {opts.map((o, j) => {
              const on = multi ? (Array.isArray(v) && v.includes(o.label)) : v === o.label
              return <button key={j} type="button" onClick={() => multi ? toggleMulti(f.key, o.label) : set(f.key, o.label)} className={chip(on)}>{o.label}</button>
            })}
          </div>
        </div>
      )
    }
    if (f.type === 'color_theme') {
      const keys = Array.isArray(f.options) ? f.options : []
      return (
        <div key={i}>
          <label className="text-slate-400 text-xs mb-1.5 block">{f.label}</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {keys.map((k) => {
              const on = v === k
              return (
                <button key={k} type="button" onClick={() => set(f.key, k)} className={`rounded-lg border p-2 ${on ? 'border-brand-blue' : 'border-white/10 hover:border-white/30'}`}>
                  <div className="flex gap-1 mb-1">{(THEME_COLORS[k] || ['#333', '#666', '#999']).map((c, ci) => <span key={ci} className="w-4 h-4 rounded-sm" style={{ backgroundColor: c }} />)}</div>
                  <div className="text-[11px] text-slate-300 capitalize">{k}</div>
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    if (f.type === 'file') {
      return (
        <div key={i}>
          <label className="text-slate-400 text-xs mb-1 block">{f.label}</label>
          <div className="w-full border border-dashed border-white/15 rounded-lg py-4 text-center text-slate-500 text-sm">Upload (coming soon)</div>
        </div>
      )
    }
    if (f.type === 'info') return <p key={i} className="text-slate-400 text-sm">{f.label}</p>
    return null
  }

  const isLast = idx === cards.length - 1
  const dot = (n) => idx === n ? 'bg-brand-blue' : idx > n ? 'bg-emerald-500' : 'bg-white/15'

  return (
    <div className="min-h-screen bg-navy-950 text-white flex flex-col">
      <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <span className="text-lg font-bold tracking-wider font-heading">LIFTORI</span>
        <span className="text-xs text-slate-500">Step {idx + 1} of {cards.length}</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="flex gap-1 mb-6">{cards.map((_, n) => <span key={n} className={`h-1 flex-1 rounded-full ${dot(n)}`} />)}</div>

          <h1 className="text-2xl font-bold mb-1">{card.card_title}</h1>
          {card.subtitle && <p className="text-slate-400 text-sm mb-5">{card.subtitle}</p>}
          {card.body && <p className="text-slate-300 text-sm whitespace-pre-wrap mb-5">{card.body}</p>}

          {/* Estimate */}
          {card.card_type === 'estimate' && estimate && (
            <div className="bg-[#0D1424] border border-white/10 rounded-xl p-5 mb-5">
              {estimate.items.length === 0 ? (
                <p className="text-slate-400 text-sm">We will prepare a custom quote based on your selections.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {estimate.items.map((it, j) => (
                      <div key={j} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{it.label}</span>
                        <span className="text-white font-medium">{formatUSD(it.price)}{it.billing === 'monthly' ? '/mo' : ''}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 mt-3 pt-3 space-y-1">
                    {estimate.monthly > 0 && <div className="flex justify-between text-sm"><span className="text-slate-400">Monthly</span><span className="text-white font-semibold">{formatUSD(estimate.monthly)}/mo</span></div>}
                    {estimate.oneTime > 0 && <div className="flex justify-between text-sm"><span className="text-slate-400">One-time</span><span className="text-white font-semibold">{formatUSD(estimate.oneTime)}</span></div>}
                  </div>
                  {estimate.quote && <p className="text-[11px] text-slate-500 mt-3">Some items are custom-quoted — we will confirm final pricing with you.</p>}
                </>
              )}
            </div>
          )}

          {/* Submission status (thank-you card) */}
          {card.card_type === 'thankyou' && (
            <div className={`rounded-xl p-4 mb-5 text-sm border ${submitting ? 'border-white/10 bg-[#0D1424] text-slate-400' : submitted && submitted.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : submitted && submitted.error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-white/10 bg-[#0D1424] text-slate-400'}`}>
              {submitting ? 'Setting up your request…' : submitted && submitted.ok ? 'You are all set — your request is in and the team has been notified.' : submitted && submitted.error ? ('Could not submit: ' + submitted.error) : 'Finalizing…'}
            </div>
          )}

          {/* Payment placeholder */}
          {card.card_type === 'payment' && (
            <div className="bg-[#0D1424] border border-white/10 rounded-xl p-5 mb-5 text-slate-400 text-sm">Secure checkout is set up at launch. For now this is a preview of the payment step.</div>
          )}

          {/* Fields */}
          {(card.fields || []).length > 0 && <div className="space-y-4">{card.fields.map(renderField)}</div>}

          {/* Nav */}
          <div className="flex items-center gap-3 mt-8">
            {idx > 0 && <button onClick={() => setIdx(i => i - 1)} className="text-slate-400 hover:text-white text-sm px-3 py-2">Back</button>}
            <div className="flex-1" />
            {!isLast
              ? <button onClick={() => setIdx(i => i + 1)} className="bg-brand-blue hover:bg-blue-600 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">Continue</button>
              : <button onClick={() => navigate('/portal')} className="bg-brand-blue hover:bg-blue-600 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">Finish</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
