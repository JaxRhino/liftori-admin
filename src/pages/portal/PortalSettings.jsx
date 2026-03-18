import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

export default function PortalSettings() {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('account')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Account state
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')

  // Password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleUpdateAccount(e) {
    e.preventDefault()
    setSaving(true)
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Update email if changed
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email })
        if (emailError) throw emailError
        showMessage('Profile updated. Check your new email for a confirmation link.')
      } else {
        showMessage('Profile updated successfully.')
      }
    } catch (err) {
      showMessage(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault()
    if (newPassword.length < 8) {
      showMessage('Password must be at least 8 characters.', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showMessage('Passwords do not match.', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setConfirmPassword('')
      showMessage('Password updated successfully.')
    } catch (err) {
      showMessage(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'account', label: 'Account' },
    { id: 'password', label: 'Password' },
    { id: 'billing', label: 'Billing & Plan' }
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-white font-heading mb-2">Settings</h1>
      <p className="text-white/50 text-sm mb-8">Manage your account, password, and billing preferences</p>

      {/* Message Toast */}
      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-green-500/20 text-green-400 border border-green-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-navy-800/50 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-blue text-white'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === 'account' && (
        <form onSubmit={handleUpdateAccount} className="max-w-lg space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-blue transition-colors"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-blue transition-colors"
              placeholder="your@email.com"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <form onSubmit={handleUpdatePassword} className="max-w-lg space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-blue transition-colors"
              placeholder="Minimum 8 characters"
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-blue transition-colors"
              placeholder="Re-enter new password"
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !newPassword || !confirmPassword}
            className="px-6 py-2.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="max-w-lg space-y-6">
          {/* Current Plan */}
          <div className="bg-navy-800/50 border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Current Plan</h3>
                <p className="text-sm text-white/40 mt-0.5">Your active subscription</p>
              </div>
              <span className="px-3 py-1 bg-brand-blue/20 text-brand-blue text-xs font-semibold rounded-full">
                Active
              </span>
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">$2,500</span>
              <span className="text-white/40 text-sm">/month</span>
            </div>
            <p className="text-sm text-white/50">Starter Tier \u2014 Up to 5 pages, custom design, mobile responsive</p>
          </div>

          {/* Payment Method */}
          <div className="bg-navy-800/50 border border-white/5 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">Payment Method</h3>
            <div className="flex items-center gap-3 p-3 bg-navy-900/50 rounded-lg">
              <div className="w-10 h-7 bg-white/10 rounded flex items-center justify-center">
                <svg className="w-6 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white/60">No payment method on file</p>
                <p className="text-xs text-white/30">Payment integration coming soon</p>
              </div>
            </div>
          </div>

          {/* Billing History */}
          <div className="bg-navy-800/50 border border-white/5 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">Billing History</h3>
            <p className="text-sm text-white/40">No invoices yet</p>
          </div>
        </div>
      )}
    </div>
  )
}
