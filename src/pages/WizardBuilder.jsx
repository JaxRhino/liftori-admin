import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const FLOW_TYPES = [
  { value: 'standard', label: 'Standard', desc: 'Web App, Mobile, E-Commerce, Dashboard…', color: 'blue', steps: 9 },
  { value: 'book', label: 'Book', desc: 'Book Writing App', color: 'amber', steps: 11 },
  { value: 'crm', label: 'CRM', desc: 'CRM Builder', color: 'violet', steps: 9 },
  { value: 'website', label: 'Website', desc: 'Website Builder', color: 'emerald', steps: 9 },
  { value: 'consulting', label: 'Consulting', desc: 'Business Audit & AI Automation', color: 'rose', steps: 7 },
]

const FLOW_COLOR = {
  standard:    { pill: 'bg-blue-500/10 text-blue-400 border-blue-500/20', active: 'bg-blue-600 text-white', badge: 'bg-blue-600/20 border-blue-500/30 text-blue-400' },
  book:        { pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20', active: 'bg-amber-600 text-white', badge: 'bg-amber-600/20 border-amber-500/30 text-amber-400' },
  crm:         { pill: 'bg-violet-500/10 text-violet-400 border-violet-500/20', active: 'bg-violet-600 text-white', badge: 'bg-violet-600/20 border-violet-500/30 text-violet-400' },
  website:     { pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', active: 'bg-emerald-600 text-white', badge: 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' },
  consulting:  { pill: 'bg-rose-500/10 text-rose-400 border-rose-500/20', active: 'bg-rose-600 text-white', badge: 'bg-rose-600/20 border-rose-500/30 text-rose-400' },
}

const FIELD_TYPES = [
  { value: 'composite',   label: 'Composite (multiple fields)' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'radio',       label: 'Radio / Single Select' },
  { value: 'text',        label: 'Short Text' },
  { value: 'textarea',    label: 'Long Text' },
  { value: 'select',      label: 'Dropdown' },
  { value: 'review',      label: 'Review / Summary' },
  { value: 'email',       label: 'Email' },
  { value: 'tel',         label: 'Phone' },
]

export default function WizardBuilder() {
  const [activeTab, setActiveTab] = useState('submissions')

  // Submissions state
  const [submissions, setSubmissions] = useState([])
  const [subLoading, setSubLoading] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)
  const [subSearch, setSubSearch] = useState('')

  // Flow Editor state
  const [selectedFlow, setSelectedFlow] = useState('standard')
  const [steps, setSteps] = useState([])
  const [stepsLoading, setStepsLoading] = useState(false)
  const [editingStep, setEditingStep] = useState(null)
  const [stepForm, setStepForm] = useState({
    flow_type: 'standard',
    step_number: 1,
    question: '',
    subtitle: '',
    field_type: 'composite',
    options: '',
    required: true,
    placeholder: '',
  })
  const [stepMode, setStepMode] = useState('list')
  const [stepSaving, setStepSaving] = useState(false)

  useEffect(() => {
    if (activeTab === 'submissions') fetchSubmissions()
    if (activeTab === 'flow') fetchSteps()
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'flow') fetchSteps()
  }, [selectedFlow])

  async function fetchSubmissions() {
    setSubLoading(true)
    try {
      const { data, error } = await supabase
        .from('wizard_submissions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSubmissions(data || [])
    } catch (err) {
      console.error('fetchSubmissions:', err)
    } finally {
      setSubLoading(false)
    }
  }

  async function fetchSteps() {
    setStepsLoading(true)
    try {
      const { data, error } = await supabase
        .from('wizard_steps')
        .select('*')
        .eq('flow_type', selectedFlow)
        .order('step_number', { ascending: true })
      if (error) throw error
      setSteps(data || [])
    } catch (err) {
      console.error('fetchSteps:', err)
    } finally {
      setStepsLoading(false)
    }
  }

  async function saveStep() {
    if (!stepForm.question.trim()) return
    setStepSaving(true)
    try {
      const payload = {
        flow_type: stepForm.flow_type || selectedFlow,
        step_number: parseInt(stepForm.step_number) || 1,
        question: stepForm.question.trim(),
        subtitle: stepForm.subtitle.trim() || null,
        field_type: stepForm.field_type,
        options: stepForm.options
          ? stepForm.options.split('\n').map(o => o.trim()).filter(Boolean)
          : null,
        required: stepForm.required,
        placeholder: stepForm.placeholder.trim() || null,
      }
      if (stepMode === 'edit' && editingStep) {
        const { error } = await supabase.from('wizard_steps').update(payload).eq('id', editingStep.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('wizard_steps').insert([payload])
        if (error) throw error
      }
      await fetchSteps()
      setStepMode('list')
      setEditingStep(null)
    } catch (err) {
      console.error('saveStep:', err)
    } finally {
      setStepSaving(false)
    }
  }

  async function deleteStep(id) {
    if (!confirm('Delete this wizard step?')) return
    const { error } = await supabase.from('wizard_steps').delete().eq('id', id)
    if (!error) fetchSteps()
  }

  function openCreateStep() {
    setStepMode('create')
    setEditingStep(null)
    setStepForm({
      flow_type: selectedFlow,
      step_number: steps.length + 1,
      question: '',
      subtitle: '',
      field_type: 'composite',
      options: '',
      required: true,
      placeholder: '',
    })
  }

  function openEditStep(step) {
    setStepMode('edit')
    setEditingStep(step)
    setStepForm({
      flow_type: step.flow_type,
      step_number: step.step_number,
      question: step.question,
      subtitle: step.subtitle || '',
      field_type: step.field_type,
      options: (step.options || []).join('\n'),
      required: step.required ?? true,
      placeholder: step.placeholder || '',
    })
  }

  const filteredSubs = submissions.filter(s => {
    if (!subSearch) return true
    const q = subSearch.toLowerCase()
    return (
      (s.name || s.full_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.idea_summary || s.business_idea || s.description || '').toLowerCase().includes(q) ||
      (s.industry || '').toLowerCase().includes(q)
    )
  })

  const flowInfo = FLOW_TYPES.find(f => f.value === selectedFlow)
  const colors = FLOW_COLOR[selectedFlow]

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Wizard Builder</h1>
          <p className="text-slate-400 text-sm mt-1">View lead submissions and configure the onboarding wizard flow</p>
        </div>
        <button
          onClick={() => window.open('/onboard?test=true', '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          Test Onboarding Wizard
        </button>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1 w-fit">
        {[
          { id: 'submissions', label: 'Submissions' },
          { id: 'flow', label: 'Flow Editor' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── SUBMISSIONS TAB ── */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <input
              value={subSearch}
              onChange={e => setSubSearch(e.target.value)}
              placeholder="Search by name, email, idea..."
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 w-80"
            />
            <div className="flex items-center gap-3">
              <span className="text-slate-500 text-sm">{filteredSubs.length} of {submissions.length}</span>
              <button onClick={fetchSubmissions} className="text-slate-400 hover:text-white text-sm transition-colors">↻ Refresh</button>
            </div>
          </div>

          {subLoading ? (
            <div className="text-center py-16 text-slate-400">Loading submissions...</div>
          ) : filteredSubs.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              {subSearch ? 'No submissions match your search.' : 'No submissions yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSubs.map(sub => {
                const isOpen = selectedSub?.id === sub.id
                const name = sub.name || sub.full_name || 'Unknown'
                const email = sub.email || '—'
                const idea = sub.idea_summary || sub.business_idea || sub.description || 'No summary provided'
                return (
                  <div
                    key={sub.id}
                    className={`bg-[#0D1424] border rounded-xl transition-colors ${isOpen ? 'border-blue-500/40' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setSelectedSub(isOpen ? null : sub)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className="text-white font-semibold">{name}</span>
                            <span className="text-slate-400 text-sm">{email}</span>
                            {sub.industry && (
                              <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">{sub.industry}</span>
                            )}
                            {sub.stage && (
                              <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">{sub.stage}</span>
                            )}
                          </div>
                          <p className="text-slate-400 text-sm truncate">{idea}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-slate-500">
                            {new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <svg
                            className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-white/10 pt-4" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(sub)
                            .filter(([k, v]) => !['id', 'updated_at'].includes(k) && v !== null && v !== '')
                            .map(([k, v]) => (
                              <div key={k}>
                                <div className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">
                                  {k.replace(/_/g, ' ')}
                                </div>
                                <div className="text-white text-sm break-words">
                                  {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── FLOW EDITOR TAB ── */}
      {activeTab === 'flow' && (
        <div className="space-y-4">

          {/* Flow Type Selector */}
          <div className="bg-[#0D1424] border border-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">Select flow to view / edit</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FLOW_TYPES.map(flow => {
                const fc = FLOW_COLOR[flow.value]
                const isActive = selectedFlow === flow.value
                return (
                  <button
                    key={flow.value}
                    onClick={() => { setSelectedFlow(flow.value); setStepMode('list'); setEditingStep(null) }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isActive
                        ? `${fc.active} border-transparent`
                        : `${fc.pill} border hover:opacity-80`
                    }`}
                  >
                    <div className="font-semibold text-sm">{flow.label}</div>
                    <div className={`text-xs mt-0.5 ${isActive ? 'text-white/70' : 'text-slate-500'}`}>{flow.desc}</div>
                    <div className={`text-xs mt-1 font-medium ${isActive ? 'text-white/80' : ''}`}>{flow.steps} steps</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Flow Editor Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">{flowInfo?.label} Flow</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${colors.pill}`}>
                  {steps.length} steps
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-0.5">{flowInfo?.desc} — {flowInfo?.steps}-step wizard</p>
            </div>
            <button
              onClick={openCreateStep}
              className={`${colors.active} px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors`}
            >
              + Add Step
            </button>
          </div>

          {/* Step Form */}
          {stepMode !== 'list' && (
            <div className="bg-[#0D1424] border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="text-white font-semibold">{stepMode === 'create' ? 'New Step' : 'Edit Step'}</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Step Number</label>
                  <input
                    type="number"
                    value={stepForm.step_number}
                    onChange={e => setStepForm(f => ({ ...f, step_number: e.target.value }))}
                    min={1}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Field Type</label>
                  <select
                    value={stepForm.field_type}
                    onChange={e => setStepForm(f => ({ ...f, field_type: e.target.value }))}
                    className="w-full bg-[#0D1424] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-xs mb-1 block">Title / Question</label>
                <input
                  value={stepForm.question}
                  onChange={e => setStepForm(f => ({ ...f, question: e.target.value }))}
                  placeholder="e.g. Your Vision"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-xs mb-1 block">Subtitle (optional)</label>
                <input
                  value={stepForm.subtitle}
                  onChange={e => setStepForm(f => ({ ...f, subtitle: e.target.value }))}
                  placeholder="e.g. What do you want to build?"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-xs mb-1 block">Placeholder (optional)</label>
                <input
                  value={stepForm.placeholder}
                  onChange={e => setStepForm(f => ({ ...f, placeholder: e.target.value }))}
                  placeholder="Hint text shown inside the field..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-xs mb-1 block">
                  {['composite', 'multiselect', 'review'].includes(stepForm.field_type)
                    ? 'Fields / Options (one per line)'
                    : 'Options (one per line — for radio / select)'}
                </label>
                <textarea
                  value={stepForm.options}
                  onChange={e => setStepForm(f => ({ ...f, options: e.target.value }))}
                  placeholder={
                    stepForm.field_type === 'composite'
                      ? 'Project Name (text, required)\nElevator Pitch (textarea, required)\nProblem solved? (textarea, optional)'
                      : stepForm.field_type === 'review'
                      ? 'Summary card\nEdit button\nSubmit button'
                      : 'Option A\nOption B\nOption C'
                  }
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="step-required"
                  checked={stepForm.required}
                  onChange={e => setStepForm(f => ({ ...f, required: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="step-required" className="text-slate-400 text-sm cursor-pointer">Required field</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveStep}
                  disabled={!stepForm.question.trim() || stepSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {stepSaving ? 'Saving...' : stepMode === 'create' ? 'Add Step' : 'Save Changes'}
                </button>
                <button
                  onClick={() => { setStepMode('list'); setEditingStep(null) }}
                  className="text-slate-400 hover:text-white px-4 py-2 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Steps List */}
          {stepsLoading ? (
            <div className="text-center py-16 text-slate-400">Loading steps...</div>
          ) : steps.length === 0 && stepMode === 'list' ? (
            <div className="text-center py-16 text-slate-400">
              No steps configured yet — click <strong className="text-white">+ Add Step</strong> to build your wizard.
            </div>
          ) : (
            <div className="space-y-2">
              {steps.map(step => (
                <div key={step.id} className="bg-[#0D1424] border border-white/10 rounded-xl p-4 flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 ${colors.badge}`}>
                    {step.step_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-white font-semibold">{step.question}</span>
                      {step.subtitle && (
                        <span className="text-slate-400 text-sm">— {step.subtitle}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded">
                        {FIELD_TYPES.find(ft => ft.value === step.field_type)?.label || step.field_type}
                      </span>
                      {step.required && (
                        <span className="text-xs text-amber-400">required</span>
                      )}
                      {step.placeholder && (
                        <span className="text-xs text-slate-500 truncate max-w-xs">"{step.placeholder}"</span>
                      )}
                    </div>
                    {step.options?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {step.options.map((o, i) => (
                          <div key={i} className="text-xs text-slate-400 bg-white/3 border border-white/5 rounded px-2 py-1">
                            {o}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEditStep(step)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteStep(step.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
