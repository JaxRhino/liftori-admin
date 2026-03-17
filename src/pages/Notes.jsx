import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const COLORS = [
  { value: 'default', label: 'Default', bg: 'bg-[#0D1424]',       border: 'border-white/10',        text: 'text-white' },
  { value: 'blue',    label: 'Blue',    bg: 'bg-blue-900/20',      border: 'border-blue-500/30',     text: 'text-white' },
  { value: 'green',   label: 'Green',   bg: 'bg-emerald-900/20',   border: 'border-emerald-500/30',  text: 'text-white' },
  { value: 'amber',   label: 'Amber',   bg: 'bg-amber-900/20',     border: 'border-amber-500/30',    text: 'text-white' },
  { value: 'red',     label: 'Red',     bg: 'bg-red-900/20',       border: 'border-red-500/30',      text: 'text-white' },
  { value: 'violet',  label: 'Violet',  bg: 'bg-violet-900/20',    border: 'border-violet-500/30',   text: 'text-white' },
]

const COLOR_DOTS = {
  default: 'bg-slate-400',
  blue:    'bg-blue-400',
  green:   'bg-emerald-400',
  amber:   'bg-amber-400',
  red:     'bg-red-400',
  violet:  'bg-violet-400',
}

const INPUT = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500'

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function NoteCard({ note, onEdit, onDelete, onPin, onToggleColor }) {
  const col = COLORS.find(c => c.value === (note.color || 'default')) || COLORS[0]
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className={`${col.bg} ${col.border} border rounded-xl p-4 flex flex-col gap-2 group relative transition-all hover:shadow-lg`}>
      {note.pinned && (
        <div className="absolute top-3 right-3 text-amber-400" title="Pinned">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 2l-1.5 4.5L17 8l-4 4-4.5-1.5L7 12l5 5-5 5h2l4-4 5 5 1-1.5-1.5-4.5L18 15l-1.5-1.5L20 9l-1.5-2.5z" />
          </svg>
        </div>
      )}
      <div className="flex items-start justify-between gap-2 pr-5">
        <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 flex-1">
          {note.title || 'Untitled'}
        </h3>
      </div>
      {note.body && (
        <p className="text-xs text-slate-400 line-clamp-5 leading-relaxed whitespace-pre-wrap">
          {note.body}
        </p>
      )}
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {note.tags.map(tag => (
            <span key={tag} className="text-xs bg-white/5 border border-white/10 text-slate-400 px-1.5 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onPin(note)}
            className={`p-1 rounded transition-colors ${note.pinned ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-white'}`}
            title={note.pinned ? 'Unpin' : 'Pin'}>
            <svg className="w-3.5 h-3.5" fill={note.pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)}
              className="p-1 rounded text-slate-500 hover:text-white transition-colors" title="Color">
              <div className={`w-3 h-3 rounded-full ${COLOR_DOTS[note.color || 'default']}`} />
            </button>
            {menuOpen && (
              <div className="absolute bottom-7 right-0 bg-[#0D1424] border border-white/10 rounded-lg p-2 flex gap-1.5 shadow-xl z-10">
                {COLORS.map(c => (
                  <button key={c.value} onClick={() => { onToggleColor(note, c.value); setMenuOpen(false) }}
                    title={c.label}
                    className={`w-4 h-4 rounded-full ${COLOR_DOTS[c.value]} transition-transform hover:scale-110 ${note.color === c.value ? 'ring-2 ring-white/40' : ''}`} />
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onEdit(note)}
            className="p-1 rounded text-slate-500 hover:text-white transition-colors" title="Edit">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
          <button onClick={() => onDelete(note.id)}
            className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors" title="Delete">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
      </div>
    </div>
  )
}

function NoteModal({ note, onClose, onSave }) {
  const [form, setForm] = useState({
    title: note?.title || '',
    body: note?.body || '',
    tags: note?.tags?.join(', ') || '',
    color: note?.color || 'default',
    pinned: note?.pinned || false,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.title.trim() && !form.body.trim()) return
    setSaving(true)
    const tags = form.tags
      .split(',')
      .map(t => t.trim().toLowerCase().replace(/^#/, ''))
      .filter(Boolean)
    await onSave({
      title: form.title.trim() || 'Untitled',
      body: form.body.trim() || null,
      tags,
      color: form.color,
      pinned: form.pinned,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0D1424] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <h2 className="text-white font-semibold">{note ? 'Edit Note' : 'New Note'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Note title" className={INPUT} autoFocus />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Write your note..." rows={8}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y" />
          <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            placeholder="Tags (comma-separated, e.g. idea, client, launch)" className={INPUT} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Color:</span>
              <div className="flex gap-1.5">
                {COLORS.map(c => (
                  <button key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    title={c.label}
                    className={`w-5 h-5 rounded-full ${COLOR_DOTS[c.value]} transition-transform hover:scale-110 ${form.color === c.value ? 'ring-2 ring-white/50 scale-110' : ''}`} />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                className="w-4 h-4 rounded accent-amber-400" />
              <span className="text-xs text-slate-400">Pin note</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={handleSave} disabled={(!form.title.trim() && !form.body.trim()) || saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? 'Saving...' : note ? 'Save Changes' : 'Add Note'}
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 text-sm transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterColor, setFilterColor] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => { fetchNotes() }, [])

  async function fetchNotes() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('admin_notes')
        .select('*')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
      if (error) throw error
      setNotes(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function saveNote(payload) {
    try {
      if (editing) {
        const { error } = await supabase
          .from('admin_notes')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('admin_notes').insert([payload])
        if (error) throw error
      }
      await fetchNotes()
      setShowModal(false)
      setEditing(null)
    } catch (err) { console.error(err) }
  }

  async function deleteNote(id) {
    if (!confirm('Delete this note?')) return
    await supabase.from('admin_notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function pinNote(note) {
    const pinned = !note.pinned
    await supabase.from('admin_notes').update({ pinned, updated_at: new Date().toISOString() }).eq('id', note.id)
    await fetchNotes()
  }

  async function changeColor(note, color) {
    await supabase.from('admin_notes').update({ color, updated_at: new Date().toISOString() }).eq('id', note.id)
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, color } : n))
  }

  function openEdit(note) {
    setEditing(note)
    setShowModal(true)
  }

  function openCreate() {
    setEditing(null)
    setShowModal(true)
  }

  // Collect all tags
  const allTags = [...new Set(notes.flatMap(n => n.tags || []))].sort()

  const filtered = notes.filter(n => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) &&
        !(n.body || '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterTag && !(n.tags || []).includes(filterTag)) return false
    if (filterColor !== 'all' && (n.color || 'default') !== filterColor) return false
    return true
  })

  const pinned = filtered.filter(n => n.pinned)
  const unpinned = filtered.filter(n => !n.pinned)

  const counts = {
    total: notes.length,
    pinned: notes.filter(n => n.pinned).length,
    tagged: notes.filter(n => (n.tags || []).length > 0).length,
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Notes</h1>
          <p className="text-slate-400 text-sm mt-0.5">Capture ideas, plans, and references</p>
        </div>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
          + New Note
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Notes', value: counts.total, color: 'text-white' },
          { label: 'Pinned', value: counts.pinned, color: 'text-amber-400' },
          { label: 'Tagged', value: counts.tagged, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#0D1424] border border-white/10 rounded-xl p-4">
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search notes..."
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-56" />
        {allTags.length > 0 && (
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
            className="bg-[#0D1424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="">All Tags</option>
            {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
          <button onClick={() => setFilterColor('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterColor === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            All Colors
          </button>
          {COLORS.filter(c => c.value !== 'default').map(c => (
            <button key={c.value} onClick={() => setFilterColor(c.value)}
              className={`px-2 py-1.5 rounded-md transition-colors ${filterColor === c.value ? 'bg-white/10' : 'hover:bg-white/5'}`}
              title={c.label}>
              <div className={`w-3 h-3 rounded-full ${COLOR_DOTS[c.value]}`} />
            </button>
          ))}
        </div>
        <span className="text-slate-500 text-xs ml-auto">{filtered.length} note{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Notes grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading notes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          {search || filterTag || filterColor !== 'all'
            ? 'No notes match your filters.'
            : 'No notes yet — click New Note to get started.'}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pinned</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {pinned.map(note => (
                  <NoteCard key={note.id} note={note}
                    onEdit={openEdit} onDelete={deleteNote} onPin={pinNote} onToggleColor={changeColor} />
                ))}
              </div>
            </div>
          )}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Other Notes</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {unpinned.map(note => (
                  <NoteCard key={note.id} note={note}
                    onEdit={openEdit} onDelete={deleteNote} onPin={pinNote} onToggleColor={changeColor} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <NoteModal
          note={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={saveNote}
        />
      )}
    </div>
  )
}
