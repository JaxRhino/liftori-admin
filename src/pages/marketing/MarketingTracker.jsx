import { useEffect, useState } from 'react'
import {
  listCampaigns, createCampaign, updateCampaign, deleteCampaign,
  CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES,
  formatMoney, formatInt, deriveKPIs,
} from '../../lib/marketingService'

const emptyForm = {
  name: '', channel: 'google_ads', status: 'planned',
  budget_cents: 0, spend_cents: 0, revenue_cents: 0,
  impressions: 0, clicks: 0, conversions: 0,
  start_date: '', end_date: '', notes: '',
}

export default function MarketingTracker() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [filterChannel, setFilterChannel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => { load() }, [filterChannel, filterStatus])

  async function load() {
    setLoading(true)
    try {
      const data = await listCampaigns({ channel: filterChannel || undefined, status: filterStatus || undefined })
      setRows(data || [])
    } catch (e) { console.error('load campaigns:', e) }
    finally { setLoading(false) }
  }

  function openNew() { setEditing('new'); setForm(emptyForm) }
  function openEdit(r) {
    setEditing(r.id)
    setForm({
      name: r.name || '', channel: r.channel || 'google_ads', status: r.status || 'planned',
      budget_cents: r.budget_cents || 0, spend_cents: r.spend_cents || 0, revenue_cents: r.revenue_cents || 0,
      impressions: r.impressions || 0, clicks: r.clicks || 0, conversions: r.conversions || 0,
      start_date: r.start_date || '', end_date: r.end_date || '', notes: r.notes || '',
    })
  }
  function cancel() { setEditing(null); setForm(emptyForm) }

  async function save() {
    try {
      const payload = {
        ...form,
        budget_cents: Math.round(Number(form.budget_cents) || 0),
        spend_cents: Math.round(Number(form.spend_cents) || 0),
        revenue_cents: Math.round(Number(form.revenue_cents) || 0),
        impressions: Math.round(Number(form.impressions) || 0),
        clicks: Math.round(Number(form.clicks) || 0),
        conversions: Math.round(Number(form.conversions) || 0),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }
      if (editing === 'new') await createCampaign(payload)
      else await updateCampaign(editing, payload)
      cancel(); load()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this campaign?')) return
    try { await deleteCampaign(id); load() } catch (e) { alert('Delete failed: ' + e.message) }
  }

  const totals = rows.reduce((acc, r) => {
    acc.spend += Number(r.spend_cents || 0)
    acc.revenue += Number(r.revenue_cents || 0)
    acc.conv += Number(r.conversions || 0)
    acc.budget += Number(r.budget_cents || 0)
    return acc
  }, { spend: 0, revenue: 0, conv: 0, budget: 0 })
  const totalRoas = totals.spend > 0 ? (totals.revenue / totals.spend) : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaign Tracker</h1>
          <p className="text-sm text-gray-400 mt-1">Track every marketing campaign across channels — spend, revenue, ROAS, conversions.</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">+ New Campaign</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Campaigns" value={formatInt(rows.length)} />
        <Kpi label="Total Spend" value={formatMoney(totals.spend)} tone="rose" />
        <Kpi label="Total Revenue" value={formatMoney(totals.revenue)} tone="emerald" />
        <Kpi label="Blended ROAS" value={totalRoas != null ? `${totalRoas.toFixed(2)}x` : '—'} tone={totalRoas && totalRoas >= 3 ? 'emerald' : 'amber'} />
      </div>

      <div className="flex gap-3 items-center">
        <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2">
          <option value="">All channels</option>
          {CAMPAIGN_CHANNELS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2">
          <option value="">All statuses</option>
          {CAMPAIGN_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 overflow-hidden">
        {loading ? <p className="p-4 text-gray-400 text-sm">Loading…</p> :
         rows.length === 0 ? <p className="p-4 text-gray-500 text-sm">No campaigns yet. Click "New Campaign" to log your first.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-navy-900/60 text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left py-2 px-3">Name</th>
                <th className="text-left py-2 px-3">Channel</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Spend</th>
                <th className="text-right py-2 px-3">Revenue</th>
                <th className="text-right py-2 px-3">ROAS</th>
                <th className="text-right py-2 px-3">CPA</th>
                <th className="text-right py-2 px-3">Conv.</th>
                <th className="text-right py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const k = deriveKPIs(r)
                return (
                  <tr key={r.id} className="border-t border-navy-700/40 hover:bg-navy-900/30">
                    <td className="py-2 px-3 text-white">{r.name}</td>
                    <td className="py-2 px-3 text-gray-300 capitalize">{(r.channel || '').replaceAll('_', ' ')}</td>
                    <td className="py-2 px-3 text-gray-300 capitalize">{r.status}</td>
                    <td className="py-2 px-3 text-right text-rose-300">{formatMoney(r.spend_cents || 0)}</td>
                    <td className="py-2 px-3 text-right text-emerald-300">{formatMoney(r.revenue_cents || 0)}</td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {k.roas != null ? <span className={k.roas >= 3 ? 'text-emerald-300' : k.roas >= 1 ? 'text-amber-300' : 'text-rose-300'}>{k.roas.toFixed(2)}x</span> : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-300">{k.cpa != null ? formatMoney(Math.round(k.cpa)) : '—'}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{formatInt(r.conversions || 0)}</td>
                    <td className="py-2 px-3 text-right">
                      <button onClick={() => openEdit(r)} className="text-sky-400 hover:underline mr-3">Edit</button>
                      <button onClick={() => remove(r.id)} className="text-rose-400 hover:underline">Del</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl max-w-2xl w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">{editing === 'new' ? 'New Campaign' : 'Edit Campaign'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Name"><input className={inputCls} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></Field>
              <Field label="Channel">
                <select className={inputCls} value={form.channel} onChange={e => setForm({...form, channel: e.target.value})}>
                  {CAMPAIGN_CHANNELS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  {CAMPAIGN_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Budget (cents)"><input type="number" className={inputCls} value={form.budget_cents} onChange={e => setForm({...form, budget_cents: e.target.value})} /></Field>
              <Field label="Spend (cents)"><input type="number" className={inputCls} value={form.spend_cents} onChange={e => setForm({...form, spend_cents: e.target.value})} /></Field>
              <Field label="Revenue (cents)"><input type="number" className={inputCls} value={form.revenue_cents} onChange={e => setForm({...form, revenue_cents: e.target.value})} /></Field>
              <Field label="Impressions"><input type="number" className={inputCls} value={form.impressions} onChange={e => setForm({...form, impressions: e.target.value})} /></Field>
              <Field label="Clicks"><input type="number" className={inputCls} value={form.clicks} onChange={e => setForm({...form, clicks: e.target.value})} /></Field>
              <Field label="Conversions"><input type="number" className={inputCls} value={form.conversions} onChange={e => setForm({...form, conversions: e.target.value})} /></Field>
              <Field label="Start Date"><input type="date" className={inputCls} value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></Field>
              <Field label="End Date"><input type="date" className={inputCls} value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></Field>
            </div>
            <Field label="Notes"><textarea className={inputCls + ' h-20'} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></Field>
            <div className="flex justify-end gap-2">
              <button onClick={cancel} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
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
  const tones = { slate: 'text-white', emerald: 'text-emerald-300', rose: 'text-rose-300', amber: 'text-amber-300', sky: 'text-sky-300' }
  return (
    <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${tones[tone] || tones.slate}`}>{value}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-gray-400 block mb-1">{label}</span>
      {children}
    </label>
  )
}
