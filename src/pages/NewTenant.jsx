// =====================================================================
// NewTenant - /admin/new-tenant provisioning wizard
// Wave D.3 (2026-06-02)
//
// Calls the provision-tenant edge function which spins up a new Supabase
// project, applies the CRM template, registers a platforms row, and emails
// the owner login info. The edge function returns a single response after
// 60-90s of work, so this UI fakes the per-step progress for UX feel.
//
// TODO Wave F: replace fake-progress timeline with real SSE streaming from
// the edge function so each step advances on the actual event boundary
// instead of timed transitions.
//
// Auth: super_admin only.
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ---------- constants ----------
const INDUSTRIES = [
  'HVAC / Mechanical Services',
  'Plumbing',
  'Electrical',
  'Landscaping',
  'Cleaning Services',
  'Pest Control',
  'Pool Services',
  'Roofing',
  'General Contractor',
  'IT / MSP',
  'Consulting',
  'Other',
]

const REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU West (Ireland)' },
  { value: 'eu-central-1', label: 'EU Central (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
]

const PROVISION_STEPS = [
  { id: 'create_project', label: 'Creating Supabase project', durationMs: 8000 },
  { id: 'wait_online', label: 'Waiting for project to come online', durationMs: 18000 },
  { id: 'apply_template', label: 'Applying CRM template', durationMs: 22000 },
  { id: 'register_platform', label: 'Registering platform', durationMs: 8000 },
  { id: 'send_email', label: 'Sending welcome email', durationMs: 6000 },
]

const SLUG_REGEX = /^[a-z][a-z0-9-]{2,30}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---------- helpers ----------
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 31)
}

// ---------- icons (inline, lucide-free) ----------
const IconCheck = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IconSpinner = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
    <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
  </svg>
)
const IconX = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const IconArrowRight = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)
const IconArrowLeft = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)
const IconBuilding = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="9" y1="22" x2="9" y2="18" />
    <line x1="15" y1="22" x2="15" y2="18" />
    <line x1="8" y1="6" x2="10" y2="6" />
    <line x1="14" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="10" y2="10" />
    <line x1="14" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="10" y2="14" />
    <line x1="14" y1="14" x2="16" y2="14" />
  </svg>
)
const IconUser = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
const IconClipboard = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 4h6a2 2 0 0 1 2 2v0H7v0a2 2 0 0 1 2-2z" />
    <rect x="4" y="6" width="16" height="16" rx="2" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
)
const IconRocket = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
)

// ---------- progress timeline ----------
function ProgressTimeline({ steps, currentIndex, errorIndex }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const isError = errorIndex === i
        const isDone = errorIndex === null
          ? (currentIndex > i)
          : (i < errorIndex)
        const isActive = errorIndex === null && currentIndex === i
        const isPending = errorIndex === null && currentIndex < i
        const isLast = i === steps.length - 1
        return (
          <li key={s.id} className="relative flex items-start gap-3 pb-6 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[15px] top-8 bottom-0 w-px ${
                  isDone ? 'bg-emerald-500/40' : isError ? 'bg-rose-500/40' : 'bg-navy-700/60'
                }`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                isDone
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : isError
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                  : isActive
                  ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan'
                  : 'border-navy-700/60 bg-navy-800/60 text-slate-500'
              }`}
            >
              {isDone ? (
                <IconCheck className="h-4 w-4" />
              ) : isError ? (
                <IconX className="h-4 w-4" />
              ) : isActive ? (
                <IconSpinner className="h-4 w-4 animate-spin" />
              ) : (
                <span className="text-xs font-medium">{i + 1}</span>
              )}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p
                className={`text-sm ${
                  isDone
                    ? 'text-emerald-300'
                    : isError
                    ? 'text-rose-300'
                    : isActive
                    ? 'text-brand-cyan'
                    : isPending
                    ? 'text-slate-500'
                    : 'text-slate-300'
                }`}
              >
                {s.label}
                {isActive && <span className="text-slate-500">{'...'}</span>}
              </p>
              {isActive && (
                <p className="mt-0.5 text-xs text-slate-500">In progress</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ---------- step components ----------
function StepHeader({ stepNum, total, title, subtitle }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        Step {stepNum} of {total}
      </p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-100">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
    </div>
  )
}

function FieldLabel({ children, hint }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-300">{children}</span>
      {hint && <span className="block mt-0.5 text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

// ---------- main ----------
export default function NewTenant() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()

  // ---- auth gate ----
  const isSuperAdmin = useMemo(() => {
    if (!profile) return false
    return profile.is_super_admin === true ||
           profile.role === 'super_admin' ||
           profile.role === 'admin'
  }, [profile])

  // ---- wizard state ----
  const [step, setStep] = useState(1) // 1=org, 2=owner, 3=review, 4=provisioning, 5=success, 6=error
  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [industry, setIndustry] = useState(INDUSTRIES[0])
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [region, setRegion] = useState('us-east-1')

  // ---- provisioning state ----
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [errorStepIdx, setErrorStepIdx] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [errorDetails, setErrorDetails] = useState(null)
  const [result, setResult] = useState(null)
  const timersRef = useRef([])

  // ---- auto-derive slug from org_name until user manually edits ----
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(orgName))
  }, [orgName, slugTouched])

  // ---- cleanup pending timers on unmount or wizard reset ----
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t))
      timersRef.current = []
    }
  }, [])

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
  }

  // ---- validations ----
  const slugValid = SLUG_REGEX.test(slug)
  const emailValid = EMAIL_REGEX.test(ownerEmail)
  const step1Valid = orgName.trim().length >= 2 && slugValid
  const step2Valid = ownerName.trim().length >= 2 && emailValid

  // ---- provision call ----
  async function runProvision() {
    setStep(4)
    setCurrentStepIdx(0)
    setErrorStepIdx(null)
    setErrorMessage('')
    setErrorDetails(null)
    setResult(null)
    clearTimers()

    // TODO Wave F: replace this fake-progress driver with real SSE.
    // The edge function currently returns a single response after the full
    // 60-90s of work; we simulate stepwise advancement on a timer so the user
    // sees motion. On the actual response, we snap to completed / error state.
    let cumulative = 0
    const stopAt = PROVISION_STEPS.length - 1
    for (let i = 0; i < stopAt; i++) {
      cumulative += PROVISION_STEPS[i].durationMs
      const tid = setTimeout(() => {
        setCurrentStepIdx((cur) => Math.max(cur, i + 1))
      }, cumulative)
      timersRef.current.push(tid)
    }

    try {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token
      if (!token) throw new Error('No auth session. Please sign in again.')

      const supabaseUrl = supabase.supabaseUrl || 'https://qlerfkdyslndjbaltkwo.supabase.co'
      const res = await fetch(`${supabaseUrl}/functions/v1/provision-tenant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_name: orgName.trim(),
          slug: slug.trim(),
          owner_name: ownerName.trim(),
          owner_email: ownerEmail.trim(),
          industry,
          region,
        }),
      })

      let data
      try { data = await res.json() } catch { data = null }
      clearTimers()

      if (!res.ok || !data || data.success === false) {
        const failedStepId = data?.step
        const idx = failedStepId
          ? PROVISION_STEPS.findIndex((s) => s.id === failedStepId)
          : -1
        setErrorStepIdx(idx >= 0 ? idx : Math.min(currentStepIdx, PROVISION_STEPS.length - 1))
        setErrorMessage(data?.error || `HTTP ${res.status} ${res.statusText}`)
        setErrorDetails(data || { status: res.status, statusText: res.statusText })
        setStep(6)
        return
      }

      // Success: snap all steps to complete
      setCurrentStepIdx(PROVISION_STEPS.length)
      setResult(data)
      // Tiny delay so the user gets to see the final check before the success screen
      const finalTid = setTimeout(() => setStep(5), 600)
      timersRef.current.push(finalTid)
    } catch (err) {
      clearTimers()
      setErrorStepIdx(currentStepIdx)
      setErrorMessage(err?.message || String(err))
      setErrorDetails({ exception: String(err) })
      setStep(6)
    }
  }

  function resetWizard() {
    clearTimers()
    setStep(1)
    setOrgName('')
    setSlug('')
    setSlugTouched(false)
    setIndustry(INDUSTRIES[0])
    setOwnerName('')
    setOwnerEmail('')
    setRegion('us-east-1')
    setCurrentStepIdx(0)
    setErrorStepIdx(null)
    setErrorMessage('')
    setErrorDetails(null)
    setResult(null)
  }

  function backToReview() {
    clearTimers()
    setCurrentStepIdx(0)
    setErrorStepIdx(null)
    setErrorMessage('')
    setErrorDetails(null)
    setStep(3)
  }

  // ---- render: auth gate ----
  if (authLoading || (user && !profile)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    )
  }
  if (!user) {
    return <div className="p-6 text-slate-300">Not signed in.</div>
  }
  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-md rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
          <p className="text-sm font-medium text-rose-300">Forbidden</p>
          <p className="mt-1 text-sm text-rose-400/80">
            This page is super-admin only.
          </p>
        </div>
      </div>
    )
  }

  // ---- main card ----
  return (
    <div className="min-h-screen bg-navy-950 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-100">Provision a new tenant</h1>
          <p className="mt-1 text-sm text-slate-400">
            Spin up a brand-new CRM for a Liftori customer. Takes 60-90 seconds.
          </p>
        </div>

        <div className="rounded-xl border border-navy-700/50 bg-navy-800 p-6 shadow-xl shadow-black/30">
          {/* ============= STEP 1: Organization ============= */}
          {step === 1 && (
            <>
              <StepHeader
                stepNum={1}
                total={3}
                title="Organization"
                subtitle="Who are we building this for?"
              />
              <div className="space-y-5">
                <div>
                  <FieldLabel>Organization name</FieldLabel>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Apex HVAC Services"
                    autoFocus
                    className="mt-1.5 w-full rounded-md border border-navy-700/70 bg-navy-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan/40"
                  />
                </div>
                <div>
                  <FieldLabel hint="Lowercase, dashes, 3-31 chars. Used in URLs.">
                    URL slug
                  </FieldLabel>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }}
                    placeholder="apex-hvac"
                    className={`mt-1.5 w-full rounded-md border bg-navy-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 ${
                      !slug || slugValid
                        ? 'border-navy-700/70 focus:border-brand-cyan focus:ring-brand-cyan/40'
                        : 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/40'
                    }`}
                  />
                  {slug && !slugValid && (
                    <p className="mt-1 text-xs text-rose-400">
                      Must start with a letter; lowercase, digits, dashes; 3-31 chars.
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel>Industry</FieldLabel>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-navy-700/70 bg-navy-900/60 px-3 py-2 text-sm text-slate-100 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan/40"
                  >
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!step1Valid}
                  onClick={() => setStep(2)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${
                    step1Valid
                      ? 'bg-brand-cyan text-navy-950 hover:bg-brand-cyan/90'
                      : 'cursor-not-allowed bg-navy-700/50 text-slate-500'
                  }`}
                >
                  Next
                  <IconArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {/* ============= STEP 2: Owner + Region ============= */}
          {step === 2 && (
            <>
              <StepHeader
                stepNum={2}
                total={3}
                title="Owner and region"
                subtitle="Who gets the admin login, and where should the database live?"
              />
              <div className="space-y-5">
                <div>
                  <FieldLabel>Owner name</FieldLabel>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Jamie Rivera"
                    autoFocus
                    className="mt-1.5 w-full rounded-md border border-navy-700/70 bg-navy-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan/40"
                  />
                </div>
                <div>
                  <FieldLabel hint="They will receive a welcome email with login credentials.">
                    Owner email
                  </FieldLabel>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="jamie@apexhvac.com"
                    className={`mt-1.5 w-full rounded-md border bg-navy-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 ${
                      !ownerEmail || emailValid
                        ? 'border-navy-700/70 focus:border-brand-cyan focus:ring-brand-cyan/40'
                        : 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/40'
                    }`}
                  />
                  {ownerEmail && !emailValid && (
                    <p className="mt-1 text-xs text-rose-400">Enter a valid email address.</p>
                  )}
                </div>
                <div>
                  <FieldLabel>Region</FieldLabel>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-navy-700/70 bg-navy-900/60 px-3 py-2 text-sm text-slate-100 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan/40"
                  >
                    {REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
                >
                  <IconArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  disabled={!step2Valid}
                  onClick={() => setStep(3)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${
                    step2Valid
                      ? 'bg-brand-cyan text-navy-950 hover:bg-brand-cyan/90'
                      : 'cursor-not-allowed bg-navy-700/50 text-slate-500'
                  }`}
                >
                  Next
                  <IconArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {/* ============= STEP 3: Review ============= */}
          {step === 3 && (
            <>
              <StepHeader
                stepNum={3}
                total={3}
                title="Review and provision"
                subtitle="Double-check the details before we spin up infrastructure."
              />
              <dl className="space-y-3 rounded-lg border border-navy-700/60 bg-navy-900/40 p-4">
                <ReviewRow icon={<IconBuilding className="h-4 w-4" />} label="Organization" value={orgName} />
                <ReviewRow label="URL slug" value={slug} mono />
                <ReviewRow label="Industry" value={industry} />
                <ReviewRow icon={<IconUser className="h-4 w-4" />} label="Owner" value={ownerName} />
                <ReviewRow label="Owner email" value={ownerEmail} />
                <ReviewRow label="Region" value={REGIONS.find((r) => r.value === region)?.label || region} />
              </dl>

              <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
                This creates a $10/mo Supabase project and emails the owner login info.
                The process takes 60-90 seconds. You can&apos;t cancel mid-provision.
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
                >
                  <IconArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={runProvision}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-cyan px-5 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-brand-cyan/90"
                >
                  <IconRocket className="h-4 w-4" />
                  Provision tenant
                </button>
              </div>
            </>
          )}

          {/* ============= STEP 4: Provisioning ============= */}
          {step === 4 && (
            <>
              <StepHeader
                stepNum={4}
                total={5}
                title="Provisioning"
                subtitle={`Spinning up ${orgName}. Don't close this tab.`}
              />
              <ProgressTimeline
                steps={PROVISION_STEPS}
                currentIndex={currentStepIdx}
                errorIndex={null}
              />
              <p className="mt-6 text-xs text-slate-500">
                Average duration: 60-90 seconds. Real progress streaming arrives in Wave F.
              </p>
            </>
          )}

          {/* ============= STEP 5: Success ============= */}
          {step === 5 && result && (
            <>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                  <IconCheck className="h-8 w-8" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-slate-100">
                  Welcome {orgName} to Liftori!
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Their CRM is live and the owner has been emailed login credentials.
                </p>

                <div className="mt-6 w-full space-y-2 rounded-lg border border-navy-700/60 bg-navy-900/40 p-4 text-left">
                  {result.admin_url && (
                    <ResultRow label="Admin URL" value={result.admin_url} link />
                  )}
                  {result.platform_id && (
                    <ResultRow label="Platform ID" value={result.platform_id} mono />
                  )}
                  {result.supabase_project_ref && (
                    <ResultRow label="Supabase ref" value={result.supabase_project_ref} mono />
                  )}
                  <ResultRow label="Welcome email" value={`Sent to ${ownerEmail}`} />
                </div>

                <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                  {result.platform_id && (
                    <button
                      type="button"
                      onClick={() => navigate(`/crm/${result.platform_id}/dashboard`)}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-cyan px-5 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-brand-cyan/90"
                    >
                      Open CRM now
                      <IconArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetWizard}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-navy-700/70 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-brand-cyan/40 hover:text-brand-cyan"
                  >
                    Provision another
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ============= STEP 6: Error ============= */}
          {step === 6 && (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-500/50 bg-rose-500/10 text-rose-300">
                  <IconX className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-rose-200">
                    Provisioning failed
                    {errorStepIdx !== null && PROVISION_STEPS[errorStepIdx] && (
                      <span className="ml-1 font-normal text-rose-300/80">
                        at &ldquo;{PROVISION_STEPS[errorStepIdx].label}&rdquo;
                      </span>
                    )}
                  </p>
                  <p className="mt-1 break-words text-sm text-rose-200/80">
                    {errorMessage || 'Unknown error.'}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <ProgressTimeline
                  steps={PROVISION_STEPS}
                  currentIndex={errorStepIdx ?? 0}
                  errorIndex={errorStepIdx ?? 0}
                />
              </div>

              {errorDetails && (
                <details className="mt-5 rounded-lg border border-navy-700/60 bg-navy-900/40 p-3 text-xs text-slate-400">
                  <summary className="cursor-pointer text-slate-300">
                    Full response details
                  </summary>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-slate-400">
{JSON.stringify(errorDetails, null, 2)}
                  </pre>
                </details>
              )}

              <div className="mt-6 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={backToReview}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-navy-700/70 px-4 py-2 text-sm text-slate-200 transition hover:border-brand-cyan/40 hover:text-brand-cyan"
                >
                  <IconArrowLeft className="h-4 w-4" />
                  Back to wizard
                </button>
                <button
                  type="button"
                  onClick={runProvision}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-cyan px-5 py-2 text-sm font-semibold text-navy-950 transition hover:bg-brand-cyan/90"
                >
                  Try again
                </button>
              </div>
            </>
          )}
        </div>

        {/* breadcrumb / footer */}
        <div className="mt-4 text-center text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <IconClipboard className="h-3.5 w-3.5" />
            /admin/new-tenant
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------- small row components ----------
function ReviewRow({ icon, label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="flex items-center gap-1.5 text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className={`min-w-0 flex-1 truncate text-right text-slate-100 ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="italic text-slate-500">(empty)</span>}
      </dd>
    </div>
  )
}

function ResultRow({ label, value, link, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className={`min-w-0 flex-1 truncate text-right ${mono ? 'font-mono text-xs text-slate-100' : 'text-slate-100'}`}>
        {link ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-brand-cyan hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
