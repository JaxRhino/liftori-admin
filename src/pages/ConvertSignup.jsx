import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PROJECT_TYPES = ['Web App', 'Mobile App', 'Business Platform']
const TIERS = ['Starter', 'Growth', 'Scale']
const STATUSES = ['Wizard Complete', 'Brief Review', 'Design Approval', 'In Build', 'QA', 'Launched', 'On Hold', 'Cancelled']

export default function ConvertSignup() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [signup, setSignup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')

  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState('Web App')
  const [tier, setTier] = useState('Starter')
  const [brief, setBrief] = useState('')
  const [features, setFeatures] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [timeline, setTimeline] = useState('')
  const [tempPassword, setTempPassword] = useState('')

  useEffect(() => {
    fetchSignup()
  }, [id])

  async function fetchSignup() {
    try {
      const { data, error } = await supabase
        .from('waitlist_signups')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setSignup(data)

      if (data.build_idea) setProjectName(data.build_idea.substring(0, 60))
      if (data.app_type) setProjectType(mapAppType(data.app_type))
      if (data.budget_range) setBudgetRange(data.budget_range)
      if (data.timeline) setTimeline(data.timeline)
      if (data.key_features) setFeatures(data.key_features)

      const briefParts = []
      if (data.build_idea) briefParts.push(`Idea: ${data.build_idea}`)
      if (data.target_audience) briefParts.push(`Target Audience: ${data.target_audience}`)
      if (data.key_features) briefParts.push(`Key Features: ${data.key_features}`)
      if (data.design_style) briefParts.push(`Design Style: ${data.design_style}`)
      if (data.color_preference) briefParts.push(`Color Preference: ${data.color_preference}`)
      setBrief(briefParts.join('\n\n'))

      setTempPassword(generatePassword())
    } catch (err) {
      console.error('Error fetching signup:', err)
      setError('Signup not found')
    } finally {
      setLoading(false)
    }
  }

  async function handleConvert() {
    setSaving(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.admin?.createUser?.({
        email: signup.email,
        password: tempPassword,
        email_confirm: true
      })

      let userId
      if (authError || !authData) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: signup.email,
          password: tempPassword,
          options: {
            data: {
              full_name: signup.full_name
            }
          }
        })
        if (signUpError) throw signUpError
        userId = signUpData.user?.id
      } else {
        userId = authData.user?.id
      }

      if (!userId) throw new Error('Failed to create user account')

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: signup.email,
          full_name: signup.full_name,
          role: 'customer'
        })

      if (profileError) throw profileError

      const featureList = features
        .split(/[,\n]/)
        .map(f => f.trim())
        .filter(Boolean)

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          customer_id: userId,
          name: projectName,
          project_type: projectType,
          tier: tier,
          status: 'Brief Review',
          brief: brief,
          features: featureList.length > 0 ? featureList : null,
          budget_range: budgetRange || null,
          timeline_pref: timeline || null,
          vibe: signup.design_style || null,
          progress: 0
        })
        .select()
        .single()

      if (projectError) throw projectError

      const { error: wizardError } = await supabase
        .from('wizard_submissions')
        .insert({
          customer_id: userId,
          project_id: project.id,
          step_data: {
            step1: { full_name: signup.full_name, email: signup.email },
            step2: { app_type: signup.app_type, build_idea: signup.build_idea, target_audience: signup.target_audience, key_features: signup.key_features },
            step3: { design_style: signup.design_style, color_preference: signup.color_preference, budget_range: signup.budget_range, timeline: signup.timeline }
          },
          completed: true,
          submitted_at: signup.created_at
        })

      if (wizardError) console.warn('Wizard submission save failed:', wizardError)

      await supabase.from('milestones').insert({
        project_id: project.id,
        name: 'Project Brief Review',
        description: 'Review and finalize the project brief with the customer',
        sort_order: 1
      })

      navigate(`/projects/${project.id}`, { replace: true })

    } catch (err) {
      console.error('Conversion error:', err)
      setError(err.message || 'Failed to convert signup')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!signup) {
    return (
      <div className="p-8">
        <p className="text-red-400">Signup not found</p>
        <Link to="/waitlist" className="text-brand-blue hover:underline mt-2 inline-block">Back to waitlist</Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/waitlist" className="text-gray-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Convert to Project</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {signup.full_name || 'Anonymous'} — {signup.email}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {['Review Signup', 'Configure Project', 'Confirm & Create'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => i + 1 < step ? setStep(i + 1) : null}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                step === i + 1
                  ? 'bg-brand-blue/20 text-brand-blue'
                  : step > i + 1
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-gray-500'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step > i + 1 ? 'bg-emerald-500/20' : step === i + 1 ? 'bg-brand-blue/30' : 'bg-navy-700'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </span>
              {label}
            </button>
            {i < 2 && <span className="text-gray-700">—</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-600/10 border border-red-600/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Signup Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="Full Name" value={signup.full_name} />
              <InfoField label="Email" value={signup.email} />
              <InfoField label="App Type" value={signup.app_type} />
              <InfoField label="Target Audience" value={signup.target_audience} />
              <InfoField label="Design Style" value={signup.design_style} />
              <InfoField label="Color Preference" value={signup.color_preference} />
              <InfoField label="Budget Range" value={signup.budget_range} />
              <InfoField label="Timeline" value={signup.timeline} />
              <InfoField label="Referral Code" value={signup.referral_code} />
              <InfoField label="Signed Up" value={new Date(signup.created_at).toLocaleString()} />
            </div>
          </div>

          {signup.build_idea && (
            <div className="card">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Build Idea</h3>
              <p className="text-white">{signup.build_idea}</p>
            </div>
          )}

          {signup.key_features && (
            <div className="card">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Key Features</h3>
              <p className="text-white">{signup.key_features}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="btn-primary">
              Next: Configure Project
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="card space-y-5">
            <h2 className="text-lg font-semibold">Project Configuration</h2>

            <div>
              <label className="label">Project Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., CleanCut Barbers Website"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Project Type *</label>
                <select className="select" value={projectType} onChange={e => setProjectType(e.target.value)}>
                  {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tier *</label>
                <select className="select" value={tier} onChange={e => setTier(e.target.value)}>
                  {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Budget Range</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., $500 - $1,500"
                  value={budgetRange}
                  onChange={e => setBudgetRange(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Timeline</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., 2-4 weeks"
                  value={timeline}
                  onChange={e => setTimeline(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Features (comma or line separated)</label>
              <textarea
                className="input min-h-[80px]"
                placeholder="e.g., Online booking, Payment processing, Admin panel"
                value={features}
                onChange={e => setFeatures(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <label className="label">Project Brief</label>
              <textarea
                className="input min-h-[120px]"
                placeholder="Summary of what needs to be built..."
                value={brief}
                onChange={e => setBrief(e.target.value)}
                rows={5}
              />
              <p className="text-xs text-gray-500 mt-1">Auto-generated from signup data. Edit as needed.</p>
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Customer Account</h2>
            <p className="text-sm text-gray-400">
              A customer account will be created for <strong className="text-white">{signup.email}</strong>.
              They'll use these credentials to log into their project dashboard.
            </p>
            <div>
              <label className="label">Temporary Password</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input font-mono"
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                />
                <button
                  onClick={() => setTempPassword(generatePassword())}
                  className="btn-secondary flex-shrink-0"
                >
                  Regenerate
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">You'll share this with the customer so they can log in.</p>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-ghost">Back</button>
            <button
              onClick={() => setStep(3)}
              disabled={!projectName}
              className="btn-primary disabled:opacity-50"
            >
              Next: Review & Confirm
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Confirm Conversion</h2>
            <p className="text-gray-400 text-sm mb-6">This will create:</p>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-navy-700/30 rounded-lg">
                <span className="text-brand-blue mt-0.5">1.</span>
                <div>
                  <p className="text-sm font-medium text-white">Customer Account</p>
                  <p className="text-xs text-gray-400">{signup.email} with temporary password</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-navy-700/30 rounded-lg">
                <span className="text-brand-blue mt-0.5">2.</span>
                <div>
                  <p className="text-sm font-medium text-white">Customer Profile</p>
                  <p className="text-xs text-gray-400">{signup.full_name || 'Anonymous'} — role: customer</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-navy-700/30 rounded-lg">
                <span className="text-brand-blue mt-0.5">3.</span>
                <div>
                  <p className="text-sm font-medium text-white">Project: {projectName}</p>
                  <p className="text-xs text-gray-400">{projectType} — {tier} tier — Status: Brief Review</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-navy-700/30 rounded-lg">
                <span className="text-brand-blue mt-0.5">4.</span>
                <div>
                  <p className="text-sm font-medium text-white">Initial Milestone</p>
                  <p className="text-xs text-gray-400">"Project Brief Review" — first milestone in the pipeline</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-ghost">Back</button>
            <button
              onClick={handleConvert}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                  </svg>
                  Create Customer & Project
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-white">{value || '—'}</p>
    </div>
  )
}

function mapAppType(wizardType) {
  if (!wizardType) return 'Web App'
  const lower = wizardType.toLowerCase()
  if (lower.includes('mobile')) return 'Mobile App'
  if (lower.includes('platform') || lower.includes('dashboard') || lower.includes('saas')) return 'Business Platform'
  return 'Web App'
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const specials = '!@#$%'
  let pass = ''
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)]
  pass += specials[Math.floor(Math.random() * specials.length)]
  return pass
}
