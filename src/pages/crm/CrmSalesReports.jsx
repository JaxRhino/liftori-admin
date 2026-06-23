import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, useCrmClient } from './_shared'
import { toast } from 'sonner'

// Sales reports. Reads the tenant's OWN Supabase via useCrmClient(). Pure
// analytics computed client-side from customer_pipeline + org_team_members:
// rep close rate, pipeline velocity, revenue by period, pipeline by stage.

const WON_STAGES = ['won', 'closed_won', 'ops']
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString()
const pct = (n) => (Number(n) || 0).toFixed(0) + '%'
const PERIODS = [{ k: '30d', label: 'Last 30 days', days: 30 }, { k: '90d', label: 'Last 90 days', days: 90 }, { k: 'ytd', label: 'Year to date', days: null }, { k: 'all', label: 'All time', days: null }]
const norm = (s) => (s || '').toString().toLowerCase()

function Bar({ label, value, max, sub, tone = 'bg-brand-blue' }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3 px-5 py-2">
      <div className="w-40 shrink-0 text-sm text-gray-300 truncate">{label}</div>
      <div className="flex-1 bg-navy-900/60 rounded h-5 overflow-hidden"><div className={`h-5 ${tone} rounded`} style={{ width: w + '%' }} /></div>
      <div className="w-28 shrink-0 text-right text-sm text-gray-200">{sub}</div>
    </div>
  )
}

export default function CrmSalesReports() {
  const { client } = useCrmClient()
  const [deals, setDeals] = useState([])
  const [team, setTeam] = useState([])
  const [period, setPeriod] = useState('90d')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client])
  async function load() {
    try {
      setLoading(true)
      const [d, t] = await Promise.all([
        client.from('customer_pipeline').select('id, title, stage, deal_value, assigned_to, won_date, created_at'),
        client.from('org_team_members').select('user_id, first_name, last_name').not('user_id', 'is', null),
      ])
      setDeals(d?.data || []); setTeam(t?.data || [])
    } catch (e) { console.error(e); toast.error('Failed to load sales reports') } finally { setLoading(false) }
  }

  const repByUser = useMemo(() => Object.fromEntries(team.map((m) => [m.user_id, ((m.first_name || '') + ' ' + (m.last_name || '')).trim()])), [team])
  const since = useMemo(() => {
    const p = PERIODS.find((x) => x.k === period)
    if (period === 'all') return null
    if (period === 'ytd') return new Date(new Date().getFullYear(), 0, 1)
    return new Date(Date.now() - (p.days) * 86400000)
  }, [period])
  const inPeriod = (d) => { if (!since) return true; if (!d) return false; return new Date(d) >= since }

  const r = useMemo(() => {
    const isWon = (x) => WON_STAGES.includes(norm(x.stage))
    const isLost = (x) => norm(x.stage) === 'lost'
    const open = deals.filter((x) => !isWon(x) && !isLost(x))
    const wonInP = deals.filter((x) => isWon(x) && inPeriod(x.won_date || x.created_at))
    const lostInP = deals.filter((x) => isLost(x) && inPeriod(x.created_at))
    const openValue = open.reduce((t, x) => t + (Number(x.deal_value) || 0), 0)
    const wonValue = wonInP.reduce((t, x) => t + (Number(x.deal_value) || 0), 0)
    const winRate = (wonInP.length + lostInP.length) > 0 ? (wonInP.length / (wonInP.length + lostInP.length)) * 100 : 0
    const avgDeal = wonInP.length ? wonValue / wonInP.length : 0
    // velocity: avg days created->won
    const vels = wonInP.filter((x) => x.created_at && x.won_date).map((x) => (new Date(x.won_date) - new Date(x.created_at)) / 86400000).filter((n) => n >= 0)
    const velocity = vels.length ? vels.reduce((a, b) => a + b, 0) / vels.length : null
    // revenue by month (last 6)
    const months = []
    for (let i = 5; i >= 0; i--) { const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - i); months.push({ key: dt.getFullYear() + '-' + dt.getMonth(), label: dt.toLocaleDateString('en-US', { month: 'short' }), value: 0 }) }
    const mmap = Object.fromEntries(months.map((m) => [m.key, m]))
    for (const x of deals.filter(isWon)) { if (!x.won_date) continue; const dt = new Date(x.won_date); const k = dt.getFullYear() + '-' + dt.getMonth(); if (mmap[k]) mmap[k].value += Number(x.deal_value) || 0 }
    // pipeline by stage (open)
    const stageMap = {}
    for (const x of open) { const s = norm(x.stage) || 'new'; (stageMap[s] = stageMap[s] || { stage: s, count: 0, value: 0 }); stageMap[s].count += 1; stageMap[s].value += Number(x.deal_value) || 0 }
    const stages = Object.values(stageMap).sort((a, b) => b.value - a.value)
    // rep leaderboard
    const repMap = {}
    for (const x of deals) {
      const key = x.assigned_to || '__un'
      const rep = (repMap[key] = repMap[key] || { rep: repByUser[x.assigned_to] || 'Unassigned', deals: 0, won: 0, lost: 0, wonValue: 0 })
      if (inPeriod(x.won_date || x.created_at)) {
        if (isWon(x)) { rep.won += 1; rep.wonValue += Number(x.deal_value) || 0 }
        else if (isLost(x)) rep.lost += 1
      }
      rep.deals += 1
    }
    const reps = Object.values(repMap).filter((x) => x.won + x.lost > 0 || x.wonValue > 0).sort((a, b) => b.wonValue - a.wonValue)
    return { openValue, wonValue, winRate, avgDeal, velocity, months, stages, reps, wonCount: wonInP.length }
  }, [deals, repByUser, since, period])

  const monthMax = Math.max(1, ...r.months.map((m) => m.value))
  const stageMax = Math.max(1, ...r.stages.map((s) => s.value))

  return (
    <HubPage title="Sales Reports" subtitle="Close rate, pipeline velocity, and revenue by period."
      actions={<select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-navy-800 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm">{PERIODS.map((p) => <option key={p.k} value={p.k}>{p.label}</option>)}</select>}>
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Open Pipeline" value={money(r.openValue)} />
            <StatCard label="Won (period)" value={money(r.wonValue)} accent="text-emerald-400" hint={`${r.wonCount} deals`} />
            <StatCard label="Win Rate" value={pct(r.winRate)} accent="text-brand-blue" />
            <StatCard label="Avg Deal" value={money(r.avgDeal)} />
            <StatCard label="Sales Velocity" value={r.velocity != null ? Math.round(r.velocity) + 'd' : '—'} accent="text-amber-400" hint="lead to won" />
          </div>

          <Section title="Revenue by month (won)">
            <div className="py-2">
              {r.months.map((m) => <Bar key={m.key} label={m.label} value={m.value} max={monthMax} sub={money(m.value)} tone="bg-emerald-500/70" />)}
            </div>
          </Section>

          <Section title="Open pipeline by stage">
            <div className="py-2">
              {r.stages.length === 0 && <div className="px-5 py-6 text-center text-gray-500 text-sm">No open deals.</div>}
              {r.stages.map((s) => <Bar key={s.stage} label={s.stage.replace('_', ' ')} value={s.value} max={stageMax} sub={`${s.count} · ${money(s.value)}`} />)}
            </div>
          </Section>

          <Section title="Rep leaderboard">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                  <th className="text-left px-5 py-3 font-medium">Rep</th>
                  <th className="text-right px-4 py-3 font-medium">Won</th>
                  <th className="text-right px-4 py-3 font-medium">Lost</th>
                  <th className="text-right px-4 py-3 font-medium">Close Rate</th>
                  <th className="text-right px-5 py-3 font-medium">Won Revenue</th>
                </tr></thead>
                <tbody>
                  {r.reps.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No closed activity in this period.</td></tr>}
                  {r.reps.map((rep, i) => {
                    const cr = (rep.won + rep.lost) > 0 ? (rep.won / (rep.won + rep.lost)) * 100 : 0
                    return (
                      <tr key={i} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3 text-white font-medium">{rep.rep}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">{rep.won}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{rep.lost}</td>
                        <td className="px-4 py-3 text-right text-gray-200">{pct(cr)}</td>
                        <td className="px-5 py-3 text-right text-white font-medium">{money(rep.wonValue)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </HubPage>
  )
}
