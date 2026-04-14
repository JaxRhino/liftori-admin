import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../../lib/AuthContext'
import { isFounder } from '../../lib/testerProgramService'
import { TEMPLATE_CATEGORIES, listTemplates, createTemplate, updateTemplate, deleteTemplate } from '../../lib/campaignsService'

function emptyTemplate() {
  return {
    name: '', category: 'platform_announcement', channel: 'email',
    subject: '', body_html: '', body_preview: '', description: '',
    tags: [],
  }
}

export default function Templates() {
  const { user, profile } = useAuth()
  const allowed = isFounder({ email: user?.email, personal_email: profile?.personal_email })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyTemplate())
  const [filterGroup, setFilterGroup] = useState('all')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try { setRows(await listTemplates()) }
    catch (e) { console.error(e); toast.error('Failed to load templates') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (allowed) load() }, [allowed])

  const visible = useMemo(() => {
    if (filterGroup === 'all') return rows
    return rows.filter((r) => {
      const cat = TEMPLATE_CATEGORIES.find((c) => c.key === r.category)
      return cat?.group === filterGroup
    })
  }, [rows, filterGroup])

  function openNew() { setEditingId(null); setForm(emptyTemplate()); setShowEditor(true) }
  function openEdit(t) {
    setEditingId(t.id)
    setForm({
      name: t.name, category: t.category, channel: t.channel,
      subject: t.subject, body_html: t.body_html,
      body_preview: t.body_preview || '', description: t.description || '',
      tags: t.tags || [],
    })
    setShowEditor(true)
  }

  async function save() {
    if (!form.name.trim() || !form.subject.trim() || !form.body_html.trim()) {
      toast.error('Name, subject, and body are required'); return
    }
    setBusy(true)
    try {
      if (editingId) {
        await updateTemplate(editingId, form)
        toast.success('Template updated')
      } else {
        await createTemplate({ ...form, created_by: user.id, system_template: false })
        toast.success('Template saved')
      }
      setShowEditor(false); setEditingId(null); setForm(emptyTemplate()); load()
    } catch (e) { console.error(e); toast.error('Save failed') }
    finally { setBusy(false) }
  }

  async function del(id, isSystem) {
    if (isSystem && !window.confirm('This is a system template — are you sure you want to delete it? You can always restore it from the seeded set.')) return
    if (!isSystem && !window.confirm('Delete this template?')) return
    try { await deleteTemplate(id); toast.success('Deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  if (!allowed) return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500">Founder access required.</div>

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><span>📄</span><span>Templates</span></h1>
          <p className="text-sm text-gray-400">Reusable message templates for HR + Platform broadcasts. System templates come pre-loaded, your custom ones live alongside.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded-md px-2 py-1.5 text-xs text-white">
            <option value="all">All groups</option>
            <option value="HR">HR</option>
            <option value="Platform">Platform</option>
            <option value="General">General</option>
          </select>
          <button onClick={openNew} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">+ New template</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center text-gray-500 py-20 italic">No templates match that filter.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((t) => {
            const cat = TEMPLATE_CATEGORIES.find((c) => c.key === t.category)
            return (
              <div key={t.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-lg">{cat?.icon || '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{t.name}</span>
                      {t.system_template && <span className="text-[9px] uppercase text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded">System</span>}
                    </div>
                    <div className="text-[10px] text-gray-500">{cat?.label || t.category} · {t.channel}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-300 mb-1 truncate"><span className="text-gray-500">Subject:</span> {t.subject}</div>
                {t.description && <div className="text-[11px] text-gray-500 italic mb-2">{t.description}</div>}
                <div className="flex items-center gap-1.5 pt-1 border-t border-navy-700/30">
                  <button onClick={() => openEdit(t)} className="text-[10px] px-2 py-0.5 bg-navy-700 hover:bg-navy-600 text-white rounded">Edit</button>
                  <button onClick={() => del(t.id, t.system_template)} className="text-[10px] ml-auto text-gray-500 hover:text-rose-400">Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-navy-900 border border-navy-700/50 rounded-xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700/50">
              <h2 className="text-lg font-bold text-white">{editingId ? 'Edit template' : 'New template'}</h2>
              <button onClick={() => { setShowEditor(false); setEditingId(null) }} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Template name</div>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder='e.g. "Q1 all-hands invite"'
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
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
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Subject</div>
                <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Body (HTML)</div>
                <textarea value={form.body_html} onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))} rows={10} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-xs text-white font-mono" />
              </div>
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Description (shown in picker)</div>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-xs text-white" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-navy-700/50">
                <button onClick={() => setShowEditor(false)} disabled={busy} className="px-3 py-2 bg-navy-800 hover:bg-navy-700 text-gray-300 rounded-md text-xs font-medium">Cancel</button>
                <button onClick={save} disabled={busy} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-md text-sm font-medium">{busy ? 'Saving…' : 'Save template'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
