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
  pending: 'border-slate-600 bg-navy-900',
  in_progress: 'border-sky-500 bg-sky-500/10',
  completed: 'border-green-500 bg-green-500/10',
  blocked: 'border-red-500 bg-red-500/10',
}

const MS_STATUS_ICONS = {
  pending: '○',
  in_progress: '◐',
  completed: '●',
  blocked: '✕',
}

export default function InHouseBuildDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [build, setBuild] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
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
      setMilestones(msRes.data || [])
    } catch (err) {
      console.error('Error fetching build:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('inhouse_builds')
        .update({
          name: form.name,
          codename: form.codename,
          description: form.description,
          status: form.status,
          priority: form.priority,
          phase: form.phase,
          progress: parseInt(form.progress) || 0,
          repo_url: form.repo_url,
          live_url: form.live_url,
          notes: form.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
      setBuild({ ...build, ...form })
      setEditing(false)
    } catch (err) {
      console.error('Error saving:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMilestone() {
    if (!newMilestone.trim()) return
    setAddingMilestone(true)
    try {
      const { error } = await supabase
        .from('inhouse_build_milestones')
        .insert({
          build_id: id,
          name: newMilestone,
          sort_order: milestones.length + 1,
        })
      if (error) throw error
      setNewMilestone('')
      fetchBuild()
    } catch (err) {
      console.error('Error adding milestone:', err)
    } finally {
      setAddingMilestone(false)
    }
  }

  async function toggleMilestoneStatus(ms) {
    const next = ms.status === 'completed' ? 'pending' : ms.status === 'pending' ? 'in_progress' : ms.status === 'in_progress' ? 'completed' : 'pending'
    try {
      const { error } = await supabase
        .from('inhouse_build_milestones')
        .update({
          status: next,
          completed_at: next === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', ms.id)
      if (error) throw error
      fetchBuild()
    } catch (err) {
      console.error('Error updating milestone:', err)
    }
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!build) return <div className="p-6 text-red-400">Build not found</div>

  const completedMs = milestones.filter(m => m.status === 'completed').length
  const totalMs = milestones.length

  return (
    <div className="p-6">
      {/* Back + Header */}
      <button onClick={() => navigate('/admin/builds')} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors">
        ← Back to Builds
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{build.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLORS[build.status]}`}>
              {build.status}
            </span>
          </div>
          {build.codename && <p className="text-slate-500 text-sm font-mono mt-1">/{build.codename}</p>}
        </div>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Edit'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-navy-700/50">
        {['overview', 'milestones', 'notes'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab} {tab === 'milestones' && totalMs > 0 && <span className="text-xs ml-1 text-slate-500">{completedMs}/{totalMs}</span>}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Progress */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Overall Progress</span>
              <span className="text-sm font-mono text-white">{editing ? form.progress : build.progress}%</span>
            </div>
            {editing ? (
              <input
                type="range" min="0" max="100" value={form.progress || 0}
                onChange={e => setForm({ ...form, progress: e.target.value })}
                className="w-full accent-sky-500"
              />
            ) : (
              <div className="w-full bg-navy-900 rounded-full h-3">
                <div className="bg-sky-500 h-3 rounded-full transition-all" style={{ width: `${build.progress || 0}%` }} />
              </div>
            )}
            {build.phase && <p className="text-xs text-slate-500 mt-2">Current Phase: {build.phase}</p>}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Description" editing={editing} value={editing ? form.description : build.description} onChange={v => setForm({ ...form, description: v })} multiline />
            <div className="space-y-4">
              <Field label="Status" editing={editing} value={editing ? form.status : build.status} onChange={v => setForm({ ...form, status: v })} type="select" options={['planning', 'active', 'paused', 'completed', 'archived']} />
              <Field label="Priority" editing={editing} value={editing ? form.priority : build.priority} onChange={v => setForm({ ...form, priority: v })} type="select" options={['critical', 'high', 'medium', 'low']} />
              <Field label="Phase" editing={editing} value={editing ? form.phase : build.phase} onChange={v => setForm({ ...form, phase: v })} />
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Repo URL" editing={editing} value={editing ? form.repo_url : build.repo_url} onChange={v => setForm({ ...form, repo_url: v })} link />
            <Field label="Live URL" editing={editing} value={editing ? form.live_url : build.live_url} onChange={v => setForm({ ...form, live_url: v })} link />
          </div>

          {/* Tech Stack */}
          {build.tech_stack?.length > 0 && (
            <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
              <p className="text-sm text-slate-400 mb-3">Tech Stack</p>
              <div className="flex flex-wrap gap-2">
                {build.tech_stack.map(tech => (
                  <span key={tech} className="text-xs px-2.5 py-1 bg-navy-900 text-slate-300 rounded-lg border border-navy-700/50">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Milestones Tab */}
      {activeTab === 'milestones' && (
        <div className="space-y-3">
          {milestones.map(ms => (
            <div
              key={ms.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${MS_STATUS_COLORS[ms.status]}`}
              onClick={() => toggleMilestoneStatus(ms)}
            >
              <span className={`text-lg ${ms.status === 'completed' ? 'text-green-400' : ms.status === 'in_progress' ? 'text-sky-400' : ms.status === 'blocked' ? 'text-red-400' : 'text-slate-500'}`}>
                {MS_STATUS_ICONS[ms.status]}
              </span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${ms.status === 'completed' ? 'text-slate-400 line-through' : 'text-white'}`}>
                  {ms.name}
                </p>
                {ms.description && <p className="text-xs text-slate-500 mt-0.5">{ms.description}</p>}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">{ms.status.replace('_', ' ')}</span>
              {ms.completed_at && (
                <span className="text-[10px] text-slate-600">{new Date(ms.completed_at).toLocaleDateString()}</span>
              )}
            </div>
          ))}

          {/* Add Milestone */}
          <div className="flex gap-2 mt-4">
            <input
              type="text" value={newMilestone}
              onChange={e => setNewMilestone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMilestone()}
              className="flex-1 bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              placeholder="Add a milestone..."
            />
            <button
              onClick={handleAddMilestone}
              disabled={addingMilestone || !newMilestone.trim()}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="bg-navy-800 border border-navy-700/50 rounded-lg p-5">
          {editing ? (
            <textarea
              value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 h-64 resize-none font-mono"
              placeholder="Build notes, decisions, context..."
            />
          ) : (
            <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {build.notes || <span className="text-slate-500 italic">No notes yet. Click Edit to add notes.</span>}
            </div>
          )}
        </div>
      )}
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
