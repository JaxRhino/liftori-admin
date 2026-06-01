import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HubPage, StatCard, EmptyState, useCrmClient } from './_shared'

// ---------- formatters ----------
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

function groupLabel(date) {
  const today = ymd(new Date())
  const y = new Date(); y.setDate(y.getDate() - 1)
  const yest = ymd(y)
  const key = ymd(date)
  if (key === today) return 'Today'
  if (key === yest) return 'Yesterday'
  return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const fmtRelative = (d) => {
  if (!d) return ''
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------- local primitives ----------
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

function TypeBadge({ type }) {
  const map = {
    mention: 'bg-brand-cyan/20 text-brand-cyan',
    task: 'bg-amber-500/20 text-amber-300',
    system: 'bg-navy-700/60 text-gray-300',
    alert: 'bg-rose-500/20 text-rose-300',
    info: 'bg-sky-500/20 text-sky-300',
  }
  if (!type) return null
  return <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${map[type] || 'bg-navy-700/60 text-gray-300'}`}>{type}</span>
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function CrmNotifications() {
  const { client, platform } = useCrmClient()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [readFilter, setReadFilter] = useState('all') // all | unread | read
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [highlightIds, setHighlightIds] = useState(new Set())

  const channelRef = useRef(null)

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      setItems(data || [])
    } catch (e) {
      console.error('[CrmNotifications] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // realtime subscribe
    try {
      const ch = client
        .channel('crm-notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => {
            const row = payload?.new
            if (!row) return
            setItems((prev) => [row, ...prev.filter((i) => i.id !== row.id)])
            setHighlightIds((prev) => {
              const next = new Set(prev)
              next.add(row.id)
              return next
            })
            setTimeout(() => {
              setHighlightIds((prev) => {
                const next = new Set(prev)
                next.delete(row.id)
                return next
              })
            }, 2500)
          }
        )
        .subscribe()
      channelRef.current = ch
    } catch (e) {
      console.warn('[CrmNotifications] realtime subscribe failed', e)
    }
    return () => {
      try {
        if (channelRef.current) client.removeChannel(channelRef.current)
      } catch (_) { /* noop */ }
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  // ---- type options derived from data ----
  const allTypes = useMemo(() => {
    const set = new Set()
    for (const n of items) if (n.type) set.add(n.type)
    return Array.from(set).sort()
  }, [items])

  // ---- stats ----
  const stats = useMemo(() => {
    const today = ymd(new Date())
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const unread = items.filter((n) => !n.read).length
    const todayCount = items.filter((n) => ymd(n.created_at) === today).length
    const weekCount = items.filter((n) => new Date(n.created_at) >= weekStart).length
    return { unread, today: todayCount, week: weekCount }
  }, [items])

  // ---- filtered ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((n) => {
      if (readFilter === 'unread' && n.read) return false
      if (readFilter === 'read' && !n.read) return false
      if (typeFilter !== 'all' && n.type !== typeFilter) return false
      if (q) {
        const blob = `${n.title || ''} ${n.body || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [items, readFilter, typeFilter, search])

  // ---- group by day ----
  const groups = useMemo(() => {
    const g = new Map()
    for (const n of filtered) {
      const key = ymd(n.created_at)
      if (!g.has(key)) g.set(key, [])
      g.get(key).push(n)
    }
    return Array.from(g.entries())
  }, [filtered])

  // ---- actions ----
  async function markRead(ids, value = true) {
    if (!client || ids.length === 0) return
    try {
      const { error } = await client.from('notifications').update({ read: value }).in('id', ids)
      if (error) throw error
      setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: value } : n)))
      setSelected(new Set())
    } catch (e) {
      console.error('[CrmNotifications] markRead', e)
    }
  }

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return
    await markRead(unreadIds, true)
  }

  function onRowClick(n) {
    if (!n.read) markRead([n.id], true)
    if (n.link) {
      if (n.link.startsWith('http://') || n.link.startsWith('https://')) {
        window.open(n.link, '_blank', 'noopener,noreferrer')
      } else {
        navigate(n.link)
      }
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <HubPage
      title="Notifications"
      subtitle={`System events, mentions, and updates${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
      actions={
        <button
          onClick={markAllRead}
          disabled={stats.unread === 0}
          className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-sm px-4 py-1.5 rounded-lg disabled:opacity-40"
        >
          Mark all read
        </button>
      }
    >
      {/* stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Unread" value={stats.unread} accent="text-brand-cyan" />
        <StatCard label="Today" value={stats.today} accent="text-amber-400" />
        <StatCard label="This Week" value={stats.week} accent="text-emerald-400" />
      </div>

      {/* filters */}
      <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or body..."
          className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan mb-3"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={readFilter === 'all'} onClick={() => setReadFilter('all')}>All</Chip>
          <Chip active={readFilter === 'unread'} onClick={() => setReadFilter('unread')}>Unread</Chip>
          <Chip active={readFilter === 'read'} onClick={() => setReadFilter('read')}>Read</Chip>
          {allTypes.length > 0 && (
            <>
              <span className="text-xs text-gray-500 uppercase tracking-wider ml-3 mr-1">Type</span>
              <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</Chip>
              {allTypes.map((t) => (
                <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>{t}</Chip>
              ))}
            </>
          )}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-navy-700/50">
            <span className="text-xs text-gray-400">{selected.size} selected</span>
            <button
              onClick={() => markRead(Array.from(selected), true)}
              className="text-xs bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 px-3 py-1 rounded-lg"
            >
              Mark selected as read
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes notif-pulse {
          0% { background-color: rgba(34, 211, 238, 0.18); }
          100% { background-color: rgba(34, 211, 238, 0); }
        }
        .notif-new { animation: notif-pulse 2.5s ease-out; }
      `}</style>

      {loading ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6 text-sm text-gray-500">Loading notifications...</div>
      ) : groups.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? 'All caught up' : 'No notifications match'}
          description={items.length === 0 ? 'New notifications will appear here when they arrive.' : 'Try a different filter or clear the search.'}
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([dayKey, group]) => (
            <div key={dayKey} className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-navy-700/50 text-xs text-gray-400 uppercase tracking-wider bg-navy-900/30">
                {groupLabel(dayKey)}
              </div>
              <div className="divide-y divide-navy-700/40">
                {group.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-navy-700/30 transition ${highlightIds.has(n.id) ? 'notif-new' : ''} ${!n.read ? 'bg-navy-900/20' : ''}`}
                    onClick={() => onRowClick(n)}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(n.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(n.id)}
                      className="mt-1"
                    />
                    <div className="w-2 flex-shrink-0 flex justify-center mt-2">
                      {!n.read && <span className="w-2 h-2 rounded-full bg-brand-cyan" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TypeBadge type={n.type} />
                        <span className={`font-medium ${n.read ? 'text-gray-300' : 'text-white'}`}>{n.title || '(no title)'}</span>
                      </div>
                      {n.body && (
                        <p className="text-sm text-gray-400 truncate mt-0.5">{n.body}</p>
                      )}
                      <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                        <span>{fmtRelative(n.created_at)}</span>
                        <span className="text-gray-600">{fmtTime(n.created_at)}</span>
                      </div>
                    </div>
                    {n.link && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRowClick(n) }}
                        className="text-xs text-brand-cyan hover:underline flex-shrink-0 mt-1"
                      >
                        Open
                      </button>
                    )}
                    {n.read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markRead([n.id], false) }}
                        className="text-[11px] text-gray-500 hover:text-gray-300 flex-shrink-0 mt-1"
                      >
                        Unread
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </HubPage>
  )
}
