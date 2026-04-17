import { useEffect, useState } from 'react'
import {
  listMentions, createMention, updateMention, deleteMention,
  MENTION_PLATFORMS, SENTIMENTS, formatInt,
} from '../../lib/marketingService'

const emptyForm = {
  platform: 'twitter', author: '', url: '', content: '',
  sentiment: 'neutral', needs_response: true, followers: 0,
}

export default function SocialListening() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterSentiment, setFilterSentiment] = useState('')
  const [filterNeedsResponse, setFilterNeedsResponse] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [filterPlatform, filterSentiment, filterNeedsResponse])

  async function load() {
    setLoading(true)
    try {
      const data = await listMentions({
        platform: filterPlatform || undefined,
        sentiment: filterSentiment || undefined,
        needs_response: filterNeedsResponse === '' ? undefined : filterNeedsResponse === 'true',
      })
      setRows(data || [])
    } catch (e) { console.error('Mentions load:', e) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!form.content) { alert('Content required'); return }
    try {
      await createMention({
        ...form,
        followers: Number(form.followers) || 0,
      })
      setForm(emptyForm); setShowForm(false); load()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function markResponded(id) {
    try { await updateMention(id, { needs_response: false, responded_at: new Date().toISOString() }); load() }
    catch (e) { alert(e.message) }
  }

  async function setSentiment(id, sentiment) {
    try { await updateMention(id, { sentiment }); load() } catch (e) { alert(e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this mention?')) return
    try { await deleteMention(id); load() } catch (e) { alert(e.message) }
  }

  const pending = rows.filter(r => r.needs_response).length
  const pos = rows.filter(r => r.sentiment === 'positive').length
  const neg = rows.filter(r => r.sentiment === 'negative').length

  const sentimentColor = (s) => ({ positive: 'text-emerald-300', negative: 'text-rose-300', neutral: 'text-gray-300', mixed: 'text-amber-300' }[s] || 'text-gray-300')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Social Listening</h1>
          <p className="text-sm text-gray-400 mt-1">Track brand mentions, sentiment, and respond across platforms.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">
          {showForm ? 'Close' : '+ Log Mention'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total Mentions" value={formatInt(rows.length)} />
        <Kpi label="Need Response" value={formatInt(pending)} tone={pending > 0 ? 'amber' : 'emerald'} />
        <Kpi label="Positive" value={formatInt(pos)} tone="emerald" />
        <Kpi label="Negative" value={formatInt(neg)} tone="rose" />
      </div>

      {showForm && (
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Log Mention</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <select className={inputCls} value={form.platform} onChange={e => setForm({...form, platform: e.target.value})}>
                {MENTION_PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Author/Handle"><input className={inputCls} value={form.author} onChange={e => setForm({...form, author: e.target.value})} /></Field>
            <Field label="Sentiment">
              <select className={inputCls} value={form.sentiment} onChange={e => setForm({...form, sentiment: e.target.value})}>
                {SENTIMENTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Followers"><input type="number" className={inputCls} value={form.followers} onChange={e => setForm({...form, followers: e.target.value})} /></Field>
            <Field label="URL (optional)"><input className={inputCls} value={form.url} onChange={e => setForm({...form, url: e.target.value})} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-300 mt-5">
              <input type="checkbox" checked={form.needs_response} onChange={e => setForm({...form, needs_response: e.target.checked})} />
              Needs response
            </label>
          </div>
          <Field label="Content"><textarea className={inputCls + ' h-20'} value={form.content} onChange={e => setForm({...form, content: e.target.value})} /></Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setForm(emptyForm); setShowForm(false) }} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
            <button onClick={save} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">Save</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2">
          <option value="">All platforms</option>
          {MENTION_PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value={filterSentiment} onChange={e => setFilterSentiment(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2">
          <option value="">All sentiments</option>
          {SENTIMENTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={filterNeedsResponse} onChange={e => setFilterNeedsResponse(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2">
          <option value="">All</option>
          <option value="true">Needs response</option>
          <option value="false">Handled</option>
        </select>
      </div>

      <div className="space-y-2">
        {loading ? <p className="text-gray-400 text-sm">Loading…</p> :
         rows.length === 0 ? <p className="text-gray-500 text-sm">No mentions.</p> :
         rows.map(r => (
          <div key={r.id} className={`rounded-xl border p-3 ${r.needs_response ? 'bg-amber-950/20 border-amber-800/40' : 'bg-navy-800/50 border-navy-700/50'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs mb-1">
                  <span className="text-white font-semibold capitalize">{r.platform}</span>
                  <span className="text-gray-400">@{r.author || 'anon'}</span>
                  <span className={`uppercase ${sentimentColor(r.sentiment)}`}>{r.sentiment}</span>
                  {r.followers ? <span className="text-gray-500">{formatInt(r.followers)} followers</span> : null}
                </div>
                <p className="text-sm text-gray-200">{r.content}</p>
                {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">View source →</a>}
              </div>
              <div className="flex flex-col gap-1 text-xs whitespace-nowrap">
                {r.needs_response && <button onClick={() => markResponded(r.id)} className="text-emerald-400 hover:underline">Mark Handled</button>}
                <select value={r.sentiment || 'neutral'} onChange={e => setSentiment(r.id, e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-xs rounded px-2 py-1">
                  {SENTIMENTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <button onClick={() => remove(r.id)} className="text-rose-400 hover:underline">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2'

function Kpi({ label, value, tone = 'slate' }) {
  const tones = { slate: 'text-white', emerald: 'text-emerald-300', rose: 'text-rose-300', amber: 'text-amber-300' }
  return (
    <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${tones[tone] || tones.slate}`}>{value}</p>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs text-gray-400 block mb-1">{label}</span>{children}</label>
}
