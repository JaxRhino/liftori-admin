import { useEffect, useState } from 'react'
import {
  listAbTests, createAbTest, updateAbTest, deleteAbTest,
  updateAbVariant, addAbVariant, deleteAbVariant,
  variantStats, uplift, AB_METRICS, formatInt, formatPct,
} from '../../lib/marketingService'

const emptyForm = {
  name: '', hypothesis: '', metric: 'conversion_rate', status: 'running',
  started_at: new Date().toISOString().slice(0, 10), ended_at: '', notes: '',
}

export default function ABTesting() {
  const [tests, setTests] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [filterStatus])

  async function load() {
    setLoading(true)
    try { const data = await listAbTests({ status: filterStatus || undefined }); setTests(data || []) }
    catch (e) { console.error('AB load:', e) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!form.name) { alert('Test name required'); return }
    try {
      await createAbTest({ ...form, ended_at: form.ended_at || null }, [
        { name: 'Control', is_control: true, traffic_count: 0, conversion_count: 0, revenue_cents: 0 },
        { name: 'Variant A', is_control: false, traffic_count: 0, conversion_count: 0, revenue_cents: 0 },
      ])
      setForm(emptyForm); setShowForm(false); load()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function removeTest(id) {
    if (!confirm('Delete this test and all variants?')) return
    try { await deleteAbTest(id); load() } catch (e) { alert(e.message) }
  }

  async function setTestStatus(id, status) {
    try { await updateAbTest(id, { status, ...(status === 'completed' ? { ended_at: new Date().toISOString() } : {}) }); load() }
    catch (e) { alert(e.message) }
  }

  async function saveVariant(id, patch) {
    try {
      await updateAbVariant(id, {
        ...patch,
        traffic_count: patch.traffic_count != null ? Number(patch.traffic_count) : undefined,
        conversion_count: patch.conversion_count != null ? Number(patch.conversion_count) : undefined,
        revenue_cents: patch.revenue_cents != null ? Number(patch.revenue_cents) : undefined,
      })
      load()
    } catch (e) { alert(e.message) }
  }

  async function addVariant(test_id) {
    const name = prompt('Variant name:')
    if (!name) return
    try { await addAbVariant(test_id, { name, is_control: false }); load() } catch (e) { alert(e.message) }
  }

  async function removeVariant(id) {
    if (!confirm('Delete this variant?')) return
    try { await deleteAbVariant(id); load() } catch (e) { alert(e.message) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">A/B Testing</h1>
          <p className="text-sm text-gray-400 mt-1">Run split tests on landing pages, emails, and CTAs. Track lift and statistical significance.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">
          {showForm ? 'Close' : '+ New Test'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 space-y-3">
          <Field label="Test Name"><input className={inputCls} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></Field>
          <Field label="Hypothesis"><textarea className={inputCls + ' h-20'} value={form.hypothesis} onChange={e => setForm({...form, hypothesis: e.target.value})} placeholder="If we [change]... then [metric] will [result]..." /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Primary Metric">
              <select className={inputCls} value={form.metric} onChange={e => setForm({...form, metric: e.target.value})}>
                {AB_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Started"><input type="date" className={inputCls} value={form.started_at} onChange={e => setForm({...form, started_at: e.target.value})} /></Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="draft">Draft</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setForm(emptyForm); setShowForm(false) }} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
            <button onClick={save} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">Create Test</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2">
          <option value="">All statuses</option>
          <option value="running">Running</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div className="space-y-4">
        {loading ? <p className="text-gray-400 text-sm">Loading…</p> :
         tests.length === 0 ? <p className="text-gray-500 text-sm">No tests.</p> :
         tests.map(t => {
          const control = (t.ab_test_variants || []).find(v => v.is_control) || (t.ab_test_variants || [])[0]
          return (
            <div key={t.id} className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">{t.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{t.metric?.replaceAll('_', ' ')} · {t.status}</p>
                  {t.hypothesis && <p className="text-sm text-gray-300 mt-2 italic">"{t.hypothesis}"</p>}
                </div>
                <div className="flex gap-2 text-xs">
                  {t.status === 'running' && <button onClick={() => setTestStatus(t.id, 'paused')} className="text-amber-400 hover:underline">Pause</button>}
                  {t.status === 'paused' && <button onClick={() => setTestStatus(t.id, 'running')} className="text-emerald-400 hover:underline">Resume</button>}
                  {t.status !== 'completed' && <button onClick={() => setTestStatus(t.id, 'completed')} className="text-sky-400 hover:underline">Complete</button>}
                  <button onClick={() => addVariant(t.id)} className="text-gray-300 hover:underline">+ Variant</button>
                  <button onClick={() => removeTest(t.id)} className="text-rose-400 hover:underline">Del</button>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="text-left py-1">Variant</th>
                    <th className="text-right py-1">Traffic</th>
                    <th className="text-right py-1">Conv.</th>
                    <th className="text-right py-1">Rev.</th>
                    <th className="text-right py-1">Conv Rate</th>
                    <th className="text-right py-1">Lift vs Control</th>
                    <th className="text-right py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {(t.ab_test_variants || []).map(v => {
                    const s = variantStats(v)
                    const u = control && v.id !== control.id ? uplift(v, control) : null
                    return (
                      <tr key={v.id} className="border-t border-navy-700/40">
                        <td className="py-1.5">
                          <span className="text-white">{v.name}</span>
                          {v.is_control && <span className="ml-2 text-[10px] text-gray-400 uppercase">Control</span>}
                        </td>
                        <td className="py-1.5 text-right">
                          <input type="number" defaultValue={v.traffic_count || 0} onBlur={e => saveVariant(v.id, { traffic_count: e.target.value })}
                            className="w-24 bg-navy-900 border border-navy-700 text-white text-sm rounded px-2 py-1 text-right" />
                        </td>
                        <td className="py-1.5 text-right">
                          <input type="number" defaultValue={v.conversion_count || 0} onBlur={e => saveVariant(v.id, { conversion_count: e.target.value })}
                            className="w-24 bg-navy-900 border border-navy-700 text-white text-sm rounded px-2 py-1 text-right" />
                        </td>
                        <td className="py-1.5 text-right">
                          <input type="number" defaultValue={v.revenue_cents || 0} onBlur={e => saveVariant(v.id, { revenue_cents: e.target.value })}
                            className="w-28 bg-navy-900 border border-navy-700 text-white text-sm rounded px-2 py-1 text-right" />
                        </td>
                        <td className="py-1.5 text-right text-white">{s.conversionRate != null ? formatPct(s.conversionRate) : '—'}</td>
                        <td className="py-1.5 text-right font-semibold">
                          {u != null ? (
                            <span className={u > 0 ? 'text-emerald-300' : u < 0 ? 'text-rose-300' : 'text-gray-300'}>
                              {u > 0 ? '+' : ''}{u.toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-1.5 text-right">
                          {!v.is_control && <button onClick={() => removeVariant(v.id)} className="text-rose-400 hover:underline text-xs">Del</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2'

function Field({ label, children }) {
  return <label className="block"><span className="text-xs text-gray-400 block mb-1">{label}</span>{children}</label>
}
