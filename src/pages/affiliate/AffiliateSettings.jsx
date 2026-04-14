import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { fetchMyAffiliateEnrollment, AFFILIATE_TIERS, getTier } from '../../lib/affiliateProgramService'

export default function AffiliateSettings() {
  const { user, profile, refreshProfile } = useAuth()
  const [enrollment, setEnrollment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    niche: '', primary_platform: '', audience_size: '', bio: '',
    instagram: '', tiktok: '', youtube: '', linkedin: '', twitter: '', website: '',
  })

  useEffect(() => {
    if (!user?.id) return
    fetchMyAffiliateEnrollment(user.id)
      .then((enr) => {
        setEnrollment(enr)
        setForm({
          niche: enr?.niche || '',
          primary_platform: enr?.primary_platform || '',
          audience_size: enr?.audience_size || '',
          bio: enr?.bio || '',
          instagram: profile?.social_instagram || '',
          tiktok: profile?.social_tiktok || '',
          youtube: profile?.social_youtube || '',
          linkedin: profile?.social_linkedin || '',
          twitter: profile?.social_twitter || '',
          website: profile?.social_website || '',
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.id, profile])

  async function save() {
    setSaving(true)
    try {
      await supabase.from('affiliate_enrollments').update({
        niche: form.niche || null,
        primary_platform: form.primary_platform || null,
        audience_size: form.audience_size ? Number(form.audience_size) : null,
        bio: form.bio || null,
      }).eq('id', enrollment.id)

      await supabase.from('profiles').update({
        social_instagram: form.instagram || null,
        social_tiktok: form.tiktok || null,
        social_youtube: form.youtube || null,
        social_linkedin: form.linkedin || null,
        social_twitter: form.twitter || null,
        social_website: form.website || null,
      }).eq('id', user.id)

      toast.success('Saved')
      refreshProfile()
    } catch (err) {
      console.error(err); toast.error('Save failed')
    } finally { setSaving(false) }
  }

  const currentTier = enrollment ? getTier(enrollment.tier) : null

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center text-gray-500">Loading…</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">⚙️ Settings</h1>
        <p className="text-sm text-gray-400">Creator profile and tier.</p>
      </div>

      {/* Tier card */}
      <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <div className="text-xs uppercase font-bold text-gray-500">Current tier</div>
            <div className="text-xl font-bold text-white">{currentTier?.label}</div>
            <div className="text-xs text-gray-400">
              {currentTier?.price === 0 ? 'Free forever' : `$${currentTier?.price}/mo`} · {(Number(enrollment.commission_rate) * 100).toFixed(0)}% commission
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {AFFILIATE_TIERS.map((t) => {
            const active = enrollment.tier === t.key
            return (
              <div key={t.key} className={`rounded-lg p-3 border ${active ? 'bg-pink-500/10 border-pink-500/40' : 'bg-navy-900/40 border-navy-700/50'}`}>
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-bold text-white">{t.label}</div>
                  <div className="text-xs text-emerald-400">{t.price === 0 ? 'Free' : `$${t.price}/mo`}</div>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">{(t.commissionRate * 100).toFixed(0)}% commission</div>
                {active ? (
                  <div className="mt-2 text-[10px] uppercase font-bold text-pink-300">✓ Current</div>
                ) : (
                  <button disabled className="mt-2 text-[10px] text-gray-500 italic">Upgrade flow coming soon</button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-white">Creator profile</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Niche">
            <input value={form.niche} onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Primary platform">
            <select value={form.primary_platform} onChange={(e) => setForm((f) => ({ ...f, primary_platform: e.target.value }))} className={inputCls}>
              <option value="">—</option>
              {['instagram','tiktok','youtube','linkedin','twitter','podcast','newsletter','other'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Audience size">
            <input type="number" value={form.audience_size} onChange={(e) => setForm((f) => ({ ...f, audience_size: e.target.value }))} className={inputCls} />
          </Field>
        </div>
        <Field label="Bio">
          <textarea rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} className={inputCls} />
        </Field>
        <div className="pt-3 border-t border-navy-700/50">
          <div className="text-xs uppercase font-bold text-gray-500 mb-2">Social handles</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter', 'website'].map((s) => (
              <Field key={s} label={s}>
                <input value={form[s]} onChange={(e) => setForm((f) => ({ ...f, [s]: e.target.value }))} className={inputCls} placeholder={s === 'website' ? 'https://…' : `@${s}handle`} />
              </Field>
            ))}
          </div>
        </div>
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-semibold text-gray-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
