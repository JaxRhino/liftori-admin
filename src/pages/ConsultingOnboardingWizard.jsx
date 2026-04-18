/**
 * ConsultingOnboardingWizard — 7-step profile builder for a new consulting
 * engagement. Captures everything from basics → EOS vision seed. Every step
 * is skippable, auto-saves when you click "Save & continue", and is
 * resumable via the `onboarding_step` / `onboarding_completed` flags on
 * consulting_engagements.
 *
 * Route: /admin/consulting/onboard/:engagementId
 *
 * Wiring:
 *   - Open from ConsultingClients.jsx right after an engagement is created.
 *   - Linked from ConsultingClientDetail.jsx ("Resume onboarding" CTA)
 *     whenever onboarding_completed = false.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, ChevronRight, Loader2, SkipForward, Save,
  Building2, Globe, Users, Target, Wrench, Compass, CheckCircle2,
  Plus, Trash2, Star,
} from 'lucide-react'

import {
  COMPANY_SIZE_BUCKETS, REVENUE_BUCKETS, WEBSITE_KINDS, ONBOARDING_STEPS,
  fetchEngagement, updateEngagement, finishOnboarding, advanceOnboardingStep,
  fetchIndustries, addIndustry,
  fetchDepartments, createDepartment, updateDepartment, deleteDepartment,
  fetchOrgMembers, createOrgMember, updateOrgMember, deleteOrgMember,
  fetchWebsites, createWebsite, updateWebsite, deleteWebsite,
  computeProfileCompleteness,
} from '../lib/consultingOnboardingService'
import TeamMemberSelect from '../components/TeamMemberSelect'

// ═══════════════════════════════════════════════════════════════════════
// Shared primitives
// ═══════════════════════════════════════════════════════════════════════

const STEP_ICONS = {
  basics:      Building2,
  company:     Compass,
  web_social:  Globe,
  org:         Users,
  offering:    Target,
  systems:     Wrench,
  eos_seed:    Star,
}

const fieldCls =
  'w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500'
const labelCls = 'block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1'
const optCls   = 'bg-slate-800 text-white'
const btnPrimary =
  'inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50'
const btnGhost =
  'inline-flex items-center gap-2 px-4 py-2 bg-slate-700/60 border border-slate-600 text-gray-300 rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-50'
const btnDanger =
  'inline-flex items-center gap-1 px-2 py-1 text-red-400 hover:bg-red-500/10 rounded text-xs'

function Field({ label, hint, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function SectionCard({ title, subtitle, children, action }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Step 1 — Basics (already captured at lead-create; shown for confirmation/edit)
// ═══════════════════════════════════════════════════════════════════════

function StepBasics({ engagement, onPatch }) {
  const e = engagement
  return (
    <SectionCard title="Basics" subtitle="Confirm what we captured when the lead was created.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Client name *">
          <input
            className={fieldCls}
            value={e.client_name || ''}
            onChange={(ev) => onPatch({ client_name: ev.target.value })}
          />
        </Field>
        <Field label="Company name *">
          <input
            className={fieldCls}
            value={e.company_name || ''}
            onChange={(ev) => onPatch({ company_name: ev.target.value })}
          />
        </Field>
        <Field label="Email *">
          <input
            type="email"
            className={fieldCls}
            value={e.client_email || ''}
            onChange={(ev) => onPatch({ client_email: ev.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={fieldCls}
            value={e.client_phone || ''}
            onChange={(ev) => onPatch({ client_phone: ev.target.value })}
          />
        </Field>
        <Field label="Sales rep">
          <TeamMemberSelect
            value={e.sales_rep_id}
            onChange={(v) => onPatch({ sales_rep_id: v })}
            placeholder="Sales rep"
          />
        </Field>
        <Field label="Discovery rep">
          <TeamMemberSelect
            value={e.discovery_rep_id}
            onChange={(v) => onPatch({ discovery_rep_id: v })}
            placeholder="Discovery rep"
          />
        </Field>
        <Field label="Assigned consultant">
          <TeamMemberSelect
            value={e.consultant_id}
            onChange={(v) => onPatch({ consultant_id: v })}
            placeholder="Consultant"
          />
        </Field>
        <Field label="Test lead?" hint="Check this to skip auto-announcements / noise.">
          <label className="flex items-center gap-2 text-sm text-gray-300 h-10">
            <input
              type="checkbox"
              checked={!!e.is_test_lead}
              onChange={(ev) => onPatch({ is_test_lead: ev.target.checked })}
              className="accent-purple-500"
            />
            Mark as test / sandbox record
          </label>
        </Field>
      </div>
    </SectionCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Step 2 — Company Details (industry + size + revenue + age + HQ)
// ═══════════════════════════════════════════════════════════════════════

function StepCompany({ engagement, onPatch }) {
  const [industries, setIndustries] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newInd, setNewInd] = useState('')

  useEffect(() => {
    let mounted = true
    fetchIndustries()
      .then((list) => { if (mounted) { setIndustries(list); setLoading(false) } })
      .catch((err) => { console.error(err); toast.error('Could not load industries') })
    return () => { mounted = false }
  }, [])

  async function handleAddIndustry() {
    if (!newInd.trim()) return
    setAdding(true)
    try {
      const row = await addIndustry(newInd)
      setIndustries((prev) => {
        const next = [...prev.filter((i) => i.id !== row.id), row]
        next.sort((a, b) => a.name.localeCompare(b.name))
        return next
      })
      onPatch({ industry_id: row.id })
      setNewInd('')
      toast.success(`Added "${row.name}"`)
    } catch (err) {
      toast.error(err.message || 'Could not add industry')
    } finally {
      setAdding(false)
    }
  }

  return (
    <SectionCard
      title="Company Details"
      subtitle="Industry, size, revenue, and age. Skip any field we don't know yet."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Industry">
          <div className="flex gap-2">
            <select
              className={fieldCls}
              value={engagement.industry_id || ''}
              onChange={(ev) => onPatch({ industry_id: ev.target.value || null })}
              disabled={loading}
            >
              <option value="" className={optCls}>— Select industry —</option>
              {industries.map((i) => (
                <option key={i.id} value={i.id} className={optCls}>{i.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-2">
            <input
              className={fieldCls}
              placeholder="Or add a new industry…"
              value={newInd}
              onChange={(ev) => setNewInd(ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && (ev.preventDefault(), handleAddIndustry())}
            />
            <button
              type="button"
              className={btnGhost}
              onClick={handleAddIndustry}
              disabled={adding || !newInd.trim()}
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </Field>

        <Field label="Company size">
          <select
            className={fieldCls}
            value={engagement.company_size_bucket || ''}
            onChange={(ev) => onPatch({ company_size_bucket: ev.target.value || null })}
          >
            <option value="" className={optCls}>— Select size —</option>
            {COMPANY_SIZE_BUCKETS.map((b) => (
              <option key={b.value} value={b.value} className={optCls}>{b.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Employee count (approx)">
          <input
            type="number"
            min="0"
            className={fieldCls}
            value={engagement.employee_count ?? ''}
            onChange={(ev) =>
              onPatch({ employee_count: ev.target.value === '' ? null : parseInt(ev.target.value, 10) })
            }
          />
        </Field>

        <Field label="Annual revenue">
          <select
            className={fieldCls}
            value={engagement.annual_revenue_bucket || ''}
            onChange={(ev) => onPatch({ annual_revenue_bucket: ev.target.value || null })}
          >
            <option value="" className={optCls}>— Select revenue bucket —</option>
            {REVENUE_BUCKETS.map((b) => (
              <option key={b.value} value={b.value} className={optCls}>{b.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Years in business">
          <input
            type="number"
            min="0"
            className={fieldCls}
            value={engagement.years_in_business ?? ''}
            onChange={(ev) =>
              onPatch({ years_in_business: ev.target.value === '' ? null : parseInt(ev.target.value, 10) })
            }
          />
        </Field>

        <Field label="Founded date">
          <input
            type="date"
            className={fieldCls}
            value={engagement.founded_date || ''}
            onChange={(ev) => onPatch({ founded_date: ev.target.value || null })}
          />
        </Field>

        <Field label="Headquarters address" hint="Street, city, state, zip — free form.">
          <textarea
            className={`${fieldCls} min-h-[64px]`}
            value={engagement.headquarters_address || ''}
            onChange={(ev) => onPatch({ headquarters_address: ev.target.value })}
          />
        </Field>
      </div>
    </SectionCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Step 3 — Web & Social (primary site + additional sites + socials)
// ═══════════════════════════════════════════════════════════════════════

const SOCIAL_PLATFORMS = [
  { key: 'website',   label: 'Website' },
  { key: 'linkedin',  label: 'LinkedIn' },
  { key: 'facebook',  label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'twitter',   label: 'X / Twitter' },
  { key: 'tiktok',    label: 'TikTok' },
  { key: 'youtube',   label: 'YouTube' },
  { key: 'yelp',      label: 'Yelp' },
  { key: 'google_business', label: 'Google Business Profile' },
]

function StepWebSocial({ engagement, onPatch }) {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ url: '', kind: 'main', is_primary: false, label: '' })

  useEffect(() => {
    let mounted = true
    fetchWebsites(engagement.id)
      .then((list) => { if (mounted) { setSites(list); setLoading(false) } })
      .catch((err) => { console.error(err); toast.error('Could not load websites') })
    return () => { mounted = false }
  }, [engagement.id])

  const social = engagement.social_urls || {}

  async function handleAddSite() {
    const url = (draft.url || '').trim()
    if (!url) return toast.error('URL is required')
    try {
      const row = await createWebsite(engagement.id, draft)
      setSites((prev) => [row, ...prev])
      setDraft({ url: '', kind: 'main', is_primary: false, label: '' })
      toast.success('Site added')
    } catch (err) {
      toast.error(err.message || 'Could not add site')
    }
  }

  async function handleDeleteSite(id) {
    if (!confirm('Delete this site?')) return
    try {
      await deleteWebsite(id)
      setSites((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      toast.error(err.message || 'Could not delete')
    }
  }

  async function handleTogglePrimary(site) {
    try {
      // Demote any other primaries client-side optimistic, then persist.
      const updated = await updateWebsite(site.id, { is_primary: !site.is_primary })
      if (updated.is_primary) {
        await Promise.all(
          sites
            .filter((s) => s.id !== site.id && s.is_primary)
            .map((s) => updateWebsite(s.id, { is_primary: false })),
        )
      }
      const list = await fetchWebsites(engagement.id)
      setSites(list)
    } catch (err) {
      toast.error(err.message || 'Could not update')
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard
        title="Primary Website"
        subtitle="The public URL we'll audit first. You can add more below."
      >
        <Field label="Primary website URL">
          <input
            className={fieldCls}
            placeholder="https://example.com"
            value={engagement.primary_website || ''}
            onChange={(ev) => onPatch({ primary_website: ev.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Additional Sites"
        subtitle="Subdomains, blogs, shops, landing pages — anything SEO-relevant."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <input
            className={`${fieldCls} md:col-span-2`}
            placeholder="https://blog.example.com"
            value={draft.url}
            onChange={(ev) => setDraft({ ...draft, url: ev.target.value })}
          />
          <select
            className={fieldCls}
            value={draft.kind}
            onChange={(ev) => setDraft({ ...draft, kind: ev.target.value })}
          >
            {WEBSITE_KINDS.map((k) => (
              <option key={k.value} value={k.value} className={optCls}>{k.label}</option>
            ))}
          </select>
          <button type="button" className={btnPrimary} onClick={handleAddSite}>
            <Plus className="w-4 h-4" /> Add site
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : sites.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No additional sites added yet.</p>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {sites.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{s.url}</div>
                  <div className="text-xs text-gray-500">
                    {WEBSITE_KINDS.find((k) => k.value === s.kind)?.label || s.kind}
                    {s.is_primary && <span className="ml-2 text-emerald-400">· Primary</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTogglePrimary(s)}
                    className="text-xs text-purple-300 hover:text-purple-200"
                  >
                    {s.is_primary ? 'Unset primary' : 'Make primary'}
                  </button>
                  <button type="button" onClick={() => handleDeleteSite(s.id)} className={btnDanger}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Social & Listings" subtitle="Paste full URLs. Leave blank for any they don't use.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SOCIAL_PLATFORMS.map((p) => (
            <Field key={p.key} label={p.label}>
              <input
                className={fieldCls}
                placeholder="https://…"
                value={social[p.key] || ''}
                onChange={(ev) =>
                  onPatch({ social_urls: { ...social, [p.key]: ev.target.value } })
                }
              />
            </Field>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Step 4 — Org & Departments (doubles as EOS Accountability Chart seed)
// ═══════════════════════════════════════════════════════════════════════

function StepOrg({ engagement }) {
  const [depts, setDepts] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [deptDraft, setDeptDraft] = useState({ name: '', head_count: '' })
  const [memberDraft, setMemberDraft] = useState({
    full_name: '', title: '', email: '', phone: '', reports_to_id: '', seat_roles: '',
  })

  async function reload() {
    const [d, m] = await Promise.all([fetchDepartments(engagement.id), fetchOrgMembers(engagement.id)])
    setDepts(d); setMembers(m)
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await reload()
      } catch (err) {
        console.error(err); toast.error('Could not load org')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagement.id])

  async function handleAddDept() {
    if (!deptDraft.name.trim()) return
    try {
      await createDepartment(engagement.id, {
        name: deptDraft.name.trim(),
        head_count: deptDraft.head_count === '' ? null : parseInt(deptDraft.head_count, 10),
        sort_order: depts.length,
      })
      setDeptDraft({ name: '', head_count: '' })
      await reload()
    } catch (err) { toast.error(err.message) }
  }

  async function handleDeleteDept(id) {
    if (!confirm('Delete this department?')) return
    try { await deleteDepartment(id); await reload() } catch (err) { toast.error(err.message) }
  }

  async function handleAddMember() {
    if (!memberDraft.full_name.trim()) return toast.error('Name is required')
    try {
      await createOrgMember(engagement.id, {
        full_name: memberDraft.full_name.trim(),
        title: memberDraft.title || null,
        email: memberDraft.email || null,
        phone: memberDraft.phone || null,
        reports_to_id: memberDraft.reports_to_id || null,
        seat_roles: memberDraft.seat_roles
          ? memberDraft.seat_roles.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        sort_order: members.length,
      })
      setMemberDraft({ full_name: '', title: '', email: '', phone: '', reports_to_id: '', seat_roles: '' })
      await reload()
    } catch (err) { toast.error(err.message) }
  }

  async function handleDeleteMember(id) {
    if (!confirm('Delete this person?')) return
    try { await deleteOrgMember(id); await reload() } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Departments" subtitle="How the org is divided. Add as many as you know.">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <input
            className={`${fieldCls} md:col-span-2`}
            placeholder="e.g. Sales, Operations, Engineering"
            value={deptDraft.name}
            onChange={(ev) => setDeptDraft({ ...deptDraft, name: ev.target.value })}
          />
          <input
            type="number"
            min="0"
            className={fieldCls}
            placeholder="# of people"
            value={deptDraft.head_count}
            onChange={(ev) => setDeptDraft({ ...deptDraft, head_count: ev.target.value })}
          />
          <button type="button" className={btnPrimary} onClick={handleAddDept}>
            <Plus className="w-4 h-4" /> Add dept
          </button>
        </div>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        ) : depts.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No departments yet.</p>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {depts.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{d.name}</div>
                  <div className="text-xs text-gray-500">
                    {d.head_count != null ? `${d.head_count} people` : 'Size unknown'}
                  </div>
                </div>
                <button type="button" onClick={() => handleDeleteDept(d.id)} className={btnDanger}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Leadership & Org Chart"
        subtitle="Owners, execs, department heads. We'll use this as the EOS Accountability Chart seed."
      >
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
          <input
            className={`${fieldCls} md:col-span-2`}
            placeholder="Full name *"
            value={memberDraft.full_name}
            onChange={(ev) => setMemberDraft({ ...memberDraft, full_name: ev.target.value })}
          />
          <input
            className={`${fieldCls} md:col-span-2`}
            placeholder="Title (CEO, COO, etc.)"
            value={memberDraft.title}
            onChange={(ev) => setMemberDraft({ ...memberDraft, title: ev.target.value })}
          />
          <input
            className={fieldCls}
            placeholder="Email"
            value={memberDraft.email}
            onChange={(ev) => setMemberDraft({ ...memberDraft, email: ev.target.value })}
          />
          <input
            className={fieldCls}
            placeholder="Phone"
            value={memberDraft.phone}
            onChange={(ev) => setMemberDraft({ ...memberDraft, phone: ev.target.value })}
          />
          <select
            className={`${fieldCls} md:col-span-2`}
            value={memberDraft.reports_to_id}
            onChange={(ev) => setMemberDraft({ ...memberDraft, reports_to_id: ev.target.value })}
          >
            <option value="" className={optCls}>Reports to (top of chart)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id} className={optCls}>{m.full_name}{m.title ? ` · ${m.title}` : ''}</option>
            ))}
          </select>
          <input
            className={`${fieldCls} md:col-span-3`}
            placeholder="Seat roles (comma-sep, EOS style)"
            value={memberDraft.seat_roles}
            onChange={(ev) => setMemberDraft({ ...memberDraft, seat_roles: ev.target.value })}
          />
          <button type="button" className={btnPrimary} onClick={handleAddMember}>
            <Plus className="w-4 h-4" /> Add person
          </button>
        </div>

        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No leadership added yet.</p>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {members.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white">
                    {m.full_name}
                    {m.title && <span className="text-gray-400"> · {m.title}</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {[m.email, m.phone].filter(Boolean).join(' · ')}
                    {m.reports_to_id && members.find((x) => x.id === m.reports_to_id) && (
                      <span className="ml-2">→ reports to {members.find((x) => x.id === m.reports_to_id).full_name}</span>
                    )}
                  </div>
                  {m.seat_roles?.length > 0 && (
                    <div className="text-[11px] text-purple-300 mt-1">
                      Seats: {m.seat_roles.join(', ')}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => handleDeleteMember(m.id)} className={btnDanger}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Step 5 — Offering & Goals
// ═══════════════════════════════════════════════════════════════════════

function StepOffering({ engagement, onPatch }) {
  return (
    <SectionCard
      title="Offering, Audience & Goals"
      subtitle="Who do they serve, what do they sell, and where do they want to go?"
    >
      <div className="grid grid-cols-1 gap-4">
        <Field label="What they sell / offer">
          <textarea
            className={`${fieldCls} min-h-[72px]`}
            placeholder="Products, services, key packages…"
            value={engagement.offerings || ''}
            onChange={(ev) => onPatch({ offerings: ev.target.value })}
          />
        </Field>
        <Field label="Target customer">
          <textarea
            className={`${fieldCls} min-h-[64px]`}
            placeholder="Ideal customer profile — demographics, firmographics, pain they solve."
            value={engagement.target_customer || ''}
            onChange={(ev) => onPatch({ target_customer: ev.target.value })}
          />
        </Field>
        <Field label="Current pain points / biggest frustrations">
          <textarea
            className={`${fieldCls} min-h-[64px]`}
            placeholder="What's broken, what's keeping them up at night."
            value={engagement.pain_points || ''}
            onChange={(ev) => onPatch({ pain_points: ev.target.value })}
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="12-month goals">
            <textarea
              className={`${fieldCls} min-h-[64px]`}
              value={engagement.goals_12mo || ''}
              onChange={(ev) => onPatch({ goals_12mo: ev.target.value })}
            />
          </Field>
          <Field label="3-year goals">
            <textarea
              className={`${fieldCls} min-h-[64px]`}
              value={engagement.goals_3yr || ''}
              onChange={(ev) => onPatch({ goals_3yr: ev.target.value })}
            />
          </Field>
        </div>
        <Field label="Current marketing strategy" hint="How do they get customers today?">
          <textarea
            className={`${fieldCls} min-h-[64px]`}
            value={engagement.marketing_strategy || ''}
            onChange={(ev) => onPatch({ marketing_strategy: ev.target.value })}
          />
        </Field>
      </div>
    </SectionCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Step 6 — Current Systems (tools they already use)
// ═══════════════════════════════════════════════════════════════════════

const TOOL_CATEGORIES = [
  { key: 'crm',        label: 'CRM' },
  { key: 'accounting', label: 'Accounting / Bookkeeping' },
  { key: 'email',      label: 'Email marketing' },
  { key: 'scheduling', label: 'Scheduling / Calendar' },
  { key: 'payments',   label: 'Payments / Invoicing' },
  { key: 'pm',         label: 'Project management' },
  { key: 'comms',      label: 'Team communication' },
  { key: 'website',    label: 'Website / CMS' },
  { key: 'ecommerce',  label: 'E-commerce' },
  { key: 'phone',      label: 'Phone / VoIP' },
  { key: 'hr',         label: 'HR / Payroll' },
  { key: 'analytics',  label: 'Analytics' },
  { key: 'other',      label: 'Other' },
]

function StepSystems({ engagement, onPatch }) {
  const tools = engagement.current_tools || {}
  return (
    <SectionCard
      title="Current Systems & Tools"
      subtitle="What they already use. Helps us spot gaps and avoid tool duplication."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOOL_CATEGORIES.map((c) => (
          <Field key={c.key} label={c.label}>
            <input
              className={fieldCls}
              placeholder="e.g. HubSpot, QuickBooks, n/a"
              value={tools[c.key] || ''}
              onChange={(ev) => onPatch({ current_tools: { ...tools, [c.key]: ev.target.value } })}
            />
          </Field>
        ))}
      </div>
    </SectionCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Step 7 — EOS Vision Seed (Core Values, Core Focus, 10-yr target)
// ═══════════════════════════════════════════════════════════════════════

function StepEOS({ engagement, onPatch }) {
  const cv = Array.isArray(engagement.core_values) ? engagement.core_values : []
  const [draft, setDraft] = useState('')

  function addValue() {
    const v = draft.trim()
    if (!v) return
    onPatch({ core_values: [...cv, v] })
    setDraft('')
  }

  function removeValue(i) {
    onPatch({ core_values: cv.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-5">
      <SectionCard
        title="EOS Vision Seed"
        subtitle="Rough first pass — we'll refine this in the V/TO session. Everything here is skippable."
      >
        <Field label="Core values" hint="3–7 short phrases. Press Enter to add.">
          <div className="flex gap-2 mb-2">
            <input
              className={fieldCls}
              placeholder="e.g. Deliver, Don't Just Promise"
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && (ev.preventDefault(), addValue())}
            />
            <button type="button" className={btnGhost} onClick={addValue}>
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {cv.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No core values captured yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cv.map((v, i) => (
                <span key={`${v}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-full text-xs">
                  {v}
                  <button type="button" onClick={() => removeValue(i)} className="hover:text-red-300">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Core focus — purpose / cause / passion">
            <textarea
              className={`${fieldCls} min-h-[72px]`}
              placeholder="Why the company exists."
              value={engagement.core_focus_purpose || ''}
              onChange={(ev) => onPatch({ core_focus_purpose: ev.target.value })}
            />
          </Field>
          <Field label="Core focus — niche">
            <textarea
              className={`${fieldCls} min-h-[72px]`}
              placeholder="What they do best."
              value={engagement.core_focus_niche || ''}
              onChange={(ev) => onPatch({ core_focus_niche: ev.target.value })}
            />
          </Field>
        </div>

        <Field label="10-year target">
          <textarea
            className={`${fieldCls} min-h-[72px]`}
            placeholder="The long-range BHAG. Can be revenue, impact, market position."
            value={engagement.ten_year_target || ''}
            onChange={(ev) => onPatch({ ten_year_target: ev.target.value })}
          />
        </Field>
      </SectionCard>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Wizard shell
// ═══════════════════════════════════════════════════════════════════════

export default function ConsultingOnboardingWizard() {
  const { engagementId } = useParams()
  const navigate = useNavigate()

  const [engagement, setEngagement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [dirtyPatch, setDirtyPatch] = useState({})

  // Completeness (calculated on each engagement change)
  const [deps, setDeps] = useState({ departments: [], members: [], websites: [] })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const e = await fetchEngagement(engagementId)
        if (!mounted) return
        setEngagement(e)
        // jump to resume step (onboarding_step is 1-indexed in DB; stepIdx is 0-indexed)
        const resumeIdx = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, (e.onboarding_step || 1) - 1))
        setStepIdx(resumeIdx)
        const [departments, members, websites] = await Promise.all([
          fetchDepartments(engagementId),
          fetchOrgMembers(engagementId),
          fetchWebsites(engagementId),
        ])
        if (mounted) setDeps({ departments, members, websites })
      } catch (err) {
        console.error(err)
        toast.error('Could not load engagement')
        navigate('/admin/consulting/clients')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [engagementId, navigate])

  const step = ONBOARDING_STEPS[stepIdx]
  const StepIcon = STEP_ICONS[step?.key] || Compass
  const isLast = stepIdx === ONBOARDING_STEPS.length - 1

  const merged = useMemo(() => ({ ...(engagement || {}), ...dirtyPatch }), [engagement, dirtyPatch])
  const completeness = useMemo(
    () => (engagement ? computeProfileCompleteness(merged, deps) : null),
    [merged, deps, engagement],
  )

  function handlePatch(patch) {
    setDirtyPatch((prev) => ({ ...prev, ...patch }))
  }

  async function persist(advanceTo /* 1-based step to save as onboarding_step */) {
    if (Object.keys(dirtyPatch).length === 0 && advanceTo == null) return engagement
    setSaving(true)
    try {
      const payload = { ...dirtyPatch }
      if (advanceTo != null) payload.onboarding_step = advanceTo
      const updated = await updateEngagement(engagementId, payload)
      setEngagement(updated)
      setDirtyPatch({})
      // Refresh collections (depts / members / sites could have been edited inline)
      const [departments, members, websites] = await Promise.all([
        fetchDepartments(engagementId),
        fetchOrgMembers(engagementId),
        fetchWebsites(engagementId),
      ])
      setDeps({ departments, members, websites })
      return updated
    } catch (err) {
      toast.error(err.message || 'Save failed')
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndNext() {
    try {
      await persist(stepIdx + 2 > ONBOARDING_STEPS.length ? ONBOARDING_STEPS.length : stepIdx + 2)
      if (!isLast) setStepIdx(stepIdx + 1)
      toast.success('Saved')
    } catch { /* already toasted */ }
  }

  async function handleSkip() {
    try {
      // Persist any already-entered edits but don't require completion.
      await persist(stepIdx + 2 > ONBOARDING_STEPS.length ? ONBOARDING_STEPS.length : stepIdx + 2)
    } catch { return }
    if (!isLast) setStepIdx(stepIdx + 1)
  }

  async function handleBack() {
    if (stepIdx === 0) return
    // Don't persist on back to avoid partially-valid saves; just drop the dirty patch.
    setDirtyPatch({})
    setStepIdx(stepIdx - 1)
  }

  async function handleFinish() {
    try {
      await persist(ONBOARDING_STEPS.length)
      await finishOnboarding(engagementId)
      toast.success('Onboarding complete')
      navigate(`/admin/consulting/client/${engagementId}`)
    } catch { /* already toasted */ }
  }

  async function handleSaveDraft() {
    try {
      await persist(stepIdx + 1)
      await advanceOnboardingStep(engagementId, stepIdx + 1)
      toast.success('Draft saved — resume anytime')
      navigate(`/admin/consulting/client/${engagementId}`)
    } catch { /* already toasted */ }
  }

  if (loading || !engagement) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => navigate(`/admin/consulting/client/${engagementId}`)}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to client
        </button>
        {completeness && (
          <div className="text-xs text-gray-400">
            Profile <span className="text-white font-semibold">{completeness.percent}%</span> complete
            <span className="text-gray-600 ml-1">({completeness.passed}/{completeness.total})</span>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {engagement.company_name || engagement.client_name || 'New Client'} — Onboarding
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Capture everything we know. Skip any field we don't — you can resume anytime.
        </p>
      </div>

      {/* Step rail */}
      <div className="mb-6 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {ONBOARDING_STEPS.map((s, i) => {
            const Icon = STEP_ICONS[s.key] || Compass
            const active = i === stepIdx
            const done = i < stepIdx || (engagement.onboarding_completed && i <= ONBOARDING_STEPS.length - 1)
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStepIdx(i)}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  active
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                    : done
                    ? 'text-emerald-300 hover:bg-slate-700/40'
                    : 'text-gray-400 hover:bg-slate-700/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
                {i < ONBOARDING_STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-600" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Step header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-lg">
          <StepIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Step {stepIdx + 1} of {ONBOARDING_STEPS.length} — {step.label}
          </h2>
        </div>
      </div>

      {/* Step body */}
      <div className="mb-6">
        {step.key === 'basics'     && <StepBasics     engagement={merged} onPatch={handlePatch} />}
        {step.key === 'company'    && <StepCompany    engagement={merged} onPatch={handlePatch} />}
        {step.key === 'web_social' && <StepWebSocial  engagement={merged} onPatch={handlePatch} />}
        {step.key === 'org'        && <StepOrg        engagement={merged} />}
        {step.key === 'offering'   && <StepOffering   engagement={merged} onPatch={handlePatch} />}
        {step.key === 'systems'    && <StepSystems    engagement={merged} onPatch={handlePatch} />}
        {step.key === 'eos_seed'   && <StepEOS        engagement={merged} onPatch={handlePatch} />}
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-slate-900/95 backdrop-blur border-t border-slate-700/50 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className={btnGhost}
          disabled={stepIdx === 0 || saving}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSaveDraft} className={btnGhost} disabled={saving}>
            <Save className="w-4 h-4" /> Save & close
          </button>
          <button type="button" onClick={handleSkip} className={btnGhost} disabled={saving || isLast}>
            <SkipForward className="w-4 h-4" /> Skip for now
          </button>
          {!isLast ? (
            <button type="button" onClick={handleSaveAndNext} className={btnPrimary} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Save & continue
            </button>
          ) : (
            <button type="button" onClick={handleFinish} className={btnPrimary} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Finish onboarding
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
