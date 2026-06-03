// ============================================================
// Automations.jsx — /admin/automations (Wave E.1 — 2026-06-03)
// Workflow library + run history + create button.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const STATUS_COLOR = { active: '#10b981', draft: '#94a3b8', paused: '#f59e0b' }
const TRIGGER_LABEL = {
  record_created: 'When a record is created',
  record_updated: 'When a record is updated',
  record_stage_changed: 'When stage changes',
  scheduled: 'On a schedule',
  webhook: 'When webhook fires',
  form_submitted: 'When form is submitted',
  email_replied: 'When email is replied to',
  no_activity: 'When activity goes quiet',
}

export default function Automations() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('crm_automations')
        .select('*')
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })
      if (!cancelled) {
        if (error) console.warn('automations load', error)
        setItems(data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter(i => i.status === filter)
  }, [items, filter])

  const counts = useMemo(() => ({
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    draft: items.filter(i => i.status === 'draft').length,
    runs: items.reduce((a, i) => a + (i.total_runs || 0), 0),
  }), [items])

  async function toggleStatus(item) {
    const next = item.status === 'active' ? 'paused' : 'active'
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: next } : x))
    await supabase.from('crm_automations').update({ status: next }).eq('id', item.id)
  }

  if (!user) return <div className="p-6 text-slate-300">Not signed in.</div>

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">Automations</h1>
            <p className="mt-1 text-sm text-slate-400">Trigger-based workflows. The CRM does the boring work for you.</p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-cyan px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-brand-cyan/90">
            + New Automation
          </button>
        </header>

        <div className="mb-5 grid grid-cols-4 gap-3">
          <Stat label="Total"   value={counts.total} />
          <Stat label="Active"  value={counts.active} accent="#10b981" />
          <Stat label="Drafts"  value={counts.draft}  accent="#94a3b8" />
          <Stat label="Total runs (30d)" value={counts.runs} accent="#06b6d4" />
        </div>

        <div className="mb-4 flex items-center gap-2">
          {['all','active','draft','paused'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === s
                  ? 'border-transparent bg-brand-cyan text-navy-950'
                  : 'border-navy-700/60 bg-navy-800/40 text-slate-300 hover:text-brand-cyan'
              }`}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-10 text-center text-slate-500">Loading automations…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-10 text-center text-slate-500">
            No automations in this view yet.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => {
              const successPct = a.total_runs > 0 ? Math.round((a.success_runs / a.total_runs) * 100) : null
              return (
                <article key={a.id} className="rounded-lg border border-navy-700/50 bg-navy-800/60 p-4 transition hover:border-brand-cyan/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{a.name}</h3>
                        <span
                          className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider"
                          style={{ borderColor: (STATUS_COLOR[a.status] || '#64748b') + '60', color: STATUS_COLOR[a.status] || '#64748b' }}
                        >{a.status}</span>
                        {a.is_ai_assisted && (
                          <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-purple-300">
                            ✨ AI
                          </span>
                        )}
                      </div>
                      {a.description && <p className="mt-1 text-xs text-slate-400">{a.description}</p>}
                      <p className="mt-2 text-[11px] text-slate-500">
                        <span className="text-slate-400">{TRIGGER_LABEL[a.trigger_type] || a.trigger_type}</span>
                        {a.trigger_table && <> on <code className="rounded bg-navy-900/60 px-1 py-0.5 text-[10px]">{a.trigger_table}</code></>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-100">{a.total_runs || 0} runs</p>
                        {successPct !== null && (
                          <p className="text-[10px]" style={{ color: successPct >= 95 ? '#10b981' : successPct >= 80 ? '#f59e0b' : '#ef4444' }}>
                            {successPct}% success
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleStatus(a)}
                        className="rounded-md border border-navy-700/60 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-brand-cyan/40 hover:text-brand-cyan"
                      >
                        {a.status === 'active' ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-navy-700/50 bg-navy-800/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: accent || '#f1f5f9' }}>{value}</p>
    </div>
  )
}
