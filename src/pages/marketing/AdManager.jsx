import { useEffect, useState } from 'react'
import {
  listAdSpend, createAdSpend, deleteAdSpend, rollupAdSpendByPlatform,
  listCampaigns, AD_PLATFORMS, formatMoney, formatInt, formatPct,
} from '../../lib/marketingService'

const emptyForm = {
  campaign_id: '', platform: 'google', spend_date: new Date().toISOString().slice(0, 10),
  spend_cents: 0, impressions: 0, clicks: 0, conversions: 0, revenue_cents: 0, notes: '',
}

export default function AdManager() {
  const [rows, setRows] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [filterPlatform, setFilterPlatform] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [filterPlatform])

  async function load() {
    setLoading(true)
    try {
      const [ads, camps] = await Promise.all([
        listAdSpend({ platform: filterPlatform || undefined }),
        listCampaigns(),
      ])
      setRows(ads || [])
      setCampaigns(camps || [])
    } catch (e) { console.error('AdManager load:', e) }
    finally { setLoading(false) }
  }

  async function save() {
    try {
      await createAdSpend({
        ...form,
        spend_cents: Math.round(Number(form.spend_cents) || 0),
        revenue_cents: Math.round(Number(form.revenue_cents) || 0),
        impressions: Math.round(Number(form.impressions) || 0),
        clicks: Math.round(Number(form.clicks) || 0),
        conversions: Math.round(Number(form.conversions) || 0),
        campaign_id: form.campaign_id || null,
      })
      setForm(emptyForm); setShowForm(false); load()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this ad spend entry?')) return
    try { await deleteAdSpend(id); load() } catch (e) { alert(e.message) }
  }

  const byPlatform = rollupAdSpendByPlatform(rows)
  const totalSpend = rows.reduce((a, r) => a + Number(r.spend_cents || 0), 0)
  const totalRev = rows.reduce((a, r) => a + Number(r.revenue_cents || 0), 0)
  const totalConv = rows.reduce((a, r) => a + Number(r.conversions || 0), 0)
  const totalClicks = rows.reduce((a, r) => a + Number(r.clicks || 0), 0)
  const totalImpr = rows.reduce((a, r) => a + Number(r.impressions || 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ad Manager</h1>
          <p className="text-sm text-gray-400 mt-1">Log daily ad spend by platform. Track ROAS, CPA, and CPC across Google, Meta, LinkedIn, TikTok.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">
          {showForm ? 'Close' : '+ Log Ad Spend'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total Spend" value={formatMoney(totalSpend)} tone="rose" />
        <Kpi label="Total Revenue" value={formatMoney(totalRev)} tone="emerald" />
        <Kpi label="ROAS" value={totalSpend > 0 ? `${(totalRev / totalSpend).toFixed(2)}x` : '—'} tone={totalSpend > 0 && totalRev / totalSpend >= 3 ? 'emerald' : 'amber'} />
        <Kpi label="Impressions" value={formatInt(totalImpr)} />
        <Kpi label="Clicks" value={formatInt(totalClicks)} />
      </div>

      {showForm && (
        <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Log Ad Spend</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label><span className="text-xs text-gray-400 block mb-1">Campaign (optional)</span>
              <select value={form.campaign_id} onChange={e => setForm({...form, campaign_id: e.target.value})} className={inputCls}>
                <option value="">— none —</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label><span className="text-xs text-gray-400 block mb-1">Platform</span>
              <select value={form.platform} onChange={e => setForm({...form, platform: e.target.value})} className={inputCls}>
                {AD_PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>
            <label><span className="text-xs text-gray-400 block mb-1">Date</span>
              <input type="date" value={form.spend_date} onChange={e => setForm({...form, spend_date: e.target.value})} className={inputCls} />
            </label>
            <label><span className="text-xs text-gray-400 block mb-1">Spend (cents)</span>
              <input type="number" value={form.spend_cents} onChange={e => setForm({...form, spend_cents: e.target.value})} className={inputCls} />
            </label>
            <label><span className="text-xs text-gray-400 block mb-1">Revenue (cents)</span>
              <input type="number" value={form.revenue_cents} onChange={e => setForm({...form, revenue_cents: e.target.value})} className={inputCls} />
            </label>
            <label><span className="text-xs text-gray-400 block mb-1">Conversions</span>
              <input type="number" value={form.conversions} onChange={e => setForm({...form, conversions: e.target.value})} className={inputCls} />
            </label>
            <label><span className="text-xs text-gray-400 block mb-1">Impressions</span>
              <input type="number" value={form.impressions} onChange={e => setForm({...form, impressions: e.target.value})} className={inputCls} />
            </label>
            <label><span className="text-xs text-gray-400 block mb-1">Clicks</span>
              <input type="number" value={form.clicks} onChange={e => setForm({...form, clicks: e.target.value})} className={inputCls} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setForm(emptyForm); setShowForm(false) }} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
            <button onClick={save} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">Save</button>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Rollup by Platform</h2>
        {byPlatform.length === 0 ? <p className="text-gray-500 text-sm">No spend logged yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left py-2">Platform</th>
                <th className="text-right py-2">Spend</th>
                <th className="text-right py-2">Revenue</th>
                <th className="text-right py-2">ROAS</th>
                <th className="text-right py-2">Conv.</th>
                <th className="text-right py-2">CTR</th>
                <th className="text-right py-2">CPA</th>
              </tr>
            </thead>
            <tbody>
              {byPlatform.map(p => (
                <tr key={p.platform} className="border-t border-navy-700/40">
                  <td className="py-2 text-white capitalize">{p.platform}</td>
                  <td className="py-2 text-right text-rose-300">{formatMoney(p.spend_cents)}</td>
                  <td className="py-2 text-right text-emerald-300">{formatMoney(p.revenue_cents)}</td>
                  <td className="py-2 text-right font-semibold">{p.roas != null ? `${p.roas.toFixed(2)}x` : '—'}</td>
                  <td className="py-2 text-right">{formatInt(p.conversions)}</td>
                  <td className="py-2 text-right">{p.ctr != null ? formatPct(p.ctr) : '—'}</td>
                  <td className="py-2 text-right">{p.cpa != null ? formatMoney(Math.round(p.cpa)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-sm font-semibold text-white">Recent Entries</h2>
          <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="bg-navy-800 border border-navy-700 text-white text-xs rounded px-2 py-1">
            <option value="">All platforms</option>
            {AD_PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        {loading ? <p className="p-4 text-gray-400 text-sm">Loading…</p> :
         rows.length === 0 ? <p className="p-4 text-gray-500 text-sm">No ad spend logged.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-navy-900/60 text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-3">Platform</th>
                <th className="text-right py-2 px-3">Spend</th>
                <th className="text-right py-2 px-3">Revenue</th>
                <th className="text-right py-2 px-3">Conv.</th>
                <th className="text-right py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map(r => (
                <tr key={r.id} className="border-t border-navy-700/40">
                  <td className="py-2 px-3 text-gray-300">{r.spend_date}</td>
                  <td className="py-2 px-3 text-white capitalize">{r.platform}</td>
                  <td className="py-2 px-3 text-right text-rose-300">{formatMoney(r.spend_cents || 0)}</td>
                  <td className="py-2 px-3 text-right text-emerald-300">{formatMoney(r.revenue_cents || 0)}</td>
                  <td className="py-2 px-3 text-right">{formatInt(r.conversions || 0)}</td>
                  <td className="py-2 px-3 text-right"><button onClick={() => remove(r.id)} className="text-rose-400 hover:underline text-xs">Del</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
