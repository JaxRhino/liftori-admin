import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'sonner'

/**
 * Account Security card for Settings → Profile.
 * Replaces the old disabled "Change Password" placeholder.
 *
 * Security notes:
 * - Uses realUser (NOT the possibly-impersonated effective user) so the
 *   re-auth check and password update always target the actual signed-in
 *   account, never a view-as-user identity.
 * - Re-authenticates with the current password before updating, so a
 *   walk-up session can't silently change the password.
 */
export default function ChangePasswordSection() {
  const { realUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setCurrent(''); setNext(''); setConfirm(''); setError('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return }
    if (next !== confirm) { setError('New passwords do not match.'); return }
    if (next === current) { setError('New password must be different from your current one.'); return }
    if (!realUser?.email) { setError('No active session. Please sign in again.'); return }

    setSaving(true)
    try {
      // Verify the current password by re-authenticating the real account.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: realUser.email,
        password: current,
      })
      if (reauthError) {
        setError('Current password is incorrect.')
        setSaving(false)
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) throw updateError

      toast.success('Password updated')
      reset()
      setOpen(false)
    } catch (err) {
      setError(err.message || 'Could not update password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Account Security</h2>

      <div className="py-3 border-b border-navy-700/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Password</p>
            <p className="text-xs text-gray-500 mt-0.5">Set a new password for your account</p>
          </div>
          {!open && (
            <button onClick={() => { reset(); setOpen(true) }} className="btn-secondary text-sm">
              Change Password
            </button>
          )}
        </div>

        {open && (
          <form onSubmit={handleSave} className="mt-4 space-y-3">
            {error && (
              <div className="px-3 py-2 bg-red-600/10 border border-red-600/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Current password</label>
              <input
                type="password"
                className="input"
                value={current}
                onChange={e => setCurrent(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">New password</label>
              <input
                type="password"
                className="input"
                value={next}
                onChange={e => setNext(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Confirm new password</label>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? 'Updating…' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => { reset(); setOpen(false) }}
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
          <p className="text-xs text-gray-500 mt-0.5">Not configured</p>
        </div>
        <span className="text-xs text-gray-500 px-2.5 py-1 rounded bg-navy-700/50">Coming soon</span>
      </div>
    </div>
  )
}
