import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_PIPELINE = [
  'Wizard Complete',
  'Brief Review',
  'Design Approval',
  'In Build',
  'QA',
  'Launched',
]

const STATUS_ALL = [...STATUS_PIPELINE, 'On Hold', 'Cancelled']

const STATUS_COLORS = {
  'Wizard Complete':  { bg: 'bg-gray-500/20',    text: 'text-gray-400',    dot: 'bg-gray-400',    ring: 'ring-gray-500/40' },
  'Brief Review':     { bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  dot: 'bg-yellow-400',  ring: 'ring-yellow-500/40' },
  'Design Approval':  { bg: 'bg-purple-500/20',  text: 'text-purple-400',  dot: 'bg-purple-400',  ring: 'ring-purple-500/40' },
  'In Build':         { bg: 'bg-brand-blue/20',  text: 'text-brand-blue',  dot: 'bg-brand-blue',  ring: 'ring-brand-blue/40' },
  'QA':               { bg: 'bg-orange-500/20',  text: 'text-orange-400',  dot: 'bg-orange-400',  ring: 'ring-orange-500/40' },
  'Launched':         { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', ring: 'ring-emerald-500/40' },
  'On Hold':          { bg: 'bg-gray-500/20',    text: 'text-gray-500',    dot: 'bg-gray-500',    ring: 'ring-gray-600/40' },
  'Cancelled':        { bg: 'bg-red-500/20',     text: 'text-red-400',     dot: 'bg-red-400',     ring: 'ring-red-500/40' },
}

const NEXT_STATUS = {
  'Wizard Complete': 'Brief Review',
  'Brief Review':    'Design Approval',
  'Design Approval': 'In Build',
  'In Build':        'QA',
  'QA':              'Launched',
}

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
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-all
          ${colors.bg} ${colors.text}
          ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 ' + colors.ring + ' cursor-pointer'}
        `}
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
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors
                  ${isCurrent ? 'bg-navy-700/60 ' + c.text : 'text-gray-400 hover:bg-navy-800 hover:text-white'}
                `}
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

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all
      ${type === 'success' ? 'bg-emerald-900/90 text-emerald-300 border border-emerald-700/50' : 'bg-red-900/90 text-red-300 border border-red-700/50'}
    `}>
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

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('pipeline')
  const [statusFilter, setStatusFilter] = useState('all')
  const [saving, setSaving] = useState({}) // { [projectId]: true }
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, profiles!projects_customer_id_fkey(full_name, email)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      console.error('Error fetching projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

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
      if (newStatus === 'Launched' && !prev.launched_at) {
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
  const inBuildCount = projects.filter(p => p.status === 'In Build').length
  const launchedCount = projects.filter(p => p.status === 'Launched').length

  const filtered = statusFilter === 'all' ? projects : projects.filter(p => p.status === statusFilter)
  const statusCounts = {}
  projects.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1 })

  const activePipelineStatuses = STATUS_PIPELINE.filter(s => statusCounts[s])

  function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Projects</h1>
          <p className="text-sm text-gray-400 mt-1">{projects.length} total project{projects.length !== 1 ? 's' : ''}</p>
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
          <button
            onClick={fetchProjects}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-navy-700/50 rounded-lg hover:border-navy-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <Link to="/admin/waitlist" className="btn-primary flex items-center gap-2 text-sm px-3 py-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            From Waitlist
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Projects</p>
          <p className="text-3xl font-bold text-white mt-2">{projects.length}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">In Build</p>
          <p className="text-3xl font-bold text-brand-blue mt-2">{inBuildCount}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Launched</p>
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

      {projects.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl text-center py-16">
          <svg className="w-14 h-14 mx-auto text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-gray-400 text-sm mb-6">Convert a waitlist signup to create your first project.</p>
          <Link to="/admin/waitlist" className="btn-primary inline-flex items-center gap-2">Go to Waitlist</Link>
        </div>

      ) : view === 'pipeline' ? (
        /* ── Pipeline View ── */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {activePipelineStatuses.map(status => {
            const colors = STATUS_COLORS[status]
            const colProjects = projects.filter(p => p.status === status)
            const hasNext = !!NEXT_STATUS[status]
            return (
              <div key={status} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <h3 className={`text-sm font-semibold ${colors.text}`}>{status}</h3>
                  <span className="text-xs text-gray-500 ml-auto">{colProjects.length}</span>
                </div>
                <div className="space-y-2">
                  {colProjects.map(project => (
                    <div key={project.id} className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 hover:border-navy-500 transition-colors group">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <Link
                          to={`/admin/projects/${project.id}`}
                          className="text-sm font-semibold text-white hover:text-brand-blue transition-colors truncate"
                        >
                          {project.name}
                        </Link>
                        {hasNext && (
                          <button
                            onClick={() => advanceStatus(project)}
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
                      <p className="text-xs text-gray-400 mb-3">
                        {project.profiles?.full_name || project.profiles?.email || 'Unassigned'}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          project.tier === 'Growth' ? 'bg-blue-500/20 text-blue-400' :
                          project.tier === 'Scale'  ? 'bg-purple-500/20 text-purple-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {project.tier}
                        </span>
                        {project.mrr > 0 && (
                          <span className="text-xs text-emerald-400 font-medium">
                            ${project.mrr.toLocaleString()}/mo
                          </span>
                        )}
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

          {/* On Hold + Cancelled columns if they have items */}
          {['On Hold', 'Cancelled'].filter(s => statusCounts[s]).map(status => {
            const colors = STATUS_COLORS[status]
            return (
              <div key={status} className="flex-shrink-0 w-72 opacity-60">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <h3 className={`text-sm font-semibold ${colors.text}`}>{status}</h3>
                  <span className="text-xs text-gray-500 ml-auto">{statusCounts[status]}</span>
                </div>
                <div className="space-y-2">
                  {projects.filter(p => p.status === status).map(project => (
                    <div key={project.id} className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
                      <Link to={`/admin/projects/${project.id}`} className="text-sm font-medium text-gray-400 hover:text-white truncate block">
                        {project.name}
                      </Link>
                      <p className="text-xs text-gray-600 mt-1">
                        {project.profiles?.full_name || '—'}
                      </p>
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
                statusFilter === 'all' ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white hover:bg-navy-700'
              }`}
            >
              All ({projects.length})
            </button>
            {[...STATUS_PIPELINE, 'On Hold', 'Cancelled'].filter(s => statusCounts[s]).map(s => {
              const c = STATUS_COLORS[s]
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === s ? `${c.bg} ${c.text}` : 'text-gray-400 hover:text-white hover:bg-navy-700'
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">MRR</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/30">
                {filtered.map(project => {
                  const tColor =
                    project.tier === 'Growth' ? 'bg-blue-500/20 text-blue-400' :
                    project.tier === 'Scale'  ? 'bg-purple-500/20 text-purple-400' :
                    'bg-gray-500/20 text-gray-400'

                  return (
                    <tr key={project.id} className="hover:bg-navy-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/projects/${project.id}`}
                          className="text-sm font-medium text-white hover:text-brand-blue transition-colors"
                        >
                          {project.name}
                        </Link>
                        {project.project_type && (
                          <p className="text-xs text-gray-500 mt-0.5">{project.project_type}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {project.profiles?.full_name || project.profiles?.email || '—'}
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
  )
}
