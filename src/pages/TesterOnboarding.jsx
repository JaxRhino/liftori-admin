import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  fetchInviteByToken,
  markInviteOpened,
  updateOnboardingProgress,
  fetchOnboardingProgress,
  hashText,
  completeOnboarding,
  AGREEMENT_TEXTS,
} from '../lib/testerProgramService'
import SignaturePad from '../components/SignaturePad'

const SLIDE_ORDER = [
  'welcome',
  'about',
  'role',
  'commission',
  'profile',
  'nda',
  'contractor',
  'contractor_role',
  'availability',
  'instructions',
  'practical',
  'done',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function TesterOnboarding() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [invite, setInvite] = useState(null)
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [slide, setSlide] = useState('welcome')

  // Wizard form state
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [phone, setPhone] = useState('')
  const [ndaSig, setNdaSig] = useState({ method: 'typed', typed: null, drawn: null, isComplete: false })
  const [contractorSig, setContractorSig] = useState({ method: 'typed', typed: null, drawn: null, isComplete: false })
  const [contractorRoleSig, setContractorRoleSig] = useState({ method: 'typed', typed: null, drawn: null, isComplete: false })
  const [availability, setAvailability] = useState(
    [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, enabled: true, start_time: '09:00', end_time: '17:00' }))
      .concat([0, 6].map((d) => ({ day_of_week: d, enabled: false, start_time: '10:00', end_time: '14:00' })))
  )
  const [practicalDone, setPracticalDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ─── Load invite + progress ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const inv = await markInviteOpened(token)
        if (!inv) {
          setError('This invite link is invalid or has been removed.')
          return
        }
        if (inv.status === 'completed') {
          setError('This invite has already been used. Sign in normally at admin.liftori.ai.')
          return
        }
        if (inv.status === 'cancelled') {
          setError('This invite was cancelled. Reach out to the team for a new one.')
          return
        }
        if (new Date(inv.expires_at) < new Date()) {
          setError('This invite has expired. Reach out to the team for a new one.')
          return
        }
        setInvite(inv)
        const prog = await fetchOnboardingProgress(inv.id)
        setProgress(prog)
        if (prog?.current_slide && SLIDE_ORDER.includes(prog.current_slide) && prog.current_slide !== 'done') {
          setSlide(prog.current_slide)
        }
      } catch (err) {
        console.error(err)
        setError('Something went wrong loading your invite.')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const slideIndex = SLIDE_ORDER.indexOf(slide)
  const totalContent = SLIDE_ORDER.length - 1 // exclude 'done' from progress
  const pct = Math.round((slideIndex / totalContent) * 100)

  function go(direction) {
    const next = SLIDE_ORDER[Math.max(0, Math.min(SLIDE_ORDER.length - 1, slideIndex + direction))]
    setSlide(next)
    if (invite) updateOnboardingProgress(invite.id, { current_slide: next })
  }

  // Per-slide gate logic
  function canAdvance() {
    switch (slide) {
      case 'profile':
        return password.length >= 8 && password === passwordConfirm
      case 'nda':
        return ndaSig.isComplete
      case 'contractor':
        return contractorSig.isComplete
      case 'contractor_role':
        return contractorRoleSig.isComplete
      case 'availability':
        return availability.some((d) => d.enabled)
      case 'practical':
        return practicalDone
      default:
        return true
    }
  }

  async function handleFinish() {
    if (!invite) return
    setSubmitting(true)
    try {
      const ndaText = AGREEMENT_TEXTS.nda.body
      const contractorText = AGREEMENT_TEXTS.contractor_1099.body
      const contractorRoleText = AGREEMENT_TEXTS.contractor_role.body
      const ndaHash = await hashText(ndaText)
      const contractorHash = await hashText(contractorText)
      const contractorRoleHash = await hashText(contractorRoleText)

      const sigs = [
        {
          agreement_type: 'nda',
          agreement_version: AGREEMENT_TEXTS.nda.version,
          signature_method: ndaSig.method,
          typed_signature: ndaSig.typed,
          drawn_signature_data: ndaSig.drawn,
          agreement_text_hash: ndaHash,
          agreement_text_snapshot: ndaText,
        },
        {
          agreement_type: 'contractor_1099',
          agreement_version: AGREEMENT_TEXTS.contractor_1099.version,
          signature_method: contractorSig.method,
          typed_signature: contractorSig.typed,
          drawn_signature_data: contractorSig.drawn,
          agreement_text_hash: contractorHash,
          agreement_text_snapshot: contractorText,
        },
        {
          agreement_type: 'contractor_role',
          agreement_version: AGREEMENT_TEXTS.contractor_role.version,
          signature_method: contractorRoleSig.method,
          typed_signature: contractorRoleSig.typed,
          drawn_signature_data: contractorRoleSig.drawn,
          agreement_text_hash: contractorRoleHash,
          agreement_text_snapshot: contractorRoleText,
        },
      ]

      const enabledAvail = availability
        .filter((d) => d.enabled)
        .map((d) => ({ day_of_week: d.day_of_week, start_time: d.start_time + ':00', end_time: d.end_time + ':00' }))

      const result = await completeOnboarding({
        token,
        password,
        profile: { phone: phone.trim() || null },
        availability: enabledAvail,
        signatures: sigs,
      })

      if (result?.error) throw new Error(result.error)
      toast.success('Welcome aboard!')
      setSlide('done')
      // After 3s, redirect to login w/ email pre-filled
      setTimeout(() => {
        navigate(`/login?email=${encodeURIComponent(invite.personal_email)}`)
      }, 3000)
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">😬</div>
          <h1 className="text-2xl font-bold text-white mb-2">Invite unavailable</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {/* Top bar with progress */}
      <div className="border-b border-navy-700/50 bg-navy-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="text-2xl font-extrabold text-brand-blue tracking-tight">Liftori</div>
          <div className="text-xs text-gray-500 hidden sm:block">Tester Onboarding</div>
          <div className="ml-auto flex items-center gap-3 min-w-0 flex-1 max-w-sm">
            <div className="flex-1 h-1.5 bg-navy-800 rounded-full overflow-hidden">
              <div className="h-full bg-brand-blue transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
              Step {Math.min(slideIndex + 1, totalContent)} / {totalContent}
            </div>
          </div>
        </div>
      </div>

      {/* Slide body */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {slide === 'welcome' && <WelcomeSlide invite={invite} />}
        {slide === 'about' && <AboutSlide />}
        {slide === 'role' && <RoleSlide />}
        {slide === 'commission' && <CommissionSlide invite={invite} />}
        {slide === 'profile' && (
          <ProfileSlide
            invite={invite}
            password={password} setPassword={setPassword}
            passwordConfirm={passwordConfirm} setPasswordConfirm={setPasswordConfirm}
            phone={phone} setPhone={setPhone}
          />
        )}
        {slide === 'nda' && (
          <AgreementSlide
            agreement={AGREEMENT_TEXTS.nda}
            invite={invite}
            sig={ndaSig}
            onSigChange={setNdaSig}
            stepLabel="Step 1 of 3 · agreements"
          />
        )}
        {slide === 'contractor' && (
          <AgreementSlide
            agreement={AGREEMENT_TEXTS.contractor_1099}
            invite={invite}
            sig={contractorSig}
            onSigChange={setContractorSig}
            stepLabel="Step 2 of 3 · agreements"
          />
        )}
        {slide === 'contractor_role' && (
          <AgreementSlide
            agreement={AGREEMENT_TEXTS.contractor_role}
            invite={invite}
            sig={contractorRoleSig}
            onSigChange={setContractorRoleSig}
            stepLabel="Step 3 of 3 · agreements"
          />
        )}
        {slide === 'availability' && (
          <AvailabilitySlide availability={availability} setAvailability={setAvailability} hoursPerWeek={Number(invite.custom_min_hours_per_week)} />
        )}
        {slide === 'instructions' && <InstructionsSlide />}
        {slide === 'practical' && <PracticalSlide done={practicalDone} setDone={setPracticalDone} />}
        {slide === 'done' && <DoneSlide invite={invite} />}

        {/* Nav controls */}
        {slide !== 'done' && (
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-navy-800">
            <button
              onClick={() => go(-1)}
              disabled={slideIndex === 0}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            {slide === 'practical' ? (
              <button
                onClick={handleFinish}
                disabled={!canAdvance() || submitting}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-navy-950 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Activating account…' : 'Finish + activate my account →'}
              </button>
            ) : (
              <button
                onClick={() => go(1)}
                disabled={!canAdvance()}
                className="px-6 py-2.5 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {advanceLabel(slide)} →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function advanceLabel(slide) {
  switch (slide) {
    case 'welcome': return "Let's go"
    case 'profile': return 'Save & continue'
    case 'nda': return 'I sign'
    case 'contractor': return 'I sign'
    case 'contractor_role': return 'I sign'
    case 'availability': return 'Save availability'
    default: return 'Continue'
  }
}

// ═════════════════════════════════════════════════
// SLIDES
// ═════════════════════════════════════════════════

function WelcomeSlide({ invite }) {
  return (
    <div className="text-center space-y-6">
      <div className="text-7xl">👋</div>
      <h1 className="text-4xl font-bold">Welcome, {invite.full_name.split(' ')[0]}</h1>
      <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
        You've been invited to join the <span className="text-brand-blue font-semibold">Liftori Tester Program</span>.
      </p>
      <p className="text-base text-gray-400 max-w-2xl mx-auto">
        This onboarding takes about 10 minutes. We'll walk you through what Liftori is, what testers do, sign your contractor paperwork, and get your account live.
      </p>
      {invite.invite_message && (
        <div className="max-w-xl mx-auto mt-6 p-4 bg-navy-800/60 border-l-2 border-brand-blue rounded text-left text-sm text-gray-300 italic">
          “{invite.invite_message}”
        </div>
      )}
    </div>
  )
}

function AboutSlide() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">What is Liftori?</h1>
      <p className="text-lg text-gray-300 leading-relaxed">
        Liftori is an <span className="text-brand-blue font-semibold">AI-powered platform delivery system</span>.
        Customers describe their idea → our AI generates a project brief + design → we ship a live, working product.
      </p>
      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Card title="Liftori App Builder" body="Customers say what they want; we deliver a live, branded platform with managed services." color="text-brand-blue" />
        <Card title="LABOS — Business OS" body="A multi-tenant SaaS that gives small businesses a CRM, ops hub, sales tools, and AI-assisted operations." color="text-emerald-400" />
        <Card title="Rally" body="Built-in video calls + AI note-taking for every team and client interaction." color="text-purple-400" />
        <Card title="Lead Hunter" body="Waterfall-enriched lead generation engine with AI scoring and automated outreach." color="text-amber-400" />
      </div>
      <p className="text-sm text-gray-500 italic mt-6">
        Your job: make sure all of this works end to end on every browser, every screen size, every flow.
      </p>
    </div>
  )
}

function RoleSlide() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">What you'll do as a tester</h1>
      <ul className="space-y-3 text-gray-300">
        <Bullet>Walk through the platform like a real user — admin pages, client portals, mobile views.</Bullet>
        <Bullet>Log every bug, friction point, or weird thing using the structured Work Log.</Bullet>
        <Bullet>Severity matters: <span className="text-rose-300">Critical</span> auto-pages Sage and Ryan. Use it for hard breakages, data loss, or revenue impact.</Bullet>
        <Bullet>Clock in before you test. Clock out when done. Every minute logged ties to a deliverable.</Bullet>
        <Bullet>Quality &gt; quantity. One well-documented bug with steps + expected/actual is worth ten one-liners.</Bullet>
      </ul>
      <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-sm">
        <div className="font-semibold text-rose-300 mb-1">Severity quick guide</div>
        <div className="text-gray-300 space-y-1">
          <div><span className="text-rose-400 font-semibold">Critical</span>: data loss, total page failure, payment broken, security hole</div>
          <div><span className="text-orange-400 font-semibold">High</span>: feature broken, common workflow blocked</div>
          <div><span className="text-amber-400 font-semibold">Medium</span>: feature partially works, awkward UX</div>
          <div><span className="text-sky-400 font-semibold">Low</span>: cosmetic, copy issues</div>
          <div><span className="text-slate-400 font-semibold">Info</span>: observation, suggestion</div>
        </div>
      </div>
    </div>
  )
}

function CommissionSlide({ invite }) {
  const rate = (Number(invite.custom_commission_rate) * 100).toFixed(1)
  const hours = invite.custom_min_hours_per_week
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Your commission program</h1>
      <p className="text-gray-300 leading-relaxed text-lg">
        Testers earn a share of Liftori's <span className="text-emerald-400 font-semibold">monthly net profit pool</span>. We win, you win. No salary, no per-bug payouts — straight commission.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-emerald-300 font-semibold mb-2">Your share</div>
          <div className="text-5xl font-extrabold text-emerald-400">{rate}%</div>
          <div className="text-xs text-gray-400 mt-1">of monthly net profit pool</div>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Minimum to qualify</div>
          <div className="text-5xl font-extrabold text-white">{hours}<span className="text-xl text-gray-500"> hr/wk</span></div>
          <div className="text-xs text-gray-400 mt-1">to share that period's pool</div>
        </div>
      </div>
      <div className="text-sm text-gray-400 leading-relaxed bg-navy-800/40 rounded-lg p-4">
        <div className="font-semibold text-gray-300 mb-1">How it works each month</div>
        <ol className="list-decimal list-inside space-y-1 marker:text-gray-600">
          <li>You clock in + out as you test. Hours and activity tracked automatically per session.</li>
          <li>End of month: Ryan enters Liftori's net profit. The pool = net profit × commission rate.</li>
          <li>Pool splits evenly among all testers who hit the minimum hours <em>and</em> show real tracked activity.</li>
          <li>Your share is paid out within 30 days of period close (1099).</li>
        </ol>
      </div>
      <div className="text-sm text-emerald-300 leading-relaxed bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <div className="font-semibold mb-1">Carry-over rule — you don't lose qualifying months</div>
        <p>
          If Liftori has zero or negative net profit in a given month, no commission is paid that month <strong>but your qualifying status carries over.</strong> When Liftori hits a profitable month, you get paid for every qualifying period you carried over, plus the current month. Your effort doesn't expire — Liftori commits to making qualifying testers whole once profitability is achieved.
        </p>
      </div>
      <div className="text-xs text-gray-500 italic">
        Full terms in the Tester Role &amp; Commission Agreement you'll sign in a moment.
      </div>
    </div>
  )
}

function ProfileSlide({ invite, password, setPassword, passwordConfirm, setPasswordConfirm, phone, setPhone }) {
  const valid = password.length >= 8
  const match = password === passwordConfirm && passwordConfirm.length > 0
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Set up your account</h1>
      <p className="text-gray-400">Your login email is <span className="text-white font-medium">{invite.personal_email}</span>. Pick a password you'll remember.</p>
      <div className="space-y-4 max-w-md">
        <Field label="Password (8+ characters) *">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" autoComplete="new-password" />
          {password.length > 0 && (
            <div className={`text-xs mt-1 ${valid ? 'text-emerald-400' : 'text-rose-400'}`}>
              {valid ? '✓ Strong enough' : `Need ${8 - password.length} more characters`}
            </div>
          )}
        </Field>
        <Field label="Confirm password *">
          <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" autoComplete="new-password" />
          {passwordConfirm.length > 0 && (
            <div className={`text-xs mt-1 ${match ? 'text-emerald-400' : 'text-rose-400'}`}>
              {match ? '✓ Match' : 'Passwords don\'t match'}
            </div>
          )}
        </Field>
        <Field label="Phone (optional)">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(904) 555-0100" className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" />
        </Field>
      </div>
    </div>
  )
}

function AgreementSlide({ agreement, invite, sig, onSigChange, stepLabel }) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  function onScroll(e) {
    const el = e.target
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) setScrolledToEnd(true)
  }
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase font-semibold text-gray-500 tracking-wide">{stepLabel || 'agreement'}</div>
        <h1 className="text-3xl font-bold mt-1">{agreement.title}</h1>
        <p className="text-xs text-gray-500 mt-1">Version {agreement.version}</p>
      </div>
      <div
        onScroll={onScroll}
        className="bg-white text-slate-800 rounded-lg border-2 border-navy-700/50 p-6 max-h-80 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap font-serif"
      >
        {agreement.body}
      </div>
      {!scrolledToEnd && (
        <div className="text-xs text-amber-400 italic">↓ Scroll to the bottom of the agreement to enable signing.</div>
      )}
      <div className={scrolledToEnd ? '' : 'opacity-40 pointer-events-none'}>
        <div className="text-sm font-semibold text-white mb-2">Your signature</div>
        <SignaturePad defaultName={invite.full_name} requiredName={invite.full_name} onChange={onSigChange} />
        <p className="text-[10px] text-gray-500 mt-2 italic">
          By signing, you confirm you've read this agreement. We capture your IP address, browser info, timestamp, and a SHA-256 hash of the agreement text for legal record.
        </p>
      </div>
    </div>
  )
}

function AvailabilitySlide({ availability, setAvailability, hoursPerWeek }) {
  const totalEnabledHours = availability
    .filter((d) => d.enabled)
    .reduce((sum, d) => {
      const [sh, sm] = d.start_time.split(':').map(Number)
      const [eh, em] = d.end_time.split(':').map(Number)
      return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60
    }, 0)
  const meetsMin = totalEnabledHours >= hoursPerWeek

  function update(idx, patch) {
    setAvailability((prev) => prev.map((d, i) => i === idx ? { ...d, ...patch } : d))
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">When can you test?</h1>
      <p className="text-gray-400">
        Pick the days + hours you're typically available. We use this to schedule check-ins and remind you when you haven't clocked in. You can change this anytime in your account.
      </p>
      <div className="bg-navy-800/40 rounded-xl border border-navy-700/50 overflow-hidden">
        {availability.map((d, idx) => (
          <div key={d.day_of_week} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-navy-700/40' : ''}`}>
            <label className="flex items-center gap-2 w-24 flex-shrink-0">
              <input type="checkbox" checked={d.enabled} onChange={(e) => update(idx, { enabled: e.target.checked })} className="rounded text-brand-blue focus:ring-brand-blue" />
              <span className="text-sm font-medium">{DAY_NAMES[d.day_of_week]}</span>
            </label>
            <div className={`flex items-center gap-2 flex-1 ${d.enabled ? '' : 'opacity-40'}`}>
              <input type="time" value={d.start_time} disabled={!d.enabled} onChange={(e) => update(idx, { start_time: e.target.value })} className="bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-sm" />
              <span className="text-gray-500 text-sm">to</span>
              <input type="time" value={d.end_time} disabled={!d.enabled} onChange={(e) => update(idx, { end_time: e.target.value })} className="bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-sm" />
            </div>
          </div>
        ))}
      </div>
      <div className={`p-3 rounded-lg border text-sm ${meetsMin ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
        Selected: <strong>{totalEnabledHours.toFixed(1)} hr/wk</strong> · Minimum to qualify for commission: <strong>{hoursPerWeek} hr/wk</strong>
        {!meetsMin && <span className="block text-xs mt-1">You can still join — but you won't share the pool until you hit the minimum.</span>}
      </div>
    </div>
  )
}

function InstructionsSlide() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">How to test (the actual mechanics)</h1>
      <ol className="space-y-4">
        <Step n="1" title="Clock in" body="In the top nav of admin.liftori.ai you'll see a green 'Clock in' chip. Click it. It turns red and shows a live timer. You can navigate anywhere — it stays visible." />
        <Step n="2" title="Test like a real user" body="Walk through pages. Click everything. Try mobile (browser dev tools → device mode). Try edge cases: empty states, long names, bad inputs." />
        <Step n="3" title="Log everything you find" body="Click 'Testing' in the sidebar OR the red timer chip. Hit '+ Log entry'. Pick category (bug/enhancement/question/etc.), severity, and fill in: title, screen path (auto-filled), description, steps to reproduce, expected vs actual." />
        <Step n="4" title="Use Critical sparingly" body="Critical = data loss, security, total breakage. Sage auto-pages Ryan in #critical-bugs the moment you save. Use High for feature breakage." />
        <Step n="5" title="Clock out" body="Click 'Out' on the red chip when you're done. Your hours roll up automatically into the timesheet for commission qualification." />
      </ol>
    </div>
  )
}

function PracticalSlide({ done, setDone }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Last step — confirm you've got it</h1>
      <p className="text-gray-400 leading-relaxed">
        We don't make you do a real practice clock-in here (your account doesn't exist yet — we'll create it when you click Finish). Just confirm you understand the flow.
      </p>
      <div className="bg-navy-800/40 rounded-xl border border-navy-700/50 p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => setDone(e.target.checked)}
            className="mt-1 rounded text-brand-blue focus:ring-brand-blue"
          />
          <div className="text-sm text-gray-200">
            <div className="font-semibold text-white">I understand the testing workflow</div>
            <div className="text-gray-400 mt-1">
              I'll clock in before I test, log every bug with steps + expected vs actual, use Critical only for true emergencies, and clock out when I'm done. I understand my hours determine commission qualification.
            </div>
          </div>
        </label>
      </div>
      <div className="text-xs text-gray-500 italic">
        On finish: your Liftori account is created, you're enrolled in the commission program, signatures are filed, and you're sent to the login page.
      </div>
    </div>
  )
}

function DoneSlide({ invite }) {
  return (
    <div className="text-center space-y-6 py-10">
      <div className="text-7xl">🎉</div>
      <h1 className="text-4xl font-bold">You're in, {invite.full_name.split(' ')[0]}!</h1>
      <p className="text-lg text-gray-300 max-w-xl mx-auto">
        Your account is live, your contracts are signed, and you're enrolled in the tester commission program. Redirecting you to login…
      </p>
      <div className="text-sm text-gray-500">If you're not redirected: <a href="https://admin.liftori.ai/login" className="text-brand-blue underline">admin.liftori.ai/login</a></div>
    </div>
  )
}

// ─── tiny helpers ────────────────────────────────────────
function Card({ title, body, color }) {
  return (
    <div className="bg-navy-800/40 border border-navy-700/50 rounded-lg p-4">
      <div className={`font-semibold ${color}`}>{title}</div>
      <div className="text-sm text-gray-400 mt-1 leading-relaxed">{body}</div>
    </div>
  )
}
function Bullet({ children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-brand-blue mt-1.5 flex-shrink-0">●</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  )
}
function Step({ n, title, body }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-blue/20 text-brand-blue flex items-center justify-center font-bold text-sm">{n}</span>
      <div>
        <div className="font-semibold text-white">{title}</div>
        <div className="text-sm text-gray-400 mt-0.5">{body}</div>
      </div>
    </li>
  )
}
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-semibold text-gray-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
