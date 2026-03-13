import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

export default function PortalProject() {
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchProject()
  }, [user])

  async function fetchProject() {
    try {
      // Get the customer's primary/active project
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const proj = projects?.[0]
      if (!proj) {
        setLoading(false)
        return
      }
      setProject(proj)

      // Fetch milestones
      const { data: msData } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', proj.id)
        .order('sort_order', { ascending: true })

      setMilestones(msData || [])

      // Fetch updates
      const { data: updData } = await supabase
        .from('project_updates')
        .select('*')
        .eq('project_id', proj.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setUpdates(updData || [])
    } catch (err) {
      console.error('Error fetching project:', err)
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status) {
    const colors = {
      'Wizard Complete': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      'Brief Review': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Design Approval': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'In Build': 'bg-brand-blue/20 text-brand-blue border-brand-blue/30',
      'QA': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Launched': 'bg-green-500/20 text-green-400 border-green-500/30',
      'On Hold': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Cancelled': 'bg-red-500/20 text-red-400 border-red-500/30'
    }
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  function getStatusStep(status) {
    const steps = ['Wizard Complete', 'Brief Review', 'Design Approval', 'In Build', 'QA', 'Launched']
    return steps.indexOf(status)
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  function formatRelative(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay < 7) return `${diffDay}d ago`
    return formatDate(dateStr)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8 max-w-4xl">
        <h1 className="text-2xl font-bold text-white mb-6">My Project</h1>
        <div className="card text-center py-16">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-400">No project found</h2>
          <p className="text-gray-600 text-sm mt-2">Your project details will appear here once your build kicks off.</p>
        </div>
      </div>
    )
  }

  const progressPct = project.progress || 0
  const completedMs = milestones.filter(m => m.completed).length
  const steps = ['Wizard Complete', 'Brief Review', 'Design Approval', 'In Build', 'QA', 'Launched']
  const currentStepIdx = getStatusStep(project.status)

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {project.project_type} &middot; {project.tier} Tier
            {project.created_at && <> &middot; Started {formatDate(project.created_at)}</>}
          </p>
        </div>
        <span className={`badge text-sm px-3 py-1 border ${getStatusColor(project.status)}`}>
          {project.status}
        </span>
      </div>

      {/* Pipeline Tracker */}
      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Build Pipeline</h2>
        <div className="flex items-center gap-0">
          {steps.map((step, idx) => {
            const isComplete = idx < currentStepIdx || project.status === 'Launched'
            const isCurrent = idx === currentStepIdx && project.status !== 'Launched'

            return (
              <div key={step} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 transition-colors ${
                    isComplete ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-brand-blue text-white ring-4 ring-brand-blue/20' :
                    'bg-navy-700 text-gray-500'
                  }`}>
                    {isComplete ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`text-xs text-center leading-tight ${
                    isCurrent ? 'text-brand-blue font-semibold' :
                    isComplete ? 'text-green-400' :
                    'text-gray-600'
                  }`}>
                    {step}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 -mx-1 ${
                    isComplete ? 'bg-green-500' : 'bg-navy-700'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Progress + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Progress</h2>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Overall completion</span>
              <span className="text-white font-semibold">{progressPct}%</span>
            </div>
            <div className="h-3 bg-navy-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-blue to-brand-cyan rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {project.brief && (
            <div className="mt-4 pt-4 border-t border-navy-700/50">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Project Brief</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{project.brief}</p>
            </div>
          )}

          {project.features && project.features.length > 0 && (
            <div className="mt-4 pt-4 border-t border-navy-700/50">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Key Features</h3>
              <div className="flex flex-wrap gap-2">
                {project.features.map((f, i) => (
                  <span key={i} className="text-xs bg-navy-700 text-gray-300 px-3 py-1 rounded-full">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Details</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-600">Type</p>
              <p className="text-sm text-white">{project.project_type || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Tier</p>
              <p className="text-sm text-white">{project.tier || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Timeline</p>
              <p className="text-sm text-white">{project.timeline_pref || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Budget</p>
              <p className="text-sm text-white">{project.budget_range || '—'}</p>
            </div>
            {project.estimated_cost && (
              <div>
                <p className="text-xs text-gray-600">Estimated Cost</p>
                <p className="text-sm text-brand-blue font-semibold">{project.estimated_cost}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Milestones</h2>
          <span className="text-xs text-gray-500">{completedMs} of {milestones.length} complete</span>
        </div>
        {milestones.length === 0 ? (
          <p className="text-sm text-gray-600 py-4 text-center">Milestones will be added once your build begins</p>
        ) : (
          <div className="space-y-2">
            {milestones.map((ms, idx) => (
              <div
                key={ms.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  ms.completed ? 'bg-green-500/5' : 'bg-navy-900/50'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  ms.completed ? 'bg-green-500' : 'border-2 border-navy-600'
                }`}>
                  {ms.completed && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${ms.completed ? 'text-green-400' : 'text-white'}`}>{ms.name}</p>
                  {ms.description && <p className="text-xs text-gray-500 mt-0.5">{ms.description}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  {ms.completed && ms.completed_at ? (
                    <span className="text-xs text-green-400/70">{formatDate(ms.completed_at)}</span>
                  ) : ms.due_date ? (
                    <span className="text-xs text-gray-500">Due {formatDate(ms.due_date)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Updates */}
      {updates.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Recent Updates</h2>
          <div className="space-y-4">
            {updates.map(upd => (
              <div key={upd.id} className="flex gap-3 pb-4 border-b border-navy-700/50 last:border-0 last:pb-0">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  upd.update_type === 'milestone' ? 'bg-green-400' :
                  upd.update_type === 'launch' ? 'bg-brand-cyan' :
                  upd.update_type === 'alert' ? 'bg-yellow-400' :
                  'bg-brand-blue'
                }`} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-white">{upd.title}</p>
                    <span className="text-xs text-gray-600">{formatRelative(upd.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{upd.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
