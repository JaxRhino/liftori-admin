// =====================================================================
// CrmDashboard - service business daily command center
// Wave B.3: replaces VJ retail tables (products/orders/email_subscribers)
// with generic service-business tables (customer_pipeline / sales_leads /
// customer_estimates / ops_schedule / ops_work_orders / ops_crews /
// finance_invoices / finance_payments / customer_contacts).
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from './_shared'
import { useCrm } from '../../contexts/CrmContext'

// ---------- formatters ----------
const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtCents = (c) =>
  ((Number(c) || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const prettyStatus = (st) => (st || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function fmtDate(d) {
  if (!d) return '-'
  const date = new Date(d)
  const opts = { month: 'short', day: 'numeric' }
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return date.toLocaleDateString('en-US', opts)
}

function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtRange(start, end) {
  if (!start) return ''
  const s = fmtTime(start)
  if (!end) return s
  return `${s} - ${fmtTime(end)}`
}

function relTime(d) {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ---------- pipeline stages ----------
const PIPELINE_STAGES = [
  { key: 'new', label: 'New', color: 'text-gray-300' },
  { key: 'qualified', label: 'Qualified', color: 'text-sky-300' },
  { key: 'proposal', label: 'Proposal', color: 'text-brand-cyan' },
  { key: 'negotiation', label: 'Negotiation', color: 'text-amber-300' },
  { key: 'won', label: 'Won', color: 'text-emerald-300' },
  { key: 'lost', label: 'Lost', color: 'text-rose-300' },
]

// ---------- skeleton stat card ----------
function StatSkeleton() {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 animate-pulse">
      <div className="h-3 w-24 bg-navy-700/70 rounded mb-3" />
      <div className="h-6 w-20 bg-navy-700/70 rounded" />
    </div>
  )
}

// ---------- priority badge ----------
function PriorityBadge({ priority }) {
  const map = {
    urgent: 'bg-rose-500/20 text-rose-300',
    high: 'bg-amber-500/20 text-amber-300',
    medium: 'bg-sky-500/20 text-sky-300',
    low: 'bg-navy-700/60 text-gray-400',
  }
  if (!priority) return null
  return (
    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${map[priority] || 'bg-navy-700/60 text-gray-300'}`}>
      {priority}
    </span>
  )
}

// ---------- event type badge ----------
function EventTypeBadge({ type }) {
  if (!type) return null
  const map = {
    job: 'bg-brand-cyan/20 text-brand-cyan',
    estimate: 'bg-amber-500/20 text-amber-300',
    inspection: 'bg-sky-500/20 text-sky-300',
    delivery: 'bg-emerald-500/20 text-emerald-300',
    meeting: 'bg-purple-500/20 text-purple-300',
  }
  return (
    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${map[type] || 'bg-navy-700/60 text-gray-300'}`}>
      {type}
    </span>
  )
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================
const DASH_PERIODS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'all', label: 'All time' },
]
function dashPeriodStartISO(key) {
  const now = new Date()
  if (key === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (key === 'ytd') { return new Date(now.getFullYear(), 0, 1).toISOString() }
  if (key === 'all') { return new Date(0).toISOString() }
  const days = key === '7d' ? 7 : key === '90d' ? 90 : 30
  return new Date(Date.now() - days * 86400000).toISOString()
}

export default function CrmDashboard() {
  const { client, platform } = useCrm()
  const { orgSettings } = useCrmClient()
  const platformId = platform?.id

  // ---- state ----
  const [pipeline, setPipeline] = useState([])
  const [period, setPeriod] = useState('30d')
  const periodStart = useMemo(() => dashPeriodStartISO(period), [period])
  const periodLabel = (DASH_PERIODS.find((p) => p.key === period) || {}).label || ''

  const [leads, setLeads] = useState([])
  const [estimates, setEstimates] = useState([])
  const [schedule, setSchedule] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [crews, setCrews] = useState([])
  const [contacts, setContacts] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [jobActivity, setJobActivity] = useState([])

  const [loading, setLoading] = useState({
    pipeline: true,
    leads: true,
    estimates: true,
    schedule: true,
    workOrders: true,
    crews: true,
    contacts: true,
    invoices: true,
    payments: true,
    jobActivity: true,
  })

  // ---- loader ----
  useEffect(() => {
    if (!client) return
    let cancelled = false

    async function runQuery(table, q, setter, key) {
      try {
        const { data, error } = await q
        if (error) throw error
        if (!cancelled) setter(data || [])
      } catch (e) {
        console.error(`[CrmDashboard] ${table}`, e)
        if (!cancelled) setter([])
      } finally {
        if (!cancelled) setLoading((s) => ({ ...s, [key]: false }))
      }
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)

    Promise.all([
      runQuery(
        'customer_pipeline',
        client.from('customer_pipeline').select('id,title,stage,deal_value,probability,expected_close_date,won_date,service_type,contact_id,created_at').limit(500),
        setPipeline,
        'pipeline'
      ),
      runQuery(
        'sales_leads',
        client.from('sales_leads').select('id,title,contact_name,source,deal_value_cents,stage,created_at').gte('created_at', periodStart).order('created_at', { ascending: false }).limit(50),
        setLeads,
        'leads'
      ),
      runQuery(
        'customer_estimates',
        client.from('customer_estimates').select('id,status,esign_status,total,created_at').limit(200),
        setEstimates,
        'estimates'
      ),
      runQuery(
        'ops_schedule',
        client.from('ops_schedule').select('id,title,event_type,start_time,end_time,address,crew_id,status').gte('start_time', todayStart.toISOString()).lt('start_time', todayEnd.toISOString()).order('start_time', { ascending: true }).limit(20),
        setSchedule,
        'schedule'
      ),
      runQuery(
        'ops_work_orders',
        client.from('ops_work_orders').select('id,title,work_order_number,status,priority,scheduled_start,contact_id').not('status', 'in', '("completed","cancelled")').order('scheduled_start', { ascending: true, nullsFirst: false }).limit(50),
        setWorkOrders,
        'workOrders'
      ),
      runQuery(
        'ops_crews',
        client.from('ops_crews').select('id,name').limit(100),
        setCrews,
        'crews'
      ),
      runQuery(
        'customer_contacts',
        client.from('customer_contacts').select('id,first_name,last_name,email').limit(500),
        setContacts,
        'contacts'
      ),
      runQuery(
        'finance_invoices',
        client.from('finance_invoices').select('id,invoice_number,customer_name,total_amount,balance_due,due_date,status').not('status', 'in', '("paid","void")').limit(500),
        setInvoices,
        'invoices'
      ),
      runQuery(
        'finance_payments',
        client.from('finance_payments').select('id,amount,payment_date,status').gte('payment_date', periodStart.slice(0, 10)).limit(500),
        setPayments,
        'payments'
      ),
      runQuery(
        'ops_job_activity',
        client.from('ops_job_activity').select('id,work_order_id,work_order_number,title,from_status,to_status,note,created_at').order('created_at', { ascending: false }).limit(12),
        setJobActivity,
        'jobActivity'
      ),
    ])

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, period])

  // ---- lookups ----
  const contactById = useMemo(() => {
    const m = new Map()
    for (const c of contacts) m.set(c.id, c)
    return m
  }, [contacts])
  const crewById = useMemo(() => {
    const m = new Map()
    for (const c of crews) m.set(c.id, c)
    return m
  }, [crews])

  function contactName(id) {
    const c = contactById.get(id)
    if (!c) return '-'
    return `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || '-'
  }
  function crewName(id) {
    const c = crewById.get(id)
    return c ? c.name : '-'
  }

  // ---- stats ----
  const stats = useMemo(() => {
    const pipelineValue = pipeline
      .filter((d) => !['won', 'lost'].includes(d.stage))
      .reduce((s, d) => s + Number(d.deal_value || 0), 0)

    const newLeads7d = leads.length

    const estimatesPending = estimates.filter(
      (e) => ['sent', 'draft'].includes(e.status) && e.esign_status !== 'signed'
    ).length

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const mtdWon = pipeline
      .filter((d) => d.stage === 'won' && d.won_date && new Date(d.won_date) >= monthStart)
      .reduce((s, d) => s + Number(d.deal_value || 0), 0)

    const jobsToday = schedule.length

    const openWO = workOrders.length

    const arOutstanding = invoices.reduce((s, i) => s + Number(i.balance_due || 0), 0)

    const revenue30d = payments
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + Number(p.amount || 0), 0)

    return { pipelineValue, newLeads7d, estimatesPending, mtdWon, jobsToday, openWO, arOutstanding, revenue30d }
  }, [pipeline, leads, estimates, schedule, workOrders, invoices, payments])

  // ---- pipeline by stage ----
  const pipelineByStage = useMemo(() => {
    const map = {}
    for (const s of PIPELINE_STAGES) map[s.key] = { count: 0, total: 0 }
    for (const d of pipeline) {
      const k = map[d.stage] ? d.stage : 'new'
      map[k].count += 1
      map[k].total += Number(d.deal_value || 0)
    }
    return map
  }, [pipeline])

  // ---- AR aging buckets ----
  const arAging = useMemo(() => {
    const buckets = {
      current: { count: 0, total: 0, label: 'Current' },
      '1-30': { count: 0, total: 0, label: '1-30 days' },
      '31-60': { count: 0, total: 0, label: '31-60 days' },
      '60+': { count: 0, total: 0, label: '60+ days' },
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (const inv of invoices) {
      const bal = Number(inv.balance_due || 0)
      if (bal <= 0) continue
      if (!inv.due_date) {
        buckets.current.count += 1
        buckets.current.total += bal
        continue
      }
      const due = new Date(inv.due_date)
      const days = Math.floor((today - due) / 86400000)
      let bucket
      if (days <= 0) bucket = 'current'
      else if (days <= 30) bucket = '1-30'
      else if (days <= 60) bucket = '31-60'
      else bucket = '60+'
      buckets[bucket].count += 1
      buckets[bucket].total += bal
    }
    return buckets
  }, [invoices])

  const arTotalForBar = useMemo(() => {
    return Object.values(arAging).reduce((s, b) => s + b.total, 0)
  }, [arAging])

  // ---- recent leads (top 5) ----
  const recentLeads = useMemo(() => leads.slice(0, 5), [leads])

  // ---- top 5 jobs ----
  const topWO = useMemo(() => workOrders.slice(0, 5), [workOrders])

  // ---- top 8 schedule ----
  const todayList = useMemo(() => schedule.slice(0, 8), [schedule])
  const todayExtra = Math.max(0, schedule.length - 8)

  // ---- header subtitle ----
  const clientName = platform?.clientName || orgSettings?.business_name || 'your business'
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const linkBase = `/crm/${platformId}`

  return (
    <HubPage title="Dashboard" actions={<select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-navy-800 border border-navy-700/60 rounded-lg px-3 py-1.5 text-sm text-white">{DASH_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>} subtitle={`${clientName} at a glance`}>
      {/* ===== row 1 + row 2 stat cards ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {loading.pipeline ? <StatSkeleton /> : (
          <StatCard label="Pipeline Value" value={fmtMoney(stats.pipelineValue)} accent="text-brand-cyan" hint="open deals" />
        )}
        {loading.leads ? <StatSkeleton /> : (
          <StatCard label={`New Leads (${periodLabel})`} value={stats.newLeads7d} accent="text-brand-blue" />
        )}
        {loading.estimates ? <StatSkeleton /> : (
          <StatCard label="Estimates Pending" value={stats.estimatesPending} accent="text-amber-400" hint="sent or draft, unsigned" />
        )}
        {loading.pipeline ? <StatSkeleton /> : (
          <StatCard label="MTD Won" value={fmtMoney(stats.mtdWon)} accent="text-emerald-400" />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {loading.schedule ? <StatSkeleton /> : (
          <StatCard label="Jobs Today" value={stats.jobsToday} accent="text-brand-cyan" />
        )}
        {loading.workOrders ? <StatSkeleton /> : (
          <StatCard label="Open Jobs" value={stats.openWO} accent="text-brand-blue" />
        )}
        {loading.invoices ? <StatSkeleton /> : (
          <StatCard
            label="AR Outstanding"
            value={fmtMoney(stats.arOutstanding)}
            accent={stats.arOutstanding > 0 ? 'text-amber-400' : 'text-white'}
            hint={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`}
          />
        )}
        {loading.payments ? <StatSkeleton /> : (
          <StatCard label={`Revenue (${periodLabel})`} value={fmtMoney(stats.revenue30d)} accent="text-emerald-400" />
        )}
      </div>

      {/* ===== middle: today's schedule + pipeline by stage ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3">
          <Section
            title={`Today - ${todayLabel}`}
            right={
              <Link to={`${linkBase}/operations/schedule`} className="text-xs text-brand-cyan hover:underline">
                View Schedule -&gt;
              </Link>
            }
          >
            {loading.schedule ? (
              <div className="p-6 text-sm text-gray-500">Loading schedule...</div>
            ) : todayList.length === 0 ? (
              <EmptyState
                title="No events scheduled today"
                description="Lock in your first job, estimate visit, or inspection on the schedule."
                cta={
                  <Link
                    to={`${linkBase}/operations/schedule`}
                    className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium inline-block"
                  >
                    Open Schedule
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-navy-700/50">
                {todayList.map((ev) => (
                  <li key={ev.id} className="px-5 py-3 flex items-start gap-3 hover:bg-navy-700/20">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-sm text-white font-medium">{fmtTime(ev.start_time)}</div>
                      <div className="text-[11px] text-gray-500">{fmtRange(ev.start_time, ev.end_time).split(' - ')[1] || ''}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-white font-medium truncate">{ev.title || '(untitled)'}</span>
                        <EventTypeBadge type={ev.event_type} />
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                        {ev.crew_id && <span>{crewName(ev.crew_id)}</span>}
                        {ev.address && <span className="truncate max-w-[280px]">{ev.address}</span>}
                      </div>
                    </div>
                  </li>
                ))}
                {todayExtra > 0 && (
                  <li className="px-5 py-2 text-center">
                    <Link to={`${linkBase}/operations/schedule`} className="text-xs text-brand-cyan hover:underline">
                      + {todayExtra} more event{todayExtra === 1 ? '' : 's'}
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </Section>
        </div>

        <div className="lg:col-span-2">
          <Section title="Pipeline by Stage">
            {loading.pipeline ? (
              <div className="p-6 text-sm text-gray-500">Loading pipeline...</div>
            ) : pipeline.length === 0 ? (
              <EmptyState
                title="No deals yet"
                description="Drop in your first deal to start tracking conversion."
                cta={
                  <Link to={`${linkBase}/sales`} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium inline-block">
                    Open Sales
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-navy-700/50">
                {PIPELINE_STAGES.map((s) => {
                  const row = pipelineByStage[s.key] || { count: 0, total: 0 }
                  return (
                    <li key={s.key}>
                      <Link
                        to={`${linkBase}/sales?stage=${s.key}`}
                        className="px-5 py-3 flex items-center justify-between hover:bg-navy-700/20"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${s.color}`}>{s.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy-700/60 text-gray-300">{row.count}</span>
                        </div>
                        <span className="text-sm text-white">{fmtMoney(row.total)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {/* ===== bottom: recent leads + jobs + AR aging ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Leads */}
        <Section
          title="Recent Leads"
          right={
            <Link to={`${linkBase}/sales`} className="text-xs text-brand-cyan hover:underline">
              View all
            </Link>
          }
        >
          {loading.leads ? (
            <div className="p-6 text-sm text-gray-500">Loading leads...</div>
          ) : recentLeads.length === 0 ? (
            <EmptyState
              title="No new leads this week"
              description="When inbound leads come in, they show up here first."
            />
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {recentLeads.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`${linkBase}/sales?lead=${l.id}`}
                    className="px-5 py-3 flex items-start justify-between hover:bg-navy-700/20"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{l.contact_name || l.title || '(unnamed lead)'}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        {l.source && (
                          <span className="px-1.5 py-0.5 rounded bg-navy-700/60">{l.source}</span>
                        )}
                        <span>{relTime(l.created_at)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-brand-cyan whitespace-nowrap ml-2">{fmtCents(l.deal_value_cents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Open Jobs */}
        <Section
          title="Open Jobs"
          right={
            <Link to={`${linkBase}/operations/work-orders`} className="text-xs text-brand-cyan hover:underline">
              View all
            </Link>
          }
        >
          {loading.workOrders ? (
            <div className="p-6 text-sm text-gray-500">Loading jobs...</div>
          ) : topWO.length === 0 ? (
            <EmptyState
              title="No open jobs"
              description="Open jobs show up here for quick triage."
            />
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {topWO.map((wo) => (
                <li key={wo.id}>
                  <Link
                    to={`${linkBase}/operations/work-orders?id=${wo.id}`}
                    className="px-5 py-3 flex items-start justify-between hover:bg-navy-700/20"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">
                        <span className="text-gray-500 text-[11px] mr-1">{wo.work_order_number || ''}</span>
                        {wo.title || '(untitled)'}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="truncate">{contactName(wo.contact_id)}</span>
                        <PriorityBadge priority={wo.priority} />
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap ml-2">
                      {wo.scheduled_start ? fmtDate(wo.scheduled_start) : '-'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* AR Aging */}
        <Section
          title="AR Aging"
          right={
            <Link to={`${linkBase}/finance`} className="text-xs text-brand-cyan hover:underline">
              View invoices
            </Link>
          }
        >
          {loading.invoices ? (
            <div className="p-6 text-sm text-gray-500">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <EmptyState
              title="No outstanding invoices"
              description="Once you have unpaid invoices, you can age them here."
            />
          ) : (
            <div className="p-5 space-y-3">
              {/* stacked bar */}
              <div className="h-3 w-full bg-navy-900/60 rounded-full overflow-hidden flex">
                {arTotalForBar > 0 && Object.entries(arAging).map(([key, b]) => {
                  if (b.total <= 0) return null
                  const width = `${(b.total / arTotalForBar) * 100}%`
                  const colorMap = {
                    current: 'bg-emerald-500',
                    '1-30': 'bg-sky-500',
                    '31-60': 'bg-amber-500',
                    '60+': 'bg-rose-500',
                  }
                  return <div key={key} style={{ width }} className={colorMap[key]} />
                })}
              </div>

              <ul className="space-y-1">
                {Object.entries(arAging).map(([key, b]) => {
                  const colorMap = {
                    current: 'text-emerald-400',
                    '1-30': 'text-sky-400',
                    '31-60': 'text-amber-400',
                    '60+': 'text-rose-400',
                  }
                  return (
                    <li key={key}>
                      <Link
                        to={`${linkBase}/finance?aging=${encodeURIComponent(key)}`}
                        className="flex items-center justify-between text-xs py-1.5 px-2 -mx-2 rounded hover:bg-navy-700/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${colorMap[key]}`}>{b.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy-700/60 text-gray-300">{b.count}</span>
                        </div>
                        <span className="text-white">{fmtMoney(b.total)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>

              <div className="border-t border-navy-700/50 pt-2 flex items-center justify-between text-xs">
                <span className="text-gray-400 uppercase tracking-wider">Total Outstanding</span>
                <span className="text-amber-400 font-semibold">{fmtMoney(arTotalForBar)}</span>
              </div>
            </div>
          )}
        </Section>
      </div>
      {/* ===== Jobs Activity — ops stage moves ===== */}
      <div className="mt-6">
        <Section
          title="Jobs Activity"
          right={<Link to={`${linkBase}/ops-pipeline`} className="text-xs text-brand-cyan hover:underline">Ops Pipeline</Link>}
        >
          {loading.jobActivity ? (
            <div className="p-6 text-sm text-gray-500">Loading activity...</div>
          ) : jobActivity.length === 0 ? (
            <EmptyState title="No job activity yet" description="When operations moves a job to a new stage, it shows up here." />
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {jobActivity.map((a) => (
                <li key={a.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{a.title || a.work_order_number || 'Job'}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {a.from_status ? (
                        <>
                          <span className="px-1.5 py-0.5 rounded bg-navy-700/60">{prettyStatus(a.from_status)}</span>
                          <span>&rarr;</span>
                          <span className="px-1.5 py-0.5 rounded bg-brand-blue/20 text-brand-cyan">{prettyStatus(a.to_status)}</span>
                        </>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{a.note || 'New'}: {prettyStatus(a.to_status)}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">{relTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </HubPage>
  )
}
