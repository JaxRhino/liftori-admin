import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const TIER_COLOR = {
  free:    { border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-600',      btn: 'bg-gray-700 hover:bg-gray-800' },
  preview: { border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700',  btn: 'bg-purple-600 hover:bg-purple-700' },
  starter: { border: 'border-sky-200',    badge: 'bg-sky-100 text-sky-700',        btn: 'bg-sky-500 hover:bg-sky-600' },
  growth:  { border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700',btn: 'bg-emerald-600 hover:bg-emerald-700' },
  scale:   { border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',    btn: 'bg-amber-500 hover:bg-amber-600' },
}

const TIER_LABEL = {
  free:    'Free',
  preview: 'Preview',
  starter: 'Starter',
  growth:  'Growth',
  scale:   'Scale',
}

export default function ChoosePlan() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [plans, setPlans]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null) // plan id
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => { fetchPlans() }, [])

  async function fetchPlans() {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      setPlans(data || [])
    } catch (err) {
      console.error('Error fetching plans:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleContinue() {
    if (!selected) { setError('Please select a plan to continue.'); return }
    setSaving(true)
    setError(null)
    try {
      // Check if customer already has a project in progress
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('id, plan_id, status')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const existing = existingProjects?.[0]

      if (existing && existing.status === 'Pending Estimate') {
        // Already submitted — go to dashboard
        navigate('/portal')
        return
      }

      if (existing && !existing.plan_id) {
        // Existing draft project — attach plan to it
        await supabase
          .from('projects')
          .update({ plan_id: selected })
          .eq('id', existing.id)
      } else if (!existing) {
        // Create a fresh draft project with the plan
        await supabase.from('projects').insert({
          customer_id: user.id,
          plan_id:     selected,
          status:      'Draft',
          name:        'My Project',
        })
      }

      // Navigate to wizard
      navigate('/portal/new-project')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Top bar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center gap-3">
        <span
          className="text-sky-400 font-bold text-xl tracking-widest"
          style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.12em' }}
        >
          LIFTORI
        </span>
        <span className="text-gray-500 text-sm">/ Choose Your Plan</span>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">

        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Choose Your Plan
          </h1>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Select the plan that matches your project. You can always start with a free prototype
            and upgrade later.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-xl mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className={`grid gap-4 ${
          plans.length <= 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto' :
          plans.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}>
          {plans.map(plan => {
            const theme  = TIER_COLOR[plan.price_tier] || TIER_COLOR.starter
            const isSelected = selected === plan.id
            const features = Array.isArray(plan.features) ? plan.features : []

            return (
              <button
                key={plan.id}
                onClick={() => { setSelected(plan.id); setError(null) }}
                className={`relative text-left rounded-2xl border-2 p-5 transition-all focus:outline-none ${
                  isSelected
                    ? `${theme.border} shadow-lg ring-2 ring-offset-2 ring-sky-400 bg-white`
                    : `border-gray-200 hover:border-gray-300 hover:shadow-md bg-white`
                }`}
              >
                {/* Selected check */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {/* Tier badge */}
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-3 ${theme.badge}`}>
                  {TIER_LABEL[plan.price_tier] || plan.price_tier}
                </span>

                {/* Name */}
                <h3 className="font-bold text-slate-900 text-base leading-snug mb-1">
                  {plan.name}
                </h3>

                {/* Description */}
                {plan.description && (
                  <p className="text-sm text-gray-500 leading-snug mb-3">
                    {plan.description}
                  </p>
                )}

                {/* Features */}
                {features.length > 0 && (
                  <ul className="space-y-1.5 mt-3">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-sky-500 shrink-0 mt-0.5">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            )
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={handleContinue}
            disabled={!selected || saving}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl text-base transition-colors min-w-48"
          >
            {saving ? 'Setting up…' : 'Continue →'}
          </button>
          <p className="text-xs text-gray-400 text-center max-w-sm">
            Not sure which plan to pick?{' '}
            <a
              href="mailto:hello@liftori.ai"
              className="text-sky-500 hover:underline"
            >
              Send us a message
            </a>{' '}
            and we'll help you choose.
          </p>
        </div>

      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 mt-8">
        Powered by{' '}
        <a href="https://liftori.ai" className="text-sky-500 hover:underline">Liftori</a>
        {' '}· Lift Your Idea
      </footer>
    </div>
  )
}
