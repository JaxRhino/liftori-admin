import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const statusColors = {
  'Waitlist': 'bg-sky-500/20 text-sky-400',
  'Wizard Complete': 'bg-yellow-500/20 text-yellow-400',
  'Brief Review': 'bg-blue-500/20 text-blue-400',
  'Design Approval': 'bg-purple-500/20 text-purple-400',
  'In Build': 'bg-brand-blue/20 text-brand-blue',
  'QA': 'bg-orange-500/20 text-orange-400',
  'Launched': 'bg-green-500/20 text-green-400',
  'On Hold': 'bg-white/10 text-white/50',
  'Cancelled': 'bg-red-500/20 text-red-400'
}

export default function PortalProjects() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [updates, setUpdates] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (user) fetchProjects()
  }, [user])

  async function fetchProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      console.error('Error fetching projects:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleProjectClick(project) {
    setSelectedProject(project)
    setDetailLoading(true)
    try {
      const [msRes, upRes] = await Promise.all([
        supabase
          .from('milestones')
          .select('*')
          .eq('project_id', project.id)
          .order('order_index', { ascending: true }),
        supabase
          .from('project_updates')
          .select('*, profiles(full_name)')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false })
          .limit(10)
      ])
      setMilestones(msRes.data || [])
      setUpdates(upRes.data || [])
    } catch (err) {
      console.error('Error fetching project details:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setSelectedProject(null)
    setMilestones([])
    setUpdates([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">My Projects</h1>
          <p className="text-white/50 text-sm mt-1">
            {projects.length === 0 ? 'No projects yet \u2014 start your first build!' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => navigate('/portal/new-project')}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Project
        </button>
      </div>

      {/* Project Grid */}
      {projects.length === 0 ? (
        <div className="bg-navy-800/50 border border-white/5 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-blue/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Start Your First Project</h3>
          <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">
            Tell us about your idea and we'll bring it to life. Our team will guide you through every step.
          </p>
          <button
            onClick={() => navigate('/portal/new-project')}
            className="px-6 py-2.5 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Start a Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className="bg-navy-800/50 border border-white/5 rounded-xl p-5 text-left hover:border-brand-blue/30 hover:bg-navy-800/80 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold text-white group-hover:text-brand-blue transition-colors">
                  {project.name}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[project.status] || 'bg-white/10 text-white/50'}`}>
                  {project.status}
                </span>
              </div>
              <p className="text-xs text-white/40 mb-4">
                {project.project_type} \u00B7 {project.tier} Tier
              </p>
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Progress</span>
                  <span className="text-xs font-medium text-brand-blue">{project.progress || 0}%</span>
                </div>
                <div className="w-full bg-navy-900 rounded-full h-1.5">
                  <div
                    className="bg-brand-blue h-1.5 rounded-full transition-all"
                    style={{ width: `${project.progress || 0}%` }}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeDetail}>
          <div
            className="bg-navy-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-navy-900 border-b border-white/5 p-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white font-heading">{selectedProject.name}</h2>
                <p className="text-sm text-white/40 mt-1">
                  {selectedProject.project_type} \u00B7 {selectedProject.tier} Tier
                </p>
              </div>
              <button onClick={closeDetail} className="p-1 text-white/40 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Status & Progress */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-navy-800/50 rounded-lg p-4">
                      <p className="text-xs text-white/40 mb-1">Status</p>
                      <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${statusColors[selectedProject.status] || 'bg-white/10 text-white/50'}`}>
                        {selectedProject.status}
                      </span>
                    </div>
                    <div className="bg-navy-800/50 rounded-lg p-4">
                      <p className="text-xs text-white/40 mb-1">Progress</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-navy-900 rounded-full h-2">
                          <div
                            className="bg-brand-blue h-2 rounded-full transition-all"
                            style={{ width: `${selectedProject.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-white">{selectedProject.progress || 0}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {selectedProject.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Description</h3>
                      <p className="text-sm text-white/60">{selectedProject.description}</p>
                    </div>
                  )}

                  {/* Milestones */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Milestones</h3>
                    {milestones.length === 0 ? (
                      <p className="text-sm text-white/40">No milestones set yet</p>
                    ) : (
                      <div className="space-y-2">
                        {milestones.map((ms) => (
                          <div key={ms.id} className="flex items-center gap-3 p-3 bg-navy-800/50 rounded-lg">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${ms.completed ? 'bg-green-500/20' : 'bg-white/5'}`}>
                              {ms.completed ? (
                                <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-white/20" />
                              )}
                            </div>
                            <span className={`text-sm ${ms.completed ? 'text-white/40 line-through' : 'text-white/80'}`}>
                              {ms.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Updates */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Recent Updates</h3>
                    {updates.length === 0 ? (
                      <p className="text-sm text-white/40">No updates yet</p>
                    ) : (
                      <div className="space-y-3">
                        {updates.map((update) => (
                          <div key={update.id} className="p-3 bg-navy-800/50 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-brand-blue">
                                {update.profiles?.full_name || 'Liftori Team'}
                              </span>
                              <span className="text-xs text-white/30">
                                {new Date(update.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-white/70">{update.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
