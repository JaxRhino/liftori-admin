import { useEffect, useMemo, useRef, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from './_shared'

// ---------- formatters ----------
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const fmtTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'
const fmtRelative = (d) => {
  if (!d) return '-'
  const ms = Date.now() - new Date(d).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(mo / 12)}y`
}

const initials = (name) => {
  if (!name) return '?'
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ---------- enums ----------
const CHANNEL_TYPES = ['email', 'sms', 'whatsapp', 'voice', 'web_form', 'internal']
const CONVERSATION_STATUSES = ['open', 'pending', 'closed', 'snoozed']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

const channelIcon = (t) => {
  const m = { email: 'E', sms: 'S', whatsapp: 'W', voice: 'V', web_form: 'F', internal: 'I' }
  return m[t] || '?'
}
const channelColor = (t) => {
  const m = {
    email: 'bg-brand-cyan/20 text-brand-cyan',
    sms: 'bg-emerald-500/20 text-emerald-300',
    whatsapp: 'bg-emerald-600/20 text-emerald-300',
    voice: 'bg-amber-500/20 text-amber-300',
    web_form: 'bg-sky-500/20 text-sky-300',
    internal: 'bg-gray-500/20 text-gray-300',
  }
  return m[t] || 'bg-navy-700/60 text-gray-300'
}
const priorityColor = (p) => {
  const m = {
    low: 'bg-navy-700/60 text-gray-400',
    normal: 'bg-sky-500/20 text-sky-300',
    high: 'bg-amber-500/20 text-amber-300',
    urgent: 'bg-rose-500/20 text-rose-300',
  }
  return m[p] || 'bg-navy-700/60 text-gray-300'
}
const statusColor = (s) => {
  const m = {
    open: 'bg-emerald-500/20 text-emerald-300',
    pending: 'bg-amber-500/20 text-amber-300',
    closed: 'bg-gray-500/20 text-gray-300',
    snoozed: 'bg-sky-500/20 text-sky-300',
  }
  return m[s] || 'bg-navy-700/60 text-gray-300'
}

// ---------- local primitives ----------
function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`bg-navy-800 border border-navy-700/60 rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40">{footer}</div>}
      </div>
    </div>
  )
}

function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <div
        className="w-full sm:w-[480px] bg-navy-800 border-l border-navy-700/50 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between sticky top-0 bg-navy-800 z-10">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40 sticky bottom-0">{footer}</div>}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder, rows }) {
  const base = 'w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan'
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      {rows ? (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={base} />
      ) : (
        <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
      >
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition ${
        active
          ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan'
          : 'bg-navy-900/40 border-navy-700/60 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function TabBtn({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
        active
          ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40'
          : 'text-gray-400 hover:text-white border border-transparent'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy-700/60">{count}</span>
      )}
    </button>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="flex justify-between py-2 border-b border-navy-700/30 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-white text-right">{children}</span>
    </div>
  )
}

function Avatar({ name, src, size = 40 }) {
  const sz = `${size}px`
  if (src) return <img src={src} alt={name || ''} style={{ width: sz, height: sz }} className="rounded-full object-cover" />
  return (
    <div
      style={{ width: sz, height: sz }}
      className="rounded-full bg-navy-700/60 text-brand-cyan flex items-center justify-center text-xs font-semibold"
    >
      {initials(name)}
    </div>
  )
}

function ChannelBadge({ type }) {
  return <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${channelColor(type)}`}>{type}</span>
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function CrmCommunications() {
  const { client, platform } = useCrmClient()

  const [channels, setChannels] = useState([])
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [templates, setTemplates] = useState([])

  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  // selected conversation
  const [activeConvId, setActiveConvId] = useState(null)
  const activeConv = useMemo(() => conversations.find((c) => c.id === activeConvId) || null, [conversations, activeConvId])

  // left pane filters
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('open')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [starredOnly, setStarredOnly] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [assignedToMe, setAssignedToMe] = useState(false)

  // middle pane
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('last_message_at')

  // modals
  const [connectChannelOpen, setConnectChannelOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  // reply composer
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  // ---- loaders ----
  async function loadChannels() {
    if (!client) return
    setLoadingChannels(true)
    try {
      const { data, error } = await client.from('comms_channels').select('*').order('name', { ascending: true })
      if (error) throw error
      setChannels(data || [])
    } catch (e) { console.error('[CrmComms] loadChannels', e) } finally { setLoadingChannels(false) }
  }
  async function loadConversations() {
    if (!client) return
    setLoadingConvs(true)
    try {
      const { data, error } = await client.from('comms_conversations').select('*').order('last_message_at', { ascending: false }).limit(400)
      if (error) throw error
      setConversations(data || [])
    } catch (e) { console.error('[CrmComms] loadConversations', e) } finally { setLoadingConvs(false) }
  }
  async function loadMessages(conversationId) {
    if (!client || !conversationId) { setMessages([]); return }
    setLoadingMessages(true)
    try {
      const { data, error } = await client
        .from('comms_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(500)
      if (error) throw error
      setMessages(data || [])
    } catch (e) { console.error('[CrmComms] loadMessages', e) } finally { setLoadingMessages(false) }
  }
  async function loadTemplates() {
    if (!client) return
    setLoadingTemplates(true)
    try {
      const { data, error } = await client.from('comms_templates').select('*').order('name', { ascending: true })
      if (error) throw error
      setTemplates(data || [])
    } catch (e) { console.error('[CrmComms] loadTemplates', e) } finally { setLoadingTemplates(false) }
  }

  useEffect(() => {
    if (!client) return
    loadChannels(); loadConversations(); loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  useEffect(() => {
    loadMessages(activeConvId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId])

  // ---- realtime subscription on active conversation messages ----
  useEffect(() => {
    if (!client || !activeConvId) return
    let sub
    try {
      sub = client
        .channel(`comms_messages_${activeConvId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comms_messages', filter: `conversation_id=eq.${activeConvId}` }, (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        })
        .subscribe()
    } catch (e) { console.error('[CrmComms] realtime subscribe', e) }
    return () => { try { if (sub) client.removeChannel(sub) } catch (_e) {} }
  }, [client, activeConvId])

  // ---- mark read when opening conversation ----
  useEffect(() => {
    async function markRead() {
      if (!client || !activeConv) return
      if (Number(activeConv.unread_count || 0) === 0) return
      try {
        await client.from('comms_conversations').update({ unread_count: 0 }).eq('id', activeConv.id)
        await client.from('comms_messages').update({ is_read: true, read_at: new Date().toISOString() }).eq('conversation_id', activeConv.id).eq('is_read', false)
        setConversations((prev) => prev.map((c) => c.id === activeConv.id ? { ...c, unread_count: 0 } : c))
      } catch (e) { console.error('[CrmComms] mark read', e) }
    }
    markRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId])

  // ---- filtered + sorted conversation list ----
  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = conversations.filter((c) => {
      if (activeChannelId && c.channel_id !== activeChannelId) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false
      if (starredOnly && !c.is_starred) return false
      if (unreadOnly && Number(c.unread_count || 0) === 0) return false
      // assigned-to-me is a visual stub (no auth context here)
      if (q) {
        const blob = `${c.contact_name || ''} ${c.subject || ''} ${c.last_message_preview || ''} ${c.contact_email || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
    if (sortBy === 'last_message_at') {
      out.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0))
    } else if (sortBy === 'created_at') {
      out.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    } else if (sortBy === 'priority') {
      const order = { urgent: 0, high: 1, normal: 2, low: 3 }
      out.sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2))
    }
    return out
  }, [conversations, activeChannelId, statusFilter, priorityFilter, starredOnly, unreadOnly, search, sortBy])

  // ---- stat cards ----
  const stats = useMemo(() => {
    const open = conversations.filter((c) => c.status === 'open').length
    const unread = conversations.filter((c) => c.status === 'open').reduce((s, c) => s + Number(c.unread_count || 0), 0)
    const connectedChannels = channels.filter((ch) => ch.is_active).length
    return { open, unread, connectedChannels }
  }, [conversations, channels])

  // ---- reply send ----
  async function sendReply() {
    if (!client || !activeConv || !replyText.trim()) return
    setSending(true)
    try {
      const now = new Date().toISOString()
      // get current user id (best effort)
      let senderId = null
      try { const u = await client.auth.getUser(); senderId = u?.data?.user?.id || null } catch (_e) {}
      const msgRow = {
        conversation_id: activeConv.id,
        channel_type: activeConv.channel_type,
        direction: 'outbound',
        sender_type: 'team',
        sender_id: senderId,
        body: replyText,
        is_read: true,
        read_at: now,
      }
      const { data: inserted, error } = await client.from('comms_messages').insert(msgRow).select().single()
      if (error) throw error
      await client.from('comms_conversations').update({
        last_message_at: now,
        last_message_preview: replyText.slice(0, 160),
        unread_count: 0,
      }).eq('id', activeConv.id)
      setMessages((prev) => prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted])
      setReplyText('')
      // refresh the conv list locally
      setConversations((prev) => prev.map((c) => c.id === activeConv.id ? { ...c, last_message_at: now, last_message_preview: replyText.slice(0, 160), unread_count: 0 } : c))
    } catch (e) { console.error(e); alert('Send failed: ' + e.message) }
    finally { setSending(false) }
  }

  function insertTemplate(t) {
    let body = t.body || ''
    // literal variable placeholders for now
    if (Array.isArray(t.variables)) {
      for (const v of t.variables) {
        const name = v?.name || ''
        if (!name) continue
        body = body.split(`{{${name}}}`).join(v?.default ? String(v.default) : `[${v?.label || name}]`)
      }
    }
    setReplyText((prev) => prev ? `${prev}\n${body}` : body)
    setTemplatesOpen(false)
  }

  // ---- conversation actions ----
  async function toggleStar() {
    if (!client || !activeConv) return
    try {
      await client.from('comms_conversations').update({ is_starred: !activeConv.is_starred }).eq('id', activeConv.id)
      setConversations((prev) => prev.map((c) => c.id === activeConv.id ? { ...c, is_starred: !c.is_starred } : c))
    } catch (e) { console.error(e) }
  }
  async function snooze() {
    if (!client || !activeConv) return
    try {
      await client.from('comms_conversations').update({ status: 'snoozed' }).eq('id', activeConv.id)
      setConversations((prev) => prev.map((c) => c.id === activeConv.id ? { ...c, status: 'snoozed' } : c))
    } catch (e) { console.error(e) }
  }
  async function closeConv() {
    if (!client || !activeConv) return
    try {
      await client.from('comms_conversations').update({ status: 'closed' }).eq('id', activeConv.id)
      setConversations((prev) => prev.map((c) => c.id === activeConv.id ? { ...c, status: 'closed' } : c))
    } catch (e) { console.error(e) }
  }
  async function reopenConv() {
    if (!client || !activeConv) return
    try {
      await client.from('comms_conversations').update({ status: 'open' }).eq('id', activeConv.id)
      setConversations((prev) => prev.map((c) => c.id === activeConv.id ? { ...c, status: 'open' } : c))
    } catch (e) { console.error(e) }
  }
  async function softDelete() {
    if (!client || !activeConv) return
    if (!confirm('Delete this conversation? It will be hidden from the inbox.')) return
    try {
      await client.from('comms_conversations').update({ status: 'closed', metadata: { ...(activeConv.metadata || {}), deleted: true } }).eq('id', activeConv.id)
      setActiveConvId(null)
      loadConversations()
    } catch (e) { console.error(e) }
  }

  return (
    <HubPage
      title="Communications"
      subtitle={`Unified inbox across email, SMS, voice, and web forms${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
    >
      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open Conversations" value={stats.open} accent="text-emerald-400" />
        <StatCard label="Unread" value={stats.unread} accent="text-brand-cyan" hint="Across open threads" />
        <StatCard label="Avg Response Time" value="-" accent="text-gray-400" hint="Wave F" />
        <StatCard label="Connected Channels" value={stats.connectedChannels} accent="text-brand-blue" />
      </div>

      {/* 3-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_420px_1fr] gap-4">
        {/* LEFT PANE: channels + filters */}
        <LeftPane
          channels={channels}
          loadingChannels={loadingChannels}
          activeChannelId={activeChannelId}
          setActiveChannelId={setActiveChannelId}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter}
          starredOnly={starredOnly} setStarredOnly={setStarredOnly}
          unreadOnly={unreadOnly} setUnreadOnly={setUnreadOnly}
          assignedToMe={assignedToMe} setAssignedToMe={setAssignedToMe}
          onConnect={() => setConnectChannelOpen(true)}
        />

        {/* MIDDLE PANE: conversation list */}
        <MiddlePane
          conversations={filteredConvs}
          loading={loadingConvs}
          activeConvId={activeConvId}
          onSelect={setActiveConvId}
          search={search} setSearch={setSearch}
          sortBy={sortBy} setSortBy={setSortBy}
        />

        {/* RIGHT PANE: active conversation */}
        <RightPane
          conv={activeConv}
          messages={messages}
          loading={loadingMessages}
          replyText={replyText}
          setReplyText={setReplyText}
          onSend={sendReply}
          sending={sending}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onStar={toggleStar}
          onSnooze={snooze}
          onClose={closeConv}
          onReopen={reopenConv}
          onDelete={softDelete}
        />
      </div>

      {/* modals */}
      <ConnectChannelModal
        open={connectChannelOpen}
        onClose={() => setConnectChannelOpen(false)}
        client={client}
        onSaved={() => { setConnectChannelOpen(false); loadChannels() }}
      />
      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        client={client}
        templates={templates}
        loading={loadingTemplates}
        onReload={loadTemplates}
        onInsert={insertTemplate}
      />
    </HubPage>
  )
}

// ===========================================================================
//                              LEFT PANE
// ===========================================================================
function LeftPane({
  channels, loadingChannels, activeChannelId, setActiveChannelId,
  statusFilter, setStatusFilter, priorityFilter, setPriorityFilter,
  starredOnly, setStarredOnly, unreadOnly, setUnreadOnly,
  assignedToMe, setAssignedToMe, onConnect,
}) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-260px)]">
      <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
        <h3 className="text-white text-sm font-semibold">Channels</h3>
        <button onClick={onConnect} className="text-brand-cyan text-xs hover:underline">+ Connect</button>
      </div>
      <div className="overflow-y-auto flex-1">
        {loadingChannels ? (
          <div className="p-4 text-xs text-gray-500">Loading...</div>
        ) : channels.length === 0 ? (
          <div className="p-4 text-xs text-gray-500">No channels yet.</div>
        ) : (
          <ul className="divide-y divide-navy-700/30">
            <li>
              <button
                onClick={() => setActiveChannelId(null)}
                className={`w-full text-left px-4 py-2 hover:bg-navy-700/30 ${!activeChannelId ? 'bg-navy-700/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">All channels</span>
                </div>
              </button>
            </li>
            {channels.map((ch) => (
              <li key={ch.id}>
                <button
                  onClick={() => setActiveChannelId(activeChannelId === ch.id ? null : ch.id)}
                  className={`w-full text-left px-4 py-2 hover:bg-navy-700/30 ${activeChannelId === ch.id ? 'bg-navy-700/30' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${channelColor(ch.channel_type)}`}>{channelIcon(ch.channel_type)}</span>
                      <span className="text-sm text-white truncate">{ch.name}</span>
                    </div>
                    {ch.is_active && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                  </div>
                  {ch.last_sync_at && (
                    <div className="text-[10px] text-gray-500 mt-0.5">Synced {fmtRelative(ch.last_sync_at)} ago</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-navy-700/50 p-3 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Status</div>
          <div className="flex flex-wrap gap-1">
            <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
            {CONVERSATION_STATUSES.map((s) => (
              <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Priority</div>
          <div className="flex flex-wrap gap-1">
            <Chip active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')}>All</Chip>
            {PRIORITIES.map((p) => (
              <Chip key={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)}>{p}</Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <label className="flex items-center gap-2 text-gray-300">
            <input type="checkbox" checked={starredOnly} onChange={(e) => setStarredOnly(e.target.checked)} />
            Starred only
          </label>
          <label className="flex items-center gap-2 text-gray-300">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
          <label className="flex items-center gap-2 text-gray-300">
            <input type="checkbox" checked={assignedToMe} onChange={(e) => setAssignedToMe(e.target.checked)} />
            <span>Assigned to me <span className="text-[10px] text-gray-500">(stub)</span></span>
          </label>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
//                              MIDDLE PANE
// ===========================================================================
function MiddlePane({ conversations, loading, activeConvId, onSelect, search, setSearch, sortBy, setSortBy }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-260px)]">
      <div className="px-4 py-3 border-b border-navy-700/50 flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="flex-1 bg-navy-900/60 border border-navy-700/60 rounded px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1.5 text-xs text-white"
        >
          <option value="last_message_at">Recent</option>
          <option value="created_at">Created</option>
          <option value="priority">Priority</option>
        </select>
      </div>
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-4 text-xs text-gray-500">Loading conversations...</div>
        ) : conversations.length === 0 ? (
          <EmptyState
            title="No conversations"
            description="Connect a channel to start receiving messages."
          />
        ) : (
          <ul className="divide-y divide-navy-700/30">
            {conversations.map((c) => (
              <li
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`px-3 py-3 cursor-pointer hover:bg-navy-700/30 ${activeConvId === c.id ? 'bg-navy-700/40 border-l-2 border-brand-cyan' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={c.contact_name} src={c.contact_avatar} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm text-white font-medium truncate">{c.contact_name || c.contact_email || '-'}</div>
                      <div className="text-[10px] text-gray-500 whitespace-nowrap">{fmtRelative(c.last_message_at)}</div>
                    </div>
                    <div className="text-xs text-gray-400 truncate">{c.subject || '(no subject)'}</div>
                    <div className="text-[11px] text-gray-500 truncate mt-0.5">{c.last_message_preview || ''}</div>
                    <div className="flex items-center gap-1 mt-1.5">
                      {Number(c.unread_count || 0) > 0 && (
                        <span className="w-2 h-2 rounded-full bg-brand-cyan" />
                      )}
                      <ChannelBadge type={c.channel_type} />
                      {c.priority && c.priority !== 'normal' && (
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${priorityColor(c.priority)}`}>{c.priority}</span>
                      )}
                      {c.is_starred && <span className="text-amber-400 text-xs">*</span>}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ===========================================================================
//                              RIGHT PANE
// ===========================================================================
function RightPane({
  conv, messages, loading, replyText, setReplyText, onSend, sending,
  onOpenTemplates, onStar, onSnooze, onClose: onCloseConv, onReopen, onDelete,
}) {
  const scrollRef = useRef(null)
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  if (!conv) {
    return (
      <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-12 flex items-center justify-center max-h-[calc(100vh-260px)]">
        <div className="text-center">
          <div className="text-gray-400 text-sm mb-1">No conversation selected</div>
          <div className="text-xs text-gray-500">Pick one from the list to start replying.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-260px)]">
      {/* header */}
      <div className="px-4 py-3 border-b border-navy-700/50 flex items-center gap-3">
        <Avatar name={conv.contact_name} src={conv.contact_avatar} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium truncate">{conv.contact_name || '-'}</span>
            <ChannelBadge type={conv.channel_type} />
            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${statusColor(conv.status)}`}>{conv.status}</span>
            {conv.priority && conv.priority !== 'normal' && (
              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${priorityColor(conv.priority)}`}>{conv.priority}</span>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {conv.contact_email || conv.contact_phone || ''}
            {conv.assigned_to_name && <span className="ml-2">- assigned: {conv.assigned_to_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onStar} className={`text-xs px-2 py-1 rounded ${conv.is_starred ? 'text-amber-400' : 'text-gray-400 hover:text-white'}`} title="Star">*</button>
          <button onClick={onSnooze} className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded" title="Snooze">Z</button>
          {conv.status !== 'closed' ? (
            <button onClick={onCloseConv} className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded" title="Close">Close</button>
          ) : (
            <button onClick={onReopen} className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded" title="Reopen">Reopen</button>
          )}
          <button onClick={onDelete} className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded" title="Delete">Del</button>
        </div>
      </div>

      {/* message stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-navy-900/30">
        {loading ? (
          <div className="text-xs text-gray-500">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-8">No messages yet.</div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} contactName={conv.contact_name} />)
        )}
      </div>

      {/* composer */}
      <div className="border-t border-navy-700/50 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Reply via ${conv.channel_type}...`}
            rows={3}
            className="flex-1 bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan resize-none"
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={onOpenTemplates}
              className="text-xs bg-navy-900/60 border border-navy-700/60 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg"
            >
              Template
            </button>
            <button
              onClick={onSend}
              disabled={sending || !replyText.trim()}
              className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, contactName }) {
  const isOut = message.direction === 'outbound'
  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isOut && <Avatar name={message.sender_name || contactName} size={28} />}
      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isOut ? 'bg-brand-cyan/15 border border-brand-cyan/30' : 'bg-navy-800 border border-navy-700/50'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-white font-medium">{message.sender_name || (isOut ? 'You' : contactName || 'Contact')}</span>
          <span className="text-[10px] text-gray-500">{fmtTime(message.created_at)}</span>
          {message.sender_type === 'ai' && <span className="text-[10px] px-1 py-0.5 bg-amber-500/20 text-amber-300 rounded">AI</span>}
          {message.sender_type === 'system' && <span className="text-[10px] px-1 py-0.5 bg-gray-500/20 text-gray-300 rounded">system</span>}
        </div>
        {message.subject && <div className="text-xs text-gray-400 mb-1 font-medium">{message.subject}</div>}
        <div className="text-sm text-gray-100 whitespace-pre-wrap break-words">{message.body || ''}</div>
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.attachments.map((a, i) => (
              <span key={i} className="text-[10px] bg-navy-700/60 text-gray-300 px-2 py-0.5 rounded">{a?.name || `attachment ${i + 1}`}</span>
            ))}
          </div>
        )}
      </div>
      {isOut && <Avatar name={message.sender_name || 'Team'} size={28} />}
    </div>
  )
}

// ===========================================================================
//                        CONNECT CHANNEL MODAL
// ===========================================================================
function ConnectChannelModal({ open, onClose, client, onSaved }) {
  const [name, setName] = useState('')
  const [channelType, setChannelType] = useState('email')
  const [accountName, setAccountName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(''); setChannelType('email'); setAccountName('')
  }, [open])

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      const row = {
        name, channel_type: channelType, is_active: true,
        config: {}, account_name: accountName || null,
        connected_at: new Date().toISOString(),
      }
      const { error } = await client.from('comms_channels').insert(row)
      if (error) throw error
      onSaved && onSaved()
    } catch (e) { console.error(e); alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect Channel"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Connect'}
          </button>
        </div>
      }
    >
      <div className="text-xs text-gray-400 mb-3 bg-navy-900/40 border border-navy-700/50 rounded-lg p-3">
        OAuth connect is a no-op in Wave B.4. This creates a channel record so conversations can be filed against it - real provider auth ships in Wave G.
      </div>
      <Input label="Channel name" value={name} onChange={setName} placeholder="Support Inbox" />
      <Select label="Type" value={channelType} onChange={setChannelType} options={CHANNEL_TYPES.map((t) => ({ value: t, label: t }))} />
      <Input label="Account / address" value={accountName} onChange={setAccountName} placeholder="support@yourbusiness.com" />
    </Modal>
  )
}

// ===========================================================================
//                          TEMPLATES MODAL
// ===========================================================================
function TemplatesModal({ open, onClose, client, templates, loading, onReload, onInsert }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [channelType, setChannelType] = useState('email')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [variablesText, setVariablesText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCreating(false); setName(''); setDescription(''); setCategory(''); setChannelType('email')
    setSubject(''); setBody(''); setVariablesText('')
  }, [open])

  function parseVariables(text) {
    return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [n, l, d] = line.split('|').map((s) => s?.trim())
      return { name: n || '', label: l || n || '', default: d || '' }
    })
  }

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      const row = {
        name, description, category, channel_type: channelType,
        subject, body, variables: parseVariables(variablesText),
        is_active: true, usage_count: 0,
      }
      const { error } = await client.from('comms_templates').insert(row)
      if (error) throw error
      setCreating(false); setName(''); setDescription(''); setCategory(''); setSubject(''); setBody(''); setVariablesText('')
      onReload && onReload()
    } catch (e) { console.error(e); alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  async function deleteTemplate(t) {
    if (!confirm(`Delete template "${t.name}"?`)) return
    try { await client.from('comms_templates').delete().eq('id', t.id); onReload && onReload() }
    catch (e) { console.error(e); alert(e.message) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Templates"
      wide
      footer={
        <div className="flex justify-between">
          <button onClick={() => setCreating((v) => !v)} className="text-brand-cyan text-sm">
            {creating ? 'Cancel new' : '+ New Template'}
          </button>
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Close</button>
        </div>
      }
    >
      <div className="text-xs text-gray-500 mb-3">
        Variable binding is literal placeholder for now: `{`{{name}}`}` substitutes the variable's default text. Real form-driven binding ships in Wave F.
      </div>
      {creating && (
        <div className="border border-navy-700/50 rounded-lg p-3 mb-4 bg-navy-900/30">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={name} onChange={setName} />
            <Input label="Category" value={category} onChange={setCategory} />
            <Select label="Channel type" value={channelType} onChange={setChannelType} options={CHANNEL_TYPES.map((t) => ({ value: t, label: t }))} />
            <Input label="Subject" value={subject} onChange={setSubject} />
          </div>
          <Input label="Description" value={description} onChange={setDescription} />
          <Input label="Body" value={body} onChange={setBody} rows={5} placeholder="Hello {{name}}, ..." />
          <Input
            label="Variables (one per line: name|label|default)"
            value={variablesText}
            onChange={setVariablesText}
            rows={3}
            placeholder="name|Customer name|there"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
            <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
              {saving ? 'Saving...' : 'Save template'}
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="p-4 text-xs text-gray-500">Loading templates...</div>
      ) : templates.length === 0 ? (
        <EmptyState title="No templates yet" description="Create reusable snippets to reply faster." />
      ) : (
        <ul className="divide-y divide-navy-700/30 border border-navy-700/40 rounded-lg overflow-hidden">
          {templates.map((t) => (
            <li key={t.id} className="px-3 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{t.name}</span>
                  {t.channel_type && <ChannelBadge type={t.channel_type} />}
                  {t.category && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-navy-700/60 text-gray-400">{t.category}</span>}
                </div>
                {t.subject && <div className="text-xs text-gray-400 mt-1">{t.subject}</div>}
                <div className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{t.body}</div>
                <div className="text-[10px] text-gray-600 mt-1">Used {t.usage_count || 0} times</div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => onInsert(t)} className="text-xs bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 px-2 py-1 rounded">Insert</button>
                <button onClick={() => deleteTemplate(t)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
