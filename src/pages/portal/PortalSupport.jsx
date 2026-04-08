import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

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
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_client: 'Waiting on You',
  resolved: 'Resolved',
  closed: 'Closed',
}

export default function PortalSupport() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // list | detail | new
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [projects, setProjects] = useState([])
  const repliesEndRef = useRef(null)

  // New ticket form
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium', project_id: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      fetchTickets()
      fetchProjects()
    }
  }, [user])

  async function fetchTickets() {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('customer_id', user.id)
        .order('updated_at', { ascending: false })
      if (error) throw error
      setTickets(data || [])
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchProjects() {
    try {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('customer_id', user.id)
        .order('name')
      setProjects(data || [])
    } catch (err) {
      console.error('Error fetching projects:', err)
    }
  }

  async function fetchReplies(ticketId) {
    try {
      const { data, error } = await supabase
        .from('ticket_replies')
        .select('*, profiles:user_id(full_name, role)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setReplies(data || [])
      setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      console.error('Error fetching replies:', err)
    }
  }

  async function openTicket(ticket) {
    setSelectedTicket(ticket)
    setView('detail')
    await fetchReplies(ticket.id)
  }

  async function submitTicket(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          customer_id: user.id,
          subject: form.subject,
          description: form.description,
          priority: form.priority,
          project_id: form.project_id || null,
        })
        .select()
        .single()
      if (error) throw error

      // Create notification for admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'dev'])
      if (admins) {
        const notifs = admins.map(a => ({
          user_id: a.id,
          type: 'ticket',
          title: `New Ticket #${data.ticket_number}`,
          body: form.subject,
          link: `/admin/support-tickets?id=${data.id}`,
        }))
        await supabase.from('notifications').insert(notifs)
      }

      setForm({ subject: '', description: '', priority: 'medium', project_id: '' })
      setView('list')
      fetchTickets()
    } catch (err) {
      console.error('Error creating ticket:', err)
    } finally {
      setSubmitting(false)
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
          ticket_id: selectedTicket.id,
          user_id: user.id,
          body: replyText.trim(),
          is_internal: false,
        })
      if (error) throw error

      // Notify admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'dev'])
      if (admins) {
        const notifs = admins.map(a => ({
          user_id: a.id,
          type: 'ticket_reply',
          title: `Reply on Ticket #${selectedTicket.ticket_number}`,
          body: replyText.trim().substring(0, 100),
          link: `/admin/support-tickets?id=${selectedTicket.id}`,
        }))
        await supabase.from('notifications').insert(notifs)
      }

      setReplyText('')
      fetchReplies(selectedTicket.id)
    } catch (err) {
      console.error('Error submitting reply:', err)
    } finally {
      setReplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // NEW TICKET FORM
  if (view === 'new') {
    return (
      <div className="p-6 max-w-2xl">
        <button onClick={() => setView('list')} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Tickets
        </button>
        <h1 className="text-2xl font-bold text-white mb-6">Submit a Support Ticket</h1>
        <form onSubmit={submitTicket} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Subject</label>
            <input
              type="text"
              required
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
              placeholder="Brief summary of your issue"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 resize-none"
              placeholder="Describe the issue in detail..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Related Project</label>
              <select
                value={form.project_id}
                onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="">None</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>
      </div>
    )
  }

  // TICKET DETAIL
  if (view === 'detail' && selectedTicket) {
    return (
      <div className="p-6 max-w-3xl">
        <button onClick={() => { setView('list'); setSelectedTicket(null) }} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Tickets
        </button>

        {/* Ticket Header */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Ticket #{selectedTicket.ticket_number}</p>
              <h2 className="text-lg font-bold text-white">{selectedTicket.subject}</h2>
            </div>
            <div className="flex gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[selectedTicket.priority]}`}>
                {selectedTicket.priority}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedTicket.status]}`}>
                {STATUS_LABELS[selectedTicket.status]}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
          <p className="text-xs text-gray-500 mt-3">
            Opened {new Date(selectedTicket.created_at).toLocaleDateString()} at {new Date(selectedTicket.created_at).toLocaleTimeString()}
          </p>
        </div>

        {/* Replies Thread */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-white font-semibold text-sm">Conversation</h3>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-700/50">
            {replies.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No replies yet. Our team will respond shortly.</div>
            ) : (
              replies.map(reply => {
                const isAdmin = reply.profiles?.role === 'admin' || reply.profiles?.role === 'dev'
                return (
                  <div key={reply.id} className={`px-4 py-3 ${isAdmin ? 'bg-sky-500/5' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isAdmin ? 'bg-sky-500/20 text-sky-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {(reply.profiles?.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white">{reply.profiles?.full_name || 'Unknown'}</span>
                      {isAdmin && <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded-full">Liftori Team</span>}
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
        {selectedTicket.status !== 'closed' && (
          <form onSubmit={submitReply} className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Type your reply..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={replying || !replyText.trim()}
              className="px-5 py-2.5 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {replying ? '...' : 'Send'}
            </button>
          </form>
        )}
      </div>
    )
  }

  // TICKET LIST
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Support</h1>
          <p className="text-gray-400 text-sm mt-1">Submit and track support tickets</p>
        </div>
        <button
          onClick={() => setView('new')}
          className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">No Tickets Yet</h3>
          <p className="text-gray-400 text-sm">Need help? Submit a support ticket and we'll get back to you.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-700/50">
            {tickets.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className="w-full text-left px-4 py-3.5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">#{ticket.ticket_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white truncate">{ticket.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(ticket.updated_at).toLocaleDateString()}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
