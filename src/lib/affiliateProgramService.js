import { supabase } from './supabase'

function err(e, fn) { console.error(`[affiliateProgramService.${fn}]`, e); throw e }

// ═══════════════════════════════════════════════
// TIERS
// ═══════════════════════════════════════════════
export const AFFILIATE_TIERS = [
  {
    key: 'free',
    label: 'Starter',
    tagline: 'Free forever — get tools and earn commission',
    price: 0,
    commissionRate: 0.10,
    features: [
      'Content Creator + 500 MB library',
      'Scheduler (1 account, 10 posts/mo)',
      '10 AI content ideas / month',
      'Basic CRM + Inventory tracker',
      'Notes, Tasks, Calendar, Chat, Support',
      'Link-in-bio builder (1 page)',
      '1-platform analytics dashboard',
      '10% commission on referrals',
    ],
  },
  {
    key: 'creator',
    label: 'Creator',
    tagline: 'AI-assisted tools for serious growth',
    price: 29,
    commissionRate: 0.15,
    features: [
      'Everything in Starter, plus:',
      'AI content + caption + hook generator',
      'Short-form clipper (50 clips/mo)',
      'AI thumbnail generator',
      'Unlimited scheduler (5 accounts)',
      'Multi-platform analytics + insights',
      'AI brand pitch writer + rate card',
      '10 GB library',
      '15% commission on referrals',
    ],
  },
  {
    key: 'pro',
    label: 'Pro',
    tagline: 'Consulting + dedicated success manager',
    price: 149,
    commissionRate: 0.20,
    features: [
      'Everything in Creator, plus:',
      'Monthly 1:1 strategy call',
      'Brand deal negotiation support',
      'Quarterly content strategy audit',
      'Legal contract review',
      'Dedicated success manager',
      'Unlimited everything',
      'Priority support',
      '20% commission on referrals',
    ],
  },
]

export function getTier(key) {
  return AFFILIATE_TIERS.find((t) => t.key === key) || AFFILIATE_TIERS[0]
}

// ═══════════════════════════════════════════════
// UTIL
// ═══════════════════════════════════════════════
export function generateToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, 'x')
}

export async function hashText(text) {
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ═══════════════════════════════════════════════
// ADMIN — Invite management
// ═══════════════════════════════════════════════
export async function createAffiliateInvite({ fullName, personalEmail, proposedTier = 'free', customCommissionRate, inviteMessage = null, socialHandles = {}, invitedBy }) {
  const token = generateToken()
  const rate = customCommissionRate ?? getTier(proposedTier).commissionRate
  const { data, error } = await supabase
    .from('affiliate_invites')
    .insert({
      token,
      full_name: fullName,
      personal_email: personalEmail,
      proposed_tier: proposedTier,
      custom_commission_rate: rate,
      invite_message: inviteMessage,
      social_handles: socialHandles,
      invited_by: invitedBy,
    })
    .select()
    .single()
  if (error) err(error, 'createAffiliateInvite')
  return data
}

export async function sendAffiliateInviteEmail(inviteId) {
  const { data, error } = await supabase.functions.invoke('send-affiliate-invite', {
    body: { invite_id: inviteId },
  })
  if (error) err(error, 'sendAffiliateInviteEmail')
  return data
}

export async function listAffiliateInvites({ status = null, limit = 50 } = {}) {
  let q = supabase.from('affiliate_invites').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) err(error, 'listAffiliateInvites')
  return data || []
}

export async function cancelAffiliateInvite(id) {
  const { data, error } = await supabase
    .from('affiliate_invites')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) err(error, 'cancelAffiliateInvite')
  return data
}

export async function resendAffiliateInvite(id) {
  await supabase
    .from('affiliate_invites')
    .update({ status: 'pending', email_sent_at: null, email_send_error: null })
    .eq('id', id)
  return sendAffiliateInviteEmail(id)
}

export async function fetchAffiliateEnrollments({ activeOnly = true } = {}) {
  let q = supabase.from('affiliate_enrollments').select('*')
  if (activeOnly) q = q.is('ended_at', null)
  const { data, error } = await q.order('enrolled_at', { ascending: false })
  if (error) err(error, 'fetchAffiliateEnrollments')
  return data || []
}

export async function fetchMyAffiliateEnrollment(userId) {
  const { data, error } = await supabase
    .from('affiliate_enrollments')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') err(error, 'fetchMyAffiliateEnrollment')
  return data || null
}

// ═══════════════════════════════════════════════
// PUBLIC — Onboarding
// ═══════════════════════════════════════════════
export async function fetchAffiliateInviteByToken(token) {
  const { data, error } = await supabase
    .from('affiliate_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') err(error, 'fetchAffiliateInviteByToken')
  return data || null
}

export async function markAffiliateInviteOpened(token) {
  const invite = await fetchAffiliateInviteByToken(token)
  if (!invite) return null
  if (!invite.opened_at) {
    await supabase
      .from('affiliate_invites')
      .update({ status: invite.status === 'pending' ? 'opened' : invite.status, opened_at: new Date().toISOString() })
      .eq('id', invite.id)
  }
  await supabase
    .from('affiliate_onboarding_progress')
    .upsert({ invite_id: invite.id, current_slide: 'welcome' }, { onConflict: 'invite_id' })
  return invite
}

export async function updateAffiliateProgress(inviteId, updates) {
  const { data, error } = await supabase
    .from('affiliate_onboarding_progress')
    .update(updates)
    .eq('invite_id', inviteId)
    .select()
    .maybeSingle()
  if (error) console.error('[updateAffiliateProgress]', error)
  return data
}

export async function fetchAffiliateProgress(inviteId) {
  const { data } = await supabase
    .from('affiliate_onboarding_progress')
    .select('*')
    .eq('invite_id', inviteId)
    .maybeSingle()
  return data || null
}

export async function completeAffiliateOnboarding({ token, password, profile, tier, signatures }) {
  const { data, error } = await supabase.functions.invoke('affiliate-onboarding-complete', {
    body: { token, password, profile, tier, signatures },
  })
  if (error) err(error, 'completeAffiliateOnboarding')
  return data
}

// ═══════════════════════════════════════════════
// AGREEMENT TEXTS
// ═══════════════════════════════════════════════
export const AFFILIATE_AGREEMENT_TEXTS = {
  nda: {
    version: '1.0',
    title: 'Mutual Non-Disclosure Agreement',
    body: `LIFTORI, LLC — MUTUAL NON-DISCLOSURE AGREEMENT (v1.0)

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of the signature date below by and between Liftori, LLC ("Liftori"), a Florida limited liability company, and the undersigned individual ("Creator").

1. CONFIDENTIAL INFORMATION. "Confidential Information" means any non-public information disclosed by Liftori to Creator, including product roadmaps, source code, customer lists, financial data, pricing, business strategies, and any other information marked or reasonably understood as confidential.

2. OBLIGATIONS. Creator agrees to (a) hold all Confidential Information in strict confidence, (b) not disclose Confidential Information to any third party without prior written consent, (c) use Confidential Information solely to perform creator and affiliate duties for Liftori, and (d) take reasonable measures to protect such information.

3. EXCEPTIONS. Confidential Information does not include information that (a) is or becomes publicly available through no fault of Creator, (b) was rightfully known to Creator before disclosure, or (c) is independently developed without use of Confidential Information.

4. TERM. Obligations continue for three (3) years after termination of Creator's engagement with Liftori.

5. RETURN OF INFORMATION. Upon termination or written request, Creator shall promptly return or destroy all Confidential Information.

6. NO LICENSE. Nothing in this Agreement grants Creator any license, ownership, or right in Liftori's Confidential Information or intellectual property.

7. REMEDIES. Creator acknowledges that breach may cause irreparable harm to Liftori, and Liftori is entitled to injunctive relief in addition to any other remedies at law or in equity.

8. GOVERNING LAW. This Agreement is governed by the laws of the State of Florida.

By signing below, Creator acknowledges they have read, understood, and agree to be bound by this Agreement.`,
  },
  affiliate: {
    version: '1.0',
    title: 'Liftori Creator & Affiliate Agreement',
    body: `LIFTORI, LLC — CREATOR & AFFILIATE AGREEMENT (v1.0)

This Creator & Affiliate Agreement ("Agreement") is entered into as of the signature date below by and between Liftori, LLC ("Liftori"), a Florida limited liability company, and the undersigned individual ("Creator"). This Agreement is supplemented by the Mutual Non-Disclosure Agreement also signed by Creator.

1. ROLE OVERVIEW

Creator is engaged as an independent affiliate partner of Liftori. Liftori provides Creator with access to its Creator Platform (the "Platform") — a suite of tools including content creation, scheduling, CRM, inventory tracking, notes, tasks, calendar, chat, support, and tier-specific AI and consulting services. In exchange, Creator may refer their audience to Liftori products and earn commission per Section 3.

2. CREATOR OBLIGATIONS

Creator agrees to:
   (a) Maintain confidentiality per the signed Mutual NDA.
   (b) Create and share honest, good-faith content about Liftori products. Fabricated claims, misleading statements, or exaggerated results are grounds for termination.
   (c) Clearly disclose the affiliate relationship when promoting Liftori, in compliance with FTC Endorsement Guides (16 CFR Part 255) and equivalent laws in Creator's jurisdiction. Disclosures must be conspicuous — e.g., "#ad," "#sponsored," "Liftori affiliate," or equivalent plain-language disclosure.
   (d) Not engage in prohibited marketing tactics: spam, unsolicited mass email, brand bidding on Liftori trademarks in paid search, cookie stuffing, or any form of fraudulent traffic generation.
   (e) Not impersonate Liftori staff, use Liftori trademarks in a misleading way, or imply an employment relationship.
   (f) Not share access to the Creator Platform with third parties, including VA assistants, without prior written consent.
   (g) Use best efforts to publish at minimum one piece of content per calendar month mentioning or promoting Liftori (Creator and Pro tiers only).
   (h) Report any technical issues, security concerns, or data exposures to Liftori immediately and confidentially — never publicly.

3. COMMISSION STRUCTURE

(a) Tier Model. Creator's tier (Free "Starter," Creator, or Pro) determines both their Platform access level and their commission rate on Liftori referrals. Default rates:
     - Starter: 10%
     - Creator: 15%
     - Pro: 20%
Specific rates may be negotiated per-Creator and are recorded in Liftori's affiliate enrollment system at the time of onboarding.

(b) Qualifying Referral. A "qualifying referral" is a paid customer who (i) purchases a Liftori product or subscription within 60 days of clicking Creator's unique referral link, and (ii) remains a customer for at least 30 days (the Refund Window).

(c) Payout Timing. Commissions are calculated monthly and paid within 30 days of the end of the month in which the Refund Window closes. Payments issued via Creator's designated method (ACH, PayPal, check) and reported on IRS Form 1099 if commissions exceed $600 annually.

(d) Tracking. Referrals are tracked via Creator's unique referral code and cookie-based attribution with a 60-day window. Creator acknowledges that tracking is not perfect and that browser settings, ad blockers, and cross-device journeys may affect attribution. Liftori will act in good faith to resolve disputed attributions.

(e) Subscription Fees. Creator and Pro tiers include a monthly subscription fee ($29 / $149 respectively as of v1.0). Creator authorizes Liftori (via Stripe) to bill the selected method on the first of each month. Subscriptions auto-renew. Creator may downgrade or cancel at any time; refunds for partial months are not provided.

(f) Offset Against Subscription. For Creator and Pro tiers, Liftori may offset unpaid subscription fees against earned commissions in a given month before issuing payout. Creator will receive a clear accounting of the offset.

(g) No Guarantee. Commission amounts are variable and dependent on Creator's audience engagement and conversion. Liftori makes no representation regarding minimum commission earnings.

4. INTELLECTUAL PROPERTY

(a) Creator Content. Creator retains ownership of all content they create and publish on external platforms (their social channels, websites, podcasts, etc.) referencing Liftori.

(b) Platform Content. All tools, designs, databases, AI outputs, and any work product generated within the Creator Platform that is not Creator's own original expression (e.g., templates, default library assets, brand style data, analytics) remains the property of Liftori.

(c) License to Use Marks. Liftori grants Creator a limited, non-exclusive, revocable license to use Liftori trademarks and logos solely to promote Liftori products in accordance with Liftori's brand guidelines. Creator shall not modify the marks or use them in a way that disparages Liftori.

(d) AI-Generated Content. Content generated by Platform AI tools (Creator and Pro tiers) is provided to Creator under a perpetual, worldwide, royalty-free license for Creator's use in their content, subject to Section 2(b) (honest claims) and applicable platform policies of the channels Creator publishes to.

5. TERMINATION

(a) Termination by Either Party. Either party may terminate this Agreement at any time, with or without cause, by providing fourteen (14) days written notice (electronic notice via the Platform or email is sufficient).

(b) Immediate Termination for Cause by Liftori. Liftori may terminate immediately, without notice or further obligation, for:
   (i) Breach of confidentiality or the NDA.
   (ii) Fraudulent referral activity (fake signups, self-referrals, cookie stuffing, trademark bidding).
   (iii) Misleading, false, or defamatory public statements about Liftori.
   (iv) Failure to disclose the affiliate relationship as required by FTC or local law.
   (v) Misuse of the Creator Platform — unauthorized access, sharing credentials, or using the Platform to compete with Liftori.
   (vi) Violation of any term of this Agreement or the NDA.

(c) Effect of Termination.
   (i) Platform access revoked immediately.
   (ii) Creator remains bound by NDA confidentiality obligations.
   (iii) Accrued but unpaid commissions from qualifying referrals will be paid in the next payment cycle, EXCEPT in cases of for-cause termination under Section 5(b)(i)–(v), where Liftori may forfeit unpaid amounts.
   (iv) Any active paid subscription fees are non-refundable for the current billing period but will not renew.
   (v) Referral cookies become void for new signups; existing qualifying referrals continue to generate commission through the end of the Refund Window.

6. REPRESENTATIONS AND WARRANTIES

Creator represents and warrants that:
   (a) They are at least 18 years of age.
   (b) They have the legal right and capacity to enter this Agreement.
   (c) Any content they create about Liftori is their own original work or properly licensed.
   (d) They comply with all applicable laws, platform terms of service, and tax obligations in their jurisdiction.

7. INDEPENDENT CONTRACTOR STATUS

Creator is an independent contractor, not an employee, agent, or partner of Liftori. Creator has no authority to bind Liftori or make representations on its behalf beyond the scope of approved marketing materials. Creator is responsible for their own taxes, insurance, and business expenses.

8. INDEMNIFICATION

Creator agrees to indemnify and hold Liftori harmless from any claims, damages, or losses arising from Creator's content, negligence, willful misconduct, or breach of this Agreement — including but not limited to FTC/FCC disclosure violations, defamation claims against Creator's content, or tax disputes.

9. LIMITATION OF LIABILITY

Liftori's total liability under this Agreement is capped at the greater of (i) the commissions paid to Creator in the preceding 12 months, or (ii) $1,000. In no event is Liftori liable for indirect, consequential, or punitive damages, including lost profits or reputational harm.

10. NO COMPETING CREATOR PROGRAMS

While enrolled in the Creator Platform, Creator agrees not to actively promote a direct competitor's similar creator/affiliate platform to their audience. Direct competitors include other AI-powered creator business operating systems. This does not restrict Creator from promoting individual tools (e.g., Canva, Notion) that are component-level rather than platform-level alternatives.

11. AMENDMENTS

Liftori may update commission rates, subscription pricing, or Platform features with thirty (30) days written notice. Creator's continued participation constitutes acceptance. Material reductions in commission rates or increases in subscription price that Creator does not accept give Creator the right to terminate without penalty.

12. GOVERNING LAW; DISPUTES

This Agreement is governed by the laws of the State of Florida. Disputes shall first be addressed via good-faith direct negotiation. If unresolved within 30 days, disputes shall be resolved in the courts of Duval County, Florida.

13. ENTIRE AGREEMENT

This Agreement, together with the Mutual NDA, constitutes the entire agreement between the parties regarding Creator's engagement. Any amendments must be in writing.

By signing below, Creator acknowledges they have read this Agreement in its entirety, understand the tier-based commission and subscription structure, understand the FTC disclosure and fraudulent-referral grounds for termination, and agree to be bound by all terms herein.`,
  },
}
