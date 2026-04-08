import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

export default function PortalDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [updates, setUpdates] = useState([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  async function fetchData() {
    try {
      // Fetch customer's projects
      const { data: projectData } = await supabase
        .from('projects')
        .select('*, milestones(id, name, completed, due_date, sort_order)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      setProjects(projectData || [])

      // Fetch recent project updates
      if (projectData?.length) {
        const projectIds = projectData.map(p => p.id)
        const { data: updateData } = await supabase
          .from('project_updates')
          .select('*, projects(name)')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(5)

        setUpdates(updateData || [])
      }

      // Count unread messages in client DM channel
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('channel_type', 'client_dm')
        .eq('customer_id', user.id)
        .limit(1)
        .single()

      if (channel) {
        const { count } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('channel_id', channel.id)
          .neq('sender_id', user.id)

        setUnreadMessages(count || 0)
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  function getStatusColor(status) {
    const colors = {
      'Waitlist': 'bg-sky-500/20 text-sky-400',
      'Wizard Complete': 'bg-gray-500/20 text-gray-400',
      'Brief Review': 'bg-yellow-500/20 text-yellow-400',
      'Design Approval': 'bg-purple-500/20 text-purple-400',
      'In Build': 'bg-brand-blue/20 text-brand-blue',
      'QA': 'bg-orange-500/20 text-orange-400',
      'Launched': 'bg-green-500/20 text-green-400',
      'On Hold': 'bg-red-500/20 text-red-400',
      'Cancelled': 'bg-red-500/20 text-red-400'
    }
    return colors[status] || 'bg-gray-500/20 text-gray-400'
  }

  function getUpdateIcon(type) {
    switch (type) {
      case 'milestone': return (
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )
      case 'progress': return (
        <div className="w-8 h-8 rounded-full bg-brand-blue/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>
      )
      case 'alert': return (
        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
      )
      case 'launch': return (
        <div className="w-8 h-8 rounded-full bg-brand-cyan/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-brand-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
        </div>
      )
      default: return (
        <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </div>
      )
    }
  }

  function formatDate(dateStr) {
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

    if (diffMin < 1) return 'Just now'
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

  const activeProject = projects.find(p => !['Launched', 'Cancelled'].includes(p.status))
  const completedMilestones = activeProject?.milestones?.filter(m => m.completed).length || 0
  const totalMilestones = activeProject?.milestones?.length || 0

  return (
    <div className="p-8 max-w-6xl">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-gray-400 text-sm mt-1">Here's an overview of your project status</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projects</p>
          <p className="text-2xl font-bold text-white mt-1">{projects.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</p>
          <p className="text-2xl font-bold text-brand-blue mt-1">
            {projects.filter(p => !['Launched', 'Cancelled', 'On Hold'].includes(p.status)).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Milestones Done</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {completedMilestones}/{totalMilestones}
          </p>
        </div>
        <button
          onClick={() => navigate('/portal/messages')}
          className="stat-card text-left hover:border-brand-blue/30 transition-colors"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Messages</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold text-white">{unreadMessages}</p>
            {unreadMessages > 0 && (
              <span className="text-xs bg-brand-blue text-white px-2 py-0.5 rounded-full">New</span>
            )}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Your Projects</h2>
          {projects.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <p className="text-gray-400">No projects yet</p>
              <p className="text-gray-600 text-sm mt-1">Your projects will appear here once your build begins</p>
            </div>
          ) : (
            projects.map(project => {
              const milestones = project.milestones || []
              const done = milestones.filter(m => m.completed).length
              const total = milestones.length
              const progressPct = project.progress || (total > 0 ? Math.round((done / total) * 100) : 0)

              return (
                <button
                  key={project.id}
                  onClick={() => navigate('/portal/project')}
                  className="card w-full text-left hover:border-brand-blue/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-white">{project.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{project.project_type} &middot; {project.tier} Tier</p>
                    </div>
                    <span className={`badge ${getStatusColor(project.status)}`}>{project.status}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-blue rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones summary */}
                  {total > 0 && (
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {done} of {total} milestones
                      </span>
                      {project.created_at && (
                        <span>Started {formatDate(project.created_at)}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Recent Updates */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Updates</h2>
          {updates.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-500 text-sm">No updates yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {updates.map(update => (
                <div key={update.id} className="card !p-4">
                  <div className="flex gap-3">
                    {getUpdateIcon(update.update_type)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{update.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{update.body}</p>
                      <p className="text-xs text-gray-600 mt-1">{formatRelative(update.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
