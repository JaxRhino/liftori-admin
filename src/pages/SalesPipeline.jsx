/**
 * SalesPipeline — Liftori's sales pipeline at /admin/pipeline.
 *
 * Account-centric: every deal is a customer_product_lines row on the shared
 * SALES_STAGES vocabulary. A product selector switches the flow:
 *   - "Products & Builds": CRM / Website / Custom Build lines (shared board).
 *   - "Consulting": the separate EOS engagement flow (consulting_engagements).
 *
 * Sales -> Operations handoff lives in moveLine(): a line flagged "build" spawns
 * an Operations project at "New Project"; a "Won" line advances its project to
 * "Onboarding". The reverse (Demo Ready / Won back to sales) is handled by the
 * Operations board (Projects.jsx) via opsToSales().
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import {
  SALES_OPEN,
  SALES_STAGE_COLORS,
  SALES_STAGE_PROBABILITY,
  normalizeSalesStage,
  salesToOps,
  lineTcv,
} from '../lib/customerValue'

const PRODUCT_TYPES = ['CRM', 'Website', 'Custom Build']
// product_type (singular) -> projects.project_type (plural)
const PL_PROJECT_TYPE = { 'CRM': 'CRM', 'Website': 'Websites', 'Custom Build': 'Custom Builds' }
const TYPE_COLOR = {
  'CRM': 'bg-brand-blue/20 text-brand-blue',
  'Website': 'bg-emerald-500/20 text-emerald-400',
  'Custom Build': 'bg-amber-500/20 text-amber-400',
}
const money = n => '$' + Math.round(Number(n) || 0).toLocaleString()

// Default fulfillment path when a line hasn't been flagged: Custom Build => needs a build.
function pathOf(line) {
  if (line.fulfillment_path === 'build' || line.fulfillment_path === 'demo') return line.fulfillment_path
  return line.product_type === 'Custom Build' ? 'build' : 'demo'
}

// Consulting flow columns (separate flow). Tolerates id-style and title-style stage values.
const CONSULTING_STAGES = [
  { id: 'lead', label: 'Lead', match: ['lead', 'new lead'] },
  { id: 'discovery', label: 'Discovery', match: ['discovery', 'discovery call'] },
  { id: 'audit', label: 'Business Audit', match: ['audit', 'company audit', 'company onboarding'] },
  { id: 'plan', label: 'Plan', match: ['plan_presentation', 'plan_adjustments', 'building plan', 'estimating', 'estimate sent'] },
  { id: 'implementation', label: 'Implementation', match: ['implementation', 'payment received', 'onboarding'] },
  { id: 'ongoing', label: 'Ongoing / L10', match: ['ongoing', 'active client'] },
  { id: 'completed', label: 'Completed', match: ['completed', 'archive', 'archive/lost', 'lost', 'payment hold'] },
]
function consultingBucket(stage) {
  const s = (stage || '').toString().toLowerCase()
  const col = CONSULTING_STAGES.find(c => c.match.includes(s))
  return col ? col.id : 'lead'
}

function Stat({ label, value, accent }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent || 'text-white'}`}>{value}</p>
    </div>
  )
}

export default function SalesPipeline() {
  const { profile, user } = useAuth()
  const myId = profile?.id || user?.id
  const [view, setView] = useState('products') // 'products' | 'consulting'
  const [lines, setLines] = useState([])
  const [engagements, setEngagements] = useState([])
  const [loading, setLoading] = useState(true)
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showLost, setShowLost] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [lr, er] = await Promise.all([
      supabase
        .from('customer_product_lines')
        .select('*, customer:profiles!customer_product_lines_profile_id_fkey(id, full_name, company_name), owner:profiles!customer_product_lines_owner_id_fkey(full_name), project:projects!customer_product_lines_project_id_fkey(id, status)')
        .order('updated_at', { ascending: false }),
      supabase
        .from('consulting_engagements')
        .select('id, company_name, client_name, contract_value, engagement_stage, updated_at')
        .order('updated_at', { ascending: false }),
    ])
    if (lr.error) console.error('lines', lr.error)
    if (er.error) console.error('engagements', er.error)
    setLines((lr.data || []).filter(l => l.product_type !== 'Consulting'))
    setEngagements(er.data || [])
    setLoading(false)
  }

  async function assignToMe(line) {
    if (!myId) return
    setBusyId(line.id)
    try {
      await supabase.from('customer_product_lines').update({ owner_id: myId, updated_at: new Date().toISOString() }).eq('id', line.id)
      await fetchAll()
    } catch (e) { console.error(e); alert('Failed to assign') } finally { setBusyId(null) }
  }

  async function setPath(line, path) {
    setBusyId(line.id)
    try {
      await supabase.from('customer_product_lines').update({ fulfillment_path: path, updated_at: new Date().toISOString() }).eq('id', line.id)
      await fetchAll()
    } catch (e) { console.error(e); alert('Failed to set path') } finally { setBusyId(null) }
  }

  // Move a sales line and run the Operations handoff.
  async function moveLine(line, newStage) {
    if (newStage === normalizeSalesStage(line.stage)) return
    setBusyId(line.id)
    try {
      const patch = { stage: newStage, updated_at: new Date().toISOString() }
      if (newStage === 'Won') { patch.won_at = line.won_at || new Date().toISOString(); patch.lost_at = null }
      else if (newStage === 'Lost') { patch.lost_at = line.lost_at || new Date().toISOString() }
      else { patch.won_at = null; patch.lost_at = null }

      let projectId = line.project_id || null
      const path = pathOf(line)
      const isProduct = line.product_type !== 'Consulting' && PL_PROJECT_TYPE[line.product_type]

      // Need a project? (a) build path entering Demo / Mockup, or (b) Won with no project yet.
      const needsBuildProject = isProduct && !projectId && path === 'build' && newStage === 'Demo / Mockup'
      const needsDeliveryProject = isProduct && !projectId && newStage === 'Won'
      if (needsBuildProject || needsDeliveryProject) {
        const cname = line.customer?.company_name || line.customer?.full_name || 'Customer'
        const { data: proj, error: pErr } = await supabase.from('projects').insert({
          name: cname + ' - ' + line.product_type,
          project_type: PL_PROJECT_TYPE[line.product_type],
          status: needsDeliveryProject ? 'Onboarding' : 'New Project',
          tier: 'Starter',
          customer_id: line.profile_id,
          client_display_name: cname,
          mrr: Number(line.mrr) || 0,
          brief: 'New ' + line.product_type + ' for ' + cname + '.',
        }).select().single()
        if (pErr) throw pErr
        projectId = proj.id
        patch.project_id = projectId
      } else if (projectId) {
        // Existing linked project: only move it on Won/Lost (build phase owns its own status).
        const opsStatus = salesToOps(newStage)
        if (opsStatus) await supabase.from('projects').update({ status: opsStatus, updated_at: new Date().toISOString() }).eq('id', projectId)
      }

      const { error } = await supabase.from('customer_product_lines').update(patch).eq('id', line.id)
      if (error) throw error
      await fetchAll()
    } catch (e) { console.error(e); alert('Failed to move: ' + (e.message || '')) } finally { setBusyId(null) }
  }

  const columns = showLost ? [...SALES_OPEN, 'Won', 'Lost'] : [...SALES_OPEN, 'Won']

  const filteredLines = useMemo(() => lines.filter(l =>
    (typeFilter === 'all' || l.product_type === typeFilter) &&
    (ownerFilter === 'all' || (ownerFilter === 'mine' ? l.owner_id === myId : !l.owner_id))
  ), [lines, typeFilter, ownerFilter, myId])

  const stats = useMemo(() => {
    const open = filteredLines.filter(l => { const s = normalizeSalesStage(l.stage); return s !== 'Won' && s !== 'Lost' })
    const openValue = open.reduce((s, l) => s + lineTcv(l), 0)
    const weighted = open.reduce((s, l) => s + lineTcv(l) * ((l.probability ?? SALES_STAGE_PROBABILITY[normalizeSalesStage(l.stage)] ?? 0) / 100), 0)
    const won = filteredLines.filter(l => normalizeSalesStage(l.stage) === 'Won')
    const wonValue = won.reduce((s, l) => s + lineTcv(l), 0)
    return { openCount: open.length, openValue, weighted, wonCount: won.length, wonValue }
  }, [filteredLines])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Pipeline</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {view === 'products'
              ? 'Products & custom builds. A line is sold via a product demo or by building a mockup; a won line hands off to Operations.'
              : 'Business consulting engagements — a separate EOS-driven flow.'}
          </p>
        </div>
        {/* Product selector */}
        <div className="flex bg-navy-800 rounded-lg p-0.5 border border-navy-600/50">
          {[['products', 'Products & Builds'], ['consulting', 'Consulting']].map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === k ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'products' ? (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              {['all', ...PRODUCT_TYPES].map(t => (
                <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400 hover:text-white'}`}>
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-navy-800 rounded-lg p-0.5 border border-navy-600/50">
                {['all', 'mine', 'unassigned'].map(o => (
                  <button key={o} onClick={() => setOwnerFilter(o)} className={`px-2.5 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${ownerFilter === o ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white'}`}>
                    {o === 'mine' ? 'My Pipeline' : o}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowLost(v => !v)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showLost ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-navy-800 text-gray-400 border-navy-600/50 hover:text-white'}`}>
                {showLost ? 'Hide Lost' : 'Show Lost'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Open Lines" value={stats.openCount} />
            <Stat label="Open Pipeline (TCV)" value={money(stats.openValue)} accent="text-brand-blue" />
            <Stat label="Weighted Forecast" value={money(stats.weighted)} accent="text-amber-400" />
            <Stat label="Won (TCV)" value={money(stats.wonValue)} accent="text-emerald-400" />
          </div>

          {filteredLines.length === 0 ? (
            <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-10 text-center">
              <p className="text-sm text-gray-400">No product lines yet.</p>
              <p className="text-xs text-gray-600 mt-1">Add CRM / Website / Custom Build lines from a customer's Product Lines tab and they appear here.</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {columns.map(stage => {
                const items = filteredLines.filter(l => normalizeSalesStage(l.stage) === stage)
                const val = items.reduce((s, l) => s + lineTcv(l), 0)
                const c = SALES_STAGE_COLORS[stage] || {}
                return (
                  <div key={stage} className="flex-shrink-0 w-72">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.dot || 'bg-gray-400'}`} />
                        <span className="text-sm font-semibold text-white">{stage}</span>
                        <span className="text-xs text-gray-500">{items.length}</span>
                      </div>
                      {val > 0 && <span className="text-xs text-gray-500">{money(val)}</span>}
                    </div>
                    <div className="space-y-2 min-h-[40px]">
                      {items.map(l => {
                        const path = pathOf(l)
                        const opsStatus = l.project?.status
                        return (
                          <div key={l.id} onClick={() => setSelected(l)} className="cursor-pointer bg-navy-800 border border-navy-700/50 rounded-xl p-3 hover:border-brand-blue/40">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[l.product_type] || 'bg-gray-500/20 text-gray-400'}`}>{l.product_type}</span>
                              <button onClick={(e) => { e.stopPropagation(); setPath(l, path === 'build' ? 'demo' : 'build') }} disabled={busyId === l.id} title="Toggle fulfillment path" className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${path === 'build' ? 'bg-blue-500/20 text-blue-300' : 'bg-teal-500/20 text-teal-300'}`}>
                                {path === 'build' ? 'Needs Build' : 'Product Demo'}
                              </button>
                              {lineTcv(l) > 0 && <span className="text-[11px] text-emerald-400 font-semibold">{money(lineTcv(l))}</span>}
                            </div>
                            <Link onClick={e => e.stopPropagation()} to={`/admin/customers/${l.customer?.id || l.profile_id}`} className="block text-sm font-semibold text-white hover:text-brand-blue mt-1 truncate">
                              {l.customer?.company_name || l.customer?.full_name || 'Customer'}
                            </Link>
                            {l.customer?.company_name && l.customer?.full_name && <p className="text-[11px] text-gray-500 truncate">{l.customer.full_name}</p>}
                            {path === 'build' && opsStatus && <p className="text-[11px] text-teal-400 mt-1">In Operations: {opsStatus}</p>}
                            {l.expected_close_date && <p className="text-[11px] text-gray-500 mt-1">Close {new Date(l.expected_close_date).toLocaleDateString()}</p>}
                            <div className="flex items-center justify-between mt-2 gap-2">
                              <span className="text-[11px] text-gray-500 truncate">{l.owner?.full_name || (l.owner_id ? 'Assigned' : 'Unassigned')}</span>
                              {!l.owner_id && myId && (
                                <button onClick={(e) => { e.stopPropagation(); assignToMe(l) }} disabled={busyId === l.id} className="text-[11px] text-brand-blue hover:underline disabled:opacity-50 flex-shrink-0">Assign to me</button>
                              )}
                            </div>
                            <select
                              value={stage}
                              onClick={e => e.stopPropagation()}
                              onChange={e => moveLine(l, e.target.value)}
                              disabled={busyId === l.id}
                              className="mt-2 w-full bg-navy-900 border border-navy-700/50 rounded-lg px-2 py-1.5 text-[11px] text-gray-300 disabled:opacity-50"
                            >
                              {[...SALES_OPEN, 'Won', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <ConsultingBoard engagements={engagements} />
      )}
      {selected && <DealDrawer line={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function DealDrawer({ line, onClose }) {
  const [est, setEst] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const moneyd = n => '$' + Math.round(Number(n) || 0).toLocaleString()
  const PUBLIC_BASE = 'https://admin.liftori.ai'
  useEffect(() => {
    (async () => {
      if (line.estimate_id) {
        const [e1, e2] = await Promise.all([
          supabase.from('sales_estimates').select('*').eq('id', line.estimate_id).maybeSingle(),
          supabase.from('sales_estimate_items').select('*').eq('estimate_id', line.estimate_id).order('sort_order'),
        ])
        setEst(e1.data || null); setItems(e2.data || [])
      }
      setLoading(false)
    })()
  }, [line.estimate_id])
  const cust = line.customer?.company_name || line.customer?.full_name || 'Customer'
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="h-full w-full max-w-xl overflow-auto border-l border-navy-700 bg-navy-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{cust}</h2>
            <p className="text-xs text-gray-400">{line.product_type} &middot; {normalizeSalesStage(line.stage)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">Close</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="Deal value" value={moneyd(line.estimated_value)} accent="text-brand-blue" />
          <Stat label="Recurring" value={line.mrr ? moneyd(line.mrr) + '/mo' : '-'} accent="text-emerald-400" />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-6 text-center">Loading...</p>
        ) : !line.estimate_id ? (
          <div className="rounded-xl border border-navy-700/50 bg-navy-800/50 p-4 text-sm text-gray-400">
            No estimate is linked to this deal yet. Build one from Sales Hub &gt; Estimates and send it; the products will show here.
          </div>
        ) : !est ? (
          <p className="text-sm text-gray-500">Linked estimate not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-gray-400">{est.estimate_number}{est.title ? ' - ' + est.title : ''}</span>
              <span className="rounded-md border px-2 py-0.5 text-[11px] font-semibold text-gray-300 border-navy-600 capitalize">{(est.status || '').replace('_', ' ')}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-navy-700/50">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy-800 text-[11px] uppercase tracking-wider text-gray-400">
                  <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-navy-700/50">
                  {items.map(i => (
                    <tr key={i.id} className="bg-navy-900/40">
                      <td className="px-3 py-2 text-white">{i.name}{i.billing === 'monthly' && <span className="ml-1 text-[11px] text-gray-500">monthly</span>}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{i.qty}</td>
                      <td className="px-3 py-2 text-right font-mono text-brand-blue">{moneyd(i.line_total)}{i.billing === 'monthly' ? '/mo' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-navy-700/50 bg-navy-800/50 p-3 text-sm space-y-1">
              <div className="flex justify-between text-gray-400"><span>50% deposit</span><span className="font-mono text-brand-blue">{moneyd(est.deposit_amount)}</span></div>
              <div className="flex justify-between text-gray-400"><span>Signature</span><span className={est.signed_at ? 'text-emerald-400' : 'text-gray-500'}>{est.signed_at ? 'Signed by ' + est.signer_name : 'Not signed'}</span></div>
              <div className="flex justify-between text-gray-400"><span>Deposit</span><span className={est.deposit_paid_at ? 'text-emerald-400' : 'text-gray-500'}>{est.deposit_paid_at ? 'Paid' : 'Not paid'}</span></div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Customer signature link</p>
              <input readOnly value={`${PUBLIC_BASE}/estimate/${est.public_token}`} onFocus={e => e.target.select()} className="w-full rounded-lg bg-navy-900 border border-navy-700/50 px-2 py-1.5 text-xs text-gray-300" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ConsultingBoard({ engagements }) {
  const money2 = n => '$' + Math.round(Number(n) || 0).toLocaleString()
  const open = engagements.filter(e => !['completed', 'archive', 'archive/lost', 'lost'].includes((e.engagement_stage || '').toLowerCase()))
  const pipelineValue = open.reduce((s, e) => s + (Number(e.contract_value) || 0), 0)
  const ongoing = engagements.filter(e => ['ongoing', 'active client'].includes((e.engagement_stage || '').toLowerCase())).length
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-3 gap-4 flex-1 min-w-[280px]">
          <Stat label="Open Engagements" value={open.length} />
          <Stat label="Active Clients" value={ongoing} accent="text-emerald-400" />
          <Stat label="Pipeline Value" value={money2(pipelineValue)} accent="text-brand-blue" />
        </div>
        <Link to="/admin/consulting/clients" className="px-3 py-2 rounded-lg text-xs font-semibold bg-brand-blue text-white hover:bg-brand-blue/90">Open Consulting Hub</Link>
      </div>

      {engagements.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">No consulting engagements yet.</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {CONSULTING_STAGES.map(col => {
            const items = engagements.filter(e => consultingBucket(e.engagement_stage) === col.id)
            const val = items.reduce((s, e) => s + (Number(e.contract_value) || 0), 0)
            return (
              <div key={col.id} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-sm font-semibold text-white">{col.label}</span>
                  <span className="text-xs text-gray-500">{items.length}{val > 0 ? ` · ${money2(val)}` : ''}</span>
                </div>
                <div className="space-y-2 min-h-[40px]">
                  {items.map(e => (
                    <Link key={e.id} to={`/admin/consulting/client/${e.id}`} className="block bg-navy-800 border border-navy-700/50 rounded-xl p-3 hover:border-brand-blue/40">
                      <p className="text-sm font-semibold text-white truncate">{e.company_name || e.client_name || 'Engagement'}</p>
                      {e.client_name && e.company_name && <p className="text-[11px] text-gray-500 truncate">{e.client_name}</p>}
                      {e.contract_value > 0 && <p className="text-[11px] text-emerald-400 font-semibold mt-1">{money2(e.contract_value)}</p>}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
