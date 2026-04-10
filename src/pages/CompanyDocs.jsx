import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'sonner'
import { FileText, Download, Eye, CheckCircle2, Clock, Users, Shield, PenTool } from 'lucide-react'

const AGREEMENT_TEMPLATES = [
  {
    id: 'nda',
    title: 'Non-Disclosure Agreement',
    description: 'Confidentiality, IP ownership, non-solicitation, non-compete',
    pdfUrl: '/templates/liftori-nda.pdf',
    docxUrl: '/templates/liftori-nda-template.docx',
    icon: Shield,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    version: '1.0',
  },
  {
    id: '1099',
    title: 'Independent Contractor Agreement',
    description: '1099 contractor terms, compensation, IP, termination',
    pdfUrl: '/templates/liftori-1099-agreement.pdf',
    docxUrl: '/templates/liftori-1099-agreement-template.docx',
    icon: FileText,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    version: '1.0',
  },
]

export default function CompanyDocs() {
  const { user, profile } = useAuth()
  const [signatures, setSignatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewingPdf, setViewingPdf] = useState(null)
  const [activeTab, setActiveTab] = useState('templates')

  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  useEffect(() => {
    fetchSignatures()
  }, [user])

  async function fetchSignatures() {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('agreement_signatures')
        .select('*')
        .order('signed_at', { ascending: false })

      if (error) throw error
      setSignatures(data || [])
    } catch (err) {
      console.error('Error fetching signatures:', err)
    } finally {
      setLoading(false)
    }
  }

  function getSignatureForAgreement(agreementType) {
    return signatures.find(s => s.agreement_type === agreementType && s.user_id === user?.id)
  }

  function getAllSignaturesForAgreement(agreementType) {
    return signatures.filter(s => s.agreement_type === agreementType)
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Company Documents</h1>
          <p className="text-gray-500 text-sm mt-1">Agreements, templates, and signed records</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 rounded-lg p-1 mb-6 w-fit">
        {[
          { id: 'templates', label: 'Agreement Templates', icon: FileText },
          ...(isAdmin ? [{ id: 'signatures', label: 'Signed Agreements', icon: PenTool }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {AGREEMENT_TEMPLATES.map(tmpl => {
            const mySig = getSignatureForAgreement(tmpl.id)
            const allSigs = getAllSignaturesForAgreement(tmpl.id)
            const Icon = tmpl.icon

            return (
              <div key={tmpl.id} className={`bg-navy-800 border ${tmpl.borderColor} rounded-xl overflow-hidden`}>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${tmpl.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={24} className={tmpl.color} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-white">{tmpl.title}</h3>
                        <span className="text-xs text-gray-500 bg-navy-700 px-2 py-0.5 rounded">v{tmpl.version}</span>
                      </div>
                      <p className="text-gray-400 text-sm mb-3">{tmpl.description}</p>

                      {/* My signature status */}
                      {mySig ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-400 mb-3">
                          <CheckCircle2 size={16} />
                          <span>You signed this on {formatDate(mySig.signed_at)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                          <Clock size={16} />
                          <span>Not yet signed — signs during onboarding</span>
                        </div>
                      )}

                      {/* Admin: team signatures count */}
                      {isAdmin && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Users size={14} />
                          <span>{allSigs.length} team member{allSigs.length !== 1 ? 's' : ''} signed</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setViewingPdf(viewingPdf === tmpl.id ? null : tmpl.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg text-sm font-medium transition"
                      >
                        <Eye size={16} />
                        {viewingPdf === tmpl.id ? 'Hide' : 'View PDF'}
                      </button>
                      <a
                        href={tmpl.docxUrl}
                        download
                        className="flex items-center gap-2 px-4 py-2 bg-navy-700 text-gray-300 hover:text-white hover:bg-navy-600 rounded-lg text-sm font-medium transition"
                      >
                        <Download size={16} />
                        Download
                      </a>
                    </div>
                  </div>
                </div>

                {/* Inline PDF viewer */}
                {viewingPdf === tmpl.id && (
                  <div className="border-t border-navy-700/50 bg-white">
                    <iframe
                      src={`${tmpl.pdfUrl}#toolbar=1&navpanes=0&view=FitH`}
                      className="w-full"
                      style={{ height: '600px' }}
                      title={tmpl.title}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Signatures Tab (Admin only) */}
      {activeTab === 'signatures' && isAdmin && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading signatures...</div>
          ) : signatures.length === 0 ? (
            <div className="text-center py-12">
              <PenTool size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">No signatures recorded yet</p>
              <p className="text-gray-600 text-sm mt-1">Team members sign agreements during onboarding</p>
            </div>
          ) : (
            <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy-700/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Agreement</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Signed</th>
                  </tr>
                </thead>
                <tbody>
                  {signatures.map(sig => (
                    <tr key={sig.id} className="border-b border-navy-700/30 hover:bg-navy-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                          <span className="text-sm text-white font-medium">{sig.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400">{sig.email}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          sig.agreement_type === 'nda'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        }`}>
                          {sig.agreement_type === 'nda' ? 'NDA' : '1099 Agreement'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">v{sig.agreement_version}</td>
                      <td className="px-5 py-3 text-sm text-gray-400">{formatDate(sig.signed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
