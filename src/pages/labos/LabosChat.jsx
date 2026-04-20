// =====================================================================
// LabosChat — Slack-style chat for the client's own team.
//
// Structure:
//   Left rail  : Channels (team) section + Direct Messages section
//                with [+] buttons to create each. Empty states when
//                the client has no team yet.
//   Main pane  : realtime messages for the selected conversation.
//
// There's no built-in "Liftori Support" channel — that's handled by
// the bug-report button in the LABOS header, which routes issues to
// the Liftori admin side.
// =====================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Hash, MessageCircle, X, Users, Search, Send } from 'lucide-react'
import { HubPage, useLabosClient } from './_shared'

export default function LabosChat() {
  const { client } = useLabosClient()
  const [me, setMe] = useState(null)                  // { id, email, full_name, avatar_url, role }
  const [profiles, setProfiles] = useState([])        // everyone in this tenant's profiles table
  const [channels, setChannels] = useState([])        // all chat_channels rows
  const [members, setMembers] = useState([])          // all chat_channel_members rows
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [showNewDm, setShowNewDm] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const scrollRef = useRef(null)

  // -------- Initial load: who am I + profiles + channels + members --------
  useEffect(() => {
    if (!client) return
    let cancelled = false

    async function bootstrap() {
      try {
        const { data: authData } = await client.auth.getUser()
        const authUser = authData?.user || null

        const [profilesRes, channelsRes, membersRes] = await Promise.all([
          client.from('profiles').select('id, email, full_name, avatar_url, role').order('full_name'),
          client.from('chat_channels').select('*').order('created_at'),
          client.from('chat_channel_members').select('*'),
        ])

        if (cancelled) return

        const meProfile = authUser
          ? (profilesRes.data || []).find(p => p.id === authUser.id) || { id: authUser.id, email: authUser.email }
          : null

        setMe(meProfile)
        setProfiles(profilesRes.data || [])
        setChannels(channelsRes.data || [])
        setMembers(membersRes.data || [])
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load chat')
      }
    }

    bootstrap()
    return () => { cancelled = true }
  }, [client])

  // -------- Load messages + realtime subscription for active conversation --------
  useEffect(() => {
    if (!client || !activeId) { setMessages([]); return }
    let cancelled = false

    async function load() {
      const { data } = await client
        .from('chat_messages')
        .select('*')
        .eq('channel_id', activeId)
        .order('created_at')
        .limit(200)
      if (!cancelled) setMessages(data || [])
    }
    load()

    const sub = client
      .channel(`labos-chat-${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeId}`,
      }, payload => setMessages(prev => [...prev, payload.new]))
      .subscribe()

    return () => { cancelled = true; client.removeChannel(sub) }
  }, [client, activeId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  // -------- Derived views --------
  const teamChannels = useMemo(
    () => channels.filter(c => c.channel_type === 'team'),
    [channels],
  )
  const dmChannels = useMemo(
    () => channels.filter(c => c.channel_type === 'dm'),
    [channels],
  )

  const profilesById = useMemo(() => {
    const map = new Map()
    profiles.forEach(p => map.set(p.id, p))
    return map
  }, [profiles])

  const membersByChannel = useMemo(() => {
    const map = new Map()
    members.forEach(m => {
      if (!map.has(m.channel_id)) map.set(m.channel_id, [])
      map.get(m.channel_id).push(m)
    })
    return map
  }, [members])

  // For a DM channel, the display name = the *other* member's name (or members' names joined)
  function dmLabel(channel) {
    const rows = membersByChannel.get(channel.id) || []
    const others = rows
      .map(r => profilesById.get(r.profile_id))
      .filter(p => p && (!me || p.id !== me.id))
    if (others.length === 0) return channel.name || 'Direct message'
    return others.map(p => p.full_name || p.email || 'Teammate').join(', ')
  }

  const activeChannel = channels.find(c => c.id === activeId) || null
  const activeIsDm = activeChannel?.channel_type === 'dm'
  const teammates = me ? profiles.filter(p => p.id !== me.id) : profiles
  const hasTeam = teammates.length > 0

  // -------- Send message --------
  async function send(e) {
    e.preventDefault()
    if (!draft.trim() || !activeId) return
    if (!me) return // silently ignore; we render a sign-in banner below
    const body = draft.trim()
    setDraft('')
    await client.from('chat_messages').insert({
      channel_id: activeId,
      sender_id: me.id,
      sender_name: me.full_name || me.email || 'You',
      body,
    })
  }

  // -------- Create channel --------
  async function createChannel({ name, description, memberIds }) {
    const { data: ch, error } = await client
      .from('chat_channels')
      .insert({
        name: name.trim().replace(/^#+/, ''),
        description: description?.trim() || null,
        channel_type: 'team',
        created_by: me?.id || null,
      })
      .select('*')
      .single()
    if (error) { alert(error.message); return }

    const memberRows = [
      ...(me ? [{ channel_id: ch.id, profile_id: me.id }] : []),
      ...memberIds.map(pid => ({ channel_id: ch.id, profile_id: pid })),
    ]
    if (memberRows.length) {
      await client.from('chat_channel_members').insert(memberRows)
    }

    setChannels(prev => [...prev, ch])
    setMembers(prev => [...prev, ...memberRows])
    setActiveId(ch.id)
    setShowNewChannel(false)
  }

  // -------- Create DM --------
  async function createDm({ profileId }) {
    const other = profilesById.get(profileId)
    if (!other || !me) return

    // Reuse an existing 1:1 DM if one already exists between these two
    const existing = dmChannels.find(c => {
      const rows = membersByChannel.get(c.id) || []
      const ids = new Set(rows.map(r => r.profile_id))
      return ids.size === 2 && ids.has(me.id) && ids.has(profileId)
    })
    if (existing) {
      setActiveId(existing.id)
      setShowNewDm(false)
      return
    }

    const { data: ch, error } = await client
      .from('chat_channels')
      .insert({
        name: `dm:${me.id.slice(0, 8)}-${profileId.slice(0, 8)}`,
        channel_type: 'dm',
        created_by: me.id,
      })
      .select('*')
      .single()
    if (error) { alert(error.message); return }

    const memberRows = [
      { channel_id: ch.id, profile_id: me.id },
      { channel_id: ch.id, profile_id: profileId },
    ]
    await client.from('chat_channel_members').insert(memberRows)

    setChannels(prev => [...prev, ch])
    setMembers(prev => [...prev, ...memberRows])
    setActiveId(ch.id)
    setShowNewDm(false)
  }

  // -------- Render --------
  return (
    <HubPage title="Chat" subtitle="Internal team messaging for your org">
      {loadError && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {loadError}
        </div>
      )}
      {!me && !loadError && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          Sign in to your LABOS to send and read messages.
        </div>
      )}

      <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden h-[calc(100vh-220px)] flex">
        {/* LEFT RAIL */}
        <aside className="w-64 border-r border-navy-700/50 flex flex-col bg-navy-900/40">
          {/* Channels section */}
          <SectionHeader
            label="Channels"
            action={
              <button
                onClick={() => setShowNewChannel(true)}
                className="p-1 rounded hover:bg-navy-700/50 text-gray-400 hover:text-white"
                title="New channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            }
          />
          {teamChannels.length === 0 ? (
            <EmptyRow label="No channels yet" cta="New channel" onClick={() => setShowNewChannel(true)} />
          ) : (
            <div>
              {teamChannels.map(c => (
                <ChannelRow
                  key={c.id}
                  active={c.id === activeId}
                  onClick={() => setActiveId(c.id)}
                  icon={<Hash className="w-3.5 h-3.5" />}
                  label={c.name}
                />
              ))}
            </div>
          )}

          {/* Direct Messages section */}
          <div className="mt-4">
            <SectionHeader
              label="Direct Messages"
              action={
                <button
                  onClick={() => (hasTeam ? setShowNewDm(true) : null)}
                  disabled={!hasTeam}
                  className="p-1 rounded hover:bg-navy-700/50 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  title={hasTeam ? 'New direct message' : 'Invite teammates first'}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              }
            />
            {!hasTeam ? (
              <div className="px-4 py-3 text-xs text-gray-500 leading-relaxed">
                Invite teammates to start direct messages.
              </div>
            ) : dmChannels.length === 0 ? (
              <EmptyRow label="No DMs yet" cta="New DM" onClick={() => setShowNewDm(true)} />
            ) : (
              <div>
                {dmChannels.map(c => (
                  <ChannelRow
                    key={c.id}
                    active={c.id === activeId}
                    onClick={() => setActiveId(c.id)}
                    icon={<MessageCircle className="w-3.5 h-3.5" />}
                    label={dmLabel(c)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* MESSAGE PANE */}
        <div className="flex-1 flex flex-col">
          {!activeChannel ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
              Pick a channel or start a new one.
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-navy-700/50 flex items-center gap-3">
                {activeIsDm ? (
                  <MessageCircle className="w-4 h-4 text-gray-400" />
                ) : (
                  <Hash className="w-4 h-4 text-gray-400" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold truncate">
                    {activeIsDm ? dmLabel(activeChannel) : activeChannel.name}
                  </div>
                  {!activeIsDm && activeChannel.description && (
                    <div className="text-xs text-gray-500 truncate">{activeChannel.description}</div>
                  )}
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center pt-8">No messages yet — say hi.</div>
                ) : messages.map(m => {
                  const sender = profilesById.get(m.sender_id)
                  const name = sender?.full_name || m.sender_name || 'Teammate'
                  const initial = (name || 'T').charAt(0).toUpperCase()
                  return (
                    <div key={m.id} className="flex gap-3">
                      {sender?.avatar_url ? (
                        <img src={sender.avatar_url} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-blue/20 text-brand-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {initial}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium">{name}</span>
                          <span className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-gray-200 mt-0.5 whitespace-pre-wrap break-words">{m.body}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={send} className="px-4 py-3 border-t border-navy-700/50 flex gap-2">
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder={me ? (activeIsDm ? `Message ${dmLabel(activeChannel)}` : `Message #${activeChannel.name}`) : 'Sign in to send messages'}
                  className="flex-1 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50 disabled:opacity-50"
                  disabled={!me}
                />
                <button
                  type="submit"
                  disabled={!me || !draft.trim()}
                  className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 disabled:opacity-40 text-white text-sm rounded-lg inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {showNewChannel && (
        <NewChannelModal
          teammates={teammates}
          onClose={() => setShowNewChannel(false)}
          onCreate={createChannel}
        />
      )}
      {showNewDm && (
        <NewDmModal
          teammates={teammates}
          onClose={() => setShowNewDm(false)}
          onCreate={createDm}
        />
      )}
    </HubPage>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────

function SectionHeader({ label, action }) {
  return (
    <div className="px-4 py-2 flex items-center justify-between border-b border-navy-700/30">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      {action}
    </div>
  )
}

function ChannelRow({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-1.5 text-sm flex items-center gap-2 transition-colors ${
        active
          ? 'bg-brand-blue/15 text-brand-blue'
          : 'text-gray-300 hover:bg-navy-700/30 hover:text-white'
      }`}
    >
      <span className="text-gray-500">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function EmptyRow({ label, cta, onClick }) {
  return (
    <div className="px-4 py-3 text-xs text-gray-500 flex flex-col gap-2">
      <span>{label}</span>
      <button onClick={onClick} className="text-brand-blue hover:text-brand-blue/80 text-left">+ {cta}</button>
    </div>
  )
}

function NewChannelModal({ teammates, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch] = useState('')

  const filtered = teammates.filter(p => {
    const q = search.toLowerCase()
    return !q || (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
  })

  function toggle(id) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({ name, description, memberIds: Array.from(selected) })
  }

  return (
    <Modal onClose={onClose} title="New Channel" icon={<Hash className="w-4 h-4" />}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. #pricing-tags"
            className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Description (optional)</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's this channel about?"
            className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Members
          </label>
          {teammates.length === 0 ? (
            <div className="text-xs text-gray-500 px-1 py-2">
              No teammates yet — the channel will start with just you.
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Find teammates..."
                  className="w-full bg-navy-900 border border-navy-700/50 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-blue/50"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-navy-700/50 divide-y divide-navy-700/30">
                {filtered.map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-navy-700/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      className="accent-brand-blue"
                    />
                    <span className="text-sm text-white">{p.full_name || p.email}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={!name.trim()} className="px-4 py-1.5 bg-brand-blue hover:bg-brand-blue/80 disabled:opacity-40 text-white text-sm rounded-lg">Create</button>
        </div>
      </form>
    </Modal>
  )
}

function NewDmModal({ teammates, onClose, onCreate }) {
  const [search, setSearch] = useState('')
  const filtered = teammates.filter(p => {
    const q = search.toLowerCase()
    return !q || (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
  })

  return (
    <Modal onClose={onClose} title="New Direct Message" icon={<MessageCircle className="w-4 h-4" />}>
      <div className="relative mb-3">
        <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-500" />
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Find a teammate..."
          className="w-full bg-navy-900 border border-navy-700/50 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-blue/50"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="text-xs text-gray-500 px-1 py-2">No matching teammates.</div>
      ) : (
        <div className="max-h-60 overflow-y-auto rounded-lg border border-navy-700/50 divide-y divide-navy-700/30">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => onCreate({ profileId: p.id })}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-navy-700/30 text-left"
            >
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-blue/20 text-brand-blue flex items-center justify-center text-xs font-bold">
                  {(p.full_name || p.email || 'T').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm text-white">{p.full_name || p.email}</div>
                {p.role && <div className="text-[11px] text-gray-500">{p.role}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

function Modal({ title, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold">
            {icon}
            {title}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
