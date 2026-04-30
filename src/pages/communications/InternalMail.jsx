import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { Link } from 'react-router-dom'

const INPUT_STYLE = { backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }

function timeAgo(iso) {
  if (!iso) return ''
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60); if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24); if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function InternalMail() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [addresses, setAddresses] = useState([])
  const [agents, setAgents] = useState([])
  const [internalChannelId, setInternalChannelId] = useState(null)
  const [tab, setTab] = useState('inbox') // inbox / starred / all
  const [search, setSearch] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [agentTyping, setAgentTyping] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  const myAddress = (user?.email || '').split('@')[0]?.toLowerCase()

  const loadAll = useCallback(async () => {
    try {
      const [convRes, addrRes, agentRes, chanRes] = await Promise.all([
        supabase.from('comms_conversations')
          .select('*')
          .eq('channel_type', 'internal')
          .order('last_message_at', { ascending: false })
          .limit(100),
        supabase.from('internal_email_addresses')
          .select('id, address, display_name, participant_type, agent_id, human_id')
          .eq('active', true).order('participant_type').order('address'),
        supabase.from('ai_agents')
          .select('id, name, slug, auto_respond_to_email, is_active'),
        supabase.from('comms_channels').select('id').eq('channel_type', 'internal').maybeSingle(),
      ])
      setConversations(convRes.data || [])
      setAddresses(addrRes.data || [])
      setAgents(agentRes.data || [])
      setInternalChannelId(chanRes.data?.id || null)
    } catch (e) { setError(e.message || String(e)) }
  }, [])

  const loadMessages = useCallback(async (convId) => {
    if (!convId) { setMessages([]); return }
    const { data } = await supabase.from('comms_messages')
      .select('*').eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    // Mark conversation read
    await supabase.from('comms_conversations').update({ unread_count: 0 }).eq('id', convId)
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Realtime subscription on new messages in selected conversation
  useEffect(() => {
    if (!selectedConv?.id) return
    const channel = supabase
      .channel(`mail-conv-${selectedConv.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comms_messages', filter: `conversation_id=eq.${selectedConv.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new])
          setAgentTyping(false)
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50)
          loadAll() // refresh inbox preview
        }
      ).subscribe()
    return () => { try { supabase.removeChannel(channel) } catch {} }
  }, [selectedConv?.id, loadAll])

  function selectConv(conv) {
    setSelectedConv(conv); setReplyBody(''); setError(null); setAgentTyping(false)
    loadMessages(conv.id)
  }

  function startCompose() {
    setShowCompose(true); setSelectedConv(null); setMessages([])
  }

  // After sending a message, if recipient is an agent w/ auto_respond, fire invoke-agent in background
  async function maybeAutoRespond(conv) {
    const recipientAddr = conv.contact_email
    const recipientAgent = agents.find(a => addresses.find(x => x.address === recipientAddr && x.agent_id === a.id))
    if (!recipientAgent || !recipientAgent.auto_respond_to_email || !recipientAgent.is_active) return
    setAgentTyping(true)
    try {
      await supabase.functions.invoke('invoke-agent', {
        body: {
          agent_id: recipientAgent.id,
          task: `You received a new internal email in conversation_id "${conv.id}" with subject "${conv.subject}". Use email_read to read it, then use email_reply to respond if appropriate. If no response is needed, save_memory of what you learned and stop.`
        }
      })
    } catch (e) {
      console.warn('[InternalMail] auto-respond failed:', e)
      setAgentTyping(false)
    }
  }

  async function sendCompose({ to, subject, body }) {
    setSending(true); setError(null)
    try {
      const recipient = addresses.find(a => a.address === to)
      if (!recipient) throw new Error(`unknown recipient: ${to}`)
      // Create conversation
      const { data: conv, error: cErr } = await supabase.from('comms_conversations').insert({
        channel_id: internalChannelId,
        channel_type: 'internal',
        contact_name: recipient.display_name,
        contact_email: recipient.address,
        contact_agent_id: recipient.agent_id,
        contact_internal_address_id: recipient.id,
        subject,
        status: 'open',
        unread_count: 1,
        last_message_at: new Date().toISOString(),
        last_message_preview: body.slice(0, 200),
      }).select().single()
      if (cErr || !conv) throw cErr || new Error('conv insert failed')

      // Insert message
      const { error: mErr } = await supabase.from('comms_messages').insert({
        conversation_id: conv.id,
        channel_type: 'internal',
        direction: 'outbound',
        sender_type: 'human',
        sender_id: user.id,
        sender_name: user.email?.split('@')[0] || 'You',
        sender_email: myAddress || 'me',
        subject,
        body,
        is_read: false,
      })
      if (mErr) throw mErr

      setShowCompose(false)
      await loadAll()
      selectConv(conv)
      maybeAutoRespond(conv)
    } catch (e) { setError(e.message || String(e)) } finally { setSending(false) }
  }

  async function sendReply() {
    if (!replyBody.trim() || !selectedConv) return
    setSending(true); setError(null)
    try {
      const { error } = await supabase.from('comms_messages').insert({
        conversation_id: selectedConv.id,
        channel_type: 'internal',
        direction: 'outbound',
        sender_type: 'human',
        sender_id: user.id,
        sender_name: user.email?.split('@')[0] || 'You',
        sender_email: myAddress || 'me',
        subject: selectedConv.subject,
        body: replyBody,
        is_read: false,
      })
      if (error) throw error
      await supabase.from('comms_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: replyBody.slice(0, 200),
        unread_count: 1,
      }).eq('id', selectedConv.id)
      setReplyBody('')
      await loadAll()
      maybeAutoRespond(selectedConv)
    } catch (e) { setError(e.message || String(e)) } finally { setSending(false) }
  }

  async function toggleStar(conv) {
    const updated = !conv.is_starred
    await supabase.from('comms_conversations').update({ is_starred: updated }).eq('id', conv.id)
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, is_starred: updated } : c))
    if (selectedConv?.id === conv.id) setSelectedConv({ ...selectedConv, is_starred: updated })
  }

  // Filter
  const filtered = conversations.filter(c => {
    if (tab === 'inbox' && c.is_starred === false && false) return false // tab=inbox shows everything for now
    if (tab === 'starred' && !c.is_starred) return false
    if (search && !(c.subject?.toLowerCase().includes(search.toLowerCase()) || c.contact_name?.toLowerCase().includes(search.toLowerCase()) || c.last_message_preview?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  return (
    <div className="min-h-screen bg-navy-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-navy-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">Liftori Internal Mail</h1>
          <div className="flex items-center gap-1">
            <TabBtn active={tab === 'inbox'} onClick={() => setTab('inbox')}>Inbox</TabBtn>
            <TabBtn active={tab === 'starred'} onClick={() => setTab('starred')}>Starred</TabBtn>
          </div>
          <input
            type="text"
            placeholder="Search subject or sender..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={INPUT_STYLE}
            className="border rounded px-3 py-1.5 text-xs w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/comms" className="text-xs text-slate-400 hover:text-slate-200">&larr; All channels</Link>
          <button onClick={startCompose} className="px-3 py-1.5 bg-brand-blue/20 border border-brand-blue text-white text-xs rounded-md hover:bg-brand-blue/30">+ Compose</button>
        </div>
      </div>

      {error && <div className="bg-rose-900/30 border-b border-rose-800/40 text-rose-200 px-4 py-2 text-sm">{error}</div>}

      <div className="flex-1 flex overflow-hidden">
        {/* Inbox list */}
        <div className="w-[380px] border-r border-slate-800 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 italic">
              {conversations.length === 0 ? 'Your inbox is empty. Compose to start.' : 'No conversations match.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {filtered.map(conv => {
                const unread = (conv.unread_count || 0) > 0
                const isAgent = addresses.find(a => a.address === conv.contact_email)?.participant_type === 'agent'
                return (
                  <li key={conv.id}>
                    <button
                      onClick={() => selectConv(conv)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        selectedConv?.id === conv.id ? 'bg-brand-blue/15 border-l-2 border-brand-blue'
                        : 'border-l-2 border-transparent hover:bg-navy-800/40'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button onClick={(e) => { e.stopPropagation(); toggleStar(conv) }}
                          className={`text-sm flex-shrink-0 ${conv.is_starred ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'}`}>
                          {conv.is_starred ? '★' : '☆'}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={`text-sm truncate ${unread ? 'font-bold text-white' : 'text-slate-300'}`}>
                              {conv.contact_name}
                              {isAgent && <span className="ml-1.5 text-[9px] px-1 rounded bg-purple-900/40 text-purple-300 border border-purple-800/40 uppercase tracking-wider">AI</span>}
                            </span>
                            <span className="text-[10px] text-slate-500 flex-shrink-0">{timeAgo(conv.last_message_at)}</span>
                          </div>
                          <div className={`text-sm truncate ${unread ? 'font-semibold text-white' : 'text-slate-400'}`}>{conv.subject}</div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">{conv.last_message_preview}</div>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Thread / compose */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showCompose ? (
            <ComposeView addresses={addresses} onSend={sendCompose} onCancel={() => setShowCompose(false)} sending={sending} />
          ) : selectedConv ? (
            <>
              <div className="border-b border-slate-800 px-6 py-4">
                <h2 className="text-xl font-bold text-white">{selectedConv.subject}</h2>
                <div className="text-xs text-slate-500 mt-1">
                  Conversation with <span className="text-slate-300">{selectedConv.contact_name}</span>
                  <span className="ml-2 text-slate-600">- @{selectedConv.contact_email}</span>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {messages.map(m => <EmailMessage key={m.id} msg={m} />)}
                {agentTyping && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 italic px-4 py-2 bg-navy-900/40 rounded">
                    <div className="w-3 h-3 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                    {selectedConv.contact_name} is reading + drafting a reply...
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 px-6 py-4">
                <div className="text-xs text-slate-500 mb-2">Reply to {selectedConv.contact_name}</div>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendReply() } }}
                  rows={4}
                  style={INPUT_STYLE}
                  className="w-full border rounded-md px-3 py-2 text-sm leading-relaxed resize-none"
                  placeholder="Type your reply - Cmd/Ctrl+Enter to send"
                />
                <div className="flex justify-end mt-2">
                  <button onClick={sendReply} disabled={sending || !replyBody.trim()}
                    className="px-4 py-2 bg-brand-blue/20 border border-brand-blue text-white text-sm rounded-md hover:bg-brand-blue/30 disabled:opacity-50">
                    {sending ? 'Sending...' : 'Send reply'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 italic">
              Select a conversation - or compose a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
        active ? 'bg-brand-blue/20 border border-brand-blue text-white'
        : 'text-slate-400 hover:text-slate-200 border border-transparent'
      }`}>{children}</button>
  )
}

function EmailMessage({ msg }) {
  const isHuman = msg.sender_type === 'human'
  const isAgent = msg.sender_type === 'agent'
  return (
    <div className="bg-navy-900 border border-slate-800 rounded-lg p-5">
      <div className="flex items-start justify-between mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-1 ${
            isAgent ? 'bg-purple-900/40 text-purple-300 ring-purple-800/40'
            : 'bg-slate-700 text-white ring-slate-600'
          }`}>{(msg.sender_name || '?')[0].toUpperCase()}</div>
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              {msg.sender_name || msg.sender_email || 'Unknown'}
              {isAgent && <span className="text-[9px] px-1 rounded bg-purple-900/40 text-purple-300 border border-purple-800/40 uppercase tracking-wider">AI</span>}
            </div>
            <div className="text-xs text-slate-500">@{msg.sender_email}</div>
          </div>
        </div>
        <div className="text-xs text-slate-500">{new Date(msg.created_at).toLocaleString()}</div>
      </div>
      <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{msg.body}</div>
    </div>
  )
}

function ComposeView({ addresses, onSend, onCancel, sending }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  function send() {
    if (!to || !subject.trim() || !body.trim()) { alert('Recipient, subject, and body required.'); return }
    onSend({ to, subject: subject.trim(), body })
  }
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Compose internal email</h2>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-200">cancel</button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">To</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} style={INPUT_STYLE} className="w-full border rounded px-3 py-2 text-sm">
            <option value="">-- pick a recipient --</option>
            <optgroup label="AI Agents">
              {addresses.filter(a => a.participant_type === 'agent').map(a => (
                <option key={a.id} value={a.address}>{a.display_name} (@{a.address})</option>
              ))}
            </optgroup>
            <optgroup label="Humans">
              {addresses.filter(a => a.participant_type === 'human').map(a => (
                <option key={a.id} value={a.address}>{a.display_name} (@{a.address})</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Subject</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
            style={INPUT_STYLE} className="w-full border rounded px-3 py-2 text-base font-semibold" placeholder="Subject line" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14}
            style={INPUT_STYLE} className="w-full border rounded px-3 py-2 text-sm leading-relaxed resize-none" placeholder="Write your message..." />
        </div>
      </div>
      <div className="border-t border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">Internal-only - never leaves Liftori</div>
        <button onClick={send} disabled={sending || !to || !subject.trim() || !body.trim()}
          className="px-4 py-2 bg-brand-blue/20 border border-brand-blue text-white text-sm rounded-md hover:bg-brand-blue/30 disabled:opacity-50">
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
