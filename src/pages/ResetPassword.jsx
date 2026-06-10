import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)       // recovery session established
  const [checking, setChecking] = useState(true)   // still verifying the link
  const [linkError, setLinkError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let settled = false

    // If the recovery link itself carries an error (expired/invalid), surface it.
    const hash = window.location.hash || ''
    if (hash.includes('error')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const desc = params.get('error_description')
      setLinkError(desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'This reset link is invalid or has expired.')
      setChecking(false)
      settled = true
    }

    // Supabase parses the recovery token from the URL hash on load and fires
    // PASSWORD_RECOVERY once the temporary session is established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        settled = true
        setReady(true)
        setChecking(false)
      }
    })

    // Cover the case where the session is already present on mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        settled = true
        setReady(true)
        setChecking(false)
      }
    })

    // Fallback: if nothing resolved after a few seconds, the link was bad or
    // the user landed here directly without a token.
    const timer = setTimeout(() => {
      if (!settled) {
        setChecking(false)
        setLinkError('This reset link is invalid or has expired. Please request a new one.')
      }
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      // Recovery session is now a full session with the new password set.
      // Send them into the app; RootRedirect routes by role.
      setTimeout(() => navigate('/', { replace: true }), 1600)
    } catch (err) {
      setError(err.message || 'Could not update password. Please request a new link.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wider text-white mb-1">LIFTORI</h1>
          <p className="text-gray-500 text-sm">Choose a new password</p>
        </div>

        {checking ? (
          <div className="card flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-slate-400 text-sm">Verifying your reset link…</span>
          </div>
        ) : linkError ? (
          <div className="card space-y-4 text-center">
            <div className="px-4 py-3 bg-red-600/10 border border-red-600/30 rounded-lg text-red-400 text-sm">
              {linkError}
            </div>
            <Link to="/forgot-password" className="btn-primary w-full inline-flex items-center justify-center">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="card space-y-2 text-center">
            <div className="px-4 py-3 bg-green-600/10 border border-green-600/30 rounded-lg text-green-400 text-sm">
              Password updated. Signing you in…
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-600/10 border border-red-600/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="label">New password</label>
              <input
                type="password"
                className="input"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                disabled={!ready}
              />
            </div>

            <div>
              <label className="label">Confirm new password</label>
              <input
                type="password"
                className="input"
                placeholder="Re-enter password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                disabled={!ready}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !ready}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Update password'
              )}
            </button>
          </form>
        )}

        <p className="text-center text-slate-400 text-sm mt-4">
          <Link to="/login" className="text-sky-400 hover:text-sky-300 transition">Back to sign in</Link>
        </p>
        <p className="text-center text-gray-600 text-xs mt-6">Powered by Liftori</p>
      </div>
    </div>
  )
}
