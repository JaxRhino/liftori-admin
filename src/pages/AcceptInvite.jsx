import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Public page — invitee lands here from the team invite email.
// Reads the invite via the anon get_team_invite RPC, lets them set
// their own password, then calls the accept-invite edge function
// (which creates their auth user + profile with the assigned role).
export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState(null)
  const [loadError, setLoadError] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setLoadError('')
      if (token === 'preview') {
        setInvite({ full_name: 'Jordan Sample', email: 'new.hire@example.com', role: 'Sales Rep', status: 'pending', expires_at: new Date(Date.now() + 7 * 864e5).toISOString() })
        setFullName('Jordan Sample'); setLoading(false); return
      }
      try {
        const { data, error } = await supabase.rpc('get_team_invite', { p_token: token })
        if (!active) return
        const row = Array.isArray(data) ? data[0] : data
        if (error) { setLoadError('We could not load this invitation.'); return }
        if (!row) { setLoadError('This invitation link is invalid.'); return }
        if (row.status === 'accepted') { setLoadError('This invitation has already been used. Please sign in.'); return }
        if (row.status === 'cancelled') { setLoadError('This invitation was cancelled.'); return }
        if (row.expires_at && new Date(row.expires_at) < new Date()) { setLoadError('This invitation has expired. Ask for a new one.'); return }
        setInvite(row)
        setFullName(row.full_name || '')
      } catch (e) {
        if (active) setLoadError('Something went wrong loading this invitation.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (token === 'preview') { setError('Preview mode — submitting is disabled.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('accept-invite', {
        body: { token, password, full_name: fullName },
      })
      if (error) {
        let msg = 'Could not activate your account.'
        try { const ctx = await error.context?.json(); if (ctx?.error) msg = ctx.error } catch (_) {}
        setError(msg)
        setSubmitting(false)
        return
      }
      if (data?.error) { setError(data.error); setSubmitting(false); return }
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2200)
    } catch (e) {
      setError(e?.message || 'Could not activate your account.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wider text-white mb-1">LIFTORI</h1>
          <p className="text-gray-500 text-sm">Activate your team account</p>
        </div>

        {loading && (
          <div className="card text-center text-gray-400 text-sm py-10">Loading your invitation…</div>
        )}

        {!loading && loadError && (
          <div className="card space-y-5 text-center">
            <div className="px-4 py-3 bg-red-600/10 border border-red-600/30 rounded-lg text-red-400 text-sm">
              {loadError}
            </div>
            <Link to="/login" className="btn-primary w-full inline-block">Go to sign in</Link>
          </div>
        )}

        {!loading && !loadError && invite && done && (
          <div className="card space-y-4 text-center">
            <div className="px-4 py-3 bg-emerald-600/10 border border-emerald-600/30 rounded-lg text-emerald-400 text-sm">
              Your account is ready. Taking you to sign in…
            </div>
            <Link to="/login" className="btn-primary w-full inline-block">Sign in now</Link>
          </div>
        )}

        {!loading && !loadError && invite && !done && (
          <form onSubmit={handleSubmit} className="card space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-600/10 border border-red-600/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="px-4 py-3 bg-navy-950/60 border border-navy-700/60 rounded-lg">
              <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Invitation</div>
              <div className="mt-1 text-sm text-gray-200">{invite.email}</div>
              <div className="mt-2 inline-block px-2.5 py-1 rounded-md bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-medium">
                {invite.role}
              </div>
            </div>

            <div>
              <label className="label">Full name</label>
              <input
                type="text"
                className="input"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="label">Create password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? 'Activating…' : 'Activate account'}
            </button>

            <p className="text-center text-xs text-gray-500">
              Already have an account? <Link to="/login" className="text-brand-cyan hover:underline">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
