import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_ORDER = ['Brief Review', 'Design Approval', 'In Build', 'QA', 'Launched', 'On Hold', 'Cancelled', 'Wizard Complete']
const STATUS_COLORS = {
  'Wizard Complete': { bg: 'bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-400' },
  'Brief Review': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  'Design Approval': { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-400' },
  'In Build': { bg: 'bg-brand-blue/20', text: 'text-brand-blue', dot: 'bg-brand-blue' },
  'QA': { bg: 'bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-400' },
  'Launched': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  'On Hold': { bg: 'bg-gray-500/20', text: 'text-gray-500', dot: 'bg-gray-500' },
  'Cancelled': { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-400' }
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('pipeline')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const filtered = statusFilter === 'all'
    ? projects
    : projects.filter(p => p.status === statusFilter)

  const statusCounts = {}
  projects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1
  })

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-gray-400 text-sm mt-1">{projects.length} total projects</p>
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
          <Link to="/waitlist" className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            From Waitlist
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-gray-400 text-sm mb-6">Convert a waitlist signup to create your first project.</p>
          <Link to="/waitlist" className="btn-primary inline-flex items-center gap-2">
            Go to Waitlist
          </Link>
        </div>
      ) : view === 'pipeline' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_ORDER.filter(s => statusCounts[s]).map(status => {
            const colors = STATUS_COLORS[status] || STATUS_COLORS['Wizard Complete']
            const statusProjects = projects.filter(p => p.status === status)

            return (
              <div key={status} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <h3 className={`text-sm font-semibold ${colors.text}`}>{status}</h3>
                  <span className="text-xs text-gray-500 ml-auto">{statusProjects.length}</span>
                </div>
                <div className="space-y-2">
                  {statusProjects.map(project => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="card p-4 block hover:border-navy-500 transition-colors"
                    >
                      <p className="text-sm font-semibold text-white mb-1 truncate">{project.name}</p>
                      <p className="text-xs text-gray-400 mb-2">{project.profiles?.full_name || 'Unassigned'}</p>
                      <div className="flex items-center justify-between">
                        <span className={`badge ${colors.bg} ${colors.text}`}>{project.tier}</span>
                        {project.progress > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-blue rounded-full" style={{ width: `${project.progress}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{project.progress}%</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="flex gap-1 p-3 border-b border-navy-700/50 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === 'all' ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white hover:bg-navy-700'
              }`}
            >
              All ({projects.length})
            </button>
            {STATUS_ORDER.filter(s => statusCounts[s]).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? `${STATUS_COLORS[status].bg} ${STATUS_COLORS[status].text}`
                    : 'text-gray-400 hover:text-white hover:bg-navy-700'
                }`}
              >
                {status} ({statusCounts[status]})
              </button>
            ))}
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(project => {
                const colors = STATUS_COLORS[project.status] || STATUS_COLORS['Wizard Complete']
                return (
                  <tr key={project.id} className="table-row">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${project.id}`} className="text-sm font-medium text-white hover:text-brand-blue transition-colors">
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{project.profiles?.full_name || project.profiles?.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{project.project_type}</td>
                    <td className="px-4 py-3"><span className="badge bg-navy-700 text-gray-300">{project.tier}</span></td>
                    <td className="px-4 py-3"><span className={`badge ${colors.bg} ${colors.text}`}>{project.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-blue rounded-full transition-all" style={{ width: `${project.progress}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(project.created_at).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
