import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import WorkforceTalkPanel from '../workforce/WorkforceTalkPanel'

const INPUT_STYLE = { backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }

export default function CEODashboard() {
  const { profile } = useAuth()
  const [emma, setEmma] = useState(null)
  const [brian, setBrian] = useState(null)
  const [prefs, setPrefs] = useState(null)
  const [todayBrief, setTodayBrief] = useState(null)
  const [briefHistory, setBriefHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      const todayIso = new Date().toISOString().split('T')[0]
      const [emmaRes, brianRes, prefsRes, todayRes, historyRes] = await Promise.all([
        supabase.from('ai_agents').select('id, name, role, slug, is_active, tagline').eq('slug', 'emma').maybeSingle(),
        supabase.from('workforce_humans').select('*').eq('full_name', 'Brian Powe').maybeSingle(),
        supabase.from('ceo_preferences').select('*').limit(1).maybeSingle(),
        supabase.from('ceo_morning_briefs').select('*').eq('brief_date', todayIso).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('ceo_morning_briefs').select('id, brief_date, content, cost_usd, feedback_rating, created_at').order('brief_date', { ascending: false }).order('created_at', { ascending: false }).limit(10),
      ])
      setEmma(emmaRes.data)
      setBrian(brianRes.data)
      setPrefs(prefsRes.data)
      setTodayBrief(todayRes.data)
      setBriefHistory(historyRes.data || [])
    } catch (e) { setError(e.message || String(e)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  if (loading) {
    return <div className="min-h-screen bg-navy-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
  }
  if (error) {
    return <div className="min-h-screen bg-navy-950 p-6 text-rose-300">{error}</div>
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{brian?.full_name || 'CEO'} Office</h1>
            <p className="text-slate-400 mt-1 text-sm">
              {emma ? <>Your AI Executive Assistant <span className="text-brand-blue font-semibold">{emma.name}</span> is on duty.</> : 'No EA configured.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {emma && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className={`w-2 h-2 rounded-full ${emma.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {emma.is_active ? 'Emma active' : 'Emma paused'}
              </div>
            )}
          </div>
        </div>

        {/* Onboarding checklist */}
        <OnboardingChecklist prefs={prefs} brian={brian} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
          {/* Left: Today's brief + history */}
          <div className="xl:col-span-2 space-y-4">
            <TodaysBrief todayBrief={todayBrief} onGenerated={reload} />
            <PreferencesCard prefs={prefs} onSaved={reload} />
            <BriefHistory items={briefHistory} />
          </div>

          {/* Right: Emma chat panel embedded */}
          <div className="xl:col-span-1">
            {emma ? (
              <div className="bg-navy-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-white">Talk to {emma.name}</h3>
                  <span className="text-xs text-slate-500">your EA</span>
                </div>
                <WorkforceTalkPanel agent={emma} />
              </div>
            ) : (
              <div className="bg-navy-900 border border-slate-800 rounded-xl p-6 text-center text-slate-500 text-sm">
                Emma not configured. Run the workforce_phase1e migration.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function OnboardingChecklist({ prefs, brian }) {
  const items = [
    { label: 'Liftori auth account created', done: !!prefs?.user_id, hint: 'Ryan creates this when you set your password.' },
    { label: 'Liftori email setup (brian@liftori.ai)', done: !!brian?.email, hint: 'Email mailbox provisioned in Google Workspace.' },
    { label: 'Preferences set (timezone, brief time)', done: !!prefs?.timezone && prefs?.morning_brief_time !== null, hint: 'Adjust below.' },
    { label: 'First morning brief generated', done: false, hint: 'Click "Generate today\'s brief" below to test Emma.', autoCheck: 'todayBrief' },
    { label: 'Google Calendar + Gmail connected', done: !!prefs?.google_connected, hint: 'Wave F adds the Google OAuth flow.' },
  ]
  const completed = items.filter((i) => i.done).length
  const pct = Math.round((completed / items.length) * 100)

  return (
    <div className="bg-navy-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Onboarding checklist</h3>
          <p className="text-xs text-slate-500 mt-0.5">{completed} of {items.length} complete</p>
        </div>
        <div className="text-2xl font-bold text-brand-blue">{pct}%</div>
      </div>
      <div className="w-full bg-navy-950 rounded-full h-1.5 mb-4">
        <div className="bg-brand-blue h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {items.map((i, idx) => (
          <li key={idx} className="flex items-start gap-3 text-sm">
            <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold ${
              i.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 text-slate-700'
            }`}>{i.done ? 'v' : ''}</span>
            <div className="flex-1 min-w-0">
              <div className={i.done ? 'text-slate-300' : 'text-white'}>{i.label}</div>
              <div className="text-xs text-slate-500">{i.hint}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TodaysBrief({ todayBrief, onGenerated }) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function generate() {
    setGenerating(true); setError(null)
    try {
      const { data, error: e } = await supabase.functions.invoke('generate-morning-brief', { body: {} })
      if (e) throw e
      if (data?.error) throw new Error(data.error + (data.detail ? ': ' + JSON.stringify(data.detail) : ''))
      await onGenerated()
    } catch (err) { setError(err.message || String(err)) }
    finally { setGenerating(false) }
  }

  return (
    <div className="bg-navy-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm uppercase tracking-wider text-brand-blue">Today's morning brief</h3>
          <p className="text-xs text-slate-500 mt-0.5">From Emma, based on live Liftori state.</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="px-3 py-1.5 bg-brand-blue/20 border border-brand-blue text-white text-xs rounded-md hover:bg-brand-blue/30 disabled:opacity-50"
        >
          {generating ? 'Emma is drafting...' : (todayBrief ? 'Regenerate' : "Generate today's brief")}
        </button>
      </div>
      {error && <div className="bg-rose-900/30 border border-rose-800/50 text-rose-200 rounded px-3 py-2 text-xs mb-3">{error}</div>}
      {todayBrief ? (
        <div>
          <div className="bg-navy-950 border border-slate-800 rounded-md p-4 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{todayBrief.content}</div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>Generated {new Date(todayBrief.created_at).toLocaleTimeString()} - cost ${(todayBrief.cost_usd || 0).toFixed(4)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-navy-950 border border-slate-800 rounded-md p-6 text-center text-sm text-slate-500 italic">
          No brief yet today. Click "Generate today's brief" to have Emma draft one from live state.
        </div>
      )}
    </div>
  )
}

function PreferencesCard({ prefs, onSaved }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    timezone: prefs?.timezone || 'America/New_York',
    morning_brief_time: prefs?.morning_brief_time || '07:00',
    morning_brief_enabled: prefs?.morning_brief_enabled ?? true,
    communication_style: prefs?.communication_style || 'concise',
    preferred_meeting_buffer_min: prefs?.preferred_meeting_buffer_min ?? 15,
    preferred_meeting_max_per_day: prefs?.preferred_meeting_max_per_day ?? 6,
    notes_for_emma: prefs?.notes_for_emma || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (prefs) {
      setForm({
        timezone: prefs.timezone || 'America/New_York',
        morning_brief_time: prefs.morning_brief_time || '07:00',
        morning_brief_enabled: prefs.morning_brief_enabled ?? true,
        communication_style: prefs.communication_style || 'concise',
        preferred_meeting_buffer_min: prefs.preferred_meeting_buffer_min ?? 15,
        preferred_meeting_max_per_day: prefs.preferred_meeting_max_per_day ?? 6,
        notes_for_emma: prefs.notes_for_emma || '',
      })
    }
  }, [prefs?.id]) // eslint-disable-line

  async function save() {
    if (!prefs?.id) { alert('No preferences row to update.'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('ceo_preferences').update({
        ...form,
        morning_brief_time: form.morning_brief_time, // already in HH:MM format
      }).eq('id', prefs.id)
      if (error) throw error
      await onSaved()
      alert('Saved.')
    } catch (e) { alert(`Save failed: ${e.message || String(e)}`) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-navy-900 border border-slate-800 rounded-xl">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between text-left">
        <div>
          <h3 className="text-sm uppercase tracking-wider text-brand-blue">Your preferences</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {prefs?.timezone} - brief at {prefs?.morning_brief_time?.slice(0,5)} - style: {prefs?.communication_style}
          </p>
        </div>
        <span className="text-slate-500">{open ? '-' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 p-5 space-y-3">
          <Field label="Timezone">
            <select value={form.timezone} onChange={(e) => setForm({...form, timezone: e.target.value})}
              style={INPUT_STYLE} className="w-full border rounded px-3 py-2 text-sm">
              <option>America/New_York</option><option>America/Chicago</option>
              <option>America/Denver</option><option>America/Los_Angeles</option>
              <option>America/Phoenix</option>
            </select>
          </Field>
          <Field label="Morning brief time">
            <input type="time" value={form.morning_brief_time?.slice(0,5)} onChange={(e) => setForm({...form, morning_brief_time: e.target.value + ':00'})}
              style={INPUT_STYLE} className="w-full border rounded px-3 py-2 text-sm" />
          </Field>
          <Field label="Communication style">
            <select value={form.communication_style} onChange={(e) => setForm({...form, communication_style: e.target.value})}
              style={INPUT_STYLE} className="w-full border rounded px-3 py-2 text-sm">
              <option value="concise">Concise (3 lines max for status)</option>
              <option value="conversational">Conversational (warmer, more context)</option>
              <option value="formal">Formal (full sentences, professional)</option>
            </select>
          </Field>
          <Field label="Notes for Emma (anything she should know about you)">
            <textarea rows={3} value={form.notes_for_emma} onChange={(e) => setForm({...form, notes_for_emma: e.target.value})}
              style={INPUT_STYLE} className="w-full border rounded px-3 py-2 text-sm leading-relaxed" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buffer between meetings (min)">
              <input type="number" min="0" max="60" value={form.preferred_meeting_buffer_min}
                onChange={(e) => setForm({...form, preferred_meeting_buffer_min: Number(e.target.value)})}
                style={INPUT_STYLE} className="w-full border rounded px-3 py-2 text-sm" />
            </Field>
            <Field label="Max meetings per day">
              <input type="number" min="0" max="20" value={form.preferred_meeting_max_per_day}
                onChange={(e) => setForm({...form, preferred_meeting_max_per_day: Number(e.target.value)})}
                style={INPUT_STYLE} className="w-full border rounded px-3 py-2 text-sm" />
            </Field>
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-brand-blue/20 border border-brand-blue text-white text-sm rounded-md hover:bg-brand-blue/30 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

function BriefHistory({ items }) {
  const [open, setOpen] = useState(false)
  if (!items || items.length === 0) return null
  return (
    <div className="bg-navy-900 border border-slate-800 rounded-xl">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between text-left">
        <div>
          <h3 className="text-sm uppercase tracking-wider text-brand-blue">Brief history ({items.length})</h3>
          <p className="text-xs text-slate-500 mt-0.5">Past morning briefs Emma has generated for you.</p>
        </div>
        <span className="text-slate-500">{open ? '-' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 p-5 space-y-2">
          {items.map((b) => (
            <details key={b.id} className="bg-navy-950 border border-slate-800 rounded-md">
              <summary className="px-3 py-2 cursor-pointer text-sm text-slate-300 flex items-center justify-between">
                <span>{b.brief_date} - {new Date(b.created_at).toLocaleTimeString()}</span>
                <span className="text-xs text-slate-600">${(b.cost_usd || 0).toFixed(4)}</span>
              </summary>
              <div className="px-3 pb-3 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{b.content}</div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
