import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // redirectTo uses the current origin so this works on both
      // localhost (dev) and admin.liftori.ai (prod) without hardcoding.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      // Always show the same confirmation — never reveal whether an
      // account exists for this email (prevents account enumeration).
      setSent(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wider text-white mb-1">LIFTORI</h1>
          <p className="text-gray-500 text-sm">Reset your password</p>
        </div>

        {sent ? (
          <div className="card space-y-4 text-center">
            <div className="px-4 py-3 bg-green-600/10 border border-green-600/30 rounded-lg text-green-400 text-sm">
              If an account exists for <span className="font-medium">{email}</span>, a password reset link is on its way. Check your inbox (and spam folder).
            </div>
            <Link to="/login" className="btn-primary w-full inline-flex items-center justify-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-600/10 border border-red-600/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <p className="text-slate-400 text-sm">
              Enter the email associated with your account and we'll send you a link to reset your password.
            </p>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Send reset link'
              )}
            </button>
          </form>
        )}

        <p className="text-center text-slate-400 text-sm mt-4">
          Remembered it?{' '}
          <Link to="/login" className="text-sky-400 hover:text-sky-300 transition">Sign in</Link>
        </p>
        <p className="text-center text-gray-600 text-xs mt-6">Powered by Liftori</p>
      </div>
    </div>
  )
}
