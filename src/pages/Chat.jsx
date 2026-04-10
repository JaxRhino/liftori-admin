import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Chat() {
  const { user, profile } = useAuth()
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [editingMessage, setEditingMessage] = useState(null)
  const [editText, setEditText] = useState('')
  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const searchInputRef = useRef(null)
  // Unread tracking
  const [unreadCounts, setUnreadCounts] = useState({})
  const [lastSeen, setLastSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('liftori_chat_last_seen') || '{}') }
    catch { return {} }
  })
  // New Client DM
  const [showNewDm, setShowNewDm] = useState(false)
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [creatingDm, setCreatingDm] = useState(false)
  const [dmClientSearch, setDmClientSearch] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const internalChannels = channels.filter(c => c.channel_type !== 'client_dm')
  const clientDmChannels = channels.filter(c => c.channel_type === 'client_dm')

  // Filtered messages for search
  const displayedMessages = searchQuery.trim()
    ? messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  // Filtered clients for DM modal
  const filteredClients = dmClientSearch.trim()
    ? clients.filter(c =>
        c.full_name?.toLowerCase().includes(dmClientSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(dmClientSearch.toLowerCase())
      )
    : clients

  useEffect(() => {
    fetchChannels()
    fetchClients()
  }, [])

  // Global subscription for unread tracking on non-active channels
  useEffect(() => {
    if (!user) return
    const sub = supabase
      .channel('chat-global-unreads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new
        if (msg.sender_id !== user.id && msg.channel_id !== activeChannel?.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [msg.channel_id]: (prev[msg.channel_id] || 0) + 1
          }))
        }
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [activeChannel?.id, user?.id])

  useEffect(() => {
    if (!activeChannel) return

    // Mark channel as read
    const newLastSeen = { ...lastSeen, [activeChannel.id]: new Date().toISOString() }
    setLastSeen(newLastSeen)
    localStorage.setItem('liftori_chat_last_seen', JSON.stringify(newLastSeen))
    setUnreadCounts(prev => ({ ...prev, [activeChannel.id]: 0 }))
    setSearchQuery('')
    setShowSearch(false)

    // Clear messages immediately on channel switch to avoid stale display
    setMessages([])
    fetchMessages(activeChannel.id)

    const channel = supabase
      .channel(`chat:${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, profiles!chat_messages_sender_id_fkey(full_name, email, title)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setMessages(prev => {
            if (prev.find(m => m.id === data.id)) return prev
            return [...prev, data]
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, profiles!chat_messages_sender_id_fkey(full_name, email, title)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setMessages(prev => prev.map(m => m.id === data.id ? data : m))
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe((status, err) => {
        if (err) console.error('[Chat] Subscription error:', err)
      })

    return () => { supabase.removeChannel(channel) }
  }, [activeChannel])

  useEffect(() => {
    if (!searchQuery) scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus()
  }, [showSearch])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function fetchChannels() {
    const { data } = await supabase
      .from('chat_channels')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name')
    const channelsData = data || []
    setChannels(channelsData)
    if (channelsData.length > 0 && !activeChannel) {
      const defaultCh = channelsData.find(c => c.is_default) || channelsData[0]
      setActiveChannel(defaultCh)
    }
    setLoading(false)
    // Fetch initial unread counts
    fetchUnreadCounts(channelsData)
  }

  async function fetchUnreadCounts(channelsData) {
    if (!user || !channelsData.length) return
    const storedLastSeen = JSON.parse(localStorage.getItem('liftori_chat_last_seen') || '{}')
    const counts = {}
    await Promise.all(channelsData.map(async (ch) => {
      const since = storedLastSeen[ch.id]
      let query = supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .neq('sender_id', user.id)
      if (since) query = query.gt('created_at', since)
      const { count } = await query
      counts[ch.id] = count || 0
    }))
    setUnreadCounts(counts)
  }

  async function fetchClients() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('full_name')
    setClients((data || []).filter(p => p.role !== 'admin'))
  }

  async function fetchMessages(channelId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profiles!chat_messages_sender_id_fkey(full_name, email, title)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeChannel) return
    setSending(true)
    try {
      await supabase.from('chat_messages').insert({
        channel_id: activeChannel.id,
        sender_id: user.id,
        content: newMessage.trim()
      })
      setNewMessage('')
      inputRef.current?.focus()
    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setSending(false)
    }
  }

  async function createChannel() {
    if (!newChannelName.trim()) return
    setCreatingChannel(true)
    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .insert({
          name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
          description: newChannelDesc.trim() || null,
          channel_type: 'internal',
          created_by: user.id
        })
        .select()
        .single()
      if (error) throw error
      setChannels(prev => [...prev, data])
      setActiveChannel(data)
      setShowNewChannel(false)
      setNewChannelName('')
      setNewChannelDesc('')
    } catch (err) {
      console.error('Create channel error:', err)
    } finally {
      setCreatingChannel(false)
    }
  }

  async function createClientDm() {
    if (!selectedClientId) return
    setCreatingDm(true)
    try {
      const client = clients.find(c => c.id === selectedClientId)
      const channelName = client?.full_name || client?.email?.split('@')[0] || 'Client'
      const { data, error } = await supabase
        .from('chat_channels')
        .insert({
          name: channelName,
          description: `Direct message with ${client?.email || ''}`,
          channel_type: 'client_dm',
          created_by: user.id
        })
        .select()
        .single()
      if (error) throw error
      setChannels(prev => [...prev, data])
      setActiveChannel(data)
      setShowNewDm(false)
      setSelectedClientId('')
      setDmClientSearch('')
    } catch (err) {
      console.error('Create DM error:', err)
    } finally {
      setCreatingDm(false)
    }
  }

  async function deleteChannel(channelId) {
    const ch = channels.find(c => c.id === channelId)
    if (ch?.is_default) return
    const { error } = await supabase.from('chat_channels').delete().eq('id', channelId)
    if (!error) {
      setChannels(prev => prev.filter(c => c.id !== channelId))
      if (activeChannel?.id === channelId) {
        setActiveChannel(channels.find(c => c.id !== channelId) || null)
      }
    }
  }

  async function startEdit(msg) {
    setEditingMessage(msg.id)
    setEditText(msg.content)
  }

  async function saveEdit() {
    if (!editText.trim() || !editingMessage) return
    await supabase
      .from('chat_messages')
      .update({ content: editText.trim(), edited_at: new Date().toISOString() })
      .eq('id', editingMessage)
    setEditingMessage(null)
    setEditText('')
  }

  async function deleteMessage(msgId) {
    await supabase.from('chat_messages').delete().eq('id', msgId)
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

  function shouldShowHeader(msg, idx, list) {
    if (idx === 0) return true
    const prev = list[idx - 1]
    if (prev.sender_id !== msg.sender_id) return true
    const diff = new Date(msg.created_at) - new Date(prev.created_at)
    return diff > 5 * 60 * 1000
  }

  const isClientDm = activeChannel?.channel_type === 'client_dm'

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-0px)] flex">
      {/* Channel Sidebar */}
      <div className="w-56 bg-navy-800/50 border-r border-navy-700/50 flex flex-col">
        <div className="p-3 border-b border-navy-700/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Chat</h2>
          <div className="flex items-center gap-1">
            {/* New DM button */}
            <button
              onClick={() => setShowNewDm(true)}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-emerald-400 hover:bg-navy-700/50 rounded transition-colors"
              title="New client DM"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </button>
            {/* New channel button */}
            <button
              onClick={() => setShowNewChannel(true)}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-brand-blue hover:bg-navy-700/50 rounded transition-colors"
              title="New channel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {/* Internal Channels */}
          <div className="px-3 pt-3 pb-1">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Channels</span>
          </div>
          {internalChannels.map(ch => {
            const unread = unreadCounts[ch.id] || 0
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors group ${
                  activeChannel?.id === ch.id
                    ? 'bg-brand-blue/10 text-brand-blue'
                    : 'text-gray-400 hover:text-white hover:bg-navy-700/30'
                }`}
              >
                <span className="text-gray-600 text-xs">#</span>
                <span className={`flex-1 text-left truncate ${unread > 0 ? 'font-semibold text-white' : ''}`}>{ch.name}</span>
                {unread > 0 && activeChannel?.id !== ch.id && (
                  <span className="bg-brand-blue text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                {!ch.is_default && unread === 0 && (
                  <span
                    onClick={e => { e.stopPropagation(); deleteChannel(ch.id) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}

          {/* Client DM Channels */}
          {clientDmChannels.length > 0 && (
            <>
              <div className="px-3 pt-4 pb-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Client DMs</span>
              </div>
              {clientDmChannels.map(ch => {
                const unread = unreadCounts[ch.id] || 0
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors group ${
                      activeChannel?.id === ch.id
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-gray-400 hover:text-white hover:bg-navy-700/30'
                    }`}
                  >
                    {/* Online dot + avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                    </div>
                    <span className={`flex-1 text-left truncate ${unread > 0 ? 'font-semibold text-white' : ''}`}>{ch.name}</span>
                    {unread > 0 && activeChannel?.id !== ch.id && (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                )
              })}
            </>
          )}

          {/* Empty state for DMs */}
          {clientDmChannels.length === 0 && (
            <div className="px-3 pt-4">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-2">Client DMs</div>
              <button
                onClick={() => setShowNewDm(true)}
                className="w-full text-left text-xs text-gray-600 hover:text-emerald-400 transition-colors py-1"
              >
                + Start a client DM
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel Header */}
        {activeChannel && (
          <div className="h-14 border-b border-navy-700/50 flex items-center px-5 gap-3 flex-shrink-0">
            {isClientDm ? (
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
            ) : (
              <span className="text-lg text-gray-500">#</span>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{activeChannel.name}</h3>
              {activeChannel.description && (
                <p className="text-xs text-gray-500 truncate">{activeChannel.description}</p>
              )}
              {isClientDm && !activeChannel.description && (
                <p className="text-xs text-emerald-500/60">Client direct message</p>
              )}
            </div>
            {/* Search toggle */}
            <button
              onClick={() => setShowSearch(s => !s)}
              className={`p-1.5 rounded-lg transition-colors ${showSearch ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-500 hover:text-white hover:bg-navy-700/50'}`}
              title="Search messages"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            {/* Message count */}
            <span className="text-xs text-gray-600">{messages.length} msg{messages.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Search Bar */}
        {activeChannel && showSearch && (
          <div className="px-5 py-2 border-b border-navy-700/30 flex items-center gap-2 bg-navy-900/30">
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
              onKeyDown={e => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') } }}
            />
            {searchQuery && (
              <span className="text-xs text-gray-500">
                {displayedMessages.length} result{displayedMessages.length !== 1 ? 's' : ''}
              </span>
            )}
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-600 hover:text-gray-400 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {displayedMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                {searchQuery ? (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-navy-700/50 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </div>
                    <p className="text-white font-medium">No results for "{searchQuery}"</p>
                    <p className="text-gray-500 text-sm mt-1">Try a different search term</p>
                  </>
                ) : (
                  <>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                      isClientDm ? 'bg-emerald-500/10' : 'bg-navy-700/50'
                    }`}>
                      {isClientDm ? (
                        <svg className="w-6 h-6 text-emerald-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                      ) : (
                        <span className="text-2xl text-gray-600">#</span>
                      )}
                    </div>
                    <p className="text-white font-medium">
                      {isClientDm ? `Chat with ${activeChannel?.name}` : `Welcome to #${activeChannel?.name}`}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      {isClientDm ? 'Messages from the client will appear here' : activeChannel?.description || 'Start the conversation'}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {displayedMessages.map((msg, idx) => {
                const showHeader = shouldShowHeader(msg, idx, displayedMessages)
                const isOwn = msg.sender_id === user.id
                return (
                  <div
                    key={msg.id}
                    className={`group hover:bg-navy-800/30 px-2 rounded-lg ${showHeader ? 'pt-3' : 'pt-0.5'}`}
                  >
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-white">
                          {msg.profiles?.full_name || msg.profiles?.email || 'Unknown'}
                        </span>
                        {msg.profiles?.title && (
                          <span className="text-xs text-gray-400 font-medium">{msg.profiles.title}</span>
                        )}
                        <span className="text-xs text-gray-600">{formatTime(msg.created_at)}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        {editingMessage === msg.id ? (
                          <div className="flex gap-2">
                            <input
                              className="flex-1 bg-navy-900 border border-brand-blue/50 rounded px-2 py-1 text-sm text-white focus:outline-none"
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit()
                                if (e.key === 'Escape') setEditingMessage(null)
                              }}
                              autoFocus
                            />
                            <button onClick={saveEdit} className="text-xs text-brand-blue hover:underline">Save</button>
                            <button onClick={() => setEditingMessage(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-300 leading-relaxed">
                            {searchQuery ? highlightText(msg.content, searchQuery) : msg.content}
                            {msg.edited_at && <span className="text-xs text-gray-600 ml-1">(edited)</span>}
                          </p>
                        )}
                      </div>
                      {isOwn && !editingMessage && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => startEdit(msg)}
                            className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        {activeChannel && (
          <div className="px-5 pb-4 flex-shrink-0">
            <div className="flex items-center gap-2 bg-navy-800 border border-navy-700/50 rounded-xl px-4 py-2.5 focus-within:border-brand-blue/40 transition-colors">
              <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
                placeholder={isClientDm ? `Message ${activeChannel.name}` : `Message #${activeChannel.name}`}
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
        )}
      </div>

      {/* New Internal Channel Modal */}
      {showNewChannel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-4">Create Channel</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Channel Name</label>
                <input
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  placeholder="e.g. marketing"
                  onKeyDown={e => e.key === 'Enter' && createChannel()}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                <input
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
                  value={newChannelDesc}
                  onChange={e => setNewChannelDesc(e.target.value)}
                  placeholder="What's this channel about?"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => { setShowNewChannel(false); setNewChannelName(''); setNewChannelDesc('') }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createChannel}
                disabled={creatingChannel || !newChannelName.trim()}
                className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {creatingChannel ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Client DM Modal */}
      {showNewDm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-1">New Client DM</h2>
            <p className="text-xs text-gray-500 mb-4">Start a direct message with a client</p>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Search clients</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                  value={dmClientSearch}
                  onChange={e => setDmClientSearch(e.target.value)}
                  placeholder="Name or email..."
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
              {filteredClients.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">
                  {clients.length === 0 ? 'No clients found' : 'No matches'}
                </p>
              ) : (
                filteredClients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedClientId === client.id
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'text-gray-300 hover:bg-navy-700/50'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold flex-shrink-0">
                      {(client.full_name || client.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{client.full_name || '(No name)'}</p>
                      <p className="text-xs text-gray-500 truncate">{client.email}</p>
                    </div>
                    {selectedClientId === client.id && (
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowNewDm(false); setSelectedClientId(''); setDmClientSearch('') }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createClientDm}
                disabled={creatingDm || !selectedClientId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {creatingDm ? 'Starting...' : 'Start DM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper: highlight search matches in message text
function highlightText(text, query) {
  if (!query || !text) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-brand-blue/30 text-white rounded px-0.5">{part}</mark>
      : part
  )
}
