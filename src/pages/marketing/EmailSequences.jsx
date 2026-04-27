// EmailSequences — admin view at /admin/marketing/sequences
// Lists email_sequence_steps grouped by product, shows send counts from email_sends,
// toggle active flag inline. Lightweight — no in-place HTML editing yet (edit via SQL
// or vault if needed). Provides at-a-glance "is the drip running" visibility.

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

const PRODUCT_LABELS = { bolo_go: 'BOLO Go', crm: 'CRM', general: 'General' }
const PRODUCT_TONES = {
  bolo_go: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  crm:     'bg-blue-500/10 text-blue-400 border-blue-500/30',
  general: 'bg-slate-700/30 text-slate-300 border-slate-500/30',
}

export default function EmailSequences() {
  const [steps, setSteps] = useState([])
  const [counts, setCounts] = useState({}) // step_id -> { sent, failed }
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [{ data: stepRows, error: stepErr }, { data: sendRows, error: sendErr }] = await Promise.all([
        supabase.from('email_sequence_steps')
          .select('id, product_interest, day_offset, subject, active, notes, updated_at')
          .order('product_interest', { ascending: true })
          .order('day_offset', { ascending: true }),
        supabase.from('email_sends')
          .select('step_id, status'),
      ])
      if (stepErr) throw stepErr
      if (sendErr) throw sendErr
      setSteps(stepRows || [])
      const c = {}
      for (const s of (sendRows || [])) {
        if (!c[s.step_id]) c[s.step_id] = { sent: 0, failed: 0 }
        if (s.status === 'sent') c[s.step_id].sent++
        else c[s.step_id].failed++
      }
      setCounts(c)
    } catch (err) {
      console.error('email sequences load:', err)
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(step) {
    setBusyId(step.id)
    try {
      await supabase.from('email_sequence_steps')
        .update({ active: !step.active })
        .eq('id', step.id)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const grouped = useMemo(() => {
    const g = {}
    for (const s of steps) {
      if (!g[s.product_interest]) g[s.product_interest] = []
      g[s.product_interest].push(s)
    }
    return g
  }, [steps])

  const totalSent = useMemo(() => Object.values(counts).reduce((a, c) => a + (c.sent || 0), 0), [counts])
  const totalFailed = useMemo(() => Object.values(counts).reduce((a, c) => a + (c.failed || 0), 0), [counts])

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Email Sequences</h1>
        <p className="text-slate-400 text-sm mt-1">Drip emails that auto-send to waitlist signups based on day offset since signup. Hourly cron picks up new sends.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Active steps" value={steps.filter(s => s.active).length} />
        <Stat label="Total steps" value={steps.length} />
        <Stat label="Emails sent" value={totalSent} tone="emerald" />
        <Stat label="Failed sends" value={totalFailed} tone={totalFailed > 0 ? 'rose' : 'slate'} />
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : steps.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 text-center text-slate-400">
          No drip steps configured. Insert rows into <span className="font-mono text-sky-400">email_sequence_steps</span> to start.
        </div>
      ) : (
        Object.entries(grouped).map(([product, productSteps]) => {
          const tone = PRODUCT_TONES[product] || PRODUCT_TONES.general
          return (
            <section key={product} className="mb-6">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone}`}>
                  {PRODUCT_LABELS[product] || product}
                </span>
                <span className="text-slate-500 text-xs">{productSteps.length} step{productSteps.length === 1 ? '' : 's'}</span>
              </h2>
              <div className="space-y-2">
                {productSteps.map(step => {
                  const c = counts[step.id] || { sent: 0, failed: 0 }
                  return (
                    <div key={step.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs uppercase tracking-wide text-slate-500 font-mono">Day {step.day_offset}</span>
                            {step.day_offset === 0 && (
                              <span className="text-[10px] uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">welcome</span>
                            )}
                            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${step.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/30 text-slate-500 border-slate-600/30'}`}>
                              {step.active ? 'active' : 'paused'}
                            </span>
                          </div>
                          <div className="text-white font-medium text-sm truncate">{step.subject}</div>
                          {step.notes && (
                            <div className="text-slate-500 text-xs mt-1 truncate">{step.notes}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Sent</div>
                            <div className="text-emerald-400 font-mono text-sm">{c.sent}</div>
                          </div>
                          {c.failed > 0 && (
                            <div className="text-right">
                              <div className="text-xs text-slate-500">Failed</div>
                              <div className="text-rose-400 font-mono text-sm">{c.failed}</div>
                            </div>
                          )}
                          <button
                            onClick={() => toggleActive(step)}
                            disabled={busyId === step.id}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              step.active
                                ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {busyId === step.id ? '…' : step.active ? 'Pause' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })
      )}

      <div className="mt-6 bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-xs text-slate-400">
        <div className="font-semibold text-slate-300 mb-1">How drips fire</div>
        <ul className="list-disc pl-4 space-y-1">
          <li>An hourly cron runs <span className="font-mono text-sky-400">send-drip-emails</span></li>
          <li>For each active step, it finds signups whose <span className="font-mono text-sky-400">created_at + day_offset</span> has elapsed</li>
          <li>Skips signups that already received that step (dedup via unique constraint on <span className="font-mono">email_sends</span>)</li>
          <li>Sends via Resend, logs the result. <span className="font-mono">{`{{first_name}}`}</span> is replaced at send time.</li>
        </ul>
      </div>
    </div>
  )
}

function Stat({ label, value, tone = 'slate' }) {
  const toneMap = { slate: 'text-white', emerald: 'text-emerald-400', rose: 'text-rose-400', sky: 'text-sky-400' }
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${toneMap[tone] || toneMap.slate}`}>{value.toLocaleString()}</div>
    </div>
  )
}
