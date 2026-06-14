import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenantId } from '../../lib/useTenantId'

/**
 * AddToListModal — adds one or more lh_companies to a Lead Hunter list.
 * Props:
 *   companyIds: string[]  — company ids to add
 *   onClose:   () => void
 *   onAdded:   ({ listId, added, skipped }) => void
 *
 * Handles: pick existing list OR create a new one, de-dups members already
 * in the list, then recomputes lh_lists.company_count.
 */
export default function AddToListModal({ companyIds = [], onClose, onAdded }) {
  const { tenantId, tenantFilter } = useTenantId()
  const [lists, setLists] = useState([])
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [selectedListId, setSelectedListId] = useState('')
  const [newListName, setNewListName] = useState('')
  const [newListDesc, setNewListDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data, error: err } = await tenantFilter(
          supabase.from('lh_lists').select('id,name,company_count').order('created_at', { ascending: false })
        )
        if (err) throw err
        if (!active) return
        setLists(data || [])
        if (data && data.length > 0) {
          setSelectedListId(data[0].id)
          setMode('existing')
        } else {
          setMode('new')
        }
      } catch (e) {
        if (active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  async function handleConfirm() {
    if (!companyIds || companyIds.length === 0) {
      setError('No companies selected')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let listId = selectedListId

      // Create a new list if requested
      if (mode === 'new') {
        if (!newListName.trim()) {
          setError('List name is required')
          setSaving(false)
          return
        }
        const { data: created, error: createErr } = await supabase
          .from('lh_lists')
          .insert({
            name: newListName.trim(),
            description: newListDesc.trim() || null,
            list_type: 'static',
            company_count: 0,
            contact_count: 0,
            avg_lead_score: 0,
            tenant_id: tenantId,
          })
          .select('id')
          .single()
        if (createErr) throw createErr
        listId = created.id
      }

      if (!listId) {
        setError('Pick a list or create a new one')
        setSaving(false)
        return
      }

      // De-dup against members already in the list
      const { data: existing, error: exErr } = await supabase
        .from('lh_list_members')
        .select('company_id')
        .eq('list_id', listId)
        .in('company_id', companyIds)
      if (exErr) throw exErr

      const existingSet = new Set((existing || []).map(m => m.company_id))
      const toAdd = companyIds.filter(id => !existingSet.has(id))

      let added = 0
      if (toAdd.length > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        const rows = toAdd.map(cid => ({
          list_id: listId,
          company_id: cid,
          added_by: user?.id || null,
        }))
        const { error: insErr } = await supabase.from('lh_list_members').insert(rows)
        if (insErr) throw insErr
        added = toAdd.length
      }

      // Recompute company_count from source of truth
      const { count } = await supabase
        .from('lh_list_members')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', listId)
      await supabase
        .from('lh_lists')
        .update({ company_count: count || 0, updated_at: new Date().toISOString() })
        .eq('id', listId)

      onAdded?.({ listId, added, skipped: existingSet.size })
      onClose?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const count = companyIds?.length || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">
            Add {count} {count === 1 ? 'company' : 'companies'} to list
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('existing')}
                  disabled={lists.length === 0}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    mode === 'existing'
                      ? 'bg-sky-500/20 border-sky-500/50 text-white'
                      : 'bg-slate-900/50 border-slate-700/50 text-gray-400 hover:text-white disabled:opacity-40'
                  }`}
                >
                  Existing List
                </button>
                <button
                  onClick={() => setMode('new')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    mode === 'new'
                      ? 'bg-sky-500/20 border-sky-500/50 text-white'
                      : 'bg-slate-900/50 border-slate-700/50 text-gray-400 hover:text-white'
                  }`}
                >
                  New List
                </button>
              </div>

              {mode === 'existing' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Choose List</label>
                  {lists.length === 0 ? (
                    <p className="text-sm text-gray-500">No lists yet — create one.</p>
                  ) : (
                    <select
                      value={selectedListId}
                      onChange={e => setSelectedListId(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    >
                      {lists.map(l => (
                        <option key={l.id} value={l.id}>{l.name} ({l.company_count || 0})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {mode === 'new' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">List Name <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={newListName}
                      onChange={e => setNewListName(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      placeholder="e.g., Roofing Contractors - Jacksonville"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                    <textarea
                      value={newListDesc}
                      onChange={e => setNewListDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
                      placeholder="Optional notes about this list..."
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Adding…</>
            ) : (
              'Add to List'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
