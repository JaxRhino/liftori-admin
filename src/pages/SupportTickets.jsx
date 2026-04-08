import { useState, useEffect, useRef } from 'react'
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

export default function SupportTickets() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [selected, setSelected] = useState(null)
  const [replies, setReplies] = useState([])
  const [replyText, setReplyText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [replying, setReplying] = useState(false)
  const [admins, setAdmins] = useState([])
  const repliesEndRef = useRef(null)

  useEffect(() => {
    fetchTickets()
    fetchAdmins()
    // Check URL for direct ticket link
    const params = new URLSearchParams(window.location.search)
    const ticketId = params.get('id')
    if (ticketId) {
      loadTicketById(ticketId)
    }
  }, [])

  // Real-time for new tickets
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

  async function fetchTickets() {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, profiles:customer_id(full_name, email:id), assigned:assigned_to(full_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      // Re-fetch profiles by customer_id for name/email
      const enriched = await Promise.all((data || []).map(async (t) => {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', t.customer_id)
          .single()
        const { data: assignedProf } = t.assigned_to ? await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', t.assigned_to)
          .single() : { data: null }
        return { ...t, customer_name: prof?.full_name || 'Unknown', assigned_name: assignedProf?.full_name || null }
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
    if (data) openTicket(data)
  }

  async function openTicket(ticket) {
    setSelected(ticket)
    const { data } = await supabase
      .from('ticket_replies')
      .select('*, profiles:user_id(full_name, role)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
    setReplies(data || [])
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

      // Notify customer (unless internal note)
      if (!isInternal) {
        await supabase.from('notifications').insert({
          user_id: selected.customer_id,
          type: 'ticket_reply',
          title: `Reply on Ticket #${selected.ticket_number}`,
          body: replyText.trim().substring(0, 100),
          link: `/portal/support`,
        })
        // Auto-update status to in_progress if still open
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

  const filtered = tickets.filter(t => {
    if (filter === 'open') return ['open', 'in_progress', 'waiting_on_client'].includes(t.status)
    if (filter === 'resolved') return t.status === 'resolved'
    if (filter === 'closed') return t.status === 'closed'
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
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
        <div className="flex gap-1 ml-auto bg-slate-800 rounded-lg p-1">
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

      <div className="flex gap-6">
        {/* Ticket List */}
        <div className={`${selected ? 'w-1/3' : 'w-full'} transition-all`}>
          {filtered.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center text-gray-500 text-sm">
              No tickets in this category
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">#{ticket.ticket_number}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[ticket.status]}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
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
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-gray-500">Ticket #{selected.ticket_number}</p>
                    <button onClick={() => setSelected(null)} className="text-xs text-gray-500 hover:text-white ml-auto">✕ Close</button>
                  </div>
                  <h2 className="text-lg font-bold text-white">{selected.subject}</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    From: {tickets.find(t => t.id === selected.id)?.customer_name || 'Unknown'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap mb-4">{selected.description}</p>

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
              <div className="px-4 py-3 border-b border-slate-700">
                <h3 className="text-white font-semibold text-sm">Conversation</h3>
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

            {/* Reply Input */}
            <form onSubmit={submitReply} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={isInternal ? "Internal note (not visible to client)..." : "Reply to customer..."}
                  className={`flex-1 bg-slate-800 border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none ${
                    isInternal ? 'border-yellow-500/50 focus:border-yellow-500' : 'border-slate-700 focus:border-sky-500'
                  }`}
                />
                <button
                  type="submit"
                  disabled={replying || !replyText.trim()}
                  className="px-5 py-2.5 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                  {replying ? '...' : 'Send'}
                </button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={e => setIsInternal(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500"
                />
                <span className="text-xs text-gray-400">Internal note (only visible to team)</span>
              </label>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
