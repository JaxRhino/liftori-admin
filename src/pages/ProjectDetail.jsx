import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

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

export default function ProjectDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [messages, setMessages] = useState([])
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [newMilestone, setNewMilestone] = useState('')
  const [addingMilestone, setAddingMilestone] = useState(false)

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
        <Link to="/projects" className="text-brand-blue hover:underline mt-2 inline-block">Back to projects</Link>
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
          <Link to="/projects" className="text-gray-400 hover:text-white transition-colors">
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

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Build Progress</span>
          <span className="text-sm font-bold text-brand-blue">{project.progress}%</span>
        </div>
        <div className="w-full h-2 bg-navy-700 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-gradient-to-r from-brand-blue to-brand-cyan rounded-full transition-all duration-300" style={{ width: `${project.progress}%` }} />
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
            <h3 className="text-sm font-medium text-gray-400 mb-3">Project Details</h3>
            <div className="space-y-3">
              <DetailRow label="Type" value={project.project_type} />
              <DetailRow label="Tier" value={project.tier} />
              <DetailRow label="Budget" value={project.budget_range} />
              <DetailRow label="Timeline" value={project.timeline_pref} />
              <DetailRow label="Design Vibe" value={project.vibe} />
              <DetailRow label="Created" value={new Date(project.created_at).toLocaleString()} />
              {project.launched_at && <DetailRow label="Launched" value={new Date(project.launched_at).toLocaleString()} />}
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Brief</h3>
            <p className="text-sm text-white whitespace-pre-wrap">{project.brief || 'No brief yet'}</p>
          </div>

          {project.features && project.features.length > 0 && (
            <div className="card lg:col-span-2">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Features</h3>
              <div className="flex flex-wrap gap-2">
                {project.features.map((f, i) => (
                  <span key={i} className="badge bg-navy-700 text-gray-300">{f}</span>
                ))}
              </div>
            </div>
          )}
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
        <div className="space-y-4">
          {updates.map(upd => (
            <div key={upd.id} className="card">
              <div className="flex items-center gap-2 mb-2">
                <span className={`badge ${
                  upd.update_type === 'milestone' ? 'bg-purple-500/20 text-purple-400'
                  : upd.update_type === 'alert' ? 'bg-orange-500/20 text-orange-400'
                  : upd.update_type === 'launch' ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-brand-blue/20 text-brand-blue'
                }`}>
                  {upd.update_type}
                </span>
                <span className="text-xs text-gray-500">{new Date(upd.created_at).toLocaleString()}</span>
              </div>
              <h3 className="text-sm font-semibold text-white">{upd.title}</h3>
              <p className="text-sm text-gray-400 mt-1">{upd.body}</p>
            </div>
          ))}
          {updates.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-gray-500 text-sm">No updates posted yet</p>
            </div>
          )}
        </div>
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
