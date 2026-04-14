import { useState } from 'react'
import { toast } from 'sonner'
import { createTesterInvite, sendTesterInviteEmail } from '../../lib/testerProgramService'

/**
 * Admin-side modal: creates a new tester invite + immediately sends the Sage email.
 */
export default function InviteTesterModal({ invitedBy, onClose, onCreated }) {
  const [fullName, setFullName] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [rate, setRate] = useState('0.05')
  const [hoursPerWeek, setHoursPerWeek] = useState('10')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!fullName.trim() || !personalEmail.trim()) {
      toast.error('Name + email required')
      return
    }
    setBusy(true)
    try {
      const invite = await createTesterInvite({
        fullName: fullName.trim(),
        personalEmail: personalEmail.trim().toLowerCase(),
        customCommissionRate: Number(rate),
        customMinHoursPerWeek: Number(hoursPerWeek),
        inviteMessage: message.trim() || null,
        invitedBy,
      })
      const sendResult = await sendTesterInviteEmail(invite.id)
      if (sendResult?.error) {
        toast.error(`Invite saved but email failed: ${sendResult.error}`)
      } else {
        toast.success(`Invite sent to ${personalEmail}`)
      }
      onCreated?.(invite)
    } catch (err) {
      console.error(err)
      toast.error(err?.message?.includes('duplicate') ? 'This email already has a pending invite' : 'Failed to send invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-auto py-10 px-4">
      <form onSubmit={submit} className="bg-navy-900 border border-navy-700/50 rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <div>
            <h2 className="text-lg font-semibold">Invite a new tester</h2>
            <p className="text-xs text-gray-500 mt-0.5">Sage will email a tokenized onboarding link to this person.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full legal name *">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" placeholder="Jane Doe" />
            </Field>
            <Field label="Personal email *">
              <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} required className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" placeholder="jane@example.com" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Commission rate (0–1)">
              <input type="number" step="0.01" min="0" max="1" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" />
            </Field>
            <Field label="Hours/week minimum">
              <input type="number" step="0.5" min="0" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" />
            </Field>
          </div>
          <Field label="Personal message (optional)" hint="Will appear as a quote in the invite email.">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="e.g., Saw your work on X — would love your eye on this." className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm" />
          </Field>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            Invite link expires in 14 days. They can pause + resume the wizard at any point.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-navy-700/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm font-medium disabled:opacity-50">
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
