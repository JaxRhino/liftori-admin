import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { OPS_STAGES, OPS_STAGE_COLORS, OPS_NEXT, opsToSales } from '../lib/customerValue'

const STATUS_PIPELINE = OPS_STAGES

const STATUS_ALL = [...OPS_STAGES, 'On Hold', 'Cancelled']

const STATUS_COLORS = {
  ...OPS_STAGE_COLORS,
  'Cancelled': OPS_STAGE_COLORS['Lost'],
  // legacy keys still referenced as fallbacks in this file:
  'In Build': OPS_STAGE_COLORS['Development'],
  'Wizard Complete': OPS_STAGE_COLORS['In Review'],
  'Buildout': OPS_STAGE_COLORS['Onboarding'],
}

const NEXT_STATUS = OPS_NEXT

const PROJECT_TYPES = [
  'CRM',
  'Custom Builds',
  'Websites',
]

// ── New Project Modal ─────────────────────────────────────────────────────────────
function NewProjectModal({ onClose, onCreated, currentUserId }) {
  const [form, setForm] = useState({
    name: '',
    project_type: '',
    tier: 'Starter',
    brief: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [customerId, setCustomerId] = useState(currentUserId || '')

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email').order('full_name').then(({ data }) => {
      setProfiles(data || [])
    })
  }, [])

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.project_type) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: insertErr } = await supabase
        .from('projects')
        .insert({
          name: form.name.trim(),
          project_type: form.project_type,
          tier: form.tier,
          brief: form.brief.trim() || null,
          status: 'New Project',
          customer_id: customerId || null,
          progress: 0,
        })
        .select('*')
        .single()
      if (insertErr) throw insertErr
      onCreated(data)
    } catch (err) {
      setError(err.message || 'Failed to create project')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tierColors = {
    Starter: 'border-brand-blue bg-brand-blue/10 text-brand-blue',
    Growth: 'border-blue-400 bg-blue-500/10 text-blue-400',
    Scale: 'border-sky-400 bg-sky-500/10 text-sky-400',
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-navy-900 border border-navy-700/50 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-700/50">
          <div>
            <h2 className="text-lg font-bold text-white">New Project</h2>
            <p className="text-sm text-gray-400 mt-0.5">Create an internal build or showcase project</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-navy-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Project Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g., Liftori Demo — E-Commerce"
              className="w-full bg-navy-800 border border-navy-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-brand-blue transition-colors"
              autoFocus
            />
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Customer</label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full bg-navy-800 border border-navy-600/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-colors"
              style={{ color: customerId ? 'white' : 'rgb(107,114,128)' }}
            >
              <option value="" style={{ color: 'rgb(107,114,128)' }}>No customer (internal project)</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id} style={{ color: 'white', background: '#0f172a' }}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Project Type *</label>
            <select
              value={form.project_type}
              onChange={e => update('project_type', e.target.value)}
              className="w-full bg-navy-800 border border-navy-600/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-colors"
              style={{ color: form.project_type ? 'white' : 'rgb(107,114,128)' }}
            >
              <option value="" disabled style={{ color: 'rgb(107,114,128)' }}>Select type...</option>
              {PROJECT_TYPES.map(t => (
                <option key={t} value={t} style={{ color: 'white', background: '#0f172a' }}>{t}</option>
              ))}
            </select>
          </div>

          {/* Tier */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {['Starter', 'Growth', 'Scale'].map(tier => (
                <button
                  key={tier}
                  onClick={() => update('tier', tier)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                    form.tier === tier
                      ? tierColors[tier]
                      : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500'
                  }`}
                >{tier}</button>
              ))}
            </div>
          </div>

          {/* Brief */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Brief / Description
              <span className="text-gray-500 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={form.brief}
              onChange={e => update('brief', e.target.value)}
              placeholder="What is this project? What problem does it solve? Who is it for?"
              className="w-full bg-navy-800 border border-navy-600/50 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-brand-blue transition-colors resize-none"
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-navy-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !form.name.trim() || !form.project_type}
            className="flex items-center gap-2 px-5 py-2 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Status Dropdown ───────────────────────────────────────────────────────────────
function StatusDropdown({ project, onUpdate, saving }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const colors = STATUS_COLORS[project.status] || STATUS_COLORS['Wizard Complete']

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-all ${colors.bg} ${colors.text} ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 ' + colors.ring + ' cursor-pointer'} `}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
        {project.status}
        {saving ? (
          <svg className="w-3 h-3 animate-spin ml-0.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
   </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-44 bg-navy-900 border border-navy-600/60 rounded-lg shadow-xl overflow-hidden">
          {STATUS_ALL.map(s => {
            const c = STATUS_COLORS[s] || STATUS_COLORS['Wizard Complete']
            const isCurrent = s === project.status
            return (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); onUpdate(project.id, s); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${isCurrent ? 'bg-navy-700/60 ' + c.text : 'text-gray-400 hover:bg-navy-800 hover:text-white'} `}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                {s}
                {isCurrent && (
                  <svg className="w-3 h-3 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all ${
      type === 'success'
        ? 'bg-emerald-900/90 text-emerald-300 border border-emerald-700/50'
        : 'bg-red-900/90 text-red-300 border border-red-700/50'
    }`}>
      {type === 'success' ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────────
export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  // Wave E: URL-backed filter/view state for shareable links.
  // Defaults are stripped from the URL to keep clean canonical URLs.
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') || 'pipeline'
  const statusFilter = searchParams.get('status') || 'all'
  const groupBy = searchParams.get('groupBy') || 'status'
  function _updateParam(key, value, defaultVal) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (!value || value === defaultVal) next.delete(key); else next.set(key, value)
      return next
    }, { replace: true })
  }
  const setView = (v) => _updateParam('view', v, 'pipeline')
  const setStatusFilter = (v) => _updateParam('status', v, 'all')
  const setGroupBy = (v) => _updateParam('groupBy', v, 'status')
  const [dragOverLane, setDragOverLane] = useState(null) // lane.key being hovered
  const [saving, setSaving] = useState({}) // { [projectId]: true }
  const [toast, setToast] = useState(null)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  // Wave D: drawer inline editor state
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [profileList, setProfileList] = useState([])
  const [tierPrices, setTierPrices] = useState({}) // { 'CRM|Growth': 500, 'Website|': 300 } list MRR by product_type+tier
  // Wave E: searchQuery URL-backed too
  const searchQuery = searchParams.get('q') || ''
  const setSearchQuery = (v) => _updateParam('q', v, '')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    fetchProjects()
  }, [])

  // Wave D: load profile list once for owner dropdown
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email').order('full_name').then(({ data }) => {
      setProfileList(data || [])
    })
  }, [])

  // Standard tier MRR (list price) per product_type+tier, from the editable estimate templates.
  // Used as a fallback "tier price" on cards whose actual deal MRR isn't set yet.
  useEffect(() => {
    supabase.from('estimate_product_templates')
      .select('product_type, tier, is_active, estimate_product_template_items(unit_cost, qty, recurring)')
      .eq('is_active', true)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(t => {
          const monthly = (t.estimate_product_template_items || [])
            .filter(i => i.recurring)
            .reduce((s, i) => s + (Number(i.unit_cost) || 0) * (Number(i.qty) || 1), 0)
          map[`${t.product_type}|${t.tier || ''}`] = monthly
        })
        setTierPrices(map)
      })
  }, [])

  // project_type taxonomy (plural) -> template product_type (singular)
  const PROJ_TYPE_TO_PRODUCT = { 'Custom Builds': 'Custom Build', 'Websites': 'Website', 'CRM': 'CRM', 'Consulting': 'Consulting' }
  function tierListPrice(project) {
    const pt = PROJ_TYPE_TO_PRODUCT[project.project_type] || project.project_type
    return tierPrices[`${pt}|${project.tier || ''}`] ?? tierPrices[`${pt}|`] ?? 0
  }

  async function fetchProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, profiles!projects_customer_id_fkey(full_name, email), next_action_owner:profiles!projects_next_action_owner_id_fkey(full_name, email)')
        .order('portfolio_pinned', { ascending: false })
        .order('next_action_due', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      console.error('Error fetching projects:', err)
    } finally {
      setLoading(false)
    }
  }

  async function togglePinned(projectId, currentlyPinned) {
    setProjects(ps => ps.map(p => p.id === projectId ? { ...p, portfolio_pinned: !currentlyPinned } : p))
    try {
      const { error } = await supabase
        .from('projects')
        .update({ portfolio_pinned: !currentlyPinned })
        .eq('id', projectId)
      if (error) throw error
    } catch (err) {
      setProjects(ps => ps.map(p => p.id === projectId ? { ...p, portfolio_pinned: currentlyPinned } : p))
      showToast('Failed to update pin', 'error')
      console.error('Pin toggle failed:', err)
    }
  }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  function handleProjectCreated(project) {
    setProjects(prev => [project, ...prev])
    setNewProjectOpen(false)
    showToast(`"${project.name}" created`)
  }

  const navigate = useNavigate()

  function openProject(proj) {
    setSelectedProject(proj)
    setAdminNotes(proj.admin_notes || '')
    setEditForm({
      next_action: proj.next_action || '',
      next_action_owner_id: proj.next_action_owner_id || '',
      next_action_due: proj.next_action_due || '',
      mrr: proj.mrr || 0,
      revenue: proj.revenue || 0,
      progress: proj.progress || 0,
      tier: proj.tier || 'Starter',
      portfolio_pinned: !!proj.portfolio_pinned,
      client_display_name: proj.client_display_name || '',
    })
  }

  function closeProject() {
    setSelectedProject(null)
    setAdminNotes('')
    setEditForm(null)
    setEmailOpen(false)
  }

  async function saveEdit() {
    if (!selectedProject || !editForm) return
    setSavingEdit(true)
    try {
      const updates = {
        next_action: editForm.next_action || null,
        next_action_owner_id: editForm.next_action_owner_id || null,
        next_action_due: editForm.next_action_due || null,
        mrr: Number(editForm.mrr) || 0,
        revenue: Number(editForm.revenue) || 0,
        progress: Math.min(100, Math.max(0, Number(editForm.progress) || 0)),
        tier: editForm.tier,
        portfolio_pinned: !!editForm.portfolio_pinned,
        client_display_name: editForm.client_display_name || null,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', selectedProject.id)
        .select('*, profiles!projects_customer_id_fkey(full_name, email), next_action_owner:profiles!projects_next_action_owner_id_fkey(full_name, email)')
        .single()
      if (error) throw error
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? data : p))
      setSelectedProject(data)
      showToast('Saved')
    } catch (err) {
      console.error('saveEdit:', err)
      showToast('Failed to save', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  async function saveNotes() {
    if (!selectedProject) return
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('projects')
        .update({ admin_notes: adminNotes })
        .eq('id', selectedProject.id)
      if (error) throw error
      setProjects(prev => prev.map(p =>
        p.id === selectedProject.id ? { ...p, admin_notes: adminNotes } : p
      ))
      setSelectedProject(prev => prev ? { ...prev, admin_notes: adminNotes } : null)
    } catch (err) {
      console.error('saveNotes:', err)
    } finally {
      setSavingNotes(false)
    }
  }

    async function updateStatus(projectId, newStatus) {
    const prev = projects.find(p => p.id === projectId)
    if (!prev || prev.status === newStatus) return

    // Optimistic update
    setProjects(ps => ps.map(p => p.id === projectId ? { ...p, status: newStatus } : p))
    setSaving(s => ({ ...s, [projectId]: true }))

    try {
      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (newStatus === 'Active' && !prev.launched_at) {
        updates.launched_at = new Date().toISOString()
      }
      if (newStatus === 'Design Approval' && !prev.approved_at) {
        updates.approved_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)

      if (error) throw error
      // Bidirectional handoff: a project hitting "Demo Ready" hands back to Sales;
      // delivery (Onboarding/Active) closes the line as Won; "Lost" mirrors. Build-phase
      // statuses leave the sales line untouched (it sits at "Demo / Mockup").
      {
        const saleStage = opsToSales(newStatus)
        if (saleStage) {
          await supabase.from('customer_product_lines').update({
            stage: saleStage,
            won_at: saleStage === 'Won' ? new Date().toISOString() : null,
            lost_at: saleStage === 'Lost' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }).eq('project_id', projectId)
        }
      }
      showToast(`${prev.name} → ${newStatus}`)
    } catch (err) {
      // Rollback
      setProjects(ps => ps.map(p => p.id === projectId ? prev : p))
      showToast('Failed to update status', 'error')
      console.error('Status update failed:', err)
    } finally {
      setSaving(s => { const n = { ...s }; delete n[projectId]; return n })
    }
  }

  async function advanceStatus(project) {
    const next = NEXT_STATUS[project.status]
    if (next) updateStatus(project.id, next)
  }

  // Stats
  const totalMRR = projects.reduce((s, p) => s + (p.mrr || 0), 0)
  const inBuildCount = projects.filter(p => ['Planning','Development','Testing'].includes(p.status)).length
  const launchedCount = projects.filter(p => p.status === 'Active').length
  const pinnedCount = projects.filter(p => p.portfolio_pinned).length

  // Display name fallback: client_display_name > customer profile > 'Internal'
  function clientLabel(p) {
    return p.client_display_name || p.profiles?.full_name || p.profiles?.email || 'Internal'
  }

  const searchFiltered = searchQuery.trim()
    ? projects.filter(p => {
        const q = searchQuery.toLowerCase()
        return p.name?.toLowerCase().includes(q) ||
          p.client_display_name?.toLowerCase().includes(q) ||
          p.profiles?.full_name?.toLowerCase().includes(q) ||
          p.profiles?.email?.toLowerCase().includes(q) ||
          p.next_action?.toLowerCase().includes(q)
      })
    : projects

  const filtered =
    statusFilter === 'all' ? searchFiltered :
    statusFilter === 'pinned' ? searchFiltered.filter(p => p.portfolio_pinned) :
    searchFiltered.filter(p => p.status === statusFilter)

  const sorted = [...filtered].sort((a, b) => {
    // Pinned always wins, regardless of sort column
    if (!!b.portfolio_pinned !== !!a.portfolio_pinned) {
      return b.portfolio_pinned ? 1 : -1
    }
    if (sortBy === 'name') {
      const cmp = (a.name || '').localeCompare(b.name || '')
      return sortDir === 'asc' ? cmp : -cmp
    }
    if (sortBy === 'status') {
      const cmp = STATUS_ALL.indexOf(a.status) - STATUS_ALL.indexOf(b.status)
      return sortDir === 'asc' ? cmp : -cmp
    }
    if (sortBy === 'progress') {
      const cmp = (a.progress || 0) - (b.progress || 0)
      return sortDir === 'asc' ? cmp : -cmp
    }
    if (sortBy === 'next_action_due') {
      const av = a.next_action_due ? new Date(a.next_action_due).getTime() : Infinity
      const bv = b.next_action_due ? new Date(b.next_action_due).getTime() : Infinity
      const cmp = av - bv
      return sortDir === 'asc' ? cmp : -cmp
    }
    // date (default)
    const cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return sortDir === 'asc' ? cmp : -cmp
  })

  const statusCounts = {}
  projects.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1 })

  const activePipelineStatuses = STATUS_PIPELINE

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Derive Kanban lanes from the active groupBy selection
  const lanes = useMemo(() => {
    if (groupBy === 'status') {
      const list = STATUS_PIPELINE.map(s => ({
        key: s,
        label: s,
        colors: STATUS_COLORS[s],
        projects: searchFiltered.filter(p => p.status === s),
        droppable: true,
      }))
      // Append On Hold/Cancelled if populated (faded)
      ;['On Hold', 'Cancelled'].forEach(s => {
        if (statusCounts[s]) list.push({
          key: s, label: s, colors: STATUS_COLORS[s],
          projects: searchFiltered.filter(p => p.status === s),
          droppable: true, faded: true,
        })
      })
      return list
    }
    if (groupBy === 'type') {
      return ['CRM', 'Custom Builds', 'Websites'].map(t => ({
        key: t, label: t,
        colors: t === 'CRM' ? { dot: 'bg-brand-blue', text: 'text-brand-blue' } :
                t === 'Custom Builds' ? { dot: 'bg-cyan-400', text: 'text-cyan-400' } :
                                        { dot: 'bg-emerald-400', text: 'text-emerald-400' },
        projects: searchFiltered.filter(p => p.project_type === t),
        droppable: false,
      }))
    }
    if (groupBy === 'owner') {
      const owners = new Map()
      searchFiltered.forEach(p => {
        const name = p.next_action_owner?.full_name || p.profiles?.full_name || 'Unassigned'
        if (!owners.has(name)) owners.set(name, [])
        owners.get(name).push(p)
      })
      return [...owners.entries()].map(([name, list]) => ({
        key: name, label: name, colors: STATUS_COLORS['In Build'], projects: list, droppable: false,
      }))
    }
    if (groupBy === 'tier') {
      return ['Starter', 'Growth', 'Scale'].map(tier => ({
        key: tier, label: tier,
        colors: tier === 'Scale' ? { dot: 'bg-sky-400', text: 'text-sky-400' } :
                tier === 'Growth' ? { dot: 'bg-blue-400', text: 'text-blue-400' } :
                                    { dot: 'bg-gray-400', text: 'text-gray-400' },
        projects: searchFiltered.filter(p => p.tier === tier),
        droppable: false,
      }))
    }
    if (groupBy === 'client') {
      const clients = new Map()
      searchFiltered.forEach(p => {
        const name = clientLabel(p)
        if (!clients.has(name)) clients.set(name, [])
        clients.get(name).push(p)
      })
      return [...clients.entries()].map(([name, list]) => ({
        key: name, label: name, colors: STATUS_COLORS['In Build'], projects: list, droppable: false,
      }))
    }
    return []
  }, [searchFiltered, groupBy, statusCounts])

  // HTML5 drag-and-drop handlers (Pipeline view, status grouping only)
  function onCardDragStart(e, projectId) {
    e.dataTransfer.setData('text/plain', projectId)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onLaneDragOver(e, laneKey, droppable) {
    if (!droppable || groupBy !== 'status') return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverLane !== laneKey) setDragOverLane(laneKey)
  }
  function onLaneDragLeave() {
    setDragOverLane(null)
  }
  function onLaneDrop(e, laneKey, droppable) {
    if (!droppable || groupBy !== 'status') return
    e.preventDefault()
    setDragOverLane(null)
    const projectId = e.dataTransfer.getData('text/plain')
    if (!projectId) return
    const proj = projects.find(p => p.id === projectId)
    if (proj && proj.status !== laneKey) updateStatus(projectId, laneKey)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
  <>
    <div className="p-6 space-y-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* New Project Modal */}
      {newProjectOpen && (
        <NewProjectModal
          onClose={() => setNewProjectOpen(false)}
          onCreated={handleProjectCreated}
          currentUserId={user?.id}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Projects</h1>
          <p className="text-sm text-gray-400 mt-1">{projects.length} active project{projects.length !== 1 ? 's' : ''}{pinnedCount > 0 ? ` · ${pinnedCount} pinned` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-navy-800 rounded-lg p-0.5 border border-navy-600/50">
            <button
              onClick={() => setView('pipeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'pipeline' ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white'
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'list' ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
          </div>

          {view === 'pipeline' && (
            <div className="flex bg-navy-800 rounded-lg p-0.5 border border-navy-600/50">
              <span className="px-2 py-1.5 text-[11px] text-gray-500 font-medium uppercase tracking-wider">Group</span>
              {[
                { key: 'status', label: 'Status' },
                { key: 'type', label: 'Type' },
                { key: 'owner', label: 'Owner' },
                { key: 'tier', label: 'Tier' },
                { key: 'client', label: 'Client' },
              ].map(g => (
                <button
                  key={g.key}
                  onClick={() => setGroupBy(g.key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    groupBy === g.key ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={fetchProjects}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-navy-700/50 rounded-lg hover:border-navy-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          <Link
            to="/admin/waitlist"
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2 border border-navy-600/50 rounded-lg text-gray-300 hover:text-white hover:border-navy-500 transition-colors"
          >
            From Waitlist
          </Link>

          <button
            onClick={() => setNewProjectOpen(true)}
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Projects</p>
          <p className="text-3xl font-bold text-white mt-2">{projects.length}</p>
        </div>
        <button
          onClick={() => setStatusFilter('pinned')}
          className={`text-left bg-navy-800 border rounded-xl p-4 transition-colors ${statusFilter === 'pinned' ? 'border-amber-500/50' : 'border-navy-700/50 hover:border-amber-500/30'}`}
        >
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1">
            <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.366 2.445a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.175 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>
            Pinned
          </p>
          <p className="text-3xl font-bold text-amber-400 mt-2">{pinnedCount}</p>
        </button>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Buildout</p>
          <p className="text-3xl font-bold text-brand-blue mt-2">{inBuildCount}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Active</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{launchedCount}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total MRR</p>
          <p className="text-3xl font-bold text-brand-blue mt-2">
            ${totalMRR.toLocaleString()}
            <span className="text-base text-gray-400 font-normal">/mo</span>
          </p>
        </div>
      </div>

      {/* Search bar */}
      {projects.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or customer..."
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-gray-500 whitespace-nowrap">
              {searchFiltered.length} result{searchFiltered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl text-center py-16">
          <svg className="w-14 h-14 mx-auto text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-gray-400 text-sm mb-6">Create a new project or convert a waitlist signup.</p>
          <button
            onClick={() => setNewProjectOpen(true)}
            className="btn-primary inline-flex items-center gap-2 mr-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </button>
          <Link to="/admin/waitlist" className="inline-flex items-center gap-2 px-4 py-2 border border-navy-600 rounded-lg text-gray-300 hover:text-white text-sm transition-colors">
            Go to Waitlist
          </Link>
        </div>
      ) : view === 'pipeline' ? (

        /* ── Pipeline View (Kanban, groupBy-aware) ── */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {lanes.map(lane => {
            const colors = lane.colors || STATUS_COLORS['In Build']
            const colProjects = lane.projects
            const status = lane.key
            const hasNext = groupBy === 'status' && !!NEXT_STATUS[status]
            const isDropActive = dragOverLane === lane.key && lane.droppable

            return (
              <div
                key={lane.key}
                onDragOver={(e) => onLaneDragOver(e, lane.key, lane.droppable)}
                onDragLeave={onLaneDragLeave}
                onDrop={(e) => onLaneDrop(e, lane.key, lane.droppable)}
                className={`flex-shrink-0 w-72 rounded-lg transition-colors ${isDropActive ? 'bg-brand-blue/5 ring-2 ring-brand-blue/40 ring-inset' : ''} ${lane.faded ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <h3 className={`text-sm font-semibold ${colors.text}`}>{status}</h3>
                  <span className="text-xs text-gray-500 ml-auto">{colProjects.length}</span>
                </div>
                <div className="space-y-2">
                  {colProjects.map(project => (
                    <div
                      key={project.id}
                      draggable={groupBy === 'status'}
                      onDragStart={(e) => onCardDragStart(e, project.id)}
                      onClick={() => openProject(project)}
                      style={{cursor:"pointer"}}
                      className={`bg-navy-800 border rounded-xl p-4 hover:border-navy-500 transition-colors group ${project.portfolio_pinned ? 'border-amber-500/40' : 'border-navy-600'} ${groupBy === 'status' ? 'active:cursor-grabbing' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePinned(project.id, project.portfolio_pinned) }}
                            title={project.portfolio_pinned ? 'Unpin' : 'Pin to top'}
                            className={`flex-shrink-0 transition-colors ${project.portfolio_pinned ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400 opacity-0 group-hover:opacity-100'}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.366 2.445a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.175 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/>
                            </svg>
                          </button>
                          <Link
                            to={`/admin/projects/${project.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-semibold text-white hover:text-brand-blue transition-colors truncate"
                          >
                            {project.name}
                          </Link>
                        </div>
                        {hasNext && (
                          <button
                            onClick={(e) => { e.stopPropagation(); advanceStatus(project) }}
                            disabled={!!saving[project.id]}
                            title={`Advance to ${NEXT_STATUS[status]}`}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-0.5 rounded text-xs text-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 border border-brand-blue/30 disabled:opacity-40"
                          >
                            {saving[project.id] ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                          ) : (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            )}
                            Next
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        {clientLabel(project)}
                      </p>
                      {project.next_action && (
                        <div className="mb-3 px-2 py-1.5 rounded bg-navy-900/60 border border-navy-700/40">
                          <p className="text-[11px] text-gray-300 leading-snug line-clamp-2">{project.next_action}</p>
                          {(project.next_action_owner?.full_name || project.next_action_due) && (
                            <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                              {project.next_action_owner?.full_name && <span>{project.next_action_owner.full_name.split(' ')[0]}</span>}
                              {project.next_action_due && <span className="text-amber-400/80">{formatDate(project.next_action_due)}</span>}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        {project.tier && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            project.tier === 'Growth' ? 'bg-blue-500/20 text-blue-400' :
                            project.tier === 'Scale' ? 'bg-sky-500/20 text-sky-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {project.tier}
                          </span>
                        )}
                        {(() => {
                          const actual = project.mrr > 0
                          const amount = actual ? project.mrr : tierListPrice(project)
                          if (!amount) return null
                          return (
                            <span className={`text-xs font-medium ml-auto ${actual ? 'text-emerald-400' : 'text-gray-500'}`} title={actual ? 'Contracted MRR' : `Standard ${project.tier || ''} price`}>
                              ${amount.toLocaleString()}/mo
                            </span>
                          )
                        })()}
                      </div>
                      {project.progress > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-blue rounded-full transition-all"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 tabular-nums">{project.progress}%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

        </div>

      ) : (

        /* ── List View ── */
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
          {/* Status filter tabs */}
          <div className="flex gap-1 p-3 border-b border-navy-700/50 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === 'all'
                  ? 'bg-brand-blue/20 text-brand-blue'
                  : 'text-gray-400 hover:text-white hover:bg-navy-700'
              }`}
            >
              All ({projects.length})
            </button>
            {pinnedCount > 0 && (
              <button
                onClick={() => setStatusFilter('pinned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                  statusFilter === 'pinned'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-gray-400 hover:text-white hover:bg-navy-700'
                }`}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.366 2.445a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.175 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>
                Pinned ({pinnedCount})
              </button>
            )}
            {[...STATUS_PIPELINE, 'On Hold', 'Cancelled'].filter(s => statusCounts[s]).map(s => {
              const c = STATUS_COLORS[s]
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === s
                      ? `${c.bg} ${c.text}`
                      : 'text-gray-400 hover:text-white hover:bg-navy-700'
                  }`}
                >
                  {s} ({statusCounts[s]})
                </button>
              )
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700/50 bg-navy-900/30">
                  {[
                    { label: 'Project', key: 'name' },
                    { label: 'Customer', key: null },
                    { label: 'Next Action', key: 'next_action_due' },
                    { label: 'Tier', key: null },
                    { label: 'Status', key: 'status' },
                    { label: 'Progress', key: 'progress' },
                    { label: 'MRR', key: null },
                    { label: 'Created', key: 'date' },
                  ].map(col => (
                    <th key={col.label} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {col.key ? (
                        <button
                          onClick={() => {
                            if (sortBy === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                            else { setSortBy(col.key); setSortDir('desc') }
                          }}
                          className={`flex items-center gap-1 hover:text-white transition-colors ${sortBy === col.key ? 'text-brand-blue' : ''}`}
                        >
                          {col.label}
                          <svg className={`w-3 h-3 transition-transform ${sortBy === col.key && sortDir === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/30">
                {sorted.map(project => {
                  const tColor =
                    project.tier === 'Growth' ? 'bg-blue-500/20 text-blue-400' :
                    project.tier === 'Scale' ? 'bg-sky-500/20 text-sky-400' :
                    'bg-gray-500/20 text-gray-400'

                  return (
                    <tr key={project.id} className="hover:bg-navy-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => togglePinned(project.id, project.portfolio_pinned)}
                            title={project.portfolio_pinned ? 'Unpin' : 'Pin to top'}
                            className={`flex-shrink-0 transition-colors ${project.portfolio_pinned ? 'text-amber-400' : 'text-gray-700 hover:text-amber-400'}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.366 2.445a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.175 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/>
                            </svg>
                          </button>
                          <div>
                            <Link
                              to={`/admin/projects/${project.id}`}
                              className="text-sm font-medium text-white hover:text-brand-blue transition-colors"
                            >
                              {project.name}
                            </Link>
                            {project.project_type && (
                              <p className="text-xs text-gray-500 mt-0.5">{project.project_type}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {clientLabel(project)}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {project.next_action ? (
                          <div>
                            <p className="text-xs text-gray-300 leading-snug line-clamp-2">{project.next_action}</p>
                            {(project.next_action_owner?.full_name || project.next_action_due) && (
                              <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1.5">
                                {project.next_action_owner?.full_name && <span>{project.next_action_owner.full_name.split(' ')[0]}</span>}
                                {project.next_action_due && (
                                  <span className={`${new Date(project.next_action_due) < new Date() ? 'text-red-400' : 'text-amber-400/80'}`}>
                                    {formatDate(project.next_action_due)}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tColor}`}>
                          {project.tier || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusDropdown
                          project={project}
                          onUpdate={updateStatus}
                          saving={!!saving[project.id]}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-blue rounded-full transition-all"
                              style={{ width: `${project.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 tabular-nums">{project.progress || 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {project.mrr > 0 ? (
                          <span className="text-emerald-400 font-medium">
                            ${project.mrr.toLocaleString()}
                            <span className="text-xs text-gray-500 font-normal">/mo</span>
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(project.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-500 text-sm">
              No projects match this filter.
              <button onClick={() => setStatusFilter('all')} className="ml-2 text-brand-blue hover:underline">
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer count */}
      {view === 'list' && filtered.length > 0 && filtered.length !== projects.length && (
        <p className="text-xs text-gray-500 text-center">
          Showing {filtered.length} of {projects.length} projects
        </p>
      )}
    </div>
      {/* ── Project Detail Slide-out Panel (Wave D editable) ── */}
      {selectedProject && editForm && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 z-40" onClick={closeProject} />

          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-navy-900 border-l border-navy-700/50 z-50 flex flex-col shadow-2xl">

            {/* Panel Header */}
            <div className="flex items-start justify-between p-5 border-b border-navy-700/50 shrink-0">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-xs text-gray-500 font-mono mb-1">{selectedProject.id?.slice(0,8)}</p>
                <h2 className="text-base font-bold text-white leading-tight">{selectedProject.name || 'Untitled Project'}</h2>
                <p className="text-xs text-gray-400 mt-1">{clientLabel(selectedProject)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  to={`/admin/projects/${selectedProject.id}`}
                  className="text-xs px-2 py-1 rounded border border-navy-600 text-gray-400 hover:text-white hover:border-navy-500 transition-colors"
                  title="Open full detail page"
                >
                  Open
                </Link>
                <button onClick={closeProject} className="text-gray-400 hover:text-white p-1">
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Status + Tier strip */}
            <div className="px-5 py-3 border-b border-navy-700/50 flex items-center gap-2 flex-wrap shrink-0">
              {(() => {
                const sc = STATUS_COLORS[selectedProject.status] || STATUS_COLORS['In Build']
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {selectedProject.status || 'Unknown'}
                  </span>
                )
              })()}
              <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">{editForm.tier}</span>
              {selectedProject.project_type && (
                <span className="text-xs text-gray-400 bg-navy-800 px-2 py-0.5 rounded">{selectedProject.project_type}</span>
              )}
              <button
                onClick={() => setEditForm(f => ({ ...f, portfolio_pinned: !f.portfolio_pinned }))}
                className={`ml-auto text-xs flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${editForm.portfolio_pinned ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' : 'border-navy-600 text-gray-400 hover:text-amber-400'}`}
                title="Pin to top of board"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.366 2.445a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.445a1 1 0 00-1.175 0l-3.366 2.445c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>
                {editForm.portfolio_pinned ? 'Pinned' : 'Pin'}
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Status Actions */}
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const idx = STATUS_PIPELINE.indexOf(selectedProject.status)
                    const next = idx >= 0 && idx < STATUS_PIPELINE.length - 1 ? STATUS_PIPELINE[idx + 1] : null
                    const prev = idx > 0 ? STATUS_PIPELINE[idx - 1] : null
                    return (
                      <>
                        {next && (
                          <button
                            onClick={async () => {
                              await updateStatus(selectedProject.id, next)
                              setSelectedProject(p => p ? { ...p, status: next } : null)
                            }}
                            disabled={saving[selectedProject.id]}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                          >
                            Advance to {next}
                          </button>
                        )}
                        {prev && (
                          <button
                            onClick={async () => {
                              await updateStatus(selectedProject.id, prev)
                              setSelectedProject(p => p ? { ...p, status: prev } : null)
                            }}
                            disabled={saving[selectedProject.id]}
                            className="px-3 py-1.5 text-xs bg-navy-800 hover:bg-navy-700 text-gray-300 rounded-lg transition-colors"
                          >
                            Back to {prev}
                          </button>
                        )}
                        {selectedProject.status !== 'On Hold' && selectedProject.status !== 'Cancelled' && (
                          <button
                            onClick={async () => {
                              await updateStatus(selectedProject.id, 'On Hold')
                              setSelectedProject(p => p ? { ...p, status: 'On Hold' } : null)
                            }}
                            className="px-3 py-1.5 text-xs border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                          >
                            Hold
                          </button>
                        )}
                        {selectedProject.status !== 'Cancelled' && (
                          <button
                            onClick={async () => {
                              if (!window.confirm('Cancel this project?')) return
                              await updateStatus(selectedProject.id, 'Cancelled')
                              setSelectedProject(p => p ? { ...p, status: 'Cancelled' } : null)
                            }}
                            className="px-3 py-1.5 text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Next Action editor */}
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Next Action</p>
                <textarea
                  value={editForm.next_action}
                  onChange={e => setEditForm(f => ({ ...f, next_action: e.target.value }))}
                  rows={3}
                  placeholder="What's the next move?"
                  className="w-full bg-navy-800/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue resize-none"
                />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <select
                    value={editForm.next_action_owner_id}
                    onChange={e => setEditForm(f => ({ ...f, next_action_owner_id: e.target.value }))}
                    className="bg-navy-800/60 border border-navy-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-blue"
                  >
                    <option value="">No owner</option>
                    {profileList.map(p => (
                      <option key={p.id} value={p.id} style={{ background:'#0f172a' }}>{p.full_name || p.email}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={editForm.next_action_due}
                    onChange={e => setEditForm(f => ({ ...f, next_action_due: e.target.value }))}
                    className="bg-navy-800/60 border border-navy-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-blue"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              {/* Financial + Progress */}
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Financials & Progress</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Revenue booked</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                      <input
                        type="number" min="0" step="100"
                        value={editForm.revenue}
                        onChange={e => setEditForm(f => ({ ...f, revenue: e.target.value }))}
                        className="w-full bg-navy-800/60 border border-navy-700/50 rounded-lg pl-5 pr-2 py-1.5 text-sm text-white focus:outline-none focus:border-brand-blue"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">MRR</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                      <input
                        type="number" min="0" step="10"
                        value={editForm.mrr}
                        onChange={e => setEditForm(f => ({ ...f, mrr: e.target.value }))}
                        className="w-full bg-navy-800/60 border border-navy-700/50 rounded-lg pl-5 pr-8 py-1.5 text-sm text-white focus:outline-none focus:border-brand-blue"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">/mo</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-[10px] text-gray-500 block mb-1 flex justify-between"><span>Progress</span><span className="font-mono">{editForm.progress}%</span></label>
                  <input
                    type="range" min="0" max="100" step="5"
                    value={editForm.progress}
                    onChange={e => setEditForm(f => ({ ...f, progress: Number(e.target.value) }))}
                    className="w-full accent-brand-blue"
                  />
                </div>
                <div className="mt-3">
                  <label className="text-[10px] text-gray-500 block mb-1">Tier</label>
                  <div className="grid grid-cols-3 gap-1">
                    {['Starter', 'Growth', 'Scale'].map(t => (
                      <button
                        key={t}
                        onClick={() => setEditForm(f => ({ ...f, tier: t }))}
                        className={`py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          editForm.tier === t
                            ? (t === 'Scale' ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                              : t === 'Growth' ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                              : 'border-brand-blue bg-brand-blue/10 text-brand-blue')
                            : 'border-navy-700 text-gray-400 hover:border-navy-600'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Client display name */}
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Client Label</p>
                <input
                  value={editForm.client_display_name}
                  onChange={e => setEditForm(f => ({ ...f, client_display_name: e.target.value }))}
                  placeholder="Override label (e.g., City of Jacksonville)"
                  className="w-full bg-navy-800/60 border border-navy-700/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue"
                />
                <p className="text-[10px] text-gray-500 mt-1">Used when no customer profile exists (Jax CRM, BOLO-Go, gov bids, etc.)</p>
              </div>

              {/* Save button */}
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {savingEdit ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : 'Save Changes'}
              </button>

              {/* Admin Notes */}
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Admin Notes</p>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={4}
                  placeholder="Internal notes - visible only to Liftori team"
                  className="w-full bg-navy-800/60 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="px-4 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>

              {/* Quick links */}
              {(selectedProject.profiles?.email || selectedProject.customer_id) && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Quick Actions</p>
                  <div className="space-y-1.5">
                    {selectedProject.customer_id && (
                      <Link to={`/admin/customers/${selectedProject.customer_id}`} className="block px-3 py-2 text-xs bg-navy-800/60 hover:bg-navy-700 border border-navy-700/50 rounded-lg text-gray-300 hover:text-white transition-colors">
                        View customer profile
                      </Link>
                    )}
                    {selectedProject.profiles?.email && (
                      <a href={`mailto:${selectedProject.profiles.email}`} className="block px-3 py-2 text-xs bg-navy-800/60 hover:bg-navy-700 border border-navy-700/50 rounded-lg text-gray-300 hover:text-white transition-colors">
                        Email {selectedProject.profiles.email}
                      </a>
                    )}
                    <Link to={`/admin/projects/${selectedProject.id}`} className="block px-3 py-2 text-xs bg-navy-800/60 hover:bg-navy-700 border border-navy-700/50 rounded-lg text-gray-300 hover:text-white transition-colors">
                      Open full project page
                    </Link>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}

  </>
  )
}
