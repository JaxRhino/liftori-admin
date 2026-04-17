import { useEffect, useState } from 'react'
import {
  listSeoKeywords, createSeoKeyword, updateSeoKeyword, deleteSeoKeyword,
  formatInt,
} from '../../lib/marketingService'

const emptyForm = {
  keyword: '', target_url: '', current_rank: '', target_rank: 1,
  monthly_searches: 0, difficulty: 0, intent: 'informational', notes: '',
}

export default function SEOManager() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const data = await listSeoKeywords(); setRows(data || []) }
    catch (e) { console.error('SEO load:', e) }
    finally { setLoading(false) }
  }

  function openEdit(r) {
    setEditing(r.id)
    setForm({
      keyword: r.keyword || '', target_url: r.target_url || '',
      current_rank: r.current_rank ?? '', target_rank: r.target_rank || 1,
      monthly_searches: r.monthly_searches || 0, difficulty: r.difficulty || 0,
      intent: r.intent || 'informational', notes: r.notes || '',
    })
  }
  function newKw() { setEditing('new'); setForm(emptyForm) }
  function cancel() { setEditing(null); setForm(emptyForm) }

  async function save() {
    if (!form.keyword) { alert('Keyword required'); return }
    try {
      const payload = {
        ...form,
        current_rank: form.current_rank === '' ? null : Number(form.current_rank),
        target_rank: Number(form.target_rank) || 1,
        monthly_searches: Number(form.monthly_searches) || 0,
        difficulty: Number(form.difficulty) || 0,
      }
      if (editing === 'new') await createSeoKeyword(payload)
      else await updateSeoKeyword(editing, payload)
      cancel(); load()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this keyword?')) return
    try { await deleteSeoKeyword(id); load() } catch (e) { alert(e.message) }
  }

  const totalSearches = rows.reduce((a, r) => a + Number(r.monthly_searches || 0), 0)
  const avgRank = (() => {
    const ranked = rows.filter(r => r.current_rank != null)
    if (!ranked.length) return null
    return ranked.reduce((a, r) => a + Number(r.current_rank), 0) / ranked.length
  })()
  const top10 = rows.filter(r => r.current_rank != null && r.current_rank <= 10).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">SEO Manager</h1>
          <p className="text-sm text-gray-400 mt-1">Track keywords, rank movement, target URLs, and search intent.</p>
        </div>
        <button onClick={newKw} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">+ New Keyword</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Keywords" value={formatInt(rows.length)} />
        <Kpi label="Top 10 Rankings" value={formatInt(top10)} tone="emerald" />
        <Kpi label="Avg Rank" value={avgRank != null ? avgRank.toFixed(1) : '—'} tone="sky" />
        <Kpi label="Total Monthly Searches" value={formatInt(totalSearches)} />
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 overflow-hidden">
        {loading ? <p className="p-4 text-gray-400 text-sm">Loading…</p> :
         rows.length === 0 ? <p className="p-4 text-gray-500 text-sm">No keywords tracked yet.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-navy-900/60 text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left py-2 px-3">Keyword</th>
                <th className="text-left py-2 px-3">Target URL</th>
                <th className="text-right py-2 px-3">Current</th>
                <th className="text-right py-2 px-3">Target</th>
                <th className="text-right py-2 px-3">Searches</th>
                <th className="text-right py-2 px-3">Diff.</th>
                <th className="text-left py-2 px-3">Intent</th>
                <th className="text-right py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-t border-navy-700/40 hover:bg-navy-900/30">
                  <td className="py-2 px-3 text-white font-medium">{row.keyword}</td>
                  <td className="py-2 px-3 text-gray-400 text-xs truncate max-w-xs">{row.target_url}</td>
                  <td className="py-2 px-3 text-right font-semibold">
                    {row.current_rank != null ? (
                      <span className={row.current_rank <= 3 ? 'text-emerald-300' : row.current_rank <= 10 ? 'text-amber-300' : 'text-rose-300'}>
                        #{row.current_rank}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300">#{row.target_rank || '—'}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{formatInt(row.monthly_searches || 0)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{row.difficulty || '—'}</td>
                  <td className="py-2 px-3 text-gray-300 capitalize text-xs">{row.intent}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(row)} className="text-sky-400 hover:underline mr-3 text-xs">Edit</button>
                    <button onClick={() => remove(row.id)} className="text-rose-400 hover:underline text-xs">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl max-w-xl w-full p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">{editing === 'new' ? 'New Keyword' : 'Edit Keyword'}</h2>
            <Field label="Keyword"><input className={inputCls} value={form.keyword} onChange={e => setForm({...form, keyword: e.target.value})} /></Field>
            <Field label="Target URL"><input className={inputCls} value={form.target_url} onChange={e => setForm({...form, target_url: e.target.value})} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current Rank"><input type="number" className={inputCls} value={form.current_rank} onChange={e => setForm({...form, current_rank: e.target.value})} /></Field>
              <Field label="Target Rank"><input type="number" className={inputCls} value={form.target_rank} onChange={e => setForm({...form, target_rank: e.target.value})} /></Field>
              <Field label="Monthly Searches"><input type="number" className={inputCls} value={form.monthly_searches} onChange={e => setForm({...form, monthly_searches: e.target.value})} /></Field>
              <Field label="Difficulty (0-100)"><input type="number" min="0" max="100" className={inputCls} value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})} /></Field>
              <Field label="Intent">
                <select className={inputCls} value={form.intent} onChange={e => setForm({...form, intent: e.target.value})}>
                  <option value="informational">Informational</option>
                  <option value="navigational">Navigational</option>
                  <option value="commercial">Commercial</option>
                  <option value="transactional">Transactional</option>
                </select>
              </Field>
            </div>
            <Field label="Notes"><textarea className={inputCls + ' h-20'} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></Field>
            <div className="flex justify-end gap-2">
              <button onClick={cancel} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={save} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2'

function Kpi({ label, value, tone = 'slate' }) {
  const tones = { slate: 'text-white', emerald: 'text-emerald-300', sky: 'text-sky-300' }
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
