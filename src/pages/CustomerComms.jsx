import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TABS = ['Inbox', 'Compose']

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// Parse "Name <email@>" → "Name", or return raw address
function parseEmailName(from) {
  if (!from) return 'Customer'
  const match = from.match(/^(.+?)\s*<.+>$/)
  return match ? match[1].trim() : from
}

function parseEmailAddress(from) {
  if (!from) return ''
  const match = from.match(/<(.+)>$/)
  return match ? match[1].trim() : from
}

function senderLabel(msg) {
  if (msg.sender_type === 'admin') return 'You (Admin)'
  if (msg.sender_type === 'ai') return 'Liftori AI'
  if (msg.sender_type === 'system') return 'System'
  if (msg.email_from) return parseEmailName(msg.email_from)
  return msg.profiles?.full_name || msg.profiles?.email || 'Customer'
}

function senderColor(type) {
  if (type === 'admin') return 'bg-sky-500 text-white'
  if (type === 'ai') return 'bg-purple-500 text-white'
  if (type === 'system') return 'bg-slate-400 text-white'
  return 'bg-emerald-500 text-white'
}

export default function CustomerComms() {
  const [activeTab, setActiveTab] = useState('Inbox')

  // ── Inbox state ───────────────────────────────────────────────
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMsg, setSelectedMsg] = useState(null)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterUnread, setFilterUnread] = useState(false)
  const threadEndRef = useRef(null)

  // ── Compose state ─────────────────────────────────────────────
  const [recipients, setRecipients] = useState([])
  const [composeForm, setComposeForm] = useState({ to: '', toName: '', subject: '', body: '' })
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false)

  useEffect(() => { fetchMessages() }, [])
  useEffect(() => {
    if (activeTab === 'Compose' && recipients.length === 0) fetchRecipients()
  }, [activeTab])

  useEffect(() => {
    if (selectedMsg && threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedMsg, messages])

  async function fetchMessages() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          projects ( id, name ),
          profiles:sender_id ( full_name, email )
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      setMessages(data || [])
    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRecipients() {
    try {
      const { data: profiles, error: pe } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name')
      const { data: waitlist, error: we } = await supabase
        .from('waitlist_signups')
        .select('id, full_name, email')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!pe && !we) {
        const all = [
          ...(profiles || []).map(p => ({ id: p.id, name: p.full_name || p.email, email: p.email, source: `Profile (${p.role})` })),
          ...(waitlist || []).map(w => ({ id: w.id, name: w.full_name || w.email, email: w.email, source: 'Waitlist' })),
        ]
        setRecipients(all)
      }
    } catch (err) {
      console.error('Error fetching recipients:', err)
    }
  }

  async function markRead(msgId, readState) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: readState })
        .eq('id', msgId)
      if (error) throw error
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, read: readState } : m))
      if (selectedMsg?.id === msgId) setSelectedMsg(prev => ({ ...prev, read: readState }))
    } catch (err) {
      console.error('Error updating read state:', err)
    }
  }

  async function sendReply() {
    if (!replyBody.trim() || !selectedMsg) return
    setReplying(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          project_id: selectedMsg.project_id ?? null,
          sender_type: 'admin',
          body: replyBody.trim(),
          read: true,
          source: 'platform',
          // For email threads, tag the reply with the sender's address so it stays in thread
          email_from: selectedMsg.source === 'email' ? selectedMsg.email_from : null,
          email_subject: selectedMsg.source === 'email' ? `Re: ${selectedMsg.email_subject ?? ''}` : null,
        })
      if (error) throw error
      setReplyBody('')
      if (!selectedMsg.read) await markRead(selectedMsg.id, true)
      await fetchMessages()
    } catch (err) {
      console.error('Error sending reply:', err)
    } finally {
      setReplying(false)
    }
  }

  async function sendOutreach() {
    if (!composeForm.to || !composeForm.body.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch(
        'https://qlerfkdyslndjbaltkwo.supabase.co/functions/v1/welcome-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: composeForm.toName || composeForm.to.split('@')[0],
            email: composeForm.to,
          }),
        }
      )
      if (!res.ok) throw new Error(`Send failed (${res.status})`)
      setSendResult({ success: true, message: `Email sent to ${composeForm.to}` })
      setComposeForm({ to: '', toName: '', subject: '', body: '' })
      setRecipientSearch('')
    } catch (err) {
      setSendResult({ success: false, message: err.message })
    } finally {
      setSending(false)
    }
  }

  // ── Derived data ───────────────────────────────────────────────
  const unreadCount = messages.filter(m => !m.read && m.sender_type === 'customer').length

  const filteredMessages = messages.filter(m => {
    if (filterUnread && m.read) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        m.body?.toLowerCase().includes(q) ||
        m.projects?.name?.toLowerCase().includes(q) ||
        m.profiles?.full_name?.toLowerCase().includes(q) ||
        m.profiles?.email?.toLowerCase().includes(q) ||
        m.email_from?.toLowerCase().includes(q) ||
        m.email_subject?.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Thread grouping: email messages thread by sender address; platform messages by project_id
  const threadMessages = selectedMsg
    ? messages
        .filter(m => {
          if (selectedMsg.source === 'email' || selectedMsg.email_from) {
            const selAddr = parseEmailAddress(selectedMsg.email_from)
            const mAddr = parseEmailAddress(m.email_from)
            return selAddr && (mAddr === selAddr || (m.sender_type === 'admin' && m.email_from && parseEmailAddress(m.email_from) === selAddr))
          }
          return m.project_id === selectedMsg.project_id
        })
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    : []

  const filteredRecipients = recipients.filter(r => {
    const q = recipientSearch.toLowerCase()
    return (
      r.name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q)
    )
  }).slice(0, 8)

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Communications</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sales@ inbox — Ryan &amp; Mike</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              {unreadCount} unread
            </span>
          )}
          <button
            onClick={fetchMessages}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-sky-500 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            {tab === 'Inbox' && unreadCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-sky-500 text-white text-xs">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── INBOX TAB ─────────────────────────────────────────── */}
      {activeTab === 'Inbox' && (
        <div className="flex gap-4 min-h-[600px]">
          {/* Message list */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-3">
            {/* Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search messages…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                onClick={() => setFilterUnread(v => !v)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  filterUnread
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                Unread
              </button>
            </div>

            {/* List */}
            <div className="flex flex-col gap-1 overflow-y-auto max-h-[540px]">
              {loading ? (
                <div className="text-center py-12 text-slate-400 text-sm">Loading…</div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <p className="text-slate-400 text-sm">No messages</p>
                  <p className="text-slate-300 text-xs mt-1">Customer messages will appear here</p>
                </div>
              ) : (
                filteredMessages.map(msg => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      setSelectedMsg(msg)
                      if (!msg.read && msg.sender_type === 'customer') markRead(msg.id, true)
                    }}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      selectedMsg?.id === msg.id
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    } ${!msg.read && msg.sender_type === 'customer' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-xs font-medium truncate ${!msg.read && msg.sender_type === 'customer' ? 'text-slate-900' : 'text-slate-600'}`}>
                          {senderLabel(msg)}
                        </span>
                        {msg.source === 'email' && (
                          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-medium">Email</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(msg.created_at)}</span>
                    </div>
                    {/* Subject line for emails, project name for platform messages */}
                    {msg.email_subject ? (
                      <p className="text-xs text-violet-600 mb-1 truncate font-medium">{msg.email_subject}</p>
                    ) : msg.projects?.name ? (
                      <p className="text-xs text-sky-600 mb-1 truncate">{msg.projects.name}</p>
                    ) : null}
                    <p className={`text-xs truncate leading-relaxed ${!msg.read && msg.sender_type === 'customer' ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                      {msg.body}
                    </p>
                    {!msg.read && msg.sender_type === 'customer' && (
                      <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-sky-500" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Thread view */}
          <div className="flex-1 flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white">
            {!selectedMsg ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <svg className="w-12 h-12 text-slate-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                <p className="text-slate-400 font-medium">Select a message</p>
                <p className="text-slate-300 text-sm mt-1">Click a message to read the thread</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-5 py-4 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* Subject or project name */}
                      {selectedMsg.email_subject ? (
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-medium flex-shrink-0">Email</span>
                          <p className="font-semibold text-slate-900 text-sm truncate">{selectedMsg.email_subject}</p>
                        </div>
                      ) : (
                        <p className="font-semibold text-slate-900 text-sm">{selectedMsg.projects?.name || 'Direct message'}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedMsg.email_from && (
                          <span className="mr-2 text-slate-500">{parseEmailAddress(selectedMsg.email_from)}</span>
                        )}
                        {threadMessages.length} message{threadMessages.length !== 1 ? 's' : ''} · started {formatDate(threadMessages[0]?.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => markRead(selectedMsg.id, !selectedMsg.read)}
                        className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Mark {selectedMsg.read ? 'unread' : 'read'}
                      </button>
                      <button
                        onClick={() => setSelectedMsg(null)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Thread messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {threadMessages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.sender_type === 'admin' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${senderColor(msg.sender_type)}`}>
                        {senderLabel(msg).charAt(0).toUpperCase()}
                      </div>
                      <div className={`flex flex-col max-w-[75%] ${msg.sender_type === 'admin' ? 'items-end' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-600">{senderLabel(msg)}</span>
                          <span className="text-xs text-slate-400">{formatDate(msg.created_at)}</span>
                          {msg.source === 'email' && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-violet-100 text-violet-500">email</span>
                          )}
                        </div>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.sender_type === 'admin'
                            ? 'bg-sky-500 text-white rounded-tr-sm'
                            : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                        }`}>
                          {msg.body}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={threadEndRef} />
                </div>

                {/* Reply box */}
                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
                  {selectedMsg.source === 'email' && (
                    <p className="text-xs text-slate-400 mb-2">
                      📬 Reply logs internally. To send via email, reply directly in your Gmail.
                    </p>
                  )}
                  <div className="flex gap-3">
                    <textarea
                      value={replyBody}
                      onChange={e => setReplyBody(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply()
                      }}
                      placeholder="Type a reply… (⌘↵ to send)"
                      rows={2}
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    />
                    <button
                      onClick={sendReply}
                      disabled={!replyBody.trim() || replying}
                      className="px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 self-end"
                    >
                      {replying ? 'Sending…' : 'Reply'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── COMPOSE TAB ───────────────────────────────────────── */}
      {activeTab === 'Compose' && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Welcome email template active</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Outreach currently uses the Liftori welcome email template via Resend. A custom template edge function can be added in a future build session.
              </p>
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-1.5 relative">
            <label className="block text-sm font-medium text-slate-700">To</label>
            <input
              type="text"
              value={recipientSearch || composeForm.to}
              onChange={e => {
                setRecipientSearch(e.target.value)
                setComposeForm(f => ({ ...f, to: e.target.value, toName: '' }))
                setShowRecipientDropdown(true)
                setSendResult(null)
              }}
              onFocus={() => setShowRecipientDropdown(true)}
              onBlur={() => setTimeout(() => setShowRecipientDropdown(false), 150)}
              placeholder="Email address or search contacts…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {showRecipientDropdown && recipientSearch && filteredRecipients.length > 0 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                {filteredRecipients.map(r => (
                  <button
                    key={r.id + r.email}
                    onMouseDown={() => {
                      setComposeForm(f => ({ ...f, to: r.email, toName: r.name }))
                      setRecipientSearch(r.name || r.email)
                      setShowRecipientDropdown(false)
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 text-left"
                  >
                    <div>
                      <p className="font-medium text-slate-700">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.email}</p>
                    </div>
                    <span className="text-xs text-slate-300">{r.source}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Subject</label>
            <input
              type="text"
              value={composeForm.subject}
              onChange={e => setComposeForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Subject line…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Message</label>
            <textarea
              value={composeForm.body}
              onChange={e => setComposeForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Write your message…"
              rows={8}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Send result */}
          {sendResult && (
            <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
              sendResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {sendResult.success ? (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              )}
              {sendResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={sendOutreach}
              disabled={!composeForm.to || !composeForm.body.trim() || sending}
              className="px-5 py-2.5 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" strokeWidth={1.5} />
                  </svg>
                  Sending…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                  Send Email
                </>
              )}
            </button>
            <button
              onClick={() => {
                setComposeForm({ to: '', toName: '', subject: '', body: '' })
                setRecipientSearch('')
                setSendResult(null)
              }}
              className="px-5 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
