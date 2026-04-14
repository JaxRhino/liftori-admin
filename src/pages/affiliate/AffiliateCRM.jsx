import { useEffect, useMemo, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const RELATIONSHIPS = [
  { key: 'fan',        label: 'Fan',        color: 'bg-sky-500/15 text-sky-300'         },
  { key: 'superfan',   label: 'Superfan',   color: 'bg-pink-500/15 text-pink-300'       },
  { key: 'customer',   label: 'Customer',   color: 'bg-emerald-500/15 text-emerald-300' },
  { key: 'newsletter', label: 'Newsletter', color: 'bg-violet-500/15 text-violet-300'   },
  { key: 'collab',     label: 'Collab',     color: 'bg-amber-500/15 text-amber-300'     },
  { key: 'manager',    label: 'Manager',    color: 'bg-indigo-500/15 text-indigo-300'   },
  { key: 'agent',      label: 'Agent',      color: 'bg-rose-500/15 text-rose-300'       },
  { key: 'other',      label: 'Other',      color: 'bg-slate-500/15 text-slate-300'     },
]

export default function AffiliateCRM() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRel, setFilterRel] = useState('all')
  const [form, setForm] = useState(emptyForm())

  function emptyForm() {
    return { name: '', email: '', handle: '', platform: '', relationship: 'fan', follower_count: '', notes: '' }
  }

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('creator_contacts').select('*').eq('user_id', user.id)
        .order('updated_at', { ascending: false }).limit(500)
      if (error) throw error
      setRows(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load CRM') }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      email: form.email.trim() || null,
      handle: form.handle.trim() || null,
      platform: form.platform.trim() || null,
      relationship: form.relationship,
      follower_count: form.follower_count ? parseInt(form.follower_count, 10) : null,
      notes: form.notes.trim() || null,
    }
    try {
      if (editId) {
        const { error } = await supabase.from('creator_contacts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
        if (error) throw error
        toast.success('Contact updated')
      } else {
        const { error } = await supabase.from('creator_contacts').insert(payload)
        if (error) throw error
        toast.success('Contact added')
      }
      setForm(emptyForm())
      setEditId(null)
      setShowForm(false)
      load()
    } catch (err) { console.error(err); toast.error('Save failed') }
  }

  function startEdit(c) {
    setEditId(c.id)
    setForm({
      name: c.name || '',
      email: c.email || '',
      handle: c.handle || '',
      platform: c.platform || '',
      relationship: c.relationship || 'fan',
      follower_count: c.follower_count?.toString() || '',
      notes: c.notes || '',
    })
    setShowForm(true)
  }

  async function logInteraction(id) {
    try {
      await supabase.from('creator_contacts').update({
        last_interaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      toast.success('Interaction logged')
      load()
    } catch { toast.error('Update failed') }
  }

  async function del(id) {
    if (!window.confirm('Delete this contact?')) return
    try { await supabase.from('creator_contacts').delete().eq('id', id); toast.success('Deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filterRel !== 'all' && r.relationship !== filterRel) return false
      if (q) {
        const hay = `${r.name} ${r.email || ''} ${r.handle || ''} ${r.platform || ''} ${r.notes || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, filterRel])

  const counts = useMemo(() => {
    const m = { all: rows.length }
    RELATIONSHIPS.forEach((r) => { m[r.key] = rows.filter((x) => x.relationship === r.key).length })
    return m
  }, [rows])

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><span>🤝</span><span>CRM</span></h1>
          <p className="text-sm text-gray-400">Your audience CRM — superfans, collabs, press, customers. Track the people who matter.</p>
        </div>
        <button onClick={() => { setShowForm((x) => !x); if (!showForm) { setEditId(null); setForm(emptyForm()) } }} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">
          {showForm ? 'Cancel' : '+ New contact'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Name" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} type="email" placeholder="Email" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} placeholder="@handle" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} placeholder="Platform (Instagram, TikTok, etc.)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <select value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white">
              {RELATIONSHIPS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <input value={form.follower_count} onChange={(e) => setForm((f) => ({ ...f, follower_count: e.target.value }))} type="number" placeholder="Follower count (optional)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          </div>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes — how you met, what they like, context for next interaction" className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <button type="submit" className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded text-xs font-medium">{editId ? 'Update' : 'Add contact'}</button>
        </form>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts…" className="flex-1 min-w-[200px] bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
        <button onClick={() => setFilterRel('all')} className={`text-[11px] px-2 py-1 rounded-md border ${filterRel === 'all' ? 'bg-pink-500 border-pink-500 text-white' : 'bg-navy-900 border-navy-700/50 text-gray-400 hover:text-white'}`}>
          All ({counts.all})
        </button>
        {RELATIONSHIPS.map((r) => (
          <button key={r.key} onClick={() => setFilterRel(r.key)} className={`text-[11px] px-2 py-1 rounded-md border ${filterRel === r.key ? 'bg-pink-500 border-pink-500 text-white' : 'bg-navy-900 border-navy-700/50 text-gray-400 hover:text-white'}`}>
            {r.label} ({counts[r.key] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center text-gray-500 py-12 italic">
          {rows.length === 0 ? 'No contacts yet. Add the first superfan, collaborator, or press contact.' : 'No contacts match your filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {visible.map((c) => {
            const meta = RELATIONSHIPS.find((r) => r.key === c.relationship)
            return (
              <div key={c.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${meta?.color}`}>{c.relationship}</span>
                      <span className="text-sm font-semibold text-white">{c.name}</span>
                      {c.follower_count > 0 && <span className="text-[10px] text-gray-500">· {formatCount(c.follower_count)} followers</span>}
                    </div>
                    {(c.handle || c.platform) && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {c.handle && <span>{c.handle.startsWith('@') ? c.handle : '@' + c.handle}</span>}
                        {c.platform && <span className="text-gray-500"> · {c.platform}</span>}
                      </div>
                    )}
                    {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                    {c.notes && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{c.notes}</div>}
                    {c.last_interaction_at && (
                      <div className="text-[10px] text-gray-500 mt-1">Last contact: {new Date(c.last_interaction_at).toLocaleDateString()}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => logInteraction(c.id)} title="Log today as last interaction" className="text-[10px] px-2 py-0.5 bg-navy-700 hover:bg-navy-600 text-white rounded">💬 Touch</button>
                    <button onClick={() => startEdit(c)} className="text-[10px] px-2 py-0.5 text-gray-400 hover:text-white">Edit</button>
                    <button onClick={() => del(c.id)} className="text-[10px] text-gray-500 hover:text-rose-400">Delete</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
