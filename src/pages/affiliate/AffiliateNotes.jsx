import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

export default function AffiliateNotes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState({ title: '', body: '' })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('admin_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      setNotes(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load notes') }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function addNote(e) {
    e.preventDefault()
    if (!form.body.trim()) return
    try {
      const { error } = await supabase.from('admin_notes').insert({
        user_id: user.id,
        title: form.title.trim() || null,
        body: form.body.trim(),
      })
      if (error) throw error
      setForm({ title: '', body: '' })
      load()
    } catch (err) { console.error(err); toast.error('Save failed') }
  }

  async function togglePin(n) {
    try { await supabase.from('admin_notes').update({ pinned: !n.pinned }).eq('id', n.id); load() }
    catch { toast.error('Update failed') }
  }

  async function del(id) {
    if (!window.confirm('Delete this note?')) return
    try { await supabase.from('admin_notes').delete().eq('id', id); load() }
    catch { toast.error('Delete failed') }
  }

  const filtered = notes.filter((n) => !search
    || (n.body || '').toLowerCase().includes(search.toLowerCase())
    || (n.title || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">📝 Notes</h1>
        <p className="text-sm text-gray-400">Capture ideas, quotes, and things to remember.</p>
      </div>

      <form onSubmit={addNote} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 space-y-2">
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Title (optional)"
          className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white"
        />
        <textarea
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          placeholder="Quick note…"
          rows={3}
          className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white"
        />
        <div className="flex justify-end">
          <button type="submit" disabled={!form.body.trim()} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            Save note
          </button>
        </div>
      </form>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search notes…"
        className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white"
      />

      <div className="space-y-2">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-8 italic">
            {notes.length === 0 ? 'No notes yet. Write your first one above.' : 'No matches.'}
          </div>
        ) : (
          filtered.map((n) => (
            <div key={n.id} className={`rounded-xl p-4 border ${n.pinned ? 'bg-amber-500/5 border-amber-500/30' : 'bg-navy-800/50 border-navy-700/50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {n.title && <div className="text-sm font-semibold text-white mb-1">{n.title}</div>}
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.body}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => togglePin(n)} className="text-xs text-gray-500 hover:text-amber-400" title={n.pinned ? 'Unpin' : 'Pin'}>📌</button>
                  <button onClick={() => del(n.id)} className="text-xs text-gray-500 hover:text-rose-400">🗑️</button>
                </div>
              </div>
              <div className="text-[10px] text-gray-500 mt-2">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
