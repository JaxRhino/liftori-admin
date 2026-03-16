import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_ORDER = [
  'Wizard Complete',
  'Brief Review',
  'Design Approval',
  'In Build',
  'QA',
  'Launched',
  'On Hold',
  'Cancelled',
]

const STATUS_COLORS = {
  'Wizard Complete':  { bg: 'bg-slate-700',  text: 'text-slate-200',  dot: 'bg-slate-400'  },
  'Brief Review':     { bg: 'bg-yellow-900', text: 'text-yellow-300', dot: 'bg-yellow-400' },
  'Design Approval':  { bg: 'bg-purple-900', text: 'text-purple-300', dot: 'bg-purple-400' },
  'In Build':         { bg: 'bg-sky-900',    text: 'text-sky-300',    dot: 'bg-sky-400'    },
  'QA':               { bg: 'bg-orange-900', text: 'text-orange-300', dot: 'bg-orange-400' },
  'Launched':         { bg: 'bg-green-900',  text: 'text-green-300',  dot: 'bg-green-400'  },
  'On Hold':          { bg: 'bg-red-900',    text: 'text-red-300',    dot: 'bg-red-400'    },
  'Cancelled':        { bg: 'bg-gray-800',   text: 'text-gray-500',   dot: 'bg-gray-600'   },
}

const TIER_COLORS = {
  Starter: 'bg-slate-700 text-slate-300',
  Growth:  'bg-blue-900 text-blue-300',
  Scale:   'bg-violet-900 text-violet-300',
}

const COMPLEXITY_COLORS = {
  Low:    'text-green-400',
  Medium: 'text-yellow-400',
  High:   'text-orange-400',
}

const PIPELINE_STAGES = ['Wizard Complete', 'Brief Review', 'Design Approval', 'In Build', 'QA', 'Launched']

export default function Pipeline() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setProjects(data || [])
    } catch (err) {
      console.error('Error fetching pipeline:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Derived stats
  const activeProjects = projects.filter(p => !['Cancelled', 'Launched'].includes(p.status))
  const inBuild = projects.filter(p => p.status === 'In Build')
  const launched = projects.filter(p => p.status === 'Launched')

  const pipelineValue = projects
    .filter(p => !['Cancelled'].includes(p.status))
    .reduce((sum, p) => {
      const val = parseFloat((p.estimated_cost || '0').replace(/[^0-9.]/g, ''))
      return sum + (isNaN(val) ? 0 : val)
    }, 0)

  const avgProgress = activeProjects.length > 0
    ? Math.round(activeProjects.reduce((s, p) => s + (p.progress || 0), 0) / activeProjects.length)
    : 0

  // Filter + sort
  const filtered = projects
    .filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        const name = (p.name || '').toLowerCase()
        const customer = (p.profiles?.full_name || p.profiles?.email || '').toLowerCase()
        if (!name.includes(q) && !customer.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      if (sortField === 'customer') {
        aVal = a.profiles?.full_name || a.profiles?.email || ''
        bVal = b.profiles?.full_name || b.profiles?.email || ''
      }
      if (sortField === 'status') {
        aVal = STATUS_ORDER.indexOf(a.status)
        bVal = STATUS_ORDER.indexOf(b.status)
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  function SortIcon({ field }) {
    if (sortField !== field) return <span className="text-slate-600 ml-1">↕</span>
    return <span className="text-sky-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function formatCost(val) {
    if (!val) return '—'
    return val.startsWith('$') ? val : `$${val}`
  }

  if (loading) return (
    <div className="p-6 text-slate-400 flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      Loading pipeline...
    </div>
  )

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline</h1>
          <p className="text-slate-400 text-sm mt-1">Build estimates, project queue, and status across all active work</p>
        </div>
        <button
          onClick={fetchProjects}
          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Projects', value: activeProjects.length, sub: `${projects.length} total`, color: 'text-sky-400' },
          { label: 'In Build', value: inBuild.length, sub: 'actively building', color: 'text-orange-400' },
          { label: 'Pipeline Value', value: `$${Math.round(pipelineValue).toLocaleString()}`, sub: 'excl. cancelled', color: 'text-green-400' },
          { label: 'Avg Progress', value: `${avgProgress}%`, sub: 'active projects', color: 'text-purple-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-xs uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            <p className="text-slate-500 text-xs mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Stage Bar */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">Pipeline Funnel</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {PIPELINE_STAGES.map(stage => {
            const count = projects.filter(p => p.status === stage).length
            const colors = STATUS_COLORS[stage]
            return (
              <button
                key={stage}
                onClick={() => setFilterStatus(filterStatus === stage ? 'all' : stage)}
                className={`rounded-lg p-3 text-center transition-all border ${
                  filterStatus === stage
                    ? 'border-sky-500 ring-1 ring-sky-500'
                    : 'border-slate-700 hover:border-slate-500'
                } ${colors.bg}`}
              >
                <p className={`text-2xl font-bold ${colors.text}`}>{count}</p>
                <p className={`text-xs mt-1 ${colors.text} opacity-80`}>{stage}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Search + Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by project or customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
        >
          <option value="all">All Statuses</option>
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Projects Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-slate-200 select-none"
                  onClick={() => handleSort('name')}
                >
                  Project <SortIcon field="name" />
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-slate-200 select-none"
                  onClick={() => handleSort('customer')}
                >
                  Customer <SortIcon field="customer" />
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-slate-200 select-none"
                  onClick={() => handleSort('tier')}
                >
                  Tier <SortIcon field="tier" />
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-slate-200 select-none"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-slate-200 select-none"
                  onClick={() => handleSort('estimated_cost')}
                >
                  Est. Cost <SortIcon field="estimated_cost" />
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-slate-200 select-none"
                  onClick={() => handleSort('complexity')}
                >
                  Complexity <SortIcon field="complexity" />
                </th>
                <th className="text-left px-4 py-3">Progress</th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-slate-200 select-none"
                  onClick={() => handleSort('created_at')}
                >
                  Created <SortIcon field="created_at" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    {search || filterStatus !== 'all' ? 'No projects match your filters.' : 'No projects in the pipeline yet.'}
                  </td>
                </tr>
              ) : filtered.map(project => {
                const statusColor = STATUS_COLORS[project.status] || STATUS_COLORS['Wizard Complete']
                const tierColor = TIER_COLORS[project.tier] || TIER_COLORS['Starter']
                const complexityColor = COMPLEXITY_COLORS[project.complexity] || 'text-slate-400'
                const customer = project.profiles?.full_name || project.profiles?.email || '—'
                const progress = project.progress || 0

                return (
                  <tr key={project.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-slate-200 font-medium">{project.name || 'Unnamed Project'}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{project.project_type || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{customer}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${tierColor}`}>
                        {project.tier || 'Starter'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                        {project.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                      {formatCost(project.estimated_cost)}
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium ${complexityColor}`}>
                      {project.complexity || '—'}
                    </td>
                    <td className="px-4 py-3 min-w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                          <div
                            className="bg-sky-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-slate-400 text-xs w-8 text-right">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-700 text-slate-500 text-xs">
            Showing {filtered.length} of {projects.length} projects
          </div>
        )}
      </div>

      {/* Build Queue — In Build projects highlighted */}
      {inBuild.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-sky-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <p className="text-sky-400 text-sm font-semibold">Active Build Queue ({inBuild.length})</p>
          </div>
          <div className="space-y-2">
            {inBuild.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 bg-slate-700/50 rounded-lg px-4 py-3">
                <span className="text-slate-500 text-xs font-mono w-4">#{i + 1}</span>
                <div className="flex-1">
                  <p className="text-slate-200 text-sm font-medium">{p.name || 'Unnamed Project'}</p>
                  <p className="text-slate-400 text-xs">{p.profiles?.full_name || p.profiles?.email || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sky-400 text-xs font-mono">{formatCost(p.estimated_cost)}</p>
                  <p className="text-slate-500 text-xs">{p.progress || 0}% complete</p>
                </div>
                <div className="w-24">
                  <div className="bg-slate-600 rounded-full h-1.5">
                    <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${p.progress || 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Launched */}
      {launched.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-green-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <p className="text-green-400 text-sm font-semibold">Launched ({launched.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {launched.map(p => (
              <div key={p.id} className="bg-green-900/30 border border-green-900 rounded-lg px-3 py-2">
                <p className="text-green-300 text-sm font-medium">{p.name || 'Unnamed'}</p>
                <p className="text-green-700 text-xs">{p.profiles?.full_name || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
