import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HubPage, StatCard, EmptyState, useCrmClient } from '../_shared'
import { toast } from 'sonner'

// Roofing Production board. Reads the tenant's JOB pipeline deals
// (customer_pipeline) and tracks each through the physical roofing lifecycle
// on customer_pipeline.production_stage. Cards open the full job window
// (CrmDealDetail at /crm/:platformId/deals/:id) - same record sales/jobs use.

const STAGES = [
  { key: 'scheduled',          label: 'Scheduled',          tone: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
  { key: 'material_delivered', label: 'Material Delivered', tone: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  { key: 'tear_off',           label: 'Tear-Off',           tone: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { key: 'dry_in',             label: 'Dry-In',             tone: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  { key: 'complete',           label: 'Complete',           tone: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  { key: 'inspected',          label: 'Inspected',          tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
]
const STAGE_KEYS = STAGES.map((s) => s.key)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null

export default function OperationsProduction() {
  const { client } = useCrmClient()
  const navigate = useNavigate()
  const { platformId } = useParams()
  const openJob = (id) => navigate('/crm/' + platformId + '/deals/' + id)

  const [jobs, setJobs] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client])

  async function load() {
    try {
      setLoading(true)
      const { data: defs } = await client.from('pipeline_definitions').select('*').eq('is_active', true).order('display_order')
      const list = defs || []
      const jobPipe = list.find(d => /job|operation|production|install/i.test(d.name || '')) ||
                      list.find(d => !d.is_default) || list[0] || null
      let dealQ = client.from('customer_pipeline').select('*').order('install_date', { ascending: true, nullsFirst: false }).limit(500)
      if (jobPipe) dealQ = dealQ.eq('pipeline_definition_id', jobPipe.id)
      const [dealRes, conRes] = await Promise.all([
        dealQ,
        client.from('customer_contacts').select('id, first_name, last_name').limit(1000),
      ])
      setJobs(dealRes?.data || [])
      setContacts(conRes?.data || [])
    } catch (e) {
      console.error('production load failed', e)
      toast.error('Failed to load production board')
    } finally {
      setLoading(false)
    }
  }

  const conById = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, ((c.first_name || '') + ' ' + (c.last_name || '')).trim()])), [contacts])

  const stageOf = (j) => STAGE_KEYS.includes(j.production_stage) ? j.production_stage : 'scheduled'
  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGE_KEYS.map((k) => [k, []]))
    for (const j of jobs) m[stageOf(j)].push(j)
    return m
  }, [jobs])

  const stats = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter((j) => ['material_delivered', 'tear_off', 'dry_in'].includes(stageOf(j))).length,
    complete: byStage.complete.length,
    inspected: byStage.inspected.length,
  }), [jobs, byStage])

  async function moveJob(job, stage) {
    if (stage === stageOf(job)) return
    const prev = job.production_stage
    setJobs((arr) => arr.map((j) => (j.id === job.id ? { ...j, production_stage: stage } : j)))
    try {
      const { error } = await client.from('customer_pipeline').update({ production_stage: stage, updated_at: new Date().toISOString() }).eq('id', job.id)
      if (error) throw error
    } catch (e) {
      console.error(e); toast.error('Could not move job')
      setJobs((arr) => arr.map((j) => (j.id === job.id ? { ...j, production_stage: prev } : j)))
    }
  }

  return (
    <HubPage title="Production Board" subtitle="Every roofing job from scheduled through final inspection. Click a job to open it.">
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Jobs in Production" value={stats.total} />
            <StatCard label="Active on Roof" value={stats.active} accent="text-amber-400" hint="material, tear-off, dry-in" />
            <StatCard label="Complete" value={stats.complete} accent="text-blue-400" hint="awaiting inspection" />
            <StatCard label="Inspected" value={stats.inspected} accent="text-emerald-400" />
          </div>

          {jobs.length === 0 ? (
            <EmptyState title="No jobs in production" description="Jobs appear here once they're on the job board. Create one from the Jobs tab or win a deal in Sales." />
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-4 min-w-max">
                {STAGES.map((stage) => {
                  const list = byStage[stage.key]
                  return (
                    <div key={stage.key} className="w-72 shrink-0">
                      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-t border-x ${stage.tone}`}>
                        <span className="text-xs uppercase tracking-wider font-bold">{stage.label}</span>
                        <span className="text-xs font-bold">{list.length}</span>
                      </div>
                      <div className="bg-navy-800/40 border-x border-b border-navy-700/50 rounded-b-lg p-2 space-y-2 min-h-[120px]">
                        {list.length === 0 && <div className="text-center text-gray-600 text-xs py-6">No jobs</div>}
                        {list.map((job) => {
                          const sched = fmtDate(job.install_date)
                          return (
                            <div
                              key={job.id}
                              onClick={() => openJob(job.id)}
                              className="bg-navy-800 border border-navy-700/50 hover:border-brand-cyan/50 rounded-lg p-3 cursor-pointer transition-colors"
                            >
                              <div className="text-white text-sm font-medium leading-tight">{job.title || '(untitled job)'}</div>
                              {conById[job.contact_id] && <div className="text-xs text-gray-400 mt-1">{conById[job.contact_id]}</div>}
                              {job.job_address && <div className="text-[11px] text-gray-500 truncate">{job.job_address}</div>}
                              <div className="flex items-center gap-2 mt-1.5">
                                {sched && <span className="text-[11px] text-sky-300">Install {sched}</span>}
                                {job.crew_name && <span className="text-[11px] text-gray-400">{job.crew_name}</span>}
                              </div>
                              <select
                                value={stageOf(job)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { e.stopPropagation(); moveJob(job, e.target.value) }}
                                className="mt-2 w-full bg-navy-900 border border-navy-700 text-gray-200 rounded px-2 py-1 text-xs"
                              >
                                {STAGES.map((s) => <option key={s.key} value={s.key}>Move to: {s.label}</option>)}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </HubPage>
  )
}
