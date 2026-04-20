// =====================================================================
// BugReportModal — triggered from the LABOS header bug icon.
// Writes to the client's own bug_reports table; a later sync job can
// push these to the central Liftori support queue.
// =====================================================================

import { useState } from 'react'
import { useLabos } from '../../contexts/LabosContext'

export default function BugReportModal({ onClose }) {
  const { client } = useLabos()
  const [form, setForm] = useState({ title: '', description: '', steps_to_reproduce: '', severity: 'normal' })
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      page_url: typeof window !== 'undefined' ? window.location.href : null,
      browser_info: typeof navigator !== 'undefined' ? { userAgent: navigator.userAgent } : null,
    }
    const { error } = await client.from('bug_reports').insert(payload)
    setSaving(false)
    if (!error) {
      setSent(true)
      setTimeout(onClose, 1200)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-md">
        <div className="p-5 border-b border-navy-700/50 flex items-center justify-between">
          <h2 className="text-white font-semibold">Report a bug</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">Close</button>
        </div>
        {sent ? (
          <div className="p-8 text-center">
            <div className="text-emerald-400 text-sm mb-2">Bug report submitted.</div>
            <div className="text-gray-500 text-xs">Thanks — we've got it.</div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <Field label="Title" required>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className={inputClass}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="What happened?">
              <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Steps to reproduce (optional)">
              <textarea rows={3} value={form.steps_to_reproduce} onChange={e => setForm({ ...form, steps_to_reproduce: e.target.value })} className={inputClass} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white text-sm rounded-lg disabled:opacity-50">
                {saving ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400">{label}{required && <span className="text-red-400"> *</span>}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputClass = 'w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50'
