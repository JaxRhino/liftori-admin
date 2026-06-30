import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Sales Hub > Landing Page
// A rep's own Liftori-branded public landing page (/r/:slug). They edit the
// name + contact info shown on it, share it, and watch inbound "request info"
// submissions land here as New Leads (digital_product_leads attributed to them).

function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export default function RepLandingPage() {
  const { profile, user } = useAuth()
  const userId = user?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [row, setRow] = useState(null)
  const [leads, setLeads] = useState([])
  const [toast, setToast] = useState(null)
  function flash(m) { setToast(m); setTimeout(() => setToast(null), 3200) }

  const [form, setForm] = useState({
    slug: '', display_name: '', title: '', email: '', phone: '',
    headline: '', subheadline: '', booking_url: '', bio: '', active: true,
  })

  async function load() {
    setLoading(true)
    const { data: lp } = await supabase.from('rep_landing_pages').select('*').eq('rep_id', userId).maybeSingle()
    if (lp) {
      setRow(lp)
      setForm({
        slug: lp.slug || '', display_name: lp.display_name || '', title: lp.title || '',
        email: lp.email || '', phone: lp.phone || '', headline: lp.headline || '',
        subheadline: lp.subheadline || '', booking_url: lp.booking_url || '', bio: lp.bio || '', active: lp.active !== false,
      })
    } else {
      const name = profile?.full_name || ''
      setForm(f => ({
        ...f,
        display_name: name,
        email: profile?.email || '',
        phone: profile?.phone || '',
        slug: slugify(name) || slugify((profile?.email || '').split('@')[0]),
        title: 'Liftori Solutions Specialist',
        headline: 'Custom software that lifts your business',
        subheadline: 'From CRMs to websites to AI tools — built for you, launched fast.',
      }))
    }
    const { data: ld } = await supabase.from('digital_product_leads').select('*')
      .eq('rep_id', userId).order('created_at', { ascending: false })
    setLeads(ld || [])
    setLoading(false)
  }
  useEffect(() => { if (userId) load() /* eslint-disable-next-line */ }, [userId])

  const publicUrl = useMemo(() => {
    const base = (typeof window !== 'undefined' ? window.location.origin : 'https://admin.liftori.ai')
    return form.slug ? `${base}/r/${form.slug}` : ''
  }, [form.slug])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    const cleanSlug = slugify(form.slug)
    if (!cleanSlug) { flash('Pick a handle for your link first'); return }
    if (!form.display_name.trim()) { flash('Add the name to show on your page'); return }
    setSaving(true)
    try {
      const payload = {
        rep_id: userId, slug: cleanSlug,
        display_name: form.display_name.trim(), title: form.title.trim() || null,
        email: form.email.trim() || null, phone: form.phone.trim() || null,
        headline: form.headline.trim() || null, subheadline: form.subheadline.trim() || null,
        booking_url: form.booking_url.trim() || null, bio: form.bio.trim() || null, active: !!form.active,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('rep_landing_pages').upsert(payload, { onConflict: 'rep_id' })
      if (error) {
        if ((error.code === '23505') || /duplicate|unique/i.test(error.message || '')) {
          flash('That handle is taken — try another'); return
        }
        throw error
      }
      setForm(f => ({ ...f, slug: cleanSlug }))
      flash('Landing page saved')
      load()
    } catch (err) {
      flash('Save failed: ' + (err?.message || 'error'))
    } finally { setSaving(false) }
  }

  function copyLink() {
    if (!publicUrl) return
    navigator.clipboard?.writeText(publicUrl).then(() => flash('Link copied')).catch(() => flash('Copy failed'))
  }

  const share = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`,
    x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent('Build your next project with Liftori')}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`,
  }

  const fld = 'input'
  const lbl = 'label'

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Header */}
        <div className="rounded-2xl border border-navy-700 bg-gradient-to-br from-navy-800 to-navy-900 p-7">
          <h1 className="text-2xl font-semibold text-white">Landing Page</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            Your own Liftori-branded landing page. Share it anywhere — socials, texts, your email
            signature. It shows everything Liftori can build, and every “request info” submission
            comes straight back to you here as a new lead. Set the name and contact info that
            appears on it below.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading your landing page…</div>
        ) : (
          <>
            {/* Share row */}
            <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-5">
              <label className="label">Your page link</label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-navy-700 bg-navy-900/70 px-3 py-2 text-sm text-sky-300">
                  {publicUrl || 'Save your page to generate a link'}
                </code>
                <button onClick={copyLink} disabled={!publicUrl}
                  className="rounded-lg border border-navy-600 bg-navy-900/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/40 hover:text-white disabled:opacity-50">Copy link</button>
                <a href={publicUrl || '#'} target="_blank" rel="noreferrer"
                  className={`btn-primary ${!publicUrl ? 'pointer-events-none opacity-50' : ''}`}>View page</a>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Share:</span>
                {[['Facebook', share.facebook], ['X', share.x], ['LinkedIn', share.linkedin]].map(([label, href]) => (
                  <a key={label} href={publicUrl ? href : '#'} target="_blank" rel="noreferrer"
                    className={`rounded-md border border-navy-700 bg-navy-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-sky-500/40 hover:text-white ${!publicUrl ? 'pointer-events-none opacity-50' : ''}`}>
                    {label}
                  </a>
                ))}
                {!form.active && <span className="ml-1 rounded bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-300">Page hidden — turn it on below</span>}
              </div>
            </div>

            {/* Editor */}
            <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
              <h3 className="text-base font-semibold text-white">Page details</h3>
              <p className="mt-1 text-[13px] text-slate-400">This is what visitors see and how they reach you.</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={lbl}>Link handle</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">/r/</span>
                    <input className={fld} value={form.slug} onChange={set('slug')} placeholder="your-name" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Letters, numbers and dashes. This is your public link.</p>
                </div>
                <div>
                  <label className={lbl}>Name shown on page</label>
                  <input className={fld} value={form.display_name} onChange={set('display_name')} placeholder="Jane Smith" />
                </div>
                <div>
                  <label className={lbl}>Title / role</label>
                  <input className={fld} value={form.title} onChange={set('title')} placeholder="Liftori Solutions Specialist" />
                </div>
                <div>
                  <label className={lbl}>Contact email</label>
                  <input className={fld} value={form.email} onChange={set('email')} placeholder="you@liftori.ai" />
                </div>
                <div>
                  <label className={lbl}>Contact phone</label>
                  <input className={fld} value={form.phone} onChange={set('phone')} placeholder="(904) 555-0100" />
                </div>
                <div>
                  <label className={lbl}>Booking link (optional)</label>
                  <input className={fld} value={form.booking_url} onChange={set('booking_url')} placeholder="https://calendly.com/…" />
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>Headline</label>
                  <input className={fld} value={form.headline} onChange={set('headline')} placeholder="Custom software that lifts your business" />
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>Sub-headline</label>
                  <textarea rows={2} className={fld} value={form.subheadline} onChange={set('subheadline')}
                    placeholder="From CRMs to websites to AI tools — built for you, launched fast." />
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>Your write-up (about you)</label>
                  <textarea rows={4} className={fld} value={form.bio} onChange={set('bio')}
                    placeholder="A short, personal intro for the “Meet your specialist” section — who you are, how you help, and why customers love working with you." />
                  <p className="mt-1 text-[11px] text-slate-500">This is your personal pitch on the page. Keep it warm and confident.</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    className="h-4 w-4 rounded border-navy-600 bg-navy-900 text-brand-cyan focus:ring-brand-cyan" />
                  Page is live (visitors can see it)
                </label>
                <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : (row ? 'Save changes' : 'Create my page')}</button>
              </div>
            </div>

            {/* Leads from this page */}
            <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Leads from your page</h3>
                <span className="text-sm text-slate-400">{leads.length} total</span>
              </div>
              {leads.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No leads yet. Share your link and inbound requests will appear here as new leads.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-navy-700">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-navy-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">Contact</th>
                        <th className="px-4 py-3 font-semibold">Interested in</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700/60">
                      {leads.map(l => (
                        <tr key={l.id} className="bg-navy-900/40 hover:bg-navy-800/60 align-top">
                          <td className="px-4 py-3">
                            <p className="text-white">{l.full_name || '—'}</p>
                            {l.company_name && <p className="text-[11px] text-slate-500">{l.company_name}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {l.email && <p>{l.email}</p>}
                            {l.phone && <p className="text-[11px] text-slate-500">{l.phone}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {l.product_interest || '—'}
                            {l.biggest_need && <p className="mt-0.5 max-w-xs text-[11px] text-slate-500 line-clamp-2">{l.biggest_need}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block rounded-md border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-sky-300">
                              {l.status === 'new' ? 'New Lead' : l.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[12px] text-slate-400">
                            {l.created_at ? new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-sky-600 px-4 py-3 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  )
}
