import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../../lib/AuthContext'
import { isFounder } from '../../lib/testerProgramService'
import {
  AUDIENCE_TYPES, TEMPLATE_CATEGORIES,
  listCampaigns, createCampaign, updateCampaign, deleteCampaign,
  sendCampaignNow, previewAudienceCount, listTemplates,
} from '../../lib/campaignsService'

const STATUS_META = {
  draft:     { label: 'Draft',     color: 'bg-slate-500/15 text-slate-300'     },
  scheduled: { label: 'Scheduled', color: 'bg-sky-500/15 text-sky-300'         },
  sending:   { label: 'Sending…',  color: 'bg-amber-500/15 text-amber-300'     },
  sent:      { label: 'Sent',      color: 'bg-emerald-500/15 text-emerald-300' },
  failed:    { label: 'Failed',    color: 'bg-rose-500/15 text-rose-300'       },
  cancelled: { label: 'Cancelled', color: 'bg-zinc-500/15 text-zinc-300'       },
}

function emptyCampaign() {
  return {
    name: '', subject: '', body_html: '', body_preview: '',
    channel: 'email', category: 'platform_announcement',
    audience_type: 'all_testers', audience_filter: {},
    scheduled_at: null, template_id: null,
  }
}

export default function Campaigns() {
  const { user, profile } = useAuth()
  const allowed = isFounder({ email: user?.email, personal_email: profile?.personal_email })
  const [campaigns, setCampaigns] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyCampaign())
  const [audienceCount, setAudienceCount] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')

  async function load() {
    setLoading(true)
    try {
      const [cs, ts] = await Promise.all([listCampaigns(), listTemplates()])
      setCampaigns(cs); setTemplates(ts)
    } catch (e) { console.error(e); toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (allowed) load() }, [allowed])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!showComposer) { setAudienceCount(null); return }
      try {
        const count = await previewAudienceCount(form.audience_type, form.audience_filter || {})
        if (!cancelled) setAudienceCount(count)
      } catch { if (!cancelled) setAudienceCount(null) }
    })()
    return () => { cancelled = true }
  }, [showComposer, form.audience_type, form.audience_filter])

  const visible = useMemo(() => {
    if (filterStatus === 'all') return campaigns
    return campaigns.filter((c) => c.status === filterStatus)
  }, [campaigns, filterStatus])

  function openNew() {
    setEditing(null); setForm(emptyCampaign()); setShowComposer(true)
  }
  function openEdit(c) {
    setEditing(c.id)
    setForm({
      name: c.name, subject: c.subject, body_html: c.body_html,
      body_preview: c.body_preview || '', channel: c.channel, category: c.category,
      audience_type: c.audience_type, audience_filter: c.audience_filter || {},
      scheduled_at: c.scheduled_at, template_id: c.template_id,
    })
    setShowComposer(true)
  }
  function loadTemplate(t) {
    if (!t) return
    setForm((f) => ({
      ...f, subject: t.subject, body_html: t.body_html,
      body_preview: t.body_preview || '', channel: t.channel, category: t.category,
      template_id: t.id, name: f.name || t.name,
    }))
  }

  async function save(andSend = false) {
    if (!form.name.trim() || !form.subject.trim() || !form.body_html.trim()) {
      toast.error('Name, subject, and body are required')
      return
    }
    setBusy(true)
    try {
      let saved
      const payload = {
        created_by: user.id, ...form,
        audience_preview_count: audienceCount ?? null,
      }
      if (editing) saved = await updateCampaign(editing, payload)
      else saved = await createCampaign(payload)
      toast.success(editing ? 'Campaign updated' : 'Campaign saved as draft')

      if (andSend) {
        if (!window.confirm(`Send this campaign to ${audienceCount ?? '?'} recipients now?`)) {
          setBusy(false); return
        }
        const result = await sendCampaignNow(saved.id)
        if (result?.ok) toast.success(`Sent — ${result.sent} delivered, ${result.failed} failed`)
        else toast.error('Send completed with errors — check the log')
      }

      setShowComposer(false); setEditing(null); setForm(emptyCampaign()); load()
    } catch (e) { console.error(e); toast.error('Save failed: ' + (e?.message || 'unknown')) }
    finally { setBusy(false) }
  }

  async function sendDraft(c) {
    if (!window.confirm(`Send "${c.name}" to ${c.audience_preview_count || '?'} recipients now?`)) return
    try {
      const result = await sendCampaignNow(c.id)
      if (result?.ok) toast.success(`Sent — ${result.sent} delivered, ${result.failed} failed`)
      else toast.error('Send completed with errors — check the log')
      load()
    } catch (e) { toast.error('Send failed: ' + (e?.message || 'unknown')) }
  }

  async function del(id) {
    if (!window.confirm('Delete this campaign? This cannot be undone.')) return
    try { await deleteCampaign(id); toast.success('Deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  if (!allowed) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500">Founder access required.</div>
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><span>📣</span><span>Campaigns</span></h1>
          <p className="text-sm text-gray-400">Broadcast HR + platform communications. Pick an audience, compose, schedule or send.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded-md px-2 py-1.5 text-xs text-white">
            <option value="all">All statuses</option>
            {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <button onClick={openNew} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">+ New campaign</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center text-gray-500 py-20 italic">
          {campaigns.length === 0 ? 'No campaigns yet. Click "New campaign" to send your first HR or platform broadcast.' : 'No campaigns match that filter.'}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((c) => {
            const statusMeta = STATUS_META[c.status] || STATUS_META.draft
            const categoryMeta = TEMPLATE_CATEGORIES.find((t) => t.key === c.category)
            const audienceMeta = AUDIENCE_TYPES.find((a) => a.key === c.audience_type)
            return (
              <div key={c.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${statusMeta.color}`}>{statusMeta.label}</span>
                      {categoryMeta && <span className="text-[10px] text-gray-400">{categoryMeta.icon} {categoryMeta.label}</span>}
                      <span className="text-[10px] text-gray-500">· {audienceMeta?.label || c.audience_type}</span>
                      {c.recipients_queued > 0 && <span className="text-[10px] text-gray-500">· {c.recipients_sent}/{c.recipients_queued} sent{c.recipients_failed > 0 ? ` · ${c.recipients_failed} failed` : ''}</span>}
                    </div>
                    <div className="text-sm font-semibold text-white">{c.name}</div>
                    <div className="text-xs text-gray-400 line-clamp-1">{c.subject}</div>
                    {c.sent_at && <div className="text-[10px] text-gray-500 mt-1">Sent {new Date(c.sent_at).toLocaleString()}</div>}
                    {c.status === 'draft' && <div className="text-[10px] text-gray-500 mt-1">Drafted {new Date(c.created_at).toLocaleString()}</div>}
                  </div>
                  <div className="flex flex-col gap-1 items-end flex-shrink-0">
                    {c.status === 'draft' && (
                      <>
                        <button onClick={() => sendDraft(c)} className="text-[10px] px-2 py-1 bg-pink-500 hover:bg-pink-600 text-white rounded font-medium">🚀 Send now</button>
                        <button onClick={() => openEdit(c)} className="text-[10px] px-2 py-1 text-gray-400 hover:text-white">Edit</button>
                      </>
                    )}
                    <button onClick={() => del(c.id)} className="text-[10px] text-gray-500 hover:text-rose-400">Delete</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showComposer && (
        <Composer
          form={form} setForm={setForm} templates={templates}
          audienceCount={audienceCount} onLoadTemplate={loadTemplate}
          busy={busy} editing={editing}
          onCancel={() => { setShowComposer(false); setEditing(null); setForm(emptyCampaign()) }}
          onSave={() => save(false)} onSaveAndSend={() => save(true)}
        />
      )}
    </div>
  )
}

function Composer({ form, setForm, templates, audienceCount, onLoadTemplate, busy, editing, onCancel, onSave, onSaveAndSend }) {
  const templatesByGroup = useMemo(() => {
    const map = {}
    for (const t of templates) {
      const cat = TEMPLATE_CATEGORIES.find((c) => c.key === t.category)
      const group = cat?.group || 'Other'
      if (!map[group]) map[group] = []
      map[group].push(t)
    }
    return map
  }, [templates])

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-navy-900 border border-navy-700/50 rounded-xl w-full max-w-6xl my-8">
        <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700/50">
          <h2 className="text-lg font-bold text-white">{editing ? 'Edit campaign' : 'New campaign'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0">
          {/* Template picker sidebar */}
          <div className="border-r border-navy-700/50 p-3 max-h-[75vh] overflow-y-auto">
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-2">Start from template</div>
            {Object.entries(templatesByGroup).map(([group, list]) => (
              <div key={group} className="mb-3">
                <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">{group}</div>
                <div className="space-y-1">
                  {list.map((t) => (
                    <button
                      key={t.id} onClick={() => onLoadTemplate(t)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded border ${form.template_id === t.id ? 'bg-pink-500/15 border-pink-500/50 text-white' : 'bg-navy-800 border-navy-700/50 text-gray-300 hover:text-white hover:border-pink-500/30'}`}
                    >
                      <div className="font-semibold truncate">{t.name}</div>
                      {t.description && <div className="text-[10px] text-gray-500 line-clamp-1">{t.description}</div>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => setForm((f) => ({ ...f, template_id: null, subject: '', body_html: '', body_preview: '' }))}
              className="w-full text-left text-xs px-2 py-1.5 rounded border bg-navy-800 border-navy-700/50 text-gray-400 hover:text-white"
            >
              ✨ Start blank
            </button>
          </div>

          {/* Composer form */}
          <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
            <div>
              <div className="text-[10px] uppercase text-gray-500 mb-1">Internal name</div>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder='e.g. "April 1099 reminder to testers"'
                className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Category</div>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-xs text-white">
                  {TEMPLATE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Channel</div>
                <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-xs text-white">
                  <option value="email">Email</option>
                  <option value="email_and_chat">Email + Chat</option>
                  <option value="chat">Chat only</option>
                  <option value="banner">Banner</option>
                </select>
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Schedule (optional)</div>
                <input type="datetime-local" value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ''}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-xs text-white" />
              </div>
            </div>

            {/* Audience */}
            <div className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase font-bold text-gray-500">Audience</div>
                {audienceCount !== null && (
                  <div className={`text-xs font-semibold ${audienceCount === 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {audienceCount} recipient{audienceCount === 1 ? '' : 's'}
                  </div>
                )}
              </div>
              <select value={form.audience_type} onChange={(e) => setForm((f) => ({ ...f, audience_type: e.target.value, audience_filter: {} }))}
                className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-xs text-white">
                {['HR', 'Platform', 'Advanced'].map((g) => (
                  <optgroup key={g} label={g}>
                    {AUDIENCE_TYPES.filter((a) => a.group === g).map((a) => (
                      <option key={a.key} value={a.key}>{a.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="text-[10px] text-gray-500 mt-1">{AUDIENCE_TYPES.find((a) => a.key === form.audience_type)?.hint}</div>

              {form.audience_type === 'affiliate_tier' && (
                <select value={form.audience_filter?.tier || ''} onChange={(e) => setForm((f) => ({ ...f, audience_filter: { tier: e.target.value } }))} className="mt-2 w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-xs text-white">
                  <option value="">— Pick a tier —</option>
                  <option value="free">Starter (free)</option>
                  <option value="creator">Creator</option>
                  <option value="pro">Pro</option>
                  <option value="diamond">Diamond</option>
                </select>
              )}

              {form.audience_type === 'custom_filter' && (
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {['admin', 'super_admin', 'dev', 'sales', 'consultant', 'tester', 'manager', 'customer', 'affiliate'].map((role) => {
                    const checked = (form.audience_filter?.roles || []).includes(role)
                    return (
                      <label key={role} className="flex items-center gap-1.5 text-[11px] text-gray-300">
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          const cur = form.audience_filter?.roles || []
                          const next = e.target.checked ? [...cur, role] : cur.filter((r) => r !== role)
                          setForm((f) => ({ ...f, audience_filter: { roles: next } }))
                        }} />
                        {role}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Subject + body */}
            <div>
              <div className="text-[10px] uppercase text-gray-500 mb-1">Subject</div>
              <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Subject line (placeholders like {{first_name}} are replaced at send-time)"
                className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] uppercase text-gray-500">Body (HTML)</div>
                <div className="text-[10px] text-gray-500">Use <code className="text-pink-300">{'{{first_name}}'}</code>, <code className="text-pink-300">{'{{email}}'}</code> for personalization</div>
              </div>
              <textarea value={form.body_html} onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))} rows={10}
                placeholder="<p>Hi {{first_name}},</p><p>…</p>"
                className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-xs text-white font-mono" />
            </div>

            <div>
              <div className="text-[10px] uppercase text-gray-500 mb-1">Preview text (optional)</div>
              <input value={form.body_preview} onChange={(e) => setForm((f) => ({ ...f, body_preview: e.target.value }))} placeholder="Shown in inbox preview line — one short sentence"
                className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-xs text-white" />
            </div>

            {/* Live preview */}
            {form.body_html && (
              <details className="bg-navy-800/40 border border-navy-700/50 rounded-md">
                <summary className="px-3 py-2 text-[10px] uppercase font-bold text-gray-400 cursor-pointer">Live preview</summary>
                <div className="bg-white rounded-b-md overflow-hidden max-h-80 overflow-y-auto">
                  <iframe srcDoc={form.body_html.replace(/\{\{first_name\}\}/g, 'Ryan').replace(/\{\{email\}\}/g, 'ryan@liftori.ai')} title="preview" sandbox="" className="w-full min-h-64 border-0" />
                </div>
              </details>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-navy-700/50">
              <button onClick={onCancel} disabled={busy} className="px-3 py-2 bg-navy-800 hover:bg-navy-700 text-gray-300 rounded-md text-xs font-medium">Cancel</button>
              <button onClick={onSave} disabled={busy} className="px-3 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-md text-xs font-medium">{busy ? 'Saving…' : 'Save draft'}</button>
              <button onClick={onSaveAndSend} disabled={busy || audienceCount === 0} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white rounded-md text-sm font-medium">
                {busy ? 'Sending…' : `🚀 Send to ${audienceCount ?? '?'}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
