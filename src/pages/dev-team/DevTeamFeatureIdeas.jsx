import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const STATUS_META = {
  idea:      { label: 'Idea',      dot: 'bg-slate-500',   text: 'text-slate-300' },
  refining:  { label: 'Refining',  dot: 'bg-blue-500',    text: 'text-blue-300' },
  approved:  { label: 'Approved',  dot: 'bg-emerald-500', text: 'text-emerald-300' },
  converted: { label: 'Converted', dot: 'bg-violet-500',  text: 'text-violet-300' },
  parked:    { label: 'Parked',    dot: 'bg-amber-500',   text: 'text-amber-300' },
  killed:    { label: 'Killed',    dot: 'bg-red-500',     text: 'text-red-300' },
}
const STATUS_OPTIONS = ['idea', 'refining', 'approved', 'converted', 'parked', 'killed']

const PRIORITY_META = {
  must:         { label: 'Must',         text: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-500/30' },
  should:       { label: 'Should',       text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  nice:         { label: 'Nice',         text: 'text-slate-300',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
  parking_lot:  { label: 'Parking Lot',  text: 'text-white/40',   bg: 'bg-white/5',       border: 'border-white/10' },
}
const PRIORITY_OPTIONS = ['must', 'should', 'nice', 'parking_lot']
const PRIORITY_RANK = { must: 0, should: 1, nice: 2, parking_lot: 3 }
const STATUS_RANK = { idea: 0, refining: 1, approved: 2, parked: 3, converted: 4, killed: 5 }

const EFFORT_META = {
  xs:      { label: 'XS',      desc: '< 1 hr' },
  s:       { label: 'S',       desc: '1-4 hrs' },
  m:       { label: 'M',       desc: '1-2 days' },
  l:       { label: 'L',       desc: '3-5 days' },
  xl:      { label: 'XL',      desc: '1+ weeks' },
  unknown: { label: '?',       desc: 'Not sized' },
}
const EFFORT_OPTIONS = ['xs', 's', 'm', 'l', 'xl', 'unknown']

const HUB_OPTIONS = [
  'admin', 'customer-hub', 'marketing', 'finance', 'sales', 'operations',
  'eos', 'hr', 'lead-hunter', 'communications', 'affiliate', 'portal',
  'labos', 'liftop', 'dev-team', 'platform', 'other',
]

const INPUT = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue/50'
const TEXTAREA = INPUT + ' resize-y'

function relTime(ts) {
  const d = new Date(ts)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

function StatusPill({ status }) {
  const s = STATUS_META[status] || STATUS_META.idea
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold">
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
      <span className={s.text}>{s.label}</span>
    </span>
  )
}

function PriorityPill({ priority }) {
  const p = PRIORITY_META[priority] || PRIORITY_META.nice
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${p.bg} ${p.text} ${p.border} border`}>
      {p.label}
    </span>
  )
}

function EffortBadge({ effort }) {
  const e = EFFORT_META[effort] || EFFORT_META.unknown
  return <span className="text-[10px] uppercase tracking-wider text-white/50 font-mono" title={e.desc}>{e.label}</span>
}

function IdeaCard({ idea, onClick, currentUserKey }) {
  const interest = currentUserKey === 'ryan' ? idea.ryan_interest : idea.mike_interest
  const totalVotes = (idea.ryan_interest || 0) + (idea.mike_interest || 0)
  const isDimmed = idea.status === 'killed' || idea.status === 'parked'
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 border transition-all ${
        isDimmed
          ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-80'
          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07] hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm text-white font-semibold leading-snug flex-1 min-w-0">
          {idea.title}
        </div>
        {idea.hub && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue font-semibold whitespace-nowrap font-mono">
            {idea.hub}
          </span>
        )}
      </div>
      {idea.pitch && (
        <div className="text-xs text-white/60 leading-relaxed line-clamp-3 mb-3">{idea.pitch}</div>
      )}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <StatusPill status={idea.status} />
        <PriorityPill priority={idea.priority} />
        <EffortBadge effort={idea.effort} />
        {idea.customer_request && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 font-semibold">
            Cust: {idea.customer_request}
          </span>
        )}
        {idea.requires_platform_changes && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold">
            ⚠ platform
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/5">
        <span>{idea.submitted_by_name || 'Unknown'} · {relTime(idea.created_at)}</span>
        <span className="flex items-center gap-2">
          {totalVotes > 0 && <span className="text-emerald-300">★ {totalVotes}</span>}
          {interest === 1 && <span className="text-brand-blue">your ★</span>}
        </span>
      </div>
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wider text-brand-blue/80 font-semibold border-b border-white/10 pb-1.5">{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-white/40 mt-1">{hint}</div>}
    </div>
  )
}

function IdeaModal({ editing, onClose, onSave, onDelete, onPromote, onToggleVote, currentUserKey }) {
  const [form, setForm] = useState(editing)
  useEffect(() => { setForm(editing) }, [editing])

  const isNew = !form?.id
  const isConverted = form?.status === 'converted' && form?.converted_task_id
  const refLinksText = (form?.reference_links || []).join('\n')
  const filesScopeText = (form?.files_scope || []).join('\n')
  const tagsText = (form?.tags || []).join(', ')

  function update(patch) { setForm(prev => ({ ...prev, ...patch })) }

  function save() {
    if (!form?.title?.trim()) return
    onSave({
      ...form,
      reference_links: refLinksText.split('\n').map(s => s.trim()).filter(Boolean),
      files_scope: filesScopeText.split('\n').map(s => s.trim()).filter(Boolean),
      tags: tagsText.split(',').map(s => s.trim()).filter(Boolean),
    })
  }

  if (!form) return null

  const myInterest = currentUserKey === 'ryan' ? form.ryan_interest : form.mike_interest

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-navy-900 border border-white/15 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-navy-900 z-10">
          <h2 className="text-lg font-heading text-white tracking-wide">{isNew ? 'New Feature Idea' : 'Edit Feature Idea'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-6">
          <Section title="Core">
            <Field label="Title *">
              <input className={INPUT} value={form.title || ''} onChange={e => update({ title: e.target.value })} placeholder="Realtime presence cursors on canvases" autoFocus />
            </Field>
            <Field label="Pitch (one-line elevator)" hint="If you only had one sentence to sell this idea.">
              <input className={INPUT} value={form.pitch || ''} onChange={e => update({ pitch: e.target.value })} placeholder="See where Mike is editing in real time + their cursor position" />
            </Field>
            <Field label="Problem / Why" hint="What's broken or missing today that this fixes.">
              <textarea className={TEXTAREA} rows={3} value={form.problem || ''} onChange={e => update({ problem: e.target.value })} placeholder="Currently last-write-wins; simultaneous edits silently overwrite. Real collab needs presence." />
            </Field>
            <Field label="User journey" hint="Bullet steps describing the ideal flow.">
              <textarea className={TEXTAREA + ' font-mono text-xs'} rows={4} value={form.user_journey || ''} onChange={e => update({ user_journey: e.target.value })} placeholder={"- Ryan opens canvas\n- Mike opens same canvas\n- Both see cursor + name overlay\n- Edits merge without overwrite"} />
            </Field>
          </Section>

          <Section title="Scope + Audience">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hub / area">
                <select className={INPUT} value={form.hub || ''} onChange={e => update({ hub: e.target.value || null })}>
                  <option value="">(unspecified)</option>
                  {HUB_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              <Field label="Beneficiary">
                <input className={INPUT} value={form.beneficiary || ''} onChange={e => update({ beneficiary: e.target.value })} placeholder="Ryan + Mike / customers / VJ tenant / future LABOS tenants" />
              </Field>
            </div>
            <Field label="Customer request" hint="Specific customer name if requested. Leave blank for internal ideas.">
              <input className={INPUT} value={form.customer_request || ''} onChange={e => update({ customer_request: e.target.value })} placeholder="VJ Thrift Finds / Dane Bundy / etc." />
            </Field>
          </Section>

          <Section title="Sizing + Business">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Effort">
                <select className={INPUT} value={form.effort || 'unknown'} onChange={e => update({ effort: e.target.value })}>
                  {EFFORT_OPTIONS.map(o => <option key={o} value={o}>{EFFORT_META[o].label} — {EFFORT_META[o].desc}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className={INPUT} value={form.priority || 'nice'} onChange={e => update({ priority: e.target.value })}>
                  {PRIORITY_OPTIONS.map(o => <option key={o} value={o}>{PRIORITY_META[o].label}</option>)}
                </select>
              </Field>
              <Field label="Target ship date">
                <input type="date" className={INPUT} value={form.target_ship_date || ''} onChange={e => update({ target_ship_date: e.target.value || null })} />
              </Field>
            </div>
            <Field label="Business impact" hint="Revenue lever / retention / cost saving / brand / internal velocity.">
              <textarea className={TEXTAREA} rows={2} value={form.business_impact || ''} onChange={e => update({ business_impact: e.target.value })} placeholder="Unlocks $X tier / saves Y hrs/week / reduces churn..." />
            </Field>
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input type="checkbox" checked={!!form.requires_platform_changes} onChange={e => update({ requires_platform_changes: e.target.checked })} className="w-4 h-4 accent-brand-blue" />
              Requires platform changes (auth, RLS, edge fns, schema)
            </label>
          </Section>

          <Section title="Workflow + Definition of Done">
            <Field label="Status">
              <select className={INPUT} value={form.status || 'idea'} onChange={e => update({ status: e.target.value })}>
                {STATUS_OPTIONS.map(o => <option key={o} value={o}>{STATUS_META[o].label}</option>)}
              </select>
            </Field>
            <Field label="Files scope (one path per line)">
              <textarea className={TEXTAREA + ' font-mono text-xs'} rows={2} defaultValue={filesScopeText} onChange={e => update({ files_scope: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} placeholder="liftori-admin/src/pages/dev-team/**" />
            </Field>
            <Field label="Dependencies + blockers" hint="What needs to be true before this can ship.">
              <textarea className={TEXTAREA} rows={2} value={form.dependencies || ''} onChange={e => update({ dependencies: e.target.value })} placeholder="Wave G ships first; Y.js library budget approved; etc." />
            </Field>
            <Field label="Success criteria" hint="How we know it worked.">
              <textarea className={TEXTAREA} rows={2} value={form.success_criteria || ''} onChange={e => update({ success_criteria: e.target.value })} placeholder="Two browsers see each other's cursors in <500ms" />
            </Field>
          </Section>

          <Section title="References + Tags">
            <Field label="Reference links (one URL per line)">
              <textarea className={TEXTAREA + ' font-mono text-xs'} rows={3} defaultValue={refLinksText} onChange={e => update({ reference_links: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} placeholder={"https://tiptap.dev/docs/collaboration\nhttps://example.com/inspiration"} />
            </Field>
            <Field label="Tags (comma-separated)">
              <input className={INPUT} defaultValue={tagsText} onChange={e => update({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="collab, polish, deferred-from-E" />
            </Field>
          </Section>

          <Section title="Notes">
            <textarea className={TEXTAREA} rows={3} value={form.notes || ''} onChange={e => update({ notes: e.target.value })} placeholder="Decisions, off-topic context, links to chat threads" />
          </Section>

          {!isNew && (
            <Section title="Activity">
              <div className="text-xs text-white/50 space-y-1">
                <div>Submitted by <span className="text-white/80">{form.submitted_by_name || 'Unknown'}</span> · {form.created_at && relTime(form.created_at)}</div>
                {form.updated_at && form.updated_at !== form.created_at && <div>Last updated {relTime(form.updated_at)}</div>}
                {isConverted && (
                  <div className="text-violet-300 mt-2">
                    ★ Converted to task on {relTime(form.converted_at)}.
                  </div>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span>Interest:</span>
                  <span className="text-white/70">Ryan ★ {form.ryan_interest || 0}</span>
                  <span className="text-white/70">Mike ★ {form.mike_interest || 0}</span>
                  {currentUserKey && (
                    <button
                      onClick={() => onToggleVote(form, currentUserKey)}
                      className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                        myInterest === 1
                          ? 'bg-brand-blue/20 text-brand-blue'
                          : 'bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {myInterest === 1 ? '★ youre in' : 'mark interest'}
                    </button>
                  )}
                </div>
              </div>
            </Section>
          )}
        </div>

        <div className="p-5 border-t border-white/10 flex items-center justify-between sticky bottom-0 bg-navy-900">
          <div className="flex items-center gap-2">
            {!isNew && (
              <button onClick={() => onDelete(form.id)} className="text-sm text-red-400 hover:text-red-300 px-3 py-2">
                Delete
              </button>
            )}
            {!isNew && form.status === 'approved' && !isConverted && (
              <button onClick={() => onPromote(form)} className="px-3 py-2 rounded-lg text-sm bg-violet-500/20 text-violet-300 font-semibold hover:bg-violet-500/30 transition-colors">
                ★ Promote to Task
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5">Cancel</button>
            <button onClick={save} disabled={!form.title?.trim()} className="px-4 py-2 rounded-lg text-sm bg-brand-blue text-navy-950 font-semibold hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed">
              {isNew ? 'Create idea' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DevTeamFeatureIdeas() {
  const { user, profile } = useAuth()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('open') // 'open' = not converted/killed
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterHub, setFilterHub] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)

  // Map current user to ryan/mike key for vote tracking
  const RYAN_UID = '3f178841-4ea5-476a-b67e-6a1fc9fe9284'
  const MIKE_UID = '931a5a75-6ee4-4db2-b22c-b48d8d14be21'
  const currentUserKey = user?.id === RYAN_UID ? 'ryan' : user?.id === MIKE_UID ? 'mike' : null

  async function fetchAll() {
    const { data, error } = await supabase
      .from('dev_team_feature_ideas')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setIdeas(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const ch = supabase
      .channel('dev_team_feature_ideas_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dev_team_feature_ideas' }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ideas
      .filter(i => {
        if (filterStatus === 'open') {
          if (i.status === 'converted' || i.status === 'killed') return false
        } else if (filterStatus !== 'all' && i.status !== filterStatus) return false
        if (filterPriority !== 'all' && i.priority !== filterPriority) return false
        if (filterHub !== 'all' && i.hub !== filterHub) return false
        if (q) {
          const hay = `${i.title} ${i.pitch || ''} ${i.problem || ''} ${(i.tags || []).join(' ')} ${i.beneficiary || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) =>
        (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) ||
        (STATUS_RANK[a.status] - STATUS_RANK[b.status]) ||
        (new Date(b.created_at) - new Date(a.created_at))
      )
  }, [ideas, filterStatus, filterPriority, filterHub, search])

  function openNew() {
    setEditing({
      status: 'idea', priority: 'nice', effort: 'unknown',
      requires_platform_changes: false,
      ryan_interest: 0, mike_interest: 0,
      reference_links: [], files_scope: [], tags: [],
    })
  }

  async function saveIdea(form) {
    const authorName = profile?.full_name || user?.email || 'Unknown'
    const payload = {
      title: form.title.trim(),
      pitch: form.pitch?.trim() || null,
      problem: form.problem?.trim() || null,
      user_journey: form.user_journey?.trim() || null,
      hub: form.hub || null,
      beneficiary: form.beneficiary?.trim() || null,
      customer_request: form.customer_request?.trim() || null,
      effort: form.effort || 'unknown',
      priority: form.priority || 'nice',
      business_impact: form.business_impact?.trim() || null,
      target_ship_date: form.target_ship_date || null,
      requires_platform_changes: !!form.requires_platform_changes,
      status: form.status || 'idea',
      files_scope: form.files_scope || [],
      dependencies: form.dependencies?.trim() || null,
      success_criteria: form.success_criteria?.trim() || null,
      reference_links: form.reference_links || [],
      tags: form.tags || [],
      notes: form.notes?.trim() || null,
    }
    if (form.id) {
      await supabase.from('dev_team_feature_ideas').update(payload).eq('id', form.id)
    } else {
      await supabase.from('dev_team_feature_ideas').insert({
        ...payload,
        submitted_by: user.id,
        submitted_by_name: authorName,
      })
    }
    setEditing(null)
    fetchAll()
  }

  async function deleteIdea(id) {
    if (!window.confirm('Delete this idea? This cannot be undone.')) return
    await supabase.from('dev_team_feature_ideas').delete().eq('id', id)
    setEditing(null)
    fetchAll()
  }

  async function toggleVote(form, key) {
    const col = key === 'ryan' ? 'ryan_interest' : 'mike_interest'
    const next = (key === 'ryan' ? form.ryan_interest : form.mike_interest) === 1 ? 0 : 1
    await supabase.from('dev_team_feature_ideas').update({ [col]: next }).eq('id', form.id)
    // optimistic local update
    setEditing(prev => prev ? { ...prev, [col]: next } : prev)
    fetchAll()
  }

  async function promoteToTask(form) {
    if (!window.confirm(`Promote "${form.title}" to a real task on the kanban board?`)) return
    const taskPriority = form.priority === 'must' ? 'urgent'
                       : form.priority === 'should' ? 'high'
                       : form.priority === 'nice' ? 'medium'
                       : 'low'
    const description = [form.pitch, form.problem].filter(Boolean).join('\n\n')
    const noteParts = [
      `Promoted from feature idea ${form.id}.`,
      form.dependencies ? `Dependencies: ${form.dependencies}` : null,
    ].filter(Boolean)
    const { data: newTask, error: taskErr } = await supabase
      .from('dev_team_tasks')
      .insert({
        title: form.title,
        description: description || null,
        files_scope: form.files_scope || [],
        priority: taskPriority,
        status: 'queued',
        wave: 'from-idea',
        approach: form.user_journey || null,
        acceptance_criteria: form.success_criteria || null,
        reference_links: form.reference_links || [],
        business_impact: form.business_impact || null,
        notes: noteParts.join('\n\n'),
        created_by: user.id,
      })
      .select()
      .single()
    if (taskErr) { window.alert('Task creation failed: ' + taskErr.message); return }
    await supabase.from('dev_team_feature_ideas').update({
      status: 'converted',
      converted_task_id: newTask.id,
      converted_at: new Date().toISOString(),
    }).eq('id', form.id)
    setEditing(null)
    fetchAll()
    window.alert(`Promoted. Task created and visible on the kanban board (Shared / Unassigned lane).`)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-white/80">
        <strong className="text-white">Feature Ideas</strong> is the intake before anything becomes a task. Capture concepts here, refine, decide, then promote approved ideas onto the kanban board.
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue/50 w-56"
            placeholder="Search title / pitch / tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className={INPUT + ' w-auto'} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="open">Open (not killed/converted)</option>
            <option value="all">All</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select className={INPUT + ' w-auto'} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">All priorities</option>
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
          <select className={INPUT + ' w-auto'} value={filterHub} onChange={e => setFilterHub(e.target.value)}>
            <option value="all">All hubs</option>
            {HUB_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 rounded-lg bg-brand-blue text-navy-950 font-semibold text-sm hover:bg-brand-blue/90 transition-colors"
        >
          + New Idea
        </button>
      </div>

      <div className="text-xs text-white/40">
        {loading ? 'Loading…' : `${visible.length} of ${ideas.length} ideas`}
      </div>

      {!loading && visible.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-12 text-center">
          <div className="text-white/60 text-sm">No ideas match the current filters.</div>
          <div className="text-white/40 text-xs mt-1">Hit "+ New Idea" to capture the first one.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map(i => (
            <IdeaCard
              key={i.id}
              idea={i}
              onClick={() => setEditing({ ...i })}
              currentUserKey={currentUserKey}
            />
          ))}
        </div>
      )}

      {editing && (
        <IdeaModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={saveIdea}
          onDelete={deleteIdea}
          onPromote={promoteToTask}
          onToggleVote={toggleVote}
          currentUserKey={currentUserKey}
        />
      )}
    </div>
  )
}
