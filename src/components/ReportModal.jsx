import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { toast } from 'sonner'

const REPORT_TYPES = [
  { value: 'bug', label: 'Bug Report', icon: '🐛', color: 'text-red-400 bg-red-500/10 border-red-500/30', description: 'Something is broken or not working right' },
  { value: 'feature', label: 'Feature Request', icon: '✨', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', description: 'Suggest a new feature or improvement' },
  { value: 'feedback', label: 'General Feedback', icon: '💬', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30', description: 'Share thoughts, questions, or ideas' },
]

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
]

const PAGE_OPTIONS = [
  'Dashboard', 'Call Center', 'Lead Hunter', 'Customers', 'Projects', 'Pipeline',
  'Estimates', 'Agreements', 'Commissions', 'Waitlist', 'Platforms', 'Marketing',
  'Chat', 'Rally', 'EOS', 'Finance', 'Operations', 'Team', 'Settings', 'Freight',
  'Builds', 'Support Tickets', 'Other'
]

export default function ReportModal({ onClose }) {
  const { user, profile } = useAuth()
  const [step, setStep] = useState(0) // 0 = type selection, 1 = form
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    type: '',
    title: '',
    description: '',
    priority: 'medium',
    page: '',
    steps_to_reproduce: '',
  })

  function selectType(type) {
    setForm({ ...form, type })
    setStep(1)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase.from('work_queue').insert({
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        page: form.page || null,
        steps_to_reproduce: form.steps_to_reproduce.trim() || null,
        status: 'open',
        reported_by: user.id,
        reporter_name: profile?.full_name || user?.email || 'Unknown',
        reporter_email: user?.email,
      })

      if (error) throw error

      toast.success(form.type === 'bug' ? 'Bug report submitted!' : form.type === 'feature' ? 'Feature request submitted!' : 'Feedback submitted!')
      onClose()
    } catch (err) {
      console.error('Error submitting report:', err)
      toast.error('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-navy-800 border border-navy-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy-700/50">
          <h2 className="text-lg font-semibold text-white">
            {step === 0 ? 'What would you like to report?' : REPORT_TYPES.find(t => t.value === form.type)?.label}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Type Selection */}
        {step === 0 && (
          <div className="p-4 space-y-3">
            {REPORT_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => selectType(type.value)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all hover:scale-[1.01] ${type.color}`}
              >
                <span className="text-2xl">{type.icon}</span>
                <div className="text-left">
                  <p className="font-medium">{type.label}</p>
                  <p className="text-sm opacity-70">{type.description}</p>
                </div>
                <svg className="w-5 h-5 ml-auto opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* Form */}
        {step === 1 && (
          <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {form.type === 'bug' ? 'What went wrong?' : form.type === 'feature' ? 'What do you want?' : 'What\'s on your mind?'}
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder={form.type === 'bug' ? 'e.g., Settings page crashes when...' : form.type === 'feature' ? 'e.g., Add bulk export to Lead Hunter...' : 'Brief summary...'}
                required
                autoFocus
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Details</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Give us as much detail as possible..."
                rows={3}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-sky-500 transition-colors resize-none"
              />
            </div>

            {/* Steps to Reproduce (bug only) */}
            {form.type === 'bug' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Steps to Reproduce <span className="text-gray-500">(optional)</span></label>
                <textarea
                  value={form.steps_to_reproduce}
                  onChange={e => setForm({ ...form, steps_to_reproduce: e.target.value })}
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                  rows={3}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-sky-500 transition-colors resize-none"
                />
              </div>
            )}

            {/* Priority + Page row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                <div className="flex gap-1">
                  {PRIORITY_LEVELS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm({ ...form, priority: p.value })}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                        form.priority === p.value
                          ? `${p.color} text-white`
                          : 'bg-navy-900 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Related Page</label>
                <select
                  value={form.page}
                  onChange={e => setForm({ ...form, page: e.target.value })}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                >
                  <option value="">Select page...</option>
                  {PAGE_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-4 py-2.5 bg-navy-700 hover:bg-navy-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting || !form.title.trim()}
                className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
