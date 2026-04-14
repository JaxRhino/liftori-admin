import { useState } from 'react'
import { toast } from 'sonner'
import {
  createAffiliateInvite,
  sendAffiliateInviteEmail,
  AFFILIATE_TIERS,
  getTier,
} from '../../lib/affiliateProgramService'

export default function InviteAffiliateModal({ invitedBy, onClose, onCreated }) {
  const [fullName, setFullName] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [proposedTier, setProposedTier] = useState('free')
  const [customCommissionRate, setCustomCommissionRate] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [socials, setSocials] = useState({ instagram: '', tiktok: '', youtube: '' })
  const [busy, setBusy] = useState(false)

  const defaultRate = getTier(proposedTier).commissionRate

  async function submit(e) {
    e.preventDefault()
    if (!fullName.trim() || !personalEmail.trim()) {
      toast.error('Name + email required')
      return
    }
    setBusy(true)
    try {
      const invite = await createAffiliateInvite({
        fullName: fullName.trim(),
        personalEmail: personalEmail.trim().toLowerCase(),
        proposedTier,
        customCommissionRate: customCommissionRate ? Number(customCommissionRate) : undefined,
        inviteMessage: inviteMessage.trim() || null,
        socialHandles: Object.fromEntries(Object.entries(socials).filter(([, v]) => v.trim())),
        invitedBy,
      })
      const sendResult = await sendAffiliateInviteEmail(invite.id)
      if (sendResult?.error) {
        toast.error(`Invite saved, email failed: ${sendResult.error}`)
      } else {
        toast.success(`Invite sent to ${personalEmail}`)
      }
      onCreated?.(invite)
    } catch (err) {
      console.error(err)
      toast.error(err?.message?.includes('duplicate') ? 'This email already has an invite' : 'Failed to send invite')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-auto py-10 px-4">
      <form onSubmit={submit} className="bg-navy-900 border border-navy-700/50 rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <div>
            <h2 className="text-lg font-semibold text-white">Invite a Creator</h2>
            <p className="text-xs text-gray-500 mt-0.5">Sage will email them a tokenized onboarding link.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full legal name *">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" placeholder="Jane Creator" />
            </Field>
            <Field label="Personal email *">
              <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} required className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" placeholder="jane@example.com" />
            </Field>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-gray-500 mb-2">Proposed tier</div>
            <div className="grid grid-cols-3 gap-2">
              {AFFILIATE_TIERS.map((t) => {
                const active = proposedTier === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setProposedTier(t.key)}
                    className={`p-3 rounded-lg border-2 text-left transition ${
                      active ? 'bg-brand-blue/10 border-brand-blue' : 'bg-navy-800 border-navy-700/50 hover:border-navy-600'
                    }`}
                  >
                    <div className="text-sm font-bold text-white">{t.label}</div>
                    <div className="text-[10px] text-gray-400">{t.price === 0 ? 'Free' : `$${t.price}/mo`}</div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">{(t.commissionRate * 100).toFixed(0)}% commission</div>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-500 italic mt-2">Creator picks their actual starting tier during onboarding. This is the recommended default.</p>
          </div>
          <Field label="Custom commission rate (optional, 0–1)" hint={`Default for ${getTier(proposedTier).label}: ${(defaultRate * 100).toFixed(0)}%. Override for premium creators.`}>
            <input type="number" step="0.01" min="0" max="1" value={customCommissionRate} onChange={(e) => setCustomCommissionRate(e.target.value)} placeholder={String(defaultRate)} className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          </Field>
          <Field label="Personal message (optional)">
            <textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} rows={2} placeholder="Why you'd be a great fit for our Creator program…" className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          </Field>
          <div>
            <div className="text-[10px] uppercase font-semibold text-gray-500 mb-2">Social handles (optional)</div>
            <div className="grid grid-cols-3 gap-2">
              {['instagram','tiktok','youtube'].map((s) => (
                <input
                  key={s}
                  value={socials[s]}
                  onChange={(e) => setSocials((prev) => ({ ...prev, [s]: e.target.value }))}
                  placeholder={`@${s}`}
                  className="bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white"
                />
              ))}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs">
            Invite expires in 14 days. Creator walks the wizard, e-signs NDA + Affiliate Agreement, picks tier, lands in their Creator Platform.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-navy-700/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {busy ? 'Sending…' : 'Create + send invite'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-semibold text-gray-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block text-[10px] text-gray-500 mt-1 italic">{hint}</span>}
    </label>
  )
}
