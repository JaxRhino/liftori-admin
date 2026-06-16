import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const STATUSES = [
  { key: 'received', label: 'Received', cls: 'text-brand-blue border-brand-blue/30 bg-brand-blue/10' },
  { key: 'in_progress', label: 'In progress', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { key: 'need_info', label: 'Needs info', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { key: 'resolved', label: 'Resolved', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { key: 'closed', label: 'Closed', cls: 'text-gray-400 border-gray-600/40 bg-white/5' },
  { key: 'wont_fix', label: "Won't fix", cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
]
const statusMeta = (k) => STATUSES.find((s) => s.key === k) || STATUSES[0]

const CATEGORY_LABEL = {
  bug: 'Bug', feature: 'Feature idea', improvement: 'Improvement', question: 'Question', other: 'Other',
}

const fmt = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

export default function DevTeamBetaFeedback() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [filter, setFilter] = useState('open')
  const [active, setActive] = useState(null) // selected feedback row

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setErr(null)
    const { data, error } = await supabase
      .from('tester_feedback')
      .select('*')
      .order('last_activity_at', { ascending: false })
    if (error) { setErr(error.message); setRows([]) }
    else setRows(data || [])
    setLoading(false)
  }

  const openCount = rows.filter((r) => !['resolved', 'closed', 'wont_fix'].includes(r.status)).length
  const filtered = rows.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'open') return !['resolved', 'closed', 'wont_fix'].includes(r.status)
    return r.status === filter
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Beta Feedback</h2>
          <span className="text-xs px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">{openCount} open</span>
          <span className="text-xs text-white/40">{rows.length} total</span>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80">Refresh</button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[{ key: 'open', label: 'Open' }, { key: 'all', label: 'All' }, ...STATUSES].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${filter === f.key ? 'border-brand-blue text-brand-blue bg-brand-blue/10' : 'border-white/10 text-white/50 hover:text-white'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
          <div className="font-semibold mb-1">Couldn't load feedback</div>
          <div className="text-xs font-mono break-all text-red-300/80">{err}</div>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-white/40">No feedback in this view</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => {
            const sm = statusMeta(r.status)
            return (
              <button
                key={r.id}
                onClick={() => setActive(r)}
                className="text-left bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold truncate">{r.title}</span>
                    </div>
                    <p className="text-white/50 text-sm mt-1 line-clamp-2">{r.body}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
                      <span className="uppercase tracking-wide font-medium text-white/50">{CATEGORY_LABEL[r.category] || r.category}</span>
                      {r.app_area && <><span>·</span><span>{r.app_area}</span></>}
                      {r.severity && <><span>·</span><span className="capitalize">{r.severity}</span></>}
                      {r.reporter_name && <><span>·</span><span>{r.reporter_name}</span></>}
                      <span>·</span><span>{fmt(r.last_activity_at)}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${sm.cls}`}>{sm.label}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {active && (
        <DetailModal row={active} onClose={() => setActive(null)} onChanged={(updated) => {
          setRows((rs) => rs.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
          setActive((a) => (a ? { ...a, ...updated } : a))
        }} />
      )}
    </div>
  )
}

function DetailModal({ row, onClose, onChanged }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => { loadMsgs() }, [row.id])

  async function loadMsgs() {
    setLoading(true)
    const { data } = await supabase
      .from('tester_feedback_messages')
      .select('*')
      .eq('feedback_id', row.id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
  }

  async function changeStatus(status) {
    setSavingStatus(true)
    const { error } = await supabase.from('tester_feedback').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id)
    setSavingStatus(false)
    if (!error) onChanged({ id: row.id, status })
  }

  async function send() {
    if (!reply.trim()) return
    setSending(true)
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('tester_feedback_messages').insert({
      feedback_id: row.id,
      body: reply.trim(),
      author_role: 'dev',
      author_user_id: u?.user?.id,
    })
    setSending(false)
    if (!error) {
      setReply('')
      // auto-advance received -> in_progress on first dev reply
      if (row.status === 'received') changeStatus('in_progress')
      loadMsgs()
      onChanged({ id: row.id, last_activity_at: new Date().toISOString() })
    }
  }

  const sm = statusMeta(row.status)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-navy-700/50 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-white font-bold text-lg truncate">{row.title}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
              <span className="uppercase tracking-wide">{CATEGORY_LABEL[row.category] || row.category}</span>
              {row.app_area && <><span>·</span><span>{row.app_area}</span></>}
              {row.severity && <><span>·</span><span className="capitalize">{row.severity}</span></>}
              {row.reporter_name && <><span>·</span><span>{row.reporter_name}</span></>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Status control */}
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/40 mr-1">Status</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${sm.cls}`}>{sm.label}</span>
          <select
            value={row.status}
            disabled={savingStatus}
            onChange={(e) => changeStatus(e.target.value)}
            className="ml-auto bg-navy-900 border border-navy-700/50 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-brand-blue/50"
          >
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <Bubble dev={false} author={row.reporter_name || 'Tester'} when={fmt(row.created_at)} body={row.body} />
          {loading ? (
            <div className="py-4 flex justify-center"><div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
          ) : messages.map((m) => (
            <Bubble key={m.id} dev={m.author_role === 'dev'} author={m.author_role === 'dev' ? 'Dev Team' : (row.reporter_name || 'Tester')} when={fmt(m.created_at)} body={m.body} />
          ))}
        </div>

        {/* Reply */}
        <div className="p-4 border-t border-navy-700/50 flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Reply to the tester..."
            className="flex-1 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50 resize-none"
          />
          <button
            onClick={send}
            disabled={sending || !reply.trim()}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {sending ? 'Sending…' : 'Reply'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ dev, author, when, body }) {
  return (
    <div className={`flex flex-col ${dev ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-1.5 mb-1 text-xs">
        <span className={dev ? 'text-brand-blue font-semibold' : 'text-white/50'}>{author}</span>
        <span className="text-white/30">· {when}</span>
      </div>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${dev ? 'bg-brand-blue text-white rounded-tr-sm' : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-sm'}`}>
        {body}
      </div>
    </div>
  )
}
