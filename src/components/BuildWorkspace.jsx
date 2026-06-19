import { useState, useEffect } from 'react'
import FeatureLibraryPicker from './FeatureLibraryPicker'

// ──────────────────────────────────────────────────────────────────────────
// Shared, workspace-jsonb-backed spec tabs.
// Single source of truth used by BOTH the In-House Build detail and the
// Operations Project detail so every project is documented the same way.
// Each host page owns its own data fetch + a saveWs(next) that persists the
// workspace jsonb to its own table (inhouse_builds.workspace / projects.workspace).
// ──────────────────────────────────────────────────────────────────────────

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))
export const money = (v) => '$' + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

// Product type options for the Project Details dropdown (reuses existing project_type values).
export const PRODUCT_TYPES = ['Website', 'Websites', 'CRM', 'Custom Builds', 'Web App', 'Mobile App', 'Business Platform', 'E-Commerce', 'Dashboard', 'Marketplace', 'Book Writing App', 'CRM Builder', 'Website Builder', 'Other']

const TL_STATUS = { planned: 'bg-slate-500/15 text-slate-300', active: 'bg-sky-500/15 text-sky-300', done: 'bg-green-500/15 text-green-300' }

// Workspace-backed spec tabs shared across detail pages.
export const WORKSPACE_TABS = [
  { key: 'details', label: 'Project Details' },
  { key: 'design', label: 'Design' },
  { key: 'features', label: 'Features' },
  { key: 'scope', label: 'Scope' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'plan', label: 'Implementation Plan' },
  { key: 'security', label: 'Security' },
  { key: 'costs', label: 'Costs' },
  { key: 'documents', label: 'Documents' },
  { key: 'tasks', label: 'Tasks' },
]

export const WORKSPACE_TAB_KEYS = WORKSPACE_TABS.map(t => t.key)

export function wsTabBadge(ws, key) {
  const w = ws || {}
  if (key === 'features' && (w.features || []).length) return (w.features || []).length
  if (key === 'tasks' && (w.tasks || []).length) return `${(w.tasks || []).filter(t => t.done).length}/${(w.tasks || []).length}`
  if (key === 'documents' && (w.documents || []).length) return (w.documents || []).length
  if (key === 'timeline' && (w.timeline || []).length) return (w.timeline || []).length
  if (key === 'costs') {
    const c = w.costs || {}
    const te = c.time_entries || []
    const li = c.line_items || []
    const total = te.reduce((s, e) => s + Number(e.hours || 0), 0) * Number(c.hourly_rate || 0) + li.reduce((s, l) => s + Number(l.amount || 0), 0)
    return total ? money(total) : null
  }
  return null
}

// Renders the body for any workspace-backed spec tab.
// productType (optional) = { value, options, onChange } - wires the Product Type
// dropdown to whatever column/field the host page chooses to store it in.
export function WorkspaceTabBody({ tab, ws, onSave, productType }) {
  const w = ws || {}
  const patchWs = (key, value) => onSave({ ...w, [key]: value })
  switch (tab) {
    case 'details':
      return (
        <div className="space-y-6">
          <DetailsFields ws={w} onSave={onSave} productType={productType} />
          <Narrative title="Project Overview" value={w.project_details} onSave={v => patchWs('project_details', v)} placeholder="What is this project, who is it for, the problem it solves, key decisions..." />
        </div>
      )
    case 'design':
      return <DesignFields ws={w} onSave={onSave} />
    case 'scope':
      return <Narrative title="Scope of All Features" value={w.scope} onSave={v => patchWs('scope', v)} placeholder="Everything in scope - and explicitly what is out of scope..." />
    case 'plan':
      return <Narrative title="Implementation Plan" value={w.implementation_plan} onSave={v => patchWs('implementation_plan', v)} placeholder="Build sequence, waves, architecture approach, dependencies..." />
    case 'security':
      return <Narrative title="Security" value={w.security} onSave={v => patchWs('security', v)} placeholder="Auth model, RLS, secrets handling, data protection, threat notes..." />
    case 'features':
      return (
        <div className="space-y-4">
          <FeatureLibraryPicker ws={w} onSave={onSave} mode="web" />
          <FeaturesSectioned items={w.features || []} onChange={v => patchWs('features', v)} />
        </div>
      )
    case 'documents':
      return <ListEditor title="Documents" items={w.documents || []} columns={[['name', 'Name', 'Document name'], ['url', 'Link / URL', 'https://...', 'link']]} onChange={v => patchWs('documents', v)} empty="No documents linked yet." />
    case 'timeline':
      return <TimelineEditor ws={w} onSave={onSave} />
    case 'costs':
      return <CostsEditor ws={w} onSave={onSave} />
    case 'tasks':
      return <TasksEditor ws={w} onSave={onSave} />
    default:
      return null
  }
}

const DETAIL_SECTIONS = [
  { title: 'Ownership', fields: [['owner', 'Project Owner', 'text'], ['assigned_to', 'Assigned To', 'text'], ['stage', 'Stage', 'text'], ['start_date', 'Start Date', 'date'], ['target_launch', 'Target Launch', 'date']] },
  { title: 'Recurring Revenue', fields: [['mrr', 'MRR (monthly recurring)', 'money'], ['arr', 'ARR (annual recurring)', 'money'], ['pricing_model', 'Pricing Model', 'text'], ['active_customers', 'Active Customers', 'number']] },
  { title: 'Projections', fields: [['revenue_projection', 'Revenue Projection (12mo)', 'money'], ['buyout_prediction', 'Sale Price / Exit Value', 'money'], ['profit_margin', 'Profit Margin', 'percent'], ['break_even', 'Break-even (note)', 'text']] },
  { title: 'Budgets', fields: [['build_budget', 'Build Budget', 'money'], ['marketing_budget', 'Marketing Budget', 'money']] },
]

export function DetailsFields({ ws, onSave, productType }) {
  const d = ws.details || {}
  const commit = (k, v) => onSave({ ...ws, details: { ...d, [k]: v } })
  const mrr = Number(d.mrr || 0)
  const effectiveArr = Number(d.arr) > 0 ? Number(d.arr) : mrr * 12
  const totalBudget = Number(d.build_budget || 0) + Number(d.marketing_budget || 0)
  const margin = Number(d.profit_margin || 0)
  const monthlyProfit = mrr * (margin / 100)
  const breakEvenMo = totalBudget > 0 && monthlyProfit > 0 ? Math.ceil(totalBudget / monthlyProfit) : null
  return (
    <div className="space-y-5">
      {productType && (
        <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Classification</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-navy-900 border border-navy-700/50 rounded-lg p-3">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Product Type</label>
              <select value={productType.value || ''} onChange={e => productType.onChange(e.target.value)} className="w-full bg-transparent text-white text-sm focus:outline-none">
                <option value="" className="bg-navy-900">- Select -</option>
                {productType.value && !(productType.options || PRODUCT_TYPES).includes(productType.value) && (
                  <option value={productType.value} className="bg-navy-900">{productType.value}</option>
                )}
                {(productType.options || PRODUCT_TYPES).map(o => <option key={o} value={o} className="bg-navy-900">{o}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="MRR" value={money(mrr)} accent="text-sky-300" />
        <Stat label="ARR (effective)" value={money(effectiveArr)} accent="text-green-400" />
        <Stat label="Total Budget" value={money(totalBudget)} />
        <Stat label="Est. Break-even" value={breakEvenMo ? `${breakEvenMo} mo` : '-'} />
      </div>
      {DETAIL_SECTIONS.map(sec => (
        <div key={sec.title} className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">{sec.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {sec.fields.map(([key, label, type]) => (
              <FieldCell key={key} label={label} type={type} value={d[key]} placeholder={key === 'arr' && mrr > 0 ? String(mrr * 12) : undefined} onCommit={v => commit(key, v)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FieldCell({ label, type, value, placeholder, onCommit }) {
  const isMoney = type === 'money'
  const isPct = type === 'percent'
  const numeric = isMoney || isPct || type === 'number'
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <div className="bg-navy-900 border border-navy-700/50 rounded-lg p-3">
      <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {isMoney && <span className="text-slate-500 text-sm">$</span>}
        {type === 'date' ? (
          <input type="date" value={v} onChange={e => setV(e.target.value)} onBlur={() => onCommit(v)} className="w-full bg-transparent text-white text-sm focus:outline-none" />
        ) : (
          <input value={v} onChange={e => setV(numeric ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)} onBlur={() => onCommit(numeric ? (v === '' ? '' : Number(v)) : v)} inputMode={numeric ? 'decimal' : undefined} placeholder={placeholder || (numeric ? '0' : '-')} className="w-full bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-600" />
        )}
        {isPct && <span className="text-slate-500 text-sm">%</span>}
      </div>
    </div>
  )
}

export function Narrative({ title, value, onSave, placeholder }) {
  const [draft, setDraft] = useState(value || '')
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setDraft(value || ''); setDirty(false) }, [value])
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <button onClick={() => { onSave(draft); setDirty(false) }} disabled={!dirty} className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors">Save</button>
      </div>
      <textarea value={draft} onChange={e => { setDraft(e.target.value); setDirty(true) }} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 h-72 resize-y leading-relaxed" placeholder={placeholder} />
    </div>
  )
}

function ListEditor({ title, items, columns, onChange, empty }) {
  const add = () => { const blank = { id: uid() }; columns.forEach(c => { blank[c[0]] = '' }); onChange([...items, blank]) }
  const upd = (id, key, val) => onChange(items.map(x => x.id === id ? { ...x, [key]: val } : x))
  const del = (id) => onChange(items.filter(x => x.id !== id))
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-slate-500">{empty}</p>}
      {items.map(it => (
        <div key={it.id} className="bg-navy-800 border border-navy-700/50 rounded-lg p-3 flex flex-wrap items-start gap-3">
          {columns.map(([key, label, ph, kind]) => (
            <div key={key} className={key === columns[0][0] ? 'w-48' : 'flex-1 min-w-[200px]'}>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</label>
              <input value={it[key] || ''} onChange={e => upd(it.id, key, e.target.value)} placeholder={ph} className="w-full bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
              {kind === 'link' && it[key] && <a href={it[key]} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 hover:underline break-all">Open</a>}
            </div>
          ))}
          <button onClick={() => del(it.id)} className="text-xs text-slate-500 hover:text-red-400 mt-5">Remove</button>
        </div>
      ))}
      <button onClick={add} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors">+ Add {title.replace(/s$/, '')}</button>
    </div>
  )
}

// Features grouped into sections by their library category (manual adds -> Custom).
function FeaturesSectioned({ items, onChange }) {
  const list = items || []
  const upd = (id, key, val) => onChange(list.map((x) => (x.id === id ? { ...x, [key]: val } : x)))
  const del = (id) => onChange(list.filter((x) => x.id !== id))
  const addCustom = () => onChange([...list, { id: uid(), name: '', detail: '' }])
  const order = []
  const byCat = {}
  list.forEach((it) => { const c = it.category || 'Custom'; if (!byCat[c]) { byCat[c] = []; order.push(c) } byCat[c].push(it) })
  return (
    <div className="space-y-5">
      {list.length === 0 && <p className="text-sm text-slate-500">No features documented yet. Add from the library above, or add one manually.</p>}
      {order.map((cat) => (
        <div key={cat}>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{cat}<span className="ml-2 text-slate-600">{byCat[cat].length}</span></p>
          <div className="space-y-2">
            {byCat[cat].map((it) => (
              <div key={it.id} className="bg-navy-800 border border-navy-700/50 rounded-lg p-3 flex flex-wrap items-start gap-3">
                <div className="w-48">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Feature</label>
                  <input value={it.name || ''} onChange={(e) => upd(it.id, 'name', e.target.value)} placeholder="e.g. Dispatch Board" className="w-full bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Detail</label>
                  <input value={it.detail || ''} onChange={(e) => upd(it.id, 'detail', e.target.value)} placeholder="What it does" className="w-full bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
                </div>
                <button onClick={() => del(it.id)} className="text-xs text-slate-500 hover:text-red-400 mt-5">Remove</button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={addCustom} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors">+ Add Feature</button>
    </div>
  )
}

// Design tab: color theme, typography/style, layout notes, reference links.
function DesignFields({ ws, onSave }) {
  const w = ws || {}
  const d = w.design || {}
  const colors = d.colors || {}
  const setD = (patch) => onSave({ ...w, design: { ...d, ...patch } })
  const setColor = (k, v) => setD({ colors: { ...colors, [k]: v } })
  const patchWs = (key, value) => onSave({ ...w, [key]: value })
  const COLORS = [['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'], ['neutral', 'Neutral'], ['background', 'Background']]
  return (
    <div className="space-y-6">
      <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Color Theme</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {COLORS.map(([k, label]) => (
            <div key={k} className="bg-navy-900 border border-navy-700/50 rounded-lg p-3">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={colors[k] || '#0ea5e9'} onChange={(e) => setColor(k, e.target.value)} className="h-7 w-7 shrink-0 rounded border border-navy-700 bg-transparent cursor-pointer p-0" />
                <input value={colors[k] || ''} onChange={(e) => setColor(k, e.target.value)} placeholder="#000000" className="w-full min-w-0 bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-600" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Typography & Style</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FieldCell label="Heading Font" type="text" value={d.heading_font} placeholder="e.g. Bebas Neue" onCommit={(v) => setD({ heading_font: v })} />
          <FieldCell label="Body Font" type="text" value={d.body_font} placeholder="e.g. DM Sans" onCommit={(v) => setD({ body_font: v })} />
          <FieldCell label="Style / Vibe" type="text" value={d.style} placeholder="e.g. Modern, minimal, bold" onCommit={(v) => setD({ style: v })} />
        </div>
      </div>
      <Narrative title="Layout & Screens" value={d.layout} onSave={(v) => setD({ layout: v })} placeholder="Page/screen layouts, navigation structure, key components, responsive behavior..." />
      <ListEditor title="Design References" items={d.references || []} columns={[['label', 'Reference', 'e.g. Figma mockups'], ['url', 'Link / URL', 'https://...', 'link']]} onChange={(v) => setD({ references: v })} empty="No design references linked yet." />
    </div>
  )
}

function TimelineEditor({ ws, onSave }) {
  const timeline = ws.timeline || []
  const patch = (next) => onSave({ ...ws, timeline: next })
  return (
    <div className="space-y-3">
      {timeline.length === 0 && <p className="text-sm text-slate-500">No timeline entries yet.</p>}
      {timeline.map(t => (
        <div key={t.id} className="bg-navy-800 border border-navy-700/50 rounded-lg p-3 flex flex-wrap items-center gap-3">
          <input value={t.phase || ''} onChange={e => patch(timeline.map(x => x.id === t.id ? { ...x, phase: e.target.value } : x))} placeholder="Phase / milestone" className="flex-1 min-w-[180px] bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
          <input type="date" value={t.target || ''} onChange={e => patch(timeline.map(x => x.id === t.id ? { ...x, target: e.target.value } : x))} className="bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
          <button onClick={() => { const order = ['planned', 'active', 'done']; const next = order[(order.indexOf(t.status || 'planned') + 1) % 3]; patch(timeline.map(x => x.id === t.id ? { ...x, status: next } : x)) }} className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${TL_STATUS[t.status || 'planned']}`}>{t.status || 'planned'}</button>
          <button onClick={() => patch(timeline.filter(x => x.id !== t.id))} className="text-xs text-slate-500 hover:text-red-400">Remove</button>
        </div>
      ))}
      <button onClick={() => patch([...timeline, { id: uid(), phase: '', target: '', status: 'planned' }])} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors">+ Add Timeline Entry</button>
    </div>
  )
}

function CostsEditor({ ws, onSave }) {
  const costs = ws.costs || { hourly_rate: 0, line_items: [], time_entries: [] }
  const lineItems = costs.line_items || []
  const timeEntries = costs.time_entries || []
  const rate = Number(costs.hourly_rate || 0)
  const totalHours = timeEntries.reduce((s, e) => s + Number(e.hours || 0), 0)
  const laborCost = totalHours * rate
  const lineTotal = lineItems.reduce((s, l) => s + Number(l.amount || 0), 0)
  const grandTotal = laborCost + lineTotal
  const saveCosts = (next) => onSave({ ...ws, costs: next })
  const updEntry = (eid, key, val) => saveCosts({ ...costs, time_entries: timeEntries.map(x => x.id === eid ? { ...x, [key]: val } : x) })
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Logged Hours" value={totalHours.toLocaleString()} />
        <Stat label="Labor Cost" value={money(laborCost)} accent="text-sky-300" />
        <Stat label="Other Costs" value={money(lineTotal)} />
        <Stat label="Total" value={money(grandTotal)} accent="text-green-400" />
      </div>

      <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-slate-400">Hourly rate</label>
          <span className="text-slate-500">$</span>
          <input type="number" min="0" step="1" value={costs.hourly_rate || ''} onChange={e => saveCosts({ ...costs, hourly_rate: e.target.value === '' ? 0 : Number(e.target.value) })} className="w-28 bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" placeholder="0" />
          <span className="text-xs text-slate-500">/hr</span>
        </div>

        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Time Tracker</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-navy-700/50">{['Date', 'Who', 'Description', 'Hours', 'Cost', ''].map(h => <th key={h} className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {timeEntries.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-sm text-slate-500 text-center">No time logged yet.</td></tr>}
              {timeEntries.map(e => (
                <tr key={e.id} className="border-b border-navy-700/30 last:border-0">
                  <td className="px-2 py-1.5"><input type="date" value={e.date || ''} onChange={ev => updEntry(e.id, 'date', ev.target.value)} className="bg-navy-900 border border-navy-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-sky-500" /></td>
                  <td className="px-2 py-1.5"><input value={e.who || ''} onChange={ev => updEntry(e.id, 'who', ev.target.value)} placeholder="Name" className="w-24 bg-navy-900 border border-navy-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-sky-500" /></td>
                  <td className="px-2 py-1.5"><input value={e.desc || ''} onChange={ev => updEntry(e.id, 'desc', ev.target.value)} placeholder="Worked on..." className="w-full min-w-[160px] bg-navy-900 border border-navy-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-sky-500" /></td>
                  <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" value={e.hours ?? ''} onChange={ev => updEntry(e.id, 'hours', ev.target.value === '' ? 0 : Number(ev.target.value))} className="w-16 bg-navy-900 border border-navy-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-sky-500" /></td>
                  <td className="px-2 py-1.5 text-xs text-slate-300">{money(Number(e.hours || 0) * rate)}</td>
                  <td className="px-2 py-1.5 text-right"><button onClick={() => saveCosts({ ...costs, time_entries: timeEntries.filter(x => x.id !== e.id) })} className="text-xs text-slate-500 hover:text-red-400">x</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => saveCosts({ ...costs, time_entries: [...timeEntries, { id: uid(), date: new Date().toISOString().slice(0, 10), who: '', desc: '', hours: 0 }] })} className="mt-3 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium transition-colors">+ Log Time</button>
      </div>

      <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Other Costs</p>
        {lineItems.length === 0 && <p className="text-sm text-slate-500 mb-2">No other costs added.</p>}
        <div className="space-y-2">
          {lineItems.map(l => (
            <div key={l.id} className="flex items-center gap-3">
              <input value={l.label || ''} onChange={e => saveCosts({ ...costs, line_items: lineItems.map(x => x.id === l.id ? { ...x, label: e.target.value } : x) })} placeholder="e.g. Domain, API, contractor" className="flex-1 bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
              <span className="text-slate-500">$</span>
              <input type="number" min="0" step="1" value={l.amount ?? ''} onChange={e => saveCosts({ ...costs, line_items: lineItems.map(x => x.id === l.id ? { ...x, amount: e.target.value === '' ? 0 : Number(e.target.value) } : x) })} className="w-28 bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" placeholder="0" />
              <button onClick={() => saveCosts({ ...costs, line_items: lineItems.filter(x => x.id !== l.id) })} className="text-xs text-slate-500 hover:text-red-400">x</button>
            </div>
          ))}
        </div>
        <button onClick={() => saveCosts({ ...costs, line_items: [...lineItems, { id: uid(), label: '', amount: 0 }] })} className="mt-3 px-3 py-1.5 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-xs font-medium transition-colors">+ Add Cost</button>
      </div>
    </div>
  )
}

function TasksEditor({ ws, onSave }) {
  const tasks = ws.tasks || []
  const patch = (next) => onSave({ ...ws, tasks: next })
  return (
    <div className="space-y-2">
      {tasks.length === 0 && <p className="text-sm text-slate-500">No tasks yet.</p>}
      {tasks.map(t => (
        <div key={t.id} className="flex items-center gap-3 bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2.5">
          <button onClick={() => patch(tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${t.done ? 'bg-green-500 border-green-500 text-white' : 'border-slate-600 text-transparent'}`}>v</button>
          <input value={t.title || ''} onChange={e => patch(tasks.map(x => x.id === t.id ? { ...x, title: e.target.value } : x))} className={`flex-1 bg-transparent text-sm focus:outline-none ${t.done ? 'text-slate-500 line-through' : 'text-white'}`} placeholder="Task..." />
          <button onClick={() => patch(tasks.filter(x => x.id !== t.id))} className="text-xs text-slate-500 hover:text-red-400">x</button>
        </div>
      ))}
      <button onClick={() => patch([...tasks, { id: uid(), title: '', done: false }])} className="mt-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors">+ Add Task</button>
    </div>
  )
}

export function Stat({ label, value, accent }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent || 'text-white'}`}>{value}</p>
    </div>
  )
}
