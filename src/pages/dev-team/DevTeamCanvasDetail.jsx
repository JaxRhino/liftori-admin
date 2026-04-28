import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function DevTeamCanvasDetail() {
  const { slug } = useParams()
  const [canvas, setCanvas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase
          .from('dev_team_canvas')
          .select('*')
          .eq('slug', slug)
          .single()
        if (error) throw error
        if (!cancelled) setCanvas(data)
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Failed to load canvas')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

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
            <div>
              <h1 className="text-2xl font-heading text-white tracking-wide">{canvas.title}</h1>
              <div className="text-xs text-white/40 font-mono mt-1">/{canvas.slug}</div>
            </div>
            <div className="text-xs text-white/40">
              Last updated {new Date(canvas.updated_at).toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <pre className="whitespace-pre-wrap font-mono text-sm text-white/80 leading-relaxed">{canvas.content}</pre>
          </div>

          <div className="text-xs text-white/40 italic">
            Read-only in Wave A. Wave E adds the realtime editor + presence cursors.
          </div>
        </>
      )}
    </div>
  )
}
