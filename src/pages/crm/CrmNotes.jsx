import { useEffect, useMemo, useState } from 'react'
import { HubPage, EmptyState, useCrmClient } from './_shared'

// ---------- formatters ----------
const fmtRelative = (d) => {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------- local primitives ----------
function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`bg-navy-800 border border-navy-700/60 rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40">{footer}</div>}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder, rows }) {
  const base = 'w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan'
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      {rows ? (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={base} />
      ) : (
        <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </label>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition ${
        active
          ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan'
          : 'bg-navy-900/40 border-navy-700/60 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

// ---------- color presets ----------
const COLOR_PRESETS = [
  { key: 'default', value: '', class: 'bg-navy-800' },
  { key: 'cyan', value: '#22d3ee', class: 'bg-brand-cyan' },
  { key: 'emerald', value: '#10b981', class: 'bg-emerald-400' },
  { key: 'amber', value: '#f59e0b', class: 'bg-amber-400' },
  { key: 'rose', value: '#f43f5e', class: 'bg-rose-400' },
  { key: 'violet', value: '#8b5cf6', class: 'bg-violet-400' },
]

function cardBg(color) {
  if (!color) return 'bg-navy-800 border-navy-700/50'
  return 'border-navy-700/50'
}
function cardStyle(color) {
  if (!color) return {}
  return { backgroundColor: `${color}25` }
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function CrmNotes() {
  const { client, platform } = useCrmClient()

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [limit, setLimit] = useState(200)

  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('all')
  const [pinnedOnly, setPinnedOnly] = useState(false)

  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      const { data, error } = await client
        .from('admin_notes')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      setNotes(data || [])
      setHasMore((data || []).length >= limit)
    } catch (e) {
      console.error('[CrmNotes] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, limit])

  // ---- derive tags ----
  const allTags = useMemo(() => {
    const set = new Set()
    for (const n of notes) {
      if (Array.isArray(n.tags)) {
        for (const t of n.tags) if (t) set.add(t)
      }
    }
    return Array.from(set).sort()
  }, [notes])

  // ---- filter ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notes.filter((n) => {
      if (pinnedOnly && !n.pinned) return false
      if (tagFilter !== 'all') {
        if (!Array.isArray(n.tags) || !n.tags.includes(tagFilter)) return false
      }
      if (q) {
        const blob = `${n.title || ''} ${n.body || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [notes, search, tagFilter, pinnedOnly])

  const pinned = filtered.filter((n) => n.pinned)
  const recent = filtered.filter((n) => !n.pinned)
  const showSplit = !search && tagFilter === 'all' && !pinnedOnly

  // ---- pin toggle ----
  async function togglePin(note) {
    if (!client) return
    try {
      const { error } = await client.from('admin_notes').update({ pinned: !note.pinned }).eq('id', note.id)
      if (error) throw error
      load()
    } catch (e) {
      console.error('[CrmNotes] togglePin', e)
    }
  }

  return (
    <HubPage
      title="Notes"
      subtitle={`Capture context, decisions, and ideas - searchable anywhere${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
      actions={
        <button
          onClick={() => { setEditing(null); setNewOpen(true) }}
          className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium"
        >
          + New Note
        </button>
      }
    >
      {/* search + filters */}
      <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or body..."
          className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan mb-3"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={tagFilter === 'all'} onClick={() => setTagFilter('all')}>All tags</Chip>
          {allTags.map((t) => (
            <Chip key={t} active={tagFilter === t} onClick={() => setTagFilter(t)}>{t}</Chip>
          ))}
          <label className="ml-3 flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={pinnedOnly}
              onChange={(e) => setPinnedOnly(e.target.checked)}
            />
            Pinned only
          </label>
        </div>
      </div>

      {loading ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6 text-sm text-gray-500">Loading notes...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={notes.length === 0 ? 'No notes yet' : 'No notes match'}
          description={notes.length === 0 ? 'Capture your first one - meeting takeaways, decisions, ideas.' : 'Try a different tag, clear the search, or untoggle pinned.'}
          cta={
            notes.length === 0 ? (
              <button onClick={() => { setEditing(null); setNewOpen(true) }} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
                + New Note
              </button>
            ) : null
          }
        />
      ) : showSplit ? (
        <>
          {pinned.length > 0 && (
            <div className="mb-6">
              <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                <span className="text-brand-cyan">*</span> Pinned
                <span className="text-xs text-gray-500">({pinned.length})</span>
              </h2>
              <NotesGrid notes={pinned} onCard={setEditing} onPin={togglePin} />
            </div>
          )}
          {recent.length > 0 && (
            <div>
              <h2 className="text-white font-semibold mb-3">Recent <span className="text-xs text-gray-500">({recent.length})</span></h2>
              <NotesGrid notes={recent} onCard={setEditing} onPin={togglePin} />
            </div>
          )}
        </>
      ) : (
        <NotesGrid notes={filtered} onCard={setEditing} onPin={togglePin} />
      )}

      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={() => setLimit(limit + 200)}
            className="text-sm text-brand-cyan hover:underline"
          >
            Show more
          </button>
        </div>
      )}

      <NoteModal
        open={newOpen || !!editing}
        note={editing}
        onClose={() => { setNewOpen(false); setEditing(null) }}
        client={client}
        onSaved={() => { setNewOpen(false); setEditing(null); load() }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                              NOTES GRID
// ===========================================================================
function NotesGrid({ notes, onCard, onPin }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {notes.map((n) => (
        <NoteCard key={n.id} note={n} onClick={() => onCard(n)} onPin={() => onPin(n)} />
      ))}
    </div>
  )
}

function NoteCard({ note, onClick, onPin }) {
  return (
    <div
      onClick={onClick}
      className={`border rounded-xl p-4 cursor-pointer hover:border-brand-cyan/40 transition relative ${cardBg(note.color)}`}
      style={cardStyle(note.color)}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPin() }}
        className={`absolute top-2 right-2 text-base ${note.pinned ? 'text-brand-cyan' : 'text-gray-500 hover:text-gray-300'}`}
        aria-label={note.pinned ? 'Unpin' : 'Pin'}
      >
        {note.pinned ? '*' : '+'}
      </button>
      <h3 className="text-white font-medium pr-8 line-clamp-2">{note.title || '(untitled)'}</h3>
      {note.body && (
        <p className="text-sm text-gray-300 mt-2 line-clamp-4 whitespace-pre-wrap">
          {note.body.length > 200 ? `${note.body.slice(0, 200)}...` : note.body}
        </p>
      )}
      {Array.isArray(note.tags) && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {note.tags.map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-navy-900/60 text-gray-300">
              #{t}
            </span>
          ))}
        </div>
      )}
      <div className="text-[11px] text-gray-500 mt-3">{fmtRelative(note.updated_at || note.created_at)}</div>
    </div>
  )
}

// ===========================================================================
//                              NOTE MODAL
// ===========================================================================
function NoteModal({ open, note, onClose, client, onSaved }) {
  const [form, setForm] = useState({})
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (note) {
      setForm({
        title: note.title || '',
        body: note.body || '',
        color: note.color || '',
        pinned: !!note.pinned,
      })
      setTagsInput(Array.isArray(note.tags) ? note.tags.join(', ') : '')
    } else {
      setForm({ title: '', body: '', color: '', pinned: false })
      setTagsInput('')
    }
  }, [open, note])

  async function submit() {
    if (!client) return
    if (!form.title && !form.body) { alert('Title or body required'); return }
    setSaving(true)
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      const payload = {
        title: form.title || null,
        body: form.body || null,
        tags: tags.length ? tags : null,
        color: form.color || null,
        pinned: !!form.pinned,
      }
      if (note?.id) {
        const { error } = await client.from('admin_notes').update(payload).eq('id', note.id)
        if (error) throw error
      } else {
        const { error } = await client.from('admin_notes').insert(payload)
        if (error) throw error
      }
      onSaved()
    } catch (e) {
      console.error('[NoteModal] submit', e)
      alert('Could not save note: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!client || !note?.id) return
    if (!confirm('Delete this note?')) return
    setSaving(true)
    try {
      const { error } = await client.from('admin_notes').delete().eq('id', note.id)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NoteModal] remove', e)
      alert('Could not delete: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={note ? 'Edit Note' : 'New Note'}
      wide
      footer={
        <div className="flex justify-between gap-2">
          {note ? (
            <button onClick={remove} disabled={saving} className="text-sm px-3 py-1.5 text-rose-400 hover:text-rose-300">Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
            <button onClick={submit} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      }
    >
      <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="What is this about?" />
      <Input label="Body" rows={10} value={form.body} onChange={(v) => setForm({ ...form, body: v })} placeholder="The details..." />
      <Input label="Tags (comma-separated)" value={tagsInput} onChange={setTagsInput} placeholder="meeting, decision, idea" />

      <div className="mb-3">
        <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Color</span>
        <div className="flex gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.key}
              onClick={() => setForm({ ...form, color: c.value })}
              className={`w-7 h-7 rounded-full border-2 ${form.color === c.value ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c.value || '#1e293b' }}
              aria-label={c.key}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 mt-3 text-sm text-gray-300">
        <input type="checkbox" checked={!!form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
        Pin to top
      </label>
    </Modal>
  )
}
