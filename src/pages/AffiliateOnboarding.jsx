import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  fetchAffiliateInviteByToken,
  markAffiliateInviteOpened,
  updateAffiliateProgress,
  fetchAffiliateProgress,
  completeAffiliateOnboarding,
  hashText,
  AFFILIATE_AGREEMENT_TEXTS,
  AFFILIATE_TIERS,
  getTier,
} from '../lib/affiliateProgramService'
import SignaturePad from '../components/SignaturePad'

const SLIDE_ORDER = [
  'welcome',
  'about',
  'platform',
  'commission',
  'tier',
  'profile',
  'nda',
  'affiliate',
  'instructions',
  'done',
]

export default function AffiliateOnboarding() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [slide, setSlide] = useState('welcome')

  const [tier, setTier] = useState('free')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [phone, setPhone] = useState('')
  const [niche, setNiche] = useState('')
  const [primaryPlatform, setPrimaryPlatform] = useState('')
  const [audienceSize, setAudienceSize] = useState('')
  const [bio, setBio] = useState('')
  const [socials, setSocials] = useState({ instagram: '', tiktok: '', youtube: '', linkedin: '', twitter: '', website: '' })
  const [ndaSig, setNdaSig] = useState({ method: 'typed', typed: null, drawn: null, isComplete: false })
  const [affSig, setAffSig] = useState({ method: 'typed', typed: null, drawn: null, isComplete: false })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const inv = await markAffiliateInviteOpened(token)
        if (!inv) { setError('This invite link is invalid or has been removed.'); return }
        if (inv.status === 'completed') { setError('This invite has already been used. Sign in at admin.liftori.ai.'); return }
        if (inv.status === 'cancelled') { setError('This invite was cancelled. Reach out to the team for a new one.'); return }
        if (new Date(inv.expires_at) < new Date()) { setError('This invite has expired. Reach out for a new one.'); return }
        setInvite(inv)
        setTier(inv.proposed_tier || 'free')
        const prog = await fetchAffiliateProgress(inv.id)
        if (prog?.current_slide && SLIDE_ORDER.includes(prog.current_slide) && prog.current_slide !== 'done') setSlide(prog.current_slide)
      } catch (e) {
        console.error(e)
        setError('Something went wrong loading your invite.')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const slideIndex = SLIDE_ORDER.indexOf(slide)
  const totalContent = SLIDE_ORDER.length - 1
  const pct = Math.round((slideIndex / totalContent) * 100)

  function go(delta) {
    const next = SLIDE_ORDER[Math.max(0, Math.min(SLIDE_ORDER.length - 1, slideIndex + delta))]
    setSlide(next)
    if (invite) updateAffiliateProgress(invite.id, { current_slide: next })
  }

  function canAdvance() {
    switch (slide) {
      case 'profile': return password.length >= 8 && password === passwordConfirm
      case 'nda': return ndaSig.isComplete
      case 'affiliate': return affSig.isComplete
      case 'tier': return !!tier
      default: return true
    }
  }

  async function handleFinish() {
    if (!invite) return
    setSubmitting(true)
    try {
      const ndaText = AFFILIATE_AGREEMENT_TEXTS.nda.body
      const affText = AFFILIATE_AGREEMENT_TEXTS.affiliate.body
      const ndaHash = await hashText(ndaText)
      const affHash = await hashText(affText)
      const sigs = [
        {
          agreement_type: 'nda',
          agreement_version: AFFILIATE_AGREEMENT_TEXTS.nda.version,
          signature_method: ndaSig.method,
          typed_signature: ndaSig.typed,
          drawn_signature_data: ndaSig.drawn,
          agreement_text_hash: ndaHash,
          agreement_text_snapshot: ndaText,
        },
        {
          agreement_type: 'affiliate',
          agreement_version: AFFILIATE_AGREEMENT_TEXTS.affiliate.version,
          signature_method: affSig.method,
          typed_signature: affSig.typed,
          drawn_signature_data: affSig.drawn,
          agreement_text_hash: affHash,
          agreement_text_snapshot: affText,
        },
      ]
      const result = await completeAffiliateOnboarding({
        token,
        password,
        tier,
        profile: {
          phone: phone.trim() || null,
          niche: niche.trim() || null,
          primary_platform: primaryPlatform || null,
          audience_size: audienceSize || null,
          bio: bio.trim() || null,
          website: socials.website.trim() || null,
          instagram: socials.instagram.trim() || null,
          tiktok: socials.tiktok.trim() || null,
          youtube: socials.youtube.trim() || null,
          linkedin: socials.linkedin.trim() || null,
          twitter: socials.twitter.trim() || null,
        },
        signatures: sigs,
      })
      if (result?.error) throw new Error(result.error)
      toast.success('Welcome to the Creator Platform!')
      setSlide('done')
      setTimeout(() => navigate(`/login?email=${encodeURIComponent(invite.personal_email)}`), 3500)
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Something went wrong')
    } finally { setSubmitting(false) }
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
      <div className="border-b border-navy-700/50 bg-navy-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="text-2xl font-extrabold text-brand-blue tracking-tight">Liftori</div>
          <div className="text-xs text-gray-500 hidden sm:block">Creator Onboarding</div>
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

      <div className="max-w-3xl mx-auto px-6 py-10">
        {slide === 'welcome' && <WelcomeSlide invite={invite} />}
        {slide === 'about' && <AboutSlide />}
        {slide === 'platform' && <PlatformSlide />}
        {slide === 'commission' && <CommissionSlide />}
        {slide === 'tier' && <TierSlide tier={tier} setTier={setTier} />}
        {slide === 'profile' && (
          <ProfileSlide
            invite={invite}
            password={password} setPassword={setPassword}
            passwordConfirm={passwordConfirm} setPasswordConfirm={setPasswordConfirm}
            phone={phone} setPhone={setPhone}
            niche={niche} setNiche={setNiche}
            primaryPlatform={primaryPlatform} setPrimaryPlatform={setPrimaryPlatform}
            audienceSize={audienceSize} setAudienceSize={setAudienceSize}
            bio={bio} setBio={setBio}
            socials={socials} setSocials={setSocials}
          />
        )}
        {slide === 'nda' && (
          <AgreementSlide
            agreement={AFFILIATE_AGREEMENT_TEXTS.nda}
            invite={invite}
            sig={ndaSig}
            onSigChange={setNdaSig}
            stepLabel="Step 1 of 2 · agreements"
          />
        )}
        {slide === 'affiliate' && (
          <AgreementSlide
            agreement={AFFILIATE_AGREEMENT_TEXTS.affiliate}
            invite={invite}
            sig={affSig}
            onSigChange={setAffSig}
            stepLabel="Step 2 of 2 · agreements"
          />
        )}
        {slide === 'instructions' && <InstructionsSlide />}
        {slide === 'done' && <DoneSlide invite={invite} />}

        {slide !== 'done' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10 pt-6 border-t border-navy-800 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <button
              onClick={() => go(-1)}
              disabled={slideIndex === 0}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-center sm:text-left"
            >← Back</button>
            {slide === 'instructions' ? (
              <button
                onClick={handleFinish}
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-navy-950 rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Activating account…' : 'Finish + activate my account →'}
              </button>
            ) : (
              <button
                onClick={() => go(1)}
                disabled={!canAdvance()}
                className="w-full sm:w-auto px-6 py-2.5 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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
    case 'tier': return 'Pick this tier'
    case 'profile': return 'Save & continue'
    case 'nda': return 'I sign'
    case 'affiliate': return 'I sign'
    default: return 'Continue'
  }
}

// ═════════════════════════════════════════════════
// SLIDES
// ═════════════════════════════════════════════════

function WelcomeSlide({ invite }) {
  return (
    <div className="text-center space-y-6">
      <div className="text-7xl">🎨</div>
      <h1 className="text-4xl font-bold">Welcome, {invite.full_name.split(' ')[0]}</h1>
      <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
        You've been invited to the <span className="text-brand-blue font-semibold">Liftori Creator Platform</span>.
      </p>
      <p className="text-base text-gray-400 max-w-2xl mx-auto">
        A full business OS to help you grow your audience — plus commission on every customer you refer to Liftori.
      </p>
      {invite.invite_message && (
        <div className="max-w-xl mx-auto mt-6 p-4 bg-navy-800/60 border-l-2 border-brand-blue rounded text-left text-sm text-gray-300 italic">
          "{invite.invite_message}"
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
        Liftori is an <span className="text-brand-blue font-semibold">AI-powered platform delivery system</span>. Customers describe their idea → our AI generates a project brief + design → we ship a live, working product.
      </p>
      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Card title="App Builder" body="Customers say what they want; we deliver a live, branded platform." color="text-brand-blue" />
        <Card title="LABOS — Business OS" body="Multi-tenant SaaS for small businesses: CRM, ops, sales, AI." color="text-emerald-400" />
        <Card title="Consulting" body="1:1 business consulting for founders, with Liftori-powered tools." color="text-amber-400" />
        <Card title="Creator Platform" body="You're here! Tools to grow + affiliate commission engine." color="text-pink-400" />
      </div>
      <p className="text-sm text-gray-500 italic mt-6">
        Your audience finds Liftori useful → you get paid. Everyone wins.
      </p>
    </div>
  )
}

function PlatformSlide() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Your Creator toolkit</h1>
      <p className="text-gray-400">Everything you need to grow and run your creator business — in one place.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <ToolCard icon="✍️" name="Content Creator" body="Write captions, scripts, hooks. Template library." />
        <ToolCard icon="📅" name="Scheduler" body="Plan + auto-post to all platforms. Best-time suggestions." />
        <ToolCard icon="📚" name="Content Library" body="Store all your media, assets, and branded templates." />
        <ToolCard icon="💡" name="Ideas Generator" body="AI brainstorms content ideas around your niche." />
        <ToolCard icon="📊" name="Analytics" body="Unified dashboard across IG, TikTok, YouTube." />
        <ToolCard icon="🔗" name="Link in Bio" body="Branded landing page + conversion tracking." />
        <ToolCard icon="💼" name="Brand CRM" body="Track sponsor pipeline, rate cards, deal templates." />
        <ToolCard icon="📦" name="Inventory" body="Track merch, products, fulfillment." />
        <ToolCard icon="📝" name="Notes + Tasks" body="Capture ideas + run your day." />
        <ToolCard icon="🗓️" name="Calendar" body="Meetings, content drops, launches." />
        <ToolCard icon="💬" name="Chat + Support" body="Direct line to Liftori team." />
        <ToolCard icon="🤖" name="AI (Creator+)" body="AI content, AI thumbnails, AI pitch writer." />
      </div>
    </div>
  )
}

function CommissionSlide() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">How you earn</h1>
      <p className="text-gray-300 leading-relaxed text-lg">
        Every time someone signs up for Liftori through your unique referral link, you earn a <span className="text-emerald-400 font-semibold">percentage of their spend</span>.
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        <CommissionCard tier="Starter (Free)" rate="10%" bg="bg-slate-500/10 border-slate-500/30 text-slate-300" />
        <CommissionCard tier="Creator ($29/mo)" rate="15%" bg="bg-sky-500/10 border-sky-500/30 text-sky-300" />
        <CommissionCard tier="Pro ($149/mo)" rate="20%" bg="bg-emerald-500/10 border-emerald-500/30 text-emerald-300" />
      </div>
      <div className="text-sm text-gray-400 leading-relaxed bg-navy-800/40 rounded-lg p-4">
        <div className="font-semibold text-gray-300 mb-1">How it works</div>
        <ol className="list-decimal list-inside space-y-1 marker:text-gray-600">
          <li>You get a unique referral link + code on your dashboard.</li>
          <li>Share on your content — with proper FTC disclosure (we give you templates).</li>
          <li>Customer signs up within 60 days of clicking + stays 30+ days → it counts.</li>
          <li>We pay out monthly, 30 days after month close (1099 issued if you earn $600+/yr).</li>
          <li>If you're on Creator or Pro tier, your subscription will auto-offset against earned commission once the Liftori AI Payment Center launches.</li>
        </ol>
      </div>
    </div>
  )
}

function TierSlide({ tier, setTier }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pick your starting tier</h1>
      <p className="text-gray-400">You can upgrade or downgrade anytime. Free is a great way to start.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {AFFILIATE_TIERS.map((t) => {
          const active = tier === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTier(t.key)}
              className={`text-left p-5 rounded-xl border-2 transition-all ${
                active
                  ? 'bg-brand-blue/10 border-brand-blue'
                  : 'bg-navy-800/40 border-navy-700/50 hover:border-navy-600'
              }`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-lg font-bold text-white">{t.label}</div>
                <div className="text-sm font-semibold text-emerald-400">
                  {t.price === 0 ? 'Free' : `$${t.price}/mo`}
                </div>
              </div>
              <div className="text-xs text-gray-400 mb-3">{t.tagline}</div>
              <div className="text-xs text-gray-500 mb-2">Commission: <strong className="text-white">{(t.commissionRate * 100).toFixed(0)}%</strong></div>
              <ul className="space-y-1 text-xs text-gray-300">
                {t.features.slice(0, 6).map((f) => <li key={f}>• {f}</li>)}
                {t.features.length > 6 && <li className="text-gray-500 italic">+ {t.features.length - 6} more</li>}
              </ul>
              {active && <div className="mt-3 text-[10px] uppercase font-bold text-brand-blue">✓ Selected</div>}
            </button>
          )
        })}
      </div>
      <div className="text-xs text-gray-500 italic">
        Creator and Pro tiers will be billed through the <strong className="text-pink-300">Liftori AI Payment Center</strong> (coming soon). Until it launches, your paid tier access is free — sign up now, get grandfathered pricing, and we'll notify you when billing activates.
      </div>
    </div>
  )
}

function ProfileSlide({ invite, password, setPassword, passwordConfirm, setPasswordConfirm, phone, setPhone, niche, setNiche, primaryPlatform, setPrimaryPlatform, audienceSize, setAudienceSize, bio, setBio, socials, setSocials }) {
  const valid = password.length >= 8
  const match = password === passwordConfirm && passwordConfirm.length > 0
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Set up your account</h1>
      <p className="text-gray-400">Login email: <span className="text-white font-medium">{invite.personal_email}</span></p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Password (8+ chars) *">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" autoComplete="new-password" />
          {password.length > 0 && <div className={`text-xs mt-1 ${valid ? 'text-emerald-400' : 'text-rose-400'}`}>{valid ? '✓ Strong' : `Need ${8 - password.length} more chars`}</div>}
        </Field>
        <Field label="Confirm password *">
          <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" autoComplete="new-password" />
          {passwordConfirm.length > 0 && <div className={`text-xs mt-1 ${match ? 'text-emerald-400' : 'text-rose-400'}`}>{match ? '✓ Match' : 'Passwords don\'t match'}</div>}
        </Field>
        <Field label="Phone (optional)">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(904) 555-0100" className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" />
        </Field>
        <Field label="Niche / content focus">
          <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Entrepreneurship, fitness, travel, etc." className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" />
        </Field>
        <Field label="Primary platform">
          <select value={primaryPlatform} onChange={(e) => setPrimaryPlatform(e.target.value)} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm">
            <option value="">— Select —</option>
            {['instagram','tiktok','youtube','linkedin','twitter','podcast','newsletter','other'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Total audience (approximate)">
          <select value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm">
            <option value="">— Select —</option>
            <option value="1000">Under 1K</option>
            <option value="5000">1K — 5K</option>
            <option value="25000">5K — 25K</option>
            <option value="100000">25K — 100K</option>
            <option value="500000">100K — 500K</option>
            <option value="1000000">500K+</option>
          </select>
        </Field>
      </div>
      <Field label="Short bio (optional)">
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="One or two lines about what you do" className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" />
      </Field>
      <div>
        <div className="text-[10px] uppercase font-semibold text-gray-500 mb-2">Social handles (optional)</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {['instagram','tiktok','youtube','linkedin','twitter','website'].map((s) => (
            <input
              key={s}
              value={socials[s]}
              onChange={(e) => setSocials((prev) => ({ ...prev, [s]: e.target.value }))}
              placeholder={s === 'website' ? 'https://yoursite.com' : `@${s}handle or URL`}
              className="bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm"
            />
          ))}
        </div>
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
        <div className="text-xs uppercase font-semibold text-gray-500 tracking-wide">{stepLabel}</div>
        <h1 className="text-3xl font-bold mt-1">{agreement.title}</h1>
        <p className="text-xs text-gray-500 mt-1">Version {agreement.version}</p>
      </div>
      <div
        onScroll={onScroll}
        className="bg-white text-slate-800 rounded-lg border-2 border-navy-700/50 p-6 max-h-80 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap font-serif"
      >
        {agreement.body}
      </div>
      {!scrolledToEnd && <div className="text-xs text-amber-400 italic">↓ Scroll to the bottom of the agreement to enable signing.</div>}
      <div className={scrolledToEnd ? '' : 'opacity-40 pointer-events-none'}>
        <div className="text-sm font-semibold text-white mb-2">Your signature</div>
        <SignaturePad defaultName={invite.full_name} requiredName={invite.full_name} onChange={onSigChange} />
        <p className="text-[10px] text-gray-500 mt-2 italic">
          We capture IP address, browser info, timestamp, and a SHA-256 hash of the agreement text for legal record.
        </p>
      </div>
    </div>
  )
}

function InstructionsSlide() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">How to use your Creator Platform</h1>
      <ol className="space-y-4">
        <Step n="1" title="Find your referral link" body="Top-right of your dashboard. Copy it, share it, track clicks + signups in real-time." />
        <Step n="2" title="Create content with the tools" body="Content Creator has templates for every hook and caption style. Scheduler handles auto-posting across platforms." />
        <Step n="3" title="Disclose the affiliate relationship" body="FTC-compliant disclosure templates are in the Content Library. Use #ad or 'Liftori affiliate' — we provide the exact language." />
        <Step n="4" title="Watch commissions roll in" body="Your dashboard shows pending + confirmed commissions. Paid monthly via ACH or PayPal once past the 30-day refund window." />
        <Step n="5" title="Upgrade when you're ready" body="Starter is free forever. Creator unlocks AI tools. Pro adds 1:1 consulting. Upgrade from your dashboard anytime." />
      </ol>
    </div>
  )
}

function DoneSlide({ invite }) {
  return (
    <div className="text-center space-y-6 py-10">
      <div className="text-7xl">🎉</div>
      <h1 className="text-4xl font-bold">You're in, {invite.full_name.split(' ')[0]}!</h1>
      <p className="text-lg text-gray-300 max-w-xl mx-auto">
        Your Creator Platform account is live and your contracts are signed. Redirecting to login…
      </p>
      <div className="text-sm text-gray-500">If you aren't redirected: <a href="https://admin.liftori.ai/login" className="text-brand-blue underline">admin.liftori.ai/login</a></div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────
function Card({ title, body, color }) {
  return (
    <div className="bg-navy-800/40 border border-navy-700/50 rounded-lg p-4">
      <div className={`font-semibold ${color}`}>{title}</div>
      <div className="text-sm text-gray-400 mt-1 leading-relaxed">{body}</div>
    </div>
  )
}
function ToolCard({ icon, name, body }) {
  return (
    <div className="bg-navy-800/40 border border-navy-700/50 rounded-lg p-3 flex items-start gap-3">
      <div className="text-2xl flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-semibold text-white text-sm">{name}</div>
        <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{body}</div>
      </div>
    </div>
  )
}
function CommissionCard({ tier, rate, bg }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${bg}`}>
      <div className="text-xs uppercase font-bold tracking-wider opacity-80">{tier}</div>
      <div className="text-3xl font-extrabold mt-2">{rate}</div>
      <div className="text-[10px] uppercase opacity-60 mt-1">of referred spend</div>
    </div>
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
