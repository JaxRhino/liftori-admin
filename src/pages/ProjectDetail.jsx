import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import DevLab from '../components/DevLab'

const STATUSES = ['Wizard Complete', 'Brief Review', 'Design Approval', 'In Build', 'QA', 'Launched', 'On Hold', 'Cancelled']
const STATUS_COLORS = {
  'Wizard Complete': 'bg-gray-500/20 text-gray-400',
  'Brief Review': 'bg-yellow-500/20 text-yellow-400',
  'Design Approval': 'bg-purple-500/20 text-purple-400',
  'In Build': 'bg-brand-blue/20 text-brand-blue',
  'QA': 'bg-orange-500/20 text-orange-400',
  'Launched': 'bg-emerald-500/20 text-emerald-400',
  'On Hold': 'bg-gray-500/20 text-gray-500',
  'Cancelled': 'bg-red-500/20 text-red-400'
}

const PROJECT_TYPES = ['Web App', 'Mobile App', 'Business Platform']
const TIERS = ['Starter', 'Growth', 'Scale']

export default function ProjectDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [messages, setMessages] = useState([])
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [topTab, setTopTab] = useState('details')
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [newMilestone, setNewMilestone] = useState('')
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [newUpdate, setNewUpdate] = useState({ title: '', body: '', update_type: 'progress' })
  const [postingUpdate, setPostingUpdate] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [id])

  async function fetchAll() {
    try {
      const [
        { data: proj },
        { data: ms },
        { data: msgs },
        { data: upds }
      ] = await Promise.all([
        supabase.from('projects').select('*, profiles!projects_customer_id_fkey(full_name, email)').eq('id', id).single(),
        supabase.from('milestones').select('*').eq('project_id', id).order('sort_order'),
        supabase.from('messages').select('*, profiles!messages_sender_id_fkey(full_name, email)').eq('project_id', id).order('created_at', { ascending: true }),
        supabase.from('project_updates').select('*').eq('project_id', id).order('created_at', { ascending: false })
      ])
      setProject(proj)
      setMilestones(ms || [])
      setMessages(msgs || [])
      setUpdates(upds || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(newStatus) {
    const updates = { status: newStatus }
    if (newStatus === 'Launched') updates.launched_at = new Date().toISOString()
    if (newStatus === 'Design Approval') updates.approved_at = new Date().toISOString()
    const { error } = await supabase.from('projects').update(updates).eq('id', id)
    if (!error) setProject(p => ({ ...p, ...updates }))
  }

  async function updateProgress(newProgress) {
    const { error } = await supabase.from('projects').update({ progress: newProgress }).eq('id', id)
    if (!error) setProject(p => ({ ...p, progress: newProgress }))
  }

  function startEditing() {
    setEditForm({
      name: project.name || '',
      project_type: project.project_type || '',
      tier: project.tier || '',
      brief: project.brief || '',
      budget_range: project.budget_range || '',
      timeline_pref: project.timeline_pref || '',
      vibe: project.vibe || '',
      features: (project.features || []).join(', ')
    })
    setEditing(true)
  }

  async function saveEditing() {
    setSaving(true)
    try {
      const featuresArray = editForm.features
        ? editForm.features.split(',').map(f => f.trim()).filter(Boolean)
        : []
      const payload = {
        name: editForm.name,
        project_type: editForm.project_type,
        tier: editForm.tier,
        brief: editForm.brief || null,
        budget_range: editForm.budget_range || null,
        timeline_pref: editForm.timeline_pref || null,
        vibe: editForm.vibe || null,
        features: featuresArray.length > 0 ? featuresArray : null
      }
      const { error } = await supabase.from('projects').update(payload).eq('id', id)
      if (error) throw error
      setProject(p => ({ ...p, ...payload }))
      setEditing(false)
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  async function postUpdate() {
    if (!newUpdate.title.trim() || !newUpdate.body.trim()) return
    setPostingUpdate(true)
    try {
      const { data, error } = await supabase.from('project_updates').insert({
        project_id: id,
        title: newUpdate.title.trim(),
        body: newUpdate.body.trim(),
        update_type: newUpdate.update_type,
        created_by: user.id
      }).select('*').single()
      if (error) throw error
      setUpdates(prev => [data, ...prev])
      setNewUpdate({ title: '', body: '', update_type: 'progress' })
    } catch (err) {
      console.error('Post update error:', err)
    } finally {
      setPostingUpdate(false)
    }
  }

  async function deleteUpdate(updateId) {
    try {
      const { error } = await supabase.from('project_updates').delete().eq('id', updateId)
      if (error) throw error
      setUpdates(prev => prev.filter(u => u.id !== updateId))
    } catch (err) {
      console.error('Delete update error:', err)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return
    setSendingMessage(true)
    try {
      const { data, error } = await supabase.from('messages').insert({
        project_id: id,
        sender_id: user.id,
        sender_type: 'admin',
        body: newMessage.trim()
      }).select('*, profiles!messages_sender_id_fkey(full_name, email)').single()
      if (error) throw error
      setMessages(prev => [...prev, data])
      setNewMessage('')
    } catch (err) {
      console.error('Send message error:', err)
    } finally {
      setSendingMessage(false)
    }
  }

  async function addMilestone() {
    if (!newMilestone.trim()) return
    setAddingMilestone(true)
    try {
      const { data, error } = await supabase.from('milestones').insert({
        project_id: id,
        name: newMilestone.trim(),
        sort_order: milestones.length + 1
      }).select().single()
      if (error) throw error
      setMilestones(prev => [...prev, data])
      setNewMilestone('')
    } catch (err) {
      console.error('Add milestone error:', err)
    } finally {
      setAddingMilestone(false)
    }
  }

  async function toggleMilestone(msId, completed) {
    const updates = { completed: !completed }
    if (!completed) updates.completed_at = new Date().toISOString()
    else updates.completed_at = null
    const { error } = await supabase.from('milestones').update(updates).eq('id', msId)
    if (!error) {
      setMilestones(prev => prev.map(m => m.id === msId ? { ...m, ...updates } : m))
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-red-400">Project not found</p>
        <Link to="/admin/projects" className="text-brand-blue hover:underline mt-2 inline-block">Back to projects</Link>
      </div>
    )
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'milestones', label: 'Milestones', count: milestones.length },
    { key: 'messages', label: 'Messages', count: messages.length },
    { key: 'updates', label: 'Updates', count: updates.length }
  ]

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/projects" className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {project.profiles?.full_name || project.profiles?.email || 'No customer'} — {project.project_type} — {project.tier}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={project.status}
            onChange={e => updateStatus(e.target.value)}
            className={`select w-auto ${STATUS_COLORS[project.status]}`}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Top-Level Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] rounded-xl p-1 border border-white/10 w-fit">
        <button
          onClick={() => setTopTab('details')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            topTab === 'details'
              ? 'bg-brand-blue/20 text-brand-blue'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setTopTab('devlab')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            topTab === 'devlab'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          }`}
        >
          Dev Lab
        </button>
      </div>

      {topTab === 'devlab' ? (
        <DevLab project={project} />
      ) : (
      <>
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Build Progress</span>
          <span className="text-sm font-bold text-brand-blue">{project.progress}%</span>
        </div>
        <div className="w-full h-2 bg-navy-700 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-brand-blue to-brand-cyan rounded-full transition-all duration-300"
            style={{ width: `${project.progress}%` }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={project.progress}
          onChange={e => updateProgress(parseInt(e.target.value))}
          className="w-full accent-brand-blue"
        />
      </div>

      <div className="flex gap-1 mb-6 border-b border-navy-700/50 pb-px">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative ${
              activeTab === tab.key
                ? 'text-brand-blue bg-navy-800'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs text-gray-500">({tab.count})</span>
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-blue" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">Project Details</h3>
              {!editing ? (
                <button
                  onClick={startEditing}
                  className="text-xs text-brand-blue hover:text-brand-blue/80 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="text-xs text-gray-500 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditing}
                    disabled={saving}
                    className="text-xs bg-brand-blue hover:bg-brand-blue/80 text-white px-3 py-1 rounded-md transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                <EditField label="Project Name" value={editForm.name} onChange={v => setEditForm(f => ({ ...f, name: v }))} />
                <div className="flex justify-between items-center py-1.5 border-b border-navy-700/30">
                  <span className="text-xs text-gray-500">Type</span>
                  <select
                    value={editForm.project_type}
                    onChange={e => setEditForm(f => ({ ...f, project_type: e.target.value }))}
                    className="bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-blue/50"
                  >
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-navy-700/30">
                  <span className="text-xs text-gray-500">Tier</span>
                  <select
                    value={editForm.tier}
                    onChange={e => setEditForm(f => ({ ...f, tier: e.target.value }))}
                    className="bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-blue/50"
                  >
                    {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <EditField label="Budget" value={editForm.budget_range} onChange={v => setEditForm(f => ({ ...f, budget_range: v }))} />
                <EditField label="Timeline" value={editForm.timeline_pref} onChange={v => setEditForm(f => ({ ...f, timeline_pref: v }))} />
                <EditField label="Design Vibe" value={editForm.vibe} onChange={v => setEditForm(f => ({ ...f, vibe: v }))} />
              </div>
            ) : (
              <div className="space-y-3">
                <DetailRow label="Type" value={project.project_type} />
                <DetailRow label="Tier" value={project.tier} />
                <DetailRow label="Budget" value={project.budget_range} />
                <DetailRow label="Timeline" value={project.timeline_pref} />
                <DetailRow label="Design Vibe" value={project.vibe} />
                <DetailRow label="Created" value={new Date(project.created_at).toLocaleString()} />
                {project.launched_at && <DetailRow label="Launched" value={new Date(project.launched_at).toLocaleString()} />}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">Brief</h3>
              {editing && <span className="text-xs text-gray-600">Editing</span>}
            </div>
            {editing ? (
              <textarea
                className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50 min-h-[120px] resize-y"
                value={editForm.brief}
                onChange={e => setEditForm(f => ({ ...f, brief: e.target.value }))}
                placeholder="Project brief..."
              />
            ) : (
              <p className="text-sm text-white whitespace-pre-wrap">{project.brief || 'No brief yet'}</p>
            )}
          </div>

          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">Features</h3>
              {editing && <span className="text-xs text-gray-600">Comma-separated</span>}
            </div>
            {editing ? (
              <input
                type="text"
                className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
                value={editForm.features}
                onChange={e => setEditForm(f => ({ ...f, features: e.target.value }))}
                placeholder="Feature 1, Feature 2, Feature 3..."
              />
            ) : (
              project.features && project.features.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {project.features.map((f, i) => (
                    <span key={i} className="badge bg-navy-700 text-gray-300">{f}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No features defined</p>
              )
            )}
          </div>
        </div>
      )}

      {activeTab === 'milestones' && (
        <div className="card">
          <div className="space-y-2 mb-4">
            {milestones.map(ms => (
              <div key={ms.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-navy-700/30 transition-colors">
                <button
                  onClick={() => toggleMilestone(ms.id, ms.completed)}
                  className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    ms.completed
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'border-navy-500 hover:border-brand-blue'
                  }`}
                >
                  {ms.completed && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${ms.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                    {ms.name}
                  </p>
                  {ms.description && <p className="text-xs text-gray-500">{ms.description}</p>}
                </div>
                {ms.due_date && (
                  <span className="text-xs text-gray-500">{new Date(ms.due_date).toLocaleDateString()}</span>
                )}
              </div>
            ))}
            {milestones.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">No milestones yet</p>
            )}
          </div>
          <div className="flex gap-2 pt-3 border-t border-navy-700/50">
            <input
              type="text"
              className="input flex-1"
              placeholder="Add a milestone..."
              value={newMilestone}
              onChange={e => setNewMilestone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMilestone()}
            />
            <button
              onClick={addMilestone}
              disabled={addingMilestone || !newMilestone.trim()}
              className="btn-primary disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="card">
          <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md px-4 py-2.5 rounded-xl ${
                  msg.sender_type === 'admin'
                    ? 'bg-brand-blue/20 text-white'
                    : msg.sender_type === 'system'
                    ? 'bg-navy-700/50 text-gray-400 italic'
                    : 'bg-navy-700 text-white'
                }`}>
                  <p className="text-sm">{msg.body}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {msg.profiles?.full_name || msg.sender_type} — {new Date(msg.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">No messages yet. Start the conversation.</p>
            )}
          </div>
          <div className="flex gap-2 pt-3 border-t border-navy-700/50">
            <input
              type="text"
              className="input flex-1"
              placeholder="Type a message..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="btn-primary disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {activeTab === 'updates' && (
        <div className="space-y-6">
          {/* Compose Update */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Post Update to Customer</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Update title..."
                  value={newUpdate.title}
                  onChange={e => setNewUpdate(u => ({ ...u, title: e.target.value }))}
                />
                <select
                  value={newUpdate.update_type}
                  onChange={e => setNewUpdate(u => ({ ...u, update_type: e.target.value }))}
                  className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
                >
                  <option value="progress">Progress</option>
                  <option value="milestone">Milestone</option>
                  <option value="alert">Alert</option>
                  <option value="launch">Launch</option>
                  <option value="design">Design</option>
                  <option value="review">Review</option>
                </select>
              </div>
              <textarea
                className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50 min-h-[100px] resize-y"
                placeholder="Write an update for the customer... They will see this in their portal."
                value={newUpdate.body}
                onChange={e => setNewUpdate(u => ({ ...u, body: e.target.value }))}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">Visible to the customer in their portal</p>
                <button
                  onClick={postUpdate}
                  disabled={postingUpdate || !newUpdate.title.trim() || !newUpdate.body.trim()}
                  className="btn-primary disabled:opacity-50 flex items-center gap-2"
                >
                  {postingUpdate ? 'Posting...' : 'Post Update'}
                </button>
              </div>
            </div>
          </div>

          {/* Update History */}
          {updates.map(upd => (
            <div key={upd.id} className="card group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`badge ${
                    upd.update_type === 'milestone' ? 'bg-purple-500/20 text-purple-400'
                    : upd.update_type === 'alert' ? 'bg-orange-500/20 text-orange-400'
                    : upd.update_type === 'launch' ? 'bg-emerald-500/20 text-emerald-400'
                    : upd.update_type === 'design' ? 'bg-pink-500/20 text-pink-400'
                    : upd.update_type === 'review' ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-brand-blue/20 text-brand-blue'
                  }`}>
                    {upd.update_type}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(upd.created_at).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => deleteUpdate(upd.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete update"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <h3 className="text-sm font-semibold text-white">{upd.title}</h3>
              <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{upd.body}</p>
            </div>
          ))}
          {updates.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-500 text-sm">No updates posted yet</p>
              <p className="text-gray-600 text-xs mt-1">Post your first update above — the customer will see it in their portal</p>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-navy-700/30 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-white">{value || '—'}</span>
    </div>
  )
}

function EditField({ label, value, onChange }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-navy-700/30">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type="text"
        className="bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-brand-blue/50 w-48"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
