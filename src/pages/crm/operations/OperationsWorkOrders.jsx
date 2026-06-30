import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from '../_shared'

// =====================================================================
// Operations > Jobs
// A "job" is a deal on the tenant's JOB pipeline (customer_pipeline).
// Same record the sales pipeline opens — clicking a job opens the full
// deal/job window (CrmDealDetail at /crm/:platformId/deals/:id), so a
// deal flows sale -> job with one source of truth (no work-order copy).
// =====================================================================

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'

const DEFAULT_JOB_STAGES = [
  { key: 'scheduled',   label: 'Scheduled',   color: '#0ea5e9', stage_order: 1 },
  { key: 'in_progress', label: 'In Progress', color: '#22d3ee', stage_order: 2 },
  { key: 'on_hold',     label: 'On Hold',     color: '#a855f7', stage_order: 3 },
  { key: 'completed',   label: 'Completed',   color: '#10b981', stage_order: 4, is_won: true },
]

function StageBadge({ stage }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-200">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage?.color || '#64748b' }} />
      {stage?.label || stage?.key || 'Unassigned'}
    </span>
  )
}

export default function OperationsWorkOrders() {
  const { client } = useCrmClient()
  const navigate = useNavigate()
  const { platformId } = useParams()
  const openJob = (id) => navigate('/crm/' + platformId + '/deals/' + id)

  const [pipeline, setPipeline] = useState(null)
  const [stages, setStages] = useState(DEFAULT_JOB_STAGES)
  const [jobs, setJobs] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState('kanban')
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)

  async function loadAll() {
    if (!client) return
    setLoading(true)
    try {
      const { data: defs } = await client.from('pipeline_definitions').select('*').eq('is_active', true).order('display_order')
      const list = defs || []
      const jobPipe = list.find(d => /job|operation|production|install/i.test(d.name || '')) ||
                      list.find(d => !d.is_default) || list[0] || null
      setPipeline(jobPipe)

      let stageRows = []
      if (jobPipe) {
        const { data: sd } = await client.from('pipeline_stage_definitions').select('*').eq('pipeline_id', jobPipe.id).order('stage_order')
        stageRows = sd || []
      }
      setStages(stageRows.length ? stageRows : DEFAULT_JOB_STAGES)

      let dealQ = client.from('customer_pipeline').select('*').order('updated_at', { ascending: false }).limit(500)
      if (jobPipe) dealQ = dealQ.eq('pipeline_definition_id', jobPipe.id)
      const [dealRes, ctRes] = await Promise.all([
        dealQ,
        client.from('customer_contacts').select('id,first_name,last_name,email,phone').limit(1000),
      ])
      setJobs(dealRes.data || [])
      setContacts(ctRes.data || [])
    } catch (e) {
      console.error('[Jobs] load', e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadAll() }, [client])

  const contactById = useMemo(() => {
    const m = {}; contacts.forEach(c => { m[c.id] = c }); return m
  }, [contacts])
  function contactName(id) {
    const c = contactById[id]
    if (!c) return '-'
    return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '-'
  }
  const stageByKey = useMemo(() => {
    const m = {}; stages.forEach(s => { m[s.key] = s }); return m
  }, [stages])

  const filtered = useMemo(() => {
    let list = jobs
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(j =>
        (j.title || '').toLowerCase().includes(q) ||
        (j.job_address || '').toLowerCase().includes(q) ||
        contactName(j.contact_id).toLowerCase().includes(q)
      )
    }
    return list
  }, [jobs, search, contactById])

  const byStage = useMemo(() => {
    const m = {}; stages.forEach(s => { m[s.key] = [] })
    filtered.forEach(j => { (m[j.stage] = m[j.stage] || []).push(j) })
    return m
  }, [filtered, stages])

  const stats = useMemo(() => {
    const wonKeys = new Set(stages.filter(s => s.is_won).map(s => s.key))
    const lostKeys = new Set(stages.filter(s => s.is_lost).map(s => s.key))
    const open = jobs.filter(j => !wonKeys.has(j.stage) && !lostKeys.has(j.stage))
    const now = new Date(); const wk = new Date(now); wk.setDate(now.getDate() - now.getDay()); wk.setHours(0, 0, 0, 0)
    const installsWeek = jobs.filter(j => j.install_date && new Date(j.install_date) >= wk).length
    const pipelineValue = open.reduce((s, j) => s + Number(j.deal_value || 0), 0)
    return { open: open.length, installsWeek, completed: jobs.filter(j => wonKeys.has(j.stage)).length, pipelineValue }
  }, [jobs, stages])

  return (
    <HubPage
      title="Jobs"
      subtitle="Every job on the production board — click one to open the full job."
      actions={
        <button onClick={() => setNewOpen(true)} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm font-medium px-4 py-2 rounded-lg">
          New Job
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Open Jobs" value={stats.open} accent="text-brand-cyan" />
        <StatCard label="Installs This Week" value={stats.installsWeek} accent="text-sky-300" />
        <StatCard label="Completed" value={stats.completed} accent="text-emerald-400" />
        <StatCard label="Open Value" value={fmtMoney(stats.pipelineValue)} accent="text-amber-300" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search jobs, customers, addresses..."
          className="w-full sm:w-80 bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
        />
        <div className="flex items-center gap-1 bg-navy-800 border border-navy-700/60 rounded-lg p-1">
          <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${view === 'kanban' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>Board</button>
          <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${view === 'table' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>Table</button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading jobs...</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No jobs yet" description="Create the first job, or win a deal in the sales pipeline to move it here." />
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {stages.map(s => (
            <div key={s.key} className="bg-navy-900/60 border border-navy-700/50 rounded-xl overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-navy-700/50 flex items-center justify-between">
                <StageBadge stage={s} />
                <span className="text-xs text-gray-500">{byStage[s.key]?.length || 0}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[640px] overflow-y-auto">
                {(byStage[s.key] || []).map(j => (
                  <button key={j.id} onClick={() => openJob(j.id)} className="w-full text-left bg-navy-800 border border-navy-700/50 hover:border-brand-cyan/50 rounded-lg p-3 transition-colors">
                    <div className="text-sm text-white font-medium line-clamp-2 mb-1">{j.title || '(untitled job)'}</div>
                    <div className="text-xs text-gray-400 mb-1">{contactName(j.contact_id)}</div>
                    {j.job_address && <div className="text-[11px] text-gray-500 line-clamp-1 mb-1">{j.job_address}</div>}
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{fmtMoney(j.deal_value)}</span>
                      {j.install_date && <span className="text-sky-300">Install {fmtDate(j.install_date)}</span>}
                    </div>
                  </button>
                ))}
                {(byStage[s.key] || []).length === 0 && <div className="text-xs text-gray-600 text-center py-6">No jobs</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-900/60 border-b border-navy-700/50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Job</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Address</th>
                  <th className="px-4 py-2.5">Stage</th>
                  <th className="px-4 py-2.5">Install</th>
                  <th className="px-4 py-2.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/50">
                {filtered.map(j => (
                  <tr key={j.id} onClick={() => openJob(j.id)} className="hover:bg-navy-900/40 cursor-pointer">
                    <td className="px-4 py-2.5 text-white">{j.title || '(untitled job)'}</td>
                    <td className="px-4 py-2.5 text-gray-300">{contactName(j.contact_id)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{j.job_address || '-'}</td>
                    <td className="px-4 py-2.5"><StageBadge stage={stageByKey[j.stage]} /></td>
                    <td className="px-4 py-2.5 text-xs text-gray-300">{fmtDate(j.install_date)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{fmtMoney(j.deal_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {newOpen && (
        <NewJobModal
          client={client}
          contacts={contacts}
          stages={stages}
          pipelineId={pipeline?.id || null}
          onClose={() => setNewOpen(false)}
          onCreated={(id) => { setNewOpen(false); if (id) openJob(id); else loadAll() }}
        />
      )}
    </HubPage>
  )
}

function NewJobModal({ client, contacts, stages, pipelineId, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [contactId, setContactId] = useState('')
  const [stage, setStage] = useState(stages[0]?.key || 'scheduled')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) { setErr('Job title is required'); return }
    setSaving(true); setErr('')
    try {
      const row = { title: title.trim(), contact_id: contactId || null, stage }
      if (pipelineId) row.pipeline_definition_id = pipelineId
      const { data, error } = await client.from('customer_pipeline').insert(row).select('id').single()
      if (error) throw error
      onCreated(data?.id || null)
    } catch (e2) {
      setErr(e2?.message || 'Could not create job')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={save} className="w-full max-w-md bg-navy-900 border border-navy-700 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">New Job</h2>
        {err && <div className="px-3 py-2 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">{err}</div>}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Job title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. Roof replacement - 123 Main St" autoFocus />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Customer</label>
          <select value={contactId} onChange={e => setContactId(e.target.value)} className="w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">- None -</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id.slice(0, 8)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Stage</label>
          <select value={stage} onChange={e => setStage(e.target.value)} className="w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white">
            {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {saving ? 'Creating...' : 'Create job'}
          </button>
        </div>
      </form>
    </div>
  )
}
