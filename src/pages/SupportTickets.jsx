import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const PRIORITY_COLORS = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400',
}
const STATUS_COLORS = {
  open: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  waiting_on_client: 'bg-orange-500/20 text-orange-400',
  resolved: 'bg-green-500/20 text-green-400',
  closed: 'bg-gray-500/20 text-gray-400',
}
const STATUS_LABELS = {
  open: 'Open', in_progress: 'In Progress', waiting_on_client: 'Waiting on Client',
  resolved: 'Resolved', closed: 'Closed',
}
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 }

const DEFAULT_TEMPLATES = [
  {
    id: 'ack',
    name: 'Acknowledge Receipt',
    subject: null,
    body: `Hi {{customer_name}},\n\nThanks for reaching out. I've received your ticket (#{{ticket_number}}) and will have an update for you within 24 hours.\n\nBest,\nThe Liftori Team`,
  },
  {
    id: 'investigating',
    name: 'Investigating Issue',
    subject: null,
    body: `Hi {{customer_name}},\n\nThanks for the details. We're digging into this now and will follow up as soon as we have more information.\n\nBest,\nThe Liftori Team`,
  },
  {
    id: 'need_info',
    name: 'Need More Info',
    subject: null,
    body: `Hi {{customer_name}},\n\nTo help us resolve this quickly, could you provide:\n\n1. \n2. \n3. \n\nThanks,\nThe Liftori Team`,
  },
  {
    id: 'resolved',
    name: 'Issue Resolved',
    subject: null,
    body: `Hi {{customer_name}},\n\nGood news - we've resolved the issue on ticket #{{ticket_number}}. Please let us know if you see anything else odd, otherwise we'll close this out in 48 hours.\n\nBest,\nThe Liftori Team`,
  },
  {
    id: 'feature_logged',
    name: 'Feature Request Logged',
    subject: null,
    body: `Hi {{customer_name}},\n\nGreat suggestion - we've logged this as a feature request. We'll keep you posted when it lands on the roadmap.\n\nBest,\nThe Liftori Team`,
  },
  {
    id: 'deploy_complete',
    name: 'Deploy Complete',
    subject: null,
    body: `Hi {{customer_name}},\n\nThe fix has been deployed to production. Give it a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) and let us know if you're still seeing the issue.\n\nBest,\nThe Liftori Team`,
  },
]

const SUGGESTED_TAGS = [
  'bug', 'feature-request', 'billing', 'auth', 'onboarding',
  'urgent', 'client-portal', 'admin-dashboard', 'mobile', 'deploy',
  'data-loss', 'performance', 'ui-glitch', 'integration', 'question',
]

function applyTemplate(tpl, ctx) {
  if (!tpl) return ''
  return (tpl.body || '')
    .replace(/{{customer_name}}/g, ctx.customer_name || 'there')
    .replace(/{{ticket_number}}/g, ctx.ticket_number || '')
    .replace(/{{subject}}/g, ctx.subject || '')
}

export default function SupportTickets() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [tagFilter, setTagFilter] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [replies, setReplies] = useState([])
  const [replyText, setReplyText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [replying, setReplying] = useState(false)
  const [admins, setAdmins] = useState([])
  const [showOutboundModal, setShowOutboundModal] = useState(false)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES)
  const [tagDraft, setTagDraft] = useState('')
  const repliesEndRef = useRef(null)

  useEffect(() => {
    fetchTickets()
    fetchAdmins()
    loadTemplatesFromStorage()
    const params = new URLSearchParams(window.location.search)
    const ticketId = params.get('id')
    if (ticketId) loadTicketById(ticketId)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('admin-tickets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, () => {
        fetchTickets()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, () => {
        fetchTickets()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function loadTemplatesFromStorage() {
    try {
      const raw = localStorage.getItem('support_templates_v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) setTemplates(parsed)
      }
    } catch (_e) {}
  }
  function saveTemplatesToStorage(next) {
    try {
      localStorage.setItem('support_templates_v1', JSON.stringify(next))
    } catch (_e) {}
    setTemplates(next)
  }

  async function fetchTickets() {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      const enriched = await Promise.all((data || []).map(async (t) => {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', t.customer_id)
          .single()
        const { data: assignedProf } = t.assigned_to ? await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', t.assigned_to)
          .single() : { data: null }
        return {
          ...t,
          customer_name: prof?.full_name || 'Unknown',
          customer_email: prof?.email || null,
          assigned_name: assignedProf?.full_name || null,
        }
      }))
      setTickets(enriched)
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAdmins() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'dev'])
    setAdmins(data || [])
  }

  async function loadTicketById(id) {
    const { data } = await supabase.from('support_tickets').select('*').eq('id', id).single()
    if (data) {
      const { data: prof } = await supabase.from('profiles').select('full_name, email').eq('id', data.customer_id).single()
      openTicket({ ...data, customer_name: prof?.full_name || 'Unknown', customer_email: prof?.email || null })
    }
  }

  async function openTicket(ticket) {
    setSelected(ticket)
    const { data } = await supabase
      .from('ticket_replies')
      .select('*, profiles:user_id(full_name, role)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
    setReplies(data || [])
    setTagDraft('')
    setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function updateTicket(field, value) {
    const { error } = await supabase
      .from('support_tickets')
      .update({ [field]: value })
      .eq('id', selected.id)
    if (!error) {
      setSelected(prev => ({ ...prev, [field]: value }))
      fetchTickets()
    }
  }

  async function addTag(tag) {
    if (!selected || !tag) return
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!clean) return
    const current = Array.isArray(selected.tags) ? selected.tags : []
    if (current.includes(clean)) return
    const next = [...current, clean]
    await updateTicket('tags', next)
    setTagDraft('')
  }

  async function removeTag(tag) {
    if (!selected) return
    const current = Array.isArray(selected.tags) ? selected.tags : []
    const next = current.filter(t => t !== tag)
    await updateTicket('tags', next)
  }

  function applyTemplateToReply(tpl) {
    const ctx = {
      customer_name: (selected?.customer_name || '').split(' ')[0] || 'there',
      ticket_number: selected?.ticket_number || '',
      subject: selected?.subject || '',
    }
    setReplyText(applyTemplate(tpl, ctx))
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!replyText.trim()) return
    setReplying(true)
    try {
      const { error } = await supabase
        .from('ticket_replies')
        .insert({
          ticket_id: selected.id,
          user_id: user.id,
          body: replyText.trim(),
          is_internal: isInternal,
        })
      if (error) throw error

      if (!isInternal) {
        await supabase.from('notifications').insert({
          user_id: selected.customer_id,
          type: 'ticket_reply',
          title: `Reply on Ticket #${selected.ticket_number}`,
          body: replyText.trim().substring(0, 100),
          link: `/portal/support`,
        })
        if (selected.status === 'open') {
          updateTicket('status', 'in_progress')
        }
      }

      setReplyText('')
      setIsInternal(false)
      openTicket(selected)
    } catch (err) {
      console.error('Error submitting reply:', err)
    } finally {
      setReplying(false)
    }
  }

  function slaStatus(ticket) {
    if (!ticket.sla_deadline) return null
    const now = new Date()
    const deadline = new Date(ticket.sla_deadline)
    const hoursLeft = (deadline - now) / (1000 * 60 * 60)
    if (hoursLeft < 0) return { label: 'SLA Breached', color: 'text-red-400' }
    if (hoursLeft < 4) return { label: `${Math.round(hoursLeft)}h left`, color: 'text-orange-400' }
    return { label: `${Math.round(hoursLeft)}h left`, color: 'text-gray-400' }
  }

  const allTags = useMemo(() => {
    const set = new Set()
    tickets.forEach(t => {
      if (Array.isArray(t.tags)) t.tags.forEach(tag => set.add(tag))
    })
    return Array.from(set).sort()
  }, [tickets])

  const filtered = tickets.filter(t => {
    if (filter === 'open' && !['open', 'in_progress', 'waiting_on_client'].includes(t.status)) return false
    if (filter === 'resolved' && t.status !== 'resolved') return false
    if (filter === 'closed' && t.status !== 'closed') return false
    if (tagFilter && !(Array.isArray(t.tags) && t.tags.includes(tagFilter))) return false
    if (searchQ) {
      const q = searchQ.toLowerCase()
      const hay = `${t.subject || ''} ${t.description || ''} ${t.customer_name || ''} ${t.ticket_number || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  const counts = {
    open: tickets.filter(t => ['open', 'in_progress', 'waiting_on_client'].includes(t.status)).length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    all: tickets.length,
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Support Tickets</h1>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Templates ({templates.length})
          </button>
          <button
            onClick={() => setShowOutboundModal(true)}
            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            + New Outbound Ticket
          </button>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
            {[
              { key: 'open', label: `Active (${counts.open})` },
              { key: 'resolved', label: `Resolved (${counts.resolved})` },
              { key: 'closed', label: `Closed (${counts.closed})` },
              { key: 'all', label: `All (${counts.all})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === f.key ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search + tag filter strip */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Search subject, description, customer..."
          className="flex-1 min-w-[220px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-sky-500"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Tag:</span>
          <button
            onClick={() => setTagFilter('')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              !tagFilter ? 'bg-sky-500 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          {allTags.slice(0, 12).map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                tagFilter === tag ? 'bg-sky-500 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'
              }`}
            >
              {tag}
            </button>
          ))}
          {allTags.length === 0 && (
            <span className="text-[11px] text-gray-600 italic">No tags yet</span>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Ticket List */}
        <div className={`${selected ? 'w-1/3' : 'w-full'} transition-all`}>
          {filtered.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center text-gray-500 text-sm">
              No tickets match the current filter
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-700/50">
              {filtered.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors ${
                    selected?.id === ticket.id ? 'bg-sky-500/10 border-l-2 border-l-sky-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-gray-500">#{ticket.ticket_number}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[ticket.status]}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                    {Array.isArray(ticket.tags) && ticket.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px]">
                        {tag}
                      </span>
                    ))}
                    {slaStatus(ticket) && (
                      <span className={`text-[10px] ml-auto ${slaStatus(ticket).color}`}>{slaStatus(ticket).label}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white truncate">{ticket.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ticket.customer_name} · {new Date(ticket.created_at).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="flex-1 min-w-0">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-gray-500">Ticket #{selected.ticket_number}</p>
                    <button onClick={() => setSelected(null)} className="text-xs text-gray-500 hover:text-white ml-auto">Close</button>
                  </div>
                  <h2 className="text-lg font-bold text-white">{selected.subject}</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    From: {selected.customer_name || 'Unknown'}
                    {selected.customer_email && <span className="text-gray-500"> · {selected.customer_email}</span>}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap mb-4">{selected.description}</p>

              {/* Tags */}
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Tags</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {Array.isArray(selected.tags) && selected.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] flex items-center gap-1">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-purple-400 hover:text-white text-[10px]"
                        title="Remove tag"
                      >
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagDraft}
                    onChange={e => setTagDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); addTag(tagDraft) }
                    }}
                    placeholder="Add tag..."
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-white text-[11px] w-28 focus:outline-none focus:border-sky-500"
                    list="suggested-tags"
                  />
                  <datalist id="suggested-tags">
                    {SUGGESTED_TAGS.map(t => <option key={t} value={t} />)}
                  </datalist>
                  {tagDraft && (
                    <button
                      onClick={() => addTag(tagDraft)}
                      className="text-[11px] text-sky-400 hover:text-sky-300"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select
                    value={selected.status}
                    onChange={e => updateTicket('status', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-xs"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_on_client">Waiting on Client</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Priority</label>
                  <select
                    value={selected.priority}
                    onChange={e => updateTicket('priority', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
                  <select
                    value={selected.assigned_to || ''}
                    onChange={e => updateTicket('assigned_to', e.target.value || null)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-xs"
                  >
                    <option value="">Unassigned</option>
                    {admins.map(a => (
                      <option key={a.id} value={a.id}>{a.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Replies */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center">
                <h3 className="text-white font-semibold text-sm">Conversation</h3>
                <span className="ml-auto text-xs text-gray-500">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-700/50">
                {replies.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">No replies yet</div>
                ) : (
                  replies.map(reply => {
                    const isAdmin = reply.profiles?.role === 'admin' || reply.profiles?.role === 'dev'
                    return (
                      <div key={reply.id} className={`px-4 py-3 ${reply.is_internal ? 'bg-yellow-500/5 border-l-2 border-l-yellow-500/50' : isAdmin ? 'bg-sky-500/5' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isAdmin ? 'bg-sky-500/20 text-sky-400' : 'bg-purple-500/20 text-purple-400'}`}>
                            {(reply.profiles?.full_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-white">{reply.profiles?.full_name || 'Unknown'}</span>
                          {reply.is_internal && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">Internal Note</span>}
                          {isAdmin && !reply.is_internal && <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded-full">Team</span>}
                          <span className="text-xs text-gray-500 ml-auto">{new Date(reply.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap ml-8">{reply.body}</p>
                      </div>
                    )
                  })
                )}
                <div ref={repliesEndRef} />
              </div>
            </div>

            {/* Template picker + Reply Input */}
            <form onSubmit={submitReply} className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Quick templates:</span>
                {templates.slice(0, 6).map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplateToReply(tpl)}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 hover:border-sky-500 text-gray-300 hover:text-white rounded text-[11px] transition-colors"
                  >
                    {tpl.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowTemplatesModal(true)}
                  className="text-[11px] text-sky-400 hover:text-sky-300"
                >
                  Manage
                </button>
              </div>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={isInternal ? "Internal note (not visible to client)..." : "Reply to customer..."}
                rows={replyText.split('\n').length > 2 ? 4 : 2}
                className={`w-full bg-slate-800 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none resize-none ${
                  isInternal ? 'border-yellow-500/50 focus:border-yellow-500' : 'border-slate-700 focus:border-sky-500'
                }`}
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={e => setIsInternal(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-xs text-gray-400">Internal note (only visible to team)</span>
                </label>
                <button
                  type="submit"
                  disabled={replying || !replyText.trim()}
                  className="ml-auto px-5 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                  {replying ? 'Sending...' : isInternal ? 'Save Note' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {showOutboundModal && (
        <OutboundTicketModal
          onClose={() => setShowOutboundModal(false)}
          onSaved={() => { setShowOutboundModal(false); fetchTickets() }}
          currentUserId={user?.id}
        />
      )}

      {showTemplatesModal && (
        <TemplatesModal
          templates={templates}
          onSave={saveTemplatesToStorage}
          onClose={() => setShowTemplatesModal(false)}
        />
      )}
    </div>
  )
}

function OutboundTicketModal({ onClose, onSaved, currentUserId }) {
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('role', 'customer')
      .order('full_name', { ascending: true })
    setCustomers(data || [])
  }

  const filteredCustomers = useMemo(() => {
    if (!searchQ) return customers
    const q = searchQ.toLowerCase()
    return customers.filter(c =>
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  }, [customers, searchQ])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!customerId || !subject.trim() || !description.trim()) return
    setSaving(true)
    try {
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean)
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          customer_id: customerId,
          subject: subject.trim(),
          description: description.trim(),
          priority,
          status: 'open',
          tags: tagArray,
          created_by_admin: currentUserId || null,
        })
        .select()
        .single()
      if (error) throw error

      // Notify customer of new outbound ticket
      if (ticket) {
        await supabase.from('notifications').insert({
          user_id: customerId,
          type: 'ticket_opened',
          title: `New message from Liftori: ${subject.trim()}`,
          body: description.trim().substring(0, 120),
          link: `/portal/support`,
        })
      }
      onSaved()
    } catch (err) {
      console.error('Error creating outbound ticket:', err)
      alert('Could not create ticket: ' + (err.message || 'unknown error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">New Outbound Ticket</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Open a ticket on behalf of a client to proactively communicate (e.g. heads up about a deploy, new feature, billing question, etc.). Client will receive an in-portal notification.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Customer</label>
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-sky-500"
            />
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              required
            >
              <option value="">Select customer...</option>
              {filteredCustomers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name || 'Unnamed'}{c.email ? ` - ${c.email}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">{filteredCustomers.length} customer{filteredCustomers.length === 1 ? '' : 's'} shown</p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Scheduled maintenance window tomorrow"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Message</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Body of the outbound message..."
              rows={6}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="deploy, heads-up"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !customerId || !subject.trim() || !description.trim()}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Send Outbound Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TemplatesModal({ templates, onSave, onClose }) {
  const [list, setList] = useState(templates)
  const [editing, setEditing] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [draftBody, setDraftBody] = useState('')

  function startEdit(tpl) {
    setEditing(tpl.id)
    setDraftName(tpl.name)
    setDraftBody(tpl.body)
  }
  function startNew() {
    setEditing('new')
    setDraftName('')
    setDraftBody('')
  }
  function saveEdit() {
    if (!draftName.trim() || !draftBody.trim()) return
    let next
    if (editing === 'new') {
      next = [...list, { id: `tpl_${Date.now()}`, name: draftName.trim(), body: draftBody }]
    } else {
      next = list.map(t => t.id === editing ? { ...t, name: draftName.trim(), body: draftBody } : t)
    }
    setList(next)
    setEditing(null)
  }
  function deleteTpl(id) {
    if (!confirm('Delete this template?')) return
    setList(list.filter(t => t.id !== id))
  }
  function handleClose() {
    onSave(list)
    onClose()
  }
  function resetDefaults() {
    if (!confirm('Reset to default templates? Your custom templates will be lost.')) return
    setList(DEFAULT_TEMPLATES)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Reply Templates</h2>
          <div className="flex items-center gap-2">
            <button onClick={resetDefaults} className="text-[11px] text-gray-400 hover:text-white">Reset to defaults</button>
            <button onClick={handleClose} className="text-gray-400 hover:text-white text-sm">Close & save</button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Use <code className="bg-slate-800 px-1 rounded text-sky-300">{'{{customer_name}}'}</code>, <code className="bg-slate-800 px-1 rounded text-sky-300">{'{{ticket_number}}'}</code>, or <code className="bg-slate-800 px-1 rounded text-sky-300">{'{{subject}}'}</code> as placeholders. Templates save to this browser only.
        </p>

        {editing ? (
          <div className="space-y-3 mb-4 bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Template name</label>
              <input
                type="text"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Template body</label>
              <textarea
                value={draftBody}
                onChange={e => setDraftBody(e.target.value)}
                rows={8}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 resize-none font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium">Cancel</button>
              <button onClick={saveEdit} disabled={!draftName.trim() || !draftBody.trim()} className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                Save template
              </button>
            </div>
          </div>
        ) : (
          <button onClick={startNew} className="mb-4 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium">
            + New template
          </button>
        )}

        <div className="space-y-2">
          {list.map(tpl => (
            <div key={tpl.id} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-white">{tpl.name}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(tpl)} className="text-[11px] text-sky-400 hover:text-sky-300">Edit</button>
                  <button onClick={() => deleteTpl(tpl.id)} className="text-[11px] text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
              <p className="text-xs text-gray-400 whitespace-pre-wrap line-clamp-4">{tpl.body}</p>
            </div>
          ))}
          {list.length === 0 && (
            <p className="text-xs text-gray-500 italic text-center py-8">No templates yet. Click "New template" to create one.</p>
          )}
        </div>
      </div>
    </div>
  )
}
