import { useEffect, useState } from 'react'
import {
  listEmailCampaigns, createEmailCampaign, updateEmailCampaign, deleteEmailCampaign,
  sendEmailCampaign, previewAudienceCount, listOutboundEmails, emailCampaignMetrics,
  listEmailSubscribers, createEmailSubscriber, toggleSubscriberActive, deleteEmailSubscriber,
  listSegments, renderMergeTags,
  EMAIL_CATEGORIES, EMAIL_STATUSES, AUDIENCE_TYPES, EMAIL_MERGE_TAGS,
  formatInt, formatPct,
} from '../../lib/marketingService'

const emptyForm = {
  name: '', subject: '', body: '', category: 'platform_announcement',
  status: 'draft', audience_type: 'all_subscribers', audience_filter: {},
  scheduled_at: '', segment_id: '', custom_emails: '',
}

const SAMPLE_VARS = { first_name: 'Vanessa', email: 'vanessa@example.com', full_name: 'Vanessa Martinez', company: 'VJ Thrift Finds', today: new Date().toLocaleDateString() }

export default function EmailCampaigns() {
  const [tab, setTab] = useState('campaigns')
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [outbound, setOutbound] = useState([])
  const [segments, setSegments] = useState([])
  const [subscribers, setSubscribers] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [q, setQ] = useState('')
  const [composing, setComposing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { tab === 'campaigns' ? loadCampaigns() : loadSubscribers() }, [tab, filterStatus, filterCategory])
  useEffect(() => { listSegments().then(setSegments).catch(() => {}) }, [])
  useEffect(() => { if (selected) listOutboundEmails({ campaign_id: selected.id, limit: 500 }).then(setOutbound).catch(() => setOutbound([])) }, [selected])

  async function loadCampaigns() {
    setLoading(true)
    try {
      const data = await listEmailCampaigns({
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        q: q || undefined,
      })
      setRows(data || [])
    } catch (e) { console.error('Campaigns load:', e) }
    finally { setLoading(false) }
  }

  async function loadSubscribers() {
    setLoading(true)
    try { const data = await listEmailSubscribers({ q: q || undefined, limit: 500 }); setSubscribers(data || []) }
    catch (e) { console.error('Subs load:', e) }
    finally { setLoading(false) }
  }

  async function removeCampaign(id) {
    if (!confirm('Delete this campaign?')) return
    try { await deleteEmailCampaign(id); setSelected(null); loadCampaigns() } catch (e) { alert(e.message) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Campaigns</h1>
          <p className="text-sm text-gray-400 mt-1">Compose, schedule, send, and track email campaigns to subscribers, customers, segments, or custom lists.</p>
        </div>
        <button onClick={() => setComposing(true)} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">+ New Campaign</button>
      </div>

      <div className="flex border-b border-navy-700">
        <TabBtn active={tab === 'campaigns'} onClick={() => { setTab('campaigns'); setSelected(null) }}>Campaigns</TabBtn>
        <TabBtn active={tab === 'subscribers'} onClick={() => setTab('subscribers')}>Subscribers</TabBtn>
      </div>

      {tab === 'campaigns' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl bg-navy-800/50 border border-navy-700/50 overflow-hidden">
            <div className="p-3 border-b border-navy-700 flex gap-2 flex-wrap">
              <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadCampaigns()} placeholder="Search…" className="bg-navy-900 border border-navy-700 text-white text-sm rounded px-2 py-1" />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-navy-900 border border-navy-700 text-white text-sm rounded px-2 py-1">
                <option value="">All statuses</option>
                {EMAIL_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-navy-900 border border-navy-700 text-white text-sm rounded px-2 py-1">
                <option value="">All categories</option>
                {EMAIL_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            {loading ? <p className="p-4 text-gray-400 text-sm">Loading…</p> :
             rows.length === 0 ? <p className="p-4 text-gray-500 text-sm">No campaigns.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-navy-900/60 text-[11px] uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3">Category</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-right py-2 px-3">Sent</th>
                    <th className="text-right py-2 px-3">Open %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} onClick={() => setSelected(r)} className={`cursor-pointer border-t border-navy-700/40 hover:bg-navy-900/40 ${selected?.id === r.id ? 'bg-navy-900/60' : ''}`}>
                      <td className="py-2 px-3 text-white">{r.name}</td>
                      <td className="py-2 px-3 text-gray-300 text-xs capitalize">{r.category?.replaceAll('_', ' ')}</td>
                      <td className="py-2 px-3 text-gray-300 capitalize">{r.status}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{formatInt(r.delivered_count || 0)}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{r.delivered_count ? formatPct((r.opened_count || 0) / r.delivered_count) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 space-y-3">
            {selected ? (() => {
              const m = emailCampaignMetrics(selected, outbound)
              return (
                <>
                  <div className="flex items-start justify-between">
                    <h3 className="text-white font-semibold">{selected.name}</h3>
                    <button onClick={() => removeCampaign(selected.id)} className="text-rose-400 hover:underline text-xs">Del</button>
                  </div>
                  <p className="text-xs text-gray-400 capitalize">{selected.category?.replaceAll('_', ' ')} · {selected.status}</p>
                  <div className="text-sm text-gray-300">
                    <p className="text-xs text-gray-400">Subject</p>
                    <p className="text-white">{selected.subject || '—'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Stat label="Queued" value={formatInt(m.queued)} />
                    <Stat label="Sent" value={formatInt(m.sent)} />
                    <Stat label="Delivered" value={formatInt(m.delivered)} />
                    <Stat label="Failed" value={formatInt(m.failed)} />
                    <Stat label="Open rate" value={formatPct(m.openRate)} />
                    <Stat label="Click rate" value={formatPct(m.clickRate)} />
                  </div>
                  <button onClick={async () => {
                    if (!confirm(`Send "${selected.name}" now?`)) return
                    try { await sendEmailCampaign(selected.id, {}); alert('Send queued'); loadCampaigns() } catch (e) { alert(e.message) }
                  }} className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold">Send Now</button>
                </>
              )
            })() : <p className="text-gray-500 text-sm">Select a campaign to see details.</p>}
          </div>
        </div>
      ) : (
        <SubscribersTab subscribers={subscribers} q={q} setQ={setQ} reload={loadSubscribers} loading={loading} />
      )}

      {composing && (
        <ComposerModal segments={segments} onClose={() => setComposing(false)} onSaved={() => { setComposing(false); loadCampaigns() }} />
      )}
    </div>
  )
}

function ComposerModal({ segments, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm)
  const [audCount, setAudCount] = useState(null)
  const [testEmail, setTestEmail] = useState('')

  async function refreshAud() {
    try {
      const payload = buildPayload(form)
      const c = await previewAudienceCount(payload)
      setAudCount(c)
    } catch { setAudCount(null) }
  }

  function buildPayload(f) {
    const audience_filter = { ...(f.audience_filter || {}) }
    if (f.audience_type === 'segment') audience_filter.segment_id = f.segment_id
    if (f.audience_type === 'custom_list') audience_filter.emails = (f.custom_emails || '').split(/[\s,;]+/).filter(Boolean)
    return { ...f, audience_filter, scheduled_at: f.scheduled_at || null }
  }

  async function save(status = 'draft') {
    if (!form.name || !form.subject) { alert('Name + subject required'); return }
    try {
      const payload = { ...buildPayload(form), status }
      await createEmailCampaign(payload)
      onSaved()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function sendTest() {
    if (!testEmail) { alert('Test email required'); return }
    const payload = buildPayload(form)
    try {
      const { data } = await createEmailCampaign({ ...payload, status: 'draft' })
      if (data?.id) await sendEmailCampaign(data.id, { testEmail })
      alert('Test sent to ' + testEmail)
    } catch (e) { alert(e.message) }
  }

  const isHtml = /<[a-z][^>]*>/i.test(form.body || '')
  const rendered = renderMergeTags(form.body || '', SAMPLE_VARS)
  const renderedSubject = renderMergeTags(form.subject || '', SAMPLE_VARS)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-navy-900 border border-navy-700 rounded-xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">New Email Campaign</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></Field>
            <Field label="Subject"><input className={inputCls} value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Hi {{first_name}}, …" /></Field>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 uppercase">Body (HTML or plain)</span>
                <div className="flex gap-1">
                  {EMAIL_MERGE_TAGS.map(t => (
                    <button key={t.tag} onClick={() => setForm({...form, body: (form.body || '') + t.tag})} className="text-[10px] bg-navy-800 border border-navy-700 text-sky-300 px-1.5 py-0.5 rounded">{t.tag}</button>
                  ))}
                </div>
              </div>
              <textarea className={inputCls + ' h-64 font-mono text-xs'} value={form.body} onChange={e => setForm({...form, body: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className={inputCls} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {EMAIL_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Audience">
                <select className={inputCls} value={form.audience_type} onChange={e => { setForm({...form, audience_type: e.target.value}); setAudCount(null) }}>
                  {AUDIENCE_TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
                </select>
              </Field>
              {form.audience_type === 'segment' && (
                <Field label="Segment">
                  <select className={inputCls} value={form.segment_id} onChange={e => setForm({...form, segment_id: e.target.value})}>
                    <option value="">— pick a segment —</option>
                    {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.member_count || 0})</option>)}
                  </select>
                </Field>
              )}
              {form.audience_type === 'custom_list' && (
                <Field label="Emails (comma-separated)">
                  <textarea className={inputCls + ' h-20 text-xs'} value={form.custom_emails} onChange={e => setForm({...form, custom_emails: e.target.value})} />
                </Field>
              )}
              <Field label="Schedule (optional)">
                <input type="datetime-local" className={inputCls} value={form.scheduled_at} onChange={e => setForm({...form, scheduled_at: e.target.value})} />
              </Field>
            </div>
            <button onClick={refreshAud} className="text-xs text-sky-400 hover:underline">Preview audience count</button>
            {audCount != null && <p className="text-xs text-emerald-300">{formatInt(audCount)} recipients</p>}
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-navy-700 bg-navy-950/50 overflow-hidden">
              <div className="bg-navy-900 px-3 py-2 border-b border-navy-700 text-xs">
                <p className="text-gray-400">Subject:</p>
                <p className="text-white font-medium">{renderedSubject || '—'}</p>
              </div>
              <div className="p-3 text-sm text-gray-200 max-h-[420px] overflow-y-auto">
                {isHtml ? (
                  <div className="bg-white text-slate-900 rounded p-3" dangerouslySetInnerHTML={{ __html: rendered }} />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm">{rendered || '(empty)'}</pre>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <Field label="Send test to">
                <input type="email" className={inputCls} value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
              <button onClick={sendTest} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-semibold whitespace-nowrap">Send Test</button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 border-t border-navy-700 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
          <button onClick={() => save('draft')} className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-md text-sm font-semibold">Save Draft</button>
          {form.scheduled_at && <button onClick={() => save('scheduled')} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">Schedule</button>}
          <button onClick={() => save('sending')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-semibold">Send Now</button>
        </div>
      </div>
    </div>
  )
}

function SubscribersTab({ subscribers, q, setQ, reload, loading }) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')

  async function add() {
    if (!email) return
    try { await createEmailSubscriber({ email, first_name: firstName }); setEmail(''); setFirstName(''); reload() }
    catch (e) { alert(e.message) }
  }

  async function toggle(id, cur) {
    try { await toggleSubscriberActive(id, !cur); reload() } catch (e) { alert(e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete subscriber?')) return
    try { await deleteEmailSubscriber(id); reload() } catch (e) { alert(e.message) }
  }

  const active = subscribers.filter(s => s.is_active !== false).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Total" value={formatInt(subscribers.length)} />
        <Kpi label="Active" value={formatInt(active)} tone="emerald" />
        <Kpi label="Inactive" value={formatInt(subscribers.length - active)} tone="rose" />
      </div>

      <div className="flex gap-2 flex-wrap">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="bg-navy-900 border border-navy-700 text-white text-sm rounded px-2 py-1" />
        <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className="bg-navy-900 border border-navy-700 text-white text-sm rounded px-2 py-1" />
        <button onClick={add} className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm">+ Add</button>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && reload()} placeholder="Search…" className="bg-navy-900 border border-navy-700 text-white text-sm rounded px-2 py-1 ml-auto" />
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 overflow-hidden">
        {loading ? <p className="p-4 text-gray-400 text-sm">Loading…</p> :
         subscribers.length === 0 ? <p className="p-4 text-gray-500 text-sm">No subscribers.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-navy-900/60 text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left py-2 px-3">Email</th>
                <th className="text-left py-2 px-3">First Name</th>
                <th className="text-left py-2 px-3">Source</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map(s => (
                <tr key={s.id} className="border-t border-navy-700/40">
                  <td className="py-2 px-3 text-white">{s.email}</td>
                  <td className="py-2 px-3 text-gray-300">{s.first_name || '—'}</td>
                  <td className="py-2 px-3 text-gray-400 text-xs">{s.source || '—'}</td>
                  <td className="py-2 px-3">{s.is_active !== false ? <span className="text-emerald-300 text-xs">Active</span> : <span className="text-rose-300 text-xs">Inactive</span>}</td>
                  <td className="py-2 px-3 text-right text-xs whitespace-nowrap">
                    <button onClick={() => toggle(s.id, s.is_active !== false)} className="text-sky-400 hover:underline mr-3">{s.is_active !== false ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => remove(s.id)} className="text-rose-400 hover:underline">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2'

function TabBtn({ active, onClick, children }) {
  return <button onClick={onClick} className={`px-4 py-2 text-sm font-semibold border-b-2 ${active ? 'border-sky-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>{children}</button>
}
function Field({ label, children }) {
  return <label className="block"><span className="text-xs text-gray-400 block mb-1">{label}</span>{children}</label>
}
function Kpi({ label, value, tone = 'slate' }) {
  const tones = { slate: 'text-white', emerald: 'text-emerald-300', rose: 'text-rose-300' }
  return (
    <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${tones[tone] || tones.slate}`}>{value}</p>
    </div>
  )
}
function Stat({ label, value }) {
  return (
    <div className="bg-navy-900/40 rounded p-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
