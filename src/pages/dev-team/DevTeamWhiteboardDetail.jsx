import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Excalidraw } from '@excalidraw/excalidraw'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useWhiteboardPresence, colorForUser } from '../../lib/whiteboardPresence'

const SAVE_DEBOUNCE_MS = 1500
const POINTER_THROTTLE_MS = 50
const EDITING_TIMEOUT_MS = 30000

function relTime(ts) {
  const d = new Date(ts)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

// Cheap fingerprint for an Excalidraw element array. Sums versionNonce-derived
// state so we can detect real edits (add/modify/delete) vs. non-element changes
// in appState (scroll, zoom, selection, view mode) that also fire onChange.
function elementsFingerprint(elements) {
  if (!elements || elements.length === 0) return 0
  let h = elements.length | 0
  for (const el of elements) {
    h = ((h * 31) | 0) + ((el.version || 0) | 0)
    h = ((h * 31) | 0) + (((el.versionNonce || 0) | 0))
    if (el.id) h = ((h * 31) | 0) + (el.id.charCodeAt(0) | 0)
  }
  return h
}

export default function DevTeamWhiteboardDetail() {
  const { slug } = useParams()
  const { user, profile } = useAuth()
  const [canvas, setCanvas] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [staleWarning, setStaleWarning] = useState(false)
  const [excalidrawAPI, setExcalidrawAPI] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved'

  // Used to know whether an incoming postgres_changes row was authored by us.
  const lastLocalSavedAt = useRef(null)
  // Debounce + throttle timers.
  const saveTimer = useRef(null)
  const pointerLastSent = useRef(0)
  // The most recent scene from Excalidraw, captured every onChange.
  const latestScene = useRef(null)
  // Track whether we've announced "I am editing" so we don't spam the channel.
  const editingAnnounced = useRef(false)
  const lastSceneFingerprint = useRef(null)
  const editingClearTimer = useRef(null)

  const me = useMemo(() => ({
    id: user?.id,
    username: profile?.full_name || profile?.first_name || user?.email?.split('@')[0] || 'Anonymous',
  }), [user?.id, profile?.full_name, profile?.first_name, user?.email])

  const { collaborators, broadcastPointer, broadcastSelection, remoteEditing, announceEditing } =
    useWhiteboardPresence(canvas?.id, me)

  async function fetchCanvas() {
    const { data, error } = await supabase
      .from('dev_team_canvas')
      .select('*')
      .eq('slug', slug)
      .eq('kind', 'board')
      .single()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // Realtime: surface remote saves and stale-warnings.
  useEffect(() => {
    if (!canvas?.id) return
    const ch = supabase
      .channel(`whiteboard_row_${canvas.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dev_team_canvas', filter: `id=eq.${canvas.id}` }, payload => {
        const incoming = payload.new
        if (incoming.last_edited_by === user?.id) {
          // Echo of our own save — refresh local row metadata but do not stomp the scene we just sent.
          setCanvas(prev => prev ? { ...prev, updated_at: incoming.updated_at, last_edited_by: incoming.last_edited_by, pinned: incoming.pinned, title: incoming.title } : incoming)
          return
        }
        // Someone else saved. Warn if we have local unsaved changes; otherwise pull theirs in.
        const haveLocalChanges = !!saveTimer.current
        if (haveLocalChanges) {
          setStaleWarning(true)
        } else {
          setCanvas(incoming)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [canvas?.id, user?.id])

  // Auto-save: debounce after the last onChange.
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null
      const scene = latestScene.current
      if (!canvas?.id || !scene) { setSaveStatus('idle'); return }
      const payload = {
        scene_json: scene,
        last_edited_by: user.id,
      }
      lastLocalSavedAt.current = Date.now()
      const { error } = await supabase
        .from('dev_team_canvas')
        .update(payload)
        .eq('id', canvas.id)
      if (error) {
        setSaveStatus('idle')
        console.error('Whiteboard save failed:', error.message)
        return
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 1500)
    }, SAVE_DEBOUNCE_MS)
  }, [canvas?.id, user?.id])

  // Excalidraw fires onChange for almost every interaction. We capture the scene
  // and debounce-save. We also use onChange to announce "I'm editing" + selection.
  function handleChange(elements, appState) {
    // Excalidraw fires onChange for any appState change — scroll, zoom,
    // selection, cursor moves, view toggles — not just element edits.
    // We fingerprint the elements array and only treat THIS as a real change
    // when the fingerprint actually moves. Otherwise the 1.5s save debounce
    // gets reset on every mouse move and the "Saving" badge sticks forever.
    const fp = elementsFingerprint(elements)
    const isFirstChange = lastSceneFingerprint.current === null
    const elementsChanged = !isFirstChange && fp !== lastSceneFingerprint.current

    // Selection broadcasts on every onChange — cheap and a meaningful collab
    // signal even when nothing structural changed.
    broadcastSelection(appState?.selectedElementIds || {})

    // First onChange after canvas load: snapshot the fingerprint silently so
    // mounting doesn't trigger a phantom save.
    if (isFirstChange) {
      lastSceneFingerprint.current = fp
      latestScene.current = {
        elements: elements || [],
        appState: {
          viewBackgroundColor: appState?.viewBackgroundColor || '#0b1220',
          gridSize: appState?.gridSize ?? null,
        },
      }
      return
    }

    // No element change: bail. Don't reset save timer, don't claim editing.
    if (!elementsChanged) return

    // Real change.
    lastSceneFingerprint.current = fp
    latestScene.current = {
      elements: elements || [],
      appState: {
        viewBackgroundColor: appState?.viewBackgroundColor || '#0b1220',
        gridSize: appState?.gridSize ?? null,
      },
    }
    scheduleSave()

    // Editing claim — start.
    if (!editingAnnounced.current) {
      editingAnnounced.current = true
      announceEditing(true)
    }
    if (editingClearTimer.current) clearTimeout(editingClearTimer.current)
    editingClearTimer.current = setTimeout(() => {
      editingAnnounced.current = false
      announceEditing(false)
    }, EDITING_TIMEOUT_MS)
  }

  // Pointer updates — fire FAR more often (every mouse move). Throttle.
  function handlePointerUpdate(payload) {
    const now = Date.now()
    if (now - pointerLastSent.current < POINTER_THROTTLE_MS) return
    pointerLastSent.current = now
    broadcastPointer(payload)
  }

  // On unmount or canvas change, clear editing claim and flush pending save.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (editingClearTimer.current) clearTimeout(editingClearTimer.current)
      if (editingAnnounced.current) {
        announceEditing(false)
        editingAnnounced.current = false
      }
    }
  }, [canvas?.id, announceEditing])

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

  async function deleteBoard() {
    if (!window.confirm(`Delete whiteboard "${canvas.title}"? This cannot be undone.`)) return
    await supabase.from('dev_team_canvas').delete().eq('id', canvas.id)
    window.history.back()
  }

  async function refreshFromRemote() {
    setStaleWarning(false)
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    await fetchCanvas()
    // Force Excalidraw remount by re-keying — handled below via initialDataKey.
    setRefreshKey(k => k + 1)
  }

  const [refreshKey, setRefreshKey] = useState(0)

  const editorName = useMemo(() => {
    if (!canvas?.last_edited_by) return null
    const m = members.find(m => m.user_id === canvas.last_edited_by)
    return m?.display_name || null
  }, [canvas?.last_edited_by, members])

  const initialData = useMemo(() => {
    if (!canvas?.scene_json) return { elements: [], appState: { viewBackgroundColor: '#0b1220', theme: 'dark' } }
    return {
      elements: canvas.scene_json.elements || [],
      appState: { ...(canvas.scene_json.appState || {}), theme: 'dark' },
    }
  }, [canvas?.id, refreshKey])

  // Render

  return (
    <div className="space-y-4">
      <Link to="/admin/dev-team/whiteboard" className="text-xs text-brand-blue hover:underline inline-flex items-center gap-1">
        ← All whiteboards
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
              {saveStatus !== 'idle' && (
                <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded font-semibold ${
                  saveStatus === 'saving' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                }`}>
                  {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
                </span>
              )}
              <button
                onClick={togglePin}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  canvas.pinned ? 'bg-brand-blue/15 text-brand-blue' : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {canvas.pinned ? '★ Pinned' : '☆ Pin'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-white/40 flex-wrap">
            <div>
              {editorName ? `Last edited by ${editorName}` : 'Last edited'} · {relTime(canvas.updated_at)}
            </div>
            {(remoteEditing.length > 0 || collaborators.size > 0) && (
              <div className="flex items-center gap-2">
                {remoteEditing.map(r => (
                  <span key={r.userId} className="px-2 py-1 rounded bg-violet-500/10 text-violet-300 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: colorForUser(r.userId) }}></span>
                    {r.username} editing
                  </span>
                ))}
                {Array.from(collaborators.values()).filter(c => !remoteEditing.some(r => r.username === c.username)).map((c, i) => (
                  <span key={i} className="px-2 py-1 rounded bg-white/5 text-white/60 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }}></span>
                    {c.username}
                  </span>
                ))}
              </div>
            )}
          </div>

          {staleWarning && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-300 flex items-start justify-between gap-3">
              <div>
                <strong className="block">Someone else saved this whiteboard while you were editing.</strong>
                <span className="text-amber-300/70 text-xs">Your next auto-save will overwrite their changes. Pull theirs in to keep both safe, or keep editing if you've already coordinated.</span>
              </div>
              <button
                onClick={refreshFromRemote}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
              >
                Pull remote
              </button>
            </div>
          )}

          <div
            className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
            style={{ height: 'calc(100vh - 320px)', minHeight: '420px' }}
          >
            <Excalidraw
              key={refreshKey}
              initialData={initialData}
              theme="dark"
              excalidrawAPI={api => setExcalidrawAPI(api)}
              onChange={handleChange}
              onPointerUpdate={handlePointerUpdate}
              isCollaborating={true}
              UIOptions={{
                canvasActions: {
                  loadScene: false,
                  saveToActiveFile: false,
                  saveAsImage: true,
                  export: { saveFileToDisk: true },
                  clearCanvas: true,
                  changeViewBackgroundColor: true,
                  toggleTheme: false,
                },
              }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-white/30">
            <div>
              Auto-saves {SAVE_DEBOUNCE_MS / 1000}s after the last change. Multi-user presence is live — others see your cursor as you draw.
            </div>
            <button onClick={deleteBoard} className="text-red-400/70 hover:text-red-300 px-2 py-1">
              Delete whiteboard
            </button>
          </div>
        </>
      )}
    </div>
  )
}
