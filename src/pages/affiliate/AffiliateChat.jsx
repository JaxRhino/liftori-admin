import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

/**
 * Affiliate-scoped chat. Shows ONLY channels the current affiliate is a member of.
 * On enrollment, every affiliate auto-receives 2 channels:
 *   1. "My Team" — private channel for them + collaborators they invite
 *   2. "Liftori Support" — DM with the Liftori support team (Ryan + Mike)
 *
 * RLS on chat_channels / chat_channel_members / chat_messages enforces this
 * at the DB layer too — affiliates physically cannot read internal channels.
 */
export default function AffiliateChat() {
  const { user } = useAuth()
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (user?.id) fetchMyChannels()
  }, [user?.id])

  useEffect(() => {
    if (!activeChannel) return
    setMessages([])
    fetchMessages(activeChannel.id)

    const sub = supabase
      .channel(`affiliate-chat:${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setMessages((prev) => (prev.find((m) => m.id === data.id) ? prev : [...prev, data]))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [activeChannel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchMyChannels() {
    setLoading(true)
    // Get my memberships
    const { data: memberships, error: memErr } = await supabase
      .from('chat_channel_members')
      .select('channel_id')
      .eq('user_id', user.id)

    if (memErr) {
      console.error('[AffiliateChat] membership fetch error:', memErr)
      setLoading(false)
      return
    }

    const channelIds = (memberships || []).map((m) => m.channel_id)
    if (channelIds.length === 0) {
      setChannels([])
      setLoading(false)
      return
    }

    const { data: chs } = await supabase
      .from('chat_channels')
      .select('*')
      .in('id', channelIds)
      .eq('is_archived', false)
      .order('name')

    const list = chs || []
    setChannels(list)
    if (list.length > 0 && !activeChannel) {
      // Default to "Liftori Support" if present, else first channel
      const support = list.find((c) => c.name === 'Liftori Support')
      setActiveChannel(support || list[0])
    }
    setLoading(false)
  }

  async function fetchMessages(channelId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .is('thread_id', null)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages(data || [])
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeChannel) return
    setSending(true)
    try {
      const senderName = user.user_metadata?.full_name || user.email || 'You'
      const { error } = await supabase.from('chat_messages').insert({
        channel_id: activeChannel.id,
        sender_id: user.id,
        sender_name: senderName,
        sender_role: 'affiliate',
        content: newMessage.trim(),
      })
      if (error) throw error
      setNewMessage('')
      inputRef.current?.focus()
    } catch (err) {
      console.error('[AffiliateChat] send error:', err)
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">
        Loading chat…
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-xl font-bold text-white mb-2">Chat is being set up</h2>
          <p className="text-sm text-gray-400">
            Your team channel and Liftori Support channel will appear here shortly.
            If this persists, message support@liftori.ai.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row h-[calc(100vh-180px)] min-h-[500px] gap-3 px-2 sm:px-4">
      {/* Sidebar — channel list */}
      <aside className="w-full sm:w-64 sm:flex-shrink-0 bg-navy-900/40 border border-navy-700/40 rounded-xl p-3">
        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-3 px-2">
          Channels
        </div>
        <div className="space-y-1">
          {channels.map((ch) => {
            const active = activeChannel?.id === ch.id
            const isSupport = ch.name === 'Liftori Support'
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-brand-blue/15 text-white'
                    : 'text-gray-300 hover:bg-navy-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{isSupport ? '🛟' : '👥'}</span>
                  <span className="truncate font-medium">{ch.name}</span>
                </div>
                {ch.description && (
                  <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1 pl-7">
                    {ch.description}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </aside>

      {/* Main pane */}
      <section className="flex-1 flex flex-col bg-navy-900/40 border border-navy-700/40 rounded-xl overflow-hidden min-h-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-navy-700/40 bg-navy-900/60">
          <div className="font-semibold text-white">
            {activeChannel?.name === 'Liftori Support' ? '🛟' : '👥'} {activeChannel?.name}
          </div>
          {activeChannel?.description && (
            <div className="text-xs text-gray-500 mt-0.5">{activeChannel.description}</div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-12">
              {activeChannel?.name === 'Liftori Support'
                ? 'Start the conversation — the Liftori team will reply here.'
                : 'No messages yet. Say hi to your team.'}
            </div>
          )}
          {messages.map((m) => {
            const isMe = m.sender_id === user.id
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  isMe
                    ? 'bg-brand-blue/20 text-white'
                    : 'bg-navy-800/60 text-gray-100'
                }`}>
                  {!isMe && (
                    <div className="text-[10px] uppercase font-semibold text-gray-400 mb-0.5">
                      {m.sender_name || 'Liftori'}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-navy-700/40 p-3 bg-navy-900/60">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Message ${activeChannel?.name || 'channel'}…`}
              rows={1}
              className="flex-1 bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-blue max-h-32"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !newMessage.trim()}
              className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
