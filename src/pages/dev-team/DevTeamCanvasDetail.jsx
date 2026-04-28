import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const INPUT = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue/50'

function relTime(ts) {
  const d = new Date(ts)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

// Tiny markdown renderer (good enough for team docs - not a CommonMark parser).
// Supports: #/##/### headings, **bold**, _italic_, `code`, ```code blocks```,
// - bulleted lists, 1. numbered lists, > blockquotes, [text](url) links, ---
function renderMarkdown(src) {
  if (!src) return null
  const lines = src.split('\n')
  const out = []
  let i = 0
  let key = 0
  function inline(text) {
    // escape HTML
    let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    s = s.replace(/`([^`]+)`/g, '<code class="bg-white/10 text-brand-blue px-1 py-0.5 rounded font-mono text-[0.9em]">$1</code>')
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>')
    s = s.replace(/(?<![a-z])_([^_]+)_(?![a-z])/g, '<em>$1</em>')
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-brand-blue underline hover:text-white">$1</a>')
    return s
  }
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const block = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { block.push(lines[i]); i++ }
      i++
      out.push(<pre key={key++} className="bg-black/30 border border-white/10 rounded-lg p-3 text-xs font-mono text-white/80 overflow-x-auto whitespace-pre-wrap my-3">{block.join('\n')}</pre>)
      continue
    }
    if (line.startsWith('### ')) { out.push(<h3 key={key++} className="text-base font-semibold text-white mt-5 mb-2" dangerouslySetInnerHTML={{__html: inline(line.slice(4))}} />); i++; continue }
    if (line.startsWith('## '))  { out.push(<h2 key={key++} className="text-lg font-heading text-white tracking-wide mt-6 mb-2" dangerouslySetInnerHTML={{__html: inline(line.slice(3))}} />); i++; continue }
    if (line.startsWith('# '))   { out.push(<h1 key={key++} className="text-2xl font-heading text-white tracking-wide mt-2 mb-3" dangerouslySetInnerHTML={{__html: inline(line.slice(2))}} />); i++; continue }
    if (line.startsWith('---'))  { out.push(<hr key={key++} className="border-white/10 my-4" />); i++; continue }
    if (line.startsWith('> '))   { out.push(<blockquote key={key++} className="border-l-2 border-brand-blue/50 pl-3 text-white/70 italic my-2" dangerouslySetInnerHTML={{__html: inline(line.slice(2))}} />); i++; continue }
    if (line.match(/^[-*] /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[-*] /)) { items.push(lines[i].slice(2)); i++ }
      out.push(<ul key={key++} className="list-disc list-inside text-white/80 space-y-1 my-2">{items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{__html: inline(it)}} />)}</ul>)
      continue
    }
    if (line.match(/^\d+\. /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, '')); i++ }
      out.push(<ol key={key++} className="list-decimal list-inside text-white/80 space-y-1 my-2">{items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{__html: inline(it)}} />)}</ol>)
      continue
    }
    if (line.trim() === '') { i++; continue }
    out.push(<p key={key++} className="text-white/80 leading-relaxed my-2" dangerouslySetInnerHTML={{__html: inline(line)}} />)
    i++
  }
  return out
}

export default function DevTeamCanvasDetail() {
  const { slug } = useParams()
  const { user, profile } = useAuth()
  const [canvas, setCanvas] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [staleWarning, setStaleWarning] = useState(false)
  const baseRef = useRef(null) // updated_at when we loaded for edit

  async function fetchCanvas() {
    const { data, error } = await supabase.from('dev_team_canvas').select('*').eq('slug', slug).single()
    if (error) { setErr(error.message); setLoading(false); return }
    setCanvas(data)
    setLoading(false)
    setErr(null)
  }

  async function fetchMembers() {
    const { data } = await supabase.from('dev_team_members').select('user_id, display_name').eq('active', true)
    setMembers(data || [])
  }

  useEffect(() => {
    setLoading(true)
    fetchCanvas()
    fetchMembers()
  }, [slug])

  // Realtime: detect when this canvas is updated by someone else
  useEffect(() => {
    if (!canvas?.id) return
    const ch = supabase
      .channel(`canvas_${canvas.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dev_team_canvas', filter: `id=eq.${canvas.id}` }, payload => {
        const incoming = payload.new
        if (editing) {
          if (baseRef.current && incoming.updated_at !== baseRef.current && incoming.last_edited_by !== user?.id) {
            setStaleWarning(true)
          }
        } else {
          setCanvas(incoming)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [canvas?.id, editing, user?.id])

  function startEdit() {
    setDraft(canvas.content || '')
    baseRef.current = canvas.updated_at
    setStaleWarning(false)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft('')
    setStaleWarning(false)
  }

  async function save() {
    setSaving(true)
    const { data, error } = await supabase
      .from('dev_team_canvas')
      .update({ content: draft, last_edited_by: user.id })
      .eq('id', canvas.id)
      .select()
      .single()
    setSaving(false)
    if (error) { window.alert('Save failed: ' + error.message); return }
    setCanvas(data)
    setEditing(false)
    setDraft('')
    setStaleWarning(false)
  }

  async function togglePin() {
    if (!canvas) return
    const { data, error } = await supabase
      .from('dev_team_canvas')
      .update({ pinned: !canvas.pinned, last_edited_by: user.id })
      .eq('id', canvas.id)
      .select()
      .single()
    if (!error) setCanvas(data)
  }

  async function deleteCanvas() {
    if (!window.confirm(`Delete canvas "${canvas.title}"? This cannot be undone.`)) return
    await supabase.from('dev_team_canvas').delete().eq('id', canvas.id)
    window.history.back()
  }

  const editorName = useMemo(() => {
    if (!canvas?.last_edited_by) return null
    const m = members.find(m => m.user_id === canvas.last_edited_by)
    return m?.display_name || null
  }, [canvas?.last_edited_by, members])

  return (
    <div className="space-y-4">
      <Link to="/admin/dev-team/canvas" className="text-xs text-brand-blue hover:underline inline-flex items-center gap-1">
        ← All canvases
      </Link>

      {loading && <div className="text-white/40">Loading…</div>}

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {err}
        </div>
      )}

      {canvas && (
        <>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-2xl font-heading text-white tracking-wide truncate">{canvas.title}</h1>
              <div className="text-xs text-white/40 font-mono mt-1">/{canvas.slug}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={togglePin}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  canvas.pinned ? 'bg-brand-blue/15 text-brand-blue' : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {canvas.pinned ? '★ Pinned' : '☆ Pin'}
              </button>
              {!editing ? (
                <button onClick={startEdit} className="px-4 py-1.5 rounded-lg text-sm bg-white/5 text-white hover:bg-white/10 transition-colors">
                  Edit
                </button>
              ) : (
                <>
                  <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5">Cancel</button>
                  <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg text-sm bg-brand-blue text-navy-950 font-semibold hover:bg-brand-blue/90 disabled:opacity-40">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-xs text-white/40">
            {editorName ? `Last edited by ${editorName}` : 'Last edited'} · {relTime(canvas.updated_at)}
          </div>

          {staleWarning && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-300">
              <strong className="block">Heads up — someone else updated this canvas while you were editing.</strong>
              <span className="text-amber-300/70 text-xs">Your save will overwrite their changes. Cancel to refresh, or proceed if you've already merged the diff manually.</span>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 min-h-[300px]">
            {editing ? (
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={20}
                className="w-full bg-transparent text-white/90 font-mono text-sm leading-relaxed focus:outline-none resize-y"
                placeholder="# Section\n\nWrite markdown..."
              />
            ) : (
              <div className="prose-canvas">
                {renderMarkdown(canvas.content)}
              </div>
            )}
          </div>

          {!editing && (
            <div className="flex justify-end">
              <button onClick={deleteCanvas} className="text-xs text-red-400/70 hover:text-red-300 px-2 py-1">
                Delete canvas
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
