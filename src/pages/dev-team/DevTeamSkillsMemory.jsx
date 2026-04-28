import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function DevTeamSkillsMemory() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('dev_team_files_current')
          .select('bucket, path, author_display_name, version, size_bytes, comment, created_at')
          .order('bucket')
          .order('path')
        if (error) throw error
        setFiles(data || [])
      } catch (err) {
        console.error('[DevTeam] skills/memory load failed:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const grouped = files.reduce((acc, f) => {
    (acc[f.bucket] = acc[f.bucket] || []).push(f)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-amber-500/15 text-amber-300 font-semibold">Wave B</span>
        <div className="text-sm text-white/70">
          The <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">liftori-dev-team-sync</code> skill ships in Wave B. Once installed, every Cowork session pulls + pushes skills and memory through this view.
        </div>
      </div>

      {loading ? (
        <div className="text-white/40">Loading…</div>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="text-white/60 text-sm">No synced files yet.</div>
          <div className="text-white/40 text-xs mt-1">Storage buckets <code className="bg-white/5 px-1 rounded">dev-team-skills</code> and <code className="bg-white/5 px-1 rounded">dev-team-memory</code> are provisioned and gated. Wave B fills them.</div>
        </div>
      ) : (
        Object.entries(grouped).map(([bucket, list]) => (
          <div key={bucket} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="bg-white/5 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">Bucket</div>
                <div className="text-sm text-white font-mono">{bucket}</div>
              </div>
              <div className="text-xs text-white/40">{list.length} file{list.length === 1 ? '' : 's'}</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="text-left px-4 py-2">Path</th>
                  <th className="text-left px-4 py-2">Author</th>
                  <th className="text-left px-4 py-2">Ver</th>
                  <th className="text-left px-4 py-2">Size</th>
                  <th className="text-left px-4 py-2">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {list.map(f => (
                  <tr key={`${f.bucket}-${f.path}`} className="hover:bg-white/5">
                    <td className="px-4 py-2.5 text-white font-mono text-xs">{f.path}</td>
                    <td className="px-4 py-2.5 text-white/70">{f.author_display_name}</td>
                    <td className="px-4 py-2.5 text-white/40">v{f.version}</td>
                    <td className="px-4 py-2.5 text-white/40">{(f.size_bytes / 1024).toFixed(1)} KB</td>
                    <td className="px-4 py-2.5 text-white/40">{new Date(f.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
