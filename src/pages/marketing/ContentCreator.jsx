import { useEffect, useState } from 'react'
import {
  listContentDrafts, createContentDraft, updateContentDraft, deleteContentDraft,
  CONTENT_PLATFORMS, CONTENT_STATUSES, formatInt,
} from '../../lib/marketingService'

const emptyForm = {
  title: '', body: '', platform: 'blog', status: 'draft',
  scheduled_at: '', author: '', tags: '', cta_url: '',
}

export default function ContentCreator() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [filterStatus, filterPlatform])

  async function load() {
    setLoading(true)
    try {
      const data = await listContentDrafts({
        status: filterStatus || undefined,
        platform: filterPlatform || undefined,
        q: q || undefined,
      })
      setRows(data || [])
    } catch (e) { console.error('Content load:', e) }
    finally { setLoading(false) }
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      title: r.title || '', body: r.body || '', platform: r.platform || 'blog',
      status: r.status || 'draft', scheduled_at: r.scheduled_at ? r.scheduled_at.slice(0, 16) : '',
      author: r.author || '', tags: (r.tags || []).join(', '), cta_url: r.cta_url || '',
    })
  }
  function newDraft() { setEditing('new'); setForm(emptyForm) }
  function cancel() { setEditing(null); setForm(emptyForm) }

  async function save() {
    if (!form.title) { alert('Title required'); return }
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        scheduled_at: form.scheduled_at || null,
      }
      if (editing === 'new') await createContentDraft(payload)
      else await updateContentDraft(editing, payload)
      cancel(); load()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this draft?')) return
    try { await deleteContentDraft(id); load() } catch (e) { alert(e.message) }
  }

  async function publish(id) {
    try { await updateContentDraft(id, { status: 'published', published_at: new Date().toISOString() }); load() }
    catch (e) { alert(e.message) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Creator</h1>
          <p className="text-sm text-gray-400 mt-1">Draft, schedule, and publish content across every platform — blog, LinkedIn, Twitter, email, landing pages.</p>
        </div>
        <button onClick={newDraft} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">+ New Draft</button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Search title or body…" className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2 w-64" />
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2">
          <option value="">All platforms</option>
          {CONTENT_PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2">
          <option value="">All statuses</option>
          {CONTENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading ? <p className="text-gray-400 text-sm col-span-2">Loading…</p> :
         rows.length === 0 ? <p className="text-gray-500 text-sm col-span-2">No drafts yet.</p> :
         rows.map(r => (
          <div key={r.id} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-white font-semibold">{r.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{r.platform} · {r.status}</p>
              </div>
              <div className="flex gap-2 text-xs">
                {r.status !== 'published' && <button onClick={() => publish(r.id)} className="text-emerald-400 hover:underline">Publish</button>}
                <button onClick={() => openEdit(r)} className="text-sky-400 hover:underline">Edit</button>
                <button onClick={() => remove(r.id)} className="text-rose-400 hover:underline">Del</button>
              </div>
            </div>
            <p className="text-sm text-gray-300 line-clamp-3">{r.body || '—'}</p>
            {r.scheduled_at && <p className="text-xs text-amber-300 mt-2">Scheduled: {new Date(r.scheduled_at).toLocaleString()}</p>}
            {r.tags && r.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {r.tags.map(t => <span key={t} className="text-[10px] bg-navy-900/60 text-gray-300 px-1.5 py-0.5 rounded">#{t}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl max-w-2xl w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">{editing === 'new' ? 'New Draft' : 'Edit Draft'}</h2>
            <Field label="Title"><input className={inputCls} value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Platform">
                <select className={inputCls} value={form.platform} onChange={e => setForm({...form, platform: e.target.value})}>
                  {CONTENT_PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  {CONTENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Author"><input className={inputCls} value={form.author} onChange={e => setForm({...form, author: e.target.value})} /></Field>
              <Field label="Scheduled At"><input type="datetime-local" className={inputCls} value={form.scheduled_at} onChange={e => setForm({...form, scheduled_at: e.target.value})} /></Field>
            </div>
            <Field label="Body"><textarea className={inputCls + ' h-40'} value={form.body} onChange={e => setForm({...form, body: e.target.value})} /></Field>
            <Field label="Tags (comma-separated)"><input className={inputCls} value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} /></Field>
            <Field label="CTA URL"><input className={inputCls} value={form.cta_url} onChange={e => setForm({...form, cta_url: e.target.value})} /></Field>
            <div className="flex justify-end gap-2">
              <button onClick={cancel} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={save} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2'

function Field({ label, children }) {
  return <label className="block"><span className="text-xs text-gray-400 block mb-1">{label}</span>{children}</label>
}
