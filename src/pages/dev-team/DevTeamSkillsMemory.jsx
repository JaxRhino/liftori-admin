import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

const REPO_BASE = 'https://github.com/JaxRhino/liftori-dev-team'
const REPO_BLOB = `${REPO_BASE}/blob/main`

// Published skills (Wave B seed + B.2 corrections). Edit this list when new skills land.
// Future wave: have push-dev-team.ps1 populate dev_team_files manifest and read from there.
const PUBLISHED_SKILLS = [
  { name: 'sage', summary: 'Personal AI executive assistant for Ryan; auto-triggers on every conversation' },
  { name: 'github-browser-push', summary: 'Browser-automation patterns for editing files via GitHub web UI' },
  { name: 'liftori-account-manager', summary: 'Client relationship workflows: status updates, milestones, invoices' },
  { name: 'liftori-build-orchestrator', summary: 'Master build coordinator: phase tracking, sequencing, dependencies' },
  { name: 'liftori-build-scheduler', summary: 'Autonomous build session manager: scheduled builds, briefs, summaries' },
  { name: 'liftori-client-onboarding', summary: 'Complete process for setting up new client platforms' },
  { name: 'liftori-clients', summary: 'Client platform registry - all active sites, admin URLs, auth' },
  { name: 'liftori-code-review', summary: 'Pre-deploy code review gate' },
  { name: 'liftori-coder', summary: 'Coding specialist: codebase architecture, patterns, conventions' },
  { name: 'liftori-debug', summary: 'Debugging patterns and troubleshooting' },
  { name: 'liftori-deploy', summary: 'Deployment workflows and pipelines' },
  { name: 'liftori-design', summary: 'UI/UX design system, components, screen specs' },
  { name: 'liftori-docs', summary: 'Documentation patterns' },
  { name: 'liftori-environment', summary: 'Secrets and credential management, env var governance' },
  { name: 'liftori-estimation', summary: 'Project estimation, scoping, pricing tier validation' },
  { name: 'liftori-infra', summary: 'Infrastructure reference: Supabase, Vercel, GitHub, Cloudflare IDs' },
  { name: 'liftori-qa', summary: 'Testing and quality control - 9-point pre-launch checklist' },
  { name: 'liftori-rally', summary: 'Rally video call orchestration patterns' },
  { name: 'liftori-supabase', summary: 'Deep Supabase domain expert: 33-table schema, RLS, edge fns' },
]

const MEMORY_PARTITIONS = [
  { file: 'MEMORY_shared.md', label: 'Shared', desc: 'Both devs learn from this' },
  { file: 'MEMORY_ryan.md',   label: 'Ryan',   desc: 'Ryan-specific patterns + preferences' },
  { file: 'MEMORY_mike.md',   label: 'Mike',   desc: 'Mike-specific patterns + preferences' },
]

function relTime(ts) {
  const d = new Date(ts)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

export default function DevTeamSkillsMemory() {
  const [recentDeploys, setRecentDeploys] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  async function fetchDeploys() {
    const { data } = await supabase
      .from('dev_team_activity')
      .select('id, author_display_name, action, target, details, created_at')
      .eq('target_type', 'deployment')
      .like('target', 'liftori-dev-team%')
      .order('created_at', { ascending: false })
      .limit(8)
    setRecentDeploys(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchDeploys()
    const ch = supabase
      .channel('dev_team_skills_deploys')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dev_team_activity' }, () => fetchDeploys())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const visibleSkills = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return PUBLISHED_SKILLS
    return PUBLISHED_SKILLS.filter(s =>
      s.name.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q)
    )
  }, [search])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4 flex items-start gap-3">
        <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-brand-blue/15 text-brand-blue font-semibold whitespace-nowrap">Live</span>
        <div className="text-sm text-white/80">
          <strong className="text-white">{PUBLISHED_SKILLS.length} skills + 3 memory partitions</strong> versioned in{' '}
          <a href={REPO_BASE} target="_blank" rel="noreferrer" className="text-brand-blue underline hover:text-white">JaxRhino/liftori-dev-team</a>.
          Local edits at <code className="bg-white/5 px-1 rounded text-xs">OneDrive\Liftori Ai\.claude\skills\</code> sync via{' '}
          <code className="bg-white/5 px-1 rounded text-xs">push-dev-team.ps1</code>.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Skills registry - 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Published Skills</h2>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter..."
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-brand-blue/50 w-40"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleSkills.map(s => (
              <a
                key={s.name}
                href={`${REPO_BLOB}/skills/${s.name}/SKILL.md`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white/5 hover:bg-white/10 px-3 py-2.5 border border-white/5 hover:border-white/15 transition-colors group block"
              >
                <div className="text-sm text-white font-mono group-hover:text-brand-blue transition-colors truncate">
                  {s.name}
                </div>
                <div className="text-xs text-white/50 mt-1 line-clamp-2">{s.summary}</div>
              </a>
            ))}
            {visibleSkills.length === 0 && (
              <div className="col-span-2 text-xs text-white/40 italic text-center py-6">No matching skills.</div>
            )}
          </div>
        </div>

        {/* Right column - deploys + memory */}
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Recent Deploys
              </h2>
            </div>
            {loading ? (
              <div className="text-white/40 text-xs">Loading…</div>
            ) : recentDeploys.length === 0 ? (
              <div className="text-xs text-white/40 italic">No dev-team deploys yet. Run <code className="bg-white/5 px-1 rounded">push-dev-team.ps1</code> to log the first one.</div>
            ) : (
              <div className="space-y-2">
                {recentDeploys.map(d => (
                  <div key={d.id} className="text-sm">
                    <div className="text-white/80">
                      <span className="font-medium">{d.author_display_name}</span>
                      <span className="text-white/40 mx-1">·</span>
                      <span className="text-brand-blue font-mono text-xs">{(d.target || '').replace('liftori-dev-team:', '')}</span>
                    </div>
                    {d.details?.commit_msg && (
                      <div className="text-xs text-white/50 line-clamp-1 mt-0.5">{d.details.commit_msg}</div>
                    )}
                    <div className="text-[10px] text-white/40 mt-0.5">{relTime(d.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Memory Partitions</h2>
            <div className="space-y-2">
              {MEMORY_PARTITIONS.map(m => (
                <a
                  key={m.file}
                  href={`${REPO_BLOB}/memory/${m.file}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg bg-white/5 hover:bg-white/10 px-3 py-2 border border-white/5 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium group-hover:text-brand-blue">{m.label}</span>
                    <span className="text-[10px] text-white/30 font-mono">{m.file}</span>
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">{m.desc}</div>
                </a>
              ))}
            </div>
            <div className="text-[10px] text-white/40 italic mt-3 leading-relaxed">
              Sage's live memory is cloud-managed and not file-syncable. These files are curated team knowledge — write to them deliberately when something's worth sharing.
            </div>
          </div>
        </div>
      </div>

      {/* Workflow */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Sync Workflow</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-1">Pull (session start)</div>
            <pre className="bg-black/30 border border-white/10 rounded-lg p-2.5 text-[11px] font-mono text-white/80 overflow-x-auto whitespace-pre-wrap">{`& "C:\\dev\\liftori-dev-team\\scripts\\pull-dev-team.ps1"`}</pre>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-1">Push (after edits)</div>
            <pre className="bg-black/30 border border-white/10 rounded-lg p-2.5 text-[11px] font-mono text-white/80 overflow-x-auto whitespace-pre-wrap">{`& "C:\\dev\\liftori-dev-team\\scripts\\push-dev-team.ps1" -Message "[skill] sage: tightened triggers"`}</pre>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-1">First-time setup (Mike)</div>
            <pre className="bg-black/30 border border-white/10 rounded-lg p-2.5 text-[11px] font-mono text-white/80 overflow-x-auto whitespace-pre-wrap">{`git clone https://github.com/JaxRhino/liftori-dev-team C:\\dev\\liftori-dev-team
& "C:\\dev\\liftori-dev-team\\scripts\\setup-dev-team.ps1"`}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
