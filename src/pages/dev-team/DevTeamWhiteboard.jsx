import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const INPUT = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue/50'

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function relTime(ts) {
  const d = new Date(ts)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

function NewWhiteboardModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [pinned, setPinned] = useState(false)
  const [touchedSlug, setTouchedSlug] = useState(false)

  function updateTitle(t) {
    setTitle(t)
    if (!touchedSlug) setSlug(slugify(t))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-navy-900 border border-white/15 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-heading text-white tracking-wide">New Whiteboard</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Title *</label>
            <input className={INPUT} value={title} onChange={e => updateTitle(e.target.value)} placeholder="Architecture Sketch" autoFocus />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Slug</label>
            <input className={INPUT + ' font-mono text-xs'} value={slug} onChange={e => { setSlug(slugify(e.target.value)); setTouchedSlug(true) }} placeholder="architecture-sketch" />
            <div className="text-[10px] text-white/40 mt-1">URL: /admin/dev-team/whiteboard/{slug || 'your-slug'}</div>
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="w-4 h-4 accent-brand-blue" />
            Pin to overview
          </label>
          <div className="text-xs text-white/50 leading-relaxed">
            Whiteboards open blank. Use the drawing tools to add shapes, text, arrows, freehand strokes, or sticky notes. Auto-saves as you work.
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5">Cancel</button>
          <button onClick={() => onCreate({ title, slug, pinned })} disabled={!title.trim() || !slug.trim()} className="px-4 py-2 rounded-lg text-sm bg-brand-blue text-navy-950 font-semibold hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed">
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DevTeamWhiteboard() {
  const { user } = useAuth()
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  async function fetchBoards() {
    const { data, error } = await supabase
      .from('dev_team_canvas')
      .select('id, title, slug, pinned, updated_at, last_edited_by')
      .eq('kind', 'board')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    if (!error) setBoards(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchBoards()
    const ch = supabase
      .channel('dev_team_whiteboard_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_team_canvas' }, () => fetchBoards())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function createBoard({ title, slug, pinned }) {
    const { error } = await supabase.from('dev_team_canvas').insert({
      title: title.trim(),
      slug: slug.trim(),
      kind: 'board',
      content: null,
      scene_json: { elements: [], appState: { viewBackgroundColor: '#0b1220' } },
      pinned,
      created_by: user.id,
      last_edited_by: user.id,
    })
    if (error) {
      window.alert('Create failed: ' + error.message)
      return
    }
    setShowNew(false)
    fetchBoards()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/40">
          {loading ? 'Loading...' : `${boards.length} whiteboard${boards.length === 1 ? '' : 's'}`}
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 rounded-lg bg-brand-blue text-navy-950 font-semibold text-sm hover:bg-brand-blue/90 transition-colors"
        >
          + New Whiteboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!loading && boards.length === 0 && (
          <div className="col-span-2 text-center text-white/40 italic py-8">No whiteboards yet. Create one to start drawing.</div>
        )}
        {boards.map(b => (
          <Link
            key={b.id}
            to={`/admin/dev-team/whiteboard/${b.slug}`}
            className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 p-5 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base text-white font-semibold group-hover:text-brand-blue transition-colors truncate">{b.title}</h3>
                <div className="text-xs text-white/40 font-mono mt-1 truncate">/{b.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-violet-500/10 text-violet-300 font-semibold whitespace-nowrap">Board</span>
                {b.pinned && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-brand-blue/10 text-brand-blue font-semibold whitespace-nowrap">Pinned</span>
                )}
              </div>
            </div>
            <div className="text-xs text-white/40 mt-3">
              Updated {relTime(b.updated_at)}
            </div>
          </Link>
        ))}
      </div>

      {showNew && <NewWhiteboardModal onClose={() => setShowNew(false)} onCreate={createBoard} />}
    </div>
  )
}
