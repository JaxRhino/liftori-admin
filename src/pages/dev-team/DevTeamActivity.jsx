import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const TARGET_TYPES = ['file', 'task', 'deployment', 'memory', 'skill', 'canvas', 'note', 'commit', 'session']

const TYPE_META = {
  file:       { label: 'File',       color: 'text-cyan-300',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  task:       { label: 'Task',       color: 'text-violet-300',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  deployment: { label: 'Deploy',     color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  memory:     { label: 'Memory',     color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  skill:      { label: 'Skill',      color: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  canvas:     { label: 'Canvas',     color: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  note:       { label: 'Note',       color: 'text-slate-300',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20' },
  commit:     { label: 'Commit',     color: 'text-orange-300',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
  session:    { label: 'Session',    color: 'text-pink-300',    bg: 'bg-pink-500/10',    border: 'border-pink-500/20' },
}

const INPUT = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue/50'

function relTime(ts) {
  const d = new Date(ts)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

function dayBucket(ts) {
  const d = new Date(ts)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7)
  if (d >= startOfToday) return 'Today'
  if (d >= startOfYesterday) return 'Yesterday'
  if (d >= startOfWeek) return 'This week'
  return 'Earlier'
}

function TypePill({ type }) {
  if (!type) return null
  const m = TYPE_META[type] || TYPE_META.note
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold border ${m.bg} ${m.color} ${m.border}`}>
      {m.label}
    </span>
  )
}

function EventCard({ event, expanded, onToggle }) {
  const hasDetails = event.details && Object.keys(event.details).length > 0
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white font-medium">{event.author_display_name}</span>
            <span className="text-white/30">·</span>
            <span className="text-sm text-brand-blue font-mono">{event.action}</span>
            <TypePill type={event.target_type} />
          </div>
          {event.target && (
            <div className="text-xs text-white/60 font-mono mt-1 truncate">{event.target}</div>
          )}
          {event.session_id && (
            <div className="text-[10px] text-white/30 font-mono mt-1">session {event.session_id}</div>
          )}
        </div>
        <div className="text-xs text-white/40 whitespace-nowrap" title={new Date(event.created_at).toLocaleString()}>
          {relTime(event.created_at)}
        </div>
      </button>
      {expanded && hasDetails && (
        <div className="px-3 pb-3 -mt-1">
          <pre className="text-[11px] text-white/70 bg-black/20 rounded p-2 font-mono overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(event.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function LogEventModal({ author, onClose, onSave }) {
  const [action, setAction] = useState('')
  const [target, setTarget] = useState('')
  const [targetType, setTargetType] = useState('note')
  const [details, setDetails] = useState('')

  function save() {
    if (!action.trim()) return
    let parsed = {}
    if (details.trim()) {
      try { parsed = JSON.parse(details) }
      catch { parsed = { note: details.trim() } }
    }
    onSave({ action: action.trim(), target: target.trim() || null, target_type: targetType, details: parsed })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-navy-900 border border-white/15 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-heading text-white tracking-wide">Log Activity Event</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Action *</label>
            <input className={INPUT} value={action} onChange={e => setAction(e.target.value)} placeholder="deploy / file_edit / task_complete / memory_update" autoFocus />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Target</label>
            <input className={INPUT} value={target} onChange={e => setTarget(e.target.value)} placeholder="liftori-admin/src/App.jsx OR commit:abc1234 OR /admin/dev-team" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Target Type</label>
            <select className={INPUT} value={targetType} onChange={e => setTargetType(e.target.value)}>
              {TARGET_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-1.5">Details (JSON or free text)</label>
            <textarea className={INPUT + ' resize-y font-mono text-xs'} rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder='{"commit": "abc1234", "lines_changed": 42}' />
          </div>
          <div className="text-xs text-white/40">
            Logged as <span className="text-white/70">{author}</span> at {new Date().toLocaleTimeString()}.
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5">Cancel</button>
          <button onClick={save} disabled={!action.trim()} className="px-4 py-2 rounded-lg text-sm bg-brand-blue text-navy-950 font-semibold hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed">
            Log event
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DevTeamActivity() {
  const { user, profile } = useAuth()
  const [events, setEvents] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [authorFilter, setAuthorFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})
  const [showLog, setShowLog] = useState(false)

  async function fetchAll() {
    const [eRes, mRes] = await Promise.all([
      supabase.from('dev_team_activity').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('dev_team_members').select('user_id, display_name').eq('active', true).order('display_name'),
    ])
    if (!eRes.error) setEvents(eRes.data || [])
    if (!mRes.error) setMembers(mRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const ch = supabase
      .channel('dev_team_activity_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dev_team_activity' }, payload => {
        setEvents(prev => [payload.new, ...prev].slice(0, 200))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter(e => {
      if (authorFilter !== 'all' && e.author_user_id !== authorFilter) return false
      if (typeFilter !== 'all' && e.target_type !== typeFilter) return false
      if (q) {
        const hay = `${e.action} ${e.target || ''} ${e.author_display_name}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [events, authorFilter, typeFilter, search])

  const grouped = useMemo(() => {
    const g = { Today: [], Yesterday: [], 'This week': [], Earlier: [] }
    visible.forEach(e => g[dayBucket(e.created_at)].push(e))
    return g
  }, [visible])

  async function logEvent(payload) {
    const authorName = profile?.full_name || user?.email || 'Unknown'
    const { error } = await supabase.from('dev_team_activity').insert({
      author_user_id: user.id,
      author_display_name: authorName,
      ...payload,
    })
    if (error) { console.error('[DevTeamActivity] log failed:', error); return }
    setShowLog(false)
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-blue/50 w-56"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className={INPUT + ' w-auto'} value={authorFilter} onChange={e => setAuthorFilter(e.target.value)}>
            <option value="all">All authors</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
          <select className={INPUT + ' w-auto'} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {TARGET_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowLog(true)}
          className="px-4 py-2 rounded-lg bg-brand-blue text-navy-950 font-semibold text-sm hover:bg-brand-blue/90 transition-colors"
        >
          + Log Event
        </button>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        Live · {visible.length} of {events.length} events
      </div>

      {/* Grouped feed */}
      {loading ? (
        <div className="text-white/40 text-center py-12">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-12 text-center">
          <div className="text-white/60 text-sm mb-2">No events match the current filters.</div>
          <div className="text-white/40 text-xs">Use "+ Log Event" above to post a manual event, or wait for skills + push scripts to emit them as Wave D.2 producers ship.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([bucket, list]) => list.length === 0 ? null : (
            <div key={bucket}>
              <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">{bucket}</div>
              <div className="space-y-2">
                {list.map(e => (
                  <EventCard
                    key={e.id}
                    event={e}
                    expanded={!!expanded[e.id]}
                    onToggle={() => setExpanded(prev => ({ ...prev, [e.id]: !prev[e.id] }))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showLog && (
        <LogEventModal
          author={profile?.full_name || user?.email || 'You'}
          onClose={() => setShowLog(false)}
          onSave={logEvent}
        />
      )}
    </div>
  )
}
