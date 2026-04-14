import { useEffect, useMemo, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  PLATFORMS,
  extractPlaceholders,
  fillTemplate,
} from '../../lib/creatorTemplates'

const STATUS_COLORS = {
  draft: 'bg-slate-500/15 text-slate-300',
  ready: 'bg-emerald-500/15 text-emerald-300',
  scheduled: 'bg-sky-500/15 text-sky-300',
  published: 'bg-violet-500/15 text-violet-300',
  archived: 'bg-zinc-500/15 text-zinc-500',
}

export default function AffiliateContent() {
  const { user } = useAuth()
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)

  // Template browser state
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [placeholderValues, setPlaceholderValues] = useState({})

  // Workspace state
  const [draftId, setDraftId] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [contentType, setContentType] = useState('caption')
  const [status, setStatus] = useState('draft')
  const [templateKey, setTemplateKey] = useState(null)
  const [saving, setSaving] = useState(false)

  // Filters
  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (platformFilter !== 'all' && t.platform !== platformFilter && t.platform !== 'any') return false
      return true
    })
  }, [categoryFilter, platformFilter])

  // Load drafts
  const loadDrafts = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('creator_drafts')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'archived')
        .order('updated_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setDrafts(data || [])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadDrafts() }, [loadDrafts])

  // Character limit awareness
  const platformMeta = PLATFORMS.find((p) => p.key === platform)
  const charLimit = platformMeta?.char_limit ?? null
  const charCount = body.length
  const overLimit = charLimit !== null && charCount > charLimit

  // Actions
  function loadTemplate(tpl) {
    setActiveTemplate(tpl)
    setPlaceholderValues({})
    setContentType(tpl.category)
    if (tpl.platform !== 'any' && PLATFORMS.find((p) => p.key === tpl.platform)) {
      setPlatform(tpl.platform)
    }
  }

  function applyTemplate() {
    if (!activeTemplate) return
    const filled = fillTemplate(activeTemplate.body, placeholderValues)
    setBody(filled)
    setTemplateKey(activeTemplate.key)
    if (!title) setTitle(activeTemplate.name)
    toast.success('Template loaded into editor')
  }

  function newDraft() {
    setDraftId(null)
    setTitle('')
    setBody('')
    setTemplateKey(null)
    setStatus('draft')
    setActiveTemplate(null)
    setPlaceholderValues({})
  }

  function loadDraft(d) {
    setDraftId(d.id)
    setTitle(d.title || '')
    setBody(d.body || '')
    setPlatform(d.platform || 'instagram')
    setContentType(d.content_type || 'caption')
    setStatus(d.status || 'draft')
    setTemplateKey(d.template_key || null)
    setActiveTemplate(null)
    setPlaceholderValues({})
  }

  async function saveDraft() {
    if (!body.trim()) {
      toast.error('Nothing to save — write something first')
      return
    }
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        title: title.trim() || null,
        body,
        platform,
        content_type: contentType,
        status,
        template_key: templateKey,
        character_count: charCount,
        updated_at: new Date().toISOString(),
      }
      if (draftId) {
        const { error } = await supabase.from('creator_drafts').update(payload).eq('id', draftId)
        if (error) throw error
        toast.success('Draft updated')
      } else {
        const { data, error } = await supabase.from('creator_drafts').insert(payload).select().single()
        if (error) throw error
        setDraftId(data.id)
        toast.success('Draft saved')
      }
      loadDrafts()
    } catch (e) {
      console.error(e)
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteDraft(id) {
    if (!window.confirm('Delete this draft?')) return
    try {
      const { error } = await supabase.from('creator_drafts').delete().eq('id', id)
      if (error) throw error
      if (id === draftId) newDraft()
      toast.success('Draft deleted')
      loadDrafts()
    } catch (e) {
      console.error(e)
      toast.error('Delete failed')
    }
  }

  async function copyToClipboard() {
    if (!body.trim()) return
    try {
      await navigator.clipboard.writeText(body)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Copy failed')
    }
  }

  function sendToScheduler() {
    toast.info('Scheduler — coming soon. Copy to clipboard for now.')
  }

  const activePlaceholders = activeTemplate ? extractPlaceholders(activeTemplate.body) : []

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>✍️</span>
            <span>Content Creator</span>
          </h1>
          <p className="text-sm text-gray-400">Templates, hooks, scripts — pick a format, fill in the blanks, ship it.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={newDraft} className="px-3 py-2 bg-navy-800 hover:bg-navy-700 text-white rounded-lg text-sm font-medium border border-navy-700/50">
            + New draft
          </button>
          <button onClick={saveDraft} disabled={saving} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
            {saving ? 'Saving…' : (draftId ? 'Update draft' : 'Save draft')}
          </button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-4">

        {/* LEFT — Template library */}
        <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-3 space-y-3 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-1.5">Category</div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`text-[11px] px-2 py-1 rounded-md border ${categoryFilter === 'all' ? 'bg-pink-500 border-pink-500 text-white' : 'bg-navy-900 border-navy-700/50 text-gray-400 hover:text-white'}`}
              >All</button>
              {TEMPLATE_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategoryFilter(c.key)}
                  className={`text-[11px] px-2 py-1 rounded-md border ${categoryFilter === c.key ? 'bg-pink-500 border-pink-500 text-white' : 'bg-navy-900 border-navy-700/50 text-gray-400 hover:text-white'}`}
                >{c.icon} {c.label}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-1.5">Platform</div>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-1.5 text-xs text-white"
            >
              <option value="all">All platforms</option>
              {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          <div className="pt-1 border-t border-navy-700/50">
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-2">
              Templates ({filteredTemplates.length})
            </div>
            <div className="space-y-1.5">
              {filteredTemplates.length === 0 ? (
                <div className="text-xs text-gray-500 italic py-4 text-center">No templates match those filters.</div>
              ) : filteredTemplates.map((t) => {
                const isActive = activeTemplate?.key === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => loadTemplate(t)}
                    className={`w-full text-left rounded-lg border p-2.5 transition ${isActive ? 'bg-pink-500/15 border-pink-500/50' : 'bg-navy-900 border-navy-700/50 hover:border-pink-500/30'}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="text-xs font-semibold text-white truncate">{t.name}</div>
                      <span className="text-[9px] text-gray-500 uppercase flex-shrink-0">{t.platform}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 line-clamp-2">{t.hint}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* CENTER — Workspace */}
        <div className="space-y-3">
          {/* Template fill-in panel */}
          {activeTemplate && (
            <div className="bg-pink-500/5 border border-pink-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{activeTemplate.name}</div>
                  <div className="text-xs text-gray-400">{activeTemplate.hint}</div>
                </div>
                <button onClick={() => setActiveTemplate(null)} className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0">✕</button>
              </div>

              {activePlaceholders.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activePlaceholders.map((key) => (
                    <label key={key} className="block">
                      <span className="text-[10px] uppercase text-gray-500">{key.replace(/_/g, ' ')}</span>
                      <input
                        type="text"
                        value={placeholderValues[key] || ''}
                        onChange={(e) => setPlaceholderValues((v) => ({ ...v, [key]: e.target.value }))}
                        placeholder={`{{${key}}}`}
                        className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-1.5 text-xs text-white"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button onClick={applyTemplate} className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-md text-xs font-medium">
                  Load into editor
                </button>
                <span className="text-[10px] text-gray-500">
                  Unfilled placeholders stay visible as <code>{'{{key}}'}</code> — easy to spot and fix.
                </span>
              </div>
            </div>
          )}

          {/* Editor */}
          <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Draft title (internal — not shown on post)"
              className="w-full bg-transparent border-0 border-b border-navy-700/50 rounded-none px-0 py-2 text-base font-semibold text-white focus:outline-none focus:border-pink-500"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="bg-navy-900 border border-navy-700/50 rounded-md px-2 py-1.5 text-xs text-white"
              >
                {TEMPLATE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                <option value="note">📝 Note</option>
              </select>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="bg-navy-900 border border-navy-700/50 rounded-md px-2 py-1.5 text-xs text-white"
              >
                {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-navy-900 border border-navy-700/50 rounded-md px-2 py-1.5 text-xs text-white"
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
              <div className={`ml-auto text-[11px] font-mono ${overLimit ? 'text-rose-400' : 'text-gray-500'}`}>
                {charCount}{charLimit !== null ? ` / ${charLimit}` : ''}
              </div>
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Start writing, or pick a template from the left panel →"
              rows={16}
              className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2.5 text-sm text-white font-mono leading-relaxed focus:outline-none focus:border-pink-500 resize-y"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={copyToClipboard} disabled={!body.trim()} className="px-3 py-1.5 bg-navy-700 hover:bg-navy-600 disabled:opacity-50 text-white rounded-md text-xs font-medium">
                📋 Copy
              </button>
              <button onClick={sendToScheduler} disabled={!body.trim()} className="px-3 py-1.5 bg-navy-700 hover:bg-navy-600 disabled:opacity-50 text-white rounded-md text-xs font-medium">
                🗓 Send to Scheduler
              </button>
              {overLimit && (
                <span className="text-[11px] text-rose-400">
                  Over {platformMeta?.label} limit by {charCount - charLimit} chars
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Drafts list */}
        <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-3 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase font-bold text-gray-500">My drafts</div>
            <span className="text-[10px] text-gray-500">{drafts.length}</span>
          </div>
          {loading ? (
            <div className="text-xs text-gray-500 italic py-4 text-center">Loading…</div>
          ) : drafts.length === 0 ? (
            <div className="text-xs text-gray-500 italic py-6 text-center">
              No drafts yet. Save your first one with the pink button above.
            </div>
          ) : (
            <div className="space-y-1.5">
              {drafts.map((d) => {
                const isActive = d.id === draftId
                return (
                  <div
                    key={d.id}
                    className={`rounded-lg border p-2.5 transition group ${isActive ? 'bg-pink-500/10 border-pink-500/50' : 'bg-navy-900 border-navy-700/50 hover:border-pink-500/30'}`}
                  >
                    <button onClick={() => loadDraft(d)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <div className="text-xs font-semibold text-white truncate flex-1 min-w-0">
                          {d.title || <span className="text-gray-500 italic">Untitled</span>}
                        </div>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${STATUS_COLORS[d.status] || ''}`}>{d.status}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 line-clamp-2 mb-1">{d.body}</div>
                      <div className="flex items-center justify-between text-[9px] text-gray-500">
                        <span>{d.platform || '—'} · {d.content_type}</span>
                        <span>{new Date(d.updated_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                    <div className="mt-1.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => deleteDraft(d.id)} className="text-[10px] text-gray-500 hover:text-rose-400">Delete</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
