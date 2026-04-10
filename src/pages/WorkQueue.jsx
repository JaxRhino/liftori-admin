import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'sonner'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'bg-sky-500', textColor: 'text-sky-400' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-500', textColor: 'text-amber-400' },
  { value: 'resolved', label: 'Resolved', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500', textColor: 'text-gray-400' },
  { value: 'wont_fix', label: "Won't Fix", color: 'bg-red-500', textColor: 'text-red-400' },
]

const TYPE_ICONS = {
  bug: '🐛',
  feature: '✨',
  feedback: '💬',
}

const PRIORITY_CONFIG = {
  critical: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Critical', sort: 0 },
  high: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'High', sort: 1 },
  medium: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Medium', sort: 2 },
  low: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Low', sort: 3 },
}

export default function WorkQueue() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: 'open', type: '', priority: '' })
  const [selectedItem, setSelectedItem] = useState(null)
  const [stats, setStats] = useState({ open: 0, in_progress: 0, resolved: 0, total: 0 })

  useEffect(() => { fetchItems() }, [filter])

  async function fetchItems() {
    setLoading(true)
    try {
      let query = supabase.from('work_queue').select('*').order('created_at', { ascending: false })

      if (filter.status) query = query.eq('status', filter.status)
      if (filter.type) query = query.eq('type', filter.type)
      if (filter.priority) query = query.eq('priority', filter.priority)

      const { data, error } = await query
      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Error fetching work queue:', err)
      toast.error('Failed to load work queue')
    } finally {
      setLoading(false)
    }
  }

  // Fetch stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase.from('work_queue').select('status')
        if (error) throw error
        const counts = (data || []).reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1
          acc.total++
          return acc
        }, { open: 0, in_progress: 0, resolved: 0, total: 0 })
        setStats(counts)
      } catch (err) {
        console.error('Error fetching stats:', err)
      }
    }
    fetchStats()
  }, [items])

  async function updateStatus(id, newStatus) {
    try {
      const updates = { status: newStatus }
      if (newStatus === 'in_progress') updates.assigned_to = user.id
      if (newStatus === 'resolved' || newStatus === 'closed') updates.resolved_at = new Date().toISOString()

      const { error } = await supabase.from('work_queue').update(updates).eq('id', id)
      if (error) throw error
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`)
      fetchItems()
      if (selectedItem?.id === id) setSelectedItem({ ...selectedItem, ...updates })
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error('Failed to update')
    }
  }

  function timeAgo(date) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Work Queue</h1>
          <p className="text-gray-500 text-sm mt-1">Bug reports, feature requests, and feedback from the team</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open', value: stats.open || 0, color: 'text-sky-400', bg: 'bg-sky-500/10' },
          { label: 'In Progress', value: stats.in_progress || 0, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Resolved', value: stats.resolved || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Total', value: stats.total || 0, color: 'text-gray-300', bg: 'bg-navy-800' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-navy-700/50 rounded-xl p-4`}>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color} mt-1`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
          {[{ value: '', label: 'All' }, ...STATUS_OPTIONS].map(s => (
            <button
              key={s.value}
              onClick={() => setFilter({ ...filter, status: s.value })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter.status === s.value
                  ? 'bg-sky-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
          {[
            { value: '', label: 'All Types' },
            { value: 'bug', label: '🐛 Bugs' },
            { value: 'feature', label: '✨ Features' },
            { value: 'feedback', label: '💬 Feedback' },
          ].map(t => (
            <button
              key={t.value}
              onClick={() => setFilter({ ...filter, type: t.value })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter.type === t.value
                  ? 'bg-sky-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
          {[
            { value: '', label: 'All Priority' },
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setFilter({ ...filter, priority: p.value })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter.priority === p.value
                  ? 'bg-sky-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <span className="text-gray-600 text-xs ml-auto">{items.length} items</span>
      </div>

      {/* List + Detail Split */}
      <div className="flex gap-4">
        {/* Items List */}
        <div className={`${selectedItem ? 'w-1/2' : 'w-full'} space-y-2 transition-all`}>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No items in queue</p>
              <p className="text-gray-600 text-sm mt-1">Reports submitted from the header will appear here</p>
            </div>
          ) : items.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={`w-full text-left p-4 rounded-xl border transition-all hover:border-navy-600 ${
                selectedItem?.id === item.id
                  ? 'bg-navy-800 border-sky-500/50'
                  : 'bg-navy-800/50 border-navy-700/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{TYPE_ICONS[item.type] || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-white truncate">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full border ${PRIORITY_CONFIG[item.priority]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                      {PRIORITY_CONFIG[item.priority]?.label || item.priority}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${
                      STATUS_OPTIONS.find(s => s.value === item.status)?.color || 'bg-gray-500'
                    } text-white`}>
                      {STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status}
                    </span>
                    {item.page && <span className="text-gray-500">{item.page}</span>}
                    <span className="text-gray-600 ml-auto">{item.reporter_name} · {timeAgo(item.created_at)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div className="w-1/2 bg-navy-800 border border-navy-700/50 rounded-xl p-6 sticky top-6 self-start">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{TYPE_ICONS[selectedItem.type] || '📋'}</span>
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  {selectedItem.type === 'bug' ? 'Bug Report' : selectedItem.type === 'feature' ? 'Feature Request' : 'Feedback'}
                </span>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h2 className="text-xl font-bold text-white mb-3">{selectedItem.title}</h2>

            {selectedItem.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedItem.description}</p>
              </div>
            )}

            {selectedItem.steps_to_reproduce && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Steps to Reproduce</h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap bg-navy-900 rounded-lg p-3">{selectedItem.steps_to_reproduce}</p>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Priority</p>
                <span className={`inline-block px-2 py-1 rounded-md border text-xs font-medium ${PRIORITY_CONFIG[selectedItem.priority]?.color}`}>
                  {PRIORITY_CONFIG[selectedItem.priority]?.label}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Page</p>
                <p className="text-sm text-gray-300">{selectedItem.page || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Reported By</p>
                <p className="text-sm text-gray-300">{selectedItem.reporter_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Reported</p>
                <p className="text-sm text-gray-300">{new Date(selectedItem.created_at).toLocaleDateString()} ({timeAgo(selectedItem.created_at)})</p>
              </div>
            </div>

            {/* Status Actions */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.filter(s => s.value !== selectedItem.status).map(s => (
                  <button
                    key={s.value}
                    onClick={() => updateStatus(selectedItem.id, s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${s.color} text-white hover:opacity-80`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
