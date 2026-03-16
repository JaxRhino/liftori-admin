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

const BOOK_STEPS = {
  4: { title: 'Your Path', subtitle: 'How can we help with your book?' },
  5: { title: 'Book Details', subtitle: 'Tell us about your book' },
  6: { title: 'Your Story', subtitle: 'The heart of your project' },
  7: { title: 'Cover & Publishing', subtitle: 'How it looks and where it goes' },
}

function getStepInfo(step, appType) {
  if (appType === 'Book Writing App' && BOOK_STEPS[step]) return BOOK_STEPS[step]
  return STEPS[step - 1]
}

const APP_TYPES = [
  { value: 'Web App', icon: '🌐', desc: 'Browser-based application' },
  { value: 'Mobile App', icon: '📱', desc: 'iOS and/or Android app' },
  { value: 'Business Platform', icon: '🏢', desc: 'Full business operating system' },
  { value: 'E-Commerce', icon: '🛒', desc: 'Online store with payments' },
  { value: 'Dashboard', icon: '📊', desc: 'Data visualization & analytics' },
  { value: 'Marketplace', icon: '🤝', desc: 'Multi-vendor platform' },
  { value: 'Book Writing App', icon: '📚', desc: 'AI-guided book creation & publishing' },
]

const BOOK_PATHS = [
  { value: 'Write a New Book', icon: '✍️', desc: 'Start from scratch — AI guides you through every step' },
  { value: 'Finish & Publish', icon: '📖', desc: 'Pick up where you left off and get it published' },
]

const BOOK_GENRES = [
  'Fantasy', 'Science Fiction', 'Romance', 'Mystery / Thriller', 'Horror',
  'Historical Fiction', 'Literary Fiction', 'Self-Help', 'Business',
  'Memoir / Biography', 'True Crime', 'Health & Wellness', 'Parenting',
  'Spirituality', "Children's", 'Young Adult', 'Other'
]

const COVER_STYLES = [
  { value: 'Modern & Minimal', desc: 'Clean, typography-forward design' },
  { value: 'Illustrated', desc: 'Hand-drawn or digital art' },
  { value: 'Photo-based', desc: 'Real photography with text overlay' },
  { value: 'Dark & Atmospheric', desc: 'Moody tones, dramatic imagery' },
  { value: 'Bright & Colorful', desc: 'Bold colors, eye-catching' },
  { value: 'Classic & Elegant', desc: 'Timeless, literary feel' },
]

const PUBLISHING_GOALS = [
  { value: 'Self-Publish (Amazon KDP, IngramSpark)', desc: 'Full control, faster to market' },
  { value: 'Traditional Publishing', desc: 'Query agents and major publishing houses' },
  { value: 'Personal Project', desc: 'For myself, friends, or family' },
  { value: 'Not Sure Yet', desc: "I'll figure that out later" },
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
  'Homepage / Landing page', 'About page', 'Contact page', 'Pricing page',
  'Product / Service listings', 'User profile pages', 'Settings / Account page',
  'Blog / Content section', 'FAQ page', 'Checkout / Cart', 'Admin panel',
  'Customer portal / Dashboard'
]

const BUDGET_RANGES = [
  { value: '$2,500 – $5,000', tier: 'Starter' },
  { value: '$5,000 – $10,000', tier: 'Growth' },
  { value: '$10,000 – $25,000', tier: 'Scale' },
  { value: '$25,000+', tier: 'Enterprise' },
  { value: 'Not sure yet', tier: null }
]

const TIMELINES = [
  { value: 'ASAP (2-4 weeks)', desc: 'Fast-track delivery' },
  { value: '1-2 months', desc: 'Standard timeline' },
  { value: '2-3 months', desc: 'Complex build' },
  { value: 'Flexible', desc: 'No hard deadline' }
]

const BOOK_BUDGET_RANGES = [
  { value: '$99 – $299', tier: 'Starter Kit', desc: 'Self-serve template + AI prompts' },
  { value: '$1,500 – $2,500', tier: 'Starter', desc: 'Custom book writing app' },
  { value: '$3,000 – $5,000', tier: 'Growth', desc: 'Full platform — series, AI assistant, cover art' },
  { value: 'Not sure yet', tier: null, desc: 'Help me figure it out' }
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
    // Step 4: Features (generic) or Book Path (book)
    features: [],
    custom_features: '',
    book_path: '',           // 'Write a New Book' | 'Finish & Publish'
    // Step 5: Design (generic) or Book Details (book)
    vibe: '',
    color_preference: '',
    reference_sites: '',
    book_title: '',
    book_genre: '',
    book_type: '',           // 'Fiction' | 'Non-Fiction'
    book_series: '',         // 'Single Book' | 'Part of a Series'
    series_name: '',
    // Step 6: Pages (generic) or Your Story (book)
    pages: [],
    custom_pages: '',
    integrations: '',
    synopsis: '',
    manuscript_status: '',   // For Finish & Publish
    estimated_chapters: '',
    estimated_length: '',
    // Step 7: Business (generic) or Cover & Publishing (book)
    business_stage: '',
    revenue_model: '',
    competitors: '',
    cover_style: '',
    cover_color_preference: '',
    reference_covers: '',
    publishing_goal: '',
    // Step 8: Timeline & Budget
    timeline: '',
    budget_range: '',
    launch_date: '',
    additional_notes: ''
  })

  const isBook = form.app_type === 'Book Writing App'

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
      case 4:
        if (isBook) return form.book_path !== ''
        return form.features.length > 0 || form.custom_features.trim()
      case 5:
        if (isBook) return form.book_title.trim() && form.book_genre && form.book_type && form.book_series
        return form.vibe
      case 6:
        if (isBook) return form.synopsis.trim()
        return form.pages.length > 0
      case 7:
        if (isBook) return form.publishing_goal
        return form.business_stage
      case 8: return form.budget_range && form.timeline
      case 9: return true
      default: return true
    }
  }

  async function handleSubmit() {
    // Guard: session may have expired between page load and submit
    if (!user?.id) {
      setError('Your session has expired. Please refresh the page and log in again.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const budgetEntry = BUDGET_RANGES.concat(BOOK_BUDGET_RANGES).find(b => b.value === form.budget_range)
      const tier = budgetEntry?.tier || 'Starter'

      let allFeatures = []
      let brief = ''

      if (isBook) {
        allFeatures = [
          `Book Path: ${form.book_path}`,
          `Genre: ${form.book_genre}`,
          `Type: ${form.book_type}`,
          `Format: ${form.book_series}`,
          form.series_name ? `Series: ${form.series_name}` : null,
          form.publishing_goal ? `Publishing Goal: ${form.publishing_goal}` : null,
          form.cover_style ? `Cover Style: ${form.cover_style}` : null,
        ].filter(Boolean)

        brief = [
          form.elevator_pitch,
          `Book: "${form.book_title}" — ${form.book_type} / ${form.book_genre}`,
          form.book_series === 'Part of a Series' && form.series_name ? `Series: ${form.series_name}` : null,
          `Path: ${form.book_path}`,
          form.manuscript_status ? `Manuscript Status: ${form.manuscript_status}` : null,
          form.synopsis ? `Synopsis: ${form.synopsis}` : null,
          form.estimated_chapters ? `Estimated Chapters: ${form.estimated_chapters}` : null,
          form.estimated_length ? `Estimated Length: ${form.estimated_length}` : null,
          form.publishing_goal ? `Publishing Goal: ${form.publishing_goal}` : null,
          form.cover_style ? `Cover Style: ${form.cover_style}` : null,
          form.reference_covers ? `Reference Covers: ${form.reference_covers}` : null,
          form.target_audience ? `Target Reader: ${form.target_audience}` : null,
          form.additional_notes ? `Notes: ${form.additional_notes}` : null,
        ].filter(Boolean).join('\n\n')
      } else {
        allFeatures = [
          ...form.features,
          ...form.custom_features.split('\n').map(f => f.trim()).filter(Boolean)
        ]
        brief = [
          form.elevator_pitch,
          form.problem_solved && `Problem: ${form.problem_solved}`,
          form.target_audience && `Audience: ${form.target_audience} (${form.audience_type || 'General'})`,
          form.industry && `Industry: ${form.industry}`,
          form.reference_sites && `References: ${form.reference_sites}`,
          form.integrations && `Integrations: ${form.integrations}`,
          form.competitors && `Competitors: ${form.competitors}`,
          form.additional_notes && `Notes: ${form.additional_notes}`
        ].filter(Boolean).join('\n\n')
      }

      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          customer_id: user.id,
          name: isBook ? (form.book_title || form.project_name) : form.project_name,
          project_type: form.app_type,
          status: 'Wizard Complete',
          tier: tier === 'Enterprise' ? 'Scale' : (tier || 'Starter'),
          brief,
          features: allFeatures,
          vibe: isBook ? form.cover_style : form.vibe,
          timeline_pref: form.timeline,
          budget_range: form.budget_range,
          progress: 0
        })
        .select()
        .single()

      if (projErr) throw projErr

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
      // ─── STEP 1: VISION (same for all) ───────────────────────────────────────
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Project Name *</label>
              <input
                type="text"
                value={form.project_name}
                onChange={e => update('project_name', e.target.value)}
                placeholder="e.g., FitTrack Pro, The Last Lighthouse, QuickInvoice"
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
                placeholder="What pain point or gap are you addressing?"
                className="input-field min-h-[100px] resize-y"
                rows={3}
              />
            </div>
          </div>
        )

      // ─── STEP 2: AUDIENCE (same for all) ──────────────────────────────────────
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isBook ? 'Who is your target reader? *' : 'Who is your target audience? *'}
              </label>
              <textarea
                value={form.target_audience}
                onChange={e => update('target_audience', e.target.value)}
                placeholder={isBook
                  ? 'Describe your ideal reader — age, interests, what they love to read...'
                  : 'Describe your ideal users — age, profession, habits, needs...'}
                className="input-field min-h-[100px] resize-y"
                rows={3}
                autoFocus
              />
            </div>
            {!isBook && (
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
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isBook ? 'Genre' : 'Industry / Vertical'}
              </label>
              <input
                type="text"
                value={form.industry}
                onChange={e => update('industry', e.target.value)}
                placeholder={isBook
                  ? 'e.g., Fantasy, Romance, Business, Self-Help...'
                  : 'e.g., Fitness, E-commerce, Healthcare, Real Estate...'}
                className="input-field"
              />
            </div>
          </div>
        )

      // ─── STEP 3: APP TYPE ──────────────────────────────────────────────────────
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
                      ? type.value === 'Book Writing App'
                        ? 'border-amber-400 bg-amber-400/10'
                        : 'border-brand-blue bg-brand-blue/10'
                      : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <p className={`font-medium ${
                        form.app_type === type.value
                          ? type.value === 'Book Writing App' ? 'text-amber-400' : 'text-brand-blue'
                          : 'text-white'
                      }`}>
                        {type.value}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
                    </div>
                    {type.value === 'Book Writing App' && (
                      <span className="ml-auto text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">NEW</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )

      // ─── STEP 4: FEATURES (generic) or BOOK PATH ──────────────────────────────
      case 4:
        if (isBook) {
          return (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">How can we help with your book? *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {BOOK_PATHS.map(path => (
                  <button
                    key={path.value}
                    onClick={() => update('book_path', path.value)}
                    className={`p-6 rounded-xl border text-left transition-all ${
                      form.book_path === path.value
                        ? 'border-amber-400 bg-amber-400/10'
                        : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                    }`}
                  >
                    <div className="text-3xl mb-3">{path.icon}</div>
                    <p className={`font-semibold text-base ${form.book_path === path.value ? 'text-amber-400' : 'text-white'}`}>
                      {path.value}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{path.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )
        }
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
              <label className="block text-sm font-medium text-gray-300 mb-2">Any other "features? (one per line)</label>
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

      // ─── STEP 5: DESIGN (generic) or BOOK DETAILS ─────────────────────────────
      case 5:
        if (isBook) {
          return (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Book Title *</label>
                <input
                  type="text"
                  value={form.book_title}
                  onChange={e => update('book_title', e.target.value)}
                  placeholder="Working title is fine — you can change it later"
                  className="input-field"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Fiction or Non-Fiction? *</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Fiction', 'Non-Fiction'].map(type => (
                    <button
                      key={type}
                      onClick={() => update('book_type', type)}
                      className={`p-4 rounded-lg border text-center font-medium transition-all ${
                        form.book_type === type
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                          : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Genre *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BOOK_GENRES.map(genre => (
                    <button
                      key={genre}
                      onClick={() => update('book_genre', genre)}
                      className={`p-2.5 rounded-lg border text-sm text-center transition-all ${
                        form.book_genre === genre
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                          : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Single book or part of a series? *</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Single Book', 'Part of a Series'].map(s => (
                    <button
                      key={s}
                      onClick={() => update('book_series', s)}
                      className={`p-4 rounded-lg border text-center font-medium transition-all ${
                        form.book_series === s
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                          : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {form.book_series === 'Part of a Series' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Series Name</label>
                  <input
                    type="text"
                    value={form.series_name}
                    onChange={e => update('series_name', e.target.value)}
                    placeholder="e.g., The Ember Chronicles, Book 1 of 3"
                    className="input-field"
                  />
                </div>
              )}
            </div>
          )
        }
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
                    <p className={`font-medium text-sm ${form.vibe === v.value ? 'text-brand-blue' : 'text-white'}`}>{v.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{v.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Color preferences</label>
              <input type="text" value={form.color_preference} onChange={e => update('color_preference', e.target.value)}
                placeholder="e.g., Blues and whites, Earth tones, Match my brand..." className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Any reference sites you like?</label>
              <textarea value={form.reference_sites} onChange={e => update('reference_sites', e.target.value)}
                placeholder="Paste URLs of websites or apps whose design you admire..." className="input-field min-h-[80px] resize-y" rows={3} />
            </div>
          </div>
        )

      // ─── STEP 6: PAGES (generic) or YOUR STORY ────────────────────────────────
      case 6:
        if (isBook) {
          return (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {form.book_path === 'Finish & Publish' ? 'Where are you in your manuscript? *' : 'What is your book about? *'}
                </label>
                <textarea
                  value={form.synopsis}
                  onChange={e => update('synopsis', e.target.value)}
                  placeholder={form.book_path === 'Finish & Publish'
                    ? 'Describe where you are — how many chapters done, what still needs writing, what you need help with...'
                    : 'Give us a synopsis or concept — even a rough idea works. This helps us build the right writing tools for your story.'}
                  className="input-field min-h-[140px] resize-y"
                  rows={5}
                  autoFocus
                />
              </div>

              {form.book_path === 'Finish & Publish' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Current manuscript status</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: 'Partial draft (under 50%)', desc: 'Just getting started' },
                      { value: 'Halfway there (50-75%)', desc: 'Good progress, need to finish' },
                      { value: 'Nearly done (75-99%)', desc: 'Final stretch' },
                      { value: 'Complete, needs editing', desc: 'First draft done' },
                    ].map(s => (
                      <button key={s.value} onClick={() => update('manuscript_status', s.value)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          form.manuscript_status === s.value
                            ? 'border-amber-400 bg-amber-400/10'
                            : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                        }`}
                      >
                        <p className={`font-medium text-sm ${form.manuscript_status === s.value ? 'text-amber-400' : 'text-white'}`}>{s.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Estimated chapters</label>
                  <input type="text" value={form.estimated_chapters} onChange={e => update('estimated_chapters', e.target.value)}
                    placeholder="e.g., 20, Not sure" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Estimated length</label>
                  <input type="text" value={form.estimated_length} onChange={e => update('estimated_length', e.target.value)}
                    placeholder="e.g., 80,000 words, 300 pages" className="input-field" />
                </div>
              </div>
            </div>
          )
        }
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Select pages / sections you need *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PAGE_OPTIONS.map(pg => (
                  <button key={pg} onClick={() => toggleArrayItem('pages', pg)}
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
              <textarea value={form.custom_pages} onChange={e => update('custom_pages', e.target.value)}
                placeholder="Any other pages or sections..." className="input-field resize-y" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Third-party integrations needed?</label>
              <textarea value={form.integrations} onChange={e => update('integrations', e.target.value)}
                placeholder="e.g., Stripe payments, Google Maps, Mailchimp, Shopify..." className="input-field resize-y" rows={2} />
            </div>
          </div>
        )

      // ─── STEP 7: BUSINESS (generic) or COVER & PUBLISHING ─────────────────────
      case 7:
        if (isBook) {
          return (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-400 mb-3">Cover style *</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {COVER_STYLES.map(s => (
                    <button key={s.value} onClick={() => update('cover_style', s.value)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        form.cover_style === s.value
                          ? 'border-amber-400 bg-amber-400/10'
                          : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                      }`}
                    >
                      <p className={`font-medium text-sm ${form.cover_style === s.value ? 'text-amber-400' : 'text-white'}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cover color palette</label>
                <input type="text" value={form.cover_color_preference} onChange={e => update('cover_color_preference', e.target.value)}
                  placeholder="e.g., Deep blues and golds, Muted pastels, Black and red..." className="input-field" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Reference covers you love</label>
                <textarea value={form.reference_covers} onChange={e => update('reference_covers', e.target.value)}
                  placeholder="Name any book covers whose style you admire — titles, authors, or describe them..." className="input-field resize-y" rows={2} />
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-3">Publishing goal *</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PUBLISHING_GOALS.map(g => (
                    <button key={g.value} onClick={() => update('publishing_goal', g.value)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        form.publishing_goal === g.value
                          ? 'border-amber-400 bg-amber-400/10'
                          : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                      }`}
                    >
                      <p className={`font-medium text-sm ${form.publishing_goal === g.value ? 'text-amber-400' : 'text-white'}`}>{g.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{g.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        }
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
                  <button key={stage.value} onClick={() => update('business_stage', stage.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      form.business_stage === stage.value
                        ? 'border-brand-blue bg-brand-blue/10'
                        : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                    }`}
                  >
                    <p className={`font-medium text-sm ${form.business_stage === stage.value ? 'text-brand-blue' : 'text-white'}`}>{stage.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stage.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">How will this make money?</label>
              <input type="text" value={form.revenue_model} onChange={e => update('revenue_model', e.target.value)}
                placeholder="e.g., Subscriptions, One-time sales, Marketplace commissions, Ads..." className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Who are your competitors?</label>
              <textarea value={form.competitors} onChange={e => update('competitors', e.target.value)}
                placeholder="Name any existing products or companies doing something similar..." className="input-field resize-y" rows={2} />
            </div>
          </div>
        )

      // ─── STEP 8: TIMELINE & BUDGET (book-aware) ────────────────────────────────
      case 8:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Timeline *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TIMELINES.map(t => (
                  <button key={t.value} onClick={() => update('timeline', t.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      form.timeline === t.value
                        ? isBook ? 'border-amber-400 bg-amber-400/10' : 'border-brand-blue bg-brand-blue/10'
                        : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                    }`}
                  >
                    <p className={`font-medium text-sm ${
                      form.timeline === t.value ? (isBook ? 'text-amber-400' : 'text-brand-blue') : 'text-white'
                    }`}>{t.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Budget range *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(isBook ? BOOK_BUDGET_RANGES : BUDGET_RANGES).map(b => (
                  <button key={b.value} onClick={() => update('budget_range', b.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      form.budget_range === b.value
                        ? isBook ? 'border-amber-400 bg-amber-400/10' : 'border-brand-blue bg-brand-blue/10'
                        : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                    }`}
                  >
                    <p className={`font-medium text-sm ${
                      form.budget_range === b.value ? (isBook ? 'text-amber-400' : 'text-brand-blue') : 'text-white'
                    }`}>{b.value}</p>
                    {b.tier && <p className="text-xs text-gray-500 mt-0.5">{b.tier}{b.desc ? ` — ${b.desc}` : ''}</p>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Target launch / completion date</label>
              <input type="date" value={form.launch_date} onChange={e => update('launch_date', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Anything else we should know?</label>
              <textarea value={form.additional_notes} onChange={e => update('additional_notes', e.target.value)}
                placeholder="Special requirements, constraints, context..." className="input-field resize-y" rows={3} />
            </div>
          </div>
        )

      // ─── STEP 9: REVIEW ────────────────────────────────────────────────────────
      case 9:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">Review your details before submitting.</p>

            <ReviewSection title="Vision">
              <ReviewItem label="Project Name" value={isBook ? form.book_title || form.project_name : form.project_name} />
              <ReviewItem label="Pitch" value={form.elevator_pitch} />
              {form.problem_solved && <ReviewItem label="Problem" value={form.problem_solved} />}
            </ReviewSection>

            <ReviewSection title={isBook ? 'Reader & Audience' : 'Audience & Type'}>
              <ReviewItem label={isBook ? 'Target Reader' : 'Target Audience'} value={form.target_audience} />
              {!isBook && form.audience_type && <ReviewItem label="Type" value={form.audience_type} />}
              {form.industry && <ReviewItem label={isBook ? 'Genre / Category' : 'Industry'} value={form.industry} />}
              <ReviewItem label="App Type" value={form.app_type} />
            </ReviewSection>

            {isBook ? (
              <>
                <ReviewSection title="Book Details">
                  <ReviewItem label="Title" value={form.book_title} />
                  <ReviewItem label="Type" value={form.book_type} />
                  <ReviewItem label="Genre" value={form.book_genre} />
                  <ReviewItem label="Format" value={form.book_series} />
                  {form.series_name && <ReviewItem label="Series Name" value={form.series_name} />}
                  <ReviewItem label="Path" value={form.book_path} />
                  {form.manuscript_status && <ReviewItem label="Manuscript Status" value={form.manuscript_status} />}
                </ReviewSection>
                <ReviewSection title="Story">
                  <ReviewItem label="Synopsis" value={form.synopsis} />
                  {form.estimated_chapters && <ReviewItem label="Est. Chapters" value={form.estimated_chapters} />}
                  {form.estimated_length && <ReviewItem label="Est. Length" value={form.estimated_length} />}
                </ReviewSection>
                <ReviewSection title="Cover & Publishing">
                  <ReviewItem label="Cover Style" value={form.cover_style} />
                  {form.cover_color_preference && <ReviewItem label="Color Palette" value={form.cover_color_preference} />}
                  <ReviewItem label="Publishing Goal" value={form.publishing_goal} />
                </ReviewSection>
              </>
            ) : (
              <>
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
              </>
            )}

            <ReviewSection title="Timeline & Budget">
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

  const stepInfo = getStepInfo(step, form.app_type)

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {isBook ? '📚 Book Writing App' : 'Start Your Project'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {isBook
            ? "Tell us about your book and we'll build you a custom writing platform"
            : "Tell us about your idea and we'll bring it to life"}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Step {step} of {STEPS.length}</span>
          <span>{Math.round((step / STEPS.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isBook ? 'bg-amber-400' : 'bg-brand-blue'}`}
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">{stepInfo.title}</h2>
        <p className="text-sm text-gray-400">{stepInfo.subtitle}</p>
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
            className={`px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              isBook ? 'bg-amber-500 hover:bg-amber-400' : 'bg-brand-blue hover:bg-brand-blue/90'
            }`}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-8 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
              isBook ? 'bg-amber-500 hover:bg-amber-400' : 'bg-brand-blue hover:bg-brand-blue/90'
            }`}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              isBook ? 'Submit My Book Project' : 'Submit Project'
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

const BOOK_STEPS = {
  4: { title: 'Your Path', subtitle: 'How can we help with your book?' },
  5: { title: 'Book Details', subtitle: 'Tell us about your book' },
  6: { title: 'Your Story', subtitle: 'The heart of your project' },
  7: { title: 'Cover & Publishing', subtitle: 'How it looks and where it goes' },
}

function getStepInfo(step, appType) {
  if (appType === 'Book Writing App' && BOOK_STEPS[step]) return BOOK_STEPS[step]
  return STEPS[step - 1]
}

const APP_TYPES = [
  { value: 'Web App', icon: '🌐', desc: 'Browser-based application' },
  { value: 'Mobile App', icon: '📱', desc: 'iOS and/or Android app' },
  { value: 'Business Platform', icon: '🏢', desc: 'Full business operating system' },
  { value: 'E-Commerce', icon: '🛒', desc: 'Online store with payments' },
  { value: 'Dashboard', icon: '📊', desc: 'Data visualization & analytics' },
  { value: 'Marketplace', icon: '🤝', desc: 'Multi-vendor platform' },
  { value: 'Book Writing App', icon: '📚', desc: 'AI-guided book creation & publishing' },
]

const BOOK_PATHS = [
  { value: 'Write a New Book', icon: '✍️', desc: 'Start from scratch — AI guides you through every step' },
  { value: 'Finish & Publish', icon: '📖', desc: 'Pick up where you left off and get it published' },
]

const BOOK_GENRES = [
  'Fantasy', 'Science Fiction', 'Romance', 'Mystery / Thriller', 'Horror',
  'Historical Fiction', 'Literary Fiction', 'Self-Help', 'Business',
  'Memoir / Biography', 'True Crime', 'Health & Wellness', 'Parenting',
  'Spirituality', "Children's", 'Young Adult', 'Other'
]

const COVER_STYLES = [
  { value: 'Modern & Minimal', desc: 'Clean, typography-forward design' },
  { value: 'Illustrated', desc: 'Hand-drawn or digital art' },
  { value: 'Photo-based', desc: 'Real photography with text overlay' },
  { value: 'Dark & Atmospheric', desc: 'Moody tones, dramatic imagery' },
  { value: 'Bright & Colorful', desc: 'Bold colors, eye-catching' },
  { value: 'Classic & Elegant', desc: 'Timeless, literary feel' },
]

const PUBLISHING_GOALS = [
  { value: 'Self-Publish (Amazon KDP, IngramSpark)', desc: 'Full control, faster to market' },
  { value: 'Traditional Publishing', desc: 'Query agents and major publishing houses' },
  { value: 'Personal Project', desc: 'For myself, friends, or family' },
  { value: 'Not Sure Yet', desc: "I'll figure that out later" },
]

const FEATURE_OPTIONS = [
  'User authentication & accounts',
  'Admin dashboard',
  'Payment processing',
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
  'Homepage / Landing page', 'About page', 'Contact page', 'Pricing page',
  'Product / Service listings', 'User profile pages', 'Settings / Account page',
  'Blog / Content section', 'FAQ page', 'Checkout / Cart', 'Admin panel',
  'Customer portal / Dashboard'
]

const BUDGET_RANGES = [
  { value: '$2,500 – $5,000', tier: 'Starter' },
  { value: '$5,000 – $10,000', tier: 'Growth' },
  { value: '$10,000 – $25,000', tier: 'Scale' },
  { value: '$25,000+', tier: 'Enterprise' },
  { value: 'Not sure yet', tier: null }
]

const TIMELINES = [
  { value: 'ASAP (2-4 weeks)', desc: 'Fast-track delivery' },
  { value: '1-2 months', desc: 'Standard timeline' },
  { value: '2-3 months', desc: 'Complex build' },
  { value: 'Flexible', desc: 'No hard deadline' }
]

const BOOK_BUDGET_RANGES = [
  { value: '$99 – $299', tier: 'Starter Kit', desc: 'Self-serve template + AI prompts' },
  { value: '$1,500 – $2,500', tier: 'Starter', desc: 'Custom book writing app' },
  { value: '$3,000 – $5,000', tier: 'Growth', desc: 'Full platform — series, AI assistant, cover art' },
  { value: 'Not sure yet', tier: null, desc: 'Help me figure it out' }
]

export default function PortalWizard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    project_name: '',
    elevator_pitch: '',
    problem_solved: '',
    target_audience: '',
    audience_type: '',
    industry: '',
    app_type: '',
    features: [],
    custom_features: '',
    book_path: '',
    vibe: '',
    color_preference: '',
    reference_sites: '',
    book_title: '',
    book_genre: '',
    book_type: '',
    book_series: '',
    series_name: '',
    pages: [],
    custom_pages: '',
    integrations: '',
    synopsis: '',
    manuscript_status: '',
    estimated_chapters: '',
    estimated_length: '',
    business_stage: '',
    revenue_model: '',
    competitors: '',
    cover_style: '',
    cover_color_preference: '',
    reference_covers: '',
    publishing_goal: '',
    timeline: '',
    budget_range: '',
    launch_date: '',
    additional_notes: ''
  })

  const isBook = form.app_type === 'Book Writing App'

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
      case 4:
        if (isBook) return form.book_path !== ''
        return form.features.length > 0 || form.custom_features.trim()
      case 5:
        if (isBook) return form.book_title.trim() && form.book_genre && form.book_type && form.book_series
        return form.vibe
      case 6:
        if (isBook) return form.synopsis.trim()
        return form.pages.length > 0
      case 7:
        if (isBook) return form.publishing_goal
        return form.business_stage
      case 8: return form.budget_range && form.timeline
      case 9: return true
      default: return true
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const budgetEntry = BUDGET_RANGES.concat(BOOK_BUDGET_RANGES).find(b => b.value === form.budget_range)
      const tier = budgetEntry?.tier || 'Starter'
      let allFeatures = []
      let brief = ''
      if (isBook) {
        allFeatures = [
          `Book Path: ${form.book_path}`,
          `Genre: ${form.book_genre}`,
          `Type: ${form.book_type}`,
          `Format: ${form.book_series}`,
          form.series_name ? `Series: ${form.series_name}` : null,
          form.publishing_goal ? `Publishing Goal: ${form.publishing_goal}` : null,
          form.cover_style ? `Cover Style: ${form.cover_style}` : null,
        ].filter(Boolean)
        brief = [
          form.elevator_pitch,
          `Book: "${form.book_title}" — ${form.book_type} / ${form.book_genre}`,
          form.book_series === 'Part of a Series' && form.series_name ? `Series: ${form.series_name}` : null,
          `Path: ${form.book_path}`,
          form.manuscript_status ? `Manuscript Status: ${form.manuscript_status}` : null,
          form.synopsis ? `Synopsis: ${form.synopsis}` : null,
          form.publishing_goal ? `Publishing Goal: ${form.publishing_goal}` : null,
          form.cover_style ? `Cover Style: ${form.cover_style}` : null,
          form.target_audience ? `Target Reader: ${form.target_audience}` : null,
          form.additional_notes ? `Notes: ${form.additional_notes}` : null,
        ].filter(Boolean).join('\n\n')
      } else {
        allFeatures = [
          ...form.features,
          ...form.custom_features.split('\n').map(f => f.trim()).filter(Boolean)
        ]
        brief = [
          form.elevator_pitch,
          form.problem_solved && `Problem: ${form.problem_solved}`,
          form.target_audience && `Audience: ${form.target_audience}`,
          form.additional_notes && `Notes: ${form.additional_notes}`
        ].filter(Boolean).join('\n\n')
      }
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          customer_id: user.id,
          name: isBook ? (form.book_title || form.project_name) : form.project_name,
          project_type: form.app_type,
          status: 'Wizard Complete',
          tier: tier === 'Enterprise' ? 'Scale' : (tier || 'Starter'),
          brief, features: allFeatures,
          vibe: isBook ? form.cover_style : form.vibe,
          timeline_pref: form.timeline,
          budget_range: form.budget_range,
          progress: 0
        })
        .select().single()
      if (projErr) throw projErr
      const { error: wizErr } = await supabase
        .from('wizard_submissions')
        .insert({
          customer_id: user.id, project_id: project.id,
          step_data: form, completed: true,
          submitted_at: new Date().toISOString()
        })
      if (wizErr) console.error('Wizard submission save error:', wizErr)
      navigate('/portal/project')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally { setSubmitting(false) }
  }

  function renderStep() {
    switch (step) {
      case 1: return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Project Name *</label>
            <input type="text" value={form.project_name}
              onChange={e => update('project_name', e.target.value)}
              placeholder="e.g., FitTrack Pro, The Last Lighthouse"
              className="input-field" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Elevator Pitch *</label>
            <textarea value={form.elevator_pitch}
              onChange={e => update('elevator_pitch', e.target.value)}
              placeholder="In 1-3 sentences, what are you building and why?"
              className="input-field min-h-[120px] resize-y" rows={4} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">What problem does it solve?</label>
            <textarea value={form.problem_solved}
              onChange={e => update('problem_solved', e.target.value)}
              placeholder="What pain point are you addressing?"
              className="input-field min-h-[100px] resize-y" rows={3} />
          </div>
        </div>)
      case 2: return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isBook ? 'Who is your target reader? *' : 'Who is your target audience? *'}
            </label>
            <textarea value={form.target_audience}
              onChange={e => update('target_audience', e.target.value)}
              placeholder={isBook ? 'Describe your ideal reader...' : 'Describe your ideal users...'}
              className="input-field min-h-[100px] resize-y" rows={3} autoFocus />
          </div>
          {!isBook && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Audience Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['B2C (Consumers)', 'B2B (Businesses)', 'B2B2C (Both)', 'Internal Team'].map(type => (
                  <button key={type} onClick={() => update('audience_type', type)}
                    className={`p-3 rounded-lg border text-sm font-medium text-center transition-all ${
                      form.audience_type === type ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                    }`}>{type}</button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{isBook ? 'Genre' : 'Industry / Vertical'}</label>
            <input type="text" value={form.industry} onChange={e => update('industry', e.target.value)}
              placeholder={isBook ? 'e.g., Fantasy, Business...' : 'e.g., Fitness, Healthcare...'}
              className="input-field" />
          </div>
        </div>)
      case 3: return (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Select the type that best describes your project *</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {APP_TYPES.map(type => (
              <button key={type.value} onClick={() => update('app_type', type.value)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  form.app_type === type.value
                    ? type.value === 'Book Writing App' ? 'border-amber-400 bg-amber-400/10' : 'border-brand-blue bg-brand-blue/10'
                    : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{type.icon}</span>
                  <div>
                    <p className={`font-medium ${
                      form.app_type === type.value ? (type.value === 'Book Writing App' ? 'text-amber-400' : 'text-brand-blue') : 'text-white'
                    }`}>{type.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
                  </div>
                  {type.value === 'Book Writing App' && (
                    <span className="ml-auto text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">NEW</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>)
      case 4: if (isBook) { return (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">How can we help with your book? *</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BOOK_PATHS.map(path => (
              <button key={path.value} onClick={() => update('book_path', path.value)}
                className={`p-6 rounded-xl border text-left transition-all ${
                  form.book_path === path.value ? 'border-amber-400 bg-amber-400/10' : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                }`}>
                <div className="text-3xl mb-3">{path.icon}</div>
                <p className={`font-semibold text-base ${form.book_path === path.value ? 'text-amber-400' : 'text-white'}`}>{path.value}</p>
                <p className="text-sm text-gray-400 mt-1">{path.desc}</p>
              </button>
            ))}
          </div>
        </div>) }
        return (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-400 mb-3">Select all features you need *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURE_OPTIONS.map(feat => (
                <button key={feat} onClick={() => toggleArrayItem('features', feat)}
                  className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-3 ${
                    form.features.includes(feat) ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                  }`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    form.features.includes(feat) ? 'bg-brand-blue' : 'border border-navy-500'
                  }`}>
                    {form.features.includes(feat) && (<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>)}
                  </div>
                  {feat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Any other features?</label>
            <textarea value={form.custom_features} onChange={e => update('custom_features', e.target.value)}
              placeholder="Describe custom features..." className="input-field min-h-[80px] resize-y" rows={3} />
          </div>
        </div>)
      case 5: if (isBook) { return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Book Title *</label>
            <input type="text" value={form.book_title} onChange={e => update('book_title', e.target.value)}
              placeholder="Working title is fine" className="input-field" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Fiction or Non-Fiction? *</label>
            <div className="grid grid-cols-2 gap-3">
              {['Fiction', 'Non-Fiction'].map(type => (
                <button key={type} onClick={() => update('book_type', type)}
                  className={`p-4 rounded-lg border text-center font-medium transition-all ${
                    form.book_type === type ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                  }`}>{type}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Genre *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BOOK_GENRES.map(genre => (
                <button key={genre} onClick={() => update('book_genre', genre)}
                  className={`p-2.5 rounded-lg border text-sm text-center transition-all ${
                    form.book_genre === genre ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                  }`}>{genre}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Single or Series? *</label>
            <div className="grid grid-cols-2 gap-3">
              {['Single Book', 'Part of a Series'].map(s => (
                <button key={s} onClick={() => update('book_series', s)}
                  className={`p-4 rounded-lg border text-center font-medium transition-all ${
                    form.book_series === s ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                  }`}>{s}</button>
              ))}
            </div>
          </div>
          {form.book_series === 'Part of a Series' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Series Name</label>
              <input type="text" value={form.series_name} onChange={e => update('series_name', e.target.value)}
                placeholder="e.g., The Ember Chronicles" className="input-field" />
            </div>
          )}
        </div>) }
        return (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-400 mb-3">Pick a design vibe *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DESIGN_VIBES.map(v => (
                <button key={v.value} onClick={() => update('vibe', v.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    form.vibe === v.value ? 'border-brand-blue bg-brand-blue/10' : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                  }`}>
                  <p className={`font-medium text-sm ${form.vibe === v.value ? 'text-brand-blue' : 'text-white'}`}>{v.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Color preferences</label>
            <input type="text" value={form.color_preference} onChange={e => update('color_preference', e.target.value)}
              placeholder="e.g., Blues and whites, Earth tones..." className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Reference sites?</label>
            <textarea value={form.reference_sites} onChange={e => update('reference_sites', e.target.value)}
              placeholder="Paste URLs of designs you like..." className="input-field min-h-[80px] resize-y" rows={3} />
          </div>
        </div>)
      case 6: if (isBook) { return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {form.book_path === 'Finish & Publish' ? 'Where are you in your manuscript? *' : 'What is your book about? *'}
            </label>
            <textarea value={form.synopsis} onChange={e => update('synopsis', e.target.value)}
              placeholder={form.book_path === 'Finish & Publish' ? 'Describe where you are...' : 'Give us a synopsis or concept...'}
              className="input-field min-h-[140px] resize-y" rows={5} autoFocus />
          </div>
          {form.book_path === 'Finish & Publish' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Manuscript status</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'Partial draft (under 50%)', desc: 'Just getting started' },
                  { value: 'Halfway there (50-75%)', desc: 'Good progress' },
                  { value: 'Nearly done (75-99%)', desc: 'Final stretch' },
                  { value: 'Complete, needs editing', desc: 'First draft done' },
                ].map(s => (
                  <button key={s.value} onClick={() => update('manuscript_status', s.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      form.manuscript_status === s.value ? 'border-amber-400 bg-amber-400/10' : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                    }`}>
                    <p className={`font-medium text-sm ${form.manuscript_status === s.value ? 'text-amber-400' : 'text-white'}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Est. chapters</label>
              <input type="text" value={form.estimated_chapters} onChange={e => update('estimated_chapters', e.target.value)}
                placeholder="e.g., 20" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Est. length</label>
              <input type="text" value={form.estimated_length} onChange={e => update('estimated_length', e.target.value)}
                placeholder="e.g., 80,000 words" className="input-field" />
            </div>
          </div>
        </div>) }
        return (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-400 mb-3">Select pages / sections *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PAGE_OPTIONS.map(pg => (
                <button key={pg} onClick={() => toggleArrayItem('pages', pg)}
                  className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-3 ${
                    form.pages.includes(pg) ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                  }`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    form.pages.includes(pg) ? 'bg-brand-blue' : 'border border-navy-500'
                  }`}>
                    {form.pages.includes(pg) && (<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>)}
                  </div>
                  {pg}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Additional pages</label>
            <textarea value={form.custom_pages} onChange={e => update('custom_pages', e.target.value)}
              placeholder="Any other pages..." className="input-field resize-y" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Integrations needed?</label>
            <textarea value={form.integrations} onChange={e => update('integrations', e.target.value)}
              placeholder="e.g., Stripe, Google Maps..." className="input-field resize-y" rows={2} />
          </div>
        </div>)
      case 7: if (isBook) { return (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-400 mb-3">Cover style *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COVER_STYLES.map(s => (
                <button key={s.value} onClick={() => update('cover_style', s.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    form.cover_style === s.value ? 'border-amber-400 bg-amber-400/10' : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                  }`}>
                  <p className={`font-medium text-sm ${form.cover_style === s.value ? 'text-amber-400' : 'text-white'}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Cover color palette</label>
            <input type="text" value={form.cover_color_preference} onChange={e => update('cover_color_preference', e.target.value)}
              placeholder="e.g., Deep blues and golds..." className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Reference covers</label>
            <textarea value={form.reference_covers} onChange={e => update('reference_covers', e.target.value)}
              placeholder="Book covers whose style you admire..." className="input-field resize-y" rows={2} />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-3">Publishing goal *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PUBLISHING_GOALS.map(g => (
                <button key={g.value} onClick={() => update('publishing_goal', g.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    form.publishing_goal === g.value ? 'border-amber-400 bg-amber-400/10' : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                  }`}>
                  <p className={`font-medium text-sm ${form.publishing_goal === g.value ? 'text-amber-400' : 'text-white'}`}>{g.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{g.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>) }
        return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Business stage *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { value: 'Just an idea', desc: 'Concept, no business yet' },
                { value: 'Side project', desc: 'Working alongside day job' },
                { value: 'New business', desc: 'Recently launched' },
                { value: 'Established business', desc: 'Adding a digital product' }
              ].map(stage => (
                <button key={stage.value} onClick={() => update('business_stage', stage.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    form.business_stage === stage.value ? 'border-brand-blue bg-brand-blue/10' : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                  }`}>
                  <p className={`font-medium text-sm ${form.business_stage === stage.value ? 'text-brand-blue' : 'text-white'}`}>{stage.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stage.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Revenue model?</label>
            <input type="text" value={form.revenue_model} onChange={e => update('revenue_model', e.target.value)}
              placeholder="e.g., Subscriptions, One-time sales..." className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Competitors?</label>
            <textarea value={form.competitors} onChange={e => update('competitors', e.target.value)}
              placeholder="Similar existing products..." className="input-field resize-y" rows={2} />
          </div>
        </div>)
      case 8: return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Timeline *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TIMELINES.map(t => (
                <button key={t.value} onClick={() => update('timeline', t.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    form.timeline === t.value ? (isBook ? 'border-amber-400 bg-amber-400/10' : 'border-brand-blue bg-brand-blue/10') : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                  }`}>
                  <p className={`font-medium text-sm ${
                    form.timeline === t.value ? (isBook ? 'text-amber-400' : 'text-brand-blue') : 'text-white'
                  }`}>{t.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Budget range *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(isBook ? BOOK_BUDGET_RANGES : BUDGET_RANGES).map(b => (
                <button key={b.value} onClick={() => update('budget_range', b.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    form.budget_range === b.value ? (isBook ? 'border-amber-400 bg-amber-400/10' : 'border-brand-blue bg-brand-blue/10') : 'border-navy-600 bg-navy-800/50 hover:border-navy-500'
                  }`}>
                  <p className={`font-medium text-sm ${
                    form.budget_range === b.value ? (isBook ? 'text-amber-400' : 'text-brand-blue') : 'text-white'
                  }`}>{b.value}</p>
                  {b.tier && <p className="text-xs text-gray-500 mt-0.5">{b.tier}{b.desc ? ` — ${b.desc}` : ''}</p>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Target launch date</label>
            <input type="date" value={form.launch_date} onChange={e => update('launch_date', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Anything else?</label>
            <textarea value={form.additional_notes} onChange={e => update('additional_notes', e.target.value)}
              placeholder="Special requirements, context..." className="input-field resize-y" rows={3} />
          </div>
        </div>)
      case 9: return (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 mb-4">Review your details before submitting.</p>
          <ReviewSection title="Vision">
            <ReviewItem label="Project Name" value={isBook ? form.book_title || form.project_name : form.project_name} />
            <ReviewItem label="Pitch" value={form.elevator_pitch} />
          </ReviewSection>
          <ReviewSection title={isBook ? 'Reader & Book' : 'Audience & Type'}>
            <ReviewItem label={isBook ? 'Target Reader' : 'Target Audience'} value={form.target_audience} />
            <ReviewItem label="App Type" value={form.app_type} />
          </ReviewSection>
          {isBook ? (
            <>
              <ReviewSection title="Book Details">
                <ReviewItem label="Title" value={form.book_title} />
                <ReviewItem label="Type" value={form.book_type} />
                <ReviewItem label="Genre" value={form.book_genre} />
                <ReviewItem label="Format" value={form.book_series} />
                <ReviewItem label="Path" value={form.book_path} />
              </ReviewSection>
              <ReviewSection title="Cover & Publishing">
                <ReviewItem label="Cover Style" value={form.cover_style} />
                <ReviewItem label="Publishing Goal" value={form.publishing_goal} />
              </ReviewSection>
            </>
          ) : (
            <>
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
              </ReviewSection>
            </>
          )}
          <ReviewSection title="Timeline & Budget">
            <ReviewItem label="Timeline" value={form.timeline} />
            <ReviewItem label="Budget" value={form.budget_range} />
          </ReviewSection>
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>
          )}
        </div>)
      default: return null
    }
  }

  const stepInfo = getStepInfo(step, form.app_type)

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {isBook ? '📚 Book Writing App' : 'Start Your Project'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {isBook ? "Tell us about your book and we'll build your custom writing platform" : "Tell us about your idea and we'll bring it to life"}
        </p>
      </div>
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Step {step} of {STEPS.length}</span>
          <span>{Math.round((step / STEPS.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${isBook ? 'bg-amber-400' : 'bg-brand-blue'}`}
            style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>
      </div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">{stepInfo.title}</h2>
        <p className="text-sm text-gray-400">{stepInfo.subtitle}</p>
      </div>
      <div className="card mb-6">{renderStep()}</div>
      <div className="flex items-center justify-between">
        <button onClick={() => step === 1 ? navigate('/portal') : setStep(step - 1)}
          className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors">
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        {step < 9 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canProceed()}
            className={`px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              isBook ? 'bg-amber-500 hover:bg-amber-400' : 'bg-brand-blue hover:bg-brand-blue/90'
            }`}>Continue</button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className={`px-8 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
              isBook ? 'bg-amber-500 hover:bg-amber-400' : 'bg-brand-blue hover:bg-brand-blue/90'
            }`}>
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
            ) : (
              isBook ? 'Submit My Book Project' : 'Submit Project'
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
