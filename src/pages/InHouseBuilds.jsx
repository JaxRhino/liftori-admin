import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS = {
  planning: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-orange-500/20 text-orange-400',
  completed: 'bg-sky-500/20 text-sky-400',
  archived: 'bg-slate-500/20 text-slate-400',
}

const PRIORITY_COLORS = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-slate-500/20 text-slate-400',
}

export default function InHouseBuilds() {
  const [builds, setBuilds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newBuild, setNewBuild] = useState({ name: '', codename: '', description: '', priority: 'medium' })
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchBuilds() }, [])

  async function fetchBuilds() {
    try {
      const { data, error } = await supabase
        .from('inhouse_builds')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      setBuilds(data || [])
    } catch (err) {
      console.error('Error fetching builds:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newBuild.name.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('inhouse_builds')
        .insert({
          name: newBuild.name,
          codename: newBuild.codename || null,
          description: newBuild.description || null,
          priority: newBuild.priority,
          status: 'planning',
        })
      if (error) throw error
      setShowNewModal(false)
      setNewBuild({ name: '', codename: '', description: '', priority: 'medium' })
      fetchBuilds()
    } catch (err) {
      console.error('Error creating build:', err)
    } finally {
      setSaving(false)
    }
  }

  const activeBuilds = builds.filter(b => b.status === 'active')
  const otherBuilds = builds.filter(b => b.status !== 'active')

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">In-House Builds</h1>
          <p className="text-slate-400 text-sm mt-1">Internal platforms and products — not client projects</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Build
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Builds', value: builds.length, color: 'text-white' },
          { label: 'Active', value: builds.filter(b => b.status === 'active').length, color: 'text-green-400' },
          { label: 'Critical Priority', value: builds.filter(b => b.priority === 'critical').length, color: 'text-red-400' },
          { label: 'Avg Progress', value: builds.length ? Math.round(builds.reduce((a, b) => a + (b.progress || 0), 0) / builds.length) + '%' : '0%', color: 'text-sky-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-navy-800 border border-navy-700/50 rounded-lg p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Active Builds */}
      {activeBuilds.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Active Builds</h2>
          <div className="space-y-3">
            {activeBuilds.map(build => (
              <BuildCard key={build.id} build={build} onClick={() => navigate(`/admin/builds/${build.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Other Builds */}
      {otherBuilds.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {activeBuilds.length > 0 ? 'Other Builds' : 'All Builds'}
          </h2>
          <div className="space-y-3">
            {otherBuilds.map(build => (
              <BuildCard key={build.id} build={build} onClick={() => navigate(`/admin/builds/${build.id}`)} />
            ))}
          </div>
        </div>
      )}

      {builds.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-lg">No in-house builds yet</p>
          <p className="text-sm mt-1">Create your first internal platform build</p>
        </div>
      )}

      {/* New Build Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">New In-House Build</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Name *</label>
                <input
                  type="text" value={newBuild.name}
                  onChange={e => setNewBuild({ ...newBuild, name: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  placeholder="e.g. Liftori Phoenix"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Codename</label>
                <input
                  type="text" value={newBuild.codename}
                  onChange={e => setNewBuild({ ...newBuild, codename: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  placeholder="e.g. phoenix"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Description</label>
                <textarea
                  value={newBuild.description}
                  onChange={e => setNewBuild({ ...newBuild, description: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 h-20 resize-none"
                  placeholder="What is this build?"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Priority</label>
                <select
                  value={newBuild.priority}
                  onChange={e => setNewBuild({ ...newBuild, priority: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewModal(false)} className="flex-1 px-4 py-2 bg-navy-700 text-slate-300 rounded-lg text-sm hover:bg-navy-600 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving || !newBuild.name.trim()} className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 disabled:opacity-50 transition-colors">
                {saving ? 'Creating...' : 'Create Build'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BuildCard({ build, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-navy-800 border border-navy-700/50 rounded-lg p-4 hover:border-sky-500/30 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-white font-semibold">{build.name}</h3>
            {build.codename && <span className="text-slate-500 text-xs font-mono">/{build.codename}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[build.priority]}`}>
            {build.priority}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[build.status]}`}>
            {build.status}
          </span>
        </div>
      </div>
      {build.description && (
        <p className="text-slate-400 text-sm mb-3 line-clamp-2">{build.description}</p>
      )}
      <div className="flex items-center gap-4">
        {/* Progress bar */}
        <div className="flex-1">
          <div className="w-full bg-navy-900 rounded-full h-2">
            <div
              className="bg-sky-500 h-2 rounded-full transition-all"
              style={{ width: `${build.progress || 0}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-slate-400 font-mono">{build.progress || 0}%</span>
        {build.phase && (
          <span className="text-xs text-slate-500">Phase: {build.phase}</span>
        )}
      </div>
      {build.tech_stack?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {build.tech_stack.slice(0, 6).map(tech => (
            <span key={tech} className="text-[10px] px-1.5 py-0.5 bg-navy-900 text-slate-400 rounded">
              {tech}
            </span>
          ))}
          {build.tech_stack.length > 6 && (
            <span className="text-[10px] px-1.5 py-0.5 text-slate-500">+{build.tech_stack.length - 6}</span>
          )}
        </div>
      )}
    </div>
  )
}
