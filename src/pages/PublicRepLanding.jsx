import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Public, no-auth landing page for an individual Liftori sales rep.
// Route: /r/:slug  ->  resolves the rep via get_rep_landing(slug) and captures
// "request info" leads straight back to that rep (submit_rep_lead).
// Liftori-branded: LIFT (white) + ori (blue) wordmark, navy + brand blue.

const usd = (n) => '$' + (Number(n) || 0).toLocaleString('en-US')

function priceLabel(p) {
  if (p.billing === 'monthly') return `${usd(p.price)}/mo`
  if (p.billing === 'one_time') return `${usd(p.price)}`
  return 'Custom'
}

// Group the flat catalog into customer-friendly sections.
const SECTIONS = [
  { key: 'crm', title: 'CRM & Business Platforms', blurb: 'One system to run sales, operations, and customers.' },
  { key: 'website', title: 'Websites', blurb: 'From a clean landing page to a full e-commerce store.' },
  { key: 'bolo', title: 'Apps & Marketplaces', blurb: 'Mobile-ready tools your customers actually use.' },
  { key: 'consulting', title: 'Consulting & Operations', blurb: 'Strategy, systems, and fractional operators.' },
  { key: 'branding', title: 'Branding', blurb: 'Logo and brand identity to launch with.' },
  { key: 'custom_build', title: 'Custom Builds', blurb: 'Anything else you can imagine — built to scope.' },
]

const Wordmark = ({ className = '', tone = 'light' }) => (
  <span className={`font-bold tracking-tight ${className}`}>
    <span className={tone === 'dark' ? 'text-slate-900' : 'text-white'}>LIFT</span><span className="text-sky-500">ori</span>
  </span>
)

export default function PublicRepLanding() {
  const { slug } = useParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_rep_landing', { p_slug: slug })
      if (!alive) return
      if (error || !data) { setNotFound(true); setLoading(false); return }
      setData(data)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [slug])

  const rep = data?.rep
  const products = data?.products || []

  const grouped = useMemo(() => {
    return SECTIONS.map(s => ({ ...s, items: products.filter(p => p.scope === s.key) }))
      .filter(s => s.items.length > 0)
  }, [products])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060B18] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#060B18] flex flex-col items-center justify-center px-6 text-center">
        <Wordmark className="text-3xl" />
        <p className="mt-6 text-slate-400">This page isn’t available.</p>
        <a href="https://www.liftori.ai" className="mt-4 text-sky-400 hover:text-sky-300 text-sm">Go to liftori.ai</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Hero */}
      <header className="bg-[#060B18] text-white">
        <div className="mx-auto max-w-5xl px-6 pt-7">
          <Wordmark className="text-2xl" />
        </div>
        <div className="mx-auto max-w-5xl px-6 pt-14 pb-16 md:pt-20 md:pb-24">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">
            {rep?.title || 'Liftori Solutions Specialist'}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.1] md:text-6xl">
            {rep?.headline || 'Custom software that lifts your business.'}
          </h1>
          {rep?.subheadline && (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">{rep.subheadline}</p>
          )}
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#request"
              className="rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-400">
              Request information
            </a>
            {rep?.booking_url && (
              <a href={rep.booking_url} target="_blank" rel="noreferrer"
                className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/5">
                Book a call
              </a>
            )}
          </div>
          {rep?.display_name && (
            <p className="mt-10 text-sm text-slate-400">
              Your point of contact: <span className="text-white">{rep.display_name}</span>
              {rep.email && <> · <a href={`mailto:${rep.email}`} className="text-sky-400 hover:text-sky-300">{rep.email}</a></>}
              {rep.phone && <> · <a href={`tel:${rep.phone}`} className="text-sky-400 hover:text-sky-300">{rep.phone}</a></>}
            </p>
          )}
        </div>
      </header>

      {/* Products */}
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">What we can build for you</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Pick what fits — or tell us what you need and we’ll scope it. Everything is built, launched, and supported by Liftori.
        </p>

        <div className="mt-10 space-y-12">
          {grouped.map(section => (
            <div key={section.key}>
              <div className="flex items-baseline justify-between gap-4 border-b border-slate-200 pb-3">
                <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                <p className="hidden text-sm text-slate-500 sm:block">{section.blurb}</p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map(p => (
                  <div key={p.item_key}
                    className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                    <p className="mt-3 font-mono text-lg font-bold text-sky-600">{priceLabel(p)}</p>
                    {p.billing === 'one_time' && <p className="text-xs text-slate-500">one-time</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Request info */}
      <section id="request" className="bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Tell us what you’re building</h2>
              <p className="mt-3 max-w-md text-slate-600">
                Send your details and {rep?.display_name || 'your Liftori specialist'} will reach out personally
                with a plan and pricing. No obligation.
              </p>
              <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
                <Wordmark className="text-xl" tone="dark" />
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Liftori turns your idea into a live, working product — websites, CRMs, apps, and AI tools —
                  built fast and supported for the long run.
                </p>
              </div>
            </div>
            <LeadForm slug={slug} products={products} repName={rep?.display_name} />
          </div>
        </div>
      </section>

      <footer className="bg-[#060B18] text-white">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <Wordmark className="text-lg" />
          <a href="https://www.liftori.ai" className="text-sm text-slate-400 hover:text-sky-300">liftori.ai</a>
        </div>
      </footer>
    </div>
  )
}

function LeadForm({ slug, products, repName }) {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', company: '',
    product_interest: '', biggest_need: '', budget_range: '', how_heard: '',
  })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.full_name.trim() || !form.email.trim()) { setError('Name and email are required.'); return }
    setSending(true)
    try {
      const { data, error } = await supabase.rpc('submit_rep_lead', {
        p_slug: slug,
        p_full_name: form.full_name,
        p_email: form.email,
        p_phone: form.phone || null,
        p_company: form.company || null,
        p_product_interest: form.product_interest || null,
        p_biggest_need: form.biggest_need || null,
        p_budget_range: form.budget_range || null,
        p_how_heard: form.how_heard || null,
      })
      if (error) throw error
      if (!data?.ok) throw new Error('Something went wrong')
      setDone(true)
    } catch (err) {
      setError(err?.message || 'Could not send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Request received</p>
        <h3 className="mt-3 text-xl font-bold text-slate-900">Thanks — you’re in.</h3>
        <p className="mt-2 text-slate-600">
          {repName || 'Your Liftori specialist'} will be in touch shortly. Keep an eye on your inbox.
        </p>
      </div>
    )
  }

  const fld = 'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
  const lbl = 'block text-xs font-medium text-slate-600 mb-1.5'

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl}>Full name *</label>
          <input className={fld} value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith" />
        </div>
        <div>
          <label className={lbl}>Email *</label>
          <input type="email" className={fld} value={form.email} onChange={set('email')} placeholder="jane@company.com" />
        </div>
        <div>
          <label className={lbl}>Phone</label>
          <input className={fld} value={form.phone} onChange={set('phone')} placeholder="(904) 555-0100" />
        </div>
        <div>
          <label className={lbl}>Company</label>
          <input className={fld} value={form.company} onChange={set('company')} placeholder="Acme Co." />
        </div>
      </div>

      <div className="mt-4">
        <label className={lbl}>What are you interested in?</label>
        <select className={fld} value={form.product_interest} onChange={set('product_interest')}>
          <option value="">Select a product…</option>
          {products.map(p => <option key={p.item_key} value={p.label}>{p.label}</option>)}
          <option value="Not sure yet — help me choose">Not sure yet — help me choose</option>
        </select>
      </div>

      <div className="mt-4">
        <label className={lbl}>What’s your biggest need right now?</label>
        <textarea rows={3} className={fld} value={form.biggest_need} onChange={set('biggest_need')}
          placeholder="Tell us a little about your project or business…" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={lbl}>Budget range</label>
          <select className={fld} value={form.budget_range} onChange={set('budget_range')}>
            <option value="">Prefer not to say</option>
            <option>Under $1,000</option>
            <option>$1,000 – $3,000</option>
            <option>$3,000 – $10,000</option>
            <option>$10,000+</option>
            <option>Monthly subscription</option>
          </select>
        </div>
        <div>
          <label className={lbl}>How did you hear about us?</label>
          <input className={fld} value={form.how_heard} onChange={set('how_heard')} placeholder="Referral, social, search…" />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

      <button type="submit" disabled={sending}
        className="mt-6 w-full rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60">
        {sending ? 'Sending…' : 'Request information'}
      </button>
      <p className="mt-3 text-center text-xs text-slate-400">
        By submitting you agree to be contacted by Liftori about your request.
      </p>
    </form>
  )
}
