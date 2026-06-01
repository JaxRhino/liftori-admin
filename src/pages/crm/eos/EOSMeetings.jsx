// =====================================================================
// EOSMeetings - L10 meeting runner + meeting list
// Wave C.2.2
// Reads/writes: eos_meetings (per-tenant LABOS DB)
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, EmptyState, useCrmClient } from '../_shared'

// ---------- formatters ----------
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'
const shortId = (id) => (id ? String(id).slice(0, 8) : '-')

// ---------- constants ----------
const MEETING_TYPES = [
  { key: 'l10',       label: 'L10',       tone: 'bg-brand-cyan/20 text-brand-cyan' },
  { key: 'weekly',    label: 'Weekly',    tone: 'bg-brand-blue/20 text-brand-blue' },
  { key: 'monthly',   label: 'Monthly',   tone: 'bg-violet-500/20 text-violet-300' },
  { key: 'quarterly', label: 'Quarterly', tone: 'bg-emerald-500/20 text-emerald-300' },
  { key: 'annual',    label: 'Annual',    tone: 'bg-amber-500/20 text-amber-300' },
]
const STATUSES = [
  { key: 'scheduled',   label: 'Scheduled',   tone: 'bg-brand-blue/20 text-brand-blue border-brand-blue/40' },
  { key: 'in_progress', label: 'In Progress', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { key: 'completed',   label: 'Completed',   tone: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
  { key: 'cancelled',   label: 'Cancelled',   tone: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
]

const DEFAULT_L10_AGENDA = [
  { section: 'Segue',                       duration_minutes: 5,  order: 1 },
  { section: 'Scorecard',                   duration_minutes: 5,  order: 2 },
  { section: 'Rock Review',                 duration_minutes: 5,  order: 3 },
  { section: 'Customer/Employee Headlines', duration_minutes: 5,  order: 4 },
  { section: 'To-Do List',                  duration_minutes: 5,  order: 5 },
  { section: 'IDS',                         duration_minutes: 60, order: 6 },
  { section: 'Conclude',                    duration_minutes: 5,  order: 7 },
]

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

function Drawer({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <div
        className={`w-full ${wide ? 'sm:w-[920px]' : 'sm:w-[560px]'} bg-navy-800 border-l border-navy-700/50 h-full overflow-y-auto flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between sticky top-0 bg-navy-800 z-10">
          <div className="min-w-0">{title}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm shrink-0 ml-3">Close</button>
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
        <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
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

function Textarea(props) { return <Input {...props} rows={props.rows || 3} /> }

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

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-navy-700/40 last:border-b-0">
      <span className="text-gray-400">{label}</span>
      <span className="text-white text-right max-w-[260px] truncate">{value || '-'}</span>
    </div>
  )
}

function TempBadge({ tone, children }) {
  return <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${tone}`}>{children}</span>
}

function TypeBadge({ type }) {
  const t = MEETING_TYPES.find(x => x.key === type)
  if (!t) return <span className="text-[10px] px-2 py-0.5 rounded bg-navy-700/60 text-gray-300 uppercase">{type || '-'}</span>
  return <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${t.tone}`}>{t.label}</span>
}

function StatusBadge({ status }) {
  const s = STATUSES.find(x => x.key === status)
  if (!s) return <TempBadge tone="bg-navy-700/60 text-gray-300 border-navy-700/60">{status || '-'}</TempBadge>
  return <TempBadge tone={s.tone}>{s.label}</TempBadge>
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function EOSMeetings() {
  const { client, platform } = useCrmClient()

  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [newOpen, setNewOpen] = useState(false)
  const [active, setActive] = useState(null) // meeting to view in drawer

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      const { data, error } = await client
        .from('eos_meetings')
        .select('*')
        .order('scheduled_date', { ascending: false })
        .limit(500)
      if (error) throw error
      setMeetings(data || [])
    } catch (e) {
      console.error('[EOSMeetings] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  // ---- stats ----
  const stats = useMemo(() => {
    const now = Date.now()
    const upcoming = meetings.filter(m => m.status === 'scheduled' && new Date(m.scheduled_date).getTime() >= now)
    const completed = meetings.filter(m => m.status === 'completed' && typeof m.total_duration_minutes === 'number').slice(0, 10)
    const avgDuration = completed.length === 0
      ? 0
      : Math.round(completed.reduce((a, m) => a + (m.total_duration_minutes || 0), 0) / completed.length)
    const active = meetings.filter(m => m.status === 'in_progress').length
    // streak: consecutive weekly L10 completions, walking back
    const sortedL10 = meetings
      .filter(m => m.meeting_type === 'l10' && m.status === 'completed')
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
    let streak = 0
    if (sortedL10.length > 0) {
      streak = 1
      for (let i = 0; i < sortedL10.length - 1; i++) {
        const gap = new Date(sortedL10[i].scheduled_date).getTime() - new Date(sortedL10[i + 1].scheduled_date).getTime()
        const days = gap / (1000 * 60 * 60 * 24)
        if (days <= 10) streak += 1
        else break
      }
    }
    return { upcoming: upcoming.length, avgDuration, streak, active }
  }, [meetings])

  // ---- filtered lists ----
  const filtered = useMemo(() => {
    const now = Date.now()
    if (tab === 'in-progress') return meetings.filter(m => m.status === 'in_progress')
    if (tab === 'past')        return meetings.filter(m => m.status === 'completed' || m.status === 'cancelled')
    return meetings.filter(m => m.status === 'scheduled' && new Date(m.scheduled_date).getTime() >= now - 86400000)
  }, [meetings, tab])

  return (
    <HubPage
      title="Meetings"
      subtitle={`L10 meeting runner${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
      actions={
        <button
          onClick={() => setNewOpen(true)}
          className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium hover:brightness-110"
        >
          + New L10
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Upcoming Meetings" value={stats.upcoming} accent="text-brand-cyan" />
        <StatCard label="Avg Duration (min)" value={stats.avgDuration} hint="Last 10 completed" />
        <StatCard label="L10 Streak" value={stats.streak} accent="text-emerald-400" hint="Consecutive weeks" />
        <StatCard label="Active Now" value={stats.active} accent={stats.active > 0 ? 'text-amber-400' : 'text-white'} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <TabBtn active={tab === 'upcoming'}    onClick={() => setTab('upcoming')}>Upcoming</TabBtn>
        <TabBtn active={tab === 'in-progress'} onClick={() => setTab('in-progress')} count={stats.active}>In Progress</TabBtn>
        <TabBtn active={tab === 'past'}        onClick={() => setTab('past')}>Past</TabBtn>
      </div>

      {loading ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6 text-sm text-gray-500">Loading meetings...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === 'upcoming' ? 'No upcoming meetings' : tab === 'in-progress' ? 'No meeting in progress' : 'No past meetings'}
          description={tab === 'upcoming' ? 'Schedule your next L10 to keep the rhythm.' : ''}
          cta={tab === 'upcoming' ? (
            <button onClick={() => setNewOpen(true)} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + New L10
            </button>
          ) : null}
        />
      ) : (
        <MeetingList meetings={filtered} onOpen={(m) => setActive(m)} />
      )}

      <NewMeetingModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        client={client}
        onSaved={() => { setNewOpen(false); load() }}
      />

      <MeetingDrawer
        meeting={active}
        onClose={() => setActive(null)}
        client={client}
        onChanged={() => { setActive(null); load() }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                                MEETING LIST
// ===========================================================================
function MeetingList({ meetings, onOpen }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {meetings.map(m => (
        <button
          key={m.id}
          onClick={() => onOpen(m)}
          className="text-left bg-navy-800 border border-navy-700/50 rounded-xl p-4 hover:border-brand-cyan/40 transition"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <TypeBadge type={m.meeting_type} />
              <span className="text-[11px] text-gray-500">#{m.meeting_number || '-'}</span>
            </div>
            <StatusBadge status={m.status} />
          </div>
          <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">{m.title || 'Untitled meeting'}</h3>
          <p className="text-xs text-gray-400 mb-2">{fmtDateTime(m.scheduled_date)}</p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{m.duration_minutes || 0} min</span>
            <span>Facilitator: {shortId(m.facilitator_id)}</span>
          </div>
          <div className="mt-3 flex justify-end">
            {m.status === 'scheduled' && (
              <span className="text-xs px-3 py-1 rounded-lg bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40">Start</span>
            )}
            {m.status === 'completed' && (
              <span className="text-xs px-3 py-1 rounded-lg bg-navy-900/60 text-gray-300 border border-navy-700/50">View Recap</span>
            )}
            {m.status === 'in_progress' && (
              <span className="text-xs px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">Resume</span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

// ===========================================================================
//                                NEW MEETING MODAL
// ===========================================================================
function NewMeetingModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState(empty())
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm(empty()) }, [open])

  function empty() {
    const today = new Date()
    const dt = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    dt.setHours(9, 0, 0, 0)
    return {
      title: `L10 - ${fmtDate(dt)}`,
      meeting_type: 'l10',
      scheduled_date: dt.toISOString().slice(0, 16),
      duration_minutes: 90,
      facilitator_id: '',
      team_ids: '',
      is_in_person: false,
      video_enabled: true,
      ai_copilot_enabled: false,
      capture_enabled: false,
      participants: '',
    }
  }

  async function save() {
    if (!client) return
    if (!form.title.trim()) { alert('Title is required'); return }
    setSaving(true)
    try {
      const teamArr = (form.team_ids || '').split(',').map(s => s.trim()).filter(Boolean)
      const partArr = (form.participants || '').split(',').map(s => s.trim()).filter(Boolean)
      const payload = {
        title: form.title.trim(),
        meeting_type: form.meeting_type || 'l10',
        scheduled_date: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : new Date().toISOString(),
        duration_minutes: parseInt(form.duration_minutes, 10) || 90,
        status: 'scheduled',
        facilitator_id: form.facilitator_id || null,
        team_ids: teamArr.length > 0 ? teamArr : null,
        is_in_person: !!form.is_in_person,
        video_enabled: !!form.video_enabled,
        ai_copilot_enabled: !!form.ai_copilot_enabled,
        capture_enabled: !!form.capture_enabled,
        participants: partArr.length > 0 ? partArr : [],
        agenda: DEFAULT_L10_AGENDA,
        clacko_tangents: [],
        ai_section_notes: {},
        section_history: [],
        current_section: null,
        current_presenter_index: 0,
      }
      const { error } = await client.from('eos_meetings').insert(payload)
      if (error) throw error
      onSaved?.()
    } catch (e) {
      console.error('[EOSMeetings] save', e)
      alert('Failed to create meeting: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New L10 Meeting"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Schedule Meeting'}
          </button>
        </div>
      }
    >
      <Input label="Title" value={form.title} onChange={(v) => setForm(f => ({ ...f, title: v }))} placeholder="L10 - Apr 30" />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Meeting Type"
          value={form.meeting_type}
          onChange={(v) => setForm(f => ({ ...f, meeting_type: v }))}
          options={MEETING_TYPES.map(t => ({ value: t.key, label: t.label }))}
        />
        <Input
          label="Duration (min)"
          type="number"
          value={form.duration_minutes}
          onChange={(v) => setForm(f => ({ ...f, duration_minutes: v }))}
        />
      </div>
      <Input
        label="Scheduled Date/Time"
        type="datetime-local"
        value={form.scheduled_date}
        onChange={(v) => setForm(f => ({ ...f, scheduled_date: v }))}
      />
      <Input label="Facilitator ID (uuid)" value={form.facilitator_id} onChange={(v) => setForm(f => ({ ...f, facilitator_id: v }))} />
      <Textarea label="Team IDs (comma-separated uuids)" value={form.team_ids} onChange={(v) => setForm(f => ({ ...f, team_ids: v }))} rows={2} />
      <Textarea label="Participants (names, comma-separated)" value={form.participants} onChange={(v) => setForm(f => ({ ...f, participants: v }))} rows={2} />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={!!form.is_in_person} onChange={(e) => setForm(f => ({ ...f, is_in_person: e.target.checked }))} className="accent-brand-cyan" />
          In person
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={!!form.video_enabled} onChange={(e) => setForm(f => ({ ...f, video_enabled: e.target.checked }))} className="accent-brand-cyan" />
          Video enabled
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={!!form.ai_copilot_enabled} onChange={(e) => setForm(f => ({ ...f, ai_copilot_enabled: e.target.checked }))} className="accent-brand-cyan" />
          AI Copilot
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={!!form.capture_enabled} onChange={(e) => setForm(f => ({ ...f, capture_enabled: e.target.checked }))} className="accent-brand-cyan" />
          Capture audio
        </label>
      </div>
      <p className="text-xs text-gray-500 mt-2">Default L10 agenda (7 sections, 90 min) will be applied.</p>
    </Modal>
  )
}

// ===========================================================================
//                                MEETING DRAWER (Live Room + Recap)
// ===========================================================================
function MeetingDrawer({ meeting, onClose, client, onChanged }) {
  const [draft, setDraft] = useState(meeting)
  const [saving, setSaving] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [recapDraft, setRecapDraft] = useState('')
  const [tangentText, setTangentText] = useState('')
  const [recentRocks, setRecentRocks] = useState([])
  const [recentMetrics, setRecentMetrics] = useState([])
  const [recentIssues, setRecentIssues] = useState([])
  const [recentTodos, setRecentTodos] = useState([])

  useEffect(() => {
    setDraft(meeting)
    setRecapDraft(meeting?.meeting_recap || '')
    setTangentText('')
  }, [meeting])

  // Side rail data fetches for in-room sections
  useEffect(() => {
    if (!client || !meeting) return
    let cancelled = false
    async function fetchSidebars() {
      try {
        const [r, m, i, t] = await Promise.all([
          client.from('eos_rocks').select('id,title,status,progress_percentage').eq('is_complete', false).order('created_at', { ascending: false }).limit(5),
          client.from('eos_scorecard_metrics').select('id,name,goal,measurement_type').eq('is_active', true).order('display_order', { ascending: true }).limit(5),
          client.from('eos_issues').select('id,title,priority').neq('status', 'solved').order('created_at', { ascending: false }).limit(5),
          client.from('eos_todos').select('id,title,due_date,is_complete').eq('is_complete', false).order('due_date', { ascending: true }).limit(5),
        ])
        if (cancelled) return
        setRecentRocks(r?.data || [])
        setRecentMetrics(m?.data || [])
        setRecentIssues(i?.data || [])
        setRecentTodos(t?.data || [])
      } catch (e) {
        console.warn('[EOSMeetings] sidebar load', e)
      }
    }
    fetchSidebars()
    return () => { cancelled = true }
  }, [client, meeting?.id])

  if (!meeting) return null

  const agenda = Array.isArray(draft?.agenda) && draft.agenda.length > 0 ? draft.agenda : DEFAULT_L10_AGENDA
  const currentSection = draft?.current_section || agenda[0]?.section
  const sectionNotes = (draft?.ai_section_notes && typeof draft.ai_section_notes === 'object') ? draft.ai_section_notes : {}
  const tangents = Array.isArray(draft?.clacko_tangents) ? draft.clacko_tangents : []

  async function patch(updates) {
    if (!client) return
    setSaving(true)
    try {
      const { error } = await client.from('eos_meetings').update(updates).eq('id', meeting.id)
      if (error) throw error
      setDraft(d => ({ ...d, ...updates }))
    } catch (e) {
      console.error('[EOSMeetings] patch', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function start() {
    await patch({
      status: 'in_progress',
      start_time: new Date().toISOString(),
      current_section: agenda[0]?.section || null,
    })
    onChanged?.()
  }

  async function jumpSection(section) {
    const history = Array.isArray(draft?.section_history) ? [...draft.section_history] : []
    history.push({ section: draft?.current_section, ended_at: new Date().toISOString() })
    await patch({ current_section: section, section_history: history })
  }

  async function nextSection() {
    const idx = agenda.findIndex(a => a.section === currentSection)
    const next = agenda[Math.min(idx + 1, agenda.length - 1)]?.section
    if (next && next !== currentSection) await jumpSection(next)
  }

  async function saveSectionNotes(section, text) {
    const notes = { ...sectionNotes, [section]: text }
    await patch({ ai_section_notes: notes })
  }

  async function addTangent() {
    if (!tangentText.trim()) return
    const arr = [...tangents, { text: tangentText.trim(), captured_at: new Date().toISOString(), section: currentSection }]
    await patch({ clacko_tangents: arr })
    setTangentText('')
  }

  async function endMeeting() {
    if (!client) return
    const now = new Date().toISOString()
    const startMs = draft?.start_time ? new Date(draft.start_time).getTime() : Date.now()
    const total = Math.max(1, Math.round((Date.now() - startMs) / 60000))
    await patch({
      status: 'completed',
      end_time: now,
      completed_at: now,
      total_duration_minutes: total,
      meeting_recap: recapDraft || null,
    })
    setEndOpen(false)
    onChanged?.()
  }

  const isLive = draft?.status === 'in_progress'
  const isScheduled = draft?.status === 'scheduled'
  const isCompleted = draft?.status === 'completed'

  return (
    <Drawer
      open={!!meeting}
      onClose={onClose}
      wide
      title={
        <div className="flex items-center gap-2 min-w-0">
          <TypeBadge type={draft?.meeting_type} />
          <StatusBadge status={draft?.status} />
          <span className="text-white font-semibold truncate">{draft?.title || 'Meeting'}</span>
        </div>
      }
      footer={
        <div className="flex justify-between gap-2">
          {isScheduled && (
            <button onClick={start} disabled={saving} className="bg-emerald-500 text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50">
              {saving ? 'Starting...' : 'Start Meeting'}
            </button>
          )}
          {isLive && (
            <button onClick={() => setEndOpen(true)} className="bg-rose-500/80 text-white text-sm px-4 py-2 rounded-lg font-medium">
              End Meeting
            </button>
          )}
          {!isScheduled && (
            <button onClick={nextSection} disabled={!isLive} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-40">
              Next Section
            </button>
          )}
        </div>
      }
    >
      {/* Header detail */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <DetailRow label="Scheduled" value={fmtDateTime(draft?.scheduled_date)} />
        <DetailRow label="Duration" value={`${draft?.duration_minutes || 0} min`} />
        <DetailRow label="Facilitator" value={shortId(draft?.facilitator_id)} />
        <DetailRow label="Meeting #" value={draft?.meeting_number || '-'} />
      </div>

      {/* Live room layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] gap-4">
        {/* Left rail: agenda */}
        <div className="bg-navy-900/40 border border-navy-700/50 rounded-lg p-3">
          <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Agenda</h4>
          <ul className="space-y-1">
            {agenda.map((a, i) => {
              const active = a.section === currentSection
              return (
                <li key={i}>
                  <button
                    onClick={() => isLive && jumpSection(a.section)}
                    disabled={!isLive}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                      active ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                             : 'text-gray-400 hover:text-white border border-transparent'
                    } ${!isLive ? 'opacity-60 cursor-default' : ''}`}
                  >
                    <div className="font-medium">{a.section}</div>
                    <div className="text-[10px] text-gray-500">{a.duration_minutes} min</div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Center: current section */}
        <div>
          {!isLive && !isCompleted && (
            <div className="bg-navy-900/40 border border-navy-700/50 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-400 mb-2">This meeting hasn&apos;t started.</p>
              <p className="text-xs text-gray-500">Hit &quot;Start Meeting&quot; to begin the L10 flow.</p>
            </div>
          )}

          {(isLive || isCompleted) && (
            <SectionPanel
              section={currentSection}
              notes={sectionNotes[currentSection] || ''}
              onNotesChange={(t) => setDraft(d => ({ ...d, ai_section_notes: { ...sectionNotes, [currentSection]: t } }))}
              onNotesSave={(t) => saveSectionNotes(currentSection, t)}
              readOnly={isCompleted}
              recentRocks={recentRocks}
              recentMetrics={recentMetrics}
              recentIssues={recentIssues}
              recentTodos={recentTodos}
            />
          )}
        </div>

        {/* Right rail: timer + tangents */}
        <div className="space-y-3">
          <div className="bg-navy-900/40 border border-navy-700/50 rounded-lg p-3">
            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Section</h4>
            <p className="text-white text-sm font-medium">{currentSection || '-'}</p>
            <p className="text-[11px] text-gray-500 mt-1">
              {agenda.find(a => a.section === currentSection)?.duration_minutes || 0} min target
            </p>
          </div>
          <div className="bg-navy-900/40 border border-navy-700/50 rounded-lg p-3">
            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Capture Tangent</h4>
            <textarea
              value={tangentText}
              onChange={(e) => setTangentText(e.target.value)}
              placeholder="Parking lot..."
              rows={3}
              disabled={!isLive}
              className="w-full bg-navy-800 border border-navy-700/60 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 disabled:opacity-50"
            />
            <button
              onClick={addTangent}
              disabled={!isLive || !tangentText.trim()}
              className="mt-2 w-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded px-2 py-1.5 disabled:opacity-40"
            >
              + Park it
            </button>
            {tangents.length > 0 && (
              <ul className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                {tangents.map((t, i) => (
                  <li key={i} className="text-[11px] text-gray-300 bg-navy-800/60 border border-navy-700/40 rounded px-2 py-1">
                    {t.text}
                    <div className="text-[9px] text-gray-500 mt-0.5">{t.section}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Recap (visible after completion) */}
      {isCompleted && (
        <div className="mt-6 bg-navy-900/40 border border-navy-700/50 rounded-lg p-4">
          <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Meeting Recap</h4>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{draft?.meeting_recap || '(no recap)'}</p>
          <DetailRow label="Total duration" value={`${draft?.total_duration_minutes || 0} min`} />
          <DetailRow label="Started" value={fmtDateTime(draft?.start_time)} />
          <DetailRow label="Ended" value={fmtDateTime(draft?.end_time)} />
        </div>
      )}

      {/* End meeting modal */}
      <Modal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="End Meeting"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setEndOpen(false)} className="text-sm px-4 py-2 text-gray-300">Cancel</button>
            <button onClick={endMeeting} className="bg-rose-500 text-white text-sm px-4 py-2 rounded-lg font-medium">Confirm</button>
          </div>
        }
      >
        <p className="text-sm text-gray-300 mb-3">Capture the recap before ending. Sets status to completed and stamps total duration.</p>
        <Textarea label="Meeting recap" value={recapDraft} onChange={setRecapDraft} rows={5} placeholder="Top wins, blockers, cascading messages, rating..." />
      </Modal>
    </Drawer>
  )
}

// ---------- per-section panels ----------
function SectionPanel({ section, notes, onNotesChange, onNotesSave, readOnly, recentRocks, recentMetrics, recentIssues, recentTodos }) {
  const isList = ['Scorecard', 'Rock Review', 'IDS', 'To-Do List'].includes(section)
  return (
    <div className="bg-navy-900/40 border border-navy-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">{section}</h3>
        {!readOnly && (
          <button
            onClick={() => onNotesSave(notes)}
            className="text-xs px-3 py-1 rounded bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40 hover:bg-brand-cyan/25"
          >
            Save Notes
          </button>
        )}
      </div>

      {isList && section === 'Scorecard' && (
        <MiniList items={recentMetrics.map(r => ({ id: r.id, label: r.name, sub: `Goal: ${r.goal ?? '-'} (${r.measurement_type})` }))} empty="No active metrics" />
      )}
      {isList && section === 'Rock Review' && (
        <MiniList items={recentRocks.map(r => ({ id: r.id, label: r.title, sub: `${r.status || '-'} - ${r.progress_percentage || 0}%` }))} empty="No active rocks" />
      )}
      {isList && section === 'IDS' && (
        <MiniList items={recentIssues.map(r => ({ id: r.id, label: r.title, sub: `Priority: ${r.priority || '-'}` }))} empty="No open issues" />
      )}
      {isList && section === 'To-Do List' && (
        <MiniList items={recentTodos.map(r => ({ id: r.id, label: r.title, sub: r.due_date ? `Due ${fmtDate(r.due_date)}` : '' }))} empty="No open to-dos" />
      )}

      <div className="mt-4">
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Section Notes</label>
        <textarea
          value={notes || ''}
          onChange={(e) => onNotesChange(e.target.value)}
          disabled={readOnly}
          rows={5}
          className="w-full bg-navy-800 border border-navy-700/60 rounded px-3 py-2 text-sm text-white placeholder-gray-500 disabled:opacity-60"
          placeholder={readOnly ? '' : `Notes for ${section}...`}
        />
      </div>
    </div>
  )
}

function MiniList({ items, empty }) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-gray-500 italic">{empty}</p>
  }
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.id} className="bg-navy-800/60 border border-navy-700/40 rounded px-3 py-1.5">
          <p className="text-sm text-white truncate">{it.label}</p>
          {it.sub && <p className="text-[10px] text-gray-500 mt-0.5">{it.sub}</p>}
        </li>
      ))}
    </ul>
  )
}
