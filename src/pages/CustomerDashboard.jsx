/**
 * CustomerDashboard — Industry-specific dashboard for LABOS customer tenants.
 *
 * This version: Home Services (Remodel / Repair / Maintenance)
 * Polished demo data for Precision Home Services sales demo.
 *
 * Sections:
 *  1. KPI stat cards (revenue, jobs, avg ticket, leads, conversion, first-visit fix)
 *  2. Today's Dispatch Board (scheduled jobs, tech assignments)
 *  3. Revenue Trend Chart (last 6 months bar chart)
 *  4. Lead & Sales Pipeline (funnel stages)
 *  5. Team Performance Scorecards
 *  6. Estimates & Contracts (pending, won, eSign status)
 *  7. Invoicing & Payments (outstanding, collected, recent)
 */

import { useState } from 'react'
import { useOrg } from '../lib/OrgContext'

// ─── MOCK DATA ──────────────────────────────────────────────────────────────

const TODAY_STATS = {
  revenue:       { value: '$14,280', label: 'Today\'s Revenue', trend: '+18%', up: true, icon: 'dollar' },
  jobsScheduled: { value: '12', label: 'Jobs Scheduled', trend: '3 remaining', up: null, icon: 'calendar' },
  jobsCompleted: { value: '9', label: 'Jobs Completed', trend: '75% done', up: true, icon: 'check' },
  avgTicket:     { value: '$1,587', label: 'Avg Ticket', trend: '+$142 vs last mo', up: true, icon: 'receipt' },
  newLeads:      { value: '7', label: 'New Leads Today', trend: '+3 from yesterday', up: true, icon: 'funnel' },
  conversionRate:{ value: '68%', label: 'Estimate Win Rate', trend: '+5% this month', up: true, icon: 'target' },
}

const MONTHLY_REVENUE = [
  { month: 'Nov', value: 78400 },
  { month: 'Dec', value: 62100 },
  { month: 'Jan', value: 71300 },
  { month: 'Feb', value: 84900 },
  { month: 'Mar', value: 96200 },
  { month: 'Apr', value: 88750 },
]

const DISPATCH_JOBS = [
  { id: 1, customer: 'Johnson Residence', type: 'Kitchen Remodel', tech: 'Marcus D.', time: '8:00 AM', status: 'in_progress', address: '1420 Oak Ave' },
  { id: 2, customer: 'Rivera Family', type: 'Bathroom Repair', tech: 'James K.', time: '8:30 AM', status: 'completed', address: '892 Pine St' },
  { id: 3, customer: 'Oakwood HOA', type: 'Common Area HVAC', tech: 'Sarah M.', time: '9:00 AM', status: 'completed', address: '200 Oakwood Blvd' },
  { id: 4, customer: 'Chen Property', type: 'Deck Build', tech: 'Marcus D.', time: '10:30 AM', status: 'in_progress', address: '3100 Maple Dr' },
  { id: 5, customer: 'Williams Home', type: 'Plumbing Repair', tech: 'Tyler R.', time: '11:00 AM', status: 'completed', address: '445 Elm Ct' },
  { id: 6, customer: 'Peterson Office', type: 'Electrical Panel', tech: 'James K.', time: '1:00 PM', status: 'scheduled', address: '88 Commerce Way' },
  { id: 7, customer: 'Garcia Duplex', type: 'Water Heater Install', tech: 'Tyler R.', time: '1:30 PM', status: 'scheduled', address: '1605 Birch Ln' },
  { id: 8, customer: 'Davis Estate', type: 'Full Renovation', tech: 'Sarah M.', time: '2:00 PM', status: 'scheduled', address: '700 Lakeview Dr' },
]

const PIPELINE_STAGES = [
  { stage: 'New Lead', count: 14, color: 'sky' },
  { stage: 'Contacted', count: 9, color: 'indigo' },
  { stage: 'Estimate Sent', count: 7, color: 'amber' },
  { stage: 'Estimate Won', count: 5, color: 'emerald' },
  { stage: 'Job Scheduled', count: 4, color: 'purple' },
  { stage: 'In Progress', count: 3, color: 'blue' },
  { stage: 'Completed', count: 22, color: 'green' },
]

const TEAM_MEMBERS = [
  { name: 'Marcus Davis', role: 'Lead Technician', jobs: 47, revenue: '$68,400', rating: 4.9, firstFix: '94%', avatar: 'MD' },
  { name: 'James Kim', role: 'Electrician', jobs: 38, revenue: '$52,100', rating: 4.8, firstFix: '91%', avatar: 'JK' },
  { name: 'Sarah Mitchell', role: 'HVAC Specialist', jobs: 42, revenue: '$61,800', rating: 4.9, firstFix: '96%', avatar: 'SM' },
  { name: 'Tyler Ross', role: 'Plumber', jobs: 35, revenue: '$48,300', rating: 4.7, firstFix: '89%', avatar: 'TR' },
]

const ESTIMATES = [
  { id: 'EST-1042', customer: 'Harmon Residence', type: 'Master Bath Remodel', amount: '$18,500', status: 'pending_signature', sent: 'Apr 11' },
  { id: 'EST-1041', customer: 'Clearview Church', type: 'HVAC Replacement', amount: '$24,200', status: 'signed', sent: 'Apr 10' },
  { id: 'EST-1040', customer: 'Brooks Property', type: 'Kitchen Renovation', amount: '$32,800', status: 'pending_review', sent: 'Apr 9' },
  { id: 'EST-1039', customer: 'Nguyen Home', type: 'Electrical Upgrade', amount: '$8,400', status: 'signed', sent: 'Apr 8' },
  { id: 'EST-1038', customer: 'Lakeside Condo', type: 'Plumbing Refit', amount: '$12,600', status: 'expired', sent: 'Apr 2' },
]

const INVOICES = [
  { id: 'INV-2087', customer: 'Rivera Family', amount: '$4,200', status: 'paid', method: 'Card', date: 'Apr 13' },
  { id: 'INV-2086', customer: 'Oakwood HOA', amount: '$6,800', status: 'paid', method: 'ACH', date: 'Apr 13' },
  { id: 'INV-2085', customer: 'Williams Home', amount: '$1,450', status: 'paid', method: 'Card', date: 'Apr 13' },
  { id: 'INV-2084', customer: 'Peterson Office', amount: '$3,200', status: 'pending', method: '--', date: 'Apr 12' },
  { id: 'INV-2083', customer: 'Chen Property', amount: '$8,900', status: 'pending', method: '--', date: 'Apr 11' },
  { id: 'INV-2082', customer: 'Martin Ranch', amount: '$5,600', status: 'overdue', method: '--', date: 'Apr 3' },
]

// ─── ICON HELPERS ───────────────────────────────────────────────────────────

function StatIcon({ type }) {
  const cls = 'w-5 h-5'
  switch (type) {
    case 'dollar': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    case 'calendar': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
    case 'check': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    case 'receipt': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
    case 'funnel': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>
    case 'target': return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
    default: return null
  }
}

const STATUS_STYLES = {
  completed:         { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Completed' },
  in_progress:       { bg: 'bg-sky-500/15', text: 'text-sky-400', label: 'In Progress' },
  scheduled:         { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Scheduled' },
  paid:              { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Paid' },
  pending:           { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Pending' },
  overdue:           { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Overdue' },
  signed:            { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Signed' },
  pending_signature: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'Awaiting eSign' },
  pending_review:    { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Under Review' },
  expired:           { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Expired' },
}

function Badge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>{s.label}</span>
}

// ─── MINI BAR CHART ─────────────────────────────────────────────────────────

function RevenueChart({ data }) {
  const max = Math.max(...data.map(d => d.value))
  return (
    <div className="flex items-end gap-3 h-40 px-2">
      {data.map(d => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] text-gray-400 font-medium">${(d.value / 1000).toFixed(0)}k</span>
          <div
            className="w-full rounded-t-lg bg-gradient-to-t from-sky-600 to-sky-400 transition-all duration-500"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: 8 }}
          />
          <span className="text-[10px] text-gray-500 font-medium">{d.month}</span>
        </div>
      ))}
    </div>
  )
}

// ─── PIPELINE FUNNEL ────────────────────────────────────────────────────────

const STAGE_COLORS = {
  sky:     'bg-sky-500',
  indigo:  'bg-indigo-500',
  amber:   'bg-amber-500',
  emerald: 'bg-emerald-500',
  purple:  'bg-purple-500',
  blue:    'bg-sky-600',
  green:   'bg-emerald-600',
}

function PipelineFunnel({ stages }) {
  const max = Math.max(...stages.map(s => s.count))
  return (
    <div className="space-y-2">
      {stages.map(s => (
        <div key={s.stage} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-28 text-right truncate">{s.stage}</span>
          <div className="flex-1 h-6 bg-navy-700/40 rounded-lg overflow-hidden">
            <div
              className={`h-full rounded-lg ${STAGE_COLORS[s.color]} flex items-center px-2 transition-all duration-500`}
              style={{ width: `${Math.max((s.count / max) * 100, 12)}%` }}
            >
              <span className="text-[10px] font-bold text-white">{s.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function CustomerDashboard() {
  const { currentOrg } = useOrg()
  const [dispatchFilter, setDispatchFilter] = useState('all')
  const companyName = currentOrg?.name || 'Your Company'

  const filteredJobs = dispatchFilter === 'all'
    ? DISPATCH_JOBS
    : DISPATCH_JOBS.filter(j => j.status === dispatchFilter)

  const totalOutstanding = '$17,700'
  const collectedToday = '$12,450'
  const onTimeRate = '92%'
  const firstVisitFix = '93%'

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{companyName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Sunday, April 13, 2026 &mdash; Home Services Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-xs font-semibold text-emerald-400">On-Time Rate: {onTimeRate}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <span className="text-xs font-semibold text-sky-400">1st Visit Fix: {firstVisitFix}</span>
          </div>
        </div>
      </div>

      {/* ── KPI Stat Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.values(TODAY_STATS).map(stat => (
          <div key={stat.label} className="bg-navy-800/60 border border-navy-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{stat.label}</span>
              <span className="text-sky-400 opacity-60"><StatIcon type={stat.icon} /></span>
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            {stat.trend && (
              <div className={`text-[11px] mt-1 font-medium ${stat.up === true ? 'text-emerald-400' : stat.up === false ? 'text-red-400' : 'text-gray-500'}`}>
                {stat.up === true && <span>&#9650; </span>}{stat.up === false && <span>&#9660; </span>}{stat.trend}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Row: Dispatch Board + Revenue Chart ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Dispatch Board — 2 cols */}
        <div className="lg:col-span-2 bg-navy-800/60 border border-navy-700/50 rounded-xl">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-navy-700/40">
            <h2 className="text-sm font-semibold text-white">Today's Dispatch Board</h2>
            <div className="flex gap-1">
              {['all', 'scheduled', 'in_progress', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setDispatchFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                    dispatchFilter === f
                      ? 'bg-sky-500/15 text-sky-400'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-navy-700/40'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'in_progress' ? 'Active' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-navy-700/30 max-h-[340px] overflow-y-auto">
            {filteredJobs.map(job => (
              <div key={job.id} className="flex items-center gap-4 px-5 py-3 hover:bg-navy-700/20 transition-colors">
                <div className="text-xs text-gray-500 w-16 font-mono">{job.time}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{job.customer}</div>
                  <div className="text-xs text-gray-500 truncate">{job.type} &mdash; {job.address}</div>
                </div>
                <div className="text-xs text-gray-400 w-20 truncate">{job.tech}</div>
                <Badge status={job.status} />
              </div>
            ))}
            {filteredJobs.length === 0 && (
              <div className="px-5 py-8 text-center text-xs text-gray-600">No jobs match this filter</div>
            )}
          </div>
        </div>

        {/* Revenue Chart — 1 col */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Monthly Revenue</h2>
            <span className="text-xs text-emerald-400 font-semibold">+13% YoY</span>
          </div>
          <RevenueChart data={MONTHLY_REVENUE} />
          <div className="mt-4 pt-3 border-t border-navy-700/40 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-gray-500 uppercase">This Month</div>
              <div className="text-lg font-bold text-white">$88,750</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Projected</div>
              <div className="text-lg font-bold text-sky-400">$112,400</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row: Pipeline + Team Performance ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Lead & Sales Pipeline */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Lead & Sales Pipeline</h2>
            <span className="text-xs text-gray-500">64 total leads this month</span>
          </div>
          <PipelineFunnel stages={PIPELINE_STAGES} />
          <div className="mt-4 pt-3 border-t border-navy-700/40 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Speed to Lead</div>
              <div className="text-sm font-bold text-white">4.2 min</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Avg Close Time</div>
              <div className="text-sm font-bold text-white">3.8 days</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Close Rate</div>
              <div className="text-sm font-bold text-emerald-400">68%</div>
            </div>
          </div>
        </div>

        {/* Team Performance */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Team Performance</h2>
            <span className="text-xs text-gray-500">April 2026</span>
          </div>
          <div className="space-y-3">
            {TEAM_MEMBERS.map(m => (
              <div key={m.name} className="flex items-center gap-3 p-3 bg-navy-700/20 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-sky-500/20 flex items-center justify-center text-xs font-bold text-sky-400 flex-shrink-0">
                  {m.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{m.name}</span>
                    <span className="text-[10px] text-gray-500">{m.role}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5">
                    <span className="text-[10px] text-gray-400">{m.jobs} jobs</span>
                    <span className="text-[10px] text-emerald-400 font-medium">{m.revenue}</span>
                    <span className="text-[10px] text-amber-400">{m.rating} stars</span>
                    <span className="text-[10px] text-sky-400">{m.firstFix} 1st fix</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row: Estimates & Contracts + Invoicing & Payments ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Estimates & Contracts */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-navy-700/40">
            <h2 className="text-sm font-semibold text-white">Estimates & Contracts</h2>
            <button className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg text-xs font-semibold text-sky-400 transition-colors">
              + New Estimate
            </button>
          </div>
          <div className="divide-y divide-navy-700/30">
            {ESTIMATES.map(est => (
              <div key={est.id} className="flex items-center gap-4 px-5 py-3 hover:bg-navy-700/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">{est.id}</span>
                    <span className="text-sm font-medium text-white truncate">{est.customer}</span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{est.type} &mdash; Sent {est.sent}</div>
                </div>
                <div className="text-sm font-semibold text-white w-20 text-right">{est.amount}</div>
                <Badge status={est.status} />
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-navy-700/40 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Pending</div>
              <div className="text-sm font-bold text-amber-400">$51,300</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Won (MTD)</div>
              <div className="text-sm font-bold text-emerald-400">$124,800</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">eSign Rate</div>
              <div className="text-sm font-bold text-purple-400">84%</div>
            </div>
          </div>
        </div>

        {/* Invoicing & Payments */}
        <div className="bg-navy-800/60 border border-navy-700/50 rounded-xl">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-navy-700/40">
            <h2 className="text-sm font-semibold text-white">Invoicing & Payments</h2>
            <button className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg text-xs font-semibold text-sky-400 transition-colors">
              + New Invoice
            </button>
          </div>
          <div className="divide-y divide-navy-700/30">
            {INVOICES.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3 hover:bg-navy-700/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">{inv.id}</span>
                    <span className="text-sm font-medium text-white truncate">{inv.customer}</span>
                  </div>
                  <div className="text-xs text-gray-500">{inv.date} {inv.method !== '--' ? `via ${inv.method}` : ''}</div>
                </div>
                <div className="text-sm font-semibold text-white w-20 text-right">{inv.amount}</div>
                <Badge status={inv.status} />
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-navy-700/40 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Collected Today</div>
              <div className="text-sm font-bold text-emerald-400">{collectedToday}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Outstanding</div>
              <div className="text-sm font-bold text-amber-400">{totalOutstanding}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Overdue</div>
              <div className="text-sm font-bold text-red-400">$5,600</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
