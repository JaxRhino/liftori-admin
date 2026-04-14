import { useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createLog, updateLog, resolveLog,
  LOG_CATEGORIES, LOG_SEVERITIES, LOG_STATUSES,
} from '../../lib/timeTrackingService'

const CATEGORY_COLORS = {
  bug: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  enhancement: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  question: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  observation: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  task_complete: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  note: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}
const SEVERITY_COLORS = {
  critical: 'bg-rose-600/20 text-rose-300',
  high: 'bg-orange-500/20 text-orange-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-sky-500/20 text-sky-300',
  info: 'bg-slate-500/20 text-slate-300',
}
const STATUS_COLORS = {
  open: 'bg-rose-500/15 text-rose-300',
  triaged: 'bg-amber-500/15 text-amber-300',
  in_progress: 'bg-sky-500/15 text-sky-300',
  fixed: 'bg-emerald-500/15 text-emerald-300',
  wontfix: 'bg-slate-500/15 text-slate-400',
  cannot_reproduce: 'bg-slate-500/15 text-slate-400',
  duplicate: 'bg-slate-500/15 text-slate-400',
  closed: 'bg-slate-500/15 text-slate-400',
}

export default function WorkLogTab({ logs, userId, orgId, activeEntry, isSuperAdmin, onChanged, onRequestNewLog }) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (filterStatus !== 'all' && l.status !== filterStatus) return false
      if (filterSeverity !== 'all' && l.severity !== filterSeverity) return false
      if (filterCategory !== 'all' && l.category !== filterCategory) return false
      return true
    })
  }, [logs, filterStatus, filterSeverity, filterCategory])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect label="Category" value={filterCategory} onChange={setFilterCategory} options={['all', ...LOG_CATEGORIES]} />
        <FilterSelect label="Severity" value={filterSeverity} onChange={setFilterSeverity} options={['all', ...LOG_SEVERITIES]} />
        <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={['all', ...LOG_STATUSES]} />
        <div className="ml-auto text-xs text-gray-500">
          Showing {filteredLogs.length} of {logs.length}
        </div>
        {activeEntry && (
          <button
            onClick={onRequestNewLog}
            className="px-3 py-1.5 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-xs font-medium"
          >
            + Log entry
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-navy-800 border-b border-navy-700/50">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Severity</th>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Screen</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/40">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  No entries match these filters.
                </td>
              </tr>
            ) : (
              filteredLogs.map((l) => (
                <LogRow key={l.id} log={l} isSuperAdmin={isSuperAdmin} userId={userId} onChanged={onChanged} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-400">
      <span>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-navy-800 border border-navy-700/50 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-brand-blue"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === 'all' ? 'All' : o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </label>
  )
}

function LogRow({ log, isSuperAdmin, userId, onChanged }) {
  const [expanded, setExpanded] = useState(false)

  async function markFixed() {
    try {
      await resolveLog(log.id, { resolvedBy: userId, newStatus: 'fixed' })
      toast.success('Marked fixed')
      onChanged()
    } catch {
      toast.error('Update failed')
    }
  }

  async function changeStatus(newStatus) {
    try {
      await updateLog(log.id, { status: newStatus })
      onChanged()
    } catch {
      toast.error('Update failed')
    }
  }

  return (
    <>
      <tr className="hover:bg-navy-800/50 cursor-pointer" onClick={() => setExpanded((x) => !x)}>
        <td className="px-4 py-2.5">
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${CATEGORY_COLORS[log.category] || ''}`}>
            {log.category.replace('_', ' ')}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${SEVERITY_COLORS[log.severity] || ''}`}>
            {log.severity}
          </span>
        </td>
        <td className="px-4 py-2.5 text-sm text-white max-w-md truncate">{log.title}</td>
        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{log.screen_path || '—'}</td>
        <td className="px-4 py-2.5">
          <select
            value={log.status}
            onChange={(e) => { e.stopPropagation(); changeStatus(e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 border-0 focus:outline-none ${STATUS_COLORS[log.status] || ''}`}
          >
            {LOG_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-navy-900 text-white">
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2.5 text-xs text-gray-500">
          {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </td>
        <td className="px-4 py-2.5 text-right">
          {!['fixed', 'closed'].includes(log.status) && isSuperAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); markFixed() }}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              Mark fixed
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-navy-900/60">
          <td colSpan={7} className="px-6 py-4 text-sm text-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {log.description && <Field label="Description" value={log.description} />}
              {log.steps_to_reproduce && <Field label="Steps to reproduce" value={log.steps_to_reproduce} mono />}
              {log.expected_result && <Field label="Expected" value={log.expected_result} />}
              {log.actual_result && <Field label="Actual" value={log.actual_result} />}
              {log.resolution_notes && (
                <div className="md:col-span-2">
                  <div className="text-[10px] uppercase font-semibold text-emerald-400 mb-1">Resolution</div>
                  <div className="whitespace-pre-wrap">{log.resolution_notes}</div>
                </div>
              )}
            </div>
            {log.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {log.tags.map((t) => (
                  <span key={t} className="text-[10px] text-gray-400 bg-navy-800 border border-navy-700/50 rounded px-2 py-0.5">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">{label}</div>
      <div className={`whitespace-pre-wrap ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  )
}

export function NewLogModal({ userId, orgId, timeEntryId, currentPath, onClose, onCreated }) {
  const [category, setCategory] = useState('bug')
  const [severity, setSeverity] = useState('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')
  const [screenPath, setScreenPath] = useState(currentPath || '')
  const [tagsText, setTagsText] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      await createLog({
        userId, orgId, timeEntryId, category, severity,
        title: title.trim(),
        description: description.trim() || null,
        stepsToReproduce: steps.trim() || null,
        expectedResult: expected.trim() || null,
        actualResult: actual.trim() || null,
        screenPath: screenPath.trim() || null,
        tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      })
      toast.success(severity === 'critical' ? 'Logged — Sage alerted #critical-bugs' : 'Log saved')
      onCreated()
    } catch (err) {
      console.error(err)
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-auto py-10 px-4">
      <form onSubmit={submit} className="bg-navy-900 border border-navy-700/50 rounded-xl shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <h2 className="text-lg font-semibold">New work log entry</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SelectRow label="Category" value={category} onChange={setCategory} options={LOG_CATEGORIES} />
            <SelectRow label="Severity" value={severity} onChange={setSeverity} options={LOG_SEVERITIES} />
          </div>
          <TextInput label="Title *" value={title} onChange={setTitle} placeholder="Short summary" required />
          <TextInput label="Screen path" value={screenPath} onChange={setScreenPath} placeholder="/admin/..." mono />
          <TextArea label="Description" value={description} onChange={setDescription} rows={3} />
          {category === 'bug' && (
            <>
              <TextArea label="Steps to reproduce" value={steps} onChange={setSteps} rows={3} mono placeholder={'1. Go to ...\n2. Click ...\n3. Observe ...'} />
              <div className="grid grid-cols-2 gap-4">
                <TextArea label="Expected" value={expected} onChange={setExpected} rows={2} />
                <TextArea label="Actual" value={actual} onChange={setActual} rows={2} />
              </div>
            </>
          )}
          <TextInput label="Tags (comma-separated)" value={tagsText} onChange={setTagsText} placeholder="e.g. mobile, chrome, regression" />
          {severity === 'critical' && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              Saving will trigger Sage to auto-post this alert to the #critical-bugs channel.
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-navy-700/50 bg-navy-950/40 rounded-b-xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Save log'}
          </button>
        </div>
      </form>
    </div>
  )
}

function SelectRow({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-gray-500">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm">
        {options.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
      </select>
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder, required, mono }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-gray-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}

function TextArea({ label, value, onChange, rows = 3, placeholder, mono }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-gray-500">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`w-full mt-1 bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}
