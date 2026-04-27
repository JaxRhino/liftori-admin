// WeekPlanner — modal that calls plan-marketing-week to generate a balanced week of posts,
// lets the operator review/edit, then batch-schedules them with status='scheduled' so the
// publish-scheduled-posts cron auto-publishes each at the assigned time.

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const PRODUCT_TONES = {
  bolo_go: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  crm:     'bg-blue-500/10 text-blue-400 border-blue-500/30',
  general: 'bg-slate-700/30 text-slate-300 border-slate-500/30',
}
const PRODUCT_LABELS = { bolo_go: 'BOLO Go', crm: 'CRM', general: 'General' }

function todayPlusDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function WeekPlanner({ isOpen, onClose, onPlanScheduled }) {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(todayPlusDays(1))
  const [postsPerWeek, setPostsPerWeek] = useState(5)
  const [boloCount, setBoloCount] = useState(2)
  const [crmCount, setCrmCount] = useState(2)
  const [generalCount, setGeneralCount] = useState(1)
  const [postTime, setPostTime] = useState('13:00') // UTC, 9am ET
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState([])
  const [error, setError] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [done, setDone] = useState('')

  if (!isOpen) return null

  const totalProducts = boloCount + crmCount + generalCount
  const mixMatchesCount = totalProducts === postsPerWeek

  async function generate() {
    if (!mixMatchesCount) {
      setError(`Product mix (${totalProducts}) must equal posts per week (${postsPerWeek}).`)
      return
    }
    setLoading(true)
    setError('')
    setPlan([])
    setDone('')
    try {
      const { data: sessionRes } = await supabase.auth.getSession()
      const token = sessionRes?.session?.access_token
      if (!token) throw new Error('Not signed in')

      const fnUrl = `${supabase.supabaseUrl}/functions/v1/plan-marketing-week`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          start_date: startDate,
          posts_per_week: postsPerWeek,
          product_mix: { bolo_go: boloCount, crm: crmCount, general: generalCount },
          default_post_time: postTime,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setPlan(json.plan || [])
    } catch (err) {
      setError(err.message || 'Failed to generate plan')
    } finally {
      setLoading(false)
    }
  }

  function updatePlanItem(idx, patch) {
    setPlan(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  function removePlanItem(idx) {
    setPlan(prev => prev.filter((_, i) => i !== idx))
  }

  async function scheduleAll() {
    if (plan.length === 0) return
    setScheduling(true)
    setError('')
    try {
      const rows = plan.map(p => ({
        content: p.content,
        content_type: p.content_type || 'Announcement',
        platforms: ['facebook'],
        status: 'scheduled',
        scheduled_for: p.scheduled_for,
        created_by: user?.id ?? null,
        ai_generated: true,
        source_type: 'ai_generator',
      }))
      const { error } = await supabase.from('marketing_posts').insert(rows)
      if (error) throw error
      setDone(`Scheduled ${rows.length} posts. Cron will auto-publish each at the chosen time.`)
      setPlan([])
      onPlanScheduled?.(rows.length)
    } catch (err) {
      setError(err.message || 'Failed to schedule posts')
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-amber-400">🗓</span> Plan a week of posts with AI
            </h2>
            <p className="text-xs text-slate-400 mt-1">Claude drafts a balanced week. You review, edit, and batch-schedule. Cron auto-publishes each post at the chosen time.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* CONFIG */}
        <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Field label="Start date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Posts in run">
              <input type="number" min={1} max={7} value={postsPerWeek} onChange={(e) => setPostsPerWeek(Number(e.target.value) || 1)} className={inputCls} />
            </Field>
            <Field label="Post time (UTC)">
              <input type="time" value={postTime} onChange={(e) => setPostTime(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Total mix">
              <div className={`${inputCls} flex items-center justify-between`}>
                <span className={mixMatchesCount ? 'text-emerald-400' : 'text-amber-400'}>{totalProducts} / {postsPerWeek}</span>
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="BOLO Go count">
              <input type="number" min={0} max={7} value={boloCount} onChange={(e) => setBoloCount(Number(e.target.value) || 0)} className={inputCls} />
            </Field>
            <Field label="CRM count">
              <input type="number" min={0} max={7} value={crmCount} onChange={(e) => setCrmCount(Number(e.target.value) || 0)} className={inputCls} />
            </Field>
            <Field label="General count">
              <input type="number" min={0} max={7} value={generalCount} onChange={(e) => setGeneralCount(Number(e.target.value) || 0)} className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={generate}
            disabled={loading || !mixMatchesCount}
            className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Drafting week…' : `Generate ${postsPerWeek}-post plan`}
          </button>
          {plan.length > 0 && (
            <button
              onClick={scheduleAll}
              disabled={scheduling}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
            >
              {scheduling ? 'Scheduling…' : `Schedule all ${plan.length} posts →`}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Close</button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm mb-4">✗ {error}</div>
        )}
        {done && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg p-3 text-sm mb-4">✓ {done}</div>
        )}

        {/* PLAN */}
        {plan.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Review and edit before scheduling</div>
            {plan.map((p, idx) => {
              const tone = PRODUCT_TONES[p.product_interest] || PRODUCT_TONES.general
              return (
                <div key={idx} className="bg-slate-800/70 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs uppercase tracking-wide text-amber-400 font-mono">#{idx + 1}</span>
                      <span className="text-xs font-mono text-slate-400">{p.date_iso}</span>
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone}`}>
                        {PRODUCT_LABELS[p.product_interest] || p.product_interest}
                      </span>
                      <span className="text-[10px] uppercase bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{p.content_type}</span>
                      {p.suggested_card_template && (
                        <span className="text-[10px] uppercase bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">card: {p.suggested_card_template}</span>
                      )}
                    </div>
                    <button
                      onClick={() => removePlanItem(idx)}
                      className="text-xs text-slate-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={p.content}
                    onChange={(e) => updatePlanItem(idx, { content: e.target.value })}
                    rows={5}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 resize-none whitespace-pre-wrap"
                  />
                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <input
                      type="datetime-local"
                      value={p.scheduled_for ? p.scheduled_for.slice(0, 16) : ''}
                      onChange={(e) => updatePlanItem(idx, { scheduled_for: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                    {Array.isArray(p.hashtags) && p.hashtags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {p.hashtags.slice(0, 5).map(h => (
                          <span key={h} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">#{h}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && plan.length === 0 && !error && !done && (
          <div className="text-center py-10 text-slate-500 text-sm">
            <div className="text-3xl mb-2">🗓</div>
            <div>Set the mix above and click Generate to draft a week.</div>
            <div className="text-xs text-slate-600 mt-2">Posts schedule with status=scheduled. Cron auto-publishes each at the chosen time.</div>
          </div>
        )}
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-slate-400 block mb-1 font-mono">{label}</span>
      {children}
    </label>
  )
}
