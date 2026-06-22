import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Account-first onboarding funnel. One entry for every customer:
//   1) Create account  -> internal prospect account + temp portal
//   2) Where are you in your business journey (drives how we help — asked first)
//   3) What are you interested in (multi-select from the offerings catalog)
// Writes an engagement record, then drops them into their portal.

const JOURNEY_STAGES = [
  { key: 'idea',        title: 'Just an idea',          desc: 'Not formed yet — I need help getting started.' },
  { key: 'getting_set_up', title: 'Getting set up',     desc: 'Forming now — I need legal, insurance, website, branding.' },
  { key: 'up_and_running', title: 'Up & running',       desc: 'Formed and operating — I need better tools.' },
  { key: 'scaling',     title: 'Established & scaling',  desc: 'I have systems — I want advanced or custom builds.' },
]

function StepDots({ step }) {
  const labels = ['Account', 'Your journey', 'Interests']
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((l, i) => {
        const n = i + 1
        const active = step === n
        const done = step > n
        return (
          <div key={l} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-brand-blue text-white' : done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'}`}>
              {done ? '✓' : n}
            </div>
            <span className={`text-sm ${active ? 'text-white font-medium' : 'text-slate-500'}`}>{l}</span>
            {n < labels.length && <span className="w-6 h-px bg-white/10 mx-1" />}
          </div>
        )
      })}
    </div>
  )
}

export default function Start() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // account
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [uid, setUid] = useState(null)

  // catalog + selections
  const [offerings, setOfferings] = useState([])
  const [interests, setInterests] = useState([])
  const [journey, setJourney] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('offerings')
        .select('slug, name, kind, summary, price_hint')
        .eq('active', true)
        .order('sort', { ascending: true })
      if (!cancelled) setOfferings(data || [])
    })()
    return () => { cancelled = true }
  }, [])

  const products = offerings.filter(o => o.kind === 'product')
  const services = offerings.filter(o => o.kind !== 'product')
  const toggleInterest = (slug) => setInterests(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug])

  async function createAccount() {
    setError('')
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError('Enter your name, email, and a password of at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      let userId = data?.user?.id
      if (signErr) {
        if (/already registered/i.test(signErr.message)) {
          const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
          if (siErr) throw new Error('That email is already registered. Check your password.')
          userId = si.user.id
        } else {
          throw signErr
        }
      }
      if (!userId) throw new Error('Could not start your account. Please try again.')
      await supabase.from('profiles').upsert({ id: userId, email: email.trim(), full_name: fullName.trim(), role: 'prospect' })
      setUid(userId)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Something went wrong creating your account.')
    } finally {
      setLoading(false)
    }
  }

  async function finish() {
    setError('')
    setLoading(true)
    try {
      await supabase.from('engagements').insert({
        user_id: uid,
        email: email.trim(),
        full_name: fullName.trim(),
        interests,
        journey_stage: journey,
        status: 'prospect',
      })
      navigate('/portal', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not save your answers.')
      setLoading(false)
    }
  }

  const field = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue'

  return (
    <div className="min-h-screen bg-navy-950 text-white flex flex-col">
      <header className="px-6 py-5 border-b border-white/5">
        <span className="text-xl font-bold tracking-wider font-heading">LIFTORI</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <StepDots step={step} />

          {step === 1 && (
            <div>
              <h1 className="text-2xl font-bold mb-1">Let's get you started</h1>
              <p className="text-slate-400 text-sm mb-6">Create your account and we'll guide you from wherever you are — whether you're just starting out or scaling up.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Your name</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Founder" className={field} />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com" className={field} />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className={field} />
                </div>
              </div>
              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
              <button onClick={createAccount} disabled={loading} className="mt-6 bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">
                {loading ? 'Creating account…' : 'Create account & continue'}
              </button>
              <p className="text-slate-500 text-xs mt-3">Already have an account? <a href="/login" className="text-brand-blue hover:underline">Sign in</a></p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-2xl font-bold mb-1">Where are you in your business journey?</h1>
              <p className="text-slate-400 text-sm mb-6">First things first — this tells us how to help. We're for the people, wherever they're starting from.</p>
              <div className="space-y-2">
                {JOURNEY_STAGES.map(s => {
                  const on = journey === s.key
                  return (
                    <button key={s.key} onClick={() => setJourney(s.key)} className={`w-full text-left p-4 rounded-lg border transition-colors ${on ? 'border-brand-blue bg-brand-blue/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                      <div className="font-semibold text-sm">{s.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{s.desc}</div>
                    </button>
                  )
                })}
              </div>
              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setStep(3)} disabled={!journey} className="bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">Continue</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-2xl font-bold mb-1">What are you interested in?</h1>
              <p className="text-slate-400 text-sm mb-6">Pick everything that fits — you can choose more than one. We'll build your journey around it.</p>

              <p className="text-slate-300 text-sm font-semibold mb-2">Products</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                {products.map(o => {
                  const on = interests.includes(o.slug)
                  return (
                    <button key={o.slug} onClick={() => toggleInterest(o.slug)} className={`text-left p-3 rounded-lg border transition-colors ${on ? 'border-brand-blue bg-brand-blue/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{o.name}</span>
                        {o.price_hint && <span className="text-[11px] text-slate-400">{o.price_hint}</span>}
                      </div>
                      {o.summary && <p className="text-xs text-slate-400 mt-1">{o.summary}</p>}
                    </button>
                  )
                })}
              </div>

              <p className="text-slate-300 text-sm font-semibold mb-2">Services</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {services.map(o => {
                  const on = interests.includes(o.slug)
                  return (
                    <button key={o.slug} onClick={() => toggleInterest(o.slug)} className={`text-left p-3 rounded-lg border transition-colors ${on ? 'border-brand-blue bg-brand-blue/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{o.name}</span>
                        {o.price_hint && <span className="text-[11px] text-slate-400">{o.price_hint}</span>}
                      </div>
                      {o.summary && <p className="text-xs text-slate-400 mt-1">{o.summary}</p>}
                    </button>
                  )
                })}
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
              <div className="flex items-center gap-3 mt-6">
                <button onClick={finish} disabled={interests.length === 0 || loading} className="bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">
                  {loading ? 'Setting up…' : 'Finish & open my portal'}
                </button>
                <span className="text-slate-500 text-xs">{interests.length} selected</span>
                <button onClick={() => setStep(2)} className="text-slate-400 hover:text-white text-sm ml-auto">Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
