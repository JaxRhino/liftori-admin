import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function ClientChat() {
  const { user, profile } = useAuth()
  const [channel, setChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetchChannel()
  }, [user])

  useEffect(() => {
    if (!channel) return
    fetchMessages(channel.id)

    const sub = supabase
      .channel(`client-chat:${channel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channel.id}`
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, profiles!chat_messages_sender_id_fkey(full_name, email, role)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setMessages(prev => {
            if (prev.find(m => m.id === data.id)) return prev
            return [...prev, data]
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
    }
  }, [channel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchChannel() {
    if (!user) return
    // Find the client's DM channel
    const { data } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('channel_type', 'client_dm')
      .eq('customer_id', user.id)
      .limit(1)
      .single()

    setChannel(data || null)
    setLoading(false)
  }

  async function fetchMessages(channelId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profiles!chat_messages_sender_id_fkey(full_name, email, role)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)

    setMessages(data || [])
  }

  async function sendMessage() {
    if (!newMessage.trim() || !channel) return
    setSending(true)
    const msgContent = newMessage.trim()
    try {
      await supabase.from('chat_messages').insert({
        channel_id: channel.id,
        sender_id: user.id,
        content: msgContent
      })
      setNewMessage('')
      inputRef.current?.focus()

      // Notify channel members (admins) about new client message
      try {
        const { data: members } = await supabase
          .from('chat_channel_members')
          .select('user_id')
          .eq('channel_id', channel.id)
          .neq('user_id', user.id)

        if (members && members.length > 0) {
          const senderName = profile?.full_name || user.email || 'Client'
          const preview = msgContent.length > 80 ? msgContent.substring(0, 80) + '...' : msgContent
          const notifs = members.map(m => ({
            user_id: m.user_id,
            type: 'message',
            title: `Message from ${senderName}`,
            body: preview,
            link: '/admin/chat',
          }))
          await supabase.from('notifications').insert(notifs)
        }
      } catch (notifErr) {
        console.error('Notification error:', notifErr)
      }
    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setSending(false)
    }
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    if (isToday) return time
    if (isYesterday) return `Yesterday ${time}`
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
  }

  function shouldShowHeader(msg, idx) {
    if (idx === 0) return true
    const prev = messages[idx - 1]
    if (prev.sender_id !== msg.sender_id) return true
    const diff = new Date(msg.created_at) - new Date(prev.created_at)
    return diff > 5 * 60 * 1000
  }

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  if (!channel) {
    return (
      <div className="card p-8 text-center">
        <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
        <p className="text-gray-400 text-sm">Chat is not yet configured for your account.</p>
        <p className="text-gray-600 text-xs mt-1">Contact your Liftori team if you need support.</p>
      </div>
    )
  }

  return (
    <div className="card flex flex-col" style={{ height: 'calc(100vh - 180px)', minHeight: '400px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-navy-700/50">
        <div className="w-8 h-8 rounded-full bg-brand-blue/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Chat with Liftori Team</h3>
          <p className="text-xs text-gray-500">We typically respond within a few hours</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-0.5">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 text-sm">No messages yet</p>
              <p className="text-gray-600 text-xs mt-1">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const showHeader = shouldShowHeader(msg, idx)
            const isAdmin = msg.profiles?.role === 'admin' || msg.profiles?.role === 'dev'
            const isOwn = msg.sender_id === user.id

            return (
              <div
                key={msg.id}
                className={`px-2 rounded-lg ${showHeader ? 'pt-3' : 'pt-0.5'}`}
              >
                {showHeader && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={`text-sm font-semibold ${isAdmin ? 'text-brand-blue' : 'text-white'}`}>
                      {isAdmin ? 'Liftori Team' : (msg.profiles?.full_name || 'You')}
                    </span>
                    {isAdmin && msg.profiles?.full_name && (
                      <span className="text-xs text-gray-600">{msg.profiles.full_name}</span>
                    )}
                    <span className="text-xs text-gray-600">{formatTime(msg.created_at)}</span>
                  </div>
                )}
                <p className="text-sm text-gray-300 leading-relaxed">{msg.content}</p>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-navy-700/50">
        <div className="flex items-center gap-2 bg-navy-900 border border-navy-700/50 rounded-xl px-4 py-2.5 focus-within:border-brand-blue/40 transition-colors">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
            placeholder="Type a message..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim()}
            className="p-1.5 bg-brand-blue hover:bg-brand-blue/80 disabled:bg-navy-700 disabled:text-gray-600 text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
