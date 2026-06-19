import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_COLORS = {
  planning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  completed: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  archived: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}
const MS_STATUS_COLORS = {
  pending: 'border-slate-600 bg-navy-900', in_progress: 'border-sky-500 bg-sky-500/10',
  completed: 'border-green-500 bg-green-500/10', blocked: 'border-red-500 bg-red-500/10',
}
const MS_STATUS_ICONS = { pending: '○', in_progress: '◐', completed: '●', blocked: '✕' }
const TL_STATUS = { planned: 'bg-slate-500/15 text-slate-300', active: 'bg-sky-500/15 text-sky-300', done: 'bg-green-500/15 text-green-300' }

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'details', label: 'Project Details' },
  { key: 'features', label: 'Features' },
  { key: 'scope', label: 'Scope' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'plan', label: 'Implementation Plan' },
  { key: 'security', label: 'Security' },
  { key: 'costs', label: 'Costs' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'documents', label: 'Documents' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasks', label: 'Tasks' },
]

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))
const money = (v) => '$' + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function InHouseBuildDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [build, setBuild] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [ws, setWs] = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [wsSaving, setWsSaving] = useState(false)
  const [newMilestone, setNewMilestone] = useState('')
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => { fetchBuild() }, [id])

  async function fetchBuild() {
    try {
      const [buildRes, msRes] = await Promise.all([
        supabase.from('inhouse_builds').select('*').eq('id', id).single(),
        supabase.from('inhouse_build_milestones').select('*').eq('build_id', id).order('sort_order', { ascending: true }),
      ])
      if (buildRes.error) throw buildRes.error
      setBuild(buildRes.data)
      setForm(buildRes.data)
      setWs(buildRes.data.workspace || {})
      setMilestones(msRes.data || [])
    } catch (err) {
      console.error('Error fetching build:', err)
    } finally {
      setLoading(false)
    }
  }

  async function saveWs(next) {
    setWs(next)
    setWsSaving(true)
    try {
      const { error } = await supabase.from('inhouse_builds').update({ workspace: next, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    } catch (err) { console.error('Error saving workspace:', err) } finally { setWsSaving(false) }
  }
  const patchWs = (key, value) => saveWs({ ...ws, [key]: value })

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase.from('inhouse_builds').update({
        name: form.name, codename: form.codename, description: form.description, status: form.status,
        priority: form.priority, phase: form.phase, progress: parseInt(form.progress) || 0,
        repo_url: form.repo_url, live_url: form.live_url, notes: form.notes, updated_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      setBuild({ ...build, ...form })
      setEditing(false)
    } catch (err) { console.error('Error saving:', err) } finally { setSaving(false) }
  }

  async function handleAddMilestone() {
    if (!newMilestone.trim()) return
    setAddingMilestone(true)
    try {
      const { error } = await supabase.from('inhouse_build_milestones').insert({ build_id: id, name: newMilestone, sort_order: milestones.length + 1 })
      if (error) throw error
      setNewMilestone('')
      fetchBuild()
    } catch (err) { console.error('Error adding milestone:', err) } finally { setAddingMilestone(false) }
  }

  async function toggleMilestoneStatus(ms) {
    const next = ms.status === 'completed' ? 'pending' : ms.status === 'pending' ? 'in_progress' : ms.status === 'in_progress' ? 'completed' : 'pending'
    try {
      await supabase.from('inhouse_build_milestones').update({ status: next, completed_at: next === 'completed' ? new Date().toISOString() : null }).eq('id', ms.id)
      const updatedMs = milestones.map(m => m.id === ms.id ? { ...m, status: next } : m)
      const completed = updatedMs.filter(m => m.status === 'completed').length
      const total = updatedMs.length
      const pct = total > 0 ? Math.round((completed / total) * 100) : (build.progress || 0)
      await supabase.from('inhouse_builds').update({ progress: pct, updated_at: new Date().toISOString() }).eq('id', id)
      fetchBuild()
    } catch (err) { console.error('Error updating milestone:', err) }
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!build) return <div className="p-6 text-red-400">Build not found</div>

  const completedMs = milestones.filter(m => m.status === 'completed').length
  const totalMs = milestones.length

  // workspace-backed collections
  const features = ws.features || []
  const timeline = ws.timeline || []
  const documents = ws.documents || []
  const tasks = ws.tasks || []
  const costs = ws.costs || { hourly_rate: 0, line_items: [], time_entries: [] }
  const lineItems = costs.line_items || []
  const timeEntries = costs.time_entries || []
  const rate = Number(costs.hourly_rate || 0)
  const totalHours = timeEntries.reduce((s, e) => s + Number(e.hours || 0), 0)
  const laborCost = totalHours * rate
  const lineTotal = lineItems.reduce((s, l) => s + Number(l.amount || 0), 0)
  const grandTotal = laborCost + lineTotal

  const tabBadge = (key) => {
    if (key === 'milestones' && totalMs > 0) return `${completedMs}/${totalMs}`
    if (key === 'features' && features.length) return features.length
    if (key === 'tasks' && tasks.length) return `${tasks.filter(t => t.done).length}/${tasks.length}`
    if (key === 'documents' && documents.length) return documents.length
    if (key === 'timeline' && timeline.length) return timeline.length
    if (key === 'costs' && grandTotal) return money(grandTotal)
    return null
  }

  return (
    <div className="p-6">
      <button onClick={() => navigate('/admin/builds')} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors">← Back to Builds</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{build.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLORS[build.status]}`}>{build.status}</span>
            {wsSaving && <span className="text-[10px] text-slate-500">saving…</span>}
          </div>
          {build.codename && <p className="text-slate-500 text-sm font-mono mt-1">/{build.codename}</p>}
        </div>
        <button onClick={() => editing ? handleSave() : setEditing(true)} disabled={saving} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Edit'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-navy-700/50 overflow-x-auto">
        {TABS.map(t => {
          const badge = tabBadge(t.key)
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.key ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-white'}`}>
              {t.label}{badge != null && <span className="text-xs ml-1.5 text-slate-500">{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Overall Progress</span>
              <span className="text-sm font-mono text-white">{editing ? form.progress : build.progress}%</span>
            </div>
            {editing ? (
              <input type="range" min="0" max="100" value={form.progress || 0} onChange={e => setForm({ ...form, progress: e.target.value })} className="w-full accent-sky-500" />
            ) : (
              <div className="w-full bg-navy-900 rounded-full h-3"><div className="bg-sky-500 h-3 rounded-full transition-all" style={{ width: `${build.progress || 0}%` }} /></div>
            )}
            {build.phase && <p className="text-xs text-slate-500 mt-2">Current Phase: {build.phase}</p>}
          </div>
          {(() => {
            const d = ws.details || {}
            const mrr = Number(d.mrr || 0)
            const arr = Number(d.arr) > 0 ? Number(d.arr) : mrr * 12
            const tb = Number(d.build_budget || 0) + Number(d.marketing_budget || 0)
            const show = d.owner || d.assigned_to || mrr || arr || tb || d.stage
            if (!show) return null
            return (
              <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-400">Business Snapshot</p>
                  <button onClick={() => setActiveTab('details')} className="text-xs text-sky-400 hover:underline">Edit in Project Details</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="MRR" value={money(mrr)} accent="text-sky-300" />
                  <Stat label="ARR" value={money(arr)} accent="text-green-400" />
                  <Stat label="Total Budget" value={money(tb)} />
                  <Stat label="Owner" value={d.owner || '-'} />
                </div>
                {(d.assigned_to || d.stage || d.pricing_model) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {d.assigned_to && <span className="text-xs px-2.5 py-1 bg-navy-900 text-slate-300 rounded-lg border border-navy-700/50">Assigned: {d.assigned_to}</span>}
                    {d.stage && <span className="text-xs px-2.5 py-1 bg-navy-900 text-slate-300 rounded-lg border border-navy-700/50">Stage: {d.stage}</span>}
                    {d.pricing_model && <span className="text-xs px-2.5 py-1 bg-navy-900 text-slate-300 rounded-lg border border-navy-700/50">{d.pricing_model}</span>}
                  </div>
                )}
              </div>
            )
          })()}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Description" editing={editing} value={editing ? form.description : build.description} onChange={v => setForm({ ...form, description: v })} multiline />
            <div className="space-y-4">
              <Field label="Status" editing={editing} value={editing ? form.status : build.status} onChange={v => setForm({ ...form, status: v })} type="select" options={['planning', 'active', 'paused', 'completed', 'archived']} />
              <Field label="Priority" editing={editing} value={editing ? form.priority : build.priority} onChange={v => setForm({ ...form, priority: v })} type="select" options={['critical', 'high', 'medium', 'low']} />
              <Field label="Phase" editing={editing} value={editing ? form.phase : build.phase} onChange={v => setForm({ ...form, phase: v })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Repo URL" editing={editing} value={editing ? form.repo_url : build.repo_url} onChange={v => setForm({ ...form, repo_url: v })} link />
            <Field label="Live URL" editing={editing} value={editing ? form.live_url : build.live_url} onChange={v => setForm({ ...form, live_url: v })} link />
          </div>
          {build.tech_stack?.length > 0 && (
            <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
              <p className="text-sm text-slate-400 mb-3">Tech Stack</p>
              <div className="flex flex-wrap gap-2">{build.tech_stack.map(tech => <span key={tech} className="text-xs px-2.5 py-1 bg-navy-900 text-slate-300 rounded-lg border border-navy-700/50">{tech}</span>)}</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'details' && (
        <div className="space-y-6">
          <DetailsFields ws={ws} onSave={saveWs} />
          <Narrative title="Project Overview" value={ws.project_details} onSave={v => patchWs('project_details', v)} placeholder="What is this project, who is it for, the problem it solves, key decisions..." />
        </div>
      )}
      {activeTab === 'scope' && <Narrative title="Scope of All Features" value={ws.scope} onSave={v => patchWs('scope', v)} placeholder="Everything in scope — and explicitly what is out of scope…" />}
      {activeTab === 'plan' && <Narrative title="Implementation Plan" value={ws.implementation_plan} onSave={v => patchWs('implementation_plan', v)} placeholder="Build sequence, waves, architecture approach, dependencies…" />}
      {activeTab === 'security' && <Narrative title="Security" value={ws.security} onSave={v => patchWs('security', v)} placeholder="Auth model, RLS, secrets handling, data protection, threat notes…" />}

      {/* Features */}
      {activeTab === 'features' && (
        <ListEditor
          title="Features" items={features} columns={[['name', 'Feature', 'e.g. Dispatch Board'], ['detail', 'Detail', 'What it does']]}
          onChange={v => patchWs('features', v)} empty="No features documented yet."
        />
      )}

      {/* Documents */}
      {activeTab === 'documents' && (
        <ListEditor
          title="Documents" items={documents} columns={[['name', 'Name', 'Document name'], ['url', 'Link / URL', 'https://…', 'link']]}
          onChange={v => patchWs('documents', v)} empty="No documents linked yet."
        />
      )}

      {/* Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          {timeline.length === 0 && <p className="text-sm text-slate-500">No timeline entries yet.</p>}
          {timeline.map((t, i) => (
            <div key={t.id} className="bg-navy-800 border border-navy-700/50 rounded-lg p-3 flex flex-wrap items-center gap-3">
              <input value={t.phase || ''} onChange={e => patchWs('timeline', timeline.map(x => x.id === t.id ? { ...x, phase: e.target.value } : x))} placeholder="Phase / milestone" className="flex-1 min-w-[180px] bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
              <input type="date" value={t.target || ''} onChange={e => patchWs('timeline', timeline.map(x => x.id === t.id ? { ...x, target: e.target.value } : x))} className="bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
              <button onClick={() => { const order = ['planned', 'active', 'done']; const next = order[(order.indexOf(t.status || 'planned') + 1) % 3]; patchWs('timeline', timeline.map(x => x.id === t.id ? { ...x, status: next } : x)) }} className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${TL_STATUS[t.status || 'planned']}`}>{t.status || 'planned'}</button>
              <button onClick={() => patchWs('timeline', timeline.filter(x => x.id !== t.id))} className="text-xs text-slate-500 hover:text-red-400">Remove</button>
            </div>
          ))}
          <button onClick={() => patchWs('timeline', [...timeline, { id: uid(), phase: '', target: '', status: 'planned' }])} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors">+ Add Timeline Entry</button>
        </div>
      )}

      {/* Costs + time tracker */}
      {activeTab === 'costs' && (
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
              <input type="number" min="0" step="1" value={costs.hourly_rate || ''} onChange={e => saveWs({ ...ws, costs: { ...costs, hourly_rate: e.target.value === '' ? 0 : Number(e.target.value) } })} className="w-28 bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" placeholder="0" />
              <span className="text-xs text-slate-500">/hr</span>
            </div>

            {/* Time tracker */}
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
                      <td className="px-2 py-1.5"><input value={e.desc || ''} onChange={ev => updEntry(e.id, 'desc', ev.target.value)} placeholder="Worked on…" className="w-full min-w-[160px] bg-navy-900 border border-navy-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-sky-500" /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" value={e.hours ?? ''} onChange={ev => updEntry(e.id, 'hours', ev.target.value === '' ? 0 : Number(ev.target.value))} className="w-16 bg-navy-900 border border-navy-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-sky-500" /></td>
                      <td className="px-2 py-1.5 text-xs text-slate-300">{money(Number(e.hours || 0) * rate)}</td>
                      <td className="px-2 py-1.5 text-right"><button onClick={() => saveWs({ ...ws, costs: { ...costs, time_entries: timeEntries.filter(x => x.id !== e.id) } })} className="text-xs text-slate-500 hover:text-red-400">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => saveWs({ ...ws, costs: { ...costs, time_entries: [...timeEntries, { id: uid(), date: new Date().toISOString().slice(0, 10), who: '', desc: '', hours: 0 }] } })} className="mt-3 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium transition-colors">+ Log Time</button>
          </div>

          {/* Other line items */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Other Costs</p>
            {lineItems.length === 0 && <p className="text-sm text-slate-500 mb-2">No other costs added.</p>}
            <div className="space-y-2">
              {lineItems.map(l => (
                <div key={l.id} className="flex items-center gap-3">
                  <input value={l.label || ''} onChange={e => saveWs({ ...ws, costs: { ...costs, line_items: lineItems.map(x => x.id === l.id ? { ...x, label: e.target.value } : x) } })} placeholder="e.g. Domain, API, contractor" className="flex-1 bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
                  <span className="text-slate-500">$</span>
                  <input type="number" min="0" step="1" value={l.amount ?? ''} onChange={e => saveWs({ ...ws, costs: { ...costs, line_items: lineItems.map(x => x.id === l.id ? { ...x, amount: e.target.value === '' ? 0 : Number(e.target.value) } : x) } })} className="w-28 bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" placeholder="0" />
                  <button onClick={() => saveWs({ ...ws, costs: { ...costs, line_items: lineItems.filter(x => x.id !== l.id) } })} className="text-xs text-slate-500 hover:text-red-400">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => saveWs({ ...ws, costs: { ...costs, line_items: [...lineItems, { id: uid(), label: '', amount: 0 }] } })} className="mt-3 px-3 py-1.5 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-xs font-medium transition-colors">+ Add Cost</button>
          </div>
        </div>
      )}

      {/* Milestones */}
      {activeTab === 'milestones' && (
        <div className="space-y-3">
          {milestones.map(ms => (
            <div key={ms.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${MS_STATUS_COLORS[ms.status]}`} onClick={() => toggleMilestoneStatus(ms)}>
              <span className={`text-lg ${ms.status === 'completed' ? 'text-green-400' : ms.status === 'in_progress' ? 'text-sky-400' : ms.status === 'blocked' ? 'text-red-400' : 'text-slate-500'}`}>{MS_STATUS_ICONS[ms.status]}</span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${ms.status === 'completed' ? 'text-slate-400 line-through' : 'text-white'}`}>{ms.name}</p>
                {ms.description && <p className="text-xs text-slate-500 mt-0.5">{ms.description}</p>}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">{ms.status.replace('_', ' ')}</span>
              {ms.completed_at && <span className="text-[10px] text-slate-600">{new Date(ms.completed_at).toLocaleDateString()}</span>}
            </div>
          ))}
          <div className="flex gap-2 mt-4">
            <input type="text" value={newMilestone} onChange={e => setNewMilestone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMilestone()} className="flex-1 bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500" placeholder="Add a milestone..." />
            <button onClick={handleAddMilestone} disabled={addingMilestone || !newMilestone.trim()} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">Add</button>
          </div>
        </div>
      )}

      {/* Notes */}
      {activeTab === 'notes' && (
        <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
          {editing ? (
            <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 h-64 resize-none font-mono" placeholder="Build notes, decisions, context..." />
          ) : (
            <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{build.notes || <span className="text-slate-500 italic">No notes yet. Click Edit to add notes.</span>}</div>
          )}
        </div>
      )}

      {/* Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-sm text-slate-500">No tasks yet.</p>}
          {tasks.map(t => (
            <div key={t.id} className="flex items-center gap-3 bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2.5">
              <button onClick={() => patchWs('tasks', tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${t.done ? 'bg-green-500 border-green-500 text-white' : 'border-slate-600 text-transparent'}`}>✓</button>
              <input value={t.title || ''} onChange={e => patchWs('tasks', tasks.map(x => x.id === t.id ? { ...x, title: e.target.value } : x))} className={`flex-1 bg-transparent text-sm focus:outline-none ${t.done ? 'text-slate-500 line-through' : 'text-white'}`} placeholder="Task…" />
              <button onClick={() => patchWs('tasks', tasks.filter(x => x.id !== t.id))} className="text-xs text-slate-500 hover:text-red-400">✕</button>
            </div>
          ))}
          <button onClick={() => patchWs('tasks', [...tasks, { id: uid(), title: '', done: false }])} className="mt-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors">+ Add Task</button>
        </div>
      )}
    </div>
  )

  function updEntry(eid, key, val) {
    saveWs({ ...ws, costs: { ...costs, time_entries: timeEntries.map(x => x.id === eid ? { ...x, [key]: val } : x) } })
  }
}

const DETAIL_SECTIONS = [
  { title: 'Ownership', fields: [['owner', 'Project Owner', 'text'], ['assigned_to', 'Assigned To', 'text'], ['stage', 'Stage', 'text'], ['start_date', 'Start Date', 'date'], ['target_launch', 'Target Launch', 'date']] },
  { title: 'Recurring Revenue', fields: [['mrr', 'MRR (monthly recurring)', 'money'], ['arr', 'ARR (annual recurring)', 'money'], ['pricing_model', 'Pricing Model', 'text'], ['active_customers', 'Active Customers', 'number']] },
  { title: 'Projections', fields: [['revenue_projection', 'Revenue Projection (12mo)', 'money'], ['buyout_prediction', 'Buyout / Exit Prediction', 'money'], ['sale_price', 'Sale Price (if sold)', 'money'], ['profit_margin', 'Profit Margin', 'percent'], ['break_even', 'Break-even (note)', 'text']] },
  { title: 'Budgets', fields: [['build_budget', 'Build Budget', 'money'], ['marketing_budget', 'Marketing Budget', 'money']] },
]

function DetailsFields({ ws, onSave }) {
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="MRR" value={money(mrr)} accent="text-sky-300" />
        <Stat label="ARR (effective)" value={money(effectiveArr)} accent="text-green-400" />
        <Stat label="Total Budget" value={money(totalBudget)} />
        <Stat label="Est. Break-even" value={breakEvenMo ? `${breakEvenMo} mo` : '—'} />
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
          <input value={v} onChange={e => setV(numeric ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)} onBlur={() => onCommit(numeric ? (v === '' ? '' : Number(v)) : v)} inputMode={numeric ? 'decimal' : undefined} placeholder={placeholder || (numeric ? '0' : '—')} className="w-full bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-600" />
        )}
        {isPct && <span className="text-slate-500 text-sm">%</span>}
      </div>
    </div>
  )
}

function Narrative({ title, value, onSave, placeholder }) {
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
              {kind === 'link' && it[key] && <a href={it[key]} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 hover:underline break-all">Open ↗</a>}
            </div>
          ))}
          <button onClick={() => del(it.id)} className="text-xs text-slate-500 hover:text-red-400 mt-5">Remove</button>
        </div>
      ))}
      <button onClick={add} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors">+ Add {title.replace(/s$/, '')}</button>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent || 'text-white'}`}>{value}</p>
    </div>
  )
}

function Field({ label, editing, value, onChange, multiline, type, options, link }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
      {editing ? (
        type === 'select' ? (
          <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 capitalize">
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : multiline ? (
          <textarea value={value || ''} onChange={e => onChange(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 h-24 resize-none" />
        ) : (
          <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500" />
        )
      ) : (
        link && value ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-400 hover:underline break-all">{value}</a>
        ) : (
          <p className="text-sm text-slate-300">{value || <span className="text-slate-600">—</span>}</p>
        )
      )}
    </div>
  )
}
