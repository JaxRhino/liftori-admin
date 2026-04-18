import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function displayName(name) {
  const n = (name || '').replace(/^#+/, '').trim()
  if (!n) return 'Untitled'
  return n.charAt(0).toUpperCase() + n.slice(1)
}

const AVATAR_PALETTE = [
  'bg-emerald-500/30 text-emerald-300',
  'bg-brand-blue/30 text-brand-blue',
  'bg-violet-500/30 text-violet-300',
  'bg-pink-500/30 text-pink-300',
  'bg-amber-500/30 text-amber-300',
  'bg-cyan-500/30 text-cyan-300',
  'bg-rose-500/30 text-rose-300',
  'bg-indigo-500/30 text-indigo-300',
]
function avatarClasses(seed) {
  const s = String(seed || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}
function Avatar({ profile, seed, size = 'md' }) {
  const label = ((profile?.full_name || profile?.email || '?')[0] || '?').toUpperCase()
  const sz = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-xs'
  return (
    <div className={`${sz} rounded-full flex-shrink-0 flex items-center justify-center font-bold ${avatarClasses(seed)}`}>
      {label}
    </div>
  )
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function dayLabel(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}
function isNewDay(prev, curr) {
  if (!prev) return true
  return new Date(prev.created_at).toDateString() !== new Date(curr.created_at).toDateString()
}
function shouldGroup(prev, curr) {
  if (!prev) return false
  if (prev.sender_id !== curr.sender_id) return false
  const diff = new Date(curr.created_at) - new Date(prev.created_at)
  return diff < 5 * 60 * 1000 && !isNewDay(prev, curr)
}

function highlightText(text, query) {
  if (!query || !text) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-brand-blue/30 text-white rounded px-0.5">{part}</mark>
      : part
  )
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
export default function Chat() {
  const { user, profile } = useAuth()

  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  // Modals
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [showNewDm, setShowNewDm] = useState(false)
  const [people, setPeople] = useState([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [creatingDm, setCreatingDm] = useState(false)
  const [dmSearch, setDmSearch] = useState('')

  // Edit
  const [editingMessage, setEditingMessage] = useState(null)
  const [editText, setEditText] = useState('')

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const searchInputRef = useRef(null)

  // Unread
  const [unreadCounts, setUnreadCounts] = useState({})
  const [lastSeen, setLastSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('liftori_chat_last_seen') || '{}') }
    catch { return {} }
  })

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('liftori_chat_sidebar_collapsed') === '1' }
    catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('liftori_chat_sidebar_collapsed', sidebarCollapsed ? '1' : '0') } catch {}
  }, [sidebarCollapsed])

  // Starred channels (localStorage)
  const [starred, setStarred] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('liftori_chat_starred') || '[]')) }
    catch { return new Set() }
  })
  function toggleStar(id) {
    setStarred(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem('liftori_chat_starred', JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Partition channels
  const publicChannels = channels.filter(c => (c.type || 'public') !== 'direct')
  const dmChannels = channels.filter(c => c.type === 'direct')
  const starredChannels = channels.filter(c => starred.has(c.id))

  const displayedMessages = searchQuery.trim()
    ? messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  const filteredPeople = dmSearch.trim()
    ? people.filter(p =>
        p.full_name?.toLowerCase().includes(dmSearch.toLowerCase()) ||
        p.email?.toLowerCase().includes(dmSearch.toLowerCase())
      )
    : people

  // Initial load
  useEffect(() => {
    fetchChannels()
    fetchPeople()
  }, [])

  // Global unread tracker
  useEffect(() => {
    if (!user) return
    const sub = supabase
      .channel('chat-global-unreads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new
        if (msg.sender_id !== user.id && msg.channel_id !== activeChannel?.id) {
          setUnreadCounts(prev => ({ ...prev, [msg.channel_id]: (prev[msg.channel_id] || 0) + 1 }))
        }
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [activeChannel?.id, user?.id])

  // Active channel messages + subscription
  useEffect(() => {
    if (!activeChannel) return
    const newLastSeen = { ...lastSeen, [activeChannel.id]: new Date().toISOString() }
    setLastSeen(newLastSeen)
    localStorage.setItem('liftori_chat_last_seen', JSON.stringify(newLastSeen))
    setUnreadCounts(prev => ({ ...prev, [activeChannel.id]: 0 }))
    setSearchQuery('')
    setShowSearch(false)
    setMessages([])
    fetchMessages(activeChannel.id)

    const channel = supabase
      .channel(`chat:${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeChannel.id}`
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, profiles!chat_messages_sender_id_fkey(full_name, email, title)')
          .eq('id', payload.new.id)
          .single()
        if (data) setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeChannel.id}`
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, profiles!chat_messages_sender_id_fkey(full_name, email, title)')
          .eq('id', payload.new.id)
          .single()
        if (data) setMessages(prev => prev.map(m => m.id === data.id ? data : m))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeChannel.id}`
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeChannel])

  useEffect(() => { if (!searchQuery) scrollToBottom() }, [messages])
  useEffect(() => { if (showSearch) searchInputRef.current?.focus() }, [showSearch])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        if (activeChannel) setShowSearch(s => !s)
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        setSidebarCollapsed(s => !s)
      } else if (e.key === 'Escape' && showSearch) {
        setShowSearch(false); setSearchQuery('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeChannel, showSearch])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function fetchChannels() {
    const { data } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
    const channelsData = data || []
    setChannels(channelsData)
    if (channelsData.length > 0 && !activeChannel) {
      const general = channelsData.find(c => c.name?.toLowerCase() === 'general' && c.type !== 'direct')
      setActiveChannel(general || channelsData[0])
    }
    setLoading(false)
    fetchUnreadCounts(channelsData)
  }

  async function fetchUnreadCounts(channelsData) {
    if (!user || !channelsData.length) return
    const storedLastSeen = JSON.parse(localStorage.getItem('liftori_chat_last_seen') || '{}')
    const counts = {}
    await Promise.all(channelsData.map(async (ch) => {
      const since = storedLastSeen[ch.id]
      let q = supabase.from('chat_messages').select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id).neq('sender_id', user.id)
      if (since) q = q.gt('created_at', since)
      const { count } = await q
      counts[ch.id] = count || 0
    }))
    setUnreadCounts(counts)
  }

  async function fetchPeople() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, title')
      .order('full_name')
    setPeople((data || []).filter(p => p.id !== user?.id))
  }

  async function fetchMessages(channelId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profiles!chat_messages_sender_id_fkey(full_name, email, title)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages(data || [])
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeChannel) return
    setSending(true)
    try {
      await supabase.from('chat_messages').insert({
        channel_id: activeChannel.id, sender_id: user.id, content: newMessage.trim()
      })
      setNewMessage('')
      if (inputRef.current) { inputRef.current.style.height = 'auto'; inputRef.current.focus() }
    } catch (err) { console.error('Send error:', err) }
    finally { setSending(false) }
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
          type: 'public',
          created_by: user.id
        })
        .select().single()
      if (error) throw error
      await supabase.from('chat_channel_members').insert({ channel_id: data.id, user_id: user.id, role: 'owner' })
      setChannels(prev => [...prev, data])
      setActiveChannel(data)
      setShowNewChannel(false); setNewChannelName(''); setNewChannelDesc('')
    } catch (err) { console.error('Create channel error:', err) }
    finally { setCreatingChannel(false) }
  }

  async function createDm() {
    if (!selectedPersonId) return
    setCreatingDm(true)
    try {
      const other = people.find(p => p.id === selectedPersonId)
      const myName = profile?.full_name || 'You'
      const theirName = other?.full_name || other?.email?.split('@')[0] || 'User'
      const channelName = `${myName} & ${theirName}`

      // Look for existing direct channel with both members
      const { data: existing } = await supabase
        .from('chat_channels')
        .select('id, chat_channel_members(user_id)')
        .eq('type', 'direct')
      const existingDm = (existing || []).find(ch => {
        const ids = (ch.chat_channel_members || []).map(m => m.user_id)
        return ids.includes(user.id) && ids.includes(selectedPersonId) && ids.length === 2
      })
      if (existingDm) {
        const { data: full } = await supabase.from('chat_channels').select('*').eq('id', existingDm.id).single()
        if (full) {
          setChannels(prev => prev.find(c => c.id === full.id) ? prev : [...prev, full])
          setActiveChannel(full)
        }
        setShowNewDm(false); setSelectedPersonId(''); setDmSearch('')
        return
      }

      const { data, error } = await supabase
        .from('chat_channels')
        .insert({
          name: channelName,
          description: '',
          type: 'direct',
          created_by: user.id
        })
        .select().single()
      if (error) throw error

      await supabase.from('chat_channel_members').insert([
        { channel_id: data.id, user_id: user.id, role: 'owner' },
        { channel_id: data.id, user_id: selectedPersonId, role: 'member' }
      ])

      setChannels(prev => [...prev, data])
      setActiveChannel(data)
      setShowNewDm(false); setSelectedPersonId(''); setDmSearch('')
    } catch (err) { console.error('Create DM error:', err) }
    finally { setCreatingDm(false) }
  }

  async function deleteChannel(channelId) {
    const ch = channels.find(c => c.id === channelId)
    if (!ch) return
    if (ch.name?.toLowerCase() === 'general') return
    const { error } = await supabase.from('chat_channels').delete().eq('id', channelId)
    if (!error) {
      setChannels(prev => prev.filter(c => c.id !== channelId))
      if (activeChannel?.id === channelId) setActiveChannel(channels.find(c => c.id !== channelId) || null)
    }
  }

  async function startEdit(msg) { setEditingMessage(msg.id); setEditText(msg.content) }
  async function saveEdit() {
    if (!editText.trim() || !editingMessage) return
    await supabase.from('chat_messages').update({ content: editText.trim(), edited_at: new Date().toISOString() }).eq('id', editingMessage)
    setEditingMessage(null); setEditText('')
  }
  async function deleteMessage(msgId) { await supabase.from('chat_messages').delete().eq('id', msgId) }

  const isDm = activeChannel?.type === 'direct'

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-0px)] flex bg-navy-900/20">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-14' : 'w-60'} bg-navy-800/60 border-r border-navy-700/50 flex flex-col transition-all duration-200`}>
        <div className="h-12 px-2 border-b border-navy-700/50 flex items-center justify-between flex-shrink-0">
          {!sidebarCollapsed && <h2 className="text-sm font-semibold text-white pl-2">Chat</h2>}
          <div className="flex items-center gap-0.5 ml-auto">
            {!sidebarCollapsed && (
              <>
                <button
                  onClick={() => setShowNewDm(true)}
                  className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-emerald-400 hover:bg-navy-700/50 rounded transition-colors"
                  title="New DM"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowNewChannel(true)}
                  className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-brand-blue hover:bg-navy-700/50 rounded transition-colors"
                  title="New channel"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </>
            )}
            <button
              onClick={() => setSidebarCollapsed(s => !s)}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white hover:bg-navy-700/50 rounded transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {sidebarCollapsed
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />}
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {sidebarCollapsed ? (
            <div className="space-y-1 py-1">
              {[...starredChannels, ...publicChannels.filter(c => !starred.has(c.id)), ...dmChannels.filter(c => !starred.has(c.id))].map(ch => {
                const unread = unreadCounts[ch.id] || 0
                const isActive = activeChannel?.id === ch.id
                const initial = displayName(ch.name).charAt(0)
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch)}
                    className={`mx-auto block relative w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                      isActive ? 'bg-brand-blue/20 text-brand-blue ring-1 ring-brand-blue/40' : 'bg-navy-700/40 text-gray-300 hover:bg-navy-700/70 hover:text-white'
                    }`}
                    title={displayName(ch.name)}
                  >
                    {initial}
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-blue text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <>
              {/* Starred */}
              {starredChannels.length > 0 && (
                <>
                  <SectionLabel>Starred</SectionLabel>
                  {starredChannels.map(ch => (
                    <ChannelRow
                      key={ch.id}
                      channel={ch}
                      active={activeChannel?.id === ch.id}
                      unread={unreadCounts[ch.id] || 0}
                      starred={true}
                      onSelect={() => setActiveChannel(ch)}
                      onToggleStar={() => toggleStar(ch.id)}
                      onDelete={() => deleteChannel(ch.id)}
                    />
                  ))}
                </>
              )}

              {/* Channels */}
              <SectionLabel>Channels</SectionLabel>
              {publicChannels.filter(c => !starred.has(c.id)).map(ch => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  active={activeChannel?.id === ch.id}
                  unread={unreadCounts[ch.id] || 0}
                  starred={false}
                  onSelect={() => setActiveChannel(ch)}
                  onToggleStar={() => toggleStar(ch.id)}
                  onDelete={() => deleteChannel(ch.id)}
                />
              ))}

              {/* DMs */}
              <SectionLabel>Direct Messages</SectionLabel>
              {dmChannels.filter(c => !starred.has(c.id)).length === 0 ? (
                <button
                  onClick={() => setShowNewDm(true)}
                  className="w-full text-left text-xs text-gray-600 hover:text-emerald-400 transition-colors px-3 py-1"
                >
                  + Start a DM
                </button>
              ) : (
                dmChannels.filter(c => !starred.has(c.id)).map(ch => (
                  <ChannelRow
                    key={ch.id}
                    channel={ch}
                    active={activeChannel?.id === ch.id}
                    unread={unreadCounts[ch.id] || 0}
                    starred={false}
                    isDm
                    onSelect={() => setActiveChannel(ch)}
                    onToggleStar={() => toggleStar(ch.id)}
                    onDelete={() => deleteChannel(ch.id)}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel && (
          <div className="h-14 border-b border-navy-700/50 flex items-center px-5 gap-3 flex-shrink-0 bg-navy-900/40">
            {isDm ? <Avatar seed={activeChannel.id} size="sm" /> : <span className="text-lg text-gray-500">#</span>}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{displayName(activeChannel.name)}</h3>
              {activeChannel.description && (
                <p className="text-xs text-gray-500 truncate">{activeChannel.description}</p>
              )}
              {isDm && !activeChannel.description && (
                <p className="text-xs text-emerald-500/60">Direct message</p>
              )}
            </div>
            <button
              onClick={() => toggleStar(activeChannel.id)}
              className={`p-1.5 rounded-lg transition-colors ${starred.has(activeChannel.id) ? 'text-amber-400 hover:bg-navy-700/50' : 'text-gray-500 hover:text-amber-400 hover:bg-navy-700/50'}`}
              title={starred.has(activeChannel.id) ? 'Unstar' : 'Star'}
            >
              <svg className="w-4 h-4" fill={starred.has(activeChannel.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </button>
            <button
              onClick={() => setShowSearch(s => !s)}
              className={`p-1.5 rounded-lg transition-colors ${showSearch ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-500 hover:text-white hover:bg-navy-700/50'}`}
              title="Search (Ctrl+K)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
          </div>
        )}

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
            {searchQuery && <span className="text-xs text-gray-500">{displayedMessages.length} result{displayedMessages.length !== 1 ? 's' : ''}</span>}
          </div>
        )}

        {/* Messages (bubble layout) */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 py-4">
          {displayedMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                {searchQuery ? (
                  <>
                    <p className="text-white font-medium">No results for "{searchQuery}"</p>
                    <p className="text-gray-500 text-sm mt-1">Try a different search term</p>
                  </>
                ) : (
                  <>
                    <p className="text-white font-medium">
                      {isDm ? `Chat with ${displayName(activeChannel?.name)}` : `Welcome to ${displayName(activeChannel?.name)}`}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      {isDm ? 'Say hi to start the conversation' : activeChannel?.description || 'Start the conversation'}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {displayedMessages.map((msg, idx) => {
                const prev = idx > 0 ? displayedMessages[idx - 1] : null
                const newDay = isNewDay(prev, msg)
                const grouped = !newDay && shouldGroup(prev, msg)
                const isOwn = msg.sender_id === user.id
                return (
                  <div key={msg.id}>
                    {newDay && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-navy-700/60" />
                        <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold bg-navy-900/60 border border-navy-700/60 rounded-full px-2.5 py-0.5">
                          {dayLabel(msg.created_at)}
                        </span>
                        <div className="flex-1 h-px bg-navy-700/60" />
                      </div>
                    )}
                    <div className={`group flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-2'}`}>
                      {!isOwn && (
                        <div className="w-9 flex-shrink-0">
                          {!grouped ? <Avatar profile={msg.profiles} seed={msg.sender_id} /> : <div className="w-9 h-9" />}
                        </div>
                      )}
                      <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        {!grouped && !isOwn && (
                          <div className="flex items-baseline gap-2 mb-0.5 px-1">
                            <span className="text-xs font-semibold text-white">
                              {msg.profiles?.full_name || msg.profiles?.email || 'Unknown'}
                            </span>
                            {msg.profiles?.title && <span className="text-[11px] text-gray-400">{msg.profiles.title}</span>}
                          </div>
                        )}
                        {editingMessage === msg.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              className="flex-1 bg-navy-900 border border-brand-blue/50 rounded px-2 py-1 text-sm text-white focus:outline-none"
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingMessage(null) }}
                              autoFocus
                            />
                            <button onClick={saveEdit} className="text-xs text-brand-blue hover:underline">Save</button>
                            <button onClick={() => setEditingMessage(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <div className="relative flex items-end gap-1">
                            {isOwn && (
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                <button onClick={() => startEdit(msg)} className="p-1 text-gray-500 hover:text-gray-300" title="Edit">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                  </svg>
                                </button>
                                <button onClick={() => deleteMessage(msg.id)} className="p-1 text-gray-500 hover:text-red-400" title="Delete">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                              isOwn
                                ? `bg-brand-blue text-white ${grouped ? 'rounded-tr-md' : 'rounded-tr-md'}`
                                : `bg-navy-700/70 text-gray-100 border border-navy-600/40 ${grouped ? 'rounded-tl-md' : 'rounded-tl-md'}`
                            }`}>
                              {searchQuery ? highlightText(msg.content, searchQuery) : msg.content}
                              {msg.edited_at && <span className="text-[10px] opacity-70 ml-1">(edited)</span>}
                            </div>
                          </div>
                        )}
                        <span className={`text-[10px] text-gray-500 mt-0.5 px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      {isOwn && (
                        <div className="w-9 flex-shrink-0">
                          {!grouped ? <Avatar profile={{ full_name: profile?.full_name, email: user?.email }} seed={user?.id} /> : <div className="w-9 h-9" />}
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

        {/* Composer */}
        {activeChannel && (
          <div className="px-5 pb-4 pt-1 flex-shrink-0 bg-navy-900/40">
            <div className="flex items-end gap-2 bg-navy-800 border border-navy-700/50 rounded-2xl px-4 py-2.5 focus-within:border-brand-blue/40 transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none resize-none leading-relaxed py-0.5 max-h-40"
                placeholder={isDm ? `Message ${displayName(activeChannel.name)}` : `Message ${displayName(activeChannel.name)}`}
                value={newMessage}
                onChange={e => {
                  setNewMessage(e.target.value)
                  const ta = e.target
                  ta.style.height = 'auto'
                  ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); sendMessage()
                  }
                }}
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="p-1.5 bg-brand-blue hover:bg-brand-blue/80 disabled:bg-navy-700 disabled:text-gray-600 text-white rounded-lg transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <div className="mt-1.5 px-1 text-[11px] text-gray-600 flex items-center gap-3">
              <span><kbd className="px-1 py-0.5 bg-navy-800 border border-navy-700/60 rounded text-[10px] text-gray-500">Enter</kbd> send</span>
              <span><kbd className="px-1 py-0.5 bg-navy-800 border border-navy-700/60 rounded text-[10px] text-gray-500">Shift+Enter</kbd> newline</span>
              <span><kbd className="px-1 py-0.5 bg-navy-800 border border-navy-700/60 rounded text-[10px] text-gray-500">Ctrl+K</kbd> search</span>
              <span><kbd className="px-1 py-0.5 bg-navy-800 border border-navy-700/60 rounded text-[10px] text-gray-500">Ctrl+B</kbd> sidebar</span>
            </div>
          </div>
        )}
      </div>

      {/* New Channel Modal */}
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
              <button onClick={() => { setShowNewChannel(false); setNewChannelName(''); setNewChannelDesc('') }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
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

      {/* New DM Modal */}
      {showNewDm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-1">New Direct Message</h2>
            <p className="text-xs text-gray-500 mb-4">Start a conversation with any team member or client</p>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Search</label>
              <input
                className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder-gray-600"
                value={dmSearch}
                onChange={e => setDmSearch(e.target.value)}
                placeholder="Name or email..."
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
              {filteredPeople.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">No matches</p>
              ) : (
                filteredPeople.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPersonId(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedPersonId === p.id
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'text-gray-300 hover:bg-navy-700/50 border border-transparent'
                    }`}
                  >
                    <Avatar profile={p} seed={p.id} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{p.full_name || '(No name)'}</p>
                      <p className="text-xs text-gray-500 truncate">{p.email} {p.role && `· ${p.role}`}</p>
                    </div>
                    {selectedPersonId === p.id && (
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowNewDm(false); setSelectedPersonId(''); setDmSearch('') }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button
                onClick={createDm}
                disabled={creatingDm || !selectedPersonId}
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

// ─────────────────────────────────────────────────────────────
// Sidebar pieces
// ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">{children}</span>
    </div>
  )
}

function ChannelRow({ channel, active, unread, starred, isDm, onSelect, onToggleStar, onDelete }) {
  const name = displayName(channel.name)
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-pointer ${
        active
          ? (isDm ? 'bg-emerald-500/10 text-emerald-300' : 'bg-brand-blue/10 text-brand-blue')
          : 'text-gray-400 hover:text-white hover:bg-navy-700/30'
      }`}
      onClick={onSelect}
    >
      {isDm ? (
        <Avatar seed={channel.id} size="sm" />
      ) : (
        <span className="text-gray-600 text-xs w-3 text-center">#</span>
      )}
      <span className={`flex-1 truncate ${unread > 0 ? 'font-semibold text-white' : ''}`}>{name}</span>
      {unread > 0 ? (
        <span className={`${isDm ? 'bg-emerald-500' : 'bg-brand-blue'} text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}>
          {unread > 99 ? '99+' : unread}
        </span>
      ) : (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onToggleStar() }}
            className={`${starred ? 'text-amber-400 opacity-100' : 'text-gray-500 hover:text-amber-400'}`}
            title={starred ? 'Unstar' : 'Star'}
          >
            <svg className="w-3.5 h-3.5" fill={starred ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </button>
          {!isDm && name.toLowerCase() !== 'general' && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="text-gray-600 hover:text-red-400"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {starred && (
            <span className="text-amber-400" title="Starred">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
