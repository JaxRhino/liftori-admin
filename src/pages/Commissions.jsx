import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Sales Hub > Commissions
// Plain-language commission plan for 1099 sales reps + an earnings calculator +
// a live per-rep ledger. Admins/managers manage every rep's entries.
// Rates are driven by commission_plan_rules so the plan + calculator stay in sync.

const MANAGER_ROLES = ['super_admin', 'admin', 'dev', 'sales_director']
const REP_ROLE_CHOICES = ['sales_rep', 'sales_director', 'call_agent', 'consultant']

const ENTRY_TYPES = [
  { value: 'crm_setup', label: 'CRM setup (first month + onboarding)', category: 'crm', rate: 10 },
  { value: 'crm_recurring', label: 'CRM monthly recurring', category: 'crm', rate: 10 },
  { value: 'web_dev', label: 'Website build', category: 'web_dev', rate: null },
  { value: 'custom_build', label: 'Custom build add-on', category: 'custom_build', rate: 10 },
  { value: 'consulting_referral', label: 'Consulting referral bonus', category: 'consulting', rate: null },
]

const STATUS_STYLE = {
  pending:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved:  'bg-sky-500/15 text-sky-300 border-sky-500/30',
  scheduled: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  paid:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  held:      'bg-rose-500/15 text-rose-300 border-rose-500/30',
}
const STATUSES = ['pending', 'approved', 'scheduled', 'paid', 'held']

const usd = (n) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// Website tier from price: $500–999 = 10%, $1,000+ = 25%, under $500 not commissionable.
function webTierRate(price) {
  const p = Number(price) || 0
  if (p >= 1000) return 25
  if (p >= 500) return 10
  return 0
}

export default function Commissions() {
  const { profile, user } = useAuth()
  const role = profile?.role || 'customer'
  const isManager = MANAGER_ROLES.includes(role)
  const myId = user?.id

  const [tab, setTab] = useState('plan')
  const [rules, setRules] = useState([])
  const [entries, setEntries] = useState([])
  const [reps, setReps] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  function flash(m) { setToast(m); setTimeout(() => setToast(null), 3200) }

  async function loadAll() {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      supabase.from('commission_plan_rules').select('*').eq('active', true).order('sort_order'),
      supabase.from('sales_commission_entries').select('*').order('created_at', { ascending: false }),
    ])
    setRules(r1.data || [])
    setEntries(r2.data || [])
    if (isManager) {
      const { data } = await supabase.from('profiles').select('id, full_name, email, role')
        .in('role', REP_ROLE_CHOICES).order('full_name')
      setReps(data || [])
    }
    setLoading(false)
  }
  useEffect(() => { loadAll() /* eslint-disable-next-line */ }, [isManager])

  // My entries = the signed-in rep's own; managers still get a personal view here.
  const myEntries = useMemo(() => entries.filter(e => e.rep_id === myId), [entries, myId])

  const tabs = [
    { id: 'plan', label: 'The Plan' },
    { id: 'calculator', label: 'Calculator' },
    { id: 'earnings', label: 'My Earnings' },
    { id: 'landing', label: 'Landing Page' },
    ...(isManager ? [{ id: 'manage', label: 'Manage' }] : []),
  ]

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="rounded-2xl border border-navy-700 bg-gradient-to-br from-navy-800 to-navy-900 p-7">
          <h1 className="text-2xl font-semibold text-white">Commissions</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            How you get paid as a Liftori sales rep. Everything below is your real commission
            structure — what you earn, when it pays out, and what you have to do to keep the
            recurring money coming. Use the calculator to see what a deal is worth before you close it.
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-1 border-b border-navy-700">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition ${
                tab === t.id ? 'border-brand-cyan text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'plan' && <PlanTab rules={rules} loading={loading} />}
          {tab === 'calculator' && <CalculatorTab rules={rules} />}
          {tab === 'earnings' && <EarningsTab entries={myEntries} loading={loading} />}
          {tab === 'landing' && <LandingTab profile={profile} userId={myId} flash={flash} />}
          {tab === 'manage' && isManager && (
            <ManageTab entries={entries} reps={reps} loading={loading}
              onNew={() => setEditing(blankEntry(reps[0]))}
              onEdit={(e) => setEditing({ ...e })}
              onDeleted={loadAll} flash={flash} />
          )}
        </div>
      </div>

      {editing && (
        <EntryModal editing={editing} setEditing={setEditing} reps={reps} saving={saving}
          onSave={async (row) => {
            setSaving(true)
            try {
              const payload = { ...row, updated_at: new Date().toISOString() }
              const res = row.id
                ? await supabase.from('sales_commission_entries').update(payload).eq('id', row.id)
                : await supabase.from('sales_commission_entries').insert({ ...payload, created_by: myId })
              if (res.error) throw res.error
              flash(row.id ? 'Entry updated' : 'Entry added')
              setEditing(null); loadAll()
            } catch (err) { flash('Save failed: ' + (err?.message || 'error')) }
            finally { setSaving(false) }
          }} />
      )}

      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-sky-600 px-4 py-3 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  )
}

function blankEntry(firstRep) {
  return {
    rep_id: firstRep?.id || '', rep_name: firstRep?.full_name || '', rep_email: firstRep?.email || '',
    customer_name: '', category: 'crm', entry_type: 'crm_setup', description: '',
    base_amount: '', commission_rate: 10, commission_amount: '', period_month: '',
    servicing_status: 'active', status: 'pending', notes: '',
  }
}

/* ----------------------------- The Plan ----------------------------- */
function PlanTab({ rules, loading }) {
  const byCat = (c) => rules.filter(r => r.category === c)
  const Section = ({ title, sub, children }) => (
    <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
  const RuleRow = ({ r }) => (
    <div className="rounded-lg border border-navy-700 bg-navy-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{r.label}</p>
          {r.basis && <p className="mt-0.5 text-[13px] text-slate-400">Paid on: {r.basis}</p>}
        </div>
        <span className="shrink-0 rounded-md bg-brand-cyan/15 border border-brand-cyan/30 px-2.5 py-1 text-sm font-semibold text-brand-cyan">{r.rate_display}</span>
      </div>
      {r.conditions && <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{r.conditions}</p>}
    </div>
  )

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading plan…</div>

  return (
    <div className="space-y-5">
      {/* Servicing rule — the most important thing for reps to understand */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
        <p className="text-sm font-semibold text-amber-300">The one rule that matters most</p>
        <p className="mt-1 text-[13px] leading-relaxed text-amber-100/90">
          Your CRM recurring commission keeps paying every month — but only while you keep
          servicing that customer. You are their account manager and point of contact: check in
          regularly, help them use the platform, keep them happy. Stop servicing them and the
          recurring commission stops. Build a book of customers you take care of and it compounds.
        </p>
      </div>

      <Section title="CRM software sales" sub="Selling a Liftori CRM/platform subscription. You earn twice: once up front, then every month it renews.">
        {byCat('crm').map(r => <RuleRow key={r.id} r={r} />)}
      </Section>

      <Section title="Website development" sub="Selling a website build. The rate depends on the project price. Each piece of the deal is commissioned separately and totaled up.">
        {byCat('web_dev').map(r => <RuleRow key={r.id} r={r} />)}
        {byCat('custom_build').map(r => <RuleRow key={r.id} r={r} />)}
        <p className="text-[12px] text-slate-500">
          Example: a $1,800 site (25% = $450) with a $600 custom build add-on (10% = $60) pays you
          $510 total — each line is calculated on its own, then added together.
        </p>
      </Section>

      <Section title="Business consulting referrals" sub="Send a client our way for business consulting. They're handed to the Liftori Business Consulting team — you collect a referral bonus.">
        {byCat('consulting').map(r => <RuleRow key={r.id} r={r} />)}
      </Section>

      {/* Payout lifecycle */}
      <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
        <h3 className="text-base font-semibold text-white">How a commission gets paid</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {[
            ['Pending', 'Deal closes and the commission is logged'],
            ['Approved', 'A manager reviews and clears it'],
            ['Scheduled', 'Queued for the next payout run'],
            ['Paid', 'Money sent to you'],
            ['Held', 'Paused — refund, chargeback, or review'],
          ].map(([s, d], i) => (
            <div key={i} className="rounded-lg border border-navy-700 bg-navy-900/60 p-3">
              <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[s.toLowerCase()]}`}>{s}</span>
              <p className="mt-2 text-[12px] leading-snug text-slate-400">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-slate-500">
          You're a 1099 independent contractor — commissions are paid gross with no taxes withheld.
          Set aside your own taxes. Payout cadence and any holdbacks are confirmed in your rep agreement.
        </p>
      </div>
    </div>
  )
}

/* ----------------------------- Calculator ----------------------------- */
// Hoisted to module scope so inputs keep focus across re-renders (defining them
// inside CalculatorTab remounts the input on every keystroke).
function CalcField({ label, value, set, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
        <input type="number" min="0" className="input pl-7" value={value} onChange={e => set(e.target.value)} />
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}
function CalcLine({ label, sub, amount, accent }) {
  return (
    <div className="flex items-center justify-between border-b border-navy-700/60 py-2.5 last:border-0">
      <div><p className="text-sm text-slate-200">{label}</p>{sub && <p className="text-[11px] text-slate-500">{sub}</p>}</div>
      <p className={`font-mono text-sm font-semibold ${accent ? 'text-brand-cyan' : 'text-slate-300'}`}>{usd(amount)}</p>
    </div>
  )
}

function CalculatorTab({ rules }) {
  const rateFor = (cat, fallback) => {
    const r = rules.find(x => x.category === cat && x.rate != null)
    return r ? Number(r.rate) : fallback
  }
  const crmRate = rateFor('crm', 10)
  const customRate = rateFor('custom_build', 10)

  const [monthly, setMonthly] = useState('249')
  const [onboarding, setOnboarding] = useState('300')
  const [sitePrice, setSitePrice] = useState('1800')
  const [customCharge, setCustomCharge] = useState('600')

  const m = Number(monthly) || 0
  const ob = Number(onboarding) || 0
  const sp = Number(sitePrice) || 0
  const cc = Number(customCharge) || 0

  const crmSetup = (m + ob) * crmRate / 100
  const crmMonthly = m * crmRate / 100
  const tier = webTierRate(sp)
  const webComm = sp * tier / 100
  const customComm = cc * customRate / 100

  const oneTimeTotal = crmSetup + webComm + customComm
  const recurringMonthly = crmMonthly


  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* CRM */}
      <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
        <h3 className="text-base font-semibold text-white">CRM / platform sale</h3>
        <p className="mt-1 text-[13px] text-slate-400">{crmRate}% of the first month + onboarding up front, then {crmRate}% of the monthly plan every month you service them.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <CalcField label="Monthly plan" value={monthly} set={setMonthly} />
          <CalcField label="Onboarding fee" value={onboarding} set={setOnboarding} />
        </div>
        <div className="mt-4">
          <CalcLine label="Setup commission" sub={`${crmRate}% of (first month + onboarding)`} amount={crmSetup} accent />
          <CalcLine label="Recurring / month" sub={`${crmRate}% of the monthly plan, while servicing`} amount={crmMonthly} accent />
          <CalcLine label="First 12 months of recurring" sub="If you keep the customer a year" amount={crmMonthly * 12} />
        </div>
      </div>

      {/* Website */}
      <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
        <h3 className="text-base font-semibold text-white">Website build</h3>
        <p className="mt-1 text-[13px] text-slate-400">$500–$999 pays 10%. $1,000+ pays 25%. Custom build add-ons pay {customRate}%, totaled separately.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <CalcField label="Website price" value={sitePrice} set={setSitePrice}
            hint={sp > 0 && sp < 500 ? 'Under $500 — not commissionable' : `Applied tier: ${tier}%`} />
          <CalcField label="Custom build charge" value={customCharge} set={setCustomCharge} />
        </div>
        <div className="mt-4">
          <CalcLine label="Website commission" sub={`${tier}% of ${usd(sp)}`} amount={webComm} accent />
          <CalcLine label="Custom build commission" sub={`${customRate}% of ${usd(cc)}`} amount={customComm} accent />
          <CalcLine label="Website deal total" amount={webComm + customComm} />
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 p-6 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Paid up front (this deal)</p>
            <p className="mt-1 font-mono text-3xl font-bold text-white">{usd(oneTimeTotal)}</p>
            <p className="mt-1 text-[12px] text-slate-500">CRM setup + website + custom build</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Then every month (recurring)</p>
            <p className="mt-1 font-mono text-3xl font-bold text-brand-cyan">{usd(recurringMonthly)}<span className="text-base text-slate-500">/mo</span></p>
            <p className="mt-1 text-[12px] text-slate-500">As long as you service the customer · {usd(oneTimeTotal + recurringMonthly * 12)} in year one</p>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-slate-500">Estimate only. Consulting referral bonuses are confirmed per deal and aren't included here.</p>
      </div>
    </div>
  )
}

/* ----------------------------- My Earnings ----------------------------- */
function EarningsTab({ entries, loading }) {
  const stats = useMemo(() => {
    const paid = entries.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.commission_amount || 0), 0)
    const pending = entries.filter(e => ['pending', 'approved', 'scheduled'].includes(e.status)).reduce((s, e) => s + Number(e.commission_amount || 0), 0)
    const thisMonth = entries.filter(e => {
      const d = new Date(e.created_at); const n = new Date()
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
    }).reduce((s, e) => s + Number(e.commission_amount || 0), 0)
    const activeRecurring = new Set(entries.filter(e => e.entry_type === 'crm_recurring' && e.servicing_status === 'active').map(e => e.customer_name)).size
    return { paid, pending, thisMonth, activeRecurring }
  }, [entries])

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading your earnings…</div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Paid to date', usd(stats.paid), 'Cleared commissions'],
          ['In the pipeline', usd(stats.pending), 'Pending / approved / scheduled'],
          ['Logged this month', usd(stats.thisMonth), 'New commissions'],
          ['Recurring customers', String(stats.activeRecurring), 'Actively serviced'],
        ].map(([label, val, sub], i) => (
          <div key={i} className="rounded-xl border border-navy-700 bg-navy-800/50 p-4">
            <p className="font-mono text-2xl font-bold text-white">{val}</p>
            <p className="mt-1 text-xs font-medium text-brand-cyan">{label}</p>
            <p className="text-[10px] text-slate-500">{sub}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-navy-700 bg-navy-800/50 py-16 text-center text-sm text-slate-500">
          No commissions logged yet. Close your first deal and it'll show up here.
        </div>
      ) : (
        <EntryTable entries={entries} />
      )}
    </div>
  )
}

/* ----------------------------- Landing Page ----------------------------- */
// A rep's own Liftori-branded landing page. They edit the name + contact info
// that appears on it, share it, and watch leads come back as New Leads.
function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

function LandingTab({ profile, userId, flash }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [row, setRow] = useState(null)
  const [leads, setLeads] = useState([])
  const [form, setForm] = useState({
    slug: '', display_name: '', title: '', email: '', phone: '',
    headline: '', subheadline: '', booking_url: '', active: true,
  })

  async function load() {
    setLoading(true)
    const { data: lp } = await supabase.from('rep_landing_pages').select('*').eq('rep_id', userId).maybeSingle()
    if (lp) {
      setRow(lp)
      setForm({
        slug: lp.slug || '', display_name: lp.display_name || '', title: lp.title || '',
        email: lp.email || '', phone: lp.phone || '', headline: lp.headline || '',
        subheadline: lp.subheadline || '', booking_url: lp.booking_url || '', active: lp.active !== false,
      })
    } else {
      // Sensible defaults from the rep's profile.
      const name = profile?.full_name || ''
      setForm(f => ({
        ...f,
        display_name: name,
        email: profile?.email || '',
        phone: profile?.phone || '',
        slug: slugify(name) || slugify((profile?.email || '').split('@')[0]),
        title: 'Liftori Solutions Specialist',
        headline: 'Custom software that lifts your business',
        subheadline: 'From CRMs to websites to AI tools — built for you, launched fast.',
      }))
    }
    const { data: ld } = await supabase.from('digital_product_leads').select('*')
      .eq('rep_id', userId).order('created_at', { ascending: false })
    setLeads(ld || [])
    setLoading(false)
  }
  useEffect(() => { if (userId) load() /* eslint-disable-next-line */ }, [userId])

  const publicUrl = useMemo(() => {
    const base = (typeof window !== 'undefined' ? window.location.origin : 'https://admin.liftori.ai')
    return form.slug ? `${base}/r/${form.slug}` : ''
  }, [form.slug])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    const cleanSlug = slugify(form.slug)
    if (!cleanSlug) { flash('Pick a handle for your link first'); return }
    if (!form.display_name.trim()) { flash('Add the name to show on your page'); return }
    setSaving(true)
    try {
      const payload = {
        rep_id: userId, slug: cleanSlug,
        display_name: form.display_name.trim(), title: form.title.trim() || null,
        email: form.email.trim() || null, phone: form.phone.trim() || null,
        headline: form.headline.trim() || null, subheadline: form.subheadline.trim() || null,
        booking_url: form.booking_url.trim() || null, active: !!form.active,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('rep_landing_pages').upsert(payload, { onConflict: 'rep_id' })
      if (error) {
        if ((error.code === '23505') || /duplicate|unique/i.test(error.message || '')) {
          flash('That handle is taken — try another'); return
        }
        throw error
      }
      setForm(f => ({ ...f, slug: cleanSlug }))
      flash('Landing page saved')
      load()
    } catch (err) {
      flash('Save failed: ' + (err?.message || 'error'))
    } finally { setSaving(false) }
  }

  function copyLink() {
    if (!publicUrl) return
    navigator.clipboard?.writeText(publicUrl).then(() => flash('Link copied')).catch(() => flash('Copy failed'))
  }

  const share = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`,
    x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent('Build your next project with Liftori')}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`,
  }

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading your landing page…</div>

  const fld = 'input'
  const lbl = 'label'

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 p-5">
        <p className="text-sm font-semibold text-white">Your own Liftori landing page</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-300">
          Share this page anywhere — socials, texts, your email signature. It shows everything Liftori
          can build, and every "request info" submission comes straight back to you here as a new lead.
          Set the name and contact info that appears on it below.
        </p>
      </div>

      {/* Share row */}
      <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-5">
        <label className="label">Your page link</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-navy-700 bg-navy-900/70 px-3 py-2 text-sm text-sky-300">
            {publicUrl || 'Save your page to generate a link'}
          </code>
          <button onClick={copyLink} disabled={!publicUrl}
            className="rounded-lg border border-navy-600 bg-navy-900/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/40 hover:text-white disabled:opacity-50">Copy link</button>
          <a href={publicUrl || '#'} target="_blank" rel="noreferrer"
            className={`btn-primary ${!publicUrl ? 'pointer-events-none opacity-50' : ''}`}>View page</a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Share:</span>
          {[['Facebook', share.facebook], ['X', share.x], ['LinkedIn', share.linkedin]].map(([label, href]) => (
            <a key={label} href={publicUrl ? href : '#'} target="_blank" rel="noreferrer"
              className={`rounded-md border border-navy-700 bg-navy-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-sky-500/40 hover:text-white ${!publicUrl ? 'pointer-events-none opacity-50' : ''}`}>
              {label}
            </a>
          ))}
          {!form.active && <span className="ml-1 rounded bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-300">Page hidden — turn it on below</span>}
        </div>
      </div>

      {/* Editor */}
      <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
        <h3 className="text-base font-semibold text-white">Page details</h3>
        <p className="mt-1 text-[13px] text-slate-400">This is what visitors see and how they reach you.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Link handle</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">/r/</span>
              <input className={fld} value={form.slug} onChange={set('slug')} placeholder="your-name" />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Letters, numbers and dashes. This is your public link.</p>
          </div>
          <div>
            <label className={lbl}>Name shown on page</label>
            <input className={fld} value={form.display_name} onChange={set('display_name')} placeholder="Jane Smith" />
          </div>
          <div>
            <label className={lbl}>Title / role</label>
            <input className={fld} value={form.title} onChange={set('title')} placeholder="Liftori Solutions Specialist" />
          </div>
          <div>
            <label className={lbl}>Contact email</label>
            <input className={fld} value={form.email} onChange={set('email')} placeholder="you@liftori.ai" />
          </div>
          <div>
            <label className={lbl}>Contact phone</label>
            <input className={fld} value={form.phone} onChange={set('phone')} placeholder="(904) 555-0100" />
          </div>
          <div>
            <label className={lbl}>Booking link (optional)</label>
            <input className={fld} value={form.booking_url} onChange={set('booking_url')} placeholder="https://calendly.com/…" />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Headline</label>
            <input className={fld} value={form.headline} onChange={set('headline')} placeholder="Custom software that lifts your business" />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Sub-headline</label>
            <textarea rows={2} className={fld} value={form.subheadline} onChange={set('subheadline')}
              placeholder="From CRMs to websites to AI tools — built for you, launched fast." />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-navy-600 bg-navy-900 text-brand-cyan focus:ring-brand-cyan" />
            Page is live (visitors can see it)
          </label>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : (row ? 'Save changes' : 'Create my page')}</button>
        </div>
      </div>

      {/* Leads from this page */}
      <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Leads from your page</h3>
          <span className="text-sm text-slate-400">{leads.length} total</span>
        </div>
        {leads.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No leads yet. Share your link and inbound requests will appear here as new leads.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-navy-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-800 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Interested in</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/60">
                {leads.map(l => (
                  <tr key={l.id} className="bg-navy-900/40 hover:bg-navy-800/60 align-top">
                    <td className="px-4 py-3">
                      <p className="text-white">{l.full_name || '—'}</p>
                      {l.company_name && <p className="text-[11px] text-slate-500">{l.company_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {l.email && <p>{l.email}</p>}
                      {l.phone && <p className="text-[11px] text-slate-500">{l.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {l.product_interest || '—'}
                      {l.biggest_need && <p className="mt-0.5 max-w-xs text-[11px] text-slate-500 line-clamp-2">{l.biggest_need}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-sky-300">
                        {l.status === 'new' ? 'New Lead' : l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400">
                      {l.created_at ? new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ----------------------------- Manage (admin) ----------------------------- */
function ManageTab({ entries, reps, loading, onNew, onEdit, onDeleted, flash }) {
  const [repFilter, setRepFilter] = useState('all')
  const filtered = repFilter === 'all' ? entries : entries.filter(e => e.rep_id === repFilter)
  const total = filtered.reduce((s, e) => s + Number(e.commission_amount || 0), 0)

  async function del(id) {
    const { error } = await supabase.from('sales_commission_entries').delete().eq('id', id)
    if (error) { flash('Delete failed: ' + error.message); return }
    flash('Entry deleted'); onDeleted()
  }

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select className="input w-auto" value={repFilter} onChange={e => setRepFilter(e.target.value)}>
            <option value="all">All reps</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.full_name || r.email}</option>)}
          </select>
          <span className="text-sm text-slate-400">{filtered.length} entries · <span className="font-mono text-brand-cyan">{usd(total)}</span></span>
        </div>
        <button onClick={onNew} className="btn-primary">Add commission</button>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-navy-700 bg-navy-800/50 py-16 text-center text-sm text-slate-500">No entries.</div>
      ) : (
        <EntryTable entries={filtered} showRep onEdit={onEdit} onDelete={del} />
      )}
    </div>
  )
}

/* ----------------------------- Shared table ----------------------------- */
function EntryTable({ entries, showRep, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-navy-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-navy-800 text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            {showRep && <th className="px-4 py-3 font-semibold">Rep</th>}
            <th className="px-4 py-3 font-semibold">Customer</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold text-right">Base</th>
            <th className="px-4 py-3 font-semibold text-right">Rate</th>
            <th className="px-4 py-3 font-semibold text-right">Commission</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            {(onEdit || onDelete) && <th className="px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-700/60">
          {entries.map(e => (
            <tr key={e.id} className="bg-navy-900/40 hover:bg-navy-800/60">
              {showRep && <td className="px-4 py-3 text-slate-300">{e.rep_name || '—'}</td>}
              <td className="px-4 py-3 text-white">
                {e.customer_name || '—'}
                {e.period_month && <span className="ml-1 text-[11px] text-slate-500">· {new Date(e.period_month + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
              </td>
              <td className="px-4 py-3">
                <span className="text-slate-300">{(ENTRY_TYPES.find(t => t.value === e.entry_type) || {}).label || e.entry_type}</span>
                {e.entry_type === 'crm_recurring' && (
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${e.servicing_status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                    {e.servicing_status === 'active' ? 'servicing' : 'lapsed'}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-400">{Number(e.base_amount) ? usd(e.base_amount) : '—'}</td>
              <td className="px-4 py-3 text-right font-mono text-slate-400">{e.commission_rate != null ? `${e.commission_rate}%` : 'flat'}</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-brand-cyan">{usd(e.commission_amount)}</td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[e.status] || 'text-slate-400'}`}>{e.status}</span>
              </td>
              {(onEdit || onDelete) && (
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {onEdit && <button onClick={() => onEdit(e)} className="text-xs text-slate-400 hover:text-white">Edit</button>}
                  {onDelete && <button onClick={() => onDelete(e.id)} className="ml-3 text-xs text-rose-400/80 hover:text-rose-300">Delete</button>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ----------------------------- Add/Edit modal ----------------------------- */
function EntryModal({ editing, setEditing, reps, saving, onSave }) {
  const set = (patch) => setEditing(prev => ({ ...prev, ...patch }))
  const et = ENTRY_TYPES.find(t => t.value === editing.entry_type) || ENTRY_TYPES[0]

  function onTypeChange(value) {
    const next = ENTRY_TYPES.find(t => t.value === value) || ENTRY_TYPES[0]
    set({ entry_type: value, category: next.category, commission_rate: next.rate })
    recompute({ entry_type: value, commission_rate: next.rate })
  }
  function recompute(over = {}) {
    const cur = { ...editing, ...over }
    const base = Number(cur.base_amount) || 0
    let rate = cur.commission_rate
    if (cur.entry_type === 'web_dev') rate = webTierRate(base)
    if (rate != null && cur.entry_type !== 'consulting_referral') {
      set({ commission_rate: rate, commission_amount: +(base * rate / 100).toFixed(2) })
    }
  }
  function onRepChange(id) {
    const r = reps.find(x => x.id === id)
    set({ rep_id: id, rep_name: r?.full_name || '', rep_email: r?.email || '' })
  }

  function submit(e) {
    e.preventDefault()
    const row = {
      rep_id: editing.rep_id, rep_name: editing.rep_name, rep_email: editing.rep_email,
      customer_name: editing.customer_name || null, category: editing.category,
      entry_type: editing.entry_type, description: editing.description || null,
      base_amount: Number(editing.base_amount) || 0,
      commission_rate: editing.entry_type === 'consulting_referral' ? null : (Number(editing.commission_rate) || 0),
      commission_amount: Number(editing.commission_amount) || 0,
      period_month: editing.entry_type === 'crm_recurring' && editing.period_month ? editing.period_month : null,
      servicing_status: editing.servicing_status || 'active',
      status: editing.status || 'pending', notes: editing.notes || null,
    }
    if (editing.id) row.id = editing.id
    if (!row.rep_id) return
    onSave(row)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditing(null)}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-auto rounded-xl border border-navy-700 bg-navy-900 p-6">
        <h2 className="text-lg font-semibold text-white">{editing.id ? 'Edit commission' : 'Add commission'}</h2>

        <div><label className="label">Rep</label>
          <select className="input" value={editing.rep_id} onChange={e => onRepChange(e.target.value)} required>
            <option value="" disabled>Select rep…</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.full_name || r.email}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Type</label>
            <select className="input" value={editing.entry_type} onChange={e => onTypeChange(e.target.value)}>
              {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div><label className="label">Customer</label>
            <input className="input" value={editing.customer_name || ''} onChange={e => set({ customer_name: e.target.value })} />
          </div>
        </div>

        <div><label className="label">Description</label>
          <input className="input" value={editing.description || ''} onChange={e => set({ description: e.target.value })}
            placeholder={et.label} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">{editing.entry_type === 'consulting_referral' ? 'Deal value' : 'Base amount'}</label>
            <input type="number" className="input" value={editing.base_amount}
              onChange={e => { set({ base_amount: e.target.value }); }}
              onBlur={() => recompute()} />
          </div>
          <div><label className="label">Rate %</label>
            <input type="number" className="input" value={editing.commission_rate ?? ''}
              disabled={editing.entry_type === 'consulting_referral' || editing.entry_type === 'web_dev'}
              onChange={e => set({ commission_rate: e.target.value })} onBlur={() => recompute()} />
          </div>
          <div><label className="label">Commission $</label>
            <input type="number" className="input" value={editing.commission_amount}
              onChange={e => set({ commission_amount: e.target.value })} />
          </div>
        </div>
        {editing.entry_type === 'web_dev' && <p className="-mt-2 text-[11px] text-slate-500">Rate auto-set by price: $500–999 = 10%, $1,000+ = 25%.</p>}
        {editing.entry_type === 'consulting_referral' && <p className="-mt-2 text-[11px] text-slate-500">Referral bonus — enter the agreed commission amount directly (TBD per deal).</p>}

        {editing.entry_type === 'crm_recurring' && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Period month</label>
              <input type="date" className="input" value={editing.period_month || ''} onChange={e => set({ period_month: e.target.value })} />
            </div>
            <div><label className="label">Servicing</label>
              <select className="input" value={editing.servicing_status} onChange={e => set({ servicing_status: e.target.value })}>
                <option value="active">Active (commission payable)</option>
                <option value="lapsed">Lapsed (not servicing)</option>
              </select>
            </div>
          </div>
        )}

        <div><label className="label">Status</label>
          <select className="input" value={editing.status} onChange={e => set({ status: e.target.value })}>
            {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={() => setEditing(null)} className="text-sm text-slate-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}
