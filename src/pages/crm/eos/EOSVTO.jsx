// =====================================================================
// EOSVTO - Vision/Traction Organizer (8-section doc layout)
// Wave C.2.2
// Reads/writes: eos_vto (per-tenant LABOS DB)
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { HubPage, useCrmClient } from '../_shared'

// ---------- formatters ----------
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'

const EMPTY_VTO = {
  core_values: [],
  core_focus: { purpose: '', niche: '' },
  ten_year_target: '',
  marketing_strategy: { target_market: '', three_uniques: ['', '', ''], proven_process: '', guarantee: '' },
  three_year_picture: { future_date: '', measurables: '', looks_like: '' },
  one_year_plan: { future_date: '', revenue_goal: '', profit_goal: '', measurables: '', goals: [] },
}

// ---------- primitives ----------
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-navy-800 border border-navy-700/60 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40">{footer}</div>}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder, rows, disabled }) {
  const base = `w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan ${disabled ? 'opacity-70 cursor-default' : ''}`
  return (
    <label className="block mb-3">
      {label && <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>}
      {rows ? (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} disabled={disabled} className={base} />
      ) : (
        <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={base} />
      )}
    </label>
  )
}

function Textarea(props) { return <Input {...props} rows={props.rows || 3} /> }

function ChipList({ items, onChange, placeholder, disabled }) {
  const arr = Array.isArray(items) ? items : []
  const [draft, setDraft] = useState('')

  function add() {
    if (!draft.trim()) return
    onChange([...arr, draft.trim()])
    setDraft('')
  }
  function remove(idx) {
    const next = [...arr]
    next.splice(idx, 1)
    onChange(next)
  }
  function update(idx, v) {
    const next = [...arr]
    next[idx] = v
    onChange(next)
  }

  return (
    <div>
      <ul className="space-y-2 mb-2">
        {arr.length === 0 && <li className="text-xs text-gray-500 italic">No items yet.</li>}
        {arr.map((it, i) => (
          <li key={i} className="flex items-center gap-2 bg-navy-900/40 border border-navy-700/40 rounded px-3 py-1.5">
            <input
              value={it}
              onChange={(e) => update(i, e.target.value)}
              disabled={disabled}
              className="flex-1 bg-transparent text-sm text-white outline-none disabled:opacity-70"
            />
            {!disabled && (
              <button onClick={() => remove(i)} className="text-xs text-rose-300 hover:text-rose-200">x</button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder={placeholder || 'Add item and press Enter'}
            className="flex-1 bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
          />
          <button onClick={add} className="text-xs px-3 py-2 rounded-lg bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40">Add</button>
        </div>
      )}
    </div>
  )
}

function SectionCard({ title, accent, children }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-5 mb-4">
      <h3 className={`text-sm font-semibold mb-3 uppercase tracking-wider ${accent || 'text-brand-cyan'}`}>{title}</h3>
      {children}
    </div>
  )
}

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function EOSVTO() {
  const { client, platform } = useCrmClient()

  const [versions, setVersions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!client) return
    setLoading(true)
    try {
      const { data, error } = await client.from('eos_vto').select('*').order('version', { ascending: false }).limit(50)
      if (error) throw error
      setVersions(data || [])
      if (data && data.length > 0) {
        const activeOne = data.find(v => v.is_active) || data[0]
        setSelectedId(prev => prev || activeOne.id)
      }
    } catch (e) {
      console.error('[EOSVTO] load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!client) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  const selected = useMemo(() => versions.find(v => v.id === selectedId), [versions, selectedId])

  useEffect(() => {
    if (!selected) { setDraft(null); return }
    setDraft({
      ...EMPTY_VTO,
      ...selected,
      core_values: Array.isArray(selected.core_values) ? selected.core_values : [],
      core_focus: { ...EMPTY_VTO.core_focus, ...(selected.core_focus || {}) },
      marketing_strategy: { ...EMPTY_VTO.marketing_strategy, ...(selected.marketing_strategy || {}) },
      three_year_picture: { ...EMPTY_VTO.three_year_picture, ...(selected.three_year_picture || {}) },
      one_year_plan: { ...EMPTY_VTO.one_year_plan, ...(selected.one_year_plan || {}) },
    })
    setEditMode(false)
  }, [selected])

  async function saveAll() {
    if (!client || !draft || !selectedId) return
    setSaving(true)
    try {
      const payload = {
        core_values: draft.core_values || [],
        core_focus: draft.core_focus || {},
        ten_year_target: draft.ten_year_target || null,
        marketing_strategy: draft.marketing_strategy || {},
        three_year_picture: draft.three_year_picture || {},
        one_year_plan: draft.one_year_plan || {},
      }
      const { error } = await client.from('eos_vto').update(payload).eq('id', selectedId)
      if (error) throw error
      setEditMode(false)
      await load()
    } catch (e) {
      console.error('[EOSVTO] save', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function newVersion() {
    if (!client) return
    setSaving(true)
    try {
      const base = selected || { version: 0 }
      const payload = {
        version: (Number(base.version) || 0) + 1,
        core_values: base.core_values || [],
        core_focus: base.core_focus || {},
        ten_year_target: base.ten_year_target || null,
        marketing_strategy: base.marketing_strategy || {},
        three_year_picture: base.three_year_picture || {},
        one_year_plan: base.one_year_plan || {},
        is_active: false,
      }
      const { data, error } = await client.from('eos_vto').insert(payload).select('*').single()
      if (error) throw error
      if (data) setSelectedId(data.id)
      setNewOpen(false)
      await load()
    } catch (e) {
      console.error('[EOSVTO] newVersion', e)
      alert('Failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function makeActive() {
    if (!client || !selectedId) return
    setSaving(true)
    try {
      // deactivate all
      await client.from('eos_vto').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
      const { error } = await client.from('eos_vto').update({ is_active: true, effective_date: new Date().toISOString() }).eq('id', selectedId)
      if (error) throw error
      await load()
    } catch (e) {
      console.error('[EOSVTO] makeActive', e)
      alert('Failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  const disabled = !editMode

  return (
    <HubPage
      title="Vision / Traction Organizer"
      subtitle={`The two-page foundational document${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
      actions={
        <div className="flex items-center gap-2">
          {versions.length > 1 && (
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.version}{v.is_active ? ' (active)' : ''}</option>
              ))}
            </select>
          )}
          <button onClick={() => setNewOpen(true)} className="text-sm px-3 py-2 rounded-lg bg-navy-900/60 text-gray-300 border border-navy-700/50 hover:text-white">
            + New Version
          </button>
          {selected && !selected.is_active && (
            <button onClick={makeActive} className="text-sm px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30">
              Make Active
            </button>
          )}
          {!editMode ? (
            <button onClick={() => setEditMode(true)} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              Edit
            </button>
          ) : (
            <button onClick={saveAll} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6 text-sm text-gray-500">Loading VTO...</div>
      ) : !draft ? (
        <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-12 text-center">
          <h3 className="text-white font-semibold mb-1">No VTO yet</h3>
          <p className="text-gray-400 text-sm mb-4">Create the first version to start the Vision / Traction Organizer.</p>
          <button onClick={() => setNewOpen(true)} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
            + New Version
          </button>
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-500 mb-4">
            v{selected?.version || 1}{selected?.is_active ? ' - ACTIVE' : ''} - effective {fmtDate(selected?.effective_date)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: VISION */}
            <div>
              <h2 className="text-lg font-bold text-brand-cyan mb-3">VISION</h2>

              <SectionCard title="Core Values" accent="text-brand-cyan">
                <ChipList
                  items={draft.core_values}
                  onChange={(arr) => setDraft(d => ({ ...d, core_values: arr }))}
                  placeholder="e.g., Always be learning"
                  disabled={disabled}
                />
              </SectionCard>

              <SectionCard title="Core Focus" accent="text-brand-cyan">
                <Textarea
                  label="Purpose / Cause / Passion"
                  value={draft.core_focus.purpose}
                  onChange={(v) => setDraft(d => ({ ...d, core_focus: { ...d.core_focus, purpose: v } }))}
                  rows={2}
                  disabled={disabled}
                />
                <Textarea
                  label="Niche"
                  value={draft.core_focus.niche}
                  onChange={(v) => setDraft(d => ({ ...d, core_focus: { ...d.core_focus, niche: v } }))}
                  rows={2}
                  disabled={disabled}
                />
              </SectionCard>

              <SectionCard title="10-Year Target" accent="text-brand-cyan">
                <Textarea
                  label=""
                  value={draft.ten_year_target}
                  onChange={(v) => setDraft(d => ({ ...d, ten_year_target: v }))}
                  rows={3}
                  placeholder="The BHAG. Where do you want to be in 10 years?"
                  disabled={disabled}
                />
              </SectionCard>

              <SectionCard title="Marketing Strategy" accent="text-brand-cyan">
                <Input
                  label="Target Market"
                  value={draft.marketing_strategy.target_market}
                  onChange={(v) => setDraft(d => ({ ...d, marketing_strategy: { ...d.marketing_strategy, target_market: v } }))}
                  disabled={disabled}
                />
                <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">3 Uniques</span>
                {[0, 1, 2].map(i => (
                  <Input
                    key={i}
                    label=""
                    value={(draft.marketing_strategy.three_uniques || [])[i] || ''}
                    onChange={(v) => {
                      const arr = [...(draft.marketing_strategy.three_uniques || ['', '', ''])]
                      arr[i] = v
                      setDraft(d => ({ ...d, marketing_strategy: { ...d.marketing_strategy, three_uniques: arr } }))
                    }}
                    placeholder={`Unique #${i + 1}`}
                    disabled={disabled}
                  />
                ))}
                <Textarea
                  label="Proven Process"
                  value={draft.marketing_strategy.proven_process}
                  onChange={(v) => setDraft(d => ({ ...d, marketing_strategy: { ...d.marketing_strategy, proven_process: v } }))}
                  rows={2}
                  disabled={disabled}
                />
                <Textarea
                  label="Guarantee"
                  value={draft.marketing_strategy.guarantee}
                  onChange={(v) => setDraft(d => ({ ...d, marketing_strategy: { ...d.marketing_strategy, guarantee: v } }))}
                  rows={2}
                  disabled={disabled}
                />
              </SectionCard>
            </div>

            {/* Right: TRACTION */}
            <div>
              <h2 className="text-lg font-bold text-brand-blue mb-3">TRACTION</h2>

              <SectionCard title="3-Year Picture" accent="text-brand-blue">
                <Input
                  label="Future Date"
                  type="date"
                  value={(draft.three_year_picture.future_date || '').slice(0, 10)}
                  onChange={(v) => setDraft(d => ({ ...d, three_year_picture: { ...d.three_year_picture, future_date: v } }))}
                  disabled={disabled}
                />
                <Textarea
                  label="Measurables (revenue, team size, etc.)"
                  value={draft.three_year_picture.measurables}
                  onChange={(v) => setDraft(d => ({ ...d, three_year_picture: { ...d.three_year_picture, measurables: v } }))}
                  rows={2}
                  disabled={disabled}
                />
                <Textarea
                  label="What does it look like?"
                  value={draft.three_year_picture.looks_like}
                  onChange={(v) => setDraft(d => ({ ...d, three_year_picture: { ...d.three_year_picture, looks_like: v } }))}
                  rows={4}
                  disabled={disabled}
                />
              </SectionCard>

              <SectionCard title="1-Year Plan" accent="text-brand-blue">
                <Input
                  label="Future Date"
                  type="date"
                  value={(draft.one_year_plan.future_date || '').slice(0, 10)}
                  onChange={(v) => setDraft(d => ({ ...d, one_year_plan: { ...d.one_year_plan, future_date: v } }))}
                  disabled={disabled}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Revenue Goal ($)"
                    type="number"
                    value={draft.one_year_plan.revenue_goal}
                    onChange={(v) => setDraft(d => ({ ...d, one_year_plan: { ...d.one_year_plan, revenue_goal: v } }))}
                    disabled={disabled}
                  />
                  <Input
                    label="Profit Goal ($)"
                    type="number"
                    value={draft.one_year_plan.profit_goal}
                    onChange={(v) => setDraft(d => ({ ...d, one_year_plan: { ...d.one_year_plan, profit_goal: v } }))}
                    disabled={disabled}
                  />
                </div>
                <Textarea
                  label="Measurables"
                  value={draft.one_year_plan.measurables}
                  onChange={(v) => setDraft(d => ({ ...d, one_year_plan: { ...d.one_year_plan, measurables: v } }))}
                  rows={2}
                  disabled={disabled}
                />
                <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Goals (3-7 typical)</span>
                <ChipList
                  items={draft.one_year_plan.goals}
                  onChange={(arr) => setDraft(d => ({ ...d, one_year_plan: { ...d.one_year_plan, goals: arr } }))}
                  placeholder="e.g., Hit 100 paying customers"
                  disabled={disabled}
                />
              </SectionCard>
            </div>
          </div>
        </>
      )}

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New VTO Version"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setNewOpen(false)} className="text-sm px-4 py-2 text-gray-300">Cancel</button>
            <button onClick={newVersion} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Version'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-300 mb-3">
          Creates a new VTO row {selected ? `seeded from v${selected.version}` : 'with empty fields'}.
          It is created inactive - make it active explicitly when ready.
        </p>
      </Modal>
    </HubPage>
  )
}
