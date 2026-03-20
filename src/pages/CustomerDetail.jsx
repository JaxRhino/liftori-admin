import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

// ─── Edit Tab ──────────────────────────────────────────────────────────────────
function EditTab({ customer, onSaved }) {
  const [form, setForm] = useState({
    full_name: customer.full_name || '',
    email: customer.email || '',
    avatar_url: customer.avatar_url || '',
    role: customer.role || 'customer',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name || null,
          email: form.email,
          avatar_url: form.avatar_url || null,
          role: form.role,
          updated_at: new Date().toISOString(),
        })
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

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Full Name
        </label>
        <input
          type="text"
          value={form.full_name}
          onChange={e => handleChange('full_name', e.target.value)}
          className="w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue/50"
          placeholder="Customer name"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={e => handleChange('email', e.target.value)}
          className="w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue/50"
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Avatar URL
        </label>
        <input
          type="url"
          value={form.avatar_url}
          onChange={e => handleChange('avatar_url', e.target.value)}
          className="w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue/50"
          placeholder="https://..."
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Role
        </label>
        <select
          value={form.role}
          onChange={e => handleChange('role', e.target.value)}
          className="w-full bg-navy-900/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
        >
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
          <option value="affiliate">Affiliate</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50"
      >
        {saving ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
        ) : saved ? (
          <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved!</>
        ) : (
          'Save Changes'
        )}
      </button>
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
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('projects')

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

      // Parallel fetch messages, invoices, updates (only if projects exist)
      if (projectIds.length > 0) {
        const [
          { data: msgs },
          { data: invs },
          { data: upds },
        ] = await Promise.all([
          supabase
            .from('messages')
            .select('*, projects(name)')
            .in('project_id', projectIds)
            .eq('sender_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('invoices')
            .select('*, projects(name)')
            .in('project_id', projectIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('project_updates')
            .select('*, projects(name)')
            .in('project_id', projectIds)
            .order('created_at', { ascending: false }),
        ])
        setMessages(msgs || [])
        setInvoices(invs || [])
        setUpdates(upds || [])
      }
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
  const activeProjects = projects.filter(p => p.status && p.status !== 'Launched' && p.status !== 'Cancelled')
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0)

  const TABS = [
    { key: 'projects', label: `Projects (${projects.length})` },
    { key: 'messages', label: `Messages (${messages.length})` },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
    { key: 'activity', label: `Activity (${updates.length})` },
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
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400 capitalize">
                {customer.role}
              </span>
              <span className="text-xs text-gray-500">Joined {formatDate(customer.created_at)}</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-6 sm:gap-8 flex-shrink-0">
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
        {activeTab === 'projects' && <ProjectsTab projects={projects} />}
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
