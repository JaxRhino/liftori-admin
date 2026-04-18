import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { isFounder } from '../lib/testerProgramService'

/**
 * Investors — Wave 14 Investor Nest admin pipeline.
 *
 * Founder-only (Ryan + Mike). Surfaces:
 *   - Aggregate stats via investor_pipeline_summary() RPC
 *   - Table of investor_leads rows with stage filter + search
 *   - Detail panel for stage edit, committed $ edit, notes
 *   - CSV export
 *
 * Leads come from /invest/:handle public landing (submit_investor_lead RPC)
 * and are attributed to the rep whose handle was scanned.
 */

// ─── Constants ─────────────────────────────────────────────────────────
const STAGE_CONFIG = {
  new:               { label: 'New',               bg: 'bg-slate-500/20',    text: 'text-slate-300',    dot: 'bg-slate-400' },
  meeting_scheduled: { label: 'Meeting Scheduled', bg: 'bg-brand-blue/20',   text: 'text-brand-blue',   dot: 'bg-brand-blue' },
  meeting_completed: { label: 'Meeting Completed', bg: 'bg-indigo-500/20',   text: 'text-indigo-300',   dot: 'bg-indigo-400' },
  deck_sent:         { label: 'Deck Sent',         bg: 'bg-violet-500/20',   text: 'text-violet-300',   dot: 'bg-violet-400' },
  term_sheet:        { label: 'Term Sheet',        bg: 'bg-amber-500/20',    text: 'text-amber-300',    dot: 'bg-amber-400' },
  committed:         { label: 'Committed',         bg: 'bg-emerald-500/20',  text: 'text-emerald-300',  dot: 'bg-emerald-400' },
  closed_won:        { label: 'Closed — Won',      bg: 'bg-emerald-600/30',  text: 'text-emerald-200',  dot: 'bg-emerald-300' },
  closed_lost:       { label: 'Closed — Lost',     bg: 'bg-red-500/20',      text: 'text-red-300',      dot: 'bg-red-400' },
}

const STAGE_ORDER = [
  'new', 'meeting_scheduled', 'meeting_completed',
  'deck_sent', 'term_sheet', 'committed',
  'closed_won', 'closed_lost',
]

const STAGE_TABS = ['all', ...STAGE_ORDER]

const RANGE_LABELS = {
  under_25k:  'Under $25K',
  '25k_100k': '$25K – $100K',
  '100k_250k':'$100K – $250K',
  '250k_plus':'$250K+',
}

const TIMELINE_LABELS = {
  now:       'Now',
  '30d':     'Within 30 days',
  '90d':     'Within 90 days',
  exploring: 'Exploring',
}

const ACCREDITED_LABELS = {
  yes:    'Accredited',
  no:     'Not accredited',
  unsure: 'Unsure',
}

// ─── Helpers ───────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function formatCents(cents) {
  if (!cents || cents === 0) return '$0'
  const d = cents / 100
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`
  if (d >= 10_000) return `$${Math.round(d / 1000)}K`
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}K`
  return `$${Math.round(d)}`
}

function StageBadge({ stage }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.new
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function Toast({ message, type, onDismiss }) {
  if (!message) return null
  const colors = type === 'error'
    ? 'bg-red-900/80 border-red-600/50 text-red-300'
    : 'bg-emerald-900/80 border-emerald-600/50 text-emerald-300'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl ${colors}`}>
      <span className="text-sm">{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  )
}

// ─── Detail Panel ──────────────────────────────────────────────────────
function DetailPanel({ lead, onClose, onUpdate, onToast, founders }) {
  const [stage, setStage] = useState(lead?.stage || 'new')
  const [notes, setNotes] = useState(lead?.notes || '')
  const [committed, setCommitted] = useState(
    lead?.deal_size_cents != null ? String(lead.deal_size_cents / 100) : ''
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStage(lead?.stage || 'new')
    setNotes(lead?.notes || '')
    setCommitted(lead?.deal_size_cents != null ? String(lead.deal_size_cents / 100) : '')
  }, [lead?.id])

  if (!lead) return null

  const bookedFounderName = lead.booked_founder_id
    ? (founders?.[lead.booked_founder_id] || lead.booked_founder_id.slice(0, 8))
    : null

  async function save() {
    setSaving(true)
    try {
      const cents = committed === '' ? null : Math.round(parseFloat(committed) * 100)
      if (committed !== '' && (Number.isNaN(cents) || cents < 0)) {
        onToast('Committed $ must be a positive number.', 'error')
        setSaving(false)
        return
      }
      const { error } = await supabase
        .from('investor_leads')
        .update({ stage, notes, deal_size_cents: cents })
        .eq('id', lead.id)
      if (error) throw error
      onUpdate({ ...lead, stage, notes, deal_size_cents: cents })
      onToast('Lead updated.', 'success')
    } catch (err) {
      console.error(err)
      onToast(err.message || 'Update failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-navy-900 border-l border-navy-700 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-navy-900 border-b border-navy-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-semibold text-white">{lead.name || '(no name)'}</h3>
            <div className="mt-1"><StageBadge stage={lead.stage} /></div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact */}
          <section>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Email</dt><dd className="text-white text-right break-all">{lead.email || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Phone</dt><dd className="text-white text-right">{lead.phone || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Company</dt><dd className="text-white text-right">{lead.company || '—'}</dd></div>
            </dl>
          </section>

          {/* Intake */}
          <section>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Intake</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Range</dt><dd className="text-white text-right">{RANGE_LABELS[lead.investment_range] || lead.investment_range || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Accredited</dt><dd className="text-white text-right">{ACCREDITED_LABELS[lead.accredited] || lead.accredited || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Timeline</dt><dd className="text-white text-right">{TIMELINE_LABELS[lead.timeline] || lead.timeline || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Submitted</dt><dd className="text-white text-right">{formatDateTime(lead.created_at)}</dd></div>
              {lead.booked_for_ts && (
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Requested call</dt><dd className="text-white text-right">{formatDateTime(lead.booked_for_ts)}</dd></div>
              )}
              {lead.booked_timezone && (
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Timezone</dt><dd className="text-white text-right">{lead.booked_timezone}</dd></div>
              )}
            </dl>
            {lead.message && (
              <div className="mt-3 p-3 rounded-lg bg-navy-800/60 border border-navy-700">
                <div className="text-xs text-slate-400 mb-1">Their message</div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{lead.message}</p>
              </div>
            )}
          </section>

          {/* Attribution */}
          <section>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Attribution</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Rep handle</dt><dd className="text-white text-right font-mono">{lead.rep_handle ? `@${lead.rep_handle}` : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Booked founder</dt><dd className="text-white text-right">{bookedFounderName || '—'}</dd></div>
            </dl>
          </section>

          {/* Editable */}
          <section>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pipeline</h4>

            <label className="block text-xs text-slate-400 mb-1">Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue mb-4"
            >
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
              ))}
            </select>

            <label className="block text-xs text-slate-400 mb-1">Committed $ (whole dollars)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={committed}
              onChange={(e) => setCommitted(e.target.value)}
              placeholder="0"
              className="w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue mb-4"
            />

            <label className="block text-xs text-slate-400 mb-1">Internal notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Conversation notes, next steps..."
              className="w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue resize-y"
            />

            <button
              onClick={save}
              disabled={saving}
              className="mt-4 w-full px-4 py-2.5 rounded-lg bg-brand-blue/20 text-brand-blue border border-brand-blue/40 hover:bg-brand-blue/30 disabled:opacity-40 transition-colors text-sm font-medium"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────
export default function Investors() {
  const { user, profile } = useAuth()
  const founder = isFounder({ email: user?.email, personal_email: profile?.personal_email })

  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])
  const [summary, setSummary] = useState(null)
  const [founders, setFounders] = useState({}) // { uuid: full_name }
  const [stageFilter, setStageFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState({ message: '', type: 'success' })

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'success' }), 3000)
  }

  useEffect(() => {
    if (!founder) {
      setLoading(false)
      return
    }
    load()
  }, [founder])

  async function load() {
    setLoading(true)
    try {
      const [leadsRes, summaryRes, foundersRes] = await Promise.all([
        supabase
          .from('investor_leads')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.rpc('investor_pipeline_summary'),
        supabase.rpc('list_investor_founders'),
      ])
      if (leadsRes.error) throw leadsRes.error
      if (summaryRes.error) throw summaryRes.error
      // founders is best-effort — don't block on error
      const foundersMap = {}
      if (!foundersRes.error && Array.isArray(foundersRes.data)) {
        for (const f of foundersRes.data) {
          if (f?.id) foundersMap[f.id] = f.full_name || f.email || f.id
        }
      }
      setLeads(leadsRes.data || [])
      setSummary(summaryRes.data || {})
      setFounders(foundersMap)
    } catch (err) {
      console.error('Failed to load investor pipeline:', err)
      showToast(err.message || 'Failed to load.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Stage counts across ALL leads (not just filtered)
  const stageCounts = useMemo(() => {
    const counts = { all: leads.length }
    for (const s of STAGE_ORDER) counts[s] = 0
    for (const l of leads) {
      if (counts[l.stage] != null) counts[l.stage] += 1
    }
    return counts
  }, [leads])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (stageFilter !== 'all' && l.stage !== stageFilter) return false
      if (q) {
        const hay = [l.name, l.email, l.company, l.rep_handle, l.notes]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [leads, stageFilter, search])

  function exportCsv() {
    const header = [
      'Submitted', 'Name', 'Email', 'Phone', 'Company',
      'Range', 'Accredited', 'Timeline', 'Stage',
      'Deal Size $', 'Rep Handle', 'Booked Founder', 'Booked For',
      'Message', 'Notes',
    ]
    const escape = (v) => {
      const s = v == null ? '' : String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const rows = filtered.map((l) => [
      l.created_at ? new Date(l.created_at).toISOString() : '',
      l.name, l.email, l.phone, l.company,
      RANGE_LABELS[l.investment_range] || l.investment_range,
      ACCREDITED_LABELS[l.accredited] || l.accredited,
      TIMELINE_LABELS[l.timeline] || l.timeline,
      STAGE_CONFIG[l.stage]?.label || l.stage,
      l.deal_size_cents != null ? (l.deal_size_cents / 100).toFixed(2) : '',
      l.rep_handle,
      l.booked_founder_id ? (founders[l.booked_founder_id] || l.booked_founder_id) : '',
      l.booked_for_ts ? new Date(l.booked_for_ts).toISOString() : '',
      l.message, l.notes,
    ].map(escape).join(','))
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `investor-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!founder) {
    return (
      <div className="p-8">
        <div className="max-w-xl mx-auto bg-navy-900 border border-navy-700 rounded-xl p-8 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Investors — founder only</h1>
          <p className="text-sm text-slate-400">
            The Investor Pipeline surface is restricted to Liftori founders (Ryan + Mike).
            If you believe you should have access, contact Ryan.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Investor Pipeline</h1>
          <p className="text-sm text-slate-400 mt-1">
            Inbound from <span className="font-mono text-brand-blue">/invest/:handle</span> — scans, leads, founder calls, committed capital.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-blue/20 text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Export CSV ({filtered.length})
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Scans (30d)</p>
          <p className="text-2xl font-bold text-white">{summary?.scans_30d ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-1">inbound QR traffic</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Leads (30d)</p>
          <p className="text-2xl font-bold text-brand-blue">{summary?.leads_30d ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-1">all time: {summary?.leads_total ?? leads.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Scheduled</p>
          <p className="text-2xl font-bold text-indigo-300">{summary?.scheduled ?? stageCounts.meeting_scheduled}</p>
          <p className="text-[11px] text-slate-500 mt-1">deck sent: {summary?.deck_sent ?? stageCounts.deck_sent}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Committed $</p>
          <p className="text-2xl font-bold text-emerald-300">{formatCents(summary?.committed_cents ?? 0)}</p>
          <p className="text-[11px] text-slate-500 mt-1">signed: {summary?.committed ?? (stageCounts.committed + stageCounts.closed_won)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-slate-400 mb-1">Closed Won</p>
          <p className="text-2xl font-bold text-emerald-300">{stageCounts.closed_won}</p>
          <p className="text-[11px] text-slate-500 mt-1">lost: {stageCounts.closed_lost}</p>
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STAGE_TABS.map((t) => {
          const active = stageFilter === t
          const count = stageCounts[t] ?? 0
          const label = t === 'all' ? 'All' : (STAGE_CONFIG[t]?.label || t)
          return (
            <button
              key={t}
              onClick={() => setStageFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                active
                  ? 'bg-brand-blue/20 text-brand-blue border-brand-blue/40'
                  : 'bg-navy-800/60 text-slate-400 border-navy-700 hover:text-white'
              }`}
            >
              {label} <span className="opacity-60">· {count}</span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company, rep…"
          className="w-full md:w-96 bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-blue"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">No investor leads match the current filters.</p>
          {(search || stageFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setStageFilter('all') }}
              className="mt-2 text-xs text-brand-blue hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-navy-900 border border-navy-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-800/60 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Submitted</th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Range</th>
                <th className="text-left px-4 py-3 font-medium">Timeline</th>
                <th className="text-left px-4 py-3 font-medium">Rep</th>
                <th className="text-left px-4 py-3 font-medium">Stage</th>
                <th className="text-right px-4 py-3 font-medium">Committed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className="table-row cursor-pointer border-t border-navy-800 hover:bg-navy-800/40"
                >
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(l.created_at)}</td>
                  <td className="px-4 py-3 text-white">
                    <div className="font-medium">{l.name || '—'}</div>
                    <div className="text-xs text-slate-500">{l.email || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{RANGE_LABELS[l.investment_range] || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{TIMELINE_LABELS[l.timeline] || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {l.rep_handle ? <span className="font-mono text-brand-blue">@{l.rep_handle}</span> : '—'}
                  </td>
                  <td className="px-4 py-3"><StageBadge stage={l.stage} /></td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-300">
                    {formatCents(l.deal_size_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailPanel
        lead={selected}
        founders={founders}
        onClose={() => setSelected(null)}
        onUpdate={(updated) => {
          setLeads((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
          setSelected(updated)
          // Refresh aggregate summary so committed $ + stage counts stay in sync
          supabase.rpc('investor_pipeline_summary').then(({ data }) => data && setSummary(data))
        }}
        onToast={showToast}
      />

      <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: 'success' })} />
    </div>
  )
}
