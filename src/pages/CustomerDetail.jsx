import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TeamMemberSelect, { TeamMemberLabel } from '../components/TeamMemberSelect'
import { STAGE_PIPELINE, customerValue, isWon, isLost } from '../lib/customerValue'

const STATUS_COLORS = {
  'Wizard Complete': 'bg-gray-500/20 text-gray-400',
  'Brief Review': 'bg-yellow-500/20 text-yellow-400',
  'Design Approval': 'bg-purple-500/20 text-purple-400',
  'In Build': 'bg-brand-blue/20 text-brand-blue',
  'QA': 'bg-orange-500/20 text-orange-400',
  'Launched': 'bg-emerald-500/20 text-emerald-400',
  'On Hold': 'bg-gray-500/20 text-gray-500',
  'Cancelled': 'bg-red-500/20 text-red-400',
}

const INVOICE_STATUS_COLORS = {
  paid: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  overdue: 'bg-red-500/20 text-red-400',
  draft: 'bg-gray-500/20 text-gray-400',
}

function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-gray-500/20 text-gray-400'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cls.split(' ')[1].replace('text-', 'bg-')}`} />
      {status}
    </span>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-brand-blue text-white'
          : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
      }`}
    >
      {children}
    </button>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—'
  return `$${Number(amount).toLocaleString()}`
}

function getInitials(name, email) {
  const n = name || ''
  if (n.includes(' ')) {
    const parts = n.trim().split(' ')
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (n || email || '?')[0].toUpperCase()
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
// Projects counted as "active" = won and in delivery or live (matches Operations STATUS_PIPELINE)
const ACTIVE_PROJECT_STATUSES = ['Onboarding Scheduled', 'Buildout', 'Active', 'Payment Hold']

function OverviewTab({ customer, projects, messages, invoices, updates }) {
  const c = customer
  const activeProjects = projects.filter(p => ACTIVE_PROJECT_STATUSES.includes(p.status))
  const launchedProjects = projects.filter(p => p.status === 'Launched')
  const totalInvoiced = invoices.reduce((s, i) => s + (i.amount || 0), 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0)
  const totalOutstanding = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + (i.amount || 0), 0)
  const totalMRR = projects.reduce((s, p) => s + (p.mrr || 0), 0)
  const recentMessages = messages.slice(0, 3)
  const recentUpdates = updates.slice(0, 3)
  const recentInvoices = invoices.slice(0, 3)

  const statusColor =
    c.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    c.status === 'Prospect' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
    c.status === 'Onboarding' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
    c.status === 'In Build' ? 'bg-brand-blue/20 text-brand-blue border-brand-blue/30' :
    c.status === 'Launched' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    c.status === 'Churned' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
    'bg-gray-500/20 text-gray-400 border-gray-500/30'

  return (
    <div className="space-y-6">
      {/* Top metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Projects</p>
          <p className="text-3xl font-bold text-white mt-1">{projects.length}</p>
          <div className="flex items-center gap-2 mt-1">
            {activeProjects.length > 0 && <span className="text-xs text-brand-blue">{activeProjects.length} active</span>}
            {launchedProjects.length > 0 && <span className="text-xs text-emerald-400">{launchedProjects.length} launched</span>}
          </div>
        </div>
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Revenue</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{formatCurrency(totalPaid)}</p>
          {totalOutstanding > 0 && <p className="text-xs text-yellow-400 mt-1">{formatCurrency(totalOutstanding)} outstanding</p>}
          {totalOutstanding === 0 && totalPaid > 0 && <p className="text-xs text-emerald-400/60 mt-1">Fully paid</p>}
        </div>
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">MRR</p>
          <p className="text-3xl font-bold text-brand-blue mt-1">
            {totalMRR > 0 ? `$${totalMRR.toLocaleString()}` : '$0'}
          </p>
          <p className="text-xs text-gray-500 mt-1">/month</p>
        </div>
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Engagement</p>
          <p className="text-3xl font-bold text-white mt-1">{messages.length}</p>
          <p className="text-xs text-gray-500 mt-1">{messages.length === 1 ? 'message' : 'messages'} · {updates.length} updates</p>
        </div>
      </div>

      {/* Customer snapshot + status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5 sm:col-span-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Customer Snapshot</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {c.company_name && (
              <div><p className="text-[10px] text-gray-500 uppercase">Company</p><p className="text-sm text-white">{c.company_name}</p></div>
            )}
            {c.company_industry && (
              <div><p className="text-[10px] text-gray-500 uppercase">Industry</p><p className="text-sm text-white">{c.company_industry}</p></div>
            )}
            {c.phone && (
              <div><p className="text-[10px] text-gray-500 uppercase">Phone</p><p className="text-sm text-white">{c.phone}</p></div>
            )}
            {c.plan_tier && (
              <div><p className="text-[10px] text-gray-500 uppercase">Plan</p><p className="text-sm text-white capitalize">{c.plan_tier}</p></div>
            )}
            {c.referral_source && (
              <div><p className="text-[10px] text-gray-500 uppercase">Referral</p><p className="text-sm text-white">{c.referral_source}</p></div>
            )}
            {c.preferred_domain && (
              <div><p className="text-[10px] text-gray-500 uppercase">Domain</p><p className="text-sm text-brand-blue">{c.preferred_domain}</p></div>
            )}
            <div><p className="text-[10px] text-gray-500 uppercase">Joined</p><p className="text-sm text-white">{formatDate(c.created_at)}</p></div>
            <div><p className="text-[10px] text-gray-500 uppercase">Last Updated</p><p className="text-sm text-white">{formatDate(c.updated_at)}</p></div>
          </div>
        </div>
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5 flex flex-col items-center justify-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">Account Status</p>
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${statusColor}`}>
            <span className="w-2 h-2 rounded-full bg-current" />
            {c.status || 'Active'}
          </span>
          {c.plan_status && (
            <span className={`mt-2 inline-flex items-center px-2.5 py-1 rounded text-xs font-medium capitalize ${
              c.plan_status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
              c.plan_status === 'trial' ? 'bg-purple-500/20 text-purple-400' :
              c.plan_status === 'past_due' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>{c.plan_status.replace('_', ' ')} plan</span>
          )}
          <p className="text-[10px] text-gray-600 mt-2">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Three-column recent activity */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Recent Projects */}
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Projects</h3>
          {projects.length === 0 ? (
            <p className="text-xs text-gray-600">No projects yet</p>
          ) : (
            <div className="space-y-2.5">
              {projects.slice(0, 4).map(p => {
                const sc = STATUS_COLORS[p.status] || 'bg-gray-500/20 text-gray-400'
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white truncate flex-1">{p.name || 'Untitled'}</p>
                    <StatusBadge status={p.status} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Invoices</h3>
          {invoices.length === 0 ? (
            <p className="text-xs text-gray-600">No invoices yet</p>
          ) : (
            <div className="space-y-2.5">
              {recentInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white truncate flex-1">{inv.invoice_number || inv.title || `INV-${inv.id.slice(0, 8).toUpperCase()}`}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-white font-medium">{formatCurrency(inv.amount)}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      inv.status === 'paid' ? 'bg-emerald-400' :
                      inv.status === 'overdue' ? 'bg-red-400' :
                      'bg-yellow-400'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Activity</h3>
          {updates.length === 0 && messages.length === 0 ? (
            <p className="text-xs text-gray-600">No activity yet</p>
          ) : (
            <div className="space-y-2.5">
              {recentUpdates.map(u => (
                <div key={u.id}>
                  <p className="text-sm text-white truncate">{u.title || 'Update'}</p>
                  <p className="text-[10px] text-gray-500">{formatDate(u.created_at)}</p>
                </div>
              ))}
              {recentUpdates.length === 0 && recentMessages.slice(0, 3).map(m => (
                <div key={m.id}>
                  <p className="text-sm text-gray-300 truncate">{m.body || m.content || 'Message'}</p>
                  <p className="text-[10px] text-gray-500">{formatDate(m.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Social presence quick view */}
      {(c.social_website || c.social_facebook || c.social_instagram || c.social_linkedin || c.social_twitter || c.social_google_business) && (
        <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Web Presence</h3>
          <div className="flex flex-wrap gap-2">
            {c.social_website && <a href={c.social_website} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-navy-700/50 text-xs text-brand-blue hover:bg-navy-700 transition-colors">Website</a>}
            {c.social_google_business && <a href={c.social_google_business} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-navy-700/50 text-xs text-brand-blue hover:bg-navy-700 transition-colors">Google Business</a>}
            {c.social_facebook && <a href={c.social_facebook} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-navy-700/50 text-xs text-blue-400 hover:bg-navy-700 transition-colors">Facebook</a>}
            {c.social_instagram && <a href={c.social_instagram} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-navy-700/50 text-xs text-pink-400 hover:bg-navy-700 transition-colors">Instagram</a>}
            {c.social_twitter && <a href={c.social_twitter} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-navy-700/50 text-xs text-gray-300 hover:bg-navy-700 transition-colors">X / Twitter</a>}
            {c.social_linkedin && <a href={c.social_linkedin} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-navy-700/50 text-xs text-blue-300 hover:bg-navy-700 transition-colors">LinkedIn</a>}
            {c.social_tiktok && <a href={c.social_tiktok} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-navy-700/50 text-xs text-gray-300 hover:bg-navy-700 transition-colors">TikTok</a>}
            {c.social_youtube && <a href={c.social_youtube} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-navy-700/50 text-xs text-red-400 hover:bg-navy-700 transition-colors">YouTube</a>}
            {c.social_yelp && <a href={c.social_yelp} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-navy-700/50 text-xs text-red-300 hover:bg-navy-700 transition-colors">Yelp</a>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Projects Tab ──────────────────────────────────────────────────────────────
function ProjectsTab({ projects }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
        <p className="text-sm">No projects yet</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {projects.map(p => (
        <div key={p.id} className="bg-navy-900/40 border border-navy-700/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-white truncate">
                {p.name || <span className="italic text-gray-500">Untitled project</span>}
              </p>
              {p.status && <StatusBadge status={p.status} />}
              {p.tier && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 capitalize">
                  {p.tier}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              {p.project_type && <span>{p.project_type}</span>}
              {p.mrr > 0 && <span className="text-emerald-400">${p.mrr.toLocaleString()}/mo MRR</span>}
              <span>Created {formatDate(p.created_at)}</span>
              {p.launched_at && <span className="text-emerald-400">Launched {formatDate(p.launched_at)}</span>}
            </div>
          </div>
          <Link
            to={`/admin/projects/${p.id}`}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-blue border border-brand-blue/30 rounded-lg hover:bg-brand-blue/10 transition-colors"
          >
            View Project
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      ))}
    </div>
  )
}

// ─── Messages Tab ──────────────────────────────────────────────────────────────
function MessagesTab({ messages }) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm">No messages from this customer</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {messages.map(msg => (
        <div key={msg.id} className="bg-navy-900/40 border border-navy-700/30 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              {msg.projects?.name && (
                <Link
                  to={`/admin/projects/${msg.project_id}`}
                  className="text-xs text-brand-blue hover:underline"
                >
                  {msg.projects.name}
                </Link>
              )}
              {msg.message_type && (
                <span className="text-xs text-gray-600 capitalize">{msg.message_type}</span>
              )}
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(msg.created_at)}</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{msg.body || msg.content || '—'}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Invoices Tab ──────────────────────────────────────────────────────────────
function InvoicesTab({ invoices }) {
  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.amount || 0), 0)
  const totalPending = invoices
    .filter(i => i.status === 'pending' || i.status === 'overdue')
    .reduce((sum, i) => sum + (i.amount || 0), 0)

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
        <p className="text-sm">No invoices yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-navy-900/40 border border-navy-700/30 rounded-xl p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Invoiced</p>
          <p className="text-xl font-bold text-white mt-1">{formatCurrency(invoices.reduce((s, i) => s + (i.amount || 0), 0))}</p>
        </div>
        <div className="bg-navy-900/40 border border-navy-700/30 rounded-xl p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Collected</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-navy-900/40 border border-navy-700/30 rounded-xl p-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Outstanding</p>
          <p className="text-xl font-bold text-yellow-400 mt-1">{formatCurrency(totalPending)}</p>
        </div>
      </div>

      {/* Invoice list */}
      <div className="bg-navy-900/40 border border-navy-700/30 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-navy-700/30 bg-navy-900/30">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Invoice</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Project</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/20">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-navy-700/20 transition-colors">
                <td className="px-4 py-3 text-sm text-white font-medium">
                  {inv.invoice_number || inv.title || `INV-${inv.id.slice(0, 8).toUpperCase()}`}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {inv.projects?.name || '—'}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-white">
                  {formatCurrency(inv.amount)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${INVOICE_STATUS_COLORS[inv.status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {inv.status || 'draft'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {formatDate(inv.due_date || inv.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Activity Tab ──────────────────────────────────────────────────────────────
function ActivityTab({ updates }) {
  if (updates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p className="text-sm">No activity yet</p>
      </div>
    )
  }

  const UPDATE_TYPE_COLORS = {
    progress: 'bg-brand-blue/20 text-brand-blue',
    milestone: 'bg-emerald-500/20 text-emerald-400',
    note: 'bg-gray-500/20 text-gray-400',
    issue: 'bg-red-500/20 text-red-400',
    launch: 'bg-purple-500/20 text-purple-400',
  }

  return (
    <div className="space-y-3">
      {updates.map(u => {
        const typeClass = UPDATE_TYPE_COLORS[u.update_type] || 'bg-gray-500/20 text-gray-400'
        return (
          <div key={u.id} className="bg-navy-900/40 border border-navy-700/30 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{u.title || 'Update'}</span>
                {u.update_type && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${typeClass}`}>
                    {u.update_type}
                  </span>
                )}
                {u.projects?.name && (
                  <Link to={`/admin/projects/${u.project_id}`} className="text-xs text-brand-blue hover:underline">
                    {u.projects.name}
                  </Link>
                )}
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(u.created_at)}</span>
            </div>
            {u.body && <p className="text-sm text-gray-400 leading-relaxed">{u.body}</p>}
          </div>
        )
      })}
    </div>
  )
}

// ─── Details Tab (read-only) ──────────────────────────────────────────────────
function DetailField({ label, value, href, mono }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      {href ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-blue hover:underline break-all">{value}</a>
      ) : (
        <p className={`text-sm text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      )}
    </div>
  )
}

function DetailSection({ icon, title, children }) {
  // Filter out null children (fields with no value)
  const filled = Array.isArray(children) ? children.filter(Boolean) : children
  if (Array.isArray(filled) && filled.length === 0) return null
  return (
    <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-brand-blue/10 flex items-center justify-center text-brand-blue flex-shrink-0">{icon}</div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
        {filled}
      </div>
    </div>
  )
}

function DetailsTab({ customer }) {
  const c = customer
  const [activeSection, setActiveSection] = useState('identity')

  const statusColor =
    c.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' :
    c.status === 'Prospect' ? 'bg-blue-500/20 text-blue-400' :
    c.status === 'Onboarding' ? 'bg-purple-500/20 text-purple-400' :
    c.status === 'In Build' ? 'bg-brand-blue/20 text-brand-blue' :
    c.status === 'Launched' ? 'bg-emerald-500/20 text-emerald-400' :
    c.status === 'Churned' ? 'bg-red-500/20 text-red-400' :
    'bg-gray-500/20 text-gray-400'

  const legalAddress = [c.legal_address_line1, c.legal_address_line2].filter(Boolean).join(', ')
  const legalCityStateZip = [c.legal_city, c.legal_state, c.legal_zip].filter(Boolean).join(', ')

  const sections = [
    { key: 'identity', label: 'Identity & Status' },
    { key: 'team', label: 'Team Assignments' },
    { key: 'company', label: 'Company' },
    { key: 'legal', label: 'Legal Entity' },
    { key: 'billing', label: 'Billing & Plan' },
    { key: 'social', label: 'Social & Web' },
    { key: 'brand', label: 'Brand & Platform' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div className="space-y-6">
      {/* Section nav pills */}
      <div className="flex flex-wrap gap-2">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeSection === s.key
                ? 'bg-brand-blue text-white'
                : 'text-gray-400 hover:text-white hover:bg-navy-700/50 border border-navy-700/50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Identity & Status */}
      {activeSection === 'identity' && (
        <DetailSection
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
          title="Identity & Status"
        >
          <DetailField label="First Name" value={c.first_name} />
          <DetailField label="Last Name" value={c.last_name} />
          <DetailField label="Email" value={c.email} />
          <DetailField label="Phone" value={c.phone} />
          {c.status && (
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Status</p>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {c.status}
              </span>
            </div>
          )}
          <DetailField label="Role" value={c.role} />
          <DetailField label="Referral Source" value={c.referral_source} />
          <DetailField label="Joined" value={formatDate(c.created_at)} />
          <DetailField label="Last Updated" value={formatDate(c.updated_at)} />
        </DetailSection>
      )}

      {/* Team Assignments */}
      {activeSection === 'team' && (
        <DetailSection
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
          title="Liftori Team"
        >
          <div className="col-span-2 sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Sales Rep</p>
              <TeamMemberLabel userId={c.sales_rep_id} fallback="— Unassigned —" className="text-sm" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Project Manager</p>
              <TeamMemberLabel userId={c.project_manager_id} fallback="— Unassigned —" className="text-sm" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Consultant</p>
              <TeamMemberLabel userId={c.consultant_id} fallback="— Unassigned —" className="text-sm" />
            </div>
          </div>
        </DetailSection>
      )}

      {/* Company */}
      {activeSection === 'company' && (
        <DetailSection
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>}
          title="Company"
        >
          <DetailField label="Company Name" value={c.company_name} />
          <DetailField label="Website" value={c.company_website} href />
          <DetailField label="Industry" value={c.company_industry} />
          <DetailField label="Size" value={c.company_size} />
          <DetailField label="Business Type" value={c.business_type} />
          <DetailField label="Founded" value={c.company_founded_year ? String(c.company_founded_year) : null} />
          <DetailField label="Target Audience" value={c.target_audience} />
          {c.company_description && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Description</p>
              <p className="text-sm text-gray-300 leading-relaxed">{c.company_description}</p>
            </div>
          )}
        </DetailSection>
      )}

      {/* Legal Entity */}
      {activeSection === 'legal' && (
        <DetailSection
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>}
          title="Legal Entity"
        >
          <DetailField label="Legal Name" value={c.legal_entity_name} />
          <DetailField label="Entity Type" value={c.legal_entity_type} />
          <DetailField label="EIN / Tax ID" value={c.ein_tax_id} mono />
          {legalAddress ? <DetailField label="Address" value={legalAddress} /> : <DetailField label="Address" value={null} />}
          {legalCityStateZip ? <DetailField label="City / State / ZIP" value={legalCityStateZip} /> : <DetailField label="City / State / ZIP" value={null} />}
          <DetailField label="Country" value={c.legal_country} />
        </DetailSection>
      )}

      {/* Billing & Plan */}
      {activeSection === 'billing' && (
        <DetailSection
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
          title="Billing & Plan"
        >
          <DetailField label="Billing Email" value={c.billing_email} />
          <DetailField label="Billing Phone" value={c.billing_phone} />
          {c.plan_tier ? (
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Plan Tier</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 capitalize">{c.plan_tier}</span>
            </div>
          ) : <DetailField label="Plan Tier" value={null} />}
          {c.plan_status ? (
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Plan Status</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                c.plan_status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                c.plan_status === 'trial' ? 'bg-purple-500/20 text-purple-400' :
                c.plan_status === 'past_due' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>{c.plan_status.replace('_', ' ')}</span>
            </div>
          ) : <DetailField label="Plan Status" value={null} />}
          <DetailField label="Stripe ID" value={c.stripe_customer_id} mono />
        </DetailSection>
      )}

      {/* Social & Web */}
      {activeSection === 'social' && (
        <DetailSection
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>}
          title="Social & Web"
        >
          <DetailField label="Website" value={c.social_website} href />
          <DetailField label="Google Business" value={c.social_google_business} href />
          <DetailField label="Facebook" value={c.social_facebook} href />
          <DetailField label="Instagram" value={c.social_instagram} href />
          <DetailField label="X / Twitter" value={c.social_twitter} href />
          <DetailField label="LinkedIn" value={c.social_linkedin} href />
          <DetailField label="TikTok" value={c.social_tiktok} href />
          <DetailField label="YouTube" value={c.social_youtube} href />
          <DetailField label="Pinterest" value={c.social_pinterest} href />
          <DetailField label="Yelp" value={c.social_yelp} href />
          <DetailField label="GitHub" value={c.social_github} href />
        </DetailSection>
      )}

      {/* Brand & Platform */}
      {activeSection === 'brand' && (
        <DetailSection
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>}
          title="Brand & Platform"
        >
          <DetailField label="Logo" value={c.brand_logo_url} href />
          <DetailField label="Preferred Domain" value={c.preferred_domain} />
          {c.tech_stack_notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Tech Stack Notes</p>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{c.tech_stack_notes}</p>
            </div>
          )}
          {c.onboarding_notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Onboarding Notes</p>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{c.onboarding_notes}</p>
            </div>
          )}
        </DetailSection>
      )}

      {/* Internal Notes */}
      {activeSection === 'notes' && (
        <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-yellow-500/10 flex items-center justify-center text-yellow-400 flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
            </div>
            <h3 className="text-xs font-semibold text-yellow-400/70 uppercase tracking-wider">Internal Notes</h3>
            <span className="text-[10px] text-yellow-500/40 ml-1">Admin only</span>
          </div>
          {c.internal_notes ? (
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{c.internal_notes}</p>
          ) : (
            <p className="text-xs text-gray-600 italic">No internal notes yet</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Reusable form components ─────────────────────────────────────────────────
const inputCls = 'w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue/50'
const selectCls = 'w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40'
const labelCls = 'block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5'
const textareaCls = 'w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue/50 resize-none'

function FormField({ label, children, span2 }) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-2 border-t border-navy-700/30 first:border-t-0 first:pt-0">
      <div className="w-8 h-8 rounded-lg bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Edit Tab ──────────────────────────────────────────────────────────────────
function EditTab({ customer, onSaved }) {
  const [form, setForm] = useState({
    // Identity
    first_name: customer.first_name || '',
    last_name: customer.last_name || '',
    full_name: customer.full_name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    avatar_url: customer.avatar_url || '',
    role: customer.role || 'customer',
    status: customer.status || 'Active',
    // Company
    company_name: customer.company_name || '',
    company_website: customer.company_website || '',
    company_industry: customer.company_industry || '',
    company_size: customer.company_size || '',
    company_description: customer.company_description || '',
    company_founded_year: customer.company_founded_year || '',
    business_type: customer.business_type || '',
    target_audience: customer.target_audience || '',
    // Legal entity
    legal_entity_name: customer.legal_entity_name || '',
    legal_entity_type: customer.legal_entity_type || '',
    ein_tax_id: customer.ein_tax_id || '',
    legal_address_line1: customer.legal_address_line1 || '',
    legal_address_line2: customer.legal_address_line2 || '',
    legal_city: customer.legal_city || '',
    legal_state: customer.legal_state || '',
    legal_zip: customer.legal_zip || '',
    legal_country: customer.legal_country || 'US',
    // Billing / plan
    billing_email: customer.billing_email || '',
    billing_phone: customer.billing_phone || '',
    plan_tier: customer.plan_tier || '',
    plan_status: customer.plan_status || '',
    stripe_customer_id: customer.stripe_customer_id || '',
    // Social
    social_website: customer.social_website || '',
    social_facebook: customer.social_facebook || '',
    social_instagram: customer.social_instagram || '',
    social_twitter: customer.social_twitter || '',
    social_linkedin: customer.social_linkedin || '',
    social_tiktok: customer.social_tiktok || '',
    social_youtube: customer.social_youtube || '',
    social_github: customer.social_github || '',
    social_pinterest: customer.social_pinterest || '',
    social_yelp: customer.social_yelp || '',
    social_google_business: customer.social_google_business || '',
    // Brand / platform
    brand_logo_url: customer.brand_logo_url || '',
    preferred_domain: customer.preferred_domain || '',
    tech_stack_notes: customer.tech_stack_notes || '',
    onboarding_notes: customer.onboarding_notes || '',
    internal_notes: customer.internal_notes || '',
    referral_source: customer.referral_source || '',
    // Liftori team assignments
    sales_rep_id: customer.sales_rep_id || null,
    project_manager_id: customer.project_manager_id || null,
    consultant_id: customer.consultant_id || null,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [activeSection, setActiveSection] = useState('identity')

  function handleChange(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-sync full_name from first + last
      if (field === 'first_name' || field === 'last_name') {
        const first = field === 'first_name' ? value : prev.first_name
        const last = field === 'last_name' ? value : prev.last_name
        next.full_name = [first, last].filter(Boolean).join(' ')
      }
      return next
    })
    setSaved(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, updated_at: new Date().toISOString() }
      // Clean empty strings to null for optional fields
      Object.keys(payload).forEach(k => {
        if (payload[k] === '') payload[k] = null
      })
      // Keep required fields
      payload.email = form.email
      payload.role = form.role
      payload.status = form.status || 'Active'
      // Convert founded year
      if (form.company_founded_year) {
        payload.company_founded_year = parseInt(form.company_founded_year) || null
      }

      const { error: err } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', customer.id)
      if (err) throw err
      setSaved(true)
      onSaved({ ...customer, ...form })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const sections = [
    { key: 'identity', label: 'Identity & Status' },
    { key: 'team', label: 'Team Assignments' },
    { key: 'company', label: 'Company' },
    { key: 'legal', label: 'Legal Entity' },
    { key: 'billing', label: 'Billing & Plan' },
    { key: 'social', label: 'Social & Web' },
    { key: 'brand', label: 'Brand & Platform' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div className="space-y-6">
      {/* Section nav pills */}
      <div className="flex flex-wrap gap-2">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeSection === s.key
                ? 'bg-brand-blue text-white'
                : 'text-gray-400 hover:text-white hover:bg-navy-700/50 border border-navy-700/50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Identity & Status ──────────────────────────────────── */}
      {activeSection === 'identity' && (
        <div className="space-y-4">
          <SectionHeader
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
            title="Identity & Status"
            subtitle="Contact details, role, and account status"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name">
              <input type="text" value={form.first_name} onChange={e => handleChange('first_name', e.target.value)} className={inputCls} placeholder="Jane" />
            </FormField>
            <FormField label="Last Name">
              <input type="text" value={form.last_name} onChange={e => handleChange('last_name', e.target.value)} className={inputCls} placeholder="Smith" />
            </FormField>
            <FormField label="Display Name (auto)">
              <input type="text" value={form.full_name} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} />
            </FormField>
            <FormField label="Phone">
              <input type="tel" value={form.phone} onChange={e => handleChange('phone', e.target.value)} className={inputCls} placeholder="(555) 123-4567" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} className={inputCls} placeholder="jane@example.com" />
            </FormField>
            <FormField label="Avatar URL">
              <input type="url" value={form.avatar_url} onChange={e => handleChange('avatar_url', e.target.value)} className={inputCls} placeholder="https://..." />
            </FormField>
            <FormField label="Status">
              <select value={form.status} onChange={e => handleChange('status', e.target.value)} className={selectCls}>
                <option value="Active">Active</option>
                <option value="Prospect">Prospect</option>
                <option value="Onboarding">Onboarding</option>
                <option value="In Build">In Build</option>
                <option value="Launched">Launched</option>
                <option value="On Hold">On Hold</option>
                <option value="Churned">Churned</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </FormField>
            <FormField label="Role">
              <select value={form.role} onChange={e => handleChange('role', e.target.value)} className={selectCls}>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
                <option value="affiliate">Affiliate</option>
              </select>
            </FormField>
            <FormField label="Referral Source" span2>
              <select value={form.referral_source} onChange={e => handleChange('referral_source', e.target.value)} className={selectCls}>
                <option value="">— Select —</option>
                <option value="Google Search">Google Search</option>
                <option value="Social Media">Social Media</option>
                <option value="Referral">Referral</option>
                <option value="Affiliate">Affiliate</option>
                <option value="Cold Outreach">Cold Outreach</option>
                <option value="Word of Mouth">Word of Mouth</option>
                <option value="Advertising">Advertising</option>
                <option value="Event / Conference">Event / Conference</option>
                <option value="Other">Other</option>
              </select>
            </FormField>
          </div>
        </div>
      )}

      {/* ── Team Assignments ───────────────────────────────────── */}
      {activeSection === 'team' && (
        <div className="space-y-4">
          <SectionHeader
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
            title="Liftori Team Assignments"
            subtitle="Who from Liftori is responsible for this customer"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Sales Rep">
              <TeamMemberSelect
                value={form.sales_rep_id}
                onChange={(id) => handleChange('sales_rep_id', id)}
                placeholder="Pick a sales rep"
              />
            </FormField>
            <FormField label="Project Manager">
              <TeamMemberSelect
                value={form.project_manager_id}
                onChange={(id) => handleChange('project_manager_id', id)}
                placeholder="Pick a PM"
              />
            </FormField>
            <FormField label="Consultant">
              <TeamMemberSelect
                value={form.consultant_id}
                onChange={(id) => handleChange('consultant_id', id)}
                placeholder="Pick a consultant"
              />
            </FormField>
          </div>
          <div className="text-xs text-gray-500 italic">
            Dropdowns pull from Liftori internal team members (admin, super_admin, dev, sales rep, sales director, consultant, call agent). Customers and testers are excluded.
          </div>
        </div>
      )}

      {/* ── Company ────────────────────────────────────────────── */}
      {activeSection === 'company' && (
        <div className="space-y-4">
          <SectionHeader
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>}
            title="Company Information"
            subtitle="Business details used across estimates, agreements, and client portals"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Company Name">
              <input type="text" value={form.company_name} onChange={e => handleChange('company_name', e.target.value)} className={inputCls} placeholder="Acme Corp" />
            </FormField>
            <FormField label="Company Website">
              <input type="url" value={form.company_website} onChange={e => handleChange('company_website', e.target.value)} className={inputCls} placeholder="https://acme.com" />
            </FormField>
            <FormField label="Industry">
              <select value={form.company_industry} onChange={e => handleChange('company_industry', e.target.value)} className={selectCls}>
                <option value="">— Select —</option>
                <option value="E-Commerce / Retail">E-Commerce / Retail</option>
                <option value="SaaS / Technology">SaaS / Technology</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Finance / Insurance">Finance / Insurance</option>
                <option value="Construction / Home Services">Construction / Home Services</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Education">Education</option>
                <option value="Legal">Legal</option>
                <option value="Marketing / Agency">Marketing / Agency</option>
                <option value="Nonprofit">Nonprofit</option>
                <option value="Automotive">Automotive</option>
                <option value="Beauty / Wellness">Beauty / Wellness</option>
                <option value="Entertainment / Media">Entertainment / Media</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Professional Services">Professional Services</option>
                <option value="Logistics / Freight">Logistics / Freight</option>
                <option value="Other">Other</option>
              </select>
            </FormField>
            <FormField label="Company Size">
              <select value={form.company_size} onChange={e => handleChange('company_size', e.target.value)} className={selectCls}>
                <option value="">— Select —</option>
                <option value="Solo / Freelancer">Solo / Freelancer</option>
                <option value="2-10">2–10 employees</option>
                <option value="11-50">11–50 employees</option>
                <option value="51-200">51–200 employees</option>
                <option value="201-500">201–500 employees</option>
                <option value="500+">500+ employees</option>
              </select>
            </FormField>
            <FormField label="Business Type">
              <select value={form.business_type} onChange={e => handleChange('business_type', e.target.value)} className={selectCls}>
                <option value="">— Select —</option>
                <option value="B2B">B2B</option>
                <option value="B2C">B2C</option>
                <option value="B2B2C">B2B2C</option>
                <option value="D2C">D2C (Direct to Consumer)</option>
                <option value="Marketplace">Marketplace</option>
                <option value="Nonprofit">Nonprofit</option>
                <option value="Government">Government</option>
              </select>
            </FormField>
            <FormField label="Founded Year">
              <input type="number" value={form.company_founded_year} onChange={e => handleChange('company_founded_year', e.target.value)} className={inputCls} placeholder="2020" min="1900" max="2030" />
            </FormField>
            <FormField label="Target Audience" span2>
              <input type="text" value={form.target_audience} onChange={e => handleChange('target_audience', e.target.value)} className={inputCls} placeholder="Small business owners, millennials, local shoppers..." />
            </FormField>
            <FormField label="Company Description" span2>
              <textarea value={form.company_description} onChange={e => handleChange('company_description', e.target.value)} className={textareaCls} rows={3} placeholder="Brief description of what the company does..." />
            </FormField>
          </div>
        </div>
      )}

      {/* ── Legal Entity ───────────────────────────────────────── */}
      {activeSection === 'legal' && (
        <div className="space-y-4">
          <SectionHeader
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>}
            title="Legal Business Entity"
            subtitle="Required for Stripe, agreements, invoices, and compliance"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Legal Entity Name">
              <input type="text" value={form.legal_entity_name} onChange={e => handleChange('legal_entity_name', e.target.value)} className={inputCls} placeholder="Acme Corp LLC" />
            </FormField>
            <FormField label="Entity Type">
              <select value={form.legal_entity_type} onChange={e => handleChange('legal_entity_type', e.target.value)} className={selectCls}>
                <option value="">— Select —</option>
                <option value="Sole Proprietorship">Sole Proprietorship</option>
                <option value="LLC">LLC</option>
                <option value="S-Corp">S-Corp</option>
                <option value="C-Corp">C-Corp</option>
                <option value="Partnership">Partnership</option>
                <option value="LP">Limited Partnership (LP)</option>
                <option value="LLP">LLP</option>
                <option value="Nonprofit">Nonprofit (501c3)</option>
                <option value="Trust">Trust</option>
                <option value="Other">Other</option>
              </select>
            </FormField>
            <FormField label="EIN / Tax ID">
              <input type="text" value={form.ein_tax_id} onChange={e => handleChange('ein_tax_id', e.target.value)} className={inputCls} placeholder="XX-XXXXXXX" />
            </FormField>
            <div /> {/* spacer */}
            <FormField label="Address Line 1">
              <input type="text" value={form.legal_address_line1} onChange={e => handleChange('legal_address_line1', e.target.value)} className={inputCls} placeholder="123 Main St" />
            </FormField>
            <FormField label="Address Line 2">
              <input type="text" value={form.legal_address_line2} onChange={e => handleChange('legal_address_line2', e.target.value)} className={inputCls} placeholder="Suite 200" />
            </FormField>
            <FormField label="City">
              <input type="text" value={form.legal_city} onChange={e => handleChange('legal_city', e.target.value)} className={inputCls} placeholder="Jacksonville" />
            </FormField>
            <FormField label="State">
              <input type="text" value={form.legal_state} onChange={e => handleChange('legal_state', e.target.value)} className={inputCls} placeholder="FL" />
            </FormField>
            <FormField label="ZIP Code">
              <input type="text" value={form.legal_zip} onChange={e => handleChange('legal_zip', e.target.value)} className={inputCls} placeholder="32256" />
            </FormField>
            <FormField label="Country">
              <select value={form.legal_country} onChange={e => handleChange('legal_country', e.target.value)} className={selectCls}>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="Other">Other</option>
              </select>
            </FormField>
          </div>
        </div>
      )}

      {/* ── Billing & Plan ─────────────────────────────────────── */}
      {activeSection === 'billing' && (
        <div className="space-y-4">
          <SectionHeader
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
            title="Billing & Plan"
            subtitle="Payment contact, subscription tier, and Stripe integration"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Billing Email">
              <input type="email" value={form.billing_email} onChange={e => handleChange('billing_email', e.target.value)} className={inputCls} placeholder="billing@acme.com" />
            </FormField>
            <FormField label="Billing Phone">
              <input type="tel" value={form.billing_phone} onChange={e => handleChange('billing_phone', e.target.value)} className={inputCls} placeholder="(555) 123-4567" />
            </FormField>
            <FormField label="Plan Tier">
              <select value={form.plan_tier} onChange={e => handleChange('plan_tier', e.target.value)} className={selectCls}>
                <option value="">— None —</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="scale">Scale</option>
                <option value="enterprise">Enterprise</option>
                <option value="custom">Custom</option>
              </select>
            </FormField>
            <FormField label="Plan Status">
              <select value={form.plan_status} onChange={e => handleChange('plan_status', e.target.value)} className={selectCls}>
                <option value="">— None —</option>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="past_due">Past Due</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </FormField>
            <FormField label="Stripe Customer ID" span2>
              <input type="text" value={form.stripe_customer_id} onChange={e => handleChange('stripe_customer_id', e.target.value)} className={inputCls} placeholder="cus_xxxxxxxxxxxxxx" />
            </FormField>
          </div>
        </div>
      )}

      {/* ── Social & Web ───────────────────────────────────────── */}
      {activeSection === 'social' && (
        <div className="space-y-4">
          <SectionHeader
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>}
            title="Social Media & Web Presence"
            subtitle="Client's online profiles — used for platform builds, marketing, and SEO"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Primary Website">
              <input type="url" value={form.social_website} onChange={e => handleChange('social_website', e.target.value)} className={inputCls} placeholder="https://acme.com" />
            </FormField>
            <FormField label="Google Business Profile">
              <input type="url" value={form.social_google_business} onChange={e => handleChange('social_google_business', e.target.value)} className={inputCls} placeholder="https://g.page/..." />
            </FormField>
            <FormField label="Facebook">
              <input type="url" value={form.social_facebook} onChange={e => handleChange('social_facebook', e.target.value)} className={inputCls} placeholder="https://facebook.com/..." />
            </FormField>
            <FormField label="Instagram">
              <input type="url" value={form.social_instagram} onChange={e => handleChange('social_instagram', e.target.value)} className={inputCls} placeholder="https://instagram.com/..." />
            </FormField>
            <FormField label="X / Twitter">
              <input type="url" value={form.social_twitter} onChange={e => handleChange('social_twitter', e.target.value)} className={inputCls} placeholder="https://x.com/..." />
            </FormField>
            <FormField label="LinkedIn">
              <input type="url" value={form.social_linkedin} onChange={e => handleChange('social_linkedin', e.target.value)} className={inputCls} placeholder="https://linkedin.com/company/..." />
            </FormField>
            <FormField label="TikTok">
              <input type="url" value={form.social_tiktok} onChange={e => handleChange('social_tiktok', e.target.value)} className={inputCls} placeholder="https://tiktok.com/@..." />
            </FormField>
            <FormField label="YouTube">
              <input type="url" value={form.social_youtube} onChange={e => handleChange('social_youtube', e.target.value)} className={inputCls} placeholder="https://youtube.com/@..." />
            </FormField>
            <FormField label="Pinterest">
              <input type="url" value={form.social_pinterest} onChange={e => handleChange('social_pinterest', e.target.value)} className={inputCls} placeholder="https://pinterest.com/..." />
            </FormField>
            <FormField label="Yelp">
              <input type="url" value={form.social_yelp} onChange={e => handleChange('social_yelp', e.target.value)} className={inputCls} placeholder="https://yelp.com/biz/..." />
            </FormField>
            <FormField label="GitHub">
              <input type="url" value={form.social_github} onChange={e => handleChange('social_github', e.target.value)} className={inputCls} placeholder="https://github.com/..." />
            </FormField>
          </div>
        </div>
      )}

      {/* ── Brand & Platform ───────────────────────────────────── */}
      {activeSection === 'brand' && (
        <div className="space-y-4">
          <SectionHeader
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>}
            title="Brand & Platform"
            subtitle="Branding assets, domain, and technical context for the build"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Brand Logo URL">
              <input type="url" value={form.brand_logo_url} onChange={e => handleChange('brand_logo_url', e.target.value)} className={inputCls} placeholder="https://..." />
            </FormField>
            <FormField label="Preferred Domain">
              <input type="text" value={form.preferred_domain} onChange={e => handleChange('preferred_domain', e.target.value)} className={inputCls} placeholder="acme.com or acme-store.com" />
            </FormField>
            <FormField label="Tech Stack Notes" span2>
              <textarea value={form.tech_stack_notes} onChange={e => handleChange('tech_stack_notes', e.target.value)} className={textareaCls} rows={3} placeholder="Existing tech, integrations needed, APIs, POS system, payment processors..." />
            </FormField>
            <FormField label="Onboarding Notes" span2>
              <textarea value={form.onboarding_notes} onChange={e => handleChange('onboarding_notes', e.target.value)} className={textareaCls} rows={3} placeholder="Key details from onboarding call, special requirements, timeline constraints..." />
            </FormField>
          </div>
        </div>
      )}

      {/* ── Notes ──────────────────────────────────────────────── */}
      {activeSection === 'notes' && (
        <div className="space-y-4">
          <SectionHeader
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>}
            title="Internal Notes"
            subtitle="Private notes visible only to admins — never shown to clients"
          />
          <div className="space-y-4">
            <FormField label="Internal Notes" span2>
              <textarea value={form.internal_notes} onChange={e => handleChange('internal_notes', e.target.value)} className={textareaCls} rows={5} placeholder="Private notes about this customer — relationship context, preferences, red flags, VIP treatment, etc." />
            </FormField>
          </div>
        </div>
      )}

      {/* Save bar — always visible */}
      <div className="sticky bottom-0 bg-navy-900/95 backdrop-blur border-t border-navy-700/30 -mx-6 px-6 py-4 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
          ) : saved ? (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved!</>
          ) : (
            'Save Changes'
          )}
        </button>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {saved && <p className="text-xs text-emerald-400">All changes saved to database</p>}
      </div>
    </div>
  )
}

// ─── Wave F: Estimates / Agreements / Tasks / Notes tabs ──────────────────────

function _esStatusColor(s) {
  const map = {
    draft: 'bg-gray-500/20 text-gray-400',
    sent: 'bg-blue-500/20 text-blue-400',
    viewed: 'bg-sky-500/20 text-sky-400',
    accepted: 'bg-emerald-500/20 text-emerald-400',
    declined: 'bg-red-500/20 text-red-400',
    expired: 'bg-amber-500/20 text-amber-400',
    signed: 'bg-emerald-500/20 text-emerald-400',
    active: 'bg-emerald-500/20 text-emerald-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    terminated: 'bg-red-500/20 text-red-400',
  }
  return map[(s || '').toLowerCase()] || 'bg-gray-500/20 text-gray-400'
}

function _priorityColor(p) {
  const map = {
    low: 'bg-gray-500/20 text-gray-400',
    medium: 'bg-blue-500/20 text-blue-400',
    high: 'bg-amber-500/20 text-amber-400',
    urgent: 'bg-red-500/20 text-red-400',
  }
  return map[(p || 'medium').toLowerCase()] || map.medium
}

function EmptyState({ icon, title, hint }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl text-center py-12">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm text-white font-medium">{title}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

const PL_TYPES = ['CRM', 'Website', 'Custom Build', 'Consulting']
const PL_STAGES = STAGE_PIPELINE.filter(s => s !== 'Lost')
const PL_TYPE_COLOR = {
  'CRM': 'bg-brand-blue/20 text-brand-blue',
  'Website': 'bg-emerald-500/20 text-emerald-400',
  'Custom Build': 'bg-violet-500/20 text-violet-400',
  'Consulting': 'bg-amber-500/20 text-amber-400',
}
const PL_PROJECT_TYPE = { 'CRM': 'CRM', 'Website': 'Websites', 'Custom Build': 'Custom Builds' }

function ProductLinesTab({ customerId, customer, lines, onChange }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ product_type: 'CRM', stage: 'New Lead', estimated_value: '', mrr: '', term_months: '', expected_close_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [editId, setEditId] = useState(null)

  const EMPTY_FORM = { product_type: 'CRM', stage: 'New Lead', estimated_value: '', mrr: '', term_months: '', expected_close_date: '', notes: '' }
  function openAdd() { setEditId(null); setForm(EMPTY_FORM); setOpen(true) }
  function closeForm() { setOpen(false); setEditId(null) }
  function startEdit(l) {
    setForm({
      product_type: l.product_type || 'CRM',
      stage: l.stage || 'New Lead',
      estimated_value: l.estimated_value ?? '',
      mrr: l.mrr ?? '',
      term_months: l.term_months ?? '',
      expected_close_date: l.expected_close_date || '',
      notes: l.notes || '',
    })
    setEditId(l.id)
    setOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        product_type: form.product_type,
        stage: form.stage,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : 0,
        mrr: form.mrr ? Number(form.mrr) : 0,
        term_months: form.term_months ? Number(form.term_months) : null,
        expected_close_date: form.expected_close_date || null,
        notes: form.notes || null,
      }
      const table = supabase.from('customer_product_lines')
      if (editId) {
        const { error } = await table.update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
        if (error) throw error
        const el = (lines || []).find(l => l.id === editId); if (el) await syncProjectStage(el, form.stage)
      } else {
        const { data: newLine, error } = await table.insert({ profile_id: customerId, ...payload }).select().single()
        if (error) throw error
        // Auto-create a linked Operations project so every build is visible to Operations (skip Consulting).
        if (form.product_type !== 'Consulting' && PL_PROJECT_TYPE[form.product_type]) {
          const buildFor = customer.company_name || customer.full_name || 'the customer'
          const { data: proj } = await supabase.from('projects').insert({
            name: (customer.company_name || customer.full_name || 'Customer') + ' - ' + form.product_type,
            project_type: PL_PROJECT_TYPE[form.product_type],
            status: form.stage,
            tier: 'Starter',
            customer_id: customerId,
            client_display_name: customer.company_name || customer.full_name || null,
            mrr: form.mrr ? Number(form.mrr) : 0,
            brief: 'New ' + form.product_type + ' build for ' + buildFor + '.',
            next_action: 'Kickoff — scope the ' + form.product_type + ' build & write the brief',
            next_action_due: form.expected_close_date || null,
          }).select().single()
          if (proj && proj.id) await supabase.from('customer_product_lines').update({ project_id: proj.id, updated_at: new Date().toISOString() }).eq('id', newLine.id)
        }
      }
      setForm(EMPTY_FORM)
      setOpen(false)
      setEditId(null)
      await syncArchived()
      onChange()
    } catch (e) { console.error(e); alert('Failed to save product line: ' + (e.message || '')) }
    finally { setSaving(false) }
  }

  async function setStage(line, stage) {
    setBusyId(line.id)
    try {
      const { error } = await supabase.from('customer_product_lines').update({ stage, updated_at: new Date().toISOString() }).eq('id', line.id)
      if (error) throw error
      await syncProjectStage(line, stage)
      onChange()
    } catch (e) { console.error(e); alert('Failed to update stage') } finally { setBusyId(null) }
  }

  async function markWon(line) {
    const hasProject = !!line.project_id
    if (!window.confirm('Mark this ' + line.product_type + ' line as Won' + (!hasProject && line.product_type !== 'Consulting' ? ' and create an Operations project?' : '?'))) return
    setBusyId(line.id)
    try {
      let projectId = line.project_id || null
      if (projectId) {
        // Already linked to an Operations project — just advance it (no duplicate).
        await supabase.from('projects').update({ status: 'Onboarding Scheduled', updated_at: new Date().toISOString() }).eq('id', projectId)
      } else if (line.product_type !== 'Consulting') {
        const { data: proj, error: pErr } = await supabase.from('projects').insert({
          name: (customer.company_name || customer.full_name || 'Customer') + ' - ' + line.product_type,
          project_type: PL_PROJECT_TYPE[line.product_type],
          status: 'Onboarding Scheduled',
          customer_id: customerId,
          client_display_name: customer.company_name || customer.full_name || null,
          mrr: Number(line.mrr) || 0,
        }).select().single()
        if (pErr) throw pErr
        projectId = proj.id
      }
      const { error } = await supabase.from('customer_product_lines').update({
        stage: 'Onboarding Scheduled', won_at: new Date().toISOString(), project_id: projectId, updated_at: new Date().toISOString(),
      }).eq('id', line.id)
      if (error) throw error
      onChange()
    } catch (e) { console.error(e); alert('Failed to mark won: ' + (e.message || '')) } finally { setBusyId(null) }
  }

  async function markLost(line) {
    setBusyId(line.id)
    try {
      const { error } = await supabase.from('customer_product_lines').update({ stage: 'Lost', lost_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', line.id)
      if (error) throw error
      await syncProjectStage(line, 'Lost')
      await syncArchived()
      onChange()
    } catch (e) { console.error(e); alert('Failed to mark lost') } finally { setBusyId(null) }
  }

  // Archive the customer when no active (non-lost) product lines remain; un-archive when one returns.
  async function syncArchived() {
    const { data: ls } = await supabase.from('customer_product_lines').select('stage, lost_at').eq('profile_id', customerId)
    const arr = ls || []
    const hasActive = arr.some(l => !(l.stage === 'Lost' || l.lost_at))
    const archived_at = (arr.length > 0 && !hasActive) ? new Date().toISOString() : null
    await supabase.from('profiles').update({ archived_at, updated_at: new Date().toISOString() }).eq('id', customerId)
  }

  // Keep a linked Operations project's status in sync with the product line stage (shared pipeline).
  async function syncProjectStage(line, stage) {
    if (!line || !line.project_id) return
    await supabase.from('projects').update({ status: stage, updated_at: new Date().toISOString() }).eq('id', line.project_id)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{lines.length} product line{lines.length !== 1 ? 's' : ''}. A customer can run several at once.</p>
        <button onClick={() => open ? closeForm() : openAdd()} className="px-3 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg font-medium">{open ? 'Cancel' : '+ New Product Line'}</button>
      </div>
      {open && (
        <div className="bg-navy-800 border border-brand-blue/30 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-200">{editId ? 'Edit product line' : 'New product line'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">Product type</label>
              <select value={form.product_type} onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
                {PL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">Stage</label>
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
                {PL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">One-time setup ($)</label>
              <input type="number" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} placeholder="0" className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">MRR ($ / month)</label>
              <input type="number" value={form.mrr} onChange={e => setForm(f => ({ ...f, mrr: e.target.value }))} placeholder="0" className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">Term (months)</label>
              <input type="number" value={form.term_months} onChange={e => setForm(f => ({ ...f, term_months: e.target.value }))} placeholder="e.g. 12" className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">Expected close</label>
              <input type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" style={{ colorScheme: 'dark' }} />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-gray-400 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg font-medium">{saving ? 'Saving...' : (editId ? 'Save Changes' : 'Add Line')}</button>
          </div>
        </div>
      )}
      {lines.length === 0 && !open ? (
        <EmptyState icon="*" title="No product lines yet" hint="Add CRM, Website, Custom Build, or Consulting lines. Each moves through its own pipeline and a won line opens an Operations project." />
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl divide-y divide-navy-700/30">
          {lines.map(l => {
            const terminal = isWon(l) || isLost(l)
            return (
              <div key={l.id} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${PL_TYPE_COLOR[l.product_type] || 'bg-gray-500/20 text-gray-400'}`}>{l.product_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${l.stage === 'Won' ? 'bg-emerald-500/20 text-emerald-400' : l.stage === 'Lost' ? 'bg-red-500/20 text-red-400' : 'bg-navy-700/60 text-gray-300'}`}>{l.stage}</span>
                    {l.estimated_value > 0 && <span className="text-xs text-emerald-400 font-semibold">{formatCurrency(l.estimated_value)} setup</span>}
                    {l.mrr > 0 && <span className="text-xs text-amber-400 font-semibold">{formatCurrency(l.mrr)}/mo</span>}
                    {l.mrr > 0 && <span className="text-[11px] text-amber-400/70">{formatCurrency(l.mrr * 12)} ARR</span>}
                    {l.term_months > 0 && <span className="text-[11px] text-gray-400">{l.term_months}mo term</span>}
                    {l.project?.name && <span className="text-xs text-brand-blue">-&gt; {l.project.name}</span>}
                  </div>
                  {l.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{l.notes}</p>}
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                    {l.expected_close_date && <span>Expected close {formatDate(l.expected_close_date)}</span>}
                    {l.won_at && <span className="text-emerald-400">Won {formatDate(l.won_at)}</span>}
                    {l.lost_at && <span className="text-red-400">Lost {formatDate(l.lost_at)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(l)} className="px-2.5 py-1 text-xs text-gray-300 hover:text-white border border-navy-700/60 rounded-lg">Edit</button>
                  {!terminal && (
                    <>
                      <select value={l.stage} onChange={e => setStage(l, e.target.value)} disabled={busyId === l.id} className="bg-navy-900 border border-navy-700/50 rounded-lg px-2 py-1 text-xs text-white">
                        {PL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => markWon(l)} disabled={busyId === l.id} className="px-2.5 py-1 text-xs bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50">Won</button>
                      <button onClick={() => markLost(l)} disabled={busyId === l.id} className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-400">Lost</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EstimatesTab({ customerId, estimates, projects, productLines, onChange }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', total: '', project_id: '', valid_until: '', status: 'draft', notes: '' })
  const [saving, setSaving] = useState(false)
  const [gen, setGen] = useState(false)
  const [genSel, setGenSel] = useState({})
  const [discount, setDiscount] = useState(0)
  const [genData, setGenData] = useState(null)
  const [genBusy, setGenBusy] = useState(false)

  async function openGen() {
    const sel = {}; (productLines || []).filter(l => !isLost(l)).forEach(l => { sel[l.id] = true })
    setGenSel(sel); setOpen(false); setGen(true)
    if (!genData) {
      const { data: tmpls } = await supabase.from('estimate_product_templates').select('id, product_type').eq('is_active', true)
      const tIds = (tmpls || []).map(t => t.id)
      const { data: its } = await supabase.from('estimate_product_template_items').select('*').in('template_id', tIds).order('sort_order')
      const typeByTid = {}; (tmpls || []).forEach(t => { typeByTid[t.id] = t.product_type })
      const itemsByType = {}, typeTotals = {}
      ;(its || []).forEach(i => { const ty = typeByTid[i.template_id]; if (!ty) return; (itemsByType[ty] = itemsByType[ty] || []).push(i) })
      Object.entries(itemsByType).forEach(([ty, list]) => {
        typeTotals[ty] = {
          oneTime: list.filter(i => !i.recurring).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_cost) || 0), 0),
          monthly: list.filter(i => i.recurring).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_cost) || 0), 0),
        }
      })
      setGenData({ itemsByType, typeTotals })
    }
  }

  async function buildAndSave() {
    setGenBusy(true)
    try {
      const selLines = (productLines || []).filter(l => genSel[l.id] && !isLost(l))
      if (!selLines.length) { alert('Select at least one product line'); setGenBusy(false); return }
      const lineItems = []
      selLines.forEach(l => {
        ((genData && genData.itemsByType[l.product_type]) || []).forEach(i => {
          const qty = Number(i.qty) || 1, unit = Number(i.unit_cost) || 0
          lineItems.push({ product: l.product_type, label: i.label, category: i.category, qty, unit_cost: unit, line_total: qty * unit, recurring: !!i.recurring })
        })
      })
      const oneTime = lineItems.filter(l => !l.recurring).reduce((s, l) => s + l.line_total, 0)
      const monthly = lineItems.filter(l => l.recurring).reduce((s, l) => s + l.line_total, 0)
      const discountAmount = Math.round(oneTime * (Number(discount) || 0) / 100)
      const types = [...new Set(selLines.map(l => l.product_type))]
      const n = (estimates || []).length + 1
      const { error } = await supabase.from('customer_estimates').insert({
        contact_id: customerId,
        estimate_number: 'EST-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0'),
        title: types.join(' + ') + ' estimate',
        line_items: lineItems,
        subtotal: oneTime,
        discount_amount: discountAmount,
        total: oneTime - discountAmount,
        status: 'draft',
        notes: monthly > 0 ? ('Plus $' + monthly.toLocaleString() + '/mo recurring') : null,
      })
      if (error) throw error
      setGen(false); setDiscount(0); setGenSel({})
      onChange()
    } catch (e) { console.error(e); alert('Failed to generate estimate: ' + (e.message || '')) }
    finally { setGenBusy(false) }
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const n = (estimates || []).length + 1
      const { error } = await supabase.from('customer_estimates').insert({
        contact_id: customerId,
        project_id: form.project_id || null,
        estimate_number: 'EST-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0'),
        title: form.title.trim(),
        total: form.total ? Number(form.total) : 0,
        subtotal: form.total ? Number(form.total) : 0,
        valid_until: form.valid_until || null,
        status: form.status,
        notes: form.notes || null,
      })
      if (error) throw error
      setForm({ title: '', total: '', project_id: '', valid_until: '', status: 'draft', notes: '' })
      setOpen(false)
      onChange()
    } catch (e) { console.error(e); alert('Failed to save estimate') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{estimates.length} estimate{estimates.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={() => gen ? setGen(false) : openGen()} className="px-3 py-1.5 text-xs bg-amber-500/90 hover:bg-amber-500 text-white rounded-lg font-medium">{gen ? 'Cancel' : '⚡ Generate from product lines'}</button>
          <button onClick={() => { setGen(false); setOpen(o => !o) }} className="px-3 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg font-medium">
            {open ? 'Cancel' : '+ New Estimate'}
          </button>
        </div>
      </div>
      {gen && (() => {
        const selLines = (productLines || []).filter(l => genSel[l.id] && !isLost(l))
        const oneTime = selLines.reduce((s, l) => s + ((genData && genData.typeTotals[l.product_type]?.oneTime) || 0), 0)
        const monthly = selLines.reduce((s, l) => s + ((genData && genData.typeTotals[l.product_type]?.monthly) || 0), 0)
        const discAmt = Math.round(oneTime * (Number(discount) || 0) / 100)
        const fmtc = (n) => '$' + Math.round(n).toLocaleString()
        const openLines = (productLines || []).filter(l => !isLost(l))
        return (
          <div className="bg-navy-800 border border-amber-500/30 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-300">Combo estimate from product lines</p>
            {openLines.length === 0 ? (
              <p className="text-xs text-gray-500">No open product lines to estimate.</p>
            ) : (
              <>
                <div className="space-y-1">
                  {openLines.map(l => (
                    <label key={l.id} className="flex items-center gap-2 text-sm text-gray-300">
                      <input type="checkbox" checked={!!genSel[l.id]} onChange={e => setGenSel(s => ({ ...s, [l.id]: e.target.checked }))} />
                      <span>{l.product_type}</span>
                      <span className="text-[11px] text-gray-500">{fmtc((genData && genData.typeTotals[l.product_type]?.oneTime) || 0)}{((genData && genData.typeTotals[l.product_type]?.monthly) || 0) > 0 ? ` + ${fmtc(genData.typeTotals[l.product_type].monthly)}/mo` : ''}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">Bundle discount %</span>
                  <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-20 bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-xs text-white" />
                </div>
                <div className="text-sm text-gray-300 border-t border-navy-700/40 pt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span>One-time: <span className="text-emerald-400 font-semibold">{fmtc(oneTime)}</span></span>
                  {discAmt > 0 && <span>Discount: <span className="text-red-400">-{fmtc(discAmt)}</span></span>}
                  <span>Total: <span className="text-white font-bold">{fmtc(oneTime - discAmt)}</span></span>
                  {monthly > 0 && <span>Recurring: <span className="text-amber-400 font-semibold">{fmtc(monthly)}/mo</span></span>}
                </div>
                <div className="flex justify-end">
                  <button onClick={buildAndSave} disabled={genBusy || selLines.length === 0} className="px-4 py-1.5 text-xs bg-amber-500/90 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-medium">{genBusy ? 'Creating...' : 'Create estimate'}</button>
                </div>
              </>
            )}
          </div>
        )
      })()}
      {open && (
        <div className="bg-navy-800 border border-brand-blue/30 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title (e.g., Initial scope)" className="col-span-2 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
            <input type="number" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} placeholder="Total $" className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
              <option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="declined">Declined</option>
            </select>
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Link to project (optional)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" style={{ colorScheme: 'dark' }} />
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} className="col-span-2 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="px-4 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg font-medium">{saving ? 'Saving...' : 'Save Estimate'}</button>
          </div>
        </div>
      )}
      {estimates.length === 0 && !open ? (
        <EmptyState icon="📋" title="No estimates yet" hint="Use 'New Estimate' to draft one." />
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl divide-y divide-navy-700/30">
          {estimates.map(e => (
            <Link key={e.id} to={`/admin/estimate/${e.id}`} className="p-4 flex items-start gap-3 hover:bg-navy-700/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white">{e.title || 'Untitled estimate'}</p>
                  <span className="text-xs text-gray-500 font-mono">{e.estimate_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${_esStatusColor(e.status)}`}>{e.status || 'draft'}</span>
                  {e.esign_status === 'signed' && <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">e-signed</span>}
                </div>
                {e.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{e.description}</p>}
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                  {e.valid_until && <span>Valid until {formatDate(e.valid_until)}</span>}
                  {e.sent_at && <span>Sent {formatDate(e.sent_at)}</span>}
                  {e.esign_signed_at && <span className="text-emerald-400">Signed {formatDate(e.esign_signed_at)}</span>}
                  {Array.isArray(e.line_items) && e.line_items.length > 0 && <span>{e.line_items.length} lines</span>}
                  <span className="ml-auto text-xs text-emerald-400 font-semibold">{formatCurrency(e.total)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function AgreementsTab({ customerId, agreements, estimates, projects, onChange }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', total_value: '', project_id: '', estimate_id: '', agreement_type: 'msa', start_date: '', end_date: '', status: 'draft', payment_terms: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const n = (agreements || []).length + 1
      const { error } = await supabase.from('customer_agreements').insert({
        contact_id: customerId,
        project_id: form.project_id || null,
        estimate_id: form.estimate_id || null,
        agreement_number: 'AGR-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0'),
        title: form.title.trim(),
        agreement_type: form.agreement_type,
        total_value: form.total_value ? Number(form.total_value) : 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        payment_terms: form.payment_terms || null,
        notes: form.notes || null,
      })
      if (error) throw error
      setForm({ title: '', total_value: '', project_id: '', estimate_id: '', agreement_type: 'msa', start_date: '', end_date: '', status: 'draft', payment_terms: '', notes: '' })
      setOpen(false)
      onChange()
    } catch (e) { console.error(e); alert('Failed to save agreement') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{agreements.length} agreement{agreements.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setOpen(o => !o)} className="px-3 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg font-medium">
          {open ? 'Cancel' : '+ New Agreement'}
        </button>
      </div>
      {open && (
        <div className="bg-navy-800 border border-brand-blue/30 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title (e.g., MSA - City of Jacksonville)" className="col-span-2 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
            <select value={form.agreement_type} onChange={e => setForm(f => ({ ...f, agreement_type: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
              <option value="msa">MSA</option><option value="sow">SOW</option><option value="proposal">Proposal</option><option value="nda">NDA</option><option value="contract">Contract</option><option value="other">Other</option>
            </select>
            <input type="number" value={form.total_value} onChange={e => setForm(f => ({ ...f, total_value: e.target.value }))} placeholder="Total Value $" className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} placeholder="Start" className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" style={{ colorScheme: 'dark' }} />
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} placeholder="End" className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" style={{ colorScheme: 'dark' }} />
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Link to project (optional)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.estimate_id} onChange={e => setForm(f => ({ ...f, estimate_id: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">From estimate (optional)</option>
              {estimates.map(e => <option key={e.id} value={e.id}>{e.estimate_number} - {e.title}</option>)}
            </select>
            <input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="Payment terms (e.g., Net 30)" className="col-span-2 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} className="col-span-2 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="px-4 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg font-medium">{saving ? 'Saving...' : 'Save Agreement'}</button>
          </div>
        </div>
      )}
      {agreements.length === 0 && !open ? (
        <EmptyState icon="📄" title="No agreements yet" hint="MSA, SOW, NDA, proposals all live here." />
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl divide-y divide-navy-700/30">
          {agreements.map(a => (
            <div key={a.id} className="p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white">{a.title || 'Untitled agreement'}</p>
                  <span className="text-xs text-gray-500 font-mono">{a.agreement_number}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase">{a.agreement_type || 'doc'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${_esStatusColor(a.status)}`}>{a.status || 'draft'}</span>
                  {a.esign_status === 'signed' && <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">e-signed</span>}
                </div>
                {a.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{a.description}</p>}
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                  {a.start_date && <span>{formatDate(a.start_date)}{a.end_date ? ` - ${formatDate(a.end_date)}` : ''}</span>}
                  {a.payment_terms && <span>{a.payment_terms}</span>}
                  {a.esign_signed_at && <span className="text-emerald-400">Signed {formatDate(a.esign_signed_at)}</span>}
                  <span className="ml-auto text-xs text-emerald-400 font-semibold">{formatCurrency(a.total_value)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TasksTab({ customerId, tasks, projects, onChange }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'medium', project_id: '' })
  const [saving, setSaving] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('admin_tasks').insert({
        customer_id: customerId,
        project_id: form.project_id || null,
        title: form.title.trim(),
        description: form.description || null,
        due_date: form.due_date || null,
        priority: form.priority,
        status: 'pending',
      })
      if (error) throw error
      setForm({ title: '', description: '', due_date: '', priority: 'medium', project_id: '' })
      setOpen(false)
      onChange()
    } catch (e) { console.error(e); alert('Failed to save task') }
    finally { setSaving(false) }
  }

  async function toggleTask(task) {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    try {
      const { error } = await supabase.from('admin_tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id)
      if (error) throw error
      onChange()
    } catch (e) { console.error(e) }
  }

  const visibleTasks = showCompleted ? tasks : tasks.filter(t => t.status !== 'completed')
  const completedCount = tasks.filter(t => t.status === 'completed').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-400">{visibleTasks.length} {showCompleted ? 'total' : 'open'} task{visibleTasks.length !== 1 ? 's' : ''}</p>
          {completedCount > 0 && (
            <button onClick={() => setShowCompleted(s => !s)} className="text-xs text-gray-500 hover:text-white">
              {showCompleted ? 'Hide' : 'Show'} {completedCount} completed
            </button>
          )}
        </div>
        <button onClick={() => setOpen(o => !o)} className="px-3 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg font-medium">
          {open ? 'Cancel' : '+ New Task'}
        </button>
      </div>
      {open && (
        <div className="bg-navy-800 border border-brand-blue/30 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" className="col-span-2 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" style={{ colorScheme: 'dark' }} />
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className="col-span-2 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Customer-level (no specific project)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} className="col-span-2 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="px-4 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg font-medium">{saving ? 'Saving...' : 'Save Task'}</button>
          </div>
        </div>
      )}
      {visibleTasks.length === 0 && !open ? (
        <EmptyState icon="✓" title="No open tasks" hint="Add a follow-up, prep work, or next action." />
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl divide-y divide-navy-700/30">
          {visibleTasks.map(t => {
            const done = t.status === 'completed'
            const overdue = t.due_date && !done && new Date(t.due_date) < new Date()
            return (
              <div key={t.id} className="p-3 flex items-start gap-3">
                <button onClick={() => toggleTask(t)} className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-500 hover:border-emerald-500'}`}>
                  {done && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'text-gray-500 line-through' : 'text-white'}`}>{t.title}</p>
                  {t.description && <p className={`text-xs mt-0.5 ${done ? 'text-gray-600' : 'text-gray-400'}`}>{t.description}</p>}
                  <div className="flex items-center gap-2 text-[10px] mt-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded ${_priorityColor(t.priority)}`}>{t.priority || 'medium'}</span>
                    {t.due_date && <span className={overdue ? 'text-red-400' : 'text-gray-500'}>Due {formatDate(t.due_date)}</span>}
                    {t.projects?.name && <span className="text-gray-500">· {t.projects.name}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NotesTab({ customerId, notes, projects, onChange }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', project_id: '', pinned: false })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.body.trim() && !form.title.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('admin_notes').insert({
        customer_id: customerId,
        project_id: form.project_id || null,
        title: form.title.trim() || null,
        body: form.body.trim() || null,
        pinned: form.pinned,
      })
      if (error) throw error
      setForm({ title: '', body: '', project_id: '', pinned: false })
      setOpen(false)
      onChange()
    } catch (e) { console.error(e); alert('Failed to save note') }
    finally { setSaving(false) }
  }

  async function togglePin(note) {
    try {
      await supabase.from('admin_notes').update({ pinned: !note.pinned }).eq('id', note.id)
      onChange()
    } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setOpen(o => !o)} className="px-3 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg font-medium">
          {open ? 'Cancel' : '+ New Note'}
        </button>
      </div>
      {open && (
        <div className="bg-navy-800 border border-brand-blue/30 rounded-xl p-4 space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title (optional)" className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white" />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="What did you learn? Meeting recap, decisions, next moves..." rows={4} className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Customer-level (no specific project)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="accent-amber-400" />
              Pin to top
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg font-medium">{saving ? 'Saving...' : 'Save Note'}</button>
          </div>
        </div>
      )}
      {notes.length === 0 && !open ? (
        <EmptyState icon="📝" title="No notes yet" hint="Capture call notes, meeting recaps, internal thinking." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {notes.map(n => (
            <div key={n.id} className={`rounded-xl p-4 border ${n.pinned ? 'border-amber-500/40 bg-amber-500/5' : 'border-navy-700/50 bg-navy-800'}`}>
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  {n.title && <p className="text-sm font-semibold text-white">{n.title}</p>}
                  <p className="text-[10px] text-gray-500">{formatDate(n.created_at)}{n.profiles?.full_name ? ' · ' + n.profiles.full_name : ''}</p>
                </div>
                <button onClick={() => togglePin(n)} className={`text-xs ${n.pinned ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400'}`} title={n.pinned ? 'Unpin' : 'Pin'}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.366 2.445a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.175 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>
                </button>
              </div>
              {n.body && <p className="text-sm text-gray-300 whitespace-pre-wrap">{n.body}</p>}
              {n.projects?.name && <p className="text-[10px] text-gray-500 mt-2">· {n.projects.name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CustomerDetail() {
  const { id } = useParams()

  const [customer, setCustomer] = useState(null)
  const [projects, setProjects] = useState([])
  const [messages, setMessages] = useState([])
  const [invoices, setInvoices] = useState([])
  const [updates, setUpdates] = useState([])
  // Wave F additions
  const [estimates, setEstimates] = useState([])
  const [agreements, setAgreements] = useState([])
  const [tasks, setTasks] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [productLines, setProductLines] = useState([])
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchAll()
  }, [id])

  async function fetchAll() {
    setLoading(true)
    try {
      // Fetch customer profile
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()
      if (profileErr) throw profileErr
      setCustomer(profile)

      // Fetch projects for this customer
      const { data: projs, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
      if (projErr) throw projErr
      const projList = projs || []
      setProjects(projList)

      const projectIds = projList.map(p => p.id)

      // Parallel fetch project-scoped + customer-scoped data
      const projectIdList = projectIds.length > 0 ? projectIds : ['00000000-0000-0000-0000-000000000000']
      const [
        { data: msgs },
        { data: invs },
        { data: upds },
        { data: ests },
        { data: agrs },
        { data: tks },
        { data: nts },
      ] = await Promise.all([
        projectIds.length > 0 ? supabase.from('messages').select('*, projects(name)').in('project_id', projectIdList).eq('sender_id', id).order('created_at', { ascending: false }) : { data: [] },
        projectIds.length > 0 ? supabase.from('invoices').select('*, projects(name)').in('project_id', projectIdList).order('created_at', { ascending: false }) : { data: [] },
        projectIds.length > 0 ? supabase.from('project_updates').select('*, projects(name)').in('project_id', projectIdList).order('created_at', { ascending: false }) : { data: [] },
        supabase.from('customer_estimates').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('customer_agreements').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('admin_tasks').select('*, projects(name)').or(`customer_id.eq.${id}${projectIds.length > 0 ? ',project_id.in.(' + projectIds.join(',') + ')' : ''}`).order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('admin_notes').select('*, profiles!admin_notes_user_id_fkey(full_name)').or(`customer_id.eq.${id}${projectIds.length > 0 ? ',project_id.in.(' + projectIds.join(',') + ')' : ''}`).order('pinned', { ascending: false }).order('created_at', { ascending: false }),
      ])
      setMessages(msgs || [])
      setInvoices(invs || [])
      setUpdates(upds || [])
      setEstimates(ests || [])
      setAgreements(agrs || [])
      setTasks(tks || [])
      setNotes(nts || [])
      const { data: plines } = await supabase.from('customer_product_lines').select('*, project:projects(name, status)').eq('profile_id', id).order('created_at', { ascending: false })
      setProductLines(plines || [])
    } catch (err) {
      console.error('Error fetching customer detail:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Customer not found.</p>
        <Link to="/admin/customers" className="text-brand-blue text-sm hover:underline mt-2 inline-block">
          ← Back to Customers
        </Link>
      </div>
    )
  }

  const initials = getInitials(customer.full_name, customer.email)
  // Customer value rollup: weighted projections + gross full value (TCV). See lib/customerValue.
  const { mrr: customerMrr, arr: customerArr, fullValue } = customerValue(productLines)
  const activeProjects = projects.filter(p => ACTIVE_PROJECT_STATUSES.includes(p.status))
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0)

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'projects', label: `Projects (${projects.length})` },
    { key: 'lines', label: `Product Lines (${productLines.length})` },
    { key: 'estimates', label: `Estimates (${estimates.length})` },
    { key: 'agreements', label: `Agreements (${agreements.length})` },
    { key: 'tasks', label: `Tasks (${tasks.filter(t => t.status !== 'completed').length})` },
    { key: 'notes', label: `Notes (${notes.length})` },
    { key: 'messages', label: `Messages (${messages.length})` },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
    { key: 'activity', label: `Activity (${updates.length})` },
    { key: 'details', label: 'Details' },
    { key: 'edit', label: 'Edit' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Back nav */}
      <Link
        to="/admin/customers"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Customers
      </Link>

      {/* Customer header */}
      <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-brand-blue/20 flex items-center justify-center flex-shrink-0">
            {customer.avatar_url ? (
              <img src={customer.avatar_url} alt={customer.full_name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-brand-blue">{initials}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {customer.full_name || <span className="italic text-gray-500">No name</span>}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{customer.email}</p>
            {customer.company_name && <p className="text-xs text-gray-500 mt-0.5">{customer.company_name}{customer.company_industry ? ` · ${customer.company_industry}` : ''}</p>}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {customer.status && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                  customer.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' :
                  customer.status === 'Prospect' ? 'bg-blue-500/20 text-blue-400' :
                  customer.status === 'Onboarding' ? 'bg-purple-500/20 text-purple-400' :
                  customer.status === 'In Build' ? 'bg-brand-blue/20 text-brand-blue' :
                  customer.status === 'Launched' ? 'bg-emerald-500/20 text-emerald-400' :
                  customer.status === 'Churned' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {customer.status}
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400 capitalize">
                {customer.role}
              </span>
              {customer.plan_tier && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 capitalize">
                  {customer.plan_tier} plan
                </span>
              )}
              <span className="text-xs text-gray-500">Joined {formatDate(customer.created_at)}</span>
              {customer.phone && <span className="text-xs text-gray-500">{customer.phone}</span>}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 sm:gap-x-8 flex-shrink-0">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{projects.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Projects</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-brand-blue">{activeProjects.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalPaid)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Paid</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(Math.round(customerMrr))}</p>
              <p className="text-xs text-gray-500 mt-0.5">MRR</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400/80">{formatCurrency(Math.round(customerArr))}</p>
              <p className="text-xs text-gray-500 mt-0.5">ARR</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{formatCurrency(Math.round(fullValue))}</p>
              <p className="text-xs text-gray-500 mt-0.5">Full Value</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <OverviewTab customer={customer} projects={projects} messages={messages} invoices={invoices} updates={updates} estimates={estimates} agreements={agreements} tasks={tasks} notes={notes} />}
        {activeTab === 'details' && <DetailsTab customer={customer} />}
        {activeTab === 'projects' && <ProjectsTab projects={projects} />}
        {activeTab === 'lines' && <ProductLinesTab customerId={id} customer={customer} lines={productLines} onChange={fetchAll} />}
        {activeTab === 'estimates' && <EstimatesTab customerId={id} estimates={estimates} projects={projects} productLines={productLines} onChange={fetchAll} />}
        {activeTab === 'agreements' && <AgreementsTab customerId={id} agreements={agreements} estimates={estimates} projects={projects} onChange={fetchAll} />}
        {activeTab === 'tasks' && <TasksTab customerId={id} tasks={tasks} projects={projects} onChange={fetchAll} />}
        {activeTab === 'notes' && <NotesTab customerId={id} notes={notes} projects={projects} onChange={fetchAll} />}
        {activeTab === 'messages' && <MessagesTab messages={messages} />}
        {activeTab === 'invoices' && <InvoicesTab invoices={invoices} />}
        {activeTab === 'activity' && <ActivityTab updates={updates} />}
        {activeTab === 'edit' && (
          <EditTab
            customer={customer}
            onSaved={updated => setCustomer(updated)}
          />
        )}
      </div>
    </div>
  )
}
