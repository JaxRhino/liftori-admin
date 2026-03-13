import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

export default function PortalDocuments() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (user) fetchDocuments()
  }, [user])

  async function fetchDocuments() {
    try {
      // Get all projects for this customer, then their documents
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('customer_id', user.id)

      if (!projects?.length) {
        setLoading(false)
        return
      }

      const projectIds = projects.map(p => p.id)
      const { data: docs } = await supabase
        .from('documents')
        .select('*, projects(name)')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })

      setDocuments(docs || [])
    } catch (err) {
      console.error('Error fetching documents:', err)
    } finally {
      setLoading(false)
    }
  }

  function getDocTypeIcon(type) {
    switch (type) {
      case 'brief': return { bg: 'bg-brand-blue/20', color: 'text-brand-blue', label: 'Brief' }
      case 'spec': return { bg: 'bg-purple-500/20', color: 'text-purple-400', label: 'Spec' }
      case 'agreement': return { bg: 'bg-yellow-500/20', color: 'text-yellow-400', label: 'Agreement' }
      case 'mockup': return { bg: 'bg-pink-500/20', color: 'text-pink-400', label: 'Mockup' }
      case 'deliverable': return { bg: 'bg-green-500/20', color: 'text-green-400', label: 'Deliverable' }
      default: return { bg: 'bg-gray-500/20', color: 'text-gray-400', label: 'Other' }
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  function formatSize(bytes) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const docTypes = ['all', 'brief', 'spec', 'agreement', 'mockup', 'deliverable', 'other']
  const filtered = filter === 'all' ? documents : documents.filter(d => d.doc_type === filter)

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-gray-400 text-sm mt-1">Project files, briefs, agreements, and deliverables</p>
        </div>
        <span className="text-sm text-gray-500">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {docTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === type
                ? 'bg-brand-blue/20 text-brand-blue'
                : 'bg-navy-800 text-gray-400 hover:text-white'
            }`}
          >
            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-400">No documents yet</h2>
          <p className="text-gray-600 text-sm mt-2">
            {filter === 'all'
              ? 'Your project documents will appear here as your build progresses'
              : `No ${filter} documents found`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const typeInfo = getDocTypeIcon(doc.doc_type)
            return (
              <div
                key={doc.id}
                className="card !p-4 flex items-center gap-4 hover:border-navy-500/50 transition-colors"
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg ${typeInfo.bg} flex items-center justify-center flex-shrink-0`}>
                  <svg className={`w-5 h-5 ${typeInfo.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</span>
                    {doc.file_size && <span className="text-xs text-gray-600">{formatSize(doc.file_size)}</span>}
                    <span className="text-xs text-gray-600">{formatDate(doc.created_at)}</span>
                  </div>
                </div>

                {/* Download */}
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-brand-blue transition-colors rounded-lg hover:bg-brand-blue/10"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
