import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const SPONSOR_STATUS = [
  { key: 'prospect',    label: 'Prospect',    color: 'bg-slate-500/15 text-slate-300' },
  { key: 'pitched',     label: 'Pitched',     color: 'bg-sky-500/15 text-sky-300' },
  { key: 'negotiating', label: 'Negotiating', color: 'bg-amber-500/15 text-amber-300' },
  { key: 'active',      label: 'Active',      color: 'bg-pink-500/15 text-pink-300' },
  { key: 'completed',   label: 'Completed',   color: 'bg-emerald-500/15 text-emerald-300' },
  { key: 'passed',      label: 'Passed',      color: 'bg-zinc-500/15 text-zinc-500' },
]

const SOURCE_TYPES = [
  { key: 'article',  label: '📄 Article'  },
  { key: 'video',    label: '🎬 Video'    },
  { key: 'podcast',  label: '🎙 Podcast'  },
  { key: 'post',     label: '📱 Post'     },
  { key: 'tweet',    label: '🐦 Tweet'    },
  { key: 'book',     label: '📖 Book'     },
  { key: 'other',    label: '🔗 Other'    },
]

export default function AffiliateLibrary() {
  const { user } = useAuth()
  const [tab, setTab] = useState('hooks')

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><span>📚</span><span>Library</span></h1>
        <p className="text-sm text-gray-400">Your swipe file — winning hooks, sponsor pipeline, research you'll come back to.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-navy-700/50">
        {[
          { key: 'hooks',    label: '🎣 Hook vault' },
          { key: 'sponsors', label: '💼 Sponsor pipeline' },
          { key: 'research', label: '🔖 Research & inspo' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium ${tab === t.key ? 'text-pink-400 border-b-2 border-pink-500' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'hooks'    && <HooksTab    userId={user?.id} />}
      {tab === 'sponsors' && <SponsorsTab userId={user?.id} />}
      {tab === 'research' && <ResearchTab userId={user?.id} />}
    </div>
  )
}

/* ────────────── HOOKS ────────────── */
function HooksTab({ userId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ hook_text: '', category: '', platform: '', performance_note: '' })
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('creator_hooks').select('*').eq('user_id', userId)
        .order('updated_at', { ascending: false }).limit(100)
      if (error) throw error
      setRows(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load hooks') }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    if (!form.hook_text.trim()) return
    try {
      const { error } = await supabase.from('creator_hooks').insert({
        user_id: userId,
        hook_text: form.hook_text.trim(),
        category: form.category.trim() || null,
        platform: form.platform.trim() || null,
        performance_note: form.performance_note.trim() || null,
      })
      if (error) throw error
      setForm({ hook_text: '', category: '', platform: '', performance_note: '' })
      setShowForm(false)
      toast.success('Hook saved')
      load()
    } catch (err) { console.error(err); toast.error('Save failed') }
  }

  async function increment(h) {
    try {
      await supabase.from('creator_hooks').update({
        use_count: (h.use_count || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', h.id)
      load()
    } catch { toast.error('Update failed') }
  }

  async function del(id) {
    if (!window.confirm('Delete this hook?')) return
    try { await supabase.from('creator_hooks').delete().eq('id', id); load() }
    catch { toast.error('Delete failed') }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast.success('Copied') }
    catch { toast.error('Copy failed') }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">Openers that made posts pop — keep them here, reuse when you're stuck.</div>
        <button onClick={() => setShowForm((x) => !x)} className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-medium">
          {showForm ? 'Cancel' : '+ Add hook'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 space-y-2">
          <textarea value={form.hook_text} onChange={(e) => setForm((f) => ({ ...f, hook_text: e.target.value }))} required rows={2}
            placeholder={`e.g. "I wasted $10k learning this so you don't have to"`}
            className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Category (contrarian, listicle, etc.)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              placeholder="Platform (Instagram, X, etc.)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          </div>
          <input value={form.performance_note} onChange={(e) => setForm((f) => ({ ...f, performance_note: e.target.value }))}
            placeholder="Performance notes — e.g. 1.2M views, highest-saves post of the month"
            className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <button type="submit" className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded text-xs font-medium">Save hook</button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-500 py-12 italic">Nothing here yet. Add a hook that worked.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((h) => (
            <div key={h.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
              <div className="text-sm text-white">{h.hook_text}</div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {h.category && <span className="text-[10px] px-1.5 py-0.5 bg-navy-700/50 rounded text-gray-300">{h.category}</span>}
                {h.platform && <span className="text-[10px] text-gray-500">· {h.platform}</span>}
                {h.use_count > 0 && <span className="text-[10px] text-pink-300">· used {h.use_count}×</span>}
                {h.performance_note && <span className="text-[10px] text-gray-400 italic">· {h.performance_note}</span>}
                <div className="ml-auto flex gap-1.5">
                  <button onClick={() => { copy(h.hook_text); increment(h) }} className="text-[10px] px-2 py-0.5 bg-navy-700 hover:bg-navy-600 text-white rounded">Copy + use</button>
                  <button onClick={() => del(h.id)} className="text-[10px] text-gray-500 hover:text-rose-400">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ────────────── SPONSORS ────────────── */
function SponsorsTab({ userId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({ brand_name: '', contact_name: '', contact_email: '', website: '', fee_amount: '', notes: '' })

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('creator_sponsors').select('*').eq('user_id', userId)
        .order('updated_at', { ascending: false }).limit(200)
      if (error) throw error
      setRows(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load sponsors') }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    if (!form.brand_name.trim()) return
    try {
      const payload = {
        user_id: userId,
        brand_name: form.brand_name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        website: form.website.trim() || null,
        fee_amount: form.fee_amount ? parseFloat(form.fee_amount) : null,
        notes: form.notes.trim() || null,
      }
      const { error } = await supabase.from('creator_sponsors').insert(payload)
      if (error) throw error
      setForm({ brand_name: '', contact_name: '', contact_email: '', website: '', fee_amount: '', notes: '' })
      setShowForm(false)
      toast.success('Sponsor added')
      load()
    } catch (err) { console.error(err); toast.error('Save failed') }
  }

  async function updateStatus(id, status) {
    try {
      await supabase.from('creator_sponsors').update({
        status, last_contact_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', id)
      load()
    } catch { toast.error('Update failed') }
  }

  async function del(id) {
    if (!window.confirm('Delete this sponsor?')) return
    try { await supabase.from('creator_sponsors').delete().eq('id', id); load() }
    catch { toast.error('Delete failed') }
  }

  const visible = filterStatus === 'all' ? rows : rows.filter((r) => r.status === filterStatus)
  const totalActive = rows.filter((r) => r.status === 'active' || r.status === 'completed').reduce((sum, r) => sum + (parseFloat(r.fee_amount) || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">Your brand deal pipeline. Track from prospect to paid.</div>
          {totalActive > 0 && (
            <div className="text-xs text-emerald-300">Active + completed: <span className="font-bold">${totalActive.toFixed(2)}</span></div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-[11px] text-white">
            <option value="all">All statuses</option>
            {SPONSOR_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button onClick={() => setShowForm((x) => !x)} className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-medium">
            {showForm ? 'Cancel' : '+ Add sponsor'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} required placeholder="Brand name" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} placeholder="Contact name" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} type="email" placeholder="Contact email" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="Website" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.fee_amount} onChange={(e) => setForm((f) => ({ ...f, fee_amount: e.target.value }))} type="number" step="0.01" placeholder="Fee amount ($)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          </div>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes — audience fit, negotiated terms, past history"
            className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <button type="submit" className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded text-xs font-medium">Save sponsor</button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center text-gray-500 py-12 italic">No sponsors yet. Add your first prospect.</div>
      ) : (
        <div className="space-y-2">
          {visible.map((s) => {
            const meta = SPONSOR_STATUS.find((x) => x.key === s.status)
            return (
              <div key={s.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${meta?.color}`}>{s.status}</span>
                      <span className="text-sm font-semibold text-white">{s.brand_name}</span>
                      {s.fee_amount && <span className="text-xs text-emerald-300">${parseFloat(s.fee_amount).toFixed(0)}</span>}
                    </div>
                    {(s.contact_name || s.contact_email) && (
                      <div className="text-xs text-gray-400">
                        {s.contact_name} {s.contact_email && <span className="text-gray-500">· {s.contact_email}</span>}
                      </div>
                    )}
                    {s.notes && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{s.notes}</div>}
                  </div>
                  <div className="flex flex-col gap-1 items-end flex-shrink-0">
                    <select value={s.status} onChange={(e) => updateStatus(s.id, e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded px-1.5 py-0.5 text-[10px] text-white">
                      {SPONSOR_STATUS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                    </select>
                    <button onClick={() => del(s.id)} className="text-[10px] text-gray-500 hover:text-rose-400">Delete</button>
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

/* ────────────── RESEARCH ────────────── */
function ResearchTab({ userId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', url: '', notes: '', source_type: 'article' })

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('creator_research').select('*').eq('user_id', userId)
        .order('updated_at', { ascending: false }).limit(200)
      if (error) throw error
      setRows(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load research') }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      const { error } = await supabase.from('creator_research').insert({
        user_id: userId,
        title: form.title.trim(),
        url: form.url.trim() || null,
        notes: form.notes.trim() || null,
        source_type: form.source_type,
      })
      if (error) throw error
      setForm({ title: '', url: '', notes: '', source_type: 'article' })
      setShowForm(false)
      toast.success('Saved')
      load()
    } catch (err) { console.error(err); toast.error('Save failed') }
  }

  async function del(id) {
    if (!window.confirm('Delete this item?')) return
    try { await supabase.from('creator_research').delete().eq('id', id); load() }
    catch { toast.error('Delete failed') }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">Research, inspiration, notes — save once, reuse forever.</div>
        <button onClick={() => setShowForm((x) => !x)} className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-medium">
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 space-y-2">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="Title" className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-2">
            <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} type="url" placeholder="URL (optional)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <select value={form.source_type} onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white">
              {SOURCE_TYPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Notes — why did you save this? What's the key takeaway?" className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <button type="submit" className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded text-xs font-medium">Save</button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-500 py-12 italic">Empty. Drop in articles, videos, tweets — anything worth a second look.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {rows.map((r) => {
            const meta = SOURCE_TYPES.find((x) => x.key === r.source_type)
            return (
              <div key={r.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-gray-500">{meta?.label}</div>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white hover:text-pink-300 break-words">{r.title}</a>
                    ) : (
                      <div className="text-sm font-semibold text-white">{r.title}</div>
                    )}
                    {r.notes && <div className="text-xs text-gray-400 mt-1 line-clamp-3">{r.notes}</div>}
                  </div>
                  <button onClick={() => del(r.id)} className="text-[10px] text-gray-500 hover:text-rose-400 flex-shrink-0">✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
