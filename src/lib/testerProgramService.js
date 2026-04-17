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

// ═══════════════════════════════════════════════
// FOUNDERS — hardcoded allowlist (Ryan + Mike)
// ═══════════════════════════════════════════════
export const LIFTORI_FOUNDERS = [
  'ryan@liftori.ai',
  'mike@liftori.ai',
  'rhinomarch78@gmail.com', // Ryan personal backup
  '4sherpanation@gmail.com', // Mike personal backup
]

export function isFounder(profileOrUser) {
  const email = (profileOrUser?.email || '').toLowerCase()
  const personal = (profileOrUser?.personal_email || '').toLowerCase()
  return LIFTORI_FOUNDERS.includes(email) || LIFTORI_FOUNDERS.includes(personal)
}

// ═══════════════════════════════════════════════
// TESTER ASSIGNMENTS — work assigned by founders to testers
// ═══════════════════════════════════════════════

export async function createAssignment({
  title,
  description = null,
  instructions = null,
  screenPath = null,
  priority = 'medium',
  dueDate = null,
  estimatedMinutes = null,
  assignedTo,
  assignedBy,
  tags = [],
}) {
  const { data, error } = await supabase
    .from('tester_assignments')
    .insert({
      title,
      description,
      instructions,
      screen_path: screenPath,
      priority,
      due_date: dueDate,
      estimated_minutes: estimatedMinutes,
      assigned_to: assignedTo,
      assigned_by: assignedBy,
      tags,
    })
    .select()
    .single()
  if (error) err(error, 'createAssignment')
  return data
}

export async function listAssignments({ assignedTo = null, status = null, limit = 100 } = {}) {
  let q = supabase.from('tester_assignments').select('*').order('created_at', { ascending: false }).limit(limit)
  if (assignedTo) q = q.eq('assigned_to', assignedTo)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) err(error, 'listAssignments')
  return data || []
}

export async function updateAssignment(id, updates) {
  const payload = { ...updates, updated_at: new Date().toISOString() }
  if (updates.status === 'in_progress' && !updates.started_at) payload.started_at = new Date().toISOString()
  if (updates.status === 'completed' && !updates.completed_at) payload.completed_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('tester_assignments')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) err(error, 'updateAssignment')
  return data
}

export async function deleteAssignment(id) {
  const { error } = await supabase.from('tester_assignments').delete().eq('id', id)
  if (error) err(error, 'deleteAssignment')
}

/**
 * Return assignments a tester has not yet viewed (for the center-screen alert).
 * Used by NewAssignmentsAlert on tester login.
 */
export async function listUnviewedAssignments(userId) {
  const { data, error } = await supabase
    .from('tester_assignments')
    .select('id, title, description, priority, screen_path, estimated_minutes, due_date, tags, created_at')
    .eq('assigned_to', userId)
    .is('viewed_at', null)
    .in('status', ['assigned', 'in_progress'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) err(error, 'listUnviewedAssignments')
  return data || []
}

/**
 * Mark a batch of assignments as viewed. Called when the tester dismisses
 * the center-screen alert so it does not re-appear for the same batch.
 */
export async function markAssignmentsViewed(ids) {
  if (!ids || ids.length === 0) return
  const { error } = await supabase
    .from('tester_assignments')
    .update({ viewed_at: new Date().toISOString() })
    .in('id', ids)
  if (error) err(error, 'markAssignmentsViewed')
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
  contractor_role: {
    version: '1.0',
    title: 'Liftori Tester Role & Commission Agreement',
    body: `LIFTORI, LLC — TESTER ROLE & COMMISSION AGREEMENT (v1.0)

This Tester Role & Commission Agreement ("Agreement") is entered into as of the signature date below by and between Liftori, LLC ("Liftori"), a Florida limited liability company, and the undersigned individual ("Tester"). This Agreement supplements the Mutual Non-Disclosure Agreement and the 1099 Independent Contractor Agreement also signed by Tester.

1. ROLE DESCRIPTION

Tester is engaged to provide platform quality testing services to Liftori, including but not limited to:
   (a) Testing the functionality, usability, and reliability of Liftori's platform across all surfaces (admin dashboards, client portals, mobile views, public pages).
   (b) Identifying, documenting, and reporting bugs, regressions, friction points, and security issues using Liftori's structured Work Log system.
   (c) Validating new features against acceptance criteria.
   (d) Walking through user workflows as a real user would, on multiple devices and browsers.
   (e) Completing assigned testing tasks issued by Liftori founders.

2. OBLIGATIONS OF TESTER

Tester agrees to:
   (a) Maintain strict confidentiality of all platform features, data, and business operations witnessed during testing, in accordance with the signed Mutual NDA.
   (b) Submit honest, accurate, and detailed bug reports. Falsified, exaggerated, or manufactured reports are grounds for immediate termination and forfeiture of any unpaid commission.
   (c) Use platform access solely for testing purposes — not for personal use, not for competitive analysis on behalf of any third party, and not to access customer data beyond what is necessary to test.
   (d) Never share login credentials, tokens, or access keys with any third party.
   (e) Report any discovered security vulnerabilities, data exposures, or critical defects to Liftori immediately and confidentially via the #critical-bugs channel — never publicly disclose, post on social media, or share with anyone outside Liftori.
   (f) Maintain professional conduct in all communications with Liftori founders, team members, and customers (when impersonating tenants for testing).
   (g) Clock in for all billable testing time using Liftori's time-tracking system. Time not clocked in is not eligible for commission consideration.
   (h) Provide notice and remit any Liftori property, credentials, or access immediately upon termination of this Agreement.

3. COMMISSION STRUCTURE

(a) Compensation Model. Tester is compensated solely through a commission share of Liftori's monthly net profit pool. There is no salary, hourly wage, or per-bug payment.

(b) Pool Calculation. Liftori contributes a percentage of its monthly net profit (the "Tester Commission Rate," default five percent (5%)) to the Tester Commission Pool each month. The Tester's individual rate is recorded in Liftori's tester enrollment system at the time of onboarding.

(c) Minimum Commitment. To qualify for a given monthly period, Tester must clock at least ten (10) hours per week of testing activity (the "Minimum Hours"). Hours are measured by Liftori's time-tracking system.

(d) Effort Measurement. Tester's effort is measured by both (i) clocked hours and (ii) tracked activity per session, including but not limited to the number, severity, quality, and accuracy of work log entries submitted, completion of assigned tasks, and engagement with platform testing flows. Liftori reserves the right to disqualify any tester whose tracked activity does not reasonably correspond to claimed clocked hours.

(e) Pool Split. The Tester Commission Pool for a given month is split evenly among all Testers who meet the Minimum Hours and pass the activity check for that month.

(f) PROFIT-CONTINGENT PAYMENT — CARRY-OVER RULE. The Tester Commission Pool is funded only from Liftori's monthly net profit. If Liftori has zero or negative net profit for a given month, no commission is paid for that month. However, Tester's qualifying status (hours and activity) for that month is preserved and carries forward to subsequent months. When Liftori achieves a profitable month, Tester will receive their accrued share for all prior qualifying carried-over periods, in addition to the current month's share. This carry-over has no expiration; Liftori commits to making qualifying testers whole once profitability is achieved.

(g) Payout Method and Timing. Commission payouts are issued via Tester's designated payment method (ACH, check, or other agreed method) within thirty (30) days of the period being closed and marked paid by Liftori. All payouts are reported on IRS Form 1099 per the 1099 Independent Contractor Agreement.

(h) No Guarantee. Tester acknowledges that commission amounts are inherently variable and dependent on Liftori's monthly net profit, the number of qualifying testers, and individual qualification status. Liftori makes no representation or warranty regarding any minimum commission amount.

4. TERMINATION

(a) Termination by Either Party. Either party may terminate this Agreement at any time, with or without cause, by providing fourteen (14) days written notice to the other party (electronic notice via Liftori's platform or email is sufficient).

(b) Immediate Termination for Cause by Liftori. Liftori may terminate this Agreement immediately, without notice and without further obligation, for any of the following reasons:
   (i) Breach of confidentiality, including but not limited to disclosing Liftori's proprietary information, customer data, or platform vulnerabilities to any third party.
   (ii) Submission of falsified, fraudulent, or materially inaccurate bug reports or time entries.
   (iii) Misuse of platform access, including unauthorized access to customer data, attempts to circumvent security controls, or use of access for purposes other than testing.
   (iv) Public disclosure of Liftori vulnerabilities, defects, or business information without prior written authorization.
   (v) Failure to clock the Minimum Hours for three (3) consecutive monthly periods, absent a documented leave arrangement.
   (vi) Conduct that materially harms Liftori's reputation, customer relationships, or business operations.
   (vii) Violation of any term of the Mutual NDA or 1099 Independent Contractor Agreement.

(c) Effect of Termination. Upon termination:
   (i) Tester's platform access will be revoked.
   (ii) Tester remains bound by ongoing confidentiality obligations under the Mutual NDA.
   (iii) Any qualifying commission accrued and unpaid up to the termination date will be paid out in the next paid period, EXCEPT in cases of termination for cause under Section 4(b)(i)–(iv), in which case Liftori may forfeit unpaid amounts.
   (iv) Carried-over qualifying periods (per Section 3(f)) are preserved through termination only when termination is mutual or for non-cause; carry-over balances are forfeited upon termination for cause under Section 4(b)(i)–(iv).

5. INDEPENDENT CONTRACTOR STATUS

Tester is an independent contractor and not an employee, agent, partner, or joint venturer of Liftori. Liftori does not control the manner, location, or specific hours during which Tester performs testing services, only the deliverables and minimum commitment. Tester is responsible for their own taxes, equipment, internet, workspace, insurance, and benefits.

6. INTELLECTUAL PROPERTY

All bug reports, suggestions, observations, test results, and any other work product created by Tester in the course of performing services under this Agreement are the sole and exclusive property of Liftori. Tester hereby assigns all right, title, and interest in such work product to Liftori upon creation.

7. NO COMPETING ENGAGEMENTS

While engaged with Liftori, Tester agrees not to provide testing or quality assurance services to any direct competitor of Liftori without prior written consent. Direct competitors include other AI-powered platform delivery services, business operating system vendors targeting small business markets, and white-label SaaS builders.

8. INDEMNIFICATION

Tester agrees to indemnify and hold Liftori harmless from any claims, damages, or losses arising from Tester's negligence, willful misconduct, breach of this Agreement, or unauthorized disclosure of Confidential Information.

9. ENTIRE AGREEMENT; AMENDMENTS

This Agreement, together with the Mutual NDA and 1099 Independent Contractor Agreement, constitutes the entire agreement between the parties regarding Tester's engagement. Any amendments must be in writing and signed by both parties. Liftori may update the commission rate, minimum hours threshold, or payout terms with thirty (30) days written notice; continued participation by Tester after such notice constitutes acceptance.

10. GOVERNING LAW; DISPUTE RESOLUTION

This Agreement is governed by the laws of the State of Florida. Any disputes shall first be addressed through good-faith direct negotiation between the parties, and if unresolved within thirty (30) days, shall be resolved in the courts of Duval County, Florida.

11. ACKNOWLEDGMENT

By signing below, Tester acknowledges that they have read this Agreement in its entirety, have had the opportunity to ask questions, understand the commission structure including the profit-contingent carry-over rule, understand the obligations and grounds for termination, and agree to be bound by all terms herein.`,
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
