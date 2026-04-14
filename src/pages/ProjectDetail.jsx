import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import DevLab from '../components/DevLab'
import TeamMemberSelect, { TeamMemberLabel } from '../components/TeamMemberSelect'

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

const PROJECT_TYPES = ['Web App', 'Mobile App', 'Business Platform', 'E-Commerce', 'Dashboard', 'Marketplace', 'Book Writing App', 'CRM Builder', 'Website Builder']
const TIERS = ['Starter', 'Growth', 'Scale', 'Enterprise']

const BUDGET_RANGES = [
  '$2,500 – $5,000',
  '$5,000 – $10,000',
  '$10,000 – $25,000',
  '$25,000+',
  'Not sure yet'
]

const TIMELINES = [
  'ASAP (2-4 weeks)',
  '1-2 months',
  '2-3 months',
  'Flexible'
]

const DESIGN_VIBES = [
  'Modern & Minimal',
  'Bold & Vibrant',
  'Professional & Corporate',
  'Playful & Creative',
  'Dark & Sleek',
  'Warm & Friendly'
]

const TECH_STACK_OPTIONS = [
  'React', 'Next.js', 'Vue', 'Angular', 'Svelte',
  'Node.js', 'Python', 'Django', 'Express',
  'Supabase', 'Firebase', 'PostgreSQL', 'MongoDB',
  'Tailwind CSS', 'Stripe', 'Vercel', 'AWS',
  'React Native', 'Flutter', 'Vite', 'TypeScript',
  'GraphQL', 'REST API', 'Cloudflare', 'Redis', 'Docker'
]

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
  const [generatingBrief, setGeneratingBrief] = useState(false)
  const [generatingFeatures, setGeneratingFeatures] = useState(false)
  const [invoices, setInvoices] = useState([])

  // Scope tab state
  const [scopeFeatures, setScopeFeatures] = useState([])
  const [editingScopeIdx, setEditingScopeIdx] = useState(null)
  const [scopeEditForm, setScopeEditForm] = useState({ name: '', description: '', priority: 'medium', status: 'planned' })
  const [addingScopeFeature, setAddingScopeFeature] = useState(false)

  // Implementation Plan state
  const [implPlan, setImplPlan] = useState([])
  const [addingPhase, setAddingPhase] = useState(false)
  const [newPhase, setNewPhase] = useState({ name: '', description: '', duration: '', status: 'not_started' })

  useEffect(() => {
    fetchAll()
  }, [id])

  async function fetchAll() {
    try {
      const [
        { data: proj },
        { data: ms },
        { data: msgs },
        { data: upds },
        { data: invs }
      ] = await Promise.all([
        supabase.from('projects').select('*, profiles!projects_customer_id_fkey(full_name, email)').eq('id', id).single(),
        supabase.from('milestones').select('*').eq('project_id', id).order('sort_order'),
        supabase.from('messages').select('*, profiles!messages_sender_id_fkey(full_name, email)').eq('project_id', id).order('created_at', { ascending: true }),
        supabase.from('project_updates').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('project_id', id).order('created_at', { ascending: false })
      ])

      setProject(proj)
      setMilestones(ms || [])
      setMessages(msgs || [])
      setUpdates(upds || [])
      setInvoices(invs || [])

      // Build scope features from project.features array
      if (proj?.features && proj.features.length > 0) {
        setScopeFeatures(proj.features.map((f, i) => ({
          id: i,
          name: f,
          description: proj.feature_descriptions?.[i] || '',
          priority: proj.feature_priorities?.[i] || 'medium',
          status: proj.feature_statuses?.[i] || 'planned'
        })))
      }

      // Build implementation plan from project metadata
      if (proj?.implementation_plan && proj.implementation_plan.length > 0) {
        setImplPlan(proj.implementation_plan)
      }
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
      features: (project.features || []).join(', '),
      tech_stack: project.tech_stack || [],
      sales_rep_id: project.sales_rep_id || null,
      project_manager_id: project.project_manager_id || null,
      consultant_id: project.consultant_id || null,
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
        features: featuresArray.length > 0 ? featuresArray : null,
        tech_stack: editForm.tech_stack.length > 0 ? editForm.tech_stack : null,
        sales_rep_id: editForm.sales_rep_id || null,
        project_manager_id: editForm.project_manager_id || null,
        consultant_id: editForm.consultant_id || null,
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

  async function generateBrief() {
    setGeneratingBrief(true)
    try {
      const context = `Project: ${editForm.name || project.name}
Type: ${editForm.project_type || project.project_type}
Tier: ${editForm.tier || project.tier}
Budget: ${editForm.budget_range || project.budget_range || 'Not specified'}
Timeline: ${editForm.timeline_pref || project.timeline_pref || 'Not specified'}
Design Vibe: ${editForm.vibe || project.vibe || 'Not specified'}
Features: ${editForm.features || (project.features || []).join(', ') || 'None specified'}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `You are a project scoping assistant for Liftori, an AI-powered app delivery service. Based on the following project details, write a clear, concise project brief (3-5 sentences) that describes what will be built, the target user, key value proposition, and technical approach. Be specific and actionable — this brief goes directly to the dev team.

${context}

Write the brief now. No preamble, just the brief.`
          }]
        })
      })

      const data = await res.json()
      const briefText = data.content?.[0]?.text || ''
      if (briefText) {
        setEditForm(f => ({ ...f, brief: briefText }))
      }
    } catch (err) {
      console.error('Generate brief error:', err)
    } finally {
      setGeneratingBrief(false)
    }
  }

  async function generateFeatures() {
    setGeneratingFeatures(true)
    try {
      const context = `Project: ${editForm.name || project.name}
Type: ${editForm.project_type || project.project_type}
Tier: ${editForm.tier || project.tier}
Brief: ${editForm.brief || project.brief || 'Not specified'}
Budget: ${editForm.budget_range || project.budget_range || 'Not specified'}
Design Vibe: ${editForm.vibe || project.vibe || 'Not specified'}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `You are a project scoping assistant for Liftori, an AI-powered app delivery service. Based on the following project details, generate a comma-separated list of 6-10 specific features that should be built. Each feature should be 2-5 words. Focus on deliverable functionality, not vague concepts.

${context}

Return ONLY a comma-separated list. No numbering, no bullets, no explanation. Example format: User auth, Dashboard analytics, Payment processing, Email notifications`
          }]
        })
      })

      const data = await res.json()
      const featuresText = data.content?.[0]?.text || ''
      if (featuresText) {
        setEditForm(f => ({ ...f, features: featuresText }))
      }
    } catch (err) {
      console.error('Generate features error:', err)
    } finally {
      setGeneratingFeatures(false)
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
    { key: 'scope', label: 'Scope', count: project?.features?.length || 0 },
    { key: 'design', label: 'Design' },
    { key: 'implementation', label: 'Impl. Plan' },
    { key: 'milestones', label: 'Milestones', count: milestones.length },
    { key: 'documents', label: 'Documents' },
    { key: 'messages', label: 'Messages', count: messages.length },
    { key: 'updates', label: 'Updates', count: updates.length },
    { key: 'invoices', label: 'Invoices' }
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
          {/* ── Status Pipeline Bar ── */}
          {(() => {
            const PIPELINE = ['Wizard Complete', 'Brief Review', 'Design Approval', 'In Build', 'QA', 'Launched']
            const currentIdx = PIPELINE.indexOf(project.status)
            return (
              <div className="card mb-6 overflow-x-auto">
                <div className="flex items-center min-w-max gap-0">
                  {PIPELINE.map((stage, i) => {
                    const isCompleted = currentIdx >= 0 && i < currentIdx
                    const isCurrent = i === currentIdx
                    const dotClass = isCompleted
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : isCurrent
                      ? 'bg-brand-blue/20 border-brand-blue text-brand-blue'
                      : 'bg-navy-800 border-navy-600/50 text-gray-600'
                    const labelClass = isCurrent ? 'text-brand-blue font-semibold' : isCompleted ? 'text-emerald-400' : 'text-gray-600'
                    const connClass = i < currentIdx ? 'bg-emerald-500/40' : 'bg-navy-700'
                    return (
                      <div key={stage} className="flex items-center">
                        <button
                          onClick={() => updateStatus(stage)}
                          title={`Set to ${stage}`}
                          className="flex flex-col items-center gap-1.5 px-2 group"
                        >
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all group-hover:scale-110 ${dotClass}`}>
                            {isCompleted ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : i + 1}
                          </div>
                          <span className={`text-[10px] whitespace-nowrap ${labelClass}`}>{stage}</span>
                        </button>
                        {i < PIPELINE.length - 1 && (
                          <div className={`w-8 h-0.5 flex-shrink-0 ${connClass}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

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
              type="range" min="0" max="100" step="5"
              value={project.progress}
              onChange={e => updateProgress(parseInt(e.target.value))}
              className="w-full accent-brand-blue"
            />
          </div>

          {/* Sub-Tab Navigation — scrollable for many tabs */}
          <div className="flex gap-1 mb-6 border-b border-navy-700/50 pb-px overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative whitespace-nowrap ${
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

          {/* ===== OVERVIEW TAB ===== */}
          {activeTab === 'overview' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-400">Project Details</h3>
                  {!editing ? (
                    <button onClick={startEditing} className="text-xs text-brand-blue hover:text-brand-blue/80 transition-colors flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-white transition-colors">Cancel</button>
                      <button onClick={saveEditing} disabled={saving} className="text-xs bg-brand-blue hover:bg-brand-blue/80 text-white px-3 py-1 rounded-md transition-colors disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
                {editing ? (
                  <div className="space-y-3">
                    <EditField label="Project Name" value={editForm.name} onChange={v => setEditForm(f => ({ ...f, name: v }))} />
                    <SelectField label="Type" value={editForm.project_type} options={PROJECT_TYPES} onChange={v => setEditForm(f => ({ ...f, project_type: v }))} />
                    <SelectField label="Tier" value={editForm.tier} options={TIERS} onChange={v => setEditForm(f => ({ ...f, tier: v }))} />
                    <SelectField label="Budget" value={editForm.budget_range} options={BUDGET_RANGES} onChange={v => setEditForm(f => ({ ...f, budget_range: v }))} allowCustom />
                    <SelectField label="Timeline" value={editForm.timeline_pref} options={TIMELINES} onChange={v => setEditForm(f => ({ ...f, timeline_pref: v }))} allowCustom />
                    <SelectField label="Design Vibe" value={editForm.vibe} options={DESIGN_VIBES} onChange={v => setEditForm(f => ({ ...f, vibe: v }))} allowCustom />
                    <div className="py-1.5 border-b border-navy-700/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-500">Tech Stack</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {TECH_STACK_OPTIONS.map(tech => (
                          <button
                            key={tech}
                            onClick={() => setEditForm(f => ({
                              ...f,
                              tech_stack: f.tech_stack.includes(tech)
                                ? f.tech_stack.filter(t => t !== tech)
                                : [...f.tech_stack, tech]
                            }))}
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${
                              editForm.tech_stack.includes(tech)
                                ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/40'
                                : 'bg-navy-800 text-gray-400 border border-navy-700/50 hover:border-gray-500'
                            }`}
                          >
                            {tech}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Team Assignments — edit mode */}
                    <div className="py-2 border-b border-navy-700/30 space-y-2">
                      <div className="text-xs text-gray-500 mb-1">Liftori Team Assignments</div>
                      <div>
                        <label className="text-[10px] uppercase text-gray-500 block mb-0.5">Sales Rep</label>
                        <TeamMemberSelect value={editForm.sales_rep_id} onChange={v => setEditForm(f => ({ ...f, sales_rep_id: v }))} placeholder="Pick a sales rep" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-gray-500 block mb-0.5">Project Manager</label>
                        <TeamMemberSelect value={editForm.project_manager_id} onChange={v => setEditForm(f => ({ ...f, project_manager_id: v }))} placeholder="Pick a PM" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-gray-500 block mb-0.5">Consultant</label>
                        <TeamMemberSelect value={editForm.consultant_id} onChange={v => setEditForm(f => ({ ...f, consultant_id: v }))} placeholder="Pick a consultant" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <DetailRow label="Type" value={project.project_type} />
                    <DetailRow label="Tier" value={project.tier} />
                    <DetailRow label="Budget" value={project.budget_range} />
                    <DetailRow label="Timeline" value={project.timeline_pref} />
                    <DetailRow label="Design Vibe" value={project.vibe} />
                    <div className="py-1.5 border-b border-navy-700/30">
                      <span className="text-xs text-gray-500">Tech Stack</span>
                      {project.tech_stack && project.tech_stack.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {project.tech_stack.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded text-xs bg-brand-blue/10 text-brand-blue border border-brand-blue/20">{t}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-white float-right">{'\u2014'}</span>
                      )}
                    </div>
                    {/* Team Assignments — view mode */}
                    <div className="pt-2 pb-1 border-b border-navy-700/30">
                      <div className="text-xs text-gray-500 mb-2">Liftori Team</div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-400 text-xs">Sales Rep</span>
                          <TeamMemberLabel userId={project.sales_rep_id} fallback="—" />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-400 text-xs">Project Manager</span>
                          <TeamMemberLabel userId={project.project_manager_id} fallback="—" />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-400 text-xs">Consultant</span>
                          <TeamMemberLabel userId={project.consultant_id} fallback="—" />
                        </div>
                      </div>
                    </div>
                    <DetailRow label="Created" value={new Date(project.created_at).toLocaleString()} />
                    {project.launched_at && <DetailRow label="Launched" value={new Date(project.launched_at).toLocaleString()} />}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-400">Brief</h3>
                  {editing && (
                    <button onClick={generateBrief} disabled={generatingBrief} className="text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 px-3 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5">
                      {generatingBrief ? (
                        <>
                          <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                          AI Generate
                        </>
                      )}
                    </button>
                  )}
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
                  {editing ? (
                    <button onClick={generateFeatures} disabled={generatingFeatures} className="text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 px-3 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5">
                      {generatingFeatures ? (
                        <>
                          <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                          AI Generate
                        </>
                      )}
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
                {editing ? (
                  <textarea
                    className="w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50 min-h-[80px] resize-y"
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

          {/* ===== SCOPE TAB ===== */}
          {activeTab === 'scope' && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">Feature Scope</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Detailed breakdown of all features in this project</p>
                  </div>
                  <button
                    onClick={() => setAddingScopeFeature(true)}
                    className="text-xs bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Feature
                  </button>
                </div>

                {addingScopeFeature && (
                  <div className="bg-navy-900/50 border border-navy-700/50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        className="input col-span-2"
                        placeholder="Feature name..."
                        value={scopeEditForm.name}
                        onChange={e => setScopeEditForm(f => ({ ...f, name: e.target.value }))}
                      />
                      <select
                        value={scopeEditForm.priority}
                        onChange={e => setScopeEditForm(f => ({ ...f, priority: e.target.value }))}
                        className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white"
                      >
                        <option value="high">High Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="low">Low Priority</option>
                      </select>
                      <select
                        value={scopeEditForm.status}
                        onChange={e => setScopeEditForm(f => ({ ...f, status: e.target.value }))}
                        className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white"
                      >
                        <option value="planned">Planned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="deferred">Deferred</option>
                      </select>
                    </div>
                    <textarea
                      className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white min-h-[60px] resize-y mb-3"
                      placeholder="Feature description and requirements..."
                      value={scopeEditForm.description}
                      onChange={e => setScopeEditForm(f => ({ ...f, description: e.target.value }))}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setAddingScopeFeature(false); setScopeEditForm({ name: '', description: '', priority: 'medium', status: 'planned' }) }} className="text-xs text-gray-500 hover:text-white px-3 py-1.5">Cancel</button>
                      <button
                        onClick={() => {
                          if (!scopeEditForm.name.trim()) return
                          setScopeFeatures(prev => [...prev, { ...scopeEditForm, id: Date.now() }])
                          setScopeEditForm({ name: '', description: '', priority: 'medium', status: 'planned' })
                          setAddingScopeFeature(false)
                        }}
                        className="text-xs bg-brand-blue hover:bg-brand-blue/80 text-white px-4 py-1.5 rounded-md"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Feature List from project.features */}
                {project.features && project.features.length > 0 ? (
                  <div className="space-y-2">
                    {project.features.map((feature, idx) => {
                      const sf = scopeFeatures.find(s => s.name === feature) || {}
                      return (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-navy-900/30 border border-navy-700/30 hover:border-navy-700/60 transition-colors">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            sf.status === 'completed' ? 'bg-emerald-400' :
                            sf.status === 'in_progress' ? 'bg-brand-blue' :
                            sf.status === 'deferred' ? 'bg-gray-500' :
                            'bg-yellow-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{feature}</span>
                              {sf.priority === 'high' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">HIGH</span>
                              )}
                              {sf.priority === 'low' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 font-medium">LOW</span>
                              )}
                            </div>
                            {sf.description && (
                              <p className="text-xs text-gray-500 mt-1">{sf.description}</p>
                            )}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            sf.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                            sf.status === 'in_progress' ? 'bg-brand-blue/20 text-brand-blue' :
                            sf.status === 'deferred' ? 'bg-gray-500/20 text-gray-500' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {sf.status === 'in_progress' ? 'In Progress' : sf.status === 'completed' ? 'Done' : sf.status === 'deferred' ? 'Deferred' : 'Planned'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : scopeFeatures.length > 0 ? (
                  <div className="space-y-2">
                    {scopeFeatures.map((sf, idx) => (
                      <div key={sf.id || idx} className="flex items-start gap-3 p-3 rounded-lg bg-navy-900/30 border border-navy-700/30">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          sf.status === 'completed' ? 'bg-emerald-400' :
                          sf.status === 'in_progress' ? 'bg-brand-blue' :
                          'bg-yellow-400'
                        }`} />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-white">{sf.name}</span>
                          {sf.description && <p className="text-xs text-gray-500 mt-1">{sf.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-10 h-10 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                    </svg>
                    <p className="text-sm text-gray-500">No features scoped yet</p>
                    <p className="text-xs text-gray-600 mt-1">Add features from the Overview tab or click Add Feature above</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== DESIGN TAB ===== */}
          {activeTab === 'design' && (
            <div className="space-y-6">
              {/* Approved Mockup Section */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">Approved Design Mockup</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Customer-approved design from the onboarding wizard</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    project.status === 'Design Approval' || project.approved_at
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {project.approved_at ? 'Approved' : 'Pending Approval'}
                  </span>
                </div>

                {project.mockup_url || project.design_url ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-navy-700/50 overflow-hidden bg-navy-900/50">
                      <img
                        src={project.mockup_url || project.design_url}
                        alt="Approved design mockup"
                        className="w-full h-auto max-h-[600px] object-contain"
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                      />
                      <div className="hidden items-center justify-center py-12 text-gray-500">
                        <p className="text-sm">Could not load mockup image</p>
                      </div>
                    </div>
                    {project.approved_at && (
                      <p className="text-xs text-gray-500">
                        Approved on {new Date(project.approved_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : project.wizard_data?.design_choice ? (
                  <div className="space-y-4">
                    <div className="bg-navy-900/50 border border-navy-700/50 rounded-lg p-4">
                      <h4 className="text-xs font-medium text-gray-400 mb-2">Wizard Design Selection</h4>
                      <div className="space-y-2">
                        <DetailRow label="Design Vibe" value={project.wizard_data.design_choice.vibe || project.vibe} />
                        <DetailRow label="Color Scheme" value={project.wizard_data.design_choice.colors || 'Default'} />
                        <DetailRow label="Layout Style" value={project.wizard_data.design_choice.layout || 'Standard'} />
                      </div>
                    </div>
                    {project.wizard_data.design_choice.preview_url && (
                      <div className="rounded-lg border border-navy-700/50 overflow-hidden">
                        <img
                          src={project.wizard_data.design_choice.preview_url}
                          alt="Design preview"
                          className="w-full h-auto max-h-[500px] object-contain"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    <p className="text-sm text-gray-500">No design mockup available yet</p>
                    <p className="text-xs text-gray-600 mt-1">The mockup will appear here once the customer completes design approval in the wizard</p>
                  </div>
                )}
              </div>

              {/* Design Details */}
              <div className="card">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Design Specifications</h3>
                <div className="space-y-3">
                  <DetailRow label="Design Vibe" value={project.vibe} />
                  <DetailRow label="Project Type" value={project.project_type} />
                  <DetailRow label="Tier" value={project.tier} />
                  {project.tech_stack && project.tech_stack.length > 0 && (
                    <div className="py-1.5 border-b border-navy-700/30">
                      <span className="text-xs text-gray-500">Tech Stack</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {project.tech_stack.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded text-xs bg-brand-blue/10 text-brand-blue border border-brand-blue/20">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== IMPLEMENTATION PLAN TAB ===== */}
          {activeTab === 'implementation' && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">Implementation Plan</h3>
                    <p className="text-xs text-gray-500 mt-0.5">How this project will be carried out, phase by phase</p>
                  </div>
                  <button
                    onClick={() => setAddingPhase(true)}
                    className="text-xs bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Phase
                  </button>
                </div>

                {addingPhase && (
                  <div className="bg-navy-900/50 border border-navy-700/50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        className="input col-span-2"
                        placeholder="Phase name (e.g., Foundation & Auth)"
                        value={newPhase.name}
                        onChange={e => setNewPhase(p => ({ ...p, name: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder="Duration (e.g., 1-2 weeks)"
                        value={newPhase.duration}
                        onChange={e => setNewPhase(p => ({ ...p, duration: e.target.value }))}
                      />
                      <select
                        value={newPhase.status}
                        onChange={e => setNewPhase(p => ({ ...p, status: e.target.value }))}
                        className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <textarea
                      className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white min-h-[60px] resize-y mb-3"
                      placeholder="What will be built in this phase..."
                      value={newPhase.description}
                      onChange={e => setNewPhase(p => ({ ...p, description: e.target.value }))}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setAddingPhase(false); setNewPhase({ name: '', description: '', duration: '', status: 'not_started' }) }} className="text-xs text-gray-500 hover:text-white px-3 py-1.5">Cancel</button>
                      <button
                        onClick={() => {
                          if (!newPhase.name.trim()) return
                          setImplPlan(prev => [...prev, { ...newPhase, id: Date.now() }])
                          setNewPhase({ name: '', description: '', duration: '', status: 'not_started' })
                          setAddingPhase(false)
                        }}
                        className="text-xs bg-brand-blue hover:bg-brand-blue/80 text-white px-4 py-1.5 rounded-md"
                      >
                        Add Phase
                      </button>
                    </div>
                  </div>
                )}

                {implPlan.length > 0 ? (
                  <div className="space-y-3">
                    {implPlan.map((phase, idx) => (
                      <div key={phase.id || idx} className="relative pl-8 pb-4">
                        {/* Timeline line */}
                        {idx < implPlan.length - 1 && (
                          <div className="absolute left-[11px] top-6 bottom-0 w-px bg-navy-700/50" />
                        )}
                        {/* Timeline dot */}
                        <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          phase.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                          phase.status === 'in_progress' ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/40' :
                          'bg-navy-800 text-gray-500 border border-navy-700/50'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="bg-navy-900/30 border border-navy-700/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-medium text-white">{phase.name}</h4>
                            <div className="flex items-center gap-2">
                              {phase.duration && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-navy-800 text-gray-400">{phase.duration}</span>
                              )}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                phase.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                phase.status === 'in_progress' ? 'bg-brand-blue/20 text-brand-blue' :
                                'bg-gray-500/20 text-gray-500'
                              }`}>
                                {phase.status === 'in_progress' ? 'In Progress' : phase.status === 'completed' ? 'Done' : 'Not Started'}
                              </span>
                            </div>
                          </div>
                          {phase.description && (
                            <p className="text-xs text-gray-500 mt-1">{phase.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-10 h-10 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    <p className="text-sm text-gray-500">No implementation plan yet</p>
                    <p className="text-xs text-gray-600 mt-1">Add phases to outline how this project will be built</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== MILESTONES TAB ===== */}
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

          {/* ===== DOCUMENTS TAB ===== */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">Project Documents</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Build agreements, estimates, and project files</p>
                  </div>
                </div>

                {/* Build Agreement */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-navy-900/30 border border-navy-700/30 hover:border-navy-700/60 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white">Build Agreement</h4>
                      <p className="text-xs text-gray-500">Service agreement and terms for this project</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">Pending</span>
                  </div>

                  {/* Estimate */}
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-navy-900/30 border border-navy-700/30 hover:border-navy-700/60 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white">Project Estimate</h4>
                      <p className="text-xs text-gray-500">
                        {project.budget_range ? `Budget: ${project.budget_range}` : 'Cost breakdown and timeline estimate'}
                        {' — '}
                        <span className="text-yellow-400/80">Estimates may vary depending on scope</span>
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">Draft</span>
                  </div>

                  {/* Scope Document */}
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-navy-900/30 border border-navy-700/30 hover:border-navy-700/60 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white">Scope Document</h4>
                      <p className="text-xs text-gray-500">Feature requirements and technical specifications</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-gray-500/20 text-gray-400 font-medium">Not Started</span>
                  </div>
                </div>

                <p className="text-xs text-gray-600 mt-4 text-center">Document upload and generation coming soon</p>
              </div>
            </div>
          )}

          {/* ===== MESSAGES TAB ===== */}
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

          {/* ===== UPDATES TAB ===== */}
          {activeTab === 'updates' && (
            <div className="space-y-6">
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

              {updates.map(upd => (
                <div key={upd.id} className="card group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${
                        upd.update_type === 'milestone' ? 'bg-purple-500/20 text-purple-400' :
                        upd.update_type === 'alert' ? 'bg-orange-500/20 text-orange-400' :
                        upd.update_type === 'launch' ? 'bg-emerald-500/20 text-emerald-400' :
                        upd.update_type === 'design' ? 'bg-pink-500/20 text-pink-400' :
                        upd.update_type === 'review' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-brand-blue/20 text-brand-blue'
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

          {/* ===== INVOICES TAB ===== */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-white">Invoices</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Billing and payment tracking for this project</p>
                  </div>
                  {invoices.length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total Billed</p>
                      <p className="text-lg font-bold text-white">
                        ${invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {invoices.length > 0 ? (
                  <div className="space-y-2">
                    {invoices.map(inv => {
                      const statusColors = {
                        paid: 'bg-emerald-500/20 text-emerald-400',
                        sent: 'bg-brand-blue/20 text-brand-blue',
                        draft: 'bg-gray-500/20 text-gray-400',
                        overdue: 'bg-red-500/20 text-red-400',
                        cancelled: 'bg-gray-500/20 text-gray-500',
                      }
                      const colorClass = statusColors[inv.status] || statusColors.draft
                      return (
                        <div key={inv.id} className="flex items-center gap-4 p-4 rounded-lg bg-navy-900/30 border border-navy-700/30 hover:border-navy-700/60 transition-colors">
                          <div className="w-10 h-10 rounded-lg bg-navy-800 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-white truncate">
                              {inv.description || inv.title || `Invoice #${inv.id.slice(0, 8)}`}
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : `Created ${new Date(inv.created_at).toLocaleDateString()}`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-white">
                              {inv.amount != null ? `$${Number(inv.amount).toLocaleString()}` : '—'}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colorClass}`}>
                              {inv.status || 'draft'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                    <p className="text-sm text-gray-500">No invoices yet</p>
                    <p className="text-xs text-gray-600 mt-1">Invoices will appear here once created for this project</p>
                    {project.budget_range && (
                      <div className="mt-4 inline-flex items-center gap-2 bg-navy-900/50 border border-navy-700/30 rounded-lg px-4 py-2">
                        <span className="text-xs text-gray-500">Estimated Budget:</span>
                        <span className="text-sm font-medium text-white">{project.budget_range}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
      <span className="text-sm text-white">{value || '\u2014'}</span>
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

function SelectField({ label, value, options, onChange, allowCustom }) {
  const isCustom = value && !options.includes(value)
  const [showCustom, setShowCustom] = useState(isCustom)

  return (
    <div className="flex justify-between items-center py-1.5 border-b border-navy-700/30">
      <span className="text-xs text-gray-500">{label}</span>
      {showCustom ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            className="bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-brand-blue/50 w-40"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Custom value..."
          />
          <button
            onClick={() => { setShowCustom(false); onChange(options[0] || '') }}
            className="text-xs text-gray-500 hover:text-white ml-1"
            title="Use dropdown"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <select
            value={options.includes(value) ? value : ''}
            onChange={e => onChange(e.target.value)}
            className="bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-blue/50"
          >
            <option value="">Select...</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {allowCustom && (
            <button
              onClick={() => setShowCustom(true)}
              className="text-xs text-gray-500 hover:text-white ml-1"
              title="Enter custom value"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
