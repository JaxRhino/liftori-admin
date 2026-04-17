import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listScheduledContent, updateContentDraft, CONTENT_PLATFORMS,
} from '../../lib/marketingService'

export default function Scheduler() {
  const [rows, setRows] = useState([])
  const [anchor, setAnchor] = useState(() => {
    const d = new Date(); d.setDate(1); return d
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [anchor])

  async function load() {
    setLoading(true)
    try {
      const from = new Date(anchor); from.setDate(1)
      const to = new Date(anchor); to.setMonth(to.getMonth() + 1); to.setDate(0)
      const data = await listScheduledContent({ from: from.toISOString(), to: to.toISOString() })
      setRows(data || [])
    } catch (e) { console.error('Scheduler load:', e) }
    finally { setLoading(false) }
  }

  const byDay = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      if (!r.scheduled_at) return
      const d = new Date(r.scheduled_at)
      const key = d.toISOString().slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(r)
    })
    return map
  }, [rows])

  function prevMonth() { const d = new Date(anchor); d.setMonth(d.getMonth() - 1); setAnchor(d) }
  function nextMonth() { const d = new Date(anchor); d.setMonth(d.getMonth() + 1); setAnchor(d) }
  function today() { const d = new Date(); d.setDate(1); setAnchor(d) }

  async function unschedule(id) {
    try { await updateContentDraft(id, { scheduled_at: null, status: 'draft' }); load() }
    catch (e) { alert(e.message) }
  }

  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const platformColor = (p) => {
    const m = { blog: 'bg-emerald-900/40 text-emerald-300', linkedin: 'bg-sky-900/40 text-sky-300',
                twitter: 'bg-blue-900/40 text-blue-300', instagram: 'bg-pink-900/40 text-pink-300',
                facebook: 'bg-indigo-900/40 text-indigo-300', email: 'bg-amber-900/40 text-amber-300',
                landing: 'bg-violet-900/40 text-violet-300', youtube: 'bg-rose-900/40 text-rose-300' }
    return m[p] || 'bg-navy-900/60 text-gray-300'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Scheduler</h1>
          <p className="text-sm text-gray-400 mt-1">Calendar view of all scheduled content across channels.</p>
        </div>
        <Link to="/marketing/content" className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">+ New Draft</Link>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-white rounded text-sm">◀</button>
        <button onClick={today} className="px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-white rounded text-sm">Today</button>
        <button onClick={nextMonth} className="px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-white rounded text-sm">▶</button>
        <h2 className="text-lg font-semibold text-white ml-2">
          {anchor.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        {loading && <span className="text-xs text-gray-400 ml-4">Loading…</span>}
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-[11px] uppercase tracking-wide text-gray-400 text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="min-h-[90px]" />
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const items = byDay[key] || []
            const isToday = key === new Date().toISOString().slice(0, 10)
            return (
              <div key={i} className={`min-h-[90px] border rounded-md p-1.5 ${isToday ? 'border-sky-500/50 bg-sky-950/20' : 'border-navy-700/50 bg-navy-900/30'}`}>
                <div className={`text-xs ${isToday ? 'text-sky-300 font-semibold' : 'text-gray-400'}`}>{d}</div>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map(it => (
                    <div key={it.id} title={it.title} className={`text-[10px] px-1 py-0.5 rounded truncate ${platformColor(it.platform)}`}>
                      {it.title}
                    </div>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-gray-400">+{items.length - 3} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
        <h2 className="text-sm font-semibold text-white mb-3">This month — {rows.length} scheduled</h2>
        {rows.length === 0 ? <p className="text-gray-500 text-sm">Nothing scheduled. Create drafts in Content Creator and set a scheduled date.</p> : (
          <div className="space-y-2">
            {rows.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)).map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm bg-navy-900/40 rounded-md p-2">
                <div>
                  <span className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded mr-2 ${platformColor(r.platform)}`}>{r.platform}</span>
                  <span className="text-white font-medium">{r.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{new Date(r.scheduled_at).toLocaleString()}</span>
                  <button onClick={() => unschedule(r.id)} className="text-xs text-rose-400 hover:underline">Unschedule</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
