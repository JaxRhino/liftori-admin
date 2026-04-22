import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'sonner'

const TABS = ['Profile', 'Company', 'Notifications', 'Billing', 'Integrations']

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('Profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' })

  const [notifications, setNotifications] = useState({
    newSignup: true,
    newProject: true,
    projectUpdate: false,
    chatMessage: true,
    invoicePaid: true,
    weeklyDigest: true,
  })

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        email: profile.email || user?.email || '',
      })
    }
  }, [profile, user])

  async function saveProfile() {
    setSaving(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: profileForm.full_name })
        .eq('id', user.id)
      if (updateError) throw updateError
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account, platform, and integrations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 border border-navy-600/50 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-brand-blue text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Profile' && (
        <ProfileTab
          form={profileForm}
          setForm={setProfileForm}
          user={user}
          profile={profile}
          onSave={saveProfile}
          saving={saving}
          saved={saved}
          error={error}
          refreshProfile={refreshProfile}
        />
      )}
      {activeTab === 'Company' && <CompanyTab />}
      {activeTab === 'Notifications' && (
        <NotificationsTab prefs={notifications} setPrefs={setNotifications} />
      )}
      {activeTab === 'Billing' && <BillingTab />}
      {activeTab === 'Integrations' && <IntegrationsTab />}
    </div>
  )
}

function ProfileTab({ form, setForm, user, profile, onSave, saving, saved, error, refreshProfile }) {
  const initials = (form.full_name || user?.email || '?').slice(0, 2).toUpperCase()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(file.name)
    if (!isImage) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `${user.id}/avatar.${ext}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Add cache-buster to force reload
      const avatarUrl = `${publicUrl}?t=${Date.now()}`

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)
      if (updateError) throw updateError

      await refreshProfile()
      toast.success('Profile picture updated!')
    } catch (err) {
      console.error('Avatar upload error:', err)
      toast.error('Failed to upload picture')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setUploading(true)
    try {
      // Remove from profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)
      if (updateError) throw updateError

      await refreshProfile()
      toast.success('Profile picture removed')
    } catch (err) {
      console.error('Avatar remove error:', err)
      toast.error('Failed to remove picture')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Your Profile</h2>

        {/* Avatar row */}
        <div className="flex items-center gap-5 mb-6 pb-6 border-b border-navy-700/50">
          <div className="relative group">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={form.full_name || 'Avatar'}
                className="w-20 h-20 rounded-full object-cover border-2 border-navy-700"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue text-2xl font-bold select-none">
                {initials}
              </div>
            )}
            {/* Upload overlay */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              {uploading ? (
                <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{form.full_name || 'No name set'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{form.email}</p>
            <span className="mt-1.5 inline-block px-2 py-0.5 rounded text-xs bg-brand-blue/10 text-brand-blue font-medium capitalize">
              {profile?.role || 'admin'}
            </span>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
              >
                {profile?.avatar_url ? 'Change Photo' : 'Upload Photo'}
              </button>
              {profile?.avatar_url && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                  className="text-xs text-gray-500 hover:text-red-400 font-medium transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Full Name</label>
            <input
              className="input"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Email Address</label>
            <input
              className="input opacity-60 cursor-not-allowed"
              value={form.email}
              readOnly
            />
            <p className="text-xs text-gray-600 mt-1">Email changes require re-authentication. Contact support to update.</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        <div className="mt-6 flex items-center gap-3">
          <button onClick={onSave} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          {saved && <span className="text-sm text-emerald-400 font-medium">Saved!</span>}
        </div>
      </div>

      {/* Account Security */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Account Security</h2>
        <div className="flex items-center justify-between py-3 border-b border-navy-700/30">
          <div>
            <p className="text-sm font-medium text-white">Password</p>
            <p className="text-xs text-gray-500 mt-0.5">Managed via Supabase Auth</p>
          </div>
          <button className="btn-secondary text-sm opacity-50 cursor-not-allowed" disabled>
            Change Password
          </button>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
            <p className="text-xs text-gray-500 mt-0.5">Not configured</p>
          </div>
          <span className="text-xs text-gray-500 px-2.5 py-1 rounded bg-navy-700/50">Coming soon</span>
        </div>
      </div>
    </div>
  )
}

function CompanyTab() {
  const [form, setForm] = useState({
    businessName: 'Liftori',
    tagline: 'Lift Your Idea.',
    primaryColor: '#0EA5E9',
    accentColor: '#7DD3FC',
    website: 'https://liftori.ai',
    supportEmail: 'hello@liftori.ai',
  })

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Platform Identity</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Business Name</label>
              <input
                className="input"
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Tagline</label>
              <input
                className="input"
                value={form.tagline}
                onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Website URL</label>
              <input
                className="input"
                value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Support Email</label>
              <input
                className="input"
                value={form.supportEmail}
                onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Brand Colors</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-navy-600/50 bg-navy-800 cursor-pointer p-0.5"
                value={form.primaryColor}
                onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              />
              <input
                className="input flex-1"
                value={form.primaryColor}
                onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Accent Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-navy-600/50 bg-navy-800 cursor-pointer p-0.5"
                value={form.accentColor}
                onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))}
              />
              <input
                className="input flex-1"
                value={form.accentColor}
                onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-6 p-4 rounded-xl border border-navy-700/50 bg-[#060B18]">
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">Preview</p>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
              style={{ background: form.primaryColor }}
            >
              L
            </div>
            <div>
              <p className="font-bold text-white text-sm">{form.businessName || 'Liftori'}</p>
              <p className="text-xs" style={{ color: form.accentColor }}>{form.tagline}</p>
            </div>
            <button
              className="ml-auto px-4 py-1.5 rounded-lg text-sm text-white font-medium"
              style={{ background: form.primaryColor }}
            >
              Get Started
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Platform Logo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-navy-600/50 flex items-center justify-center text-gray-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-white font-medium">Upload logo</p>
            <p className="text-xs text-gray-500 mt-0.5">PNG or SVG recommended. Max 2MB.</p>
            <button className="mt-2 btn-secondary text-xs opacity-50 cursor-not-allowed" disabled>
              Upload — Coming soon
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-secondary text-sm opacity-50 cursor-not-allowed" disabled>
          Save Company Settings — Coming soon
        </button>
      </div>
    </div>
  )
}

function NotificationsTab({ prefs, setPrefs }) {
  const toggles = [
    { key: 'newSignup', label: 'New waitlist signup', description: 'Get notified when someone joins the waitlist' },
    { key: 'newProject', label: 'New project created', description: 'Alerts when a project is created or converted' },
    { key: 'projectUpdate', label: 'Project status change', description: 'When a project moves through the pipeline stages' },
    { key: 'chatMessage', label: 'New chat message', description: 'Unread messages in team or client DM channels' },
    { key: 'invoicePaid', label: 'Invoice paid', description: 'When a client payment is confirmed' },
    { key: 'weeklyDigest', label: 'Weekly digest', description: 'Summary of signups, revenue, and platform activity' },
  ]

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Notification Preferences</h2>
            <p className="text-xs text-gray-500 mt-0.5">Control what activity triggers alerts</p>
          </div>
          <span className="text-xs text-gray-500 px-2.5 py-1 rounded bg-navy-700/50 flex-shrink-0">
            Email delivery — coming soon
          </span>
        </div>
        <div className="space-y-0">
          {toggles.map((t, i) => (
            <div
              key={t.key}
              className={`flex items-center justify-between py-4 ${i < toggles.length - 1 ? 'border-b border-navy-700/30' : ''}`}
            >
              <div>
                <p className="text-sm font-medium text-white">{t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
              </div>
              <button
                onClick={() => setPrefs(p => ({ ...p, [t.key]: !p[t.key] }))}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  prefs[t.key] ? 'bg-brand-blue' : 'bg-navy-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    prefs[t.key] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BillingTab() {
  const tiers = [
    { name: 'Starter', price: '$1,500+', retainer: null, description: 'Single-surface MVP delivery' },
    { name: 'Growth', price: '$5,000+', retainer: '$1K–$2K/mo', description: 'Multi-surface + managed services' },
    { name: 'Scale', price: '$15,000+', retainer: '$2K–$5K/mo', description: 'Full platform + AI + team integration' },
  ]

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
        <div className="flex items-center justify-between p-4 rounded-xl bg-brand-blue/10 border border-brand-blue/20">
          <div>
            <p className="font-bold text-white text-lg">Liftori Internal</p>
            <p className="text-sm text-gray-400 mt-0.5">Admin access — all features included</p>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-brand-blue text-white text-sm font-semibold">Active</span>
        </div>
      </div>

      {/* Platform Status */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Platform Billing Status</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-navy-900/60 border border-navy-700/30 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Entity</p>
            <p className="text-base font-bold text-white">Liftori, LLC</p>
            <p className="text-xs text-orange-400 mt-0.5">Formation in progress</p>
          </div>
          <div className="p-4 rounded-xl bg-navy-900/60 border border-navy-700/30 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Stripe</p>
            <p className="text-base font-bold text-orange-400">Pending</p>
            <p className="text-xs text-gray-600 mt-0.5">Blocked on LLC</p>
          </div>
          <div className="p-4 rounded-xl bg-navy-900/60 border border-navy-700/30 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Payment Flow</p>
            <p className="text-base font-bold text-white">Manual</p>
            <p className="text-xs text-gray-600 mt-0.5">50 / 40 / 10 milestones</p>
          </div>
        </div>
      </div>

      {/* Client Pricing Tiers */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Client Pricing Tiers</h2>
        <div className="space-y-3">
          {tiers.map(tier => (
            <div
              key={tier.name}
              className="flex items-center justify-between p-4 rounded-xl border border-navy-700/30 hover:border-navy-600/50 transition-colors"
            >
              <div>
                <p className="font-semibold text-white">{tier.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tier.description}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{tier.price}</p>
                {tier.retainer && (
                  <p className="text-xs text-brand-blue mt-0.5">{tier.retainer} retainer</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-4">
          Stripe integration activates post-LLC formation. All payments currently handled manually.
        </p>
      </div>
    </div>
  )
}

function IntegrationsTab() {
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(null)

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const integrations = [
    {
      name: 'Supabase',
      status: 'connected',
      icon: '⚡',
      description: 'Database, auth, and storage',
      detail: 'qlerfkdyslndjbaltkwo',
    },
    {
      name: 'Vercel',
      status: 'connected',
      icon: '▲',
      description: 'Hosting + CI/CD from main',
      detail: 'admin.liftori.ai',
    },
    {
      name: 'Resend',
      status: 'connected',
      icon: '✉',
      description: 'Transactional email delivery',
      detail: 'hello@liftori.ai',
    },
    {
      name: 'Cloudflare',
      status: 'connected',
      icon: '☁',
      description: 'DNS and domain management',
      detail: 'liftori.ai',
    },
    {
      name: 'Stripe',
      status: 'pending',
      icon: '💳',
      description: 'Payments and subscriptions',
      detail: 'Blocked — awaiting LLC',
    },
    {
      name: 'Claude AI',
      status: 'planned',
      icon: '🤖',
      description: 'AI project briefs and automation',
      detail: 'Phase 2 — Anthropic API',
    },
  ]

  const statusConfig = {
    connected: { label: 'Connected', cls: 'bg-emerald-500/10 text-emerald-400' },
    pending: { label: 'Pending', cls: 'bg-orange-500/10 text-orange-400' },
    planned: { label: 'Planned', cls: 'bg-gray-500/10 text-gray-400' },
  }

  return (
    <div className="space-y-6">
      {/* Integration cards */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Connected Services</h2>
        <div className="grid grid-cols-2 gap-4">
          {integrations.map(integration => {
            const sc = statusConfig[integration.status]
            return (
              <div
                key={integration.name}
                className="p-4 rounded-xl border border-navy-700/30 hover:border-navy-600/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{integration.icon}</span>
                    <p className="font-semibold text-white">{integration.name}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.cls}`}>
                    {sc.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{integration.description}</p>
                <p className="text-xs text-gray-600 mt-1 font-mono truncate">{integration.detail}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* API Credentials */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">API Credentials</h2>
        <p className="text-sm text-gray-500 mb-5">Supabase connection details for integrations and scripts.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Project URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 bg-navy-900/60 border border-navy-700/50 rounded-lg text-xs text-brand-blue font-mono truncate">
                https://qlerfkdyslndjbaltkwo.supabase.co
              </code>
              <button
                onClick={() => copyToClipboard('https://qlerfkdyslndjbaltkwo.supabase.co', 'url')}
                className="btn-secondary text-xs px-3 py-2 flex-shrink-0"
              >
                {copied === 'url' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Anon Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 bg-navy-900/60 border border-navy-700/50 rounded-lg text-xs text-gray-400 font-mono truncate">
                {showKey
                  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…'
                  : '••••••••••••••••••••••••••••••••••••••••'}
              </code>
              <button
                onClick={() => setShowKey(s => !s)}
                className="btn-secondary text-xs px-3 py-2 flex-shrink-0"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">Public anon key — safe for client-side use (RLS enforced).</p>
          </div>
        </div>
      </div>

      {/* Webhooks */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Webhooks</h2>
          <span className="text-xs text-gray-500 px-2.5 py-1 rounded bg-navy-700/50">Coming soon</span>
        </div>
        <p className="text-sm text-gray-500">
          Configure webhook endpoints to push real-time Liftori events to external services.
        </p>
        <div className="mt-4 p-4 rounded-xl border border-dashed border-navy-600/40 text-center">
          <p className="text-xs text-gray-600">No webhooks configured</p>
        </div>
      </div>
    </div>
  )
}
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'sonner'

const TABS = ['Profile', 'Company', 'Notifications', 'Billing', 'Integrations']

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('Profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' })

  const [notifications, setNotifications] = useState({
    newSignup: true,
    newProject: true,
    projectUpdate: false,
    chatMessage: true,
    invoicePaid: true,
    weeklyDigest: true,
  })

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        email: profile.email || user?.email || '',
      })
    }
  }, [profile, user])

  async function saveProfile() {
    setSaving(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: profileForm.full_name })
        .eq('id', user.id)
      if (updateError) throw updateError
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account, platform, and integrations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 border border-navy-600/50 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-brand-blue text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Profile' && (
        <ProfileTab
          form={profileForm}
          setForm={setProfileForm}
          user={user}
          profile={profile}
          onSave={saveProfile}
          saving={saving}
          saved={saved}
          error={error}
          refreshProfile={refreshProfile}
        />
      )}
      {activeTab === 'Company' && <CompanyTab />}
      {activeTab === 'Notifications' && (
        <NotificationsTab prefs={notifications} setPrefs={setNotifications} />
      )}
      {activeTab === 'Billing' && <BillingTab />}
      {activeTab === 'Integrations' && <IntegrationsTab />}
    </div>
  )
}

function ProfileTab({ form, setForm, user, profile, onSave, saving, saved, error, refreshProfile }) {
  const initials = (form.full_name || user?.email || '?').slice(0, 2).toUpperCase()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `${user.id}/avatar.${ext}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Add cache-buster to force reload
      const avatarUrl = `${publicUrl}?t=${Date.now()}`

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)
      if (updateError) throw updateError

      await refreshProfile()
      toast.success('Profile picture updated!')
    } catch (err) {
      console.error('Avatar upload error:', err)
      toast.error('Failed to upload picture')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setUploading(true)
    try {
      // Remove from profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)
      if (updateError) throw updateError

      await refreshProfile()
      toast.success('Profile picture removed')
    } catch (err) {
      console.error('Avatar remove error:', err)
      toast.error('Failed to remove picture')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Your Profile</h2>

        {/* Avatar row */}
        <div className="flex items-center gap-5 mb-6 pb-6 border-b border-navy-700/50">
          <div className="relative group">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={form.full_name || 'Avatar'}
                className="w-20 h-20 rounded-full object-cover border-2 border-navy-700"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue text-2xl font-bold select-none">
                {initials}
              </div>
            )}
            {/* Upload overlay */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              {uploading ? (
                <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{form.full_name || 'No name set'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{form.email}</p>
            <span className="mt-1.5 inline-block px-2 py-0.5 rounded text-xs bg-brand-blue/10 text-brand-blue font-medium capitalize">
              {profile?.role || 'admin'}
            </span>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
              >
                {profile?.avatar_url ? 'Change Photo' : 'Upload Photo'}
              </button>
              {profile?.avatar_url && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                  className="text-xs text-gray-500 hover:text-red-400 font-medium transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Full Name</label>
            <input
              className="input"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Email Address</label>
            <input
              className="input opacity-60 cursor-not-allowed"
              value={form.email}
              readOnly
            />
            <p className="text-xs text-gray-600 mt-1">Email changes require re-authentication. Contact support to update.</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        <div className="mt-6 flex items-center gap-3">
          <button onClick={onSave} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          {saved && <span className="text-sm text-emerald-400 font-medium">Saved!</span>}
        </div>
      </div>

      {/* Account Security */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Account Security</h2>
        <div className="flex items-center justify-between py-3 border-b border-navy-700/30">
          <div>
            <p className="text-sm font-medium text-white">Password</p>
            <p className="text-xs text-gray-500 mt-0.5">Managed via Supabase Auth</p>
          </div>
          <button className="btn-secondary text-sm opacity-50 cursor-not-allowed" disabled>
            Change Password
          </button>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
            <p className="text-xs text-gray-500 mt-0.5">Not configured</p>
          </div>
          <span className="text-xs text-gray-500 px-2.5 py-1 rounded bg-navy-700/50">Coming soon</span>
        </div>
      </div>
    </div>
  )
}

function CompanyTab() {
  const [form, setForm] = useState({
    businessName: 'Liftori',
    tagline: 'Lift Your Idea.',
    primaryColor: '#0EA5E9',
    accentColor: '#7DD3FC',
    website: 'https://liftori.ai',
    supportEmail: 'hello@liftori.ai',
  })

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Platform Identity</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Business Name</label>
              <input
                className="input"
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Tagline</label>
              <input
                className="input"
                value={form.tagline}
                onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Website URL</label>
              <input
                className="input"
                value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Support Email</label>
              <input
                className="input"
                value={form.supportEmail}
                onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Brand Colors</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-navy-600/50 bg-navy-800 cursor-pointer p-0.5"
                value={form.primaryColor}
                onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              />
              <input
                className="input flex-1"
                value={form.primaryColor}
                onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Accent Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-navy-600/50 bg-navy-800 cursor-pointer p-0.5"
                value={form.accentColor}
                onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))}
              />
              <input
                className="input flex-1"
                value={form.accentColor}
                onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-6 p-4 rounded-xl border border-navy-700/50 bg-[#060B18]">
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">Preview</p>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
              style={{ background: form.primaryColor }}
            >
              L
            </div>
            <div>
              <p className="font-bold text-white text-sm">{form.businessName || 'Liftori'}</p>
              <p className="text-xs" style={{ color: form.accentColor }}>{form.tagline}</p>
            </div>
            <button
              className="ml-auto px-4 py-1.5 rounded-lg text-sm text-white font-medium"
              style={{ background: form.primaryColor }}
            >
              Get Started
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Platform Logo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-navy-600/50 flex items-center justify-center text-gray-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-white font-medium">Upload logo</p>
            <p className="text-xs text-gray-500 mt-0.5">PNG or SVG recommended. Max 2MB.</p>
            <button className="mt-2 btn-secondary text-xs opacity-50 cursor-not-allowed" disabled>
              Upload — Coming soon
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-secondary text-sm opacity-50 cursor-not-allowed" disabled>
          Save Company Settings — Coming soon
        </button>
      </div>
    </div>
  )
}

function NotificationsTab({ prefs, setPrefs }) {
  const toggles = [
    { key: 'newSignup', label: 'New waitlist signup', description: 'Get notified when someone joins the waitlist' },
    { key: 'newProject', label: 'New project created', description: 'Alerts when a project is created or converted' },
    { key: 'projectUpdate', label: 'Project status change', description: 'When a project moves through the pipeline stages' },
    { key: 'chatMessage', label: 'New chat message', description: 'Unread messages in team or client DM channels' },
    { key: 'invoicePaid', label: 'Invoice paid', description: 'When a client payment is confirmed' },
    { key: 'weeklyDigest', label: 'Weekly digest', description: 'Summary of signups, revenue, and platform activity' },
  ]

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Notification Preferences</h2>
            <p className="text-xs text-gray-500 mt-0.5">Control what activity triggers alerts</p>
          </div>
          <span className="text-xs text-gray-500 px-2.5 py-1 rounded bg-navy-700/50 flex-shrink-0">
            Email delivery — coming soon
          </span>
        </div>
        <div className="space-y-0">
          {toggles.map((t, i) => (
            <div
              key={t.key}
              className={`flex items-center justify-between py-4 ${i < toggles.length - 1 ? 'border-b border-navy-700/30' : ''}`}
            >
              <div>
                <p className="text-sm font-medium text-white">{t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
              </div>
              <button
                onClick={() => setPrefs(p => ({ ...p, [t.key]: !p[t.key] }))}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  prefs[t.key] ? 'bg-brand-blue' : 'bg-navy-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    prefs[t.key] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BillingTab() {
  const tiers = [
    { name: 'Starter', price: '$1,500+', retainer: null, description: 'Single-surface MVP delivery' },
    { name: 'Growth', price: '$5,000+', retainer: '$1K–$2K/mo', description: 'Multi-surface + managed services' },
    { name: 'Scale', price: '$15,000+', retainer: '$2K–$5K/mo', description: 'Full platform + AI + team integration' },
  ]

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
        <div className="flex items-center justify-between p-4 rounded-xl bg-brand-blue/10 border border-brand-blue/20">
          <div>
            <p className="font-bold text-white text-lg">Liftori Internal</p>
            <p className="text-sm text-gray-400 mt-0.5">Admin access — all features included</p>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-brand-blue text-white text-sm font-semibold">Active</span>
        </div>
      </div>

      {/* Platform Status */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Platform Billing Status</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-navy-900/60 border border-navy-700/30 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Entity</p>
            <p className="text-base font-bold text-white">Liftori, LLC</p>
            <p className="text-xs text-orange-400 mt-0.5">Formation in progress</p>
          </div>
          <div className="p-4 rounded-xl bg-navy-900/60 border border-navy-700/30 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Stripe</p>
            <p className="text-base font-bold text-orange-400">Pending</p>
            <p className="text-xs text-gray-600 mt-0.5">Blocked on LLC</p>
          </div>
          <div className="p-4 rounded-xl bg-navy-900/60 border border-navy-700/30 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Payment Flow</p>
            <p className="text-base font-bold text-white">Manual</p>
            <p className="text-xs text-gray-600 mt-0.5">50 / 40 / 10 milestones</p>
          </div>
        </div>
      </div>

      {/* Client Pricing Tiers */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Client Pricing Tiers</h2>
        <div className="space-y-3">
          {tiers.map(tier => (
            <div
              key={tier.name}
              className="flex items-center justify-between p-4 rounded-xl border border-navy-700/30 hover:border-navy-600/50 transition-colors"
            >
              <div>
                <p className="font-semibold text-white">{tier.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tier.description}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{tier.price}</p>
                {tier.retainer && (
                  <p className="text-xs text-brand-blue mt-0.5">{tier.retainer} retainer</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-4">
          Stripe integration activates post-LLC formation. All payments currently handled manually.
        </p>
      </div>
    </div>
  )
}

function IntegrationsTab() {
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(null)

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const integrations = [
    {
      name: 'Supabase',
      status: 'connected',
      icon: '⚡',
      description: 'Database, auth, and storage',
      detail: 'qlerfkdyslndjbaltkwo',
    },
    {
      name: 'Vercel',
      status: 'connected',
      icon: '▲',
      description: 'Hosting + CI/CD from main',
      detail: 'admin.liftori.ai',
    },
    {
      name: 'Resend',
      status: 'connected',
      icon: '✉',
      description: 'Transactional email delivery',
      detail: 'hello@liftori.ai',
    },
    {
      name: 'Cloudflare',
      status: 'connected',
      icon: '☁',
      description: 'DNS and domain management',
      detail: 'liftori.ai',
    },
    {
      name: 'Stripe',
      status: 'pending',
      icon: '💳',
      description: 'Payments and subscriptions',
      detail: 'Blocked — awaiting LLC',
    },
    {
      name: 'Claude AI',
      status: 'planned',
      icon: '🤖',
      description: 'AI project briefs and automation',
      detail: 'Phase 2 — Anthropic API',
    },
  ]

  const statusConfig = {
    connected: { label: 'Connected', cls: 'bg-emerald-500/10 text-emerald-400' },
    pending: { label: 'Pending', cls: 'bg-orange-500/10 text-orange-400' },
    planned: { label: 'Planned', cls: 'bg-gray-500/10 text-gray-400' },
  }

  return (
    <div className="space-y-6">
      {/* Integration cards */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-6">Connected Services</h2>
        <div className="grid grid-cols-2 gap-4">
          {integrations.map(integration => {
            const sc = statusConfig[integration.status]
            return (
              <div
                key={integration.name}
                className="p-4 rounded-xl border border-navy-700/30 hover:border-navy-600/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{integration.icon}</span>
                    <p className="font-semibold text-white">{integration.name}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.cls}`}>
                    {sc.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{integration.description}</p>
                <p className="text-xs text-gray-600 mt-1 font-mono truncate">{integration.detail}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* API Credentials */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">API Credentials</h2>
        <p className="text-sm text-gray-500 mb-5">Supabase connection details for integrations and scripts.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Project URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 bg-navy-900/60 border border-navy-700/50 rounded-lg text-xs text-brand-blue font-mono truncate">
                https://qlerfkdyslndjbaltkwo.supabase.co
              </code>
              <button
                onClick={() => copyToClipboard('https://qlerfkdyslndjbaltkwo.supabase.co', 'url')}
                className="btn-secondary text-xs px-3 py-2 flex-shrink-0"
              >
                {copied === 'url' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Anon Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 bg-navy-900/60 border border-navy-700/50 rounded-lg text-xs text-gray-400 font-mono truncate">
                {showKey
                  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…'
                  : '••••••••••••••••••••••••••••••••••••••••'}
              </code>
              <button
                onClick={() => setShowKey(s => !s)}
                className="btn-secondary text-xs px-3 py-2 flex-shrink-0"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">Public anon key — safe for client-side use (RLS enforced).</p>
          </div>
        </div>
      </div>

      {/* Webhooks */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Webhooks</h2>
          <span className="text-xs text-gray-500 px-2.5 py-1 rounded bg-navy-700/50">Coming soon</span>
        </div>
        <p className="text-sm text-gray-500">
          Configure webhook endpoints to push real-time Liftori events to external services.
        </p>
        <div className="mt-4 p-4 rounded-xl border border-dashed border-navy-600/40 text-center">
          <p className="text-xs text-gray-600">No webhooks configured</p>
        </div>
      </div>
    </div>
  )
}
