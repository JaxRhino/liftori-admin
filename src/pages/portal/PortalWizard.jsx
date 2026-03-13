import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const STEPS = [
  { id: 1, title: 'Your Vision', subtitle: 'What do you want to build?' },
  { id: 2, title: 'Target Audience', subtitle: 'Who is this for?' },
  { id: 3, title: 'App Type', subtitle: 'What kind of product?' },
  { id: 4, title: 'Core Features', subtitle: 'What should it do?' },
  { id: 5, title: 'Design & Branding', subtitle: 'How should it look and feel?' },
  { id: 6, title: 'Pages & Content', subtitle: 'What pages or sections do you need?' },
  { id: 7, title: 'Business Context', subtitle: 'Tell us about your business' },
  { id: 8, title: 'Timeline & Budget', subtitle: 'When and how much?' },
  { id: 9, title: 'Review & Submit', subtitle: 'Confirm your project details' }
]

const APP_TYPES = [
  { value: 'Web App', icon: '🌐', desc: 'Browser-based application' },
  { value: 'Mobile App', icon: '📱', desc: 'iOS and/or Android app' },
  { value: 'Business Platform', icon: '🏢', desc: 'Full business operating system' },
  { value: 'E-Commerce', icon: '🛒', desc: 'Online store with payments' },
  { value: 'Dashboard', icon: '📊', desc: 'Data visualization & analytics' },
  { value: 'Marketplace', icon: '🤝', desc: 'Multi-vendor platform' }
]

const FEATURE_OPTIONS = [
  'User authentication & accounts',
  'Admin dashboard',
  'Payment processing',
  'Real-time messaging / chat',
  'Email notifications',
  'File uploads & storage',
  'Search & filtering',
  'Analytics & reporting',
  'API integrations',
  'AI / automation features',
  'Booking / scheduling',
  'Reviews & ratings',
  'Social features (follows, likes)',
  'Multi-language support',
  'Mobile-responsive design'
]

const DESIGN_VIBES = [
  { value: 'Modern & Minimal', desc: 'Clean lines, lots of whitespace, subtle animations' },
  { value: 'Bold & Vibrant', desc: 'Strong colors, large typography, high energy' },
  { value: 'Professional & Corporate', desc: 'Polished, trustworthy, enterprise feel' },
  { value: 'Playful & Creative', desc: 'Fun, colorful, unique personality' },
  { value: 'Dark & Sleek', desc: 'Dark mode first, techy, premium feel' },
  { value: 'Warm & Friendly', desc: 'Approachable, soft colors, inviting' }
]

const PAGE_OPTIONS = [
  'Homepage / Landing page',
  'About page',
  'Contact page',
  'Pricing page',
  'Product / Service listings',
  'User profile pages',
  'Settings / Account page',
  'Blog / Content section',
  'FAQ page',
  'Checkout / Cart',
  'Admin panel',
  'Customer portal / Dashboard'
]

const BUDGET_RANGES = [
  { value: '$2,500 \u2013 $5,000', tier: 'Starter' },
  { value: '$5,000 \u2013 $10,000', tier: 'Growth' },
  { value: '$10,000 \u2013 $25,000', tier: 'Scale' },
  { value: '$25,000+', tier: 'Enterprise' },
  { value: 'Not sure yet', tier: null }
]

const TIMELINES = [
  { value: 'ASAP (2-4 weeks)', desc: 'Fast-track delivery' },
  { value: '1-2 months', desc: 'Standard timeline' },
  { value: '2-3 months', desc: 'Complex build' },
  { value: 'Flexible', desc: 'No hard deadline' }
]

export default function PortalWizard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    // Step 1: Vision
    project_name: '',
    elevator_pitch: '',
    problem_solved: '',
    // Step 2: Audience
    target_audience: '',
    audience_type: '',
    industry: '',
    // Step 3: App Type
    app_type: '',
    // Step 4: Features
    features: [],
    custom_features: '',
    // Step 5: Design
    vibe: '',
    color_preference: '',
    reference_sites: '',
    // Step 6: Pages
    pages: [],
    custom_pages: '',
    integrations: '',
    // Step 7: Business
    business_stage: '',
    revenue_model: '',
    competitors: '',
    // Step 8: Timeline & Budget
    timeline: '',
    budget_range: '',
    launch_date: '',
    additional_notes: ''
  })

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleArrayItem(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }))
  }

  function canProceed() {
    switch (step) {
      case 1: return form.project_name.trim() && form.elevator_pitch.trim()
      case 2: return form.target_audience.trim()
      case 3: return form.app_type
      case 4: return form.features.length > 0 || form.custom_features.trim()
      case 5: return form.vibe
      case 6: return form.pages.length > 0
      case 7: return form.business_stage
      case 8: return form.budget_range && form.timeline
      case 9: return true
      default: return true
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      // Determine tier from budget
      const budgetEntry = BUDGET_RANGES.find(b => b.value === form.budget_range)
      const tier = budgetEntry?.tier || 'Starter'

      // Build features array
      const allFeatures = [
        ...form.features,
        ...form.custom_features.split('\n').map(f => f.trim()).filter(Boolean)
      ]

      // Build the brief text from wizard data
      const brief = [
        form.elevator_pitch,
        form.problem_solved && `Problem: ${form.problem_solved}`,
        form.target_audience && `Audience: ${form.target_audience} (${form.audience_type || 'General'})`,
        form.industry && `Industry: ${form.industry}`,
        form.reference_sites && `References: ${form.reference_sites}`,
        form.integrations && `Integrations: ${form.integrations}`,
        form.competitors && `Competitors: ${form.competitors}`,
        form.additional_notes && `Notes: ${form.additional_notes}`
      ].filter(Boolean).join('\n\n')

      // Create project
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          customer_id: user.id,
          name: form.project_name,
          project_type: form.app_type,
          status: 'Wizard Complete',
          tier: tier === 'Enterprise' ? 'Scale' : (tier || 'Starter'),
          brief,
          features: allFeatures,
          vibe: form.vibe,
          timeline_pref: form.timeline,
          budget_range: form.budget_range,
          progress: 0
        })
        .select()
        .single()

      if (projErr) throw projErr

      // Save full wizard data as wizard_submission
      const { error: wizErr } = await supabase
        .from('wizard_submissions')
        .insert({
          customer_id: user.id,
          project_id: project.id,
          step_data: form,
          completed: true,
          submitted_at: new Date().toISOString()
        })

      if (wizErr) console.error('Wizard submission save error:', wizErr)

      // Navigate to the project view
      navigate('/portal/project')
    } catch (err) {
      console.error('Submit error:', err)
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function renderStep() {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Project Name *</label>
              <input
                type="text"
                value={form.project_name}
                onChange={e => update('project_name', e.target.value)}
                placeholder="e.g., FitTrack Pro, Bloom Marketplace, QuickInvoice"
                className="input-field"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Elevator Pitch *</label>
              <textarea
                value={form.elevator_pitch}
                onChange={e => update('elevator_pitch', e.target.value)}
                placeholder="In 1-3 sentences, describe what you want to build and why it matters..."
                className="input-field min-h-[120px] resize-y"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">What problem does it solve?</label>
              <textarea
                value={form.problem_solved}
                onChange={e => update('problem_solved', e.target.value)}
                placeholder="What pain point or gap in the market are you addressing?"
                className="input-field min-h-[100px] resize-y"
                rows={3}
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Who is your target audience? *</label>
              <textarea
                value={form.target_audience}
                onChange={e => update('target_audience', e.target.value)}
                placeholder="Describe your ideal users \u2014 age, profession, habits, needs..."
                className="input-field min-h-[100px] resize-y"
                rows={3}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Audience Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['B2C (Consumers)', 'B2B (Businesses)', 'B2B2C (Both)', 'Internal Team'].map(type => (
                  <button
                    key={type}
                    onClick={() => update('audience_type', type)}
                    className={`p-3 rounded-lg border text-sm font-medium text-center transition-all ${
                      form.audience_type === type
                        ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                        : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Industry / Vertical</label>
              <input
                type="text"
                value={form.industry}
                onChange={e => update('industry', e.target.value)}
                placeholder="e.g., Fitness, E-commerce, Healthcare, Real Estate..."
                className="input-field"
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Select the type that best describes your project *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {APP_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => update('app_type', type.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    form.app_type === type.value
                      ? 'border-brand-blue bg-brand-blue/10'
                      : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <p className={`font-medium ${form.app_type === type.value ? 'text-brand-blue' : 'text-white'}`}>
                        {type.value}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Select all features you need *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEATURE_OPTIONS.map(feat => (
                  <button
                    key={feat}
                    onClick={() => toggleArrayItem('features', feat)}
                    className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-3 ${
                      form.features.includes(feat)
                        ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                        : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                      form.features.includes(feat) ? 'bg-brand-blue' : 'border border-navy-500'
                    }`}>
                      {form.features.includes(feat) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    {feat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Any other features? (one per line)</label>
              <textarea
                value={form.custom_features}
                onChange={e => update('custom_features', e.target.value)}
                placeholder="Describe any custom features not listed above..."
                className="input-field min-h-[80px] resize-y"
                rows={3}
              />
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Pick a design vibe *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DESIGN_VIBES.map(v => (
                  <button
                    key={v.value}
                    onClick={() => update('vibe', v.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      form.vibe === v.value
                        ? 'border-brand-blue bg-brand-blue/10'
                        : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                    }`}
                  >
                    <p className={`font-medium text-sm ${form.vibe === v.value ? 'text-brand-blue' : 'text-white'}`}>
                      {v.value}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{v.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Color preferences</label>
              <input
                type="text"
                value={form.color_preference}
                onChange={e => update('color_preference', e.target.value)}
                placeholder="e.g., Blues and whites, Earth tones, Bright and colorful, Match my brand..."
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Any reference sites you like?</label>
              <textarea
                value={form.reference_sites}
                onChange={e => update('reference_sites', e.target.value)}
                placeholder="Paste URLs of websites or apps whose design you admire..."
                className="input-field min-h-[80px] resize-y"
                rows={3}
              />
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Select pages / sections you need *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PAGE_OPTIONS.map(pg => (
                  <button
                    key={pg}
                    onClick={() => toggleArrayItem('pages', pg)}
                    className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-3 ${
                      form.pages.includes(pg)
                        ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                        : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                      form.pages.includes(pg) ? 'bg-brand-blue' : 'border border-navy-500'
                    }`}>
                      {form.pages.includes(pg) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    {pg}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Additional pages (one per line)</label>
              <textarea
                value={form.custom_pages}
                onChange={e => update('custom_pages', e.target.value)}
                placeholder="Any other pages or sections..."
                className="input-field resize-y"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Third-party integrations needed?</label>
              <textarea
                value={form.integrations}
                onChange={e => update('integrations', e.target.value)}
                placeholder="e.g., Stripe payments, Google Maps, Mailchimp, Shopify, QuickBooks..."
                className="input-field resize-y"
                rows={2}
              />
            </div>
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Business stage *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'Just an idea', desc: 'I have a concept but no business yet' },
                  { value: 'Side project', desc: 'Working on it alongside my day job' },
                  { value: 'New business', desc: 'Recently launched or launching soon' },
                  { value: 'Established business', desc: 'Operating business adding a digital product' }
                ].map(stage => (
                  <button
                    key={stage.value}
                    onClick={() => update('business_stage', stage.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      form.business_stage === stage.value
                        ? 'border-brand-blue bg-brand-blue/10'
                        : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                    }`}
                  >
                    <p className={`font-medium text-sm ${form.business_stage === stage.value ? 'text-brand-blue' : 'text-white'}`}>
                      {stage.value}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{stage.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">How will this make money?</label>
              <input
                type="text"
                value={form.revenue_model}
                onChange={e => update('revenue_model', e.target.value)}
                placeholder="e.g., Subscriptions, One-time sales, Marketplace commissions, Ads..."
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Who are your competitors?</label>
              <textarea
                value={form.competitors}
                onChange={e => update('competitors', e.target.value)}
                placeholder="Name any existing products or companies doing something similar..."
                className="input-field resize-y"
                rows={2}
              />
            </div>
          </div>
        )

      case 8:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Timeline *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TIMELINES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => update('timeline', t.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      form.timeline === t.value
                        ? 'border-brand-blue bg-brand-blue/10'
                        : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                    }`}
                  >
                    <p className={`font-medium text-sm ${form.timeline === t.value ? 'text-brand-blue' : 'text-white'}`}>
                      {t.value}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Budget range *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BUDGET_RANGES.map(b => (
                  <button
                    key={b.value}
                    onClick={() => update('budget_range', b.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      form.budget_range === b.value
                        ? 'border-brand-blue bg-brand-blue/10'
                        : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                    }`}
                  >
                    <p className={`font-medium text-sm ${form.budget_range === b.value ? 'text-brand-blue' : 'text-white'}`}>
                      {b.value}
                    </p>
                    {b.tier && <p className="text-xs text-gray-500 mt-0.5">{b.tier} Tier</p>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Target launch date</label>
              <input
                type="date"
                value={form.launch_date}
                onChange={e => update('launch_date', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Anything else we should know?</label>
              <textarea
                value={form.additional_notes}
                onChange={e => update('additional_notes', e.target.value)}
                placeholder="Special requirements, constraints, context..."
                className="input-field resize-y"
                rows={3}
              />
            </div>
          </div>
        )

      case 9:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">Review your project details before submitting.</p>

            <ReviewSection title="Vision">
              <ReviewItem label="Project Name" value={form.project_name} />
              <ReviewItem label="Pitch" value={form.elevator_pitch} />
              {form.problem_solved && <ReviewItem label="Problem" value={form.problem_solved} />}
            </ReviewSection>

            <ReviewSection title="Audience & Type">
              <ReviewItem label="Target Audience" value={form.target_audience} />
              {form.audience_type && <ReviewItem label="Type" value={form.audience_type} />}
              {form.industry && <ReviewItem label="Industry" value={form.industry} />}
              <ReviewItem label="App Type" value={form.app_type} />
            </ReviewSection>

            <ReviewSection title="Features & Design">
              {form.features.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.features.map(f => (
                      <span key={f} className="text-xs bg-navy-700 text-gray-300 px-2 py-1 rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              <ReviewItem label="Design Vibe" value={form.vibe} />
              {form.color_preference && <ReviewItem label="Colors" value={form.color_preference} />}
            </ReviewSection>

            <ReviewSection title="Pages">
              {form.pages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.pages.map(p => (
                    <span key={p} className="text-xs bg-navy-700 text-gray-300 px-2 py-1 rounded-full">{p}</span>
                  ))}
                </div>
              )}
            </ReviewSection>

            <ReviewSection title="Business & Budget">
              <ReviewItem label="Stage" value={form.business_stage} />
              {form.revenue_model && <ReviewItem label="Revenue Model" value={form.revenue_model} />}
              <ReviewItem label="Timeline" value={form.timeline} />
              <ReviewItem label="Budget" value={form.budget_range} />
            </ReviewSection>

            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Start Your Project</h1>
        <p className="text-gray-400 text-sm mt-1">Tell us about your idea and we'll bring it to life</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Step {step} of {STEPS.length}</span>
          <span>{Math.round((step / STEPS.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-blue rounded-full transition-all duration-500"
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">{STEPS[step - 1].title}</h2>
        <p className="text-sm text-gray-400">{STEPS[step - 1].subtitle}</p>
      </div>

      {/* Step content */}
      <div className="card mb-6">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step === 1 ? navigate('/portal') : setStep(step - 1)}
          className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
        >
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < 9 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="px-6 py-2.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-brand-blue/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 py-2.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-brand-blue/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Project'
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function ReviewSection({ title, children }) {
  return (
    <div className="p-4 rounded-lg bg-navy-800/50 border border-navy-700/50">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

function ReviewItem({ label, value }) {
  if (!value) return null
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  )
}
