import { useEffect, useMemo, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { isFounder } from '../lib/testerProgramService'

const TYPE_META = {
  tester_invite:       { label: 'Tester invite',       color: 'bg-sky-500/15 text-sky-300'         },
  affiliate_invite:    { label: 'Affiliate invite',    color: 'bg-pink-500/15 text-pink-300'       },
  creator_invite:      { label: 'Creator invite',      color: 'bg-pink-500/15 text-pink-300'       },
  client_invite:       { label: 'Client invite',       color: 'bg-emerald-500/15 text-emerald-300' },
  team_invite:         { label: 'Team invite',         color: 'bg-violet-500/15 text-violet-300'   },
  welcome:             { label: 'Welcome',             color: 'bg-amber-500/15 text-amber-300'     },
  password_reset:      { label: 'Password reset',      color: 'bg-rose-500/15 text-rose-300'       },
  support_reply:       { label: 'Support reply',       color: 'bg-indigo-500/15 text-indigo-300'   },
  notification:        { label: 'Notification',        color: 'bg-slate-500/15 text-slate-300'     },
  announcement:        { label: 'Announcement',        color: 'bg-violet-500/15 text-violet-300'   },
  receipt:             { label: 'Receipt',             color: 'bg-emerald-500/15 text-emerald-300' },
  onboarding_complete: { label: 'Onboarding complete', color: 'bg-emerald-500/15 text-emerald-300' },
  custom:              { label: 'Custom',              color: 'bg-zinc-500/15 text-zinc-300'       },
}

const STATUS_META = {
  queued:       { label: 'Queued',       color: 'bg-slate-500/15 text-slate-300'     },
  sent:         { label: 'Sent',         color: 'bg-sky-500/15 text-sky-300'         },
  delivered:    { label: 'Delivered',    color: 'bg-emerald-500/15 text-emerald-300' },
  opened:       { label: 'Opened',       color: 'bg-emerald-500/15 text-emerald-300' },
  clicked:      { label: 'Clicked',      color: 'bg-pink-500/15 text-pink-300'       },
  bounced:      { label: 'Bounced',      color: 'bg-rose-500/15 text-rose-300'       },
  failed:       { label: 'Failed',       color: 'bg-rose-500/15 text-rose-300'       },
  spam:         { label: 'Spam',         color: 'bg-amber-500/15 text-amber-300'     },
  unsubscribed: { label: 'Unsubscribed', color: 'bg-zinc-500/15 text-zinc-300'       },
}

function formatDT(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  if (diffMin < 10080) return `${Math.floor(diffMin / 1440)}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function OutboundMail() {
  const { user, profile } = useAuth()
  const allowed = isFounder({ email: user?.email, personal_email: profile?.personal_email })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('7d')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let sinceIso = null
      if (range === '24h') sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      else if (range === '7d') sinceIso = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
      else if (range === '30d') sinceIso = new Date(Date.now() - 30 * 86400 * 1000).toISOString()

      let q = supabase.from('outbound_emails').select('*').order('sent_at', { ascending: false }).limit(500)
      if (sinceIso) q = q.gte('sent_at', sinceIso)
      const { data, error } = await q
      if (error) throw error
      setRows(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load outbound mail') }
    finally { setLoading(false) }
  }, [range])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filterType !== 'all' && r.email_type !== filterType) return false
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (q) {
        const hay = `${r.recipient_email || ''} ${r.recipient_name || ''} ${r.subject || ''} ${r.body_preview || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filterType, filterStatus, search])

  const stats = useMemo(() => {
    const total = rows.length
    const failed = rows.filter((r) => r.status === 'failed' || r.status === 'bounced').length
    const delivered = rows.filter((r) => ['delivered', 'opened', 'clicked'].includes(r.status)).length
    const byType = {}
    rows.forEach((r) => { byType[r.email_type] = (byType[r.email_type] || 0) + 1 })
    return { total, failed, delivered, byType }
  }, [rows])

  async function resendEmail(row) {
    if (!row.related_entity_type || !row.related_entity_id) {
      toast.error('No linked invite — cannot resend')
      return
    }
    try {
      const fnName = row.email_type === 'tester_invite' ? 'send-tester-invite'
                   : row.email_type === 'affiliate_invite' ? 'send-affiliate-invite'
                   : null
      if (!fnName) { toast.error(`Resend not supported for ${row.email_type}`); return }
      const { error } = await supabase.functions.invoke(fnName, {
        body: { invite_id: row.related_entity_id },
      })
      if (error) throw error
      toast.success('Re-sent — refreshing log')
      load()
    } catch (e) {
      console.error(e); toast.error('Resend failed: ' + (e?.message || 'unknown error'))
    }
  }

  if (!allowed) {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><span>📬</span><span>Outbound Mail</span></h1>
          <p className="text-sm text-gray-400">Every email the platform has sent — invites, welcomes, notifications. Full audit trail.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={range} onChange={(e) => setRange(e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded-md px-2 py-1.5 text-xs text-white">
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <button onClick={load} className="px-3 py-1.5 bg-navy-700 hover:bg-navy-600 text-white rounded-md text-xs font-medium">🔄 Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Total sent" value={stats.total} accent="text-slate-300" />
        <StatCard label="Delivered / opened" value={stats.delivered} accent="text-emerald-300" />
        <StatCard label="Failed / bounced" value={stats.failed} accent={stats.failed > 0 ? 'text-rose-300' : 'text-slate-300'} />
        <StatCard label="Invites sent" value={(stats.byType.tester_invite || 0) + (stats.byType.affiliate_invite || 0)} accent="text-pink-300" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipient, subject, preview…" className="flex-1 min-w-[240px] bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-xs text-white">
          <option value="all">All types</option>
          {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-xs text-white">
          <option value="all">All statuses</option>
          {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_560px] gap-4">
        {/* LEFT: List */}
        <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-navy-700/50 text-[10px] uppercase font-bold text-gray-500 flex items-center justify-between">
            <span>Message log ({visible.length})</span>
            {loading && <span className="text-gray-500 normal-case">Loading…</span>}
          </div>
          {visible.length === 0 ? (
            <div className="p-12 text-center text-gray-500 italic">
              {rows.length === 0 ? 'No outbound mail in this window.' : 'No messages match those filters.'}
            </div>
          ) : (
            <div className="divide-y divide-navy-700/30 max-h-[70vh] overflow-y-auto">
              {visible.map((r) => {
                const typeMeta = TYPE_META[r.email_type] || TYPE_META.custom
                const statusMeta = STATUS_META[r.status] || STATUS_META.sent
                const isSelected = selected?.id === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-3 py-2.5 transition hover:bg-navy-800/70 ${isSelected ? 'bg-pink-500/10 border-l-2 border-pink-500' : 'border-l-2 border-transparent'}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${typeMeta.color}`}>{typeMeta.label}</span>
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${statusMeta.color}`}>{statusMeta.label}</span>
                        </div>
                        <div className="text-sm text-white font-semibold truncate">{r.subject}</div>
                        <div className="text-xs text-gray-400 truncate">
                          {r.recipient_name ? `${r.recipient_name} · ` : ''}{r.recipient_email}
                        </div>
                        {r.body_preview && <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{r.body_preview}</div>}
                      </div>
                      <div className="text-[10px] text-gray-500 flex-shrink-0 whitespace-nowrap">
                        {formatDT(r.sent_at)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Preview */}
        <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-4">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-center text-gray-500 italic py-24">
              Pick a message to inspect full details, body HTML, and resend.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500">Subject</div>
                  <div className="text-base font-semibold text-white">{selected.subject}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[9px] uppercase text-gray-500">Recipient</div>
                  <div className="text-white">{selected.recipient_name || '—'}</div>
                  <div className="text-gray-400 font-mono text-[11px]">{selected.recipient_email}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-gray-500">Sent at</div>
                  <div className="text-white">{new Date(selected.sent_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-gray-500">Type</div>
                  <div>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${(TYPE_META[selected.email_type] || TYPE_META.custom).color}`}>
                      {(TYPE_META[selected.email_type] || TYPE_META.custom).label}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-gray-500">Status</div>
                  <div>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${(STATUS_META[selected.status] || STATUS_META.sent).color}`}>
                      {(STATUS_META[selected.status] || STATUS_META.sent).label}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-gray-500">Provider</div>
                  <div className="text-white capitalize">{selected.provider}</div>
                  {selected.provider_message_id && (
                    <div className="text-gray-500 font-mono text-[10px] truncate" title={selected.provider_message_id}>{selected.provider_message_id}</div>
                  )}
                </div>
                <div>
                  <div className="text-[9px] uppercase text-gray-500">Linked to</div>
                  <div className="text-white text-[11px]">{selected.related_entity_type || '—'}</div>
                  {selected.related_entity_id && (
                    <div className="text-gray-500 font-mono text-[10px] truncate" title={selected.related_entity_id}>{selected.related_entity_id.slice(0, 8)}…</div>
                  )}
                </div>
              </div>

              {selected.error_message && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-md p-3">
                  <div className="text-[10px] uppercase font-bold text-rose-300 mb-1">Error</div>
                  <div className="text-xs text-rose-200 font-mono break-words">{selected.error_message}</div>
                </div>
              )}

              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <details className="bg-navy-900/50 border border-navy-700/50 rounded-md">
                  <summary className="px-3 py-2 text-[10px] uppercase font-bold text-gray-400 cursor-pointer">Metadata</summary>
                  <pre className="px-3 pb-3 text-[10px] text-gray-300 font-mono whitespace-pre-wrap break-words">{JSON.stringify(selected.metadata, null, 2)}</pre>
                </details>
              )}

              {selected.body_html && (
                <details className="bg-navy-900/50 border border-navy-700/50 rounded-md" open>
                  <summary className="px-3 py-2 text-[10px] uppercase font-bold text-gray-400 cursor-pointer">Body preview</summary>
                  <div className="bg-white rounded-b-md overflow-hidden max-h-[400px] overflow-y-auto">
                    <iframe
                      srcDoc={selected.body_html}
                      title="Email body preview"
                      sandbox=""
                      className="w-full min-h-[400px] border-0"
                    />
                  </div>
                </details>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-navy-700/50">
                {(selected.email_type === 'tester_invite' || selected.email_type === 'affiliate_invite') && selected.related_entity_id && (
                  <button onClick={() => resendEmail(selected)} className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-md text-xs font-medium">
                    🔁 Resend
                  </button>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(selected.recipient_email).then(() => toast.success('Copied'))}
                  className="px-3 py-1.5 bg-navy-700 hover:bg-navy-600 text-white rounded-md text-xs font-medium"
                >📋 Copy email</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-3">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
