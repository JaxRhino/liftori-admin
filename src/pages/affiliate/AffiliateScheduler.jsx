import { useEffect, useMemo, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { PLATFORMS } from '../../lib/creatorTemplates'

const STATUS_COLORS = {
  draft: 'bg-slate-500/15 text-slate-300',
  ready: 'bg-emerald-500/15 text-emerald-300',
  scheduled: 'bg-sky-500/15 text-sky-300',
  published: 'bg-violet-500/15 text-violet-300',
  archived: 'bg-zinc-500/15 text-zinc-500',
}

function formatDT(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function dayKey(iso) {
  return new Date(iso).toISOString().slice(0, 10)
}

export default function AffiliateScheduler() {
  const { user } = useAuth()
  const [scheduled, setScheduled] = useState([])
  const [drafts, setDrafts] = useState([])
  const [published, setPublished] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')

  const [showForm, setShowForm] = useState(false)
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [schedulePlatform, setSchedulePlatform] = useState('instagram')

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data: all, error } = await supabase
        .from('creator_drafts')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['draft', 'ready', 'scheduled', 'published'])
        .order('updated_at', { ascending: false })
        .limit(200)
      if (error) throw error
      const list = all || []
      setScheduled(list.filter((d) => d.status === 'scheduled').sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0)))
      setDrafts(list.filter((d) => d.status === 'ready' || d.status === 'draft'))
      setPublished(list.filter((d) => d.status === 'published').sort((a, b) => new Date(b.published_at || b.updated_at) - new Date(a.published_at || a.updated_at)))
    } catch (e) {
      console.error(e); toast.error('Failed to load scheduler')
    } finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const groupedByDay = useMemo(() => {
    const map = {}
    scheduled.forEach((d) => {
      const key = d.scheduled_at ? dayKey(d.scheduled_at) : 'unscheduled'
      if (!map[key]) map[key] = []
      map[key].push(d)
    })
    return map
  }, [scheduled])

  async function schedulePost(e) {
    e.preventDefault()
    if (!selectedDraftId || !scheduleDate) {
      toast.error('Pick a draft and a date')
      return
    }
    const when = new Date(`${scheduleDate}T${scheduleTime || '09:00'}:00`)
    if (when < new Date()) {
      if (!window.confirm('That time is in the past. Schedule anyway?')) return
    }
    try {
      const { error } = await supabase.from('creator_drafts').update({
        status: 'scheduled',
        scheduled_at: when.toISOString(),
        scheduled_platform: schedulePlatform,
        platform: schedulePlatform,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedDraftId)
      if (error) throw error
      toast.success('Scheduled')
      setShowForm(false)
      setSelectedDraftId('')
      setScheduleDate('')
      setScheduleTime('09:00')
      load()
    } catch (err) { console.error(err); toast.error('Schedule failed') }
  }

  async function markPublished(id) {
    try {
      const { error } = await supabase.from('creator_drafts').update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      toast.success('Marked published')
      load()
    } catch (err) { console.error(err); toast.error('Update failed') }
  }

  async function unschedule(id) {
    try {
      const { error } = await supabase.from('creator_drafts').update({ status: 'ready', scheduled_at: null, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      toast.success('Unscheduled — back to Ready')
      load()
    } catch (err) { console.error(err); toast.error('Update failed') }
  }

  async function copyBody(body) {
    try { await navigator.clipboard.writeText(body || ''); toast.success('Copied') }
    catch { toast.error('Copy failed') }
  }

  const visible = tab === 'upcoming' ? scheduled : tab === 'published' ? published : drafts

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><span>🗓</span><span>Scheduler</span></h1>
          <p className="text-sm text-gray-400">Queue content, track what's shipped. Direct platform posting is coming — manual-publish reminders work today.</p>
        </div>
        <button onClick={() => setShowForm((x) => !x)} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">
          {showForm ? 'Cancel' : '+ Schedule a draft'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Scheduled" value={scheduled.length} color="text-sky-300" />
        <StatCard label="Ready to schedule" value={drafts.filter((d) => d.status === 'ready').length} color="text-emerald-300" />
        <StatCard label="Drafts in progress" value={drafts.filter((d) => d.status === 'draft').length} color="text-slate-300" />
        <StatCard label="Published" value={published.length} color="text-violet-300" />
      </div>

      {showForm && (
        <form onSubmit={schedulePost} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 space-y-3">
          <div>
            <span className="text-[10px] uppercase text-gray-500">Pick a draft</span>
            <select value={selectedDraftId} onChange={(e) => setSelectedDraftId(e.target.value)} required className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-sm text-white">
              <option value="">— Choose —</option>
              {drafts.length === 0 && <option disabled>No drafts yet. Write one in Content Creator.</option>}
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  [{d.status}] {d.title || d.body.slice(0, 40) + (d.body.length > 40 ? '…' : '')}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="block"><span className="text-[10px] uppercase text-gray-500">Date</span>
              <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} required className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-sm text-white" />
            </label>
            <label className="block"><span className="text-[10px] uppercase text-gray-500">Time</span>
              <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-sm text-white" />
            </label>
            <label className="block"><span className="text-[10px] uppercase text-gray-500">Platform</span>
              <select value={schedulePlatform} onChange={(e) => setSchedulePlatform(e.target.value)} className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-2 py-2 text-sm text-white">
                {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">Schedule it</button>
        </form>
      )}

      <div className="flex items-center gap-1 border-b border-navy-700/50">
        {[
          { key: 'upcoming', label: `Upcoming (${scheduled.length})` },
          { key: 'drafts', label: `Drafts (${drafts.length})` },
          { key: 'published', label: `Published (${published.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-2 text-xs font-medium ${tab === t.key ? 'text-pink-400 border-b-2 border-pink-500' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : tab === 'upcoming' ? (
        <UpcomingCalendar groupedByDay={groupedByDay} onMarkPublished={markPublished} onUnschedule={unschedule} onCopy={copyBody} />
      ) : visible.length === 0 ? (
        <div className="text-center text-gray-500 py-12 italic">
          {tab === 'drafts' ? 'No drafts yet. Head over to Content Creator to write one.' : 'Nothing published yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((d) => (
            <DraftRow key={d.id} draft={d} onMarkPublished={markPublished} onUnschedule={unschedule} onCopy={copyBody} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function UpcomingCalendar({ groupedByDay, onMarkPublished, onUnschedule, onCopy }) {
  const days = Object.keys(groupedByDay).sort()
  if (days.length === 0) {
    return <div className="text-center text-gray-500 py-12 italic">Nothing scheduled. Queue your first post with the pink button above.</div>
  }
  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day}>
          <div className="text-xs uppercase font-bold text-gray-500 mb-2">
            {day === 'unscheduled' ? 'No date set' : new Date(day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div className="space-y-1.5">
            {groupedByDay[day].map((d) => (
              <DraftRow key={d.id} draft={d} onMarkPublished={onMarkPublished} onUnschedule={onUnschedule} onCopy={onCopy} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DraftRow({ draft, onMarkPublished, onUnschedule, onCopy }) {
  const platformMeta = PLATFORMS.find((p) => p.key === (draft.platform || draft.scheduled_platform))
  return (
    <div className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3 flex items-start gap-3">
      <div className="flex-shrink-0 w-24 text-center">
        <div className="text-[9px] uppercase text-gray-500 mb-0.5">{draft.scheduled_at ? 'Scheduled' : draft.published_at ? 'Published' : 'Status'}</div>
        <div className="text-xs text-white font-mono">
          {draft.scheduled_at ? formatDT(draft.scheduled_at) : draft.published_at ? formatDT(draft.published_at) : '—'}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${STATUS_COLORS[draft.status]}`}>{draft.status}</span>
          {platformMeta && <span className="text-[10px] text-gray-500">· {platformMeta.label}</span>}
          <span className="text-[10px] text-gray-500">· {draft.content_type}</span>
        </div>
        <div className="text-sm text-white font-semibold truncate">{draft.title || <span className="italic text-gray-500">Untitled</span>}</div>
        <div className="text-xs text-gray-400 line-clamp-2 mt-0.5">{draft.body}</div>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button onClick={() => onCopy(draft.body)} className="text-[10px] px-2 py-1 bg-navy-700 hover:bg-navy-600 rounded text-white">Copy</button>
        {draft.status === 'scheduled' && (
          <>
            <button onClick={() => onMarkPublished(draft.id)} className="text-[10px] px-2 py-1 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded">Mark published</button>
            <button onClick={() => onUnschedule(draft.id)} className="text-[10px] px-2 py-1 text-gray-400 hover:text-white rounded">Unschedule</button>
          </>
        )}
      </div>
    </div>
  )
}
