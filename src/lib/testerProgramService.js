import { supabase } from './supabase'

function err(e, fn) { console.error(`[testerProgramService.${fn}]`, e); throw e }

// ═══════════════════════════════════════════════
// ADMIN-SIDE: Invite management
// ═══════════════════════════════════════════════

/**
 * Generate a URL-safe random token (32 chars).
 */
export function generateToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, 'x')
}

export async function createTesterInvite({ fullName, personalEmail, customCommissionRate = 0.05, customMinHoursPerWeek = 10, inviteMessage = null, invitedBy }) {
  const token = generateToken()
  const { data, error } = await supabase
    .from('tester_invites')
    .insert({
      token,
      full_name: fullName,
      personal_email: personalEmail,
      custom_commission_rate: customCommissionRate,
      custom_min_hours_per_week: customMinHoursPerWeek,
      invite_message: inviteMessage,
      invited_by: invitedBy,
    })
    .select()
    .single()
  if (error) err(error, 'createTesterInvite')
  return data
}

export async function sendTesterInviteEmail(inviteId) {
  const { data, error } = await supabase.functions.invoke('send-tester-invite', {
    body: { invite_id: inviteId },
  })
  if (error) err(error, 'sendTesterInviteEmail')
  return data
}

export async function listTesterInvites({ status = null, limit = 50 } = {}) {
  let q = supabase.from('tester_invites').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) err(error, 'listTesterInvites')
  return data || []
}

export async function cancelTesterInvite(id) {
  const { data, error } = await supabase
    .from('tester_invites')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) err(error, 'cancelTesterInvite')
  return data
}

export async function resendTesterInvite(id) {
  // Reset email_sent_at + status; re-send
  await supabase
    .from('tester_invites')
    .update({ status: 'pending', email_sent_at: null, email_send_error: null })
    .eq('id', id)
  return sendTesterInviteEmail(id)
}

// ═══════════════════════════════════════════════
// PUBLIC-SIDE: Onboarding flow
// ═══════════════════════════════════════════════

export async function fetchInviteByToken(token) {
  const { data, error } = await supabase
    .from('tester_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') err(error, 'fetchInviteByToken')
  return data || null
}

export async function markInviteOpened(token) {
  // Only set opened_at the first time it's accessed
  const invite = await fetchInviteByToken(token)
  if (!invite) return null
  if (!invite.opened_at) {
    await supabase
      .from('tester_invites')
      .update({ status: invite.status === 'pending' ? 'opened' : invite.status, opened_at: new Date().toISOString() })
      .eq('id', invite.id)
  }
  // Ensure progress row exists
  await supabase
    .from('tester_onboarding_progress')
    .upsert({ invite_id: invite.id, current_slide: 'welcome' }, { onConflict: 'invite_id' })
  return invite
}

export async function updateOnboardingProgress(inviteId, updates) {
  const { data, error } = await supabase
    .from('tester_onboarding_progress')
    .update(updates)
    .eq('invite_id', inviteId)
    .select()
    .maybeSingle()
  if (error) console.error('[updateOnboardingProgress]', error)
  return data
}

export async function fetchOnboardingProgress(inviteId) {
  const { data } = await supabase
    .from('tester_onboarding_progress')
    .select('*')
    .eq('invite_id', inviteId)
    .maybeSingle()
  return data || null
}

/**
 * Hash agreement text so we can later prove what was signed.
 * SHA-256 → hex.
 */
export async function hashText(text) {
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Complete the wizard — calls the edge function that:
 * - creates auth user with provided password
 * - upgrades profile to tester role
 * - creates tester_enrollments row
 * - inserts agreement_signatures (NDA + 1099 required)
 * - inserts team_availability rows
 * - marks invite + progress completed
 */
export async function completeOnboarding({ token, password, profile, availability, signatures }) {
  const { data, error } = await supabase.functions.invoke('tester-onboarding-complete', {
    body: { token, password, profile, availability, signatures },
  })
  if (error) err(error, 'completeOnboarding')
  return data
}

// ═══════════════════════════════════════════════
// AGREEMENT TEXTS (versioned, hashed for proof)
// ═══════════════════════════════════════════════

export const AGREEMENT_TEXTS = {
  nda: {
    version: '1.0',
    title: 'Mutual Non-Disclosure Agreement',
    body: `LIFTORI, LLC — MUTUAL NON-DISCLOSURE AGREEMENT (v1.0)

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of the signature date below by and between Liftori, LLC ("Liftori"), a Florida limited liability company, and the undersigned individual ("Tester").

1. CONFIDENTIAL INFORMATION. "Confidential Information" means any non-public information disclosed by Liftori to Tester, including but not limited to product designs, source code, customer lists, financial data, business strategies, and any other information marked or reasonably understood as confidential.

2. OBLIGATIONS. Tester agrees to (a) hold all Confidential Information in strict confidence, (b) not disclose any Confidential Information to any third party without prior written consent of Liftori, (c) use Confidential Information solely to perform testing duties for Liftori, and (d) take reasonable measures to protect such Confidential Information.

3. EXCEPTIONS. Confidential Information does not include information that (a) is or becomes publicly available through no fault of Tester, (b) was rightfully known to Tester before disclosure, or (c) is independently developed by Tester without use of Liftori's Confidential Information.

4. TERM. The obligations under this Agreement commence on the signature date and continue for three (3) years after termination of Tester's engagement with Liftori.

5. RETURN OF INFORMATION. Upon termination or written request, Tester shall promptly return or destroy all Confidential Information.

6. NO LICENSE. Nothing in this Agreement grants Tester any license, ownership, or other right in any Confidential Information or Liftori intellectual property.

7. REMEDIES. Tester acknowledges that breach of this Agreement may cause irreparable harm to Liftori, and Liftori is entitled to seek injunctive relief in addition to any other remedies available at law or in equity.

8. GOVERNING LAW. This Agreement is governed by the laws of the State of Florida.

By signing below, Tester acknowledges they have read, understood, and agree to be bound by this Agreement.`,
  },
  contractor_1099: {
    version: '1.0',
    title: '1099 Independent Contractor Agreement',
    body: `LIFTORI, LLC — 1099 INDEPENDENT CONTRACTOR AGREEMENT (v1.0)

This Independent Contractor Agreement ("Agreement") is entered into as of the signature date below by and between Liftori, LLC ("Liftori") and the undersigned ("Contractor").

1. SERVICES. Contractor agrees to provide platform testing services to Liftori, including but not limited to: testing software functionality, identifying and reporting bugs, documenting user experience issues, and validating new features. Specific scope of work may be assigned from time to time.

2. INDEPENDENT CONTRACTOR STATUS. Contractor is an independent contractor and not an employee, agent, partner, or joint venturer of Liftori. Contractor is responsible for their own taxes, insurance, and benefits. Liftori will issue Form 1099 for tax reporting purposes.

3. COMPENSATION. Contractor will receive a share of the monthly tester commission pool, calculated as a percentage of Liftori's monthly net profit. Specific commission rate and minimum-hours threshold are stated in the invitation that accompanies this Agreement and are recorded in Liftori's tester enrollment system.

4. PAYMENT TERMS. Commission payouts are calculated at the end of each monthly period after the period is closed by Liftori. Payments will be issued via the method designated by Contractor (ACH, check, or other agreed method) within thirty (30) days of period close.

5. INTELLECTUAL PROPERTY. All work product, including but not limited to bug reports, test results, suggestions, and feedback created by Contractor in the course of services becomes the sole property of Liftori upon creation. Contractor assigns all right, title, and interest in such work product to Liftori.

6. CONFIDENTIALITY. Contractor's confidentiality obligations are governed by the Mutual Non-Disclosure Agreement signed alongside this Agreement.

7. TERMINATION. Either party may terminate this Agreement at any time, with or without cause, by providing written notice to the other party. Outstanding accrued commissions for the period in which termination occurs will be paid out per Section 4.

8. NO BENEFITS. Contractor acknowledges they are not entitled to any employee benefits, including but not limited to health insurance, retirement plans, paid time off, or workers' compensation.

9. INDEMNIFICATION. Contractor agrees to indemnify Liftori against any claims arising from Contractor's negligence or willful misconduct.

10. GOVERNING LAW. This Agreement is governed by the laws of the State of Florida and any disputes shall be resolved in the courts of Duval County, Florida.

By signing below, Contractor acknowledges they have read, understood, and agree to be bound by this Agreement, and that they are entering into this Agreement as an independent contractor.`,
  },
}
